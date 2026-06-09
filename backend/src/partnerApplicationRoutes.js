const jwt = require('jsonwebtoken');
const {
  insertPartnerApplication,
  linkPortalAccountByEmail,
  getPortalAccountByEmail,
  getPortalAccountById,
  getPortalKycByAccountId,
  isMissingTableError,
} = require('./db');
const { sendEmail } = require('./services/emailNotify');
const { PORTAL_JWT_PURPOSE } = require('./middleware/portalAuth');
const { canApplyForApi } = require('./portalKycUtil');

async function assertPortalKycApproved(req, email) {
  let account = null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'ema-dev-secret');
      if (payload.type === PORTAL_JWT_PURPOSE && payload.sub) {
        account = await getPortalAccountById(payload.sub);
      }
    } catch (_) {
      /* ignore invalid token */
    }
  }
  if (!account) account = await getPortalAccountByEmail(email);
  if (!account) {
    return {
      ok: false,
      message: 'Create an Aare account and complete identity verification before applying.',
    };
  }
  const kyc = await getPortalKycByAccountId(account.id);
  if (!canApplyForApi(kyc)) {
    return {
      ok: false,
      message: 'Complete and pass identity verification (KYC) before applying for API access.',
    };
  }
  return { ok: true, account };
}

function trim(v) {
  return v != null ? String(v).trim() : '';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validateApplication(body) {
  const errors = [];
  const fullName = trim(body.fullName ?? body.full_name);
  const email = trim(body.email).toLowerCase();
  const country = trim(body.country);
  const phone = trim(body.phone);
  const occupation = trim(body.occupation ?? body.work);
  const incomePerYear = num(body.incomePerYear ?? body.income_per_year);
  const intendedInvestment = num(body.intendedInvestment ?? body.intended_investment);
  const withdrawFrequency = trim(body.withdrawFrequency ?? body.withdraw_frequency).toLowerCase();
  const withdrawAmount = num(body.withdrawAmount ?? body.withdraw_amount);
  const investedBefore = Boolean(body.investedBefore ?? body.invested_before);
  const paymentPreference = trim(body.paymentPreference ?? body.payment_preference).toLowerCase();
  const hasApiKnowledge = Boolean(body.hasApiKnowledge ?? body.has_api_knowledge);
  const apiPlan = trim(body.apiPlan ?? body.api_plan).toLowerCase() || null;
  const termsAccepted = Boolean(body.termsAccepted ?? body.terms_accepted);

  if (!fullName) errors.push('fullName is required');
  if (!email || !email.includes('@')) errors.push('Valid email is required');
  if (!country) errors.push('country is required');
  if (!phone) errors.push('phone is required');
  if (!occupation) errors.push('occupation is required');
  if (incomePerYear == null || incomePerYear < 0) errors.push('incomePerYear is required');
  if (intendedInvestment == null || intendedInvestment <= 0) errors.push('intendedInvestment must be greater than 0');
  if (!['week', 'month', 'trimester'].includes(withdrawFrequency)) {
    errors.push('withdrawFrequency must be week, month, or trimester');
  }
  if (!['fiat', 'crypto'].includes(paymentPreference)) {
    errors.push('paymentPreference must be fiat or crypto');
  }
  if (!termsAccepted) errors.push('You must accept the terms');

  let bankDetails = null;
  let cryptoAddress = null;
  let cryptoNetwork = null;

  if (paymentPreference === 'fiat') {
    bankDetails = {
      bankName: trim(body.bankName ?? body.bank_details?.bankName),
      accountHolder: trim(body.accountHolder ?? body.bank_details?.accountHolder),
      accountNumber: trim(body.accountNumber ?? body.bank_details?.accountNumber),
      routingOrSwift: trim(body.routingOrSwift ?? body.bank_details?.routingOrSwift) || null,
      bankCountry: trim(body.bankCountry ?? body.bank_details?.bankCountry) || country,
    };
    if (!bankDetails.bankName) errors.push('bankName is required for fiat');
    if (!bankDetails.accountHolder) errors.push('accountHolder is required for fiat');
    if (!bankDetails.accountNumber) errors.push('accountNumber is required for fiat');
  } else {
    cryptoAddress = trim(body.cryptoAddress ?? body.crypto_address);
    cryptoNetwork = trim(body.cryptoNetwork ?? body.crypto_network) || 'usdttrc20';
    if (!cryptoAddress) errors.push('cryptoAddress is required for crypto');
  }

  if (!hasApiKnowledge && !['hire', 'self'].includes(apiPlan || '')) {
    errors.push('apiPlan must be hire or self when you do not have API knowledge');
  }

  const previousInvestmentAmount = num(body.previousInvestmentAmount ?? body.previous_investment_amount);
  const previousReturnAmount = num(body.previousReturnAmount ?? body.previous_return_amount);
  const previousDuration = trim(body.previousDuration ?? body.previous_duration) || null;
  const investmentHistoryNotes = trim(body.investmentHistoryNotes ?? body.investment_history_notes) || null;

  if (investedBefore) {
    if (previousInvestmentAmount == null && !investmentHistoryNotes) {
      errors.push('Provide previous investment details or notes when investedBefore is true');
    }
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    normalized: {
      full_name: fullName,
      email,
      country,
      phone,
      occupation,
      income_per_year: incomePerYear,
      intended_investment: intendedInvestment,
      withdraw_frequency: withdrawFrequency,
      withdraw_amount: withdrawAmount,
      invested_before: investedBefore,
      previous_investment_amount: investedBefore ? previousInvestmentAmount : null,
      previous_return_amount: investedBefore ? previousReturnAmount : null,
      previous_duration: investedBefore ? previousDuration : null,
      investment_history_notes: investedBefore ? investmentHistoryNotes : null,
      payment_preference: paymentPreference,
      bank_details: bankDetails,
      crypto_address: cryptoAddress,
      crypto_network: cryptoNetwork,
      has_api_knowledge: hasApiKnowledge,
      api_plan: hasApiKnowledge ? null : apiPlan,
      terms_accepted_at: new Date().toISOString(),
      payload: {
        ...(body && typeof body === 'object' ? body : {}),
        source: 'aare',
        submittedFrom: 'aare.cc',
      },
    },
  };
}

function registerPartnerApplicationRoutes(app) {
  const schemaMsg =
    'Partner applications schema missing. Run backend/sql/migrations/20260622_partner_applications.sql in Supabase.';

  app.post('/v1/public/partner-applications', async (req, res) => {
    try {
      const validation = validateApplication(req.body || {});
      if (!validation.ok) {
        return res.status(400).json({ message: 'Validation failed', errors: validation.errors });
      }

      const kycCheck = await assertPortalKycApproved(req, validation.normalized.email);
      if (!kycCheck.ok) {
        return res.status(403).json({ message: kycCheck.message, code: 'KYC_REQUIRED' });
      }

      const row = await insertPartnerApplication(validation.normalized);
      await linkPortalAccountByEmail(row.email, { applicationId: row.id }).catch(() => {});

      void sendEmail({
        to: row.email,
        subject: 'Aare — partnership application received',
        text: [
          `Hi ${row.full_name},`,
          '',
          'We received your Min Partner API application.',
          'Our team will review your answers to shape a personalized API proposal.',
          'Approval is not guaranteed — access is reserved for investment-oriented partners.',
          '',
          `Reference: ${row.id}`,
          `Status: ${row.status}`,
        ].join('\n'),
      });

      const notifyTo = process.env.PARTNER_APPLICATION_NOTIFY_EMAIL;
      if (notifyTo) {
        void sendEmail({
          to: notifyTo,
          subject: `New Aare partnership application: ${row.full_name}`,
          text: [
            `Name: ${row.full_name}`,
            `Email: ${row.email}`,
            `Country: ${row.country}`,
            `Intended investment: ${row.intended_investment}`,
            `Payment: ${row.payment_preference}`,
            `ID: ${row.id}`,
          ].join('\n'),
        });
      }

      return res.status(201).json({
        id: row.id,
        message:
          'Application received. Our team will review your answers to shape a personalized API proposal. Approval is not guaranteed — access is reserved for investment-oriented partners.',
        status: row.status,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: schemaMsg });
      return res.status(500).json({ message: e?.message || 'Failed to submit application' });
    }
  });
}

module.exports = { registerPartnerApplicationRoutes, validateApplication };
