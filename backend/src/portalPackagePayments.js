// One-time API package purchases via NOWPayments.
// A package is activated when payment finishes and can never be changed afterwards.

const crypto = require('crypto');
const np = require('./services/nowpaymentsClient');
const {
  getPortalAccountById,
  updatePortalAccount,
  getPartnerApplicationById,
  getPartnerApplicationByEmail,
  createPortalPackagePayment,
  getPortalPackagePaymentById,
  getLatestPortalPackagePayment,
  updatePortalPackagePayment,
  isMissingTableError,
} = require('./db');
const { portalAuthMiddleware } = require('./middleware/portalAuth');

const SCHEMA_MSG =
  'Package payments schema missing. Run backend/sql/migrations/20260630_portal_package_payments.sql in Supabase.';

const PACKAGE_PRICES_USD = {
  airfarming_only: 300,
  airfarming_vip: 500,
  full: 700,
};

const FINISHED_STATUSES = new Set(['finished', 'confirmed']);
const FAILED_STATUSES = new Set(['failed', 'expired', 'refunded']);

const APP_PREFERENCES = new Set(['use_ours', 'own_build_for_me', 'own_independent_dev']);

function appBaseUrl() {
  return (process.env.APP_BASE_URL || '').replace(/\/+$/, '');
}

function portalBaseUrl() {
  return (process.env.PORTAL_BASE_URL || 'https://aare.cc').replace(/\/+$/, '');
}

function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObjectKeys(obj[key]);
      return acc;
    }, {});
}

function verifyIpnSignature(req) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return true;
  const sig = req.headers['x-nowpayments-sig'];
  if (!sig || !req.rawBody) return false;
  let body;
  try {
    body = JSON.parse(req.rawBody.toString('utf8'));
  } catch {
    return false;
  }
  const sorted = JSON.stringify(sortObjectKeys(body));
  const expected = crypto.createHmac('sha512', secret).update(sorted).digest('hex');
  try {
    const a = Buffer.from(String(sig).toLowerCase(), 'hex');
    const b = Buffer.from(expected.toLowerCase(), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return String(sig).toLowerCase() === expected.toLowerCase();
  }
}

function toPaymentPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    package: row.package,
    appPreference: row.app_preference || null,
    amountUsd: Number(row.amount_usd),
    status: row.payment_status,
    invoiceUrl: row.invoice_url || null,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

/** Activates the purchased package on the account (idempotent). */
async function activatePackage(paymentRow) {
  const account = await getPortalAccountById(paymentRow.portal_account_id);
  if (!account) return;
  if (account.api_package) return; // already locked — never overwrite
  await updatePortalAccount(account.id, {
    api_package: paymentRow.package,
    api_package_selected_at: new Date().toISOString(),
  });
}

async function applyPaymentStatus(row, status, rawIpn) {
  const st = String(status || '').toLowerCase();
  const patch = { payment_status: st };
  if (rawIpn !== undefined) patch.raw_last_ipn = rawIpn;
  if (FINISHED_STATUSES.has(st) && !row.paid_at) patch.paid_at = new Date().toISOString();
  const updated = await updatePortalPackagePayment(row.id, patch);
  if (FINISHED_STATUSES.has(st)) await activatePackage(updated);
  return updated;
}

/** Pulls latest status from NOWPayments when IPN was missed (e.g. user returns to dashboard). */
async function syncFromProvider(row) {
  if (!np.configured() || !row?.payment_id) return row;
  if (FINISHED_STATUSES.has(row.payment_status) || FAILED_STATUSES.has(row.payment_status)) return row;
  try {
    const remote = await np.getPayment(row.payment_id);
    const status = remote.payment_status || remote.status;
    if (status && status !== row.payment_status) {
      return applyPaymentStatus(row, status, remote);
    }
  } catch (e) {
    console.warn('[package-payments] getPayment failed', row.payment_id, e.message);
  }
  return row;
}

