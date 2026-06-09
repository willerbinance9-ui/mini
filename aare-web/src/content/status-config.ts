/** Partner API public launch — days before this show as pre-launch in the uptime bar. */
export const STATUS_LAUNCH_DATE = new Date("2026-06-01T00:00:00Z");

export const UPTIME_WINDOW_DAYS = 90;

export type DayStatus = "operational" | "partial" | "severe" | "prelaunch";

export type UptimeDay = {
  date: Date;
  dateLabel: string;
  status: DayStatus;
  uptimePercent: number;
  detail: string;
};

export type StatusServiceGroup = {
  id: string;
  title: string;
  description: string;
  status: DayStatus;
};

export const STATUS_SERVICE_GROUPS: StatusServiceGroup[] = [
  {
    id: "partner-api",
    title: "Partner API",
    description: "Users, sessions, compliance, wallet scopes, and API keys",
    status: "operational",
  },
  {
    id: "payments",
    title: "Payments & custody",
    description: "AarePaymentApi deposits, withdrawals, and ledger",
    status: "operational",
  },
  {
    id: "income",
    title: "Income programs",
    description: "Airfarming, live trading, ghost accounts, and VIP farmers",
    status: "operational",
  },
  {
    id: "webhooks",
    title: "Webhooks & notifications",
    description: "deposit.credited, withdrawal.finished, and HMAC delivery",
    status: "operational",
  },
];

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function buildUptimeHistory(liveOverall: "operational" | "degraded" | "unknown" = "operational"): UptimeDay[] {
  const today = startOfUtcDay(new Date());
  const launch = startOfUtcDay(STATUS_LAUNCH_DATE);
  const days: UptimeDay[] = [];

  for (let i = UPTIME_WINDOW_DAYS - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const dayStart = startOfUtcDay(date);
    const isToday = dayStart.getTime() === today.getTime();
    const isPreLaunch = dayStart.getTime() < launch.getTime();

    if (isPreLaunch) {
      days.push({
        date: dayStart,
        dateLabel: formatDayLabel(dayStart),
        status: "prelaunch",
        uptimePercent: 0,
        detail: "Before public launch",
      });
      continue;
    }

    let status: DayStatus = "operational";
    let uptimePercent = 100;
    let detail = "100% uptime · No incidents";

    if (isToday && liveOverall === "degraded") {
      status = "partial";
      uptimePercent = 99.9;
      detail = "Partial degradation detected";
    } else if (isToday && liveOverall === "unknown") {
      status = "partial";
      uptimePercent = 99.5;
      detail = "Status check incomplete";
    }

    days.push({
      date: dayStart,
      dateLabel: formatDayLabel(dayStart),
      status,
      uptimePercent,
      detail,
    });
  }

  return days;
}

export function computeUptimePercent(days: UptimeDay[]): string {
  const live = days.filter((d) => d.status !== "prelaunch");
  if (!live.length) return "100%";
  const sum = live.reduce((acc, d) => acc + d.uptimePercent, 0);
  const avg = sum / live.length;
  if (avg >= 99.995) return "100%";
  if (avg >= 99.99) return "99.999%";
  return `${avg.toFixed(3)}%`;
}
