const bcrypt = require('bcryptjs');
const multer = require('multer');
const {
  createPortalAccount,
  getPortalAccountByEmail,
  getPortalAccountById,
  updatePortalAccount,
  getPartnerApplicationById,
  getPartnerApplicationByEmail,
  getPartnerById,
  getPartnerWebhookConfig,
  countPartnerUsers,
  getPartnerCommissionStats,
  listPartnerApiKeys,
  listPartnerUsersForPortal,
  createPortalLoginChallenge,
  getPortalLoginChallenge,
  incrementPortalLoginChallengeAttempts,
  consumePortalLoginChallenge,
  getOrCreatePortalKyc,
  getPortalKycByAccountId,
  updatePortalKyc,
  getPortalInvestorProfile,
  upsertPortalInvestorProfile,
  listPortalMessages,
  createPortalMessage,
  markPortalMessagesRead,
  countUnreadPortalMessages,
  isMissingTableError,
} = require('./db');
const { portalAuthMiddleware, signPortalToken } = require('./middleware/portalAuth');
const { PARTNER_COMMISSION_RATE } = require('./platformRevenueService');
const { normalizePhoneDigits, sendLoginOtp, verifyOtpCode } = require('./services/portalOtp');
const { uploadKycImage, downloadKycImage } = require('./services/partnerKycStorage');
const { reviewPartnerKyc } = require('./services/partnerKycAiReview');
const { generateChatReply, OFFER_AGENT_MARKER, CONNECT_AGENT_MARKER } = require('./services/aareChatAi');

const SCHEMA_MSG =
  'Partner portal schema missing. Run backend/sql/migrations/20260624_partner_portal.sql and 20260625_partner_portal_kyc.sql in Supabase.';
const KYC_SCHEMA_MSG =
  'Partner KYC schema missing. Run backend/sql/migrations/20260625_partner_portal_kyc.sql in Supabase.';
const PROFILE_SCHEMA_MSG =
  'Investor profile schema missing. Run backend/sql/migrations/20260627_portal_investor_profile.sql in Supabase.';
const CHAT_SCHEMA_MSG =
  'Chat schema missing. Run backend/sql/migrations/20260628_portal_messages.sql in Supabase.';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Only JPEG or PNG images allowed'), ok);
  },
});

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const API_PACKAGES = new Set(['airfarming_only', 'airfarming_vip', 'full']);

function toPortalPublic(account) {
  return {
    id: account.id,
    email: account.email,
    fullName: account.full_name,
    phoneCountry: account.phone_country,
    countryOfResidency: account.country_of_residency,
    phone: account.phone || null,
    phoneVerified: Boolean(account.phone_verified_at),
    partnerId: account.partner_id,
    applicationId: account.application_id,
    apiPackage: account.api_package || null,
    apiPackageSelectedAt: account.api_package_selected_at || null,
    createdAt: account.created_at,
  };
}

function needsPackageSelection(account, application) {
  const approved = application?.status === 'approved';
  return Boolean(approved && !account.api_package);
}

function toApplicationPublic(app) {
  if (!app) return null;
  return {
    id: app.id,
    status: app.status,
    fullName: app.full_name,
    email: app.email,
    country: app.country,
    intendedInvestment: Number(app.intended_investment),
    paymentPreference: app.payment_preference,
    hasApiKnowledge: app.has_api_knowledge,
    apiPlan: app.api_plan,
    partnerId: app.partner_id,
    adminNotes: app.admin_notes,
    source: app.payload?.source || 'aare',
    submittedFrom: app.payload?.submittedFrom || 'aare.cc',
    createdAt: app.created_at,
    updatedAt: app.updated_at,
  };
}

function toKycPublic(kyc) {
  if (!kyc) {
    return {
      status: 'draft',
      residenceCountry: null,
      residenceScope: null,
      documentType: null,
      hasFront: false,
      hasBack: false,
      rejectionReason: null,
      aiConfidence: null,
      submittedAt: null,
      reviewedAt: null,
    };
  }
  return {
    id: kyc.id,
    status: kyc.status,
    residenceCountry: kyc.residence_country,
    residenceScope: kyc.residence_scope,
    documentType: kyc.document_type,
    hasFront: Boolean(kyc.front_storage_path),
    hasBack: Boolean(kyc.back_storage_path),
    rejectionReason: kyc.rejection_reason,
    aiConfidence: kyc.ai_confidence != null ? Number(kyc.ai_confidence) : null,
    submittedAt: kyc.submitted_at,
    reviewedAt: kyc.reviewed_at,
  };
}

