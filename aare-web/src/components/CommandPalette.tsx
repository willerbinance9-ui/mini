"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { allDocLinks } from "@/lib/navigation";
import { endpoints } from "@/lib/endpoints";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onCustom() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("aare-open-search", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aare-open-search", onCustom);
    };
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      return [
        ...allDocLinks.map((l) => ({ type: "doc" as const, title: l.title, href: l.href })),
        ...endpoints.slice(0, 8).map((e) => ({
          type: "endpoint" as const,
          title: `${e.method} ${e.path}`,
          href: `/docs/api-reference#${e.id}`,
        })),
      ];
    }
    const docs = allDocLinks
      .filter((l) => l.title.toLowerCase().includes(term))
      .map((l) => ({ type: "doc" as const, title: l.title, href: l.href }));
    const eps = endpoints
      .filter(
        (e) =>
          e.path.toLowerCase().includes(term) ||
          e.summary.toLowerCase().includes(term) ||
          e.method.toLowerCase().includes(term)
      )
      .map((e) => ({
        type: "endpoint" as const,
        title: `${e.method} ${e.path}`,
        href: `/docs/api-reference#${e.id}`,
      }));
    return [...docs, ...eps].slice(0, 12);
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-card-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search docs and endpoints…"
          className="w-full border-b border-card-border bg-transparent px-4 py-3 text-foreground outline-none placeholder:text-muted"
        />
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.map((r) => (
            <li key={r.href + r.title}>
              <Link
                href={r.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface"
              >
                <span>{r.title}</span>
                <span className="text-xs text-muted">{r.type}</span>
              </Link>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted">No results</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
