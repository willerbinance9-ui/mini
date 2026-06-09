import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApiExplorer } from "@/components/ApiExplorer";

export const metadata = {
  title: "API Explorer",
  description: "Send requests to the Min Partner API.",
};

export default function ExplorerPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-bold sm:text-3xl">API Explorer</h1>
          <p className="mt-2 text-sm text-muted">
            Send live requests with your partner key (stored in this browser session only). Use mock mode without a key.
          </p>
        </div>
        <ApiExplorer />
      </main>
      <SiteFooter />
    </>
  );
}
