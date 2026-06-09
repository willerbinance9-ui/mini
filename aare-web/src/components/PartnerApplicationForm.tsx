"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFetchApiBase } from "@/lib/constants";
import { usePortalAuth } from "@/context/PortalAuthContext";
import { PORTAL_TOKEN_KEY } from "@/lib/portal";
import { PARTNERSHIP_TERMS, PARTNERSHIP_DISCLAIMER } from "@/content/partnership-terms";

const STEP_ICONS: { label: string; icon: React.ReactNode }[] = [
  {
    label: "Personal details",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    label: "Your work",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M3 12h18" />
      </svg>
    ),
  },
  {
    label: "Annual income",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: "Intended investment",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    label: "Withdrawals",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M3 12a9 9 0 1 0 9-9" />
        <path d="M3 3v6h6M12 8v8l3-3" />
      </svg>
    ),
  },
  {
    label: "Investment history",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    label: "Payment preference",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: "API & terms",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
];

type FormState = {
  fullName: string;
  email: string;
  country: string;
  phone: string;
  occupation: string;
  incomePerYear: string;
  intendedInvestment: string;
  withdrawFrequency: "week" | "month" | "trimester" | "";
  withdrawAmount: string;
  investedBefore: boolean;
  previousInvestmentAmount: string;
  previousReturnAmount: string;
  previousDuration: string;
  investmentHistoryNotes: string;
  paymentPreference: "fiat" | "crypto" | "";
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingOrSwift: string;
  bankCountry: string;
  cryptoAddress: string;
  cryptoNetwork: string;
  hasApiKnowledge: boolean;
  apiPlan: "hire" | "self" | "";
  termsAccepted: boolean;
};

