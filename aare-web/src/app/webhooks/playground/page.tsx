import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WebhookPlayground } from "@/components/WebhookPlayground";

export const metadata = {
  title: "Webhook Playground",
  description: "Generate and verify HMAC webhook signatures.",
};

export default function WebhookPlaygroundPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold">Webhook playground</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Practice verifying <code className="font-mono text-sm">X-Ema-Signature</code> headers for{" "}
          <code className="font-mono text-sm">deposit.credited</code> and{" "}
          <code className="font-mono text-sm">withdrawal.finished</code> events.
        </p>
        <div className="mt-10">
          <WebhookPlayground />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
