const { normalizeMt5Position } = require('./mt5Client');

function normalizeEaPositionsFromPayload(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((p) => {
      const ticket = p?.ticket ?? p?.id ?? p?.positionId;
      return normalizeMt5Position({
        id: String(ticket ?? ''),
        symbol: p?.symbol,
        type: p?.type,
        volume: p?.volume,
        openPrice: p?.openPrice ?? p?.open_price,
        currentPrice: p?.currentPrice ?? p?.current_price ?? p?.price,
        profit: p?.profit,
        swap: p?.swap,
        time: p?.time,
      });
    })
    .filter((p) => p.id);
}

function positionsFromAccountRow(account) {
  const raw = account?.ea_positions_snapshot;
  return normalizeEaPositionsFromPayload(raw);
}

function bridgeSnapshotFresh(account, maxAgeMs = 120000) {
  const at = account?.ea_snapshot_at;
  if (!at) return false;
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= maxAgeMs;
}

function useMt5Bridge(account) {
  return Boolean(account?.is_platform_provisioned) || bridgeSnapshotFresh(account);
}

async function enqueueClosePositionCommand(insertMt5EaCommand, accountId, positionTicket) {
  const ticket = Number(positionTicket);
  if (!Number.isFinite(ticket) || ticket <= 0) {
    throw new Error('Invalid position ticket');
  }
  const crypto = require('crypto');
  return insertMt5EaCommand({
    id: crypto.randomUUID(),
    mt5_account_id: accountId,
    client_id: `close-${ticket}-${Date.now()}`,
    command_type: 'close_position',
    side: 'close',
    symbol: 'CLOSE',
    volume: 0,
    position_ticket: Math.trunc(ticket),
    magic: 0,
    status: 'pending',
  });
}

module.exports = {
  normalizeEaPositionsFromPayload,
  positionsFromAccountRow,
  bridgeSnapshotFresh,
  useMt5Bridge,
  enqueueClosePositionCommand,
};
