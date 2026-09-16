import { CircleCheckBig, Lightbulb, Sparkle } from "lucide-react";

export type Confidence = "high" | "medium" | "low";

export type Diagnosis = {
  headline: string;
  explanation: string;
  confidence: Confidence;
  causes: string[];
  rescueSteps: string[];
  nextTime: string[];
  missingInformation: string[];
  safetyNote: string | null;
};

const CONFIDENCE_BADGE_CLASS: Record<Confidence, string> = {
  high: "bg-support-green/20 text-text-primary",
  medium: "bg-border/50 text-text-primary",
  low: "bg-error/10 text-error",
};

type DiagnosisCardProps = {
  diagnosis: Diagnosis;
};

export function DiagnosisCard({ diagnosis }: DiagnosisCardProps) {
  return (
    <article className="flex flex-col gap-5 overflow-hidden rounded-card border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2
          tabIndex={-1}
          className="rounded-sm font-display text-base font-semibold text-text-primary focus:outline-2 focus:outline-offset-2 focus:outline-action"
        >
          Chef&apos;s diagnosis
        </h2>
        <span
          className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${CONFIDENCE_BADGE_CLASS[diagnosis.confidence]}`}
        >
          {diagnosis.confidence} confidence
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-start gap-2 font-display text-xl font-semibold text-text-primary">
          <Sparkle
            className="mt-1 size-4 shrink-0 text-action"
            aria-hidden="true"
          />
          {diagnosis.headline}
        </h3>
        <p className="text-sm text-text-muted">{diagnosis.explanation}</p>
      </div>

      {diagnosis.causes.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Likely causes
          </h3>
          <ol className="flex flex-col gap-3">
            {diagnosis.causes.map((cause, index) => (
              <li key={cause} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-text-muted">{cause}</span>
                {index === 0 ? (
                  <span className="shrink-0 rounded-full bg-action/10 px-2.5 py-1 text-xs font-semibold text-action">
                    Most likely
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {diagnosis.rescueSteps.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-control bg-action/5 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-action">
            <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
            Rescue plan
          </h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-muted">
            {diagnosis.rescueSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {diagnosis.nextTime.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Next time</h3>
          <ul className="flex flex-col gap-1.5">
            {diagnosis.nextTime.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CircleCheckBig
                  className="mt-0.5 size-4 shrink-0 text-support-green"
                  aria-hidden="true"
                />
                <span className="text-text-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DiagnosisSection
        title="Missing information"
        items={diagnosis.missingInformation}
      />

      {diagnosis.safetyNote ? (
        <div className="rounded-control border border-error/40 bg-error/5 px-4 py-3 text-sm text-error">
          <p className="font-semibold">Food safety note</p>
          <p className="mt-1">{diagnosis.safetyNote}</p>
        </div>
      ) : null}
    </article>
  );
}

function DiagnosisSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
