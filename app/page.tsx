import { DiagnosisWorkspace } from "@/components/DiagnosisWorkspace";
import { Hero } from "@/components/Hero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Hero />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 sm:px-6 lg:px-8">
        <DiagnosisWorkspace />
      </main>
      <SiteFooter />
    </div>
  );
}
