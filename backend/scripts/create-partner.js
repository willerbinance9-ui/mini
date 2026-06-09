#!/usr/bin/env node
/**
 * Create a partner + API key via the internal bootstrap endpoint.
 *
 * Usage:
 *   INTERNAL_CRON_SECRET=... node backend/scripts/create-partner.js --name "Acme" --slug acme
 *
 * Or against production:
 *   API_BASE=https://mini-rdjs.onrender.com INTERNAL_CRON_SECRET=... node backend/scripts/create-partner.js ...
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const args = process.argv.slice(2);
function readFlag(flag, fallback = '') {
  const i = args.indexOf(flag);
  if (i === -1) return fallback;
  return args[i + 1] || fallback;
}

const name = readFlag('--name');
const slug = readFlag('--slug');
const keyName = readFlag('--key-name', 'default');
const base = (readFlag('--base', process.env.API_BASE || 'http://localhost:3001') || '').replace(/\/$/, '');
const secret = process.env.INTERNAL_CRON_SECRET;

if (!name || !slug) {
  console.error('Usage: node backend/scripts/create-partner.js --name "Partner Name" --slug partner-slug');
  process.exit(1);
}
if (!secret) {
  console.error('INTERNAL_CRON_SECRET is required in env');
  process.exit(1);
}

async function main() {
  const res = await fetch(`${base}/internal/partners/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-cron-secret': secret,
    },
    body: JSON.stringify({ name, slug, keyName }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Failed:', res.status, body);
    process.exit(1);
  }
  console.log(JSON.stringify(body, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