const initial: FormState = {
  fullName: "",
  email: "",
  country: "",
  phone: "",
  occupation: "",
  incomePerYear: "",
  intendedInvestment: "",
  withdrawFrequency: "",
  withdrawAmount: "",
  investedBefore: false,
  previousInvestmentAmount: "",
  previousReturnAmount: "",
  previousDuration: "",
  investmentHistoryNotes: "",
  paymentPreference: "",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  routingOrSwift: "",
  bankCountry: "",
  cryptoAddress: "",
  cryptoNetwork: "usdttrc20",
  hasApiKnowledge: false,
  apiPlan: "",
  termsAccepted: false,
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "mt-0 w-full rounded-xl border border-card-border bg-surface/80 px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20";

type Props = {
  /** Render inside partner dashboard after signup + KYC */
  embedded?: boolean;
};

export function PartnerApplicationForm({ embedded = false }: Props) {
  const { me, loading: authLoading, refresh } = usePortalAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (!me) return;
    setForm((f) => ({
      ...f,
      fullName: f.fullName || me.account.fullName || "",
      email: f.email || me.account.email || "",
      country: f.country || me.account.countryOfResidency || "",
      phone: f.phone || me.account.phone || "",
    }));
  }, [me]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(): string[] {
    const e: string[] = [];
    if (step === 0) {
      if (!form.fullName.trim()) e.push("Full name is required");
      if (!form.email.includes("@")) e.push("Valid email is required");
      if (!form.country.trim()) e.push("Country is required");
      if (!form.phone.trim()) e.push("Phone is required");
    }
    if (step === 1 && !form.occupation.trim()) e.push("Describe the work you do");
    if (step === 2 && (!form.incomePerYear || Number(form.incomePerYear) < 0)) {
      e.push("Annual income is required");
    }
    if (step === 3 && (!form.intendedInvestment || Number(form.intendedInvestment) <= 0)) {
      e.push("Intended investment must be greater than 0");
    }
    if (step === 4) {
      if (!form.withdrawFrequency) e.push("Select a withdrawal frequency");
    }
    if (step === 5 && form.investedBefore) {
      if (!form.previousInvestmentAmount && !form.investmentHistoryNotes.trim()) {
        e.push("Provide prior investment amount or explain in notes");
      }
    }
    if (step === 6) {
      if (!form.paymentPreference) e.push("Select fiat or crypto");
      if (form.paymentPreference === "fiat") {
        if (!form.bankName.trim()) e.push("Bank name required");
        if (!form.accountHolder.trim()) e.push("Account holder required");
        if (!form.accountNumber.trim()) e.push("Account number required");
      }
      if (form.paymentPreference === "crypto" && !form.cryptoAddress.trim()) {
        e.push("Crypto address required");
      }
    }
    if (step === 7) {
      if (!form.hasApiKnowledge && !form.apiPlan) e.push("Select hire developer or build yourself");
      if (!form.termsAccepted) e.push("You must accept the terms");
    }
    return e;
  }

  function next() {
    const e = validateStep();
    setErrors(e);
    if (e.length) return;
    setStep((s) => Math.min(s + 1, STEP_ICONS.length - 1));
  }

  function back() {
    setErrors([]);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    const e = validateStep();
    setErrors(e);
    if (e.length) return;

    setSubmitting(true);
    setErrors([]);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(PORTAL_TOKEN_KEY) : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${getFetchApiBase()}/v1/public/partner-applications`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...form,
          incomePerYear: Number(form.incomePerYear),
          intendedInvestment: Number(form.intendedInvestment),
          withdrawAmount: form.withdrawAmount ? Number(form.withdrawAmount) : null,
          previousInvestmentAmount: form.previousInvestmentAmount
            ? Number(form.previousInvestmentAmount)
            : null,
          previousReturnAmount: form.previousReturnAmount ? Number(form.previousReturnAmount) : null,
          termsAccepted: form.termsAccepted,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.errors || [body.message || "Submission failed"]);
        return;
      }
      setDone({ id: body.id, message: body.message });
      void refresh();
    } catch {
      setErrors(["Network error. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  if (embedded) {
    if (authLoading) return <p className="text-sm text-muted">Loading…</p>;
    if (!me?.canApplyForApi || me.application) return null;
  }

  if (!embedded && !authLoading && me && !me.canApplyForApi) {
    return (
      <div className="glass-strong glow-ring rounded-3xl p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold text-foreground">Identity verification required</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">
          Complete KYC in your dashboard before applying for the Partner API. Upload your permit ID or passport for
          automatic review.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold hover:underline">
          Go to dashboard →
        </Link>
      </div>
    );
  }

  if (!embedded && !authLoading && !me) {
    return (
      <div className="glass-strong glow-ring rounded-3xl p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold text-foreground">Account required</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">
          Create an Aare account, verify your phone on login, and complete identity verification before applying.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-full border border-foreground bg-foreground px-5 py-2 text-sm font-semibold text-background">
            Sign up
          </Link>
          <Link href="/login" className="rounded-full border border-card-border px-5 py-2 text-sm">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    if (embedded) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center"
        >
          <p className="text-lg font-semibold text-emerald-300">Application submitted</p>
          <p className="mt-2 text-sm text-muted">{done.message}</p>
          <p className="mt-2 font-mono text-xs text-muted">Reference: {done.id}</p>
        </motion.div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-strong glow-ring rounded-3xl p-8 text-center sm:p-12"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-card-border text-2xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-foreground">Application submitted</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">{done.message}</p>
        <p className="mt-2 font-mono text-xs text-muted">Reference: {done.id}</p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold hover:underline">
          View status in dashboard →
        </Link>
      </motion.div>
    );
  }

  const shellClass = embedded
    ? "rounded-xl border border-card-border bg-surface/40 p-4 sm:p-6"
    : "glass-strong glow-ring rounded-3xl p-6 sm:p-10";

  return (
    <div className={shellClass}>
      {!embedded && !authLoading && !me ? (
        <div className="mb-6 rounded-xl border border-card-border bg-surface px-4 py-3 text-sm text-muted">
          <Link href="/signup" className="font-semibold text-foreground hover:underline">
            Create an Aare account
          </Link>{" "}
          or{" "}
          <Link href="/login" className="font-semibold text-foreground hover:underline">
            log in
          </Link>{" "}
          to track your application from the dashboard.
        </div>
      ) : null}
      {!embedded ? (
        <div className="mb-8 rounded-xl border border-card-border bg-surface px-4 py-3 text-sm text-muted">
          {PARTNERSHIP_DISCLAIMER}
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted">{PARTNERSHIP_DISCLAIMER}</p>
      )}

      <div className="mb-3">
        <div className="h-1 overflow-hidden rounded-full bg-card-border">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-300"
            style={{ width: `${((step + 1) / STEP_ICONS.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="mb-2 flex justify-between gap-0.5 sm:gap-1" role="list" aria-label="Application steps">
        {STEP_ICONS.map((s, i) => {
          const active = i === step;
          const completed = i < step;
          return (
            <div key={s.label} className="flex flex-1 justify-center" role="listitem">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all sm:h-9 sm:w-9 ${
                  active
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : completed
                      ? "border-foreground/60 bg-foreground/5 text-foreground"
                      : "border-card-border bg-surface text-muted/70"
                }`}
                aria-current={active ? "step" : undefined}
                title={s.label}
              >
                {s.icon}
              </div>
              <span className="sr-only">{s.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mb-8 text-center text-xs font-medium text-foreground sm:text-sm">{STEP_ICONS[step].label}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {step === 0 && (
            <>
              <h2 className="text-xl font-semibold">1. Personal details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input className={inputClass} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </Field>
                <Field label="Email">
                  <input type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Country">
                  <input className={inputClass} value={form.country} onChange={(e) => set("country", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold">2. Your work</h2>
              <Field label="What work do you do?" hint="Occupation, business, or primary source of income.">
                <textarea
                  rows={4}
                  className={inputClass}
                  value={form.occupation}
                  onChange={(e) => set("occupation", e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold">3. Income per year</h2>
              <Field label="Annual income (USD)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.incomePerYear}
                  onChange={(e) => set("incomePerYear", e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold">4. Intended investment</h2>
              <Field label="How much do you intend to invest with us? (USD)">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.intendedInvestment}
                  onChange={(e) => set("intendedInvestment", e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-xl font-semibold">5. Recurring withdrawals</h2>
              <Field label="How often do you plan to withdraw?">
                <select
                  className={inputClass}
                  value={form.withdrawFrequency}
                  onChange={(e) => set("withdrawFrequency", e.target.value as FormState["withdrawFrequency"])}
                >
                  <option value="">Select frequency</option>
                  <option value="week">Per week</option>
                  <option value="month">Per month</option>
                  <option value="trimester">Per trimester (3 months)</option>
                </select>
              </Field>
              <Field label="Typical withdrawal amount (USD, optional)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.withdrawAmount}
                  onChange={(e) => set("withdrawAmount", e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-xl font-semibold">6. Investment experience</h2>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.investedBefore}
                  onChange={(e) => set("investedBefore", e.target.checked)}
                  className="h-4 w-4 rounded border-card-border"
                />
                I have invested before
              </label>
              {form.investedBefore ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="How much did you invest? (USD)">
                    <input type="number" className={inputClass} value={form.previousInvestmentAmount} onChange={(e) => set("previousInvestmentAmount", e.target.value)} />
                  </Field>
                  <Field label="What was the return? (USD)">
                    <input type="number" className={inputClass} value={form.previousReturnAmount} onChange={(e) => set("previousReturnAmount", e.target.value)} />
                  </Field>
                  <Field label="Duration">
                    <input className={inputClass} placeholder="e.g. 6 months" value={form.previousDuration} onChange={(e) => set("previousDuration", e.target.value)} />
                  </Field>
                  <Field label="Other reasons / context" hint="If no figures above, explain here.">
                    <textarea rows={3} className={inputClass} value={form.investmentHistoryNotes} onChange={(e) => set("investmentHistoryNotes", e.target.value)} />
                  </Field>
                </div>
              ) : (
                <Field label="If not, explain your investment goals">
                  <textarea rows={3} className={inputClass} value={form.investmentHistoryNotes} onChange={(e) => set("investmentHistoryNotes", e.target.value)} />
                </Field>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="text-xl font-semibold">7. Payment preference</h2>
              <div className="flex flex-wrap gap-3">
                {(["fiat", "crypto"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("paymentPreference", p)}
                    className={`rounded-xl border px-5 py-2.5 text-sm capitalize transition ${
                      form.paymentPreference === p
                        ? "border-foreground bg-foreground text-background"
                        : "border-card-border text-muted hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {form.paymentPreference === "fiat" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Bank name"><input className={inputClass} value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
                  <Field label="Account holder"><input className={inputClass} value={form.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} /></Field>
                  <Field label="Account number"><input className={inputClass} value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></Field>
                  <Field label="Routing / SWIFT (optional)"><input className={inputClass} value={form.routingOrSwift} onChange={(e) => set("routingOrSwift", e.target.value)} /></Field>
                  <Field label="Bank country"><input className={inputClass} value={form.bankCountry} onChange={(e) => set("bankCountry", e.target.value)} /></Field>
                </div>
              ) : null}
              {form.paymentPreference === "crypto" ? (
                <div className="space-y-4">
                  <Field label="Crypto network" hint="e.g. usdttrc20">
                    <input className={inputClass} value={form.cryptoNetwork} onChange={(e) => set("cryptoNetwork", e.target.value)} />
                  </Field>
                  <Field
                    label="Crypto address"
                    hint="This address will not be changed unless you contact us first."
                  >
                    <input className={inputClass} value={form.cryptoAddress} onChange={(e) => set("cryptoAddress", e.target.value)} />
                  </Field>
                </div>
              ) : null}
            </>
          )}

          {step === 7 && (
            <>
              <h2 className="text-xl font-semibold">8. Developer API & terms</h2>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.hasApiKnowledge}
                  onChange={(e) => set("hasApiKnowledge", e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                I have knowledge of developer APIs
              </label>
              {!form.hasApiKnowledge ? (
                <Field label="If not, what is your plan?">
                  <select className={inputClass} value={form.apiPlan} onChange={(e) => set("apiPlan", e.target.value as FormState["apiPlan"])}>
                    <option value="">Select one</option>
                    <option value="hire">I intend to hire a developer</option>
                    <option value="self">I will build it myself</option>
                  </select>
                </Field>
              ) : null}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-card-border bg-surface/60 p-4 text-xs leading-relaxed text-muted whitespace-pre-wrap">
                {PARTNERSHIP_TERMS}
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={(e) => set("termsAccepted", e.target.checked)}
                  className="mt-1 h-4 w-4 rounded"
                />
                <span>
                  I agree to the Aare Partner API application terms. I understand that approval is not guaranteed and
                  that my answers shape a personalized API configuration.
                </span>
              </label>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {errors.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {errors.map((err) => (
            <li key={err}>• {err}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 flex justify-between gap-4">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="rounded-xl border border-card-border px-5 py-2.5 text-sm text-muted disabled:opacity-40"
        >
          Back
        </button>
        {step < STEP_ICONS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="btn-shine rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-semibold text-background"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="btn-shine rounded-full border border-foreground bg-foreground px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>
    </div>
  );
}
