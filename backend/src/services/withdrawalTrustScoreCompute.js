const BAND_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  low: 'Low',
  poor: 'Poor',
};

/** Score below this blocks new airfarming drops (red / poor band). */
const RED_DROP_BLOCK_SCORE = 30;

function bandForScore(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= RED_DROP_BLOCK_SCORE) return 'low';
  return 'poor';
}

/** Green (100) → red (0) for admin Levels UI. */
function scoreToLevelColor(score) {
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const hue = Math.round((s / 100) * 120);
  return `hsl(${hue}, 72%, 42%)`;
}

function computeWithdrawalTrustScore(stats) {
  let score = 100;
  const factors = [];

  const illegal = Number(stats.illegalCount90d) || 0;
  const withdrawCount30d = Number(stats.withdrawCount30d) || 0;
  const withdrawCountLifetime = Number(stats.withdrawCountLifetime) || 0;
  const withdrawCount7d = Number(stats.withdrawCount7d) || 0;
  const withdrawAmount90d = Number(stats.withdrawAmount90d) || 0;
  const withdrawAmount7d = Number(stats.withdrawAmount7d) || 0;
  const depositAmount90d = Number(stats.depositAmount90d) || 0;

  if (illegal > 0) {
    const penalty = Math.min(50, illegal * 12);
    score -= penalty;
    factors.push({
      key: 'illegal_withdrawals',
      label: 'Rejected or failed withdrawals',
      impact: -penalty,
      count: illegal,
    });
  }

  if (withdrawCountLifetime === 0 && illegal === 0) {
    return finalizeScore(100, factors, stats);
  }

  if (withdrawCount30d === 0 && illegal === 0) {
    score = Math.max(score, 92);
    factors.push({
      key: 'no_recent_withdrawals',
      label: 'No withdrawals in the last 30 days',
      impact: 0,
      note: 'positive',
    });
  }

  const depositBase = Math.max(depositAmount90d, 100);
  const ratio = withdrawAmount90d / depositBase;
  if (ratio > 0.15) {
    const penalty = Math.min(35, Math.round((ratio - 0.15) * 75));
    score -= penalty;
    factors.push({
      key: 'withdraw_ratio',
      label: 'Withdrawal volume vs deposits (90 days)',
      impact: -penalty,
      ratio: Math.round(ratio * 100) / 100,
    });
  }

  if (withdrawCount7d >= 5) {
    score -= 25;
    factors.push({ key: 'withdraw_frequency_7d', label: 'Very frequent withdrawals (7 days)', impact: -25, count: withdrawCount7d });
  } else if (withdrawCount7d >= 3) {
    score -= 15;
    factors.push({ key: 'withdraw_frequency_7d', label: 'Frequent withdrawals (7 days)', impact: -15, count: withdrawCount7d });
  } else if (withdrawCount7d >= 1) {
    score -= 5;
    factors.push({ key: 'withdraw_frequency_7d', label: 'Recent withdrawals (7 days)', impact: -5, count: withdrawCount7d });
  }

  if (withdrawAmount7d >= 500) {
    const penalty = Math.min(20, Math.floor(withdrawAmount7d / 500) * 4);
    score -= penalty;
    factors.push({
      key: 'withdraw_amount_7d',
      label: 'High withdrawal amount (7 days)',
      impact: -penalty,
      amountUsd: Math.round(withdrawAmount7d),
    });
  }

  if (withdrawAmount90d >= 2000 && ratio > 0.5) {
    const penalty = Math.min(15, Math.floor(withdrawAmount90d / 2000) * 3);
    score -= penalty;
    factors.push({
      key: 'heavy_withdrawer',
      label: 'Large total withdrawals (90 days)',
      impact: -penalty,
      amountUsd: Math.round(withdrawAmount90d),
    });
  }

  return finalizeScore(score, factors, stats);
}

function finalizeScore(rawScore, factors, stats) {
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const band = bandForScore(score);
  const dropPotentialMultiplier = Math.round((score / 100) * 1000) / 1000;

  const levelColor = scoreToLevelColor(score);
  const dropsBlocked = score < RED_DROP_BLOCK_SCORE;

  return {
    score,
    band,
    label: BAND_LABELS[band],
    levelColor,
    dropsBlocked,
    dropPotentialMultiplier: dropsBlocked ? 0 : dropPotentialMultiplier,
    dropPotentialPercent: dropsBlocked ? 0 : score,
    factors,
    stats: {
      withdrawCount7d: stats.withdrawCount7d,
      withdrawCount30d: stats.withdrawCount30d,
      withdrawCountLifetime: stats.withdrawCountLifetime,
      withdrawAmount7d: Math.round(stats.withdrawAmount7d || 0),
      withdrawAmount90d: Math.round(stats.withdrawAmount90d || 0),
      depositAmount90d: Math.round(stats.depositAmount90d || 0),
      illegalCount90d: stats.illegalCount90d,
    },
    affectsDrops: true,
    message: dropsBlocked
      ? 'Your account is in the red withdrawal level. Airfarming drops are paused until you withdraw less often and help keep capital in the platform.'
      : 'Your withdrawal level runs from green (rare withdrawals) to red (frequent withdrawals). Heavy withdrawals lower drop payouts; red level stops new drops.',
  };
}

module.exports = {
  computeWithdrawalTrustScore,
  scoreToLevelColor,
  RED_DROP_BLOCK_SCORE,
  BAND_LABELS,
};
