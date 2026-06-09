const { downloadKycImage } = require('./partnerKycStorage');

function kycModel() {
  return process.env.AI_KYC_MODEL || process.env.AI_MODEL || 'deepseek-chat';
}

function approveThreshold() {
  const n = Number(process.env.AI_KYC_AUTO_APPROVE_THRESHOLD || 0.85);
  return Number.isFinite(n) ? n : 0.85;
}

function bufferToDataUrl(buffer, mime = 'image/jpeg') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function callKycVision({ images, prompt }) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

  const content = [{ type: 'text', text: prompt }];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: bufferToDataUrl(img.buffer, img.mime) },
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: kycModel(),
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('[kyc-ai]', data?.error?.message || res.statusText);
    return null;
  }
  const text = data.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function reviewPartnerKyc({ account, kyc }) {
  const frontBuf = kyc.front_storage_path ? await downloadKycImage(kyc.front_storage_path) : null;
  if (!frontBuf) {
    return { verdict: 'manual_review', confidence: 0, reasons: ['Missing front image'] };
  }
  const images = [{ buffer: frontBuf, mime: 'image/jpeg' }];
  if (kyc.document_type === 'permit_id' && kyc.back_storage_path) {
    const backBuf = await downloadKycImage(kyc.back_storage_path);
    if (backBuf) images.push({ buffer: backBuf, mime: 'image/jpeg' });
  }

  const prompt = `You are a KYC document reviewer for a fintech partner portal.
Applicant name: ${account.full_name || 'unknown'}
Applicant email: ${account.email}
Declared residence country: ${kyc.residence_country || 'unknown'}
Residence scope: ${kyc.residence_scope || 'unknown'}
Document type selected: ${kyc.document_type}
Country of residency on account: ${account.country_of_residency || 'unknown'}

Analyze the ID document image(s). Check:
1. Document appears authentic and readable (not obviously fake or blank)
2. Document type matches selection (permit_id needs two sides if provided; passport one side)
3. Name on document plausibly matches applicant name
4. Country on document plausibly matches declared residence

Respond ONLY with JSON:
{
  "verdict": "approve" | "reject" | "manual_review",
  "confidence": 0.0 to 1.0,
  "reasons": ["string", ...]
}`;

  const parsed = await callKycVision({ images, prompt });
  if (!parsed || typeof parsed !== 'object') {
    return { verdict: 'manual_review', confidence: 0, reasons: ['AI review unavailable'] };
  }

  let verdict = String(parsed.verdict || 'manual_review').toLowerCase();
  if (!['approve', 'reject', 'manual_review'].includes(verdict)) verdict = 'manual_review';
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [];

  if (verdict === 'approve' && confidence < approveThreshold()) {
    verdict = 'manual_review';
    reasons.push(`Confidence ${confidence} below threshold ${approveThreshold()}`);
  }

  return { verdict, confidence, reasons };
}

module.exports = { reviewPartnerKyc };
