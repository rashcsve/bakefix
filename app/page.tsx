import { BakeForm } from "@/components/bakefix/BakeForm";
import { DiagnosisCard } from "@/components/bakefix/DiagnosisCard";
import { DiagnosisErrorState } from "@/components/bakefix/DiagnosisErrorState";
import { DiagnosisLoadingState } from "@/components/bakefix/DiagnosisLoadingState";
import { exampleDiagnosis } from "@/components/bakefix/example-diagnosis";
import { Hero } from "@/components/bakefix/Hero";
import { SiteFooter } from "@/components/bakefix/SiteFooter";
import { SiteHeader } from "@/components/bakefix/SiteHeader";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Hero />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          <BakeForm />

          <div className="flex flex-col gap-8">
            <section aria-labelledby="diagnosis-heading">
              <DiagnosisCard diagnosis={exampleDiagnosis} />
            </section>

            <section aria-labelledby="diagnosis-loading-heading">
              <h2
                id="diagnosis-loading-heading"
                className="mb-3 text-sm font-semibold text-text-muted"
              >
                While a diagnosis is generating
              </h2>
              <DiagnosisLoadingState />
            </section>

            <section aria-labelledby="diagnosis-error-heading">
              <h2
                id="diagnosis-error-heading"
                className="mb-3 text-sm font-semibold text-text-muted"
              >
                If something goes wrong
              </h2>
              <DiagnosisErrorState />
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
