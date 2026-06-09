"use client";

import { useState } from "react";
import {
  COUNTRY_OPTIONS,
  portalSaveKycDraft,
  portalSubmitKyc,
  portalUploadKycImages,
  type PortalKyc,
} from "@/lib/portal";
import { usePortalAuth } from "@/context/PortalAuthContext";

type Props = {
  kyc: PortalKyc;
  onUpdated: () => void;
};

export function PortalKycWizard({ kyc, onUpdated }: Props) {
  const { refresh } = usePortalAuth();
  const [step, setStep] = useState(0);
  const [residenceCountry, setResidenceCountry] = useState(kyc.residenceCountry || "");
  const [residenceScope, setResidenceScope] = useState(kyc.residenceScope || "");
  const [documentType, setDocumentType] = useState<"permit_id" | "passport" | "">(
    (kyc.documentType as "permit_id" | "passport") || ""
  );
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const locked = ["approved", "submitted", "ai_reviewing"].includes(kyc.status);

  async function saveDraft() {
    setError("");
    setBusy(true);
    try {
      await portalSaveKycDraft({
        residenceCountry,
        residenceScope: residenceScope || undefined,
        documentType: documentType || undefined,
      });
      await refresh();
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndSubmit() {
    setError("");
    setBusy(true);
    try {
      await portalSaveKycDraft({
        residenceCountry,
        residenceScope,
        documentType: documentType || undefined,
      });
      if (frontFile || (documentType === "permit_id" && backFile)) {
        const form = new FormData();
        if (documentType) form.append("documentType", documentType);
        if (frontFile) form.append("front", frontFile);
        if (backFile) form.append("back", backFile);
        await portalUploadKycImages(form);
      }
      await portalSubmitKyc();
      await refresh();
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (kyc.status === "approved") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <h2 className="text-lg font-semibold text-emerald-300">Identity verified</h2>
        <p className="mt-2 text-sm text-muted">You can apply for API access.</p>
      </div>
    );
  }

  if (kyc.status === "manual_review" || kyc.status === "submitted" || kyc.status === "ai_reviewing") {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-lg font-semibold">KYC under review</h2>
        <p className="mt-2 text-sm text-muted">We are reviewing your documents. Check back soon.</p>
      </div>
    );
  }

  if (kyc.status === "rejected") {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
        <h2 className="text-lg font-semibold text-rose-300">Verification not approved</h2>
        <p className="mt-2 text-sm text-muted">{kyc.rejectionReason || "Please resubmit with clearer photos."}</p>
        <button
          type="button"
          onClick={() => setStep(0)}
          className="mt-4 rounded-full border border-card-border px-4 py-2 text-sm"
        >
          Resubmit KYC
        </button>
      </div>
    );
  }

  const steps = ["Residence", "Live / work", "Document", "Photos", "Submit"];

  return (
    <div className="rounded-2xl border border-card-border p-6">
      <h2 className="text-lg font-semibold">Identity verification (KYC)</h2>
      <p className="mt-2 text-sm text-muted">Required before you can apply for the Partner API.</p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {steps.map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 ${i === step ? "bg-foreground text-background" : "border border-card-border text-muted"}`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {step === 0 ? (
          <>
            <label className="block text-xs font-medium text-muted">Current country of residence</label>
            <select
              value={residenceCountry}
              onChange={(e) => setResidenceCountry(e.target.value)}
              disabled={locked}
              className="w-full rounded-xl border border-card-border bg-surface px-4 py-2.5 text-sm"
            >
              <option value="">Select country</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-sm text-muted">Do you live or work only in this country?</p>
            {[
              { v: "live_only", l: "I live only in this country" },
              { v: "work_only", l: "I work only in this country" },
              { v: "live_and_work", l: "I both live and work here" },
            ].map((opt) => (
              <label key={opt.v} className="flex cursor-pointer items-center gap-3 rounded-xl border border-card-border p-3 text-sm">
                <input
                  type="radio"
                  name="scope"
                  checked={residenceScope === opt.v}
                  onChange={() => setResidenceScope(opt.v)}
                  disabled={locked}
                />
                {opt.l}
              </label>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-sm text-muted">Choose your proof of identity</p>
            {[
              { v: "permit_id" as const, l: "Residence permit / national ID (front + back)" },
              { v: "passport" as const, l: "Passport (photo page only)" },
            ].map((opt) => (
              <label key={opt.v} className="flex cursor-pointer items-center gap-3 rounded-xl border border-card-border p-3 text-sm">
                <input
                  type="radio"
                  name="doctype"
                  checked={documentType === opt.v}
                  onChange={() => setDocumentType(opt.v)}
                  disabled={locked}
                />
                {opt.l}
              </label>
            ))}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div>
              <label className="block text-xs font-medium text-muted">
                {documentType === "passport" ? "Passport photo page" : "Front of document"}
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                className="mt-2 w-full text-sm"
              />
              {kyc.hasFront && !frontFile ? (
                <p className="mt-1 text-xs text-muted">Front image already uploaded</p>
              ) : null}
            </div>
            {documentType === "permit_id" ? (
              <div>
                <label className="block text-xs font-medium text-muted">Back of document</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                  className="mt-2 w-full text-sm"
                />
                {kyc.hasBack && !backFile ? (
                  <p className="mt-1 text-xs text-muted">Back image already uploaded</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <div className="text-sm text-muted space-y-2">
            <p>
              <strong className="text-foreground">Residence:</strong>{" "}
              {COUNTRY_OPTIONS.find((c) => c.code === residenceCountry)?.name || residenceCountry}
            </p>
            <p>
              <strong className="text-foreground">Scope:</strong> {residenceScope.replace(/_/g, " ")}
            </p>
            <p>
              <strong className="text-foreground">Document:</strong> {documentType.replace(/_/g, " ")}
            </p>
            <p>Documents are reviewed automatically. Low-confidence cases go to manual review.</p>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-full border border-card-border px-4 py-2 text-sm">
            Back
          </button>
        ) : null}
        {step < 4 ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await saveDraft();
              setStep((s) => s + 1);
            }}
            className="rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void uploadAndSubmit()}
            className="rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        )}
      </div>
    </div>
  );
}
