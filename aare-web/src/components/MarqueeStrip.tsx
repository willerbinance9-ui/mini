"use client";

const items = [
  "Live Trading",
  "Airfarming",
  "Ghost Account",
  "5% Commission",
  "Partner API",
  "AarePaymentApi",
  "Webhooks",
  "Compliance KYC",
  "Wallet",
  "VIP Farmers",
];

export function MarqueeStrip() {
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-card-border py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
      <div className="flex w-max animate-marquee gap-10">
        {doubled.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-10 whitespace-nowrap text-sm font-medium tracking-wide text-muted"
          >
            <span className="text-foreground/40">—</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
