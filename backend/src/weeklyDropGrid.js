const DROPS_PER_DAY = 4;
const WORK_DAYS = 5;
const WEEKLY_DROP_COUNT = DROPS_PER_DAY * WORK_DAYS;
const DAY_HOURS_UTC = [8, 11, 14, 17];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function ymdToUtcMs(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function isWeeklyDropPlan(dropCount) {
  return Number(dropCount) === WEEKLY_DROP_COUNT;
}

function weeklyDropDueTimes(weekStartYmd, nowMs = Date.now()) {
  const weekStart = ymdToUtcMs(weekStartYmd);
  const raw = [];
  for (let day = 0; day < WORK_DAYS; day += 1) {
    for (let slot = 0; slot < DROPS_PER_DAY; slot += 1) {
      raw.push(weekStart + day * 86400000 + DAY_HOURS_UTC[slot] * 3600000);
    }
  }

  let cursor = nowMs + 15 * 60000;
  return raw.map((t) => {
    if (t >= nowMs) return t;
    const bumped = cursor;
    cursor += 20 * 60000;
    return bumped;
  });
}

function weeklySlotLabel(slotIndex) {
  const day = Math.floor(slotIndex / DROPS_PER_DAY);
  const slot = slotIndex % DROPS_PER_DAY;
  const dayName = DAY_NAMES[day] || `Day ${day + 1}`;
  const hour = DAY_HOURS_UTC[slot];
  return `${dayName} drop ${slot + 1} (${String(hour).padStart(2, '0')}:00 UTC)`;
}

function weeklyIntervalHours(slotIndex, weekStartYmd, nowMs = Date.now()) {
  const times = weeklyDropDueTimes(weekStartYmd, nowMs);
  if (slotIndex >= times.length - 1) return 24;
  const hours = (times[slotIndex + 1] - times[slotIndex]) / 3600000;
  return Math.max(1, Math.round(hours * 10) / 10);
}

module.exports = {
  DROPS_PER_DAY,
  WORK_DAYS,
  WEEKLY_DROP_COUNT,
  DAY_HOURS_UTC,
  DAY_NAMES,
  isWeeklyDropPlan,
  weeklyDropDueTimes,
  weeklySlotLabel,
  weeklyIntervalHours,
  ymdToUtcMs,
};
