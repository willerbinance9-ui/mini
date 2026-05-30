const {
  insertCryptoLedgerEntry,
  getCryptoLedgerEntryBySource,
  getCryptoBalancesByUserId,
} = require('./db');
const { debitUsdtFamily, canonicalUsdtAsset } = require('./usdtBalances');

async function lockP2pEscrow({ userId, amount, tradeId, newId }) {
  const existing = await getCryptoLedgerEntryBySource('p2p_escrow_lock', tradeId, 'out');
  if (existing) return;
  await debitUsdtFamily({
    userId,
    amount,
    source: 'p2p_escrow_lock',
    sourceId: tradeId,
    insertCryptoLedgerEntry,
    getCryptoBalancesByUserId,
    newId,
  });
}

async function releaseP2pEscrow({ receiverId, amount, tradeId, newId }) {
  const existing = await getCryptoLedgerEntryBySource('p2p_escrow_release', tradeId, 'in');
  if (existing) return;
  await insertCryptoLedgerEntry({
    id: newId(),
    user_id: receiverId,
    asset: canonicalUsdtAsset(),
    direction: 'in',
    amount: Number(amount),
    source: 'p2p_escrow_release',
    source_id: tradeId,
  });
}

async function refundP2pEscrow({ senderId, amount, tradeId, newId }) {
  const existing = await getCryptoLedgerEntryBySource('p2p_escrow_refund', tradeId, 'in');
  if (existing) return;
  await insertCryptoLedgerEntry({
    id: newId(),
    user_id: senderId,
    asset: canonicalUsdtAsset(),
    direction: 'in',
    amount: Number(amount),
    source: 'p2p_escrow_refund',
    source_id: tradeId,
  });
}

module.exports = { lockP2pEscrow, releaseP2pEscrow, refundP2pEscrow };