// Registered in server.js BEFORE the global JSON parser so req.rawBody is available.
async function handlePackagePaymentWebhook(req, res) {
  try {
    if (!verifyIpnSignature(req)) {
      console.warn('[package-payments] IPN rejected: invalid signature');
      return res.status(401).json({ message: 'Invalid IPN signature' });
    }
    const body = req.body || {};
    const orderId = String(body.order_id || '');
    if (!orderId) return res.status(400).json({ message: 'Missing order_id' });

    const row = await getPortalPackagePaymentById(orderId);
    if (!row) return res.status(404).json({ message: 'Unknown order' });

    const patch = {};
    if (body.payment_id != null && !row.payment_id) patch.payment_id = String(body.payment_id);
    if (Object.keys(patch).length) await updatePortalPackagePayment(row.id, patch);

    await applyPaymentStatus({ ...row, ...patch }, body.payment_status || body.status, body);
    return res.json({ ok: true });
  } catch (e) {
    if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
    console.error('[package-payments] IPN error', e);
    return res.status(500).json({ message: 'IPN handler failed' });
  }
}

async function resolveApplication(account) {
  if (account.application_id) {
    const app = await getPartnerApplicationById(account.application_id);
    if (app) return app;
  }
  return getPartnerApplicationByEmail(account.email);
}

function registerPortalPackagePaymentRoutes(app) {
  // Start a one-time package purchase. THE CHOICE IS FINAL — no package changes after payment.
  app.post('/v1/portal/api-package/checkout', portalAuthMiddleware, async (req, res) => {
    try {
      const account = req.portalAccount;
      if (account.api_package) {
        return res.status(400).json({
          message: 'You already purchased a package. Package choices are final and cannot be changed.',
        });
      }

      const application = await resolveApplication(account);
      if (application?.status !== 'approved') {
        return res.status(403).json({ message: 'Purchase a package after your partnership application is approved.' });
      }

      const pkg = String(req.body?.package || '').trim();
      const price = PACKAGE_PRICES_USD[pkg];
      if (!price) {
        return res.status(400).json({ message: 'Invalid package. Choose airfarming_only, airfarming_vip, or full.' });
      }

      const appPreference = String(req.body?.appPreference || '').trim();
      if (!APP_PREFERENCES.has(appPreference)) {
        return res.status(400).json({
          message: 'Tell us how you will use the API: our app, an app we build for you, or your own developer.',
        });
      }

      if (!np.configured()) {
        return res.status(503).json({ message: 'Payments are not configured yet. Contact support.' });
      }

      // Reuse a still-pending invoice for the same package instead of creating duplicates.
      const latest = await getLatestPortalPackagePayment(account.id);
      if (
        latest &&
        latest.package === pkg &&
        latest.invoice_url &&
        !FINISHED_STATUSES.has(latest.payment_status) &&
        !FAILED_STATUSES.has(latest.payment_status)
      ) {
        return res.json({ payment: toPaymentPublic(latest) });
      }

      let row = await createPortalPackagePayment({
        portalAccountId: account.id,
        pkg,
        amountUsd: price,
        appPreference,
      });
      await updatePortalAccount(account.id, { app_preference: appPreference }).catch(() => {});

      const ipnUrl = appBaseUrl() ? `${appBaseUrl()}/webhooks/nowpayments/package` : undefined;
      if (!ipnUrl) {
        console.warn('[package-payments] APP_BASE_URL not set — package IPN callbacks will not be sent');
      }

      const invoice = await np.createInvoice({
        price_amount: price,
        price_currency: 'usd',
        order_id: row.id,
        order_description: `Aare API package: ${pkg} ($${price}/month)`,
        ...(ipnUrl ? { ipn_callback_url: ipnUrl } : {}),
        success_url: `${portalBaseUrl()}/dashboard/choose-package?paid=1`,
        cancel_url: `${portalBaseUrl()}/dashboard/choose-package`,
      });

      row = await updatePortalPackagePayment(row.id, {
        invoice_id: invoice.id != null ? String(invoice.id) : null,
        invoice_url: invoice.invoice_url || null,
      });

      return res.status(201).json({ payment: toPaymentPublic(row) });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to start checkout' });
    }
  });

  // Latest purchase status (syncs from NOWPayments when pending, so missed IPNs still activate).
  app.get('/v1/portal/api-package/payment', portalAuthMiddleware, async (req, res) => {
    try {
      let row = await getLatestPortalPackagePayment(req.portalAccountId);
      if (row) row = await syncFromProvider(row);
      const account = await getPortalAccountById(req.portalAccountId);
      return res.json({
        payment: toPaymentPublic(row),
        apiPackage: account?.api_package || null,
      });
    } catch (e) {
      if (isMissingTableError(e)) return res.status(503).json({ message: SCHEMA_MSG });
      return res.status(500).json({ message: e?.message || 'Failed to load payment status' });
    }
  });
}

module.exports = { registerPortalPackagePaymentRoutes, handlePackagePaymentWebhook };
