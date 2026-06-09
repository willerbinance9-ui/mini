import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApiExplorer } from "@/components/ApiExplorer";
import { AmbientBackground } from "@/components/AmbientBackground";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import { ExplorerParticles } from "@/components/ExplorerParticles";

export const metadata = {
  title: "API Explorer",
  description: "Send requests to the Min Partner API.",
};

export default function ExplorerPage() {
  return (
    <>
      <AmbientBackground variant="subtle" />
      <SiteHeader />
      <ExplorerParticles />
      <main className="relative mx-auto max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <AnimatedReveal className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Live playground</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">API Explorer</h1>
          <p className="mt-3 text-muted">
            Send live requests with your partner key (stored in this browser session only). Use mock mode without a key.
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.15}>
          <ApiExplorer />
        </AnimatedReveal>
      </main>
      <SiteFooter />
    </>
  );
}
