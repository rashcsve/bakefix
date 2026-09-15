import { ArrowRight } from "lucide-react";
import { CategoryField } from "@/components/bakefix/CategoryField";
import { ConstraintField } from "@/components/bakefix/ConstraintField";
import { RecipeDisclosure } from "@/components/bakefix/RecipeDisclosure";

export function BakeForm() {
  return (
    <div
      id="bake-form"
      className="scroll-mt-20 rounded-card border border-border bg-surface p-6 shadow-sm"
    >
      <form className="flex flex-col gap-6">
        <CategoryField />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="problem"
            className="text-sm font-semibold text-text-primary"
          >
            Describe what went wrong
          </label>
          <div className="relative">
            <textarea
              id="problem"
              name="problem"
              rows={5}
              required
              aria-describedby="problem-counter"
              placeholder="Describe what happened, for example: my cookies spread into thin, flat puddles"
              className="w-full rounded-control border border-border bg-surface px-3 pt-2 pb-6 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            />
            <p
              id="problem-counter"
              className="pointer-events-none absolute right-3 bottom-2 text-xs text-text-muted"
            >
              0 / 1000 characters
            </p>
          </div>
        </div>

        <RecipeDisclosure />

        <ConstraintField />

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-action px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            Diagnose my bake
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          <p className="text-xs text-text-muted">
            No account needed. Just better bakes.
          </p>
        </div>
      </form>
    </div>
  );
}
