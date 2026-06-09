"use client";

export function AmbientBackground({ variant = "hero" }: { variant?: "hero" | "subtle" }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className={`ambient-grid absolute inset-0 ${variant === "hero" ? "opacity-50" : "opacity-25"}`} />
    </div>
  );
}
