// URL shown in docs / curl examples (custom domain when DNS is ready).
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "https://mini-rdjs.onrender.com"
).replace(/\/$/, "");

// Server-side upstream for rewrites and route handlers.
export const BACKEND_ORIGIN = (
  process.env.BACKEND_API_URL || "https://mini-rdjs.onrender.com"
).replace(/\/$/, "");

/** Browser calls same-origin proxy; server calls Render directly. */
export function getFetchApiBase(): string {
  if (typeof window !== "undefined") return "/api/backend";
  return BACKEND_ORIGIN;
}

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://aare.cc";

export const APP_NAME = "Aare";
export const TAGLINE = "Build on Min. Ship your own app.";
