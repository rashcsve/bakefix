import { AlertTriangle } from "lucide-react";

export function DiagnosisErrorState() {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-card border border-error/40 bg-error/5 p-6 shadow-sm"
    >
      <div className="flex items-center gap-2 text-error">
        <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
        <h3 className="font-display text-lg font-semibold">
          We couldn't generate a diagnosis
        </h3>
      </div>
      <p className="text-sm text-text-muted">
        Something went wrong while reaching the diagnosis service. Your answers
        are still here, so you can try again.
      </p>
      <button
        type="button"
        className="min-h-11 w-fit rounded-control border border-error/40 px-5 py-2 text-sm font-semibold text-error transition-colors hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        Try again
      </button>
    </div>
  );
}
