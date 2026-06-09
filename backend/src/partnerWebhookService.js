const crypto = require('crypto');
const {
  getUserById,
  getPartnerWebhookConfig,
  tryClaimPartnerWebhookDelivery,
  updatePartnerWebhookDeliveryResult,
} = require('./db');

const PARTNER_WEBHOOK_EVENTS = Object.freeze(['deposit.credited', 'withdrawal.finished', 'webhook.test']);
const WEBHOOK_TIMEOUT_MS = 12_000;

function newId() {
  return crypto.randomUUID();
}

function generateWebhookSecret() {
  return `ema_whsec_${crypto.randomBytes(24).toString('base64url')}`;
}

function maskWebhookSecret(secret) {
  const s = String(secret || '');
  if (!s) return null;
  if (s.length <= 8) return '••••••••';
  return `••••••••${s.slice(-4)}`;
}

function isValidWebhookUrl(url) {
  try {
    const u = new URL(String(url).trim());
    if (u.protocol === 'https:') return true;
    if (process.env.NODE_ENV !== 'production' && u.protocol === 'http:') {
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    }
    return false;
  } catch {
    return false;
  }
}

function signWebhookBody(secret, rawBody) {
  const digest = crypto.createHmac('sha256', String(secret)).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}

function buildUserContext(user) {
  if (!user?.partner_id) return null;
  return {
    partnerId: user.partner_id,
    userId: user.id,
    externalRef: user.partner_external_ref || null,
    email: user.email,
  };
}

async function loadPartnerUserContext(userId) {
  const user = await getUserById(userId);
  return buildUserContext(user);
}

async function deliverPartnerWebhook({ partnerId, eventType, sourceId, data }) {
  const config = await getPartnerWebhookConfig(partnerId);
  if (!config?.webhook_enabled || !config.webhook_url) return { delivered: false, reason: 'disabled' };
  const events = config.webhook_events || [];
  if (eventType !== 'webhook.test' && !events.includes(eventType)) {
    return { delivered: false, reason: 'event_not_subscribed' };
  }
  if (!config.webhook_secret) return { delivered: false, reason: 'missing_secret' };

  const deliveryId = newId();
  const createdAt = new Date().toISOString();
  const payload = {
    id: deliveryId,
    type: eventType,
    createdAt,
    partnerId,
    data,
  };
  const rawBody = JSON.stringify(payload);

  const claimed = await tryClaimPartnerWebhookDelivery({
    id: deliveryId,
    partnerId,
    eventType,
    sourceId,
    payload,
  });
  if (!claimed) return { delivered: false, reason: 'duplicate' };

  const signature = signWebhookBody(config.webhook_secret, rawBody);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  let responseStatus = null;
  let responseBody = null;
  try {
    const res = await fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Ema-Partner-Webhooks/1.0',
        'X-Ema-Event': eventType,
        'X-Ema-Delivery-Id': deliveryId,
        'X-Ema-Timestamp': createdAt,
        'X-Ema-Signature': signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    responseStatus = res.status;
    responseBody = (await res.text()).slice(0, 2000);
  } catch (e) {
    responseStatus = 0;
    responseBody = String(e?.message || 'delivery_failed').slice(0, 2000);
    console.warn('[partner-webhook] delivery failed', { partnerId, eventType, sourceId, error: e?.message });
  } finally {
    clearTimeout(timer);
  }

  await updatePartnerWebhookDeliveryResult({
    id: deliveryId,
    responseStatus,
    responseBody,
    deliveredAt: new Date().toISOString(),
  });

  return {
    delivered: responseStatus >= 200 && responseStatus < 300,
    deliveryId,
    responseStatus,
  };
}

async function notifyPartnerDepositCredited({ userId, paymentRow, amount, asset }) {
  const ctx = await loadPartnerUserContext(userId);
  if (!ctx) return;
  void deliverPartnerWebhook({
    partnerId: ctx.partnerId,
    eventType: 'deposit.credited',
    sourceId: String(paymentRow?.id || ''),
    data: {
      userId: ctx.userId,
      externalRef: ctx.externalRef,
      depositId: paymentRow?.id || null,
      paymentId: paymentRow?.payment_id || null,
      orderId: paymentRow?.order_id || null,
      amount: Number(amount),
      asset: String(asset || paymentRow?.pay_currency || '').toLowerCase(),
      priceAmount: paymentRow?.price_amount != null ? Number(paymentRow.price_amount) : null,
      priceCurrency: paymentRow?.price_currency || null,
      creditedAt: new Date().toISOString(),
    },
  }).catch((e) => console.warn('[partner-webhook] deposit.credited error', e?.message));
}

async function notifyPartnerWithdrawalFinished({ userId, payoutRow }) {
  const ctx = await loadPartnerUserContext(userId);
  if (!ctx) return;
  void deliverPartnerWebhook({
    partnerId: ctx.partnerId,
    eventType: 'withdrawal.finished',
    sourceId: String(payoutRow?.id || ''),
    data: {
      userId: ctx.userId,
      externalRef: ctx.externalRef,
      withdrawalId: payoutRow?.id || null,
      payoutId: payoutRow?.payout_id || null,
      amount: payoutRow?.amount != null ? Number(payoutRow.amount) : null,
      currency: String(payoutRow?.currency || '').toLowerCase(),
      address: payoutRow?.address || null,
      status: 'finished',
      finishedAt: new Date().toISOString(),
    },
  }).catch((e) => console.warn('[partner-webhook] withdrawal.finished error', e?.message));
}

async function sendPartnerWebhookTest(partnerId) {
  return deliverPartnerWebhook({
    partnerId,
    eventType: 'webhook.test',
    sourceId: `test-${Date.now()}`,
    data: {
      message: 'Ema partner webhook test delivery',
      sentAt: new Date().toISOString(),
    },
  });
}

module.exports = {
  PARTNER_WEBHOOK_EVENTS,
  generateWebhookSecret,
  maskWebhookSecret,
  isValidWebhookUrl,
  signWebhookBody,
  deliverPartnerWebhook,
  notifyPartnerDepositCredited,
  notifyPartnerWithdrawalFinished,
  sendPartnerWebhookTest,
};
