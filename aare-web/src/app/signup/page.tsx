"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { usePortalAuth } from "@/context/PortalAuthContext";
import { COUNTRY_OPTIONS } from "@/lib/portal";

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && me) router.replace("/dashboard");
  }, [loading, me, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        phoneCountry,
        countryOfResidency,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  const dial = COUNTRY_OPTIONS.find((c) => c.code === phoneCountry)?.dial || "";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
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
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="text-foreground hover:underline">
            Log in
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
