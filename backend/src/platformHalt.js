/**
 * Global halt for airfarming drops and VIP accruals / new VIP capital.
 * Set FORCE_* to false (or env AIRFARMING_PAUSED / VIP_PAUSED to "0") to resume.
 */
function envPaused(name, forceDefault) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true;
  return Boolean(forceDefault);
}

/** Hard stop requested 2026-10-17. Flip to false to resume after DB restore. */
const FORCE_PAUSE_AIRFARMING = true;
const FORCE_PAUSE_VIP = true;

const AIRFARMING_PAUSED = envPaused('AIRFARMING_PAUSED', FORCE_PAUSE_AIRFARMING);
const VIP_PAUSED = envPaused('VIP_PAUSED', FORCE_PAUSE_VIP);

const AIRFARMING_PAUSE_MESSAGE =
  'Airfarming drops are temporarily paused. Existing balances are unchanged.';
const VIP_PAUSE_MESSAGE =
  'VIP Farmers accruals and new investments are temporarily paused. Existing balances are unchanged.';

function assertAirfarmingActive() {
  if (!AIRFARMING_PAUSED) return;
  const err = new Error(AIRFARMING_PAUSE_MESSAGE);
  err.statusCode = 503;
  throw err;
}

function assertVipActive() {
  if (!VIP_PAUSED) return;
  const err = new Error(VIP_PAUSE_MESSAGE);
  err.statusCode = 503;
  throw err;
}

module.exports = {
  AIRFARMING_PAUSED,
  VIP_PAUSED,
  AIRFARMING_PAUSE_MESSAGE,
  VIP_PAUSE_MESSAGE,
  assertAirfarmingActive,
  assertVipActive,
};
