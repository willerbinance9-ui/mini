const styles: Record<string, string> = {
  GET: "border-card-border text-foreground",
  POST: "border-foreground text-foreground",
  PUT: "border-card-border text-muted",
  DELETE: "border-card-border text-muted",
  PATCH: "border-card-border text-muted",
};

export function MethodBadge({ method }: { method: string }) {
  const m = method.toUpperCase();
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${styles[m] || styles.GET}`}
    >
      {m}
    </span>
  );
}
