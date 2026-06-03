const { getUserWithdrawalDepositStats } = require('../db');
const { computeWithdrawalTrustScore } = require('./withdrawalTrustScoreCompute');

const SCORE_CACHE_MS = 120_000;
const scoreCache = new Map();

async function getWithdrawalTrustScoreForUser(userId) {
  const key = String(userId);
  const hit = scoreCache.get(key);
  if (hit && Date.now() - hit.at < SCORE_CACHE_MS) return hit.data;

  const stats = await getUserWithdrawalDepositStats(userId);
  const data = computeWithdrawalTrustScore(stats);
  scoreCache.set(key, { at: Date.now(), data });
  return data;
}

function clearWithdrawalTrustScoreCache(userId) {
  if (userId) scoreCache.delete(String(userId));
  else scoreCache.clear();
}

async function userDropsBlockedByWithdrawalLevel(userId) {
  const trust = await getWithdrawalTrustScoreForUser(userId);
  return Boolean(trust?.dropsBlocked);
}

module.exports = {
  computeWithdrawalTrustScore,
  getWithdrawalTrustScoreForUser,
  clearWithdrawalTrustScoreCache,
  userDropsBlockedByWithdrawalLevel,
};
