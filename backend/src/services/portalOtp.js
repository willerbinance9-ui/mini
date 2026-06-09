const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendSms } = require('./twilioSms');

function normalizePhoneDigits(phone, phoneCountry) {
  let d = String(phone || '').replace(/\D/g, '');
  const country = String(phoneCountry || '').toUpperCase();
  if (!d) return null;
  if (d.startsWith('0') && country) {
    const dial = DIAL_CODES[country];
    if (dial) d = dial + d.replace(/^0+/, '');
  }
  if (d.length < 8) return null;
  return d;
}

const DIAL_CODES = {
  US: '1',
  CA: '1',
  GB: '44',
  UG: '256',
  RW: '250',
  KE: '254',
  NG: '234',
  ZA: '27',
  IN: '91',
  AE: '971',
  DE: '49',
  FR: '33',
};

function maskPhone(digits) {
  const d = String(digits || '');
  if (d.length < 4) return '****';
  return `***${d.slice(-4)}`;
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

async function hashOtpCode(code) {
  return bcrypt.hash(String(code), 10);
}

async function verifyOtpCode(code, hash) {
  return bcrypt.compare(String(code), hash);
}

async function sendLoginOtp(phoneDigits) {
  const code = generateOtpCode();
  const body = `Your Aare verification code is ${code}. It expires in 10 minutes.`;
  const result = await sendSms(phoneDigits, body);
  if (result.skipped) {
    const err = new Error('SMS is not configured. Set TWILIO_* env vars and TWILIO_SMS_ENABLED=1.');
    err.statusCode = 503;
    throw err;
  }
  const codeHash = await hashOtpCode(code);
  return { codeHash, maskedPhone: maskPhone(phoneDigits) };
}

module.exports = {
  normalizePhoneDigits,
  maskPhone,
  sendLoginOtp,
  verifyOtpCode,
  DIAL_CODES,
};
