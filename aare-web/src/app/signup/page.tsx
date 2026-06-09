"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { usePortalAuth } from "@/context/PortalAuthContext";
import { COUNTRY_OPTIONS } from "@/lib/portal";

type Phase = "form" | "submitting" | "success" | "error";

const SUBMIT_MESSAGES = [
  "Connecting to API…",
  "Creating your account…",
  "Securing your session…",
];

export default function SignupPage() {
  const { register, me, loading } = usePortalAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("US");
  const [countryOfResidency, setCountryOfResidency] = useState("US");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [submitMsg, setSubmitMsg] = useState(SUBMIT_MESSAGES[0]);

  useEffect(() => {
    if (!loading && me) router.replace("/dashboard");
  }, [loading, me, router]);

  useEffect(() => {
    if (phase !== "submitting") return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % SUBMIT_MESSAGES.length;
      setSubmitMsg(SUBMIT_MESSAGES[i]);
    }, 2200);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "success") return;
    const id = setTimeout(() => router.push("/dashboard"), 1400);
    return () => clearTimeout(id);
  }, [phase, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPhase("submitting");
    setSubmitMsg(SUBMIT_MESSAGES[0]);
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        phoneCountry,
        countryOfResidency,
      });
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setPhase("error");
    }
  }

  const dial = COUNTRY_OPTIONS.find((c) => c.code === phoneCountry)?.dial || "";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <AnimatePresence mode="wait">
          {phase === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15"
              >
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, delay: 0.2 }}
                  />
                </svg>
              </motion.div>
              <h1 className="mt-6 text-2xl font-bold">Account created</h1>
              <p className="mt-2 text-sm text-muted">Redirecting to your dashboard…</p>
              <motion.div
                className="mx-auto mt-6 h-1 w-32 overflow-hidden rounded-full bg-card-border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="h-full rounded-full bg-emerald-400"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                />
              </motion.div>
            </motion.div>
          ) : phase === "submitting" ? (
            <motion.div
              key="submitting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                <motion.div
                  className="h-12 w-12 rounded-full border-2 border-card-border border-t-foreground"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <h1 className="mt-6 text-2xl font-bold">Creating account</h1>
              <motion.p
                key={submitMsg}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm text-muted"
              >
                {submitMsg}
              </motion.p>
              <p className="mt-4 text-xs text-muted">First request may take up to 30s while the API wakes up.</p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-bold">Create account</h1>
              <p className="mt-2 text-sm text-muted">
                Register with your phone and country of residency to access the partner portal.
              </p>
              <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Full name</label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Country of residency</label>
                  <select
                    required
                    value={countryOfResidency}
                    onChange={(e) => setCountryOfResidency(e.target.value)}
                    className="w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 text-sm"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Phone country</label>
                  <select
                    value={phoneCountry}
                    onChange={(e) => setPhoneCountry(e.target.value)}
                    className="w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 text-sm"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} (+{c.dial})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Phone number</label>
                  <div className="flex gap-2">
                    <span className="flex items-center rounded-xl border border-card-border bg-surface px-3 text-sm text-muted">
                      +{dial}
                    </span>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="766532251"
                      className="min-w-0 flex-1 rounded-xl border border-card-border bg-surface px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 text-sm"
                  />
                  <p className="mt-1 text-xs text-muted">At least 8 characters</p>
                </div>
                {error ? (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-rose-400"
                  >
                    {error}
                  </motion.p>
                ) : null}
                <button
                  type="submit"
                  className="w-full rounded-full border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
                >
                  Create account
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-muted">
                Already registered?{" "}
                <Link href="/login" className="text-foreground hover:underline">
                  Log in
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <SiteFooter />
    </>
  );
}
