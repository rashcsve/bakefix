import { Loader2 } from "lucide-react";

export function DiagnosisLoadingState() {
  return (
    <div
      role="status"
      aria-label="Generating diagnosis"
      className="flex flex-col gap-5 rounded-card border border-border bg-surface p-6 shadow-sm"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Analyzing your bake…
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-5 w-3/4 animate-pulse rounded-control bg-border/60" />
        <div className="h-3 w-full animate-pulse rounded-control bg-border/60" />
        <div className="h-3 w-5/6 animate-pulse rounded-control bg-border/60" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-1/3 animate-pulse rounded-control bg-border/60" />
        <div className="h-3 w-full animate-pulse rounded-control bg-border/60" />
        <div className="h-3 w-2/3 animate-pulse rounded-control bg-border/60" />
      </div>
    </div>
  );
}
