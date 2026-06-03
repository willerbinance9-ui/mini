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
  const transferSendCount30d = Number(stats.transferSendCount30d) || 0;
  const transferSendCountLifetime = Number(stats.transferSendCountLifetime) || 0;
  const transferSendCount7d = Number(stats.transferSendCount7d) || 0;
  const transferSendAmount90d = Number(stats.transferSendAmount90d) || 0;
  const transferSendAmount7d = Number(stats.transferSendAmount7d) || 0;
  const transferReceiveAmount90d = Number(stats.transferReceiveAmount90d) || 0;

  const outboundCount7d = withdrawCount7d + transferSendCount7d;
  const outboundCount30d = withdrawCount30d + transferSendCount30d;
  const outboundCountLifetime = withdrawCountLifetime + transferSendCountLifetime;
  const outboundAmount7d = withdrawAmount7d + transferSendAmount7d;
  const outboundAmount90d = withdrawAmount90d + transferSendAmount90d;
  const inflowAmount90d = depositAmount90d + transferReceiveAmount90d;

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

  if (outboundCountLifetime === 0 && illegal === 0) {
    return finalizeScore(100, factors, stats);
  }

  if (outboundCount30d === 0 && illegal === 0) {
    score = Math.max(score, 92);
    factors.push({
      key: 'no_recent_outflows',
      label: 'No withdrawals or transfers out in the last 30 days',
      impact: 0,
      note: 'positive',
    });
  }

  const depositBase = Math.max(inflowAmount90d, 100);
  const ratio = outboundAmount90d / depositBase;
  if (ratio > 0.15) {
    const penalty = Math.min(35, Math.round((ratio - 0.15) * 75));
    score -= penalty;
    factors.push({
      key: 'outflow_ratio',
      label: 'Withdrawals & transfers out vs deposits & transfers in (90 days)',
      impact: -penalty,
      ratio: Math.round(ratio * 100) / 100,
    });
  }

  if (outboundCount7d >= 5) {
    score -= 25;
    factors.push({
      key: 'outflow_frequency_7d',
      label: 'Very frequent withdrawals or transfers (7 days)',
      impact: -25,
      count: outboundCount7d,
    });
  } else if (outboundCount7d >= 3) {
    score -= 15;
    factors.push({
      key: 'outflow_frequency_7d',
      label: 'Frequent withdrawals or transfers (7 days)',
      impact: -15,
      count: outboundCount7d,
    });
  } else if (outboundCount7d >= 1) {
    score -= 5;
    factors.push({
      key: 'outflow_frequency_7d',
      label: 'Recent withdrawals or transfers (7 days)',
      impact: -5,
      count: outboundCount7d,
    });
  }

  if (outboundAmount7d >= 500) {
    const penalty = Math.min(20, Math.floor(outboundAmount7d / 500) * 4);
    score -= penalty;
    factors.push({
      key: 'outflow_amount_7d',
      label: 'High withdrawal & transfer amount (7 days)',
      impact: -penalty,
      amountUsd: Math.round(outboundAmount7d),
    });
  }

  if (outboundAmount90d >= 2000 && ratio > 0.5) {
    const penalty = Math.min(15, Math.floor(outboundAmount90d / 2000) * 3);
    score -= penalty;
    factors.push({
      key: 'heavy_outflow',
      label: 'Large total withdrawals & transfers (90 days)',
      impact: -penalty,
      amountUsd: Math.round(outboundAmount90d),
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
      transferSendCount7d: stats.transferSendCount7d || 0,
      transferSendCount30d: stats.transferSendCount30d || 0,
      transferSendCountLifetime: stats.transferSendCountLifetime || 0,
      transferSendAmount7d: Math.round(stats.transferSendAmount7d || 0),
      transferSendAmount90d: Math.round(stats.transferSendAmount90d || 0),
      transferReceiveAmount90d: Math.round(stats.transferReceiveAmount90d || 0),
      outboundCount7d: (stats.withdrawCount7d || 0) + (stats.transferSendCount7d || 0),
      outboundCount30d: (stats.withdrawCount30d || 0) + (stats.transferSendCount30d || 0),
      outboundAmount7d: Math.round((stats.withdrawAmount7d || 0) + (stats.transferSendAmount7d || 0)),
      illegalCount90d: stats.illegalCount90d,
    },
    affectsDrops: true,
    message: dropsBlocked
      ? 'Your account is in the red withdrawal level. Airfarming drops are paused until you withdraw and transfer out less often and help keep capital in the platform.'
      : 'Your withdrawal level runs from green (rare withdrawals & transfers) to red (frequent outflows). Heavy withdrawals and peer transfers lower drop payouts; red level stops new drops.',
  };
}

module.exports = {
  computeWithdrawalTrustScore,
  scoreToLevelColor,
  RED_DROP_BLOCK_SCORE,
  BAND_LABELS,
};