const { canApplyForApi } = require('./portalKycUtil');

const WITHDRAWAL_METHODS = new Set(['bank', 'crypto']);
const WITHDRAWAL_FREQUENCIES = new Set(['weekly', 'biweekly', 'monthly', 'trimester']);

function toInvestorProfilePublic(profile) {
  if (!profile) {
    return {
      motivation: null,
      investmentAmount: null,
      withdrawalMethod: null,
      withdrawalPercent: null,
      withdrawalFrequency: null,
      hasPhoto: false,
      completedAt: null,
      updatedAt: null,
    };
  }
  return {
    id: profile.id,
    motivation: profile.motivation,
    investmentAmount: profile.investment_amount != null ? Number(profile.investment_amount) : null,
    withdrawalMethod: profile.withdrawal_method,
    withdrawalPercent: profile.withdrawal_percent != null ? Number(profile.withdrawal_percent) : null,
    withdrawalFrequency: profile.withdrawal_frequency,
    hasPhoto: Boolean(profile.photo_storage_path),
    completedAt: profile.completed_at,
    updatedAt: profile.updated_at,
  };
}

function toMessagePublic(msg) {
  const rawBody = String(msg.body || '');
  const offerAgent = rawBody.includes(OFFER_AGENT_MARKER);
  return {
    id: msg.id,
    sender: msg.sender,
    body: rawBody.replaceAll(OFFER_AGENT_MARKER, '').replaceAll(CONNECT_AGENT_MARKER, '').trim(),
    readAt: msg.read_at,
    createdAt: msg.created_at,
    offerAgent: msg.sender === 'ai' ? offerAgent : false,
  };
}

function isInvestorProfileComplete(profile) {
  return Boolean(
    profile &&
      profile.motivation &&
      profile.investment_amount != null &&
      profile.withdrawal_method &&
      profile.withdrawal_percent != null &&
      profile.withdrawal_frequency
  );
}

async function resolvePortalContext(account) {
  let application = null;
  if (account.application_id) {
    application = await getPartnerApplicationById(account.application_id);
  }
  if (!application) {
    application = await getPartnerApplicationByEmail(account.email);
    if (application && !account.application_id) {
      await updatePortalAccount(account.id, { application_id: application.id });
    }
  }

  let partner = null;
  const partnerId = account.partner_id || application?.partner_id || null;
  if (partnerId) {
    partner = await getPartnerById(partnerId);
    if (!account.partner_id) {
      await updatePortalAccount(account.id, { partner_id: partnerId });
    }
  }

  const kyc = await getPortalKycByAccountId(account.id);

  return { application, partner, partnerId, kyc };
}

function mapKycStatusFromVerdict(verdict) {
  if (verdict === 'approve') return 'approved';
  if (verdict === 'reject') return 'rejected';
  return 'manual_review';
}

