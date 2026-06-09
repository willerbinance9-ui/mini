const lines = [
  '$ curl https://api.aare.cc/v1/partner/users \\',
  '  -H "Authorization: Bearer ema_pk_••••"',
  "",
  "{",
  '  "user": {',
  '    "id": "8f2a…c91",',
  '    "externalRef": "usr_42",',
  '    "accountStatus": "active"',
  "  }",
  "}",
];

export function HeroCodeTerminal() {
  return (
    <div className="rounded-xl border border-card-border bg-surface/40">
      <div className="flex items-center gap-2 border-b border-card-border px-4 py-2.5">
        <span className="font-mono text-xs text-muted">example request</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-muted">
        {lines.map((line, i) => (
          <div key={i} className={line.startsWith("  ") || line === "{" || line === "}" ? "" : "text-foreground"}>
            {line || "\u00a0"}
          </div>
        ))}
      </pre>
    </div>
  );
}
