"use client";

import { useState } from "react";

function hmacSha256(secret: string, body: string) {
  return window.crypto.subtle
    .importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))
    .then((buf) => {
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `sha256=${hex}`;
    });
}

const samples = {
  "deposit.credited": {
    event: "deposit.credited",
    partnerId: "partner-uuid",
    userId: "user-uuid",
    depositId: "dep-uuid",
    amountUsd: 100,
    currency: "usdttrc20",
    creditedAt: new Date().toISOString(),
  },
  "withdrawal.finished": {
    event: "withdrawal.finished",
    partnerId: "partner-uuid",
    userId: "user-uuid",
    withdrawalId: "wd-uuid",
    amountUsd: 50,
    status: "finished",
    finishedAt: new Date().toISOString(),
  },
};

export function WebhookPlayground() {
  const [event, setEvent] = useState<keyof typeof samples>("deposit.credited");
  const [secret, setSecret] = useState("whsec_demo_secret");
  const [payload, setPayload] = useState(JSON.stringify(samples["deposit.credited"], null, 2));
  const [signature, setSignature] = useState("");
  const [verifyResult, setVerifyResult] = useState("");

  async function generateSig() {
    const sig = await hmacSha256(secret, payload);
    setSignature(sig);
  }

  async function verify() {
    const expected = await hmacSha256(secret, payload);
    setVerifyResult(expected === signature ? "✓ Signature valid" : "✗ Signature mismatch");
  }

  function loadSample(e: keyof typeof samples) {
    setEvent(e);
    setPayload(JSON.stringify(samples[e], null, 2));
    setSignature("");
    setVerifyResult("");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(samples) as (keyof typeof samples)[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => loadSample(e)}
              className={`rounded-full border px-4 py-2 text-xs ${event === e ? "border-foreground bg-foreground text-background" : "border-card-border"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="font-medium">Webhook secret</span>
          <input
            className="mt-1 w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 font-mono text-sm"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Payload (raw JSON)</span>
          <textarea
            rows={12}
            className="mt-1 w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 font-mono text-xs"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void generateSig()}
          className="rounded-full border border-foreground bg-foreground px-5 py-2.5 text-sm font-semibold text-background"
        >
          Generate X-Ema-Signature
        </button>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-card-border p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Header</p>
          <pre className="mt-2 overflow-x-auto font-mono text-xs">X-Ema-Signature: {signature || "(generate above)"}</pre>
        </div>
        <div className="rounded-2xl border border-card-border p-5">
          <p className="text-sm font-medium">Verify</p>
          <input
            className="mt-2 w-full rounded-xl border border-card-border bg-surface px-4 py-2 font-mono text-xs"
            placeholder="Paste signature to verify"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
          <button type="button" onClick={() => void verify()} className="mt-3 text-sm underline">
            Verify HMAC
          </button>
          {verifyResult ? <p className="mt-2 text-sm">{verifyResult}</p> : null}
        </div>
        <pre className="rounded-2xl border border-card-border bg-surface/50 p-4 text-xs text-muted">{`// Node.js verification
const crypto = require('crypto');
const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');`}</pre>
      </div>
    </div>
  );
}