function registerPartnerPortalRoutes(app) {
  app.post('/v1/public/portal/register', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const fullName = String(req.body?.fullName || req.body?.full_name || '').trim();
      const phoneCountry = String(req.body?.phoneCountry || req.body?.phone_country || '').trim().toUpperCase();
      const countryOfResidency = String(
        req.body?.countryOfResidency || req.body?.country_of_residency || ''
      ).trim();
      const phone = normalizePhoneDigits(req.body?.phone, phoneCountry);

      if (!email || !email.includes('@')) return res.status(400).json({ message: 'Valid email is required' });
      if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
      if (!phone) return res.status(400).json({ message: 'Valid phone number is required' });
      if (!countryOfResidency) return res.status(400).json({ message: 'Country of residency is required' });

      const existing = await getPortalAccountByEmail(email);
      if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

      const passwordHash = await bcrypt.hash(password, 10);
      let account = await createPortalAccount({
        email,
        passwordHash,
        fullName,
        phone,
        phoneCountry,
        countryOfResidency,
      });

      await getOrCreatePortalKyc(account.id);

      const application = await getPartnerApplicationByEmail(email);
      if (application) {
        account = await updatePortalAccount(account.id, { application_id: application.id });
        if (application.partner_id) {
          account = await updatePortalAccount(account.id, { partner_id: application.partner_id });
        }
      }

      const token = signPortalToken(account);
      const kyc = await getPortalKycByAccountId(account.id);
      return res.status(201).json({
        token,
        account: toPortalPublic(account),
        application: toApplicationPublic(application),
        kyc: toKycPublic(kyc),
        canApplyForApi: canApplyForApi(kyc),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      if (e?.code === '23505') return res.status(409).json({ message: 'Email already registered' });
      return res.status(500).json({ message: e?.message || 'Registration failed' });
    }
  });

  // Direct login (testing / when SMS OTP is disabled)
  app.post('/v1/public/portal/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

      const account = await getPortalAccountByEmail(email);
      if (!account) return res.status(401).json({ message: 'Invalid email or password' });

      const ok = await bcrypt.compare(password, account.password_hash);
      if (!ok) return res.status(401).json({ message: 'Invalid email or password' });

      const { application, kyc } = await resolvePortalContext(account);
      const token = signPortalToken(account);
      return res.json({
        token,
        account: toPortalPublic(account),
        application: toApplicationPublic(application),
        kyc: toKycPublic(kyc),
        canApplyForApi: canApplyForApi(kyc),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Login failed' });
    }
  });

  app.post('/v1/public/portal/login/start', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

      const account = await getPortalAccountByEmail(email);
      if (!account) return res.status(401).json({ message: 'Invalid email or password' });

      const ok = await bcrypt.compare(password, account.password_hash);
      if (!ok) return res.status(401).json({ message: 'Invalid email or password' });

      if (!account.phone) {
        return res.status(400).json({ message: 'No phone on file. Contact support to update your account.' });
      }

      const { codeHash, maskedPhone } = await sendLoginOtp(account.phone);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
      const challenge = await createPortalLoginChallenge({
        portalAccountId: account.id,
        codeHash,
        expiresAt,
      });

      return res.json({
        challengeId: challenge.id,
        maskedPhone,
        expiresInSec: OTP_EXPIRY_MS / 1000,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      if (e?.statusCode) return res.status(e.statusCode).json({ message: e.message });
      return res.status(500).json({ message: e?.message || 'Login failed' });
    }
  });

  app.post('/v1/public/portal/login/verify', async (req, res) => {
    try {
      const challengeId = String(req.body?.challengeId || '');
      const code = String(req.body?.code || '').trim();
      if (!challengeId || !code) return res.status(400).json({ message: 'challengeId and code are required' });

      const challenge = await getPortalLoginChallenge(challengeId);
      if (!challenge || challenge.consumed_at) {
        return res.status(400).json({ message: 'Invalid or expired verification session' });
      }
      if (new Date(challenge.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ message: 'Verification code expired' });
      }
      if ((challenge.attempts || 0) >= MAX_OTP_ATTEMPTS) {
        return res.status(429).json({ message: 'Too many attempts. Request a new code.' });
      }

      const valid = await verifyOtpCode(code, challenge.code_hash);
      if (!valid) {
        await incrementPortalLoginChallengeAttempts(challengeId);
        return res.status(401).json({ message: 'Invalid verification code' });
      }

      await consumePortalLoginChallenge(challengeId);
      let account = await getPortalAccountById(challenge.portal_account_id);
      if (!account) return res.status(401).json({ message: 'Account not found' });

      account = await updatePortalAccount(account.id, {
        phone_verified_at: new Date().toISOString(),
      });

      const { application, kyc } = await resolvePortalContext(account);
      const token = signPortalToken(account);
      return res.json({
        token,
        account: toPortalPublic(account),
        application: toApplicationPublic(application),
        kyc: toKycPublic(kyc),
        canApplyForApi: canApplyForApi(kyc),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Verification failed' });
    }
  });

  app.get('/v1/portal/me', portalAuthMiddleware, async (req, res) => {
    try {
      const { application, partner, partnerId, kyc } = await resolvePortalContext(req.portalAccount);
      const account = req.portalAccount;
      return res.json({
        account: toPortalPublic(account),
        application: toApplicationPublic(application),
        partner: partner
          ? { id: partner.id, name: partner.name, slug: partner.slug, status: partner.status }
          : null,
        partnerId,
        hasPartnerAccess: Boolean(partnerId && partner?.status === 'active'),
        kyc: toKycPublic(kyc),
        kycStatus: kyc?.status || 'draft',
        canApplyForApi: canApplyForApi(kyc),
        apiPackage: account.api_package || null,
        needsPackageSelection: needsPackageSelection(account, application),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load account' });
    }
  });

  // Packages are purchased once via NOWPayments checkout (POST /v1/portal/api-package/checkout)
  // and locked permanently. Direct selection is no longer allowed.
  app.put('/v1/portal/api-package', portalAuthMiddleware, async (req, res) => {
    if (req.portalAccount.api_package) {
      return res.status(400).json({
        message: 'You already purchased a package. Package choices are final and cannot be changed.',
      });
    }
    return res.status(400).json({
      message: 'API packages are purchased through crypto checkout. Use the buy flow on the package page.',
    });
  });

  app.get('/v1/portal/kyc', portalAuthMiddleware, async (req, res) => {
    try {
      const kyc = await getOrCreatePortalKyc(req.portalAccountId);
      return res.json({ kyc: toKycPublic(kyc), canApplyForApi: canApplyForApi(kyc) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: KYC_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load KYC' });
    }
  });

  app.put('/v1/portal/kyc', portalAuthMiddleware, async (req, res) => {
    try {
      let kyc = await getOrCreatePortalKyc(req.portalAccountId);
      if (['approved', 'ai_reviewing', 'submitted'].includes(kyc.status)) {
        return res.status(400).json({ message: 'KYC is under review and cannot be edited' });
      }

      const residenceCountry = String(req.body?.residenceCountry || '').trim() || null;
      const residenceScope = req.body?.residenceScope || null;
      const documentType = req.body?.documentType || null;

      if (residenceScope && !['live_only', 'work_only', 'live_and_work'].includes(residenceScope)) {
        return res.status(400).json({ message: 'Invalid residenceScope' });
      }
      if (documentType && !['permit_id', 'passport'].includes(documentType)) {
        return res.status(400).json({ message: 'Invalid documentType' });
      }

      kyc = await updatePortalKyc(kyc.id, {
        residence_country: residenceCountry,
        residence_scope: residenceScope,
        document_type: documentType,
        status: kyc.status === 'rejected' || kyc.status === 'manual_review' ? 'draft' : kyc.status,
      });

      return res.json({ kyc: toKycPublic(kyc) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: KYC_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to save KYC' });
    }
  });

  app.post('/v1/portal/kyc/upload', portalAuthMiddleware, upload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]), async (req, res) => {
    try {
      let kyc = await getOrCreatePortalKyc(req.portalAccountId);
      if (['approved', 'ai_reviewing', 'submitted'].includes(kyc.status)) {
        return res.status(400).json({ message: 'KYC is under review' });
      }

      const front = req.files?.front?.[0];
      const back = req.files?.back?.[0];
      if (!front) return res.status(400).json({ message: 'Front image is required' });

      const docType = req.body?.documentType || kyc.document_type;
      if (docType === 'permit_id' && !back && !kyc.back_storage_path) {
        return res.status(400).json({ message: 'Back image is required for permit ID' });
      }

      const frontPath = await uploadKycImage({
        portalAccountId: req.portalAccountId,
        side: 'front',
        buffer: front.buffer,
        mimeType: front.mimetype,
      });

      const patch = { front_storage_path: frontPath };
      if (back) {
        patch.back_storage_path = await uploadKycImage({
          portalAccountId: req.portalAccountId,
          side: 'back',
          buffer: back.buffer,
          mimeType: back.mimetype,
        });
      } else if (docType === 'passport') {
        patch.back_storage_path = null;
      }

      kyc = await updatePortalKyc(kyc.id, patch);
      return res.json({ kyc: toKycPublic(kyc) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: KYC_SCHEMA_MSG });
      if (e?.statusCode) return res.status(e.statusCode).json({ message: e.message });
      return res.status(500).json({ message: e?.message || 'Upload failed' });
    }
  });

  app.post('/v1/portal/kyc/submit', portalAuthMiddleware, async (req, res) => {
    try {
      const kyc = await getPortalKycByAccountId(req.portalAccountId);
      if (!kyc) return res.status(400).json({ message: 'Complete KYC steps first' });
      if (kyc.status === 'approved') {
        return res.json({ kyc: toKycPublic(kyc), canApplyForApi: true });
      }
      if (['submitted', 'ai_reviewing'].includes(kyc.status)) {
        return res.status(400).json({ message: 'KYC already submitted' });
      }

      if (!kyc.residence_country || !kyc.residence_scope || !kyc.document_type) {
        return res.status(400).json({ message: 'Complete residence and document type steps' });
      }
      if (!kyc.front_storage_path) {
        return res.status(400).json({ message: 'Upload document photos first' });
      }
      if (kyc.document_type === 'permit_id' && !kyc.back_storage_path) {
        return res.status(400).json({ message: 'Permit ID requires front and back photos' });
      }

      await updatePortalKyc(kyc.id, { status: 'submitted', submitted_at: new Date().toISOString() });
      await updatePortalKyc(kyc.id, { status: 'ai_reviewing' });

      const account = await getPortalAccountById(req.portalAccountId);
      const ai = await reviewPartnerKyc({ account, kyc });
      const status = mapKycStatusFromVerdict(ai.verdict);
      const rejectionReason =
        status === 'rejected' || status === 'manual_review' ? (ai.reasons || []).join('; ') : null;

      const updated = await updatePortalKyc(kyc.id, {
        status,
        ai_result: ai,
        ai_confidence: ai.confidence,
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
      });

      return res.json({
        kyc: toKycPublic(updated),
        canApplyForApi: canApplyForApi(updated),
        aiReview: ai,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: KYC_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'KYC submit failed' });
    }
  });

  app.get('/v1/portal/profile', portalAuthMiddleware, async (req, res) => {
    try {
      const profile = await getPortalInvestorProfile(req.portalAccountId);
      return res.json({
        profile: toInvestorProfilePublic(profile),
        complete: isInvestorProfileComplete(profile),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: PROFILE_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load investor profile' });
    }
  });

  app.put('/v1/portal/profile', portalAuthMiddleware, async (req, res) => {
    try {
      const motivation = String(req.body?.motivation || '').trim();
      const investmentAmount = Number(req.body?.investmentAmount);
      const withdrawalMethod = String(req.body?.withdrawalMethod || '').trim();
      const withdrawalPercent = Number(req.body?.withdrawalPercent);
      const withdrawalFrequency = String(req.body?.withdrawalFrequency || '').trim();

      if (!motivation || motivation.length < 10) {
        return res.status(400).json({ message: 'Tell us what made you want to invest (at least 10 characters).' });
      }
      if (!Number.isFinite(investmentAmount) || investmentAmount <= 0) {
        return res.status(400).json({ message: 'Enter a valid investment amount.' });
      }
      if (!WITHDRAWAL_METHODS.has(withdrawalMethod)) {
        return res.status(400).json({ message: 'Choose where you will withdraw to: bank or crypto.' });
      }
      if (!Number.isFinite(withdrawalPercent) || withdrawalPercent < 0 || withdrawalPercent > 100) {
        return res.status(400).json({ message: 'Withdrawal percentage must be between 0 and 100.' });
      }
      if (!WITHDRAWAL_FREQUENCIES.has(withdrawalFrequency)) {
        return res.status(400).json({ message: 'Choose a withdrawal frequency: weekly, biweekly, monthly, or trimester.' });
      }

      const profile = await upsertPortalInvestorProfile(req.portalAccountId, {
        motivation: motivation.slice(0, 2000),
        investment_amount: Math.round(investmentAmount * 100) / 100,
        withdrawal_method: withdrawalMethod,
        withdrawal_percent: Math.round(withdrawalPercent * 100) / 100,
        withdrawal_frequency: withdrawalFrequency,
        completed_at: new Date().toISOString(),
      });

      return res.json({
        profile: toInvestorProfilePublic(profile),
        complete: isInvestorProfileComplete(profile),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: PROFILE_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to save investor profile' });
    }
  });

  app.post('/v1/portal/profile/photo', portalAuthMiddleware, upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Profile picture is required' });

      const path = await uploadKycImage({
        portalAccountId: req.portalAccountId,
        side: 'profile',
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });

      const profile = await upsertPortalInvestorProfile(req.portalAccountId, {
        photo_storage_path: path,
      });

      return res.json({
        profile: toInvestorProfilePublic(profile),
        complete: isInvestorProfileComplete(profile),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: PROFILE_SCHEMA_MSG });
      if (e?.statusCode) return res.status(e.statusCode).json({ message: e.message });
      return res.status(500).json({ message: e?.message || 'Photo upload failed' });
    }
  });

  app.get('/v1/portal/profile/photo', portalAuthMiddleware, async (req, res) => {
    try {
      const profile = await getPortalInvestorProfile(req.portalAccountId);
      if (!profile?.photo_storage_path) return res.status(404).json({ message: 'No profile picture' });

      const buf = await downloadKycImage(profile.photo_storage_path);
      if (!buf) return res.status(404).json({ message: 'Profile picture unavailable' });

      const isPng = profile.photo_storage_path.endsWith('.png');
      res.setHeader('Content-Type', isPng ? 'image/png' : 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.send(buf);
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: PROFILE_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load photo' });
    }
  });

  // Direct chat: AarAi answers first; thread escalates to a human admin on request.
  // Fetching the thread marks admin/AI messages as read.
  app.get('/v1/portal/messages', portalAuthMiddleware, async (req, res) => {
    try {
      const messages = await listPortalMessages(req.portalAccountId, { limit: req.query.limit });
      await markPortalMessagesRead(req.portalAccountId, 'admin');
      await markPortalMessagesRead(req.portalAccountId, 'ai');
      return res.json({
        messages: messages.map(toMessagePublic),
        humanRequested: Boolean(req.portalAccount.chat_human_requested_at),
        offerAgent: Boolean(
          !req.portalAccount.chat_human_requested_at &&
            messages.length &&
            toMessagePublic(messages[messages.length - 1]).offerAgent
        ),
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load messages' });
    }
  });

  app.get('/v1/portal/messages/unread', portalAuthMiddleware, async (req, res) => {
    try {
      const unread = await countUnreadPortalMessages(req.portalAccountId, ['admin', 'ai']);
      return res.json({ unread });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load unread count' });
    }
  });

  app.post('/v1/portal/messages', portalAuthMiddleware, async (req, res) => {
    try {
      const body = String(req.body?.body || '').trim();
      if (!body) return res.status(400).json({ message: 'Message cannot be empty' });
      if (body.length > 4000) return res.status(400).json({ message: 'Message too long (max 4000 characters)' });

      const account = req.portalAccount;
      const msg = await createPortalMessage({
        portalAccountId: req.portalAccountId,
        sender: 'partner',
        body,
      });

      // Human already handling this thread — no AI reply.
      if (account.chat_human_requested_at) {
        return res.status(201).json({ message: toMessagePublic(msg), humanRequested: true });
      }

      // Return immediately so the widget is not stuck waiting on DeepSeek (up to 30s).
      // AarAi reply is written in the background; the client polls /messages for it.
      res.status(201).json({
        message: toMessagePublic(msg),
        humanRequested: false,
        aiPending: true,
      });

      void (async () => {
        try {
          // Re-check handoff in case the user clicked "speak to an agent" while AI was thinking.
          const fresh = await getPortalAccountById(req.portalAccountId);
          if (fresh?.chat_human_requested_at) return;

          const { application, partner, kyc } = await resolvePortalContext(fresh || account);
          const thread = await listPortalMessages(req.portalAccountId, { limit: 12 });
          const ai = await generateChatReply({
            account: fresh || account,
            context: {
              kycStatus: kyc?.status || 'draft',
              applicationStatus: application?.status || null,
              apiPackage: (fresh || account).api_package || null,
              hasPartnerAccess: Boolean(partner && partner.status === 'active'),
            },
            messages: thread,
          });

          // Handoff may have happened while the model was running.
          const stillAi = await getPortalAccountById(req.portalAccountId);
          if (stillAi?.chat_human_requested_at) return;

          if (!ai) {
            await updatePortalAccount(req.portalAccountId, { chat_human_requested_at: new Date().toISOString() });
            await createPortalMessage({
              portalAccountId: req.portalAccountId,
              sender: 'ai',
              body: 'Thanks for your message. Connecting you with an agent — they will reply here shortly.',
            });
            return;
          }

          await createPortalMessage({
            portalAccountId: req.portalAccountId,
            sender: 'ai',
            // Keep marker in storage so the client can show "speak to an agent?" after async poll.
            body: ai.offerAgent ? `${ai.reply}\n${OFFER_AGENT_MARKER}` : ai.reply,
          });

          if (ai.connectAgent) {
            await updatePortalAccount(req.portalAccountId, { chat_human_requested_at: new Date().toISOString() });
          }
        } catch (e) {
          console.error('[portal-chat-ai-bg]', e?.message || e);
          try {
            const stillAi = await getPortalAccountById(req.portalAccountId);
            if (stillAi?.chat_human_requested_at) return;
            await updatePortalAccount(req.portalAccountId, { chat_human_requested_at: new Date().toISOString() });
            await createPortalMessage({
              portalAccountId: req.portalAccountId,
              sender: 'ai',
              body: 'Thanks for your message. Connecting you with an agent — they will reply here shortly.',
            });
          } catch (_) { /* ignore secondary failure */ }
        }
      })();
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to send message' });
    }
  });

  // Explicit "speak to an agent" from the chat widget (header button or in-chat yes choice).
  app.post('/v1/portal/messages/handoff', portalAuthMiddleware, async (req, res) => {
    try {
      if (!req.portalAccount.chat_human_requested_at) {
        await updatePortalAccount(req.portalAccountId, { chat_human_requested_at: new Date().toISOString() });
        await createPortalMessage({
          portalAccountId: req.portalAccountId,
          sender: 'ai',
          body: 'You are now connected with an agent. They will reply here shortly.',
        });
      }
      const messages = await listPortalMessages(req.portalAccountId, { limit: 100 });
      return res.json({ messages: messages.map(toMessagePublic), humanRequested: true });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: CHAT_SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to connect you to an agent' });
    }
  });

  app.get('/v1/portal/overview', portalAuthMiddleware, async (req, res) => {
    try {
      const { partner, partnerId } = await resolvePortalContext(req.portalAccount);
      if (!partnerId || !partner) {
        return res.json({
          ready: false,
          message: 'Complete your partnership application and wait for approval to access API data.',
        });
      }
      if (partner.status !== 'active') {
        return res.json({ ready: false, message: 'Your partner account is suspended.' });
      }

      const [userCount, commission, webhook, apiKeys, users] = await Promise.all([
        countPartnerUsers(partnerId),
        getPartnerCommissionStats(partnerId),
        getPartnerWebhookConfig(partnerId),
        listPartnerApiKeys(partnerId),
        listPartnerUsersForPortal(partnerId, { limit: 50 }),
      ]);

      const totalCashUsd = users.reduce((sum, u) => sum + Number(u.cashWalletUsd || 0), 0);

      return res.json({
        ready: true,
        partner: { id: partner.id, name: partner.name, slug: partner.slug, status: partner.status },
        userCount,
        commissionRate: PARTNER_COMMISSION_RATE,
        commission: commission.totals,
        commissionEvents: commission.events.slice(0, 20),
        totalCashUsd: Math.round(totalCashUsd * 100) / 100,
        webhook: {
          enabled: Boolean(webhook?.webhook_enabled),
          url: webhook?.webhook_url || null,
          events: webhook?.webhook_events || [],
        },
        apiKeys: apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.key_prefix,
          scopes: k.scopes || [],
          active: !k.revoked_at,
          lastUsedAt: k.last_used_at,
          createdAt: k.created_at,
        })),
        users,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load overview' });
    }
  });

  app.get('/v1/portal/users', portalAuthMiddleware, async (req, res) => {
    try {
      const { partner, partnerId } = await resolvePortalContext(req.portalAccount);
      if (!partnerId || partner?.status !== 'active') {
        return res.status(403).json({ message: 'Partner API access not active yet' });
      }
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const users = await listPartnerUsersForPortal(partnerId, { limit });
      return res.json({ users, count: users.length });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to list users' });
    }
  });
}

module.exports = { registerPartnerPortalRoutes, canApplyForApi };
