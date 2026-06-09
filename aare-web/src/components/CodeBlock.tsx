"use client";

import { useState } from "react";

export function CodeBlock({
  code,
  language = "bash",
  title,
}: {
  code: string;
  language?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-accent/20 bg-[#0a0e17]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between border-b border-card-border px-4 py-2 text-xs text-muted">
        <span>{title || language}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded px-2 py-1 hover:bg-white/5 hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}
