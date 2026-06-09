import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DocsSidebar } from "@/components/DocsSidebar";
import { AmbientBackground } from "@/components/AmbientBackground";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AmbientBackground variant="subtle" />
      <SiteHeader showSearch />
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6">
        <DocsSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <SiteFooter />
    </>
  );
}
