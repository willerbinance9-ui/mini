const crypto = require('crypto');
const {
  listPartnerApplicationsAdmin,
  getPartnerApplicationById,
  updatePartnerApplication,
  createPartnerWithApiKey,
  listPartnersAdmin,
  linkPortalAccountByEmail,
  listPortalKycAdmin,
  getPortalKycById,
  updatePortalKyc,
  isMissingTableError,
} = require('./db');
const { adminAuthMiddleware, requireSuperAdmin } = require('./middleware/adminAuth');
const { hashPartnerApiKey } = require('./middleware/partnerAuth');
const { sendEmail } = require('./services/emailNotify');

const SCHEMA_MSG =
  'Partner applications schema missing. Run backend/sql/migrations/20260622_partner_applications.sql in Supabase.';

function slugFromName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function registerAdminPartnerRoutes(app) {
  app.get('/admin/api/partners', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const partners = await listPartnersAdmin();
      return res.json({ partners });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to list partners' });
    }
  });

  app.get('/admin/api/partner-applications', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const rows = await listPartnerApplicationsAdmin({ status, limit });
      return res.json({ applications: rows });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to list applications' });
    }
  });

  app.get('/admin/api/partner-applications/:id', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const row = await getPartnerApplicationById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Application not found' });
      return res.json({ application: row });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load application' });
    }
  });

  app.patch('/admin/api/partner-applications/:id', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const existing = await getPartnerApplicationById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Application not found' });

      const status = req.body?.status != null ? String(req.body.status) : undefined;
      const adminNotes = req.body?.adminNotes != null ? String(req.body.adminNotes) : undefined;
      const allowed = ['pending', 'reviewing', 'approved', 'rejected'];
      if (status != null && !allowed.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const row = await updatePartnerApplication(req.params.id, {
        status,
        admin_notes: adminNotes,
      });
      return res.json({ application: row });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to update application' });
    }
  });

  app.post(
    '/admin/api/partner-applications/:id/approve',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const existing = await getPartnerApplicationById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Application not found' });
        if (existing.partner_id) {
          return res.status(400).json({ message: 'Application already linked to a partner' });
        }

        const partnerName = String(req.body?.partnerName || existing.full_name).trim();
        const slug = String(req.body?.slug || slugFromName(partnerName)).trim();
        if (!partnerName || !slug) {
          return res.status(400).json({ message: 'partnerName and slug are required' });
        }

        const rawKey = `ema_pk_${crypto.randomBytes(24).toString('base64url')}`;
        const result = await createPartnerWithApiKey({
          name: partnerName,
          slug,
          keyName: 'default',
          keyPrefix: rawKey.slice(0, 16),
          keyHash: hashPartnerApiKey(rawKey),
        });

        const row = await updatePartnerApplication(req.params.id, {
          status: 'approved',
          partner_id: result.partner.id,
        });

        await linkPortalAccountByEmail(existing.email, {
          partnerId: result.partner.id,
          applicationId: existing.id,
        }).catch(() => {});

        void sendEmail({
          to: existing.email,
          subject: 'Aare Partner API — application approved',
          text: [
            `Hi ${existing.full_name},`,
            '',
            'Your partnership application has been approved.',
            `Partner: ${result.partner.name} (${result.partner.slug})`,
            '',
            'Your API key was issued separately by our team. Store it securely and never embed it in client apps.',
            '',
            `Application reference: ${existing.id}`,
          ].join('\n'),
        });

        return res.status(201).json({
          application: row,
          partner: result.partner,
          apiKey: rawKey,
          apiKeyPrefix: rawKey.slice(0, 16),
          warning: 'Store apiKey securely; shown only once.',
        });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
        if (e?.code === '23505') return res.status(400).json({ message: 'Partner slug already exists' });
        return res.status(500).json({ message: e?.message || 'Failed to approve application' });
      }
    }
  );

  app.post(
    '/admin/api/partner-applications/:id/reject',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const existing = await getPartnerApplicationById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Application not found' });

        const reason = String(req.body?.reason || '').trim();
        const row = await updatePartnerApplication(req.params.id, {
          status: 'rejected',
          admin_notes: reason || existing.admin_notes || null,
        });

        void sendEmail({
          to: existing.email,
          subject: 'Aare Partner API — application update',
          text: [
            `Hi ${existing.full_name},`,
            '',
            'Thank you for your interest in the Min Partner API.',
            'After review, we are unable to approve your application at this time.',
            reason ? `\nNote: ${reason}` : '',
            '',
            `Reference: ${existing.id}`,
          ].join('\n'),
        });

        return res.json({ application: row });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
        return res.status(500).json({ message: e?.message || 'Failed to reject application' });
      }
    }
  );

  app.get('/admin/api/portal-kyc', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const rows = await listPortalKycAdmin({ status, limit: 50 });
      return res.json({ kycRecords: rows });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to list KYC' });
    }
  });

  app.patch('/admin/api/portal-kyc/:id', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const existing = await getPortalKycById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'KYC record not found' });

      const status = req.body?.status != null ? String(req.body.status) : undefined;
      const allowed = ['approved', 'rejected', 'manual_review'];
      if (status != null && !allowed.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const rejectionReason = req.body?.rejectionReason != null ? String(req.body.rejectionReason) : undefined;

      const row = await updatePortalKyc(existing.id, {
        status,
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
      });
      return res.json({ kyc: row });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to update KYC' });
    }
  });
}

module.exports = { registerAdminPartnerRoutes };
