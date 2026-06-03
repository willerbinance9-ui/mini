const {
  getUserById,
  findOtherUsersWithWhitelistedAddress,
  banUserAccount,
  updateAirfarmingUserDropPause,
} = require('./db');

function normalizeWalletAddress(address) {
  return String(address || '').trim().toLowerCase();
}

async function banUserForDuplicateWallet(userId, { linkedUserId, address, currency }) {
  const linked = linkedUserId ? await getUserById(linkedUserId) : null;
  const reason =
    'Banned: withdrawal wallet already used on another account' +
    (linked?.email ? ` (${linked.email})` : '') +
    (address ? ` · ${address.slice(0, 10)}…` : '');

  await banUserAccount(userId, {
    reason,
    linkedUserId: linkedUserId || null,
    address: address || null,
  });

  await updateAirfarmingUserDropPause(userId, {
    dropsPaused: true,
    note: 'Auto-paused: duplicate wallet ban',
  }).catch(() => {});

  return {
    banned: true,
    userId,
    linkedUserId,
    linkedEmail: linked?.email || null,
    address,
    currency,
    reason,
  };
}

/**
 * If address is already whitelisted on another account, ban the current (new) user.
 */
async function enforceWalletUniquenessOnAdd(userId, currency, address) {
  const others = await findOtherUsersWithWhitelistedAddress(userId, currency, address);
  if (!others.length) return { ok: true, banned: false };

  const oldest = [...others].sort(
    (a, b) => new Date(a.userCreatedAt || a.walletCreatedAt).getTime() - new Date(b.userCreatedAt || b.walletCreatedAt).getTime()
  )[0];

  const result = await banUserForDuplicateWallet(userId, {
    linkedUserId: oldest.user_id,
    address,
    currency,
  });
  return { ok: false, banned: true, ...result };
}

module.exports = {
  normalizeWalletAddress,
  banUserForDuplicateWallet,
  enforceWalletUniquenessOnAdd,
};
