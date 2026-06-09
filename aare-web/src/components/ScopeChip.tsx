export function ScopeChip({ scope }: { scope: string }) {
  return (
    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">
      {scope}
    </span>
  );
}
