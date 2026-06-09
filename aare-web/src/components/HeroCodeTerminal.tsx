"use client";

import { motion } from "framer-motion";

const lines = [
  { delay: 0.4, text: '$ curl /v1/partner/users \\', muted: true },
  { delay: 0.7, text: '  -H "Authorization: Bearer ema_pk_••••"', muted: false },
  { delay: 1.0, text: "", muted: true },
  { delay: 1.2, text: "{", muted: true },
  { delay: 1.4, text: '  "user": {', muted: true },
  { delay: 1.6, text: '    "id": "8f2a…c91",', muted: false },
  { delay: 1.8, text: '    "externalRef": "usr_42",', muted: true },
  { delay: 2.0, text: '    "accountStatus": "active"', muted: false },
  { delay: 2.2, text: "  }", muted: true },
  { delay: 2.4, text: "}", muted: true },
];

export function HeroCodeTerminal() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className="rounded-2xl border border-card-border bg-surface/50"
    >
      <div className="flex items-center gap-2 border-b border-card-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full border border-card-border bg-background" />
        <span className="h-2.5 w-2.5 rounded-full border border-card-border bg-muted/30" />
        <span className="h-2.5 w-2.5 rounded-full border border-card-border bg-foreground/20" />
        <span className="ml-2 font-mono text-xs text-muted">partner-api · live</span>
      </div>
      <div className="min-h-[260px] p-4 font-mono text-[13px] leading-relaxed">
        {lines.map((line, i) =>
          line.text ? (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: line.delay }}
              className={line.muted ? "text-muted" : "text-foreground"}
            >
              {line.text}
            </motion.div>
          ) : (
            <div key={i} className="h-4" />
          )
        )}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="inline-block h-4 w-2 bg-foreground"
        />
      </div>
    </motion.div>
  );
}
