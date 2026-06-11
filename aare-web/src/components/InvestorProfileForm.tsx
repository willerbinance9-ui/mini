"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  portalGetInvestorProfile,
  portalSaveInvestorProfile,
  portalUploadProfilePhoto,
  portalFetchProfilePhotoUrl,
  type InvestorProfile,
  type WithdrawalFrequency,
  type WithdrawalMethod,
} from "@/lib/portal";
import { usePortalAuth } from "@/context/PortalAuthContext";

const FREQUENCIES: { id: WithdrawalFrequency; label: string; note: string }[] = [
  { id: "weekly", label: "Weekly", note: "Every week" },
  { id: "biweekly", label: "Biweekly", note: "Every 2 weeks" },
  { id: "monthly", label: "Monthly", note: "Once a month" },
  { id: "trimester", label: "Trimester", note: "Every 3 months" },
];

const METHODS: { id: WithdrawalMethod; label: string; note: string }[] = [
  { id: "bank", label: "Bank account", note: "Local bank transfer" },
  { id: "crypto", label: "Crypto wallet", note: "USDT / on-chain payout" },
];

const PERCENT_PRESETS = [5, 10, 25, 50, 75, 100];

const MOTIVATION_PROMPTS = [
  "Passive income alongside my job",
  "Growing savings faster than a bank",
  "Recommended by a friend or partner",
  "Diversifying my investments",
];

function freqScore(f: WithdrawalFrequency | null): number {
  if (f === "weekly") return 3;
  if (f === "biweekly") return 2;
  if (f === "monthly") return 1;
  return 0;
}

function pctScore(p: number | null): number {
  if (p == null) return 0;
  if (p >= 75) return 3;
  if (p >= 50) return 2;
  if (p >= 25) return 1;
  return 0;
}

export function dropTier(frequency: WithdrawalFrequency | null, percent: number | null) {
  const score = freqScore(frequency) + pctScore(percent);
  if (score <= 1)
    return {
      id: "priority",
      label: "Priority drop access",
      tone: "emerald",
      message:
        "Excellent. Profiles with low withdrawal pressure are first in line when the algorithm generates high-yield drops.",
    };
  if (score <= 3)
    return {
      id: "enhanced",
      label: "Enhanced drop access",
      tone: "amber",
      message:
        "Good balance. You will receive solid opportunities — withdrawing a little less often would unlock the highest-yield drops.",
    };
  return {
    id: "standard",
    label: "Standard drop access",
    tone: "muted",
    message:
      "Frequent or large withdrawals reduce the capital the algorithm can deploy for you, so drops will be more conservative. The less you withdraw, the better your opportunities.",
  };
}

function tierBadgeClass(tone: string) {
  if (tone === "emerald") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (tone === "amber") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-card-border bg-surface text-muted";
}

