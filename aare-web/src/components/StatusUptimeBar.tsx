"use client";

import { useState } from "react";
import type { UptimeDay } from "@/content/status-config";

const BAR_COLORS: Record<UptimeDay["status"], string> = {
  operational: "bg-emerald-500",
  partial: "bg-amber-400",
  severe: "bg-orange-500",
  prelaunch: "bg-foreground/10",
};

export function StatusUptimeBar({ days, title, uptimeLabel }: { days: UptimeDay[]; title: string; uptimeLabel: string }) {
  const [hovered, setHovered] = useState<{ day: UptimeDay; index: number } | null>(null);

  const first = days[0];

  return (
    <div className="rounded-2xl border border-card-border bg-surface/40 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">{uptimeLabel}</span> uptime for the last 90 days
        </p>
      </div>

      <div className="relative mt-8">
        {hovered ? (
          <div
            className="pointer-events-none absolute -top-16 z-10 whitespace-nowrap rounded-lg border border-card-border bg-background px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${((hovered.index + 0.5) / days.length) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-medium text-foreground">{hovered.day.dateLabel}</p>
            <p className={hovered.day.status === "operational" ? "text-emerald-500" : "text-muted"}>
              {hovered.day.status === "prelaunch" ? "Before launch" : hovered.day.detail}
            </p>
          </div>
        ) : null}

        <div className="flex h-10 items-end gap-[2px] sm:h-12 sm:gap-[3px]">
          {days.map((day, index) => (
            <button
              key={day.date.toISOString()}
              type="button"
              className={`min-w-0 flex-1 rounded-sm transition-opacity hover:opacity-80 ${BAR_COLORS[day.status]}`}
              style={{ minHeight: day.status === "prelaunch" ? "40%" : "100%" }}
              onMouseEnter={() => setHovered({ day, index })}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered({ day, index })}
              onBlur={() => setHovered(null)}
              aria-label={`${day.dateLabel}: ${day.detail}`}
            />
          ))}
        </div>

        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{first?.dateLabel}</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

export function StatusLegend() {
  const items = [
    { color: "bg-emerald-500", label: "Operational" },
    { color: "bg-amber-400", label: "Partial degradation" },
    { color: "bg-orange-500", label: "Severe degradation" },
    { color: "bg-foreground/10", label: "Before launch" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
