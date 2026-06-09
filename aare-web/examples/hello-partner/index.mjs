/**
 * Minimal Min Partner API integration example.
 *
 *   API_BASE=https://api.aare.cc PARTNER_API_KEY=ema_pk_... node index.mjs
 */
const API_BASE = (process.env.API_BASE || "https://api.aare.cc").replace(/\/$/, "");
const API_KEY = process.env.PARTNER_API_KEY;

if (!API_KEY) {
  console.error("Set PARTNER_API_KEY=ema_pk_...");
  process.exit(1);
}

async function partnerFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
  return body;
}

async function main() {
  const me = await partnerFetch("/v1/partner/me");
  console.log("Partner:", me);

  const stats = await partnerFetch("/v1/partner/stats");
  console.log("Stats:", stats);

  const email = `dev+${Date.now()}@example.com`;
  const created = await partnerFetch("/v1/partner/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "secret12",
      externalRef: `usr_${Date.now()}`,
    }),
  });
  console.log("Created user:", created.user?.id, email);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