function fmtUsd(n: number) {
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function InvestorProfileForm() {
  const { me } = usePortalAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<InvestorProfile | null>(null);

  const [motivation, setMotivation] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<WithdrawalMethod | null>(null);
  const [percent, setPercent] = useState<number>(10);
  const [frequency, setFrequency] = useState<WithdrawalFrequency | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await portalGetInvestorProfile();
        if (cancelled) return;
        setProfile(res.profile);
        if (res.profile.motivation) setMotivation(res.profile.motivation);
        if (res.profile.investmentAmount != null) setAmount(String(res.profile.investmentAmount));
        if (res.profile.withdrawalMethod) setMethod(res.profile.withdrawalMethod);
        if (res.profile.withdrawalPercent != null) setPercent(res.profile.withdrawalPercent);
        if (res.profile.withdrawalFrequency) setFrequency(res.profile.withdrawalFrequency);
        if (res.profile.hasPhoto) {
          const url = await portalFetchProfilePhotoUrl();
          if (!cancelled && url) setPhotoPreview(url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onPickPhoto(file: File | null) {
    setPhotoFile(file);
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  const tier = dropTier(frequency, percent);
  const amountNum = Number(amount);
  const formValid =
    motivation.trim().length >= 10 &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    method !== null &&
    frequency !== null;

  async function save() {
    if (!formValid || !method || !frequency) return;
    setError("");
    setSaving(true);
    try {
      if (photoFile) {
        await portalUploadProfilePhoto(photoFile);
        setPhotoFile(null);
      }
      const res = await portalSaveInvestorProfile({
        motivation: motivation.trim(),
        investmentAmount: amountNum,
        withdrawalMethod: method,
        withdrawalPercent: percent,
        withdrawalFrequency: frequency,
      });
      setProfile(res.profile);
      setShowModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading your investor profile…</p>;
  }

  return (
    <div className="space-y-8">
      {/* Algorithm explainer */}
      <div className="glass rounded-2xl border border-card-border p-5">
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-semibold text-foreground">How this profile is used.</span> Our drop-generation
          algorithm reads these answers to send you opportunities that match your goals. Capital that stays invested
          longer can be deployed into stronger positions —{" "}
          <span className="font-semibold text-emerald-400">
            the less you withdraw, and the less often, the better the drops you receive.
          </span>
        </p>
      </div>

      {/* 1. Motivation */}
      <section className="rounded-2xl border border-card-border p-6">
        <h2 className="font-semibold">1. What made you want to invest with us?</h2>
        <p className="mt-1 text-sm text-muted">Helps the algorithm understand your goals.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {MOTIVATION_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setMotivation((m) => (m.trim() ? `${m.trim()} ${p}.` : `${p}.`))}
              className="rounded-full border border-card-border px-3 py-1.5 text-xs text-muted transition hover:border-foreground hover:text-foreground"
            >
              + {p}
            </button>
          ))}
        </div>
        <textarea
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          rows={4}
          placeholder="In your own words…"
          className="mt-4 w-full rounded-xl border border-card-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/60"
        />
        <p className="mt-1 text-right text-xs text-muted">{motivation.trim().length}/2000 · min 10 characters</p>
      </section>

      {/* 2. Investment amount */}
      <section className="rounded-2xl border border-card-border p-6">
        <h2 className="font-semibold">2. How much do you want to invest?</h2>
        <p className="mt-1 text-sm text-muted">
          Approximate amount in USD. Larger committed capital lets the algorithm reserve bigger drops for you.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-lg font-bold text-muted">$</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="w-full max-w-xs rounded-xl border border-card-border bg-surface px-4 py-3 font-mono text-base text-foreground placeholder:text-muted/60"
          />
        </div>
      </section>

      {/* 3. Withdrawal destination */}
      <section className="rounded-2xl border border-card-border p-6">
        <h2 className="font-semibold">3. Where will you be withdrawing to?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`rounded-xl border p-4 text-left transition ${
                method === m.id
                  ? "border-foreground bg-surface"
                  : "border-card-border hover:border-foreground/40"
              }`}
            >
              <p className="font-semibold">{m.label}</p>
              <p className="mt-1 text-xs text-muted">{m.note}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Withdrawal percent */}
      <section className="rounded-2xl border border-card-border p-6">
        <h2 className="font-semibold">4. What percentage of your total balance will you withdraw each time?</h2>
        <p className="mt-1 text-sm text-muted">
          Withdrawing a smaller share keeps more capital working — the algorithm rewards that with better drops.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {PERCENT_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPercent(p)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                percent === p
                  ? "border-foreground bg-foreground text-background"
                  : "border-card-border text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
        <div className="mt-5">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full accent-emerald-400"
          />
          <p className="mt-2 text-sm">
            <span className="font-mono text-lg font-bold">{percent}%</span>{" "}
            <span className="text-muted">of total balance per withdrawal</span>
          </p>
        </div>
      </section>

      {/* 5. Withdrawal frequency */}
      <section className="rounded-2xl border border-card-border p-6">
        <h2 className="font-semibold">5. How often will you be withdrawing?</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FREQUENCIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFrequency(f.id)}
              className={`rounded-xl border p-4 text-left transition ${
                frequency === f.id
                  ? "border-foreground bg-surface"
                  : "border-card-border hover:border-foreground/40"
              }`}
            >
              <p className="font-semibold">{f.label}</p>
              <p className="mt-1 text-xs text-muted">{f.note}</p>
            </button>
          ))}
        </div>

        {/* Live drop-tier feedback */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`mt-5 rounded-xl border px-4 py-3 ${tierBadgeClass(tier.tone)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider">{tier.label}</p>
            <p className="mt-1 text-sm leading-relaxed">{tier.message}</p>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* 6. Profile picture */}
      <section className="rounded-2xl border border-card-border p-6">
        <h2 className="font-semibold">6. Upload your profile picture</h2>
        <p className="mt-1 text-sm text-muted">JPEG, PNG, or WebP — max 5 MB.</p>
        <div className="mt-4 flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-card-border bg-surface">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted">
                {(me?.account.fullName || me?.account.email || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-card-border px-5 py-2 text-sm transition hover:border-foreground"
            >
              {photoPreview ? "Change picture" : "Choose picture"}
            </button>
            {photoFile ? <p className="mt-2 text-xs text-muted">{photoFile.name}</p> : null}
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!formValid || saving}
          className="btn-shine rounded-full border border-foreground bg-foreground px-8 py-3 text-sm font-semibold text-background disabled:opacity-50"
        >
          {saving ? "Saving…" : profile?.completedAt ? "Update profile" : "Save profile"}
        </button>
        {!formValid ? (
          <p className="text-xs text-muted">Answer questions 1–5 to save. Picture is optional but recommended.</p>
        ) : null}
      </div>

      {/* Profile summary modal */}
      <AnimatePresence>
        {showModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong glow-ring max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 sm:p-8"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400/50 bg-surface">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-muted">
                      {(me?.account.fullName || me?.account.email || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-xl font-bold">{me?.account.fullName || me?.account.email}</h3>
                <span
                  className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${tierBadgeClass(tier.tone)}`}
                >
                  {tier.label}
                </span>
              </div>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="rounded-xl border border-card-border bg-surface/40 p-3">
                  <dt className="text-xs uppercase tracking-wider text-muted">Why investing with us</dt>
                  <dd className="mt-1 leading-relaxed">{motivation.trim()}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-card-border bg-surface/40 p-3">
                    <dt className="text-xs uppercase tracking-wider text-muted">Investment</dt>
                    <dd className="mt-1 font-mono font-bold">{fmtUsd(amountNum)}</dd>
                  </div>
                  <div className="rounded-xl border border-card-border bg-surface/40 p-3">
                    <dt className="text-xs uppercase tracking-wider text-muted">Withdraws to</dt>
                    <dd className="mt-1 font-semibold capitalize">{method === "bank" ? "Bank account" : "Crypto wallet"}</dd>
                  </div>
                  <div className="rounded-xl border border-card-border bg-surface/40 p-3">
                    <dt className="text-xs uppercase tracking-wider text-muted">Per withdrawal</dt>
                    <dd className="mt-1 font-mono font-bold">{percent}% of balance</dd>
                  </div>
                  <div className="rounded-xl border border-card-border bg-surface/40 p-3">
                    <dt className="text-xs uppercase tracking-wider text-muted">Frequency</dt>
                    <dd className="mt-1 font-semibold capitalize">{frequency}</dd>
                  </div>
                </div>
              </dl>

              <p className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs leading-relaxed text-emerald-200">
                Profile saved. Our drop-generation algorithm will now send you opportunities matched to this profile.
                Keeping withdrawals small and infrequent moves you toward priority access on high-yield drops.
              </p>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-shine mt-6 w-full rounded-full border border-foreground bg-foreground py-3 text-sm font-semibold text-background"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
