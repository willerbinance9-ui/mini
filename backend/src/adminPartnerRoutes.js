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
  getPortalAccountById,
  listPortalMessages,
  createPortalMessage,
  deletePortalConversation,
  markPortalMessagesRead,
  listPortalChatConversationsAdmin,
  listPortalAccountsAdmin,
  listPortalInvestorProfilesAdmin,
  getPortalInvestorProfile,
  updatePortalAccount,
  isMissingTableError,
} = require('./db');
const { downloadKycImage } = require('./services/partnerKycStorage');

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function withOnlineFlag(account) {
  const lastSeen = account.last_seen_at ? new Date(account.last_seen_at).getTime() : 0;
  return {
    ...account,
    online: Boolean(lastSeen && Date.now() - lastSeen < ONLINE_WINDOW_MS),
  };
}
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

  const CHAT_SCHEMA_MSG = 'Chat schema missing. Run backend/sql/migrations/20260628_portal_messages.sql in Supabase.';

  app.get('/admin/api/portal-chats', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const conversations = await listPortalChatConversationsAdmin();
      return res.json({ conversations });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to list conversations' });
    }
  });

  app.get('/admin/api/portal-accounts', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const accounts = await listPortalAccountsAdmin({ limit: req.query.limit });
      return res.json({ accounts: accounts.map(withOnlineFlag) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to list portal accounts' });
    }
  });

  // Completed investor profiles (questionnaire answers the drops algorithm uses).
  app.get('/admin/api/portal-profiles', adminAuthMiddleware, requireSuperAdmin, async (req, res) => {
    try {
      const rows = await listPortalInvestorProfilesAdmin({ limit: req.query.limit });
      return res.json({
        profiles: rows.map((p) => ({
          id: p.id,
          portalAccountId: p.portal_account_id,
          account: p.partner_portal_accounts
            ? withOnlineFlag(p.partner_portal_accounts)
            : null,
          motivation: p.motivation,
          investmentAmount: p.investment_amount != null ? Number(p.investment_amount) : null,
          withdrawalMethod: p.withdrawal_method,
          withdrawalPercent: p.withdrawal_percent != null ? Number(p.withdrawal_percent) : null,
          withdrawalFrequency: p.withdrawal_frequency,
          hasPhoto: Boolean(p.photo_storage_path),
          completedAt: p.completed_at,
          updatedAt: p.updated_at,
        })),
      });
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json({
          message: 'Investor profile schema missing. Run backend/sql/migrations/20260627_portal_investor_profile.sql.',
        });
      }
      return res.status(500).json({ message: e?.message || 'Failed to list investor profiles' });
    }
  });

  app.get(
    '/admin/api/portal-profiles/:accountId/photo',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const profile = await getPortalInvestorProfile(req.params.accountId);
        if (!profile?.photo_storage_path) return res.status(404).json({ message: 'No profile picture' });
        const buf = await downloadKycImage(profile.photo_storage_path);
        if (!buf) return res.status(404).json({ message: 'Profile picture unavailable' });
        res.setHeader('Content-Type', profile.photo_storage_path.endsWith('.png') ? 'image/png' : 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=300');
        return res.send(buf);
      } catch (e) {
        return res.status(500).json({ message: e?.message || 'Failed to load photo' });
      }
    }
  );

  app.get(
    '/admin/api/portal-chats/:accountId/messages',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const account = await getPortalAccountById(req.params.accountId);
        if (!account) return res.status(404).json({ message: 'Portal account not found' });

        const messages = await listPortalMessages(account.id, { limit: req.query.limit });
        await markPortalMessagesRead(account.id, 'partner');
        return res.json({
          account: {
            id: account.id,
            email: account.email,
            fullName: account.full_name,
            humanRequested: Boolean(account.chat_human_requested_at),
          },
          messages: messages.map((m) => ({
            id: m.id,
            sender: m.sender,
            body: m.body,
            readAt: m.read_at,
            createdAt: m.created_at,
            adminUsername: m.admin_username,
          })),
        });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
        return res.status(500).json({ message: e?.message || 'Failed to load messages' });
      }
    }
  );

  app.post(
    '/admin/api/portal-chats/:accountId/messages',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const account = await getPortalAccountById(req.params.accountId);
        if (!account) return res.status(404).json({ message: 'Portal account not found' });

        const body = String(req.body?.body || '').trim();
        if (!body) return res.status(400).json({ message: 'Message cannot be empty' });
        if (body.length > 4000) return res.status(400).json({ message: 'Message too long (max 4000 characters)' });

        // Agent reply claims the thread so AarAi stops answering mid-conversation.
        if (!account.chat_human_requested_at) {
          await updatePortalAccount(account.id, { chat_human_requested_at: new Date().toISOString() });
        }

        const msg = await createPortalMessage({
          portalAccountId: account.id,
          sender: 'admin',
          body,
          adminUsername: req.adminUser || 'admin',
        });
        return res.status(201).json({
          message: {
            id: msg.id,
            sender: msg.sender,
            body: msg.body,
            readAt: msg.read_at,
            createdAt: msg.created_at,
            adminUsername: msg.admin_username,
          },
        });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
        return res.status(500).json({ message: e?.message || 'Failed to send message' });
      }
    }
  );

  // Hand the thread back to AarAi after the admin resolves the issue.
  app.post(
    '/admin/api/portal-chats/:accountId/return-to-ai',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const account = await getPortalAccountById(req.params.accountId);
        if (!account) return res.status(404).json({ message: 'Portal account not found' });

        await updatePortalAccount(account.id, { chat_human_requested_at: null });
        await createPortalMessage({
          portalAccountId: account.id,
          sender: 'ai',
          body: 'Our agent has closed this conversation. I am back to help — ask me anything.',
        });
        return res.json({ ok: true });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
        return res.status(500).json({ message: e?.message || 'Failed to return thread to AI' });
      }
    }
  );

  // Wipe a portal chat thread (all messages) and clear agent handoff.
  app.delete(
    '/admin/api/portal-chats/:accountId',
    adminAuthMiddleware,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const account = await getPortalAccountById(req.params.accountId);
        if (!account) return res.status(404).json({ message: 'Portal account not found' });

        const result = await deletePortalConversation(account.id);
        return res.json({ ok: true, deleted: result.deleted, accountId: account.id });
      } catch (e) {
        if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
        return res.status(500).json({ message: e?.message || 'Failed to delete conversation' });
      }
    }
  );

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
