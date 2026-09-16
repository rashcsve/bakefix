import { ChefHat } from "lucide-react";

export function DiagnosisEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center shadow-sm">
      <ChefHat className="size-8 text-text-muted" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-semibold text-text-primary">
          No diagnosis yet
        </h3>
        <p className="max-w-sm text-sm text-text-muted">
          Fill in the form and select "Diagnose my bake" — your results will
          show up right here.
        </p>
      </div>
    </div>
  );
}
