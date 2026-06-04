const VALID_BOT_TYPES = new Set(['synthetix_ea', 'quantix_ea']);

const BOT_LABELS = {
  synthetix_ea: 'Synthetix EA',
  quantix_ea: 'Quantix EA',
};

const BOT_MAGIC = {
  synthetix_ea: 200001,
  quantix_ea: 200002,
};

const VALID_LEVERAGES = [50, 100, 200, 500, 1000, 2000];

const MIN_DEPOSIT_BY_BOT = {
  synthetix_ea: 1000,
  quantix_ea: 200,
};

function getMinDeposit(botType) {
  const b = normalizeBotType(botType);
  if (!b) return 0;
  return MIN_DEPOSIT_BY_BOT[b] || 0;
}

function minDepositMessage(botType) {
  const min = getMinDeposit(botType);
  const label = botLabel(botType) || 'this bot';
  return `Minimum deposit for ${label} is $${min.toLocaleString('en-US')}.`;
}

function validateTradingPassword(password) {
  const p = String(password || '');
  if (p.length < 8 || p.length > 15) {
    return { ok: false, message: 'Trading password must be 8–15 characters.' };
  }
  if (!/[a-z]/.test(p)) {
    return { ok: false, message: 'Trading password needs at least one lowercase letter.' };
  }
  if (!/[A-Z]/.test(p)) {
    return { ok: false, message: 'Trading password needs at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(p)) {
    return { ok: false, message: 'Trading password needs at least one number.' };
  }
  if (!/[^a-zA-Z0-9]/.test(p)) {
    return { ok: false, message: 'Trading password needs at least one special character.' };
  }
  if (/[<>"'&?^*#@]/.test(p)) {
    return { ok: false, message: 'Trading password cannot contain < > " \' & ? ^ * # @' };
  }
  return { ok: true };
}

function validateAccountName(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 32) {
    return { ok: false, message: 'Account nickname must be 2–32 characters.' };
  }
  if (/[<>"'&?^*#@]/.test(n)) {
    return { ok: false, message: 'Nickname cannot contain special characters like < > " \' & ? ^ * # @' };
  }
  return { ok: true, value: n };
}

function normalizeBotType(botType) {
  const b = String(botType || '').trim().toLowerCase();
  if (!VALID_BOT_TYPES.has(b)) return null;
  return b;
}

function botLabel(botType) {
  return BOT_LABELS[botType] || botType || '';
}

function botMagic(botType) {
  return BOT_MAGIC[botType] || 0;
}

module.exports = {
  VALID_BOT_TYPES,
  VALID_LEVERAGES,
  BOT_LABELS,
  BOT_MAGIC,
  MIN_DEPOSIT_BY_BOT,
  validateTradingPassword,
  validateAccountName,
  normalizeBotType,
  botLabel,
  botMagic,
  getMinDeposit,
  minDepositMessage,
};
