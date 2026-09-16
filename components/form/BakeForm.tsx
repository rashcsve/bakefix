"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import type { SubmitEvent } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CategoryField } from "@/components/form/CategoryField";
import { ConstraintField } from "@/components/form/ConstraintField";
import { FieldError } from "@/components/form/FieldError";
import { RecipeDisclosure } from "@/components/form/RecipeDisclosure";
import type { BakeFormValues } from "@/lib/schemas/bake-form";

const PROBLEM_MAX_LENGTH = 1000;

type BakeFormProps = {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
};

export function BakeForm({ onSubmit, isSubmitting }: BakeFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<BakeFormValues>();
  const problemValue = useWatch({ control, name: "problem" });
  const problemLength = problemValue?.length ?? 0;
  const problemErrorId = errors.problem ? "problem-error" : undefined;
  const problemDescribedBy = ["problem-counter", problemErrorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      id="bake-form"
      className="scroll-mt-20 rounded-card border border-border bg-surface p-6 shadow-sm"
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
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
              rows={5}
              aria-invalid={!!errors.problem}
              aria-describedby={problemDescribedBy}
              placeholder="Describe what happened, for example: my cookies spread into thin, flat puddles"
              className="w-full rounded-control border border-border bg-surface px-3 pt-2 pb-6 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              {...register("problem")}
            />
            <p
              id="problem-counter"
              className="pointer-events-none absolute right-3 bottom-2 text-xs text-text-muted"
            >
              {problemLength} / {PROBLEM_MAX_LENGTH} characters
            </p>
          </div>
          <FieldError id="problem-error" message={errors.problem?.message} />
        </div>

        <RecipeDisclosure />

        <ConstraintField />

        <div className="flex flex-col items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-11 w-full items-center cursor-pointer justify-center gap-2 rounded-control bg-action px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Diagnosing…
              </>
            ) : (
              <>
                Diagnose my bake
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
          <p className="text-xs text-text-muted">
            No account needed. Just better bakes.
          </p>
        </div>
      </form>
    </div>
  );
}
