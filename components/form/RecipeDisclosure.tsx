"use client";

import { ChevronDown } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { FieldError } from "@/components/form/FieldError";
import type { DiagnosisInput } from "@/lib/ai/schema";

export function RecipeDisclosure() {
  const {
    register,
    formState: { errors },
  } = useFormContext<DiagnosisInput>();
  const recipeErrorId = errors.recipe ? "recipe-error" : undefined;
  const technicalDetailsErrorId = errors.technicalDetails
    ? "technicalDetails-error"
    : undefined;

  return (
    <details className="group rounded-control border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-control px-4 py-2.5 text-sm font-semibold text-text-primary marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action [&::-webkit-details-marker]:hidden">
        <span>
          Add your recipe{" "}
          <span className="font-normal text-text-muted">(optional)</span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="recipe"
            className="text-sm font-medium text-text-primary"
          >
            Recipe
          </label>
          <textarea
            id="recipe"
            rows={4}
            aria-invalid={!!errors.recipe}
            aria-describedby={recipeErrorId}
            placeholder="Paste the ingredients and method you used"
            className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            {...register("recipe")}
          />
          <FieldError id="recipe-error" message={errors.recipe?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="technicalDetails"
            className="text-sm font-medium text-text-primary"
          >
            Technical details
          </label>
          <textarea
            id="technicalDetails"
            rows={3}
            aria-invalid={!!errors.technicalDetails}
            aria-describedby={technicalDetailsErrorId}
            placeholder="Oven temperature, altitude, humidity, equipment, or anything else that might matter"
            className="rounded-control border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            {...register("technicalDetails")}
          />
          <FieldError
            id="technicalDetails-error"
            message={errors.technicalDetails?.message}
          />
        </div>
      </div>
    </details>
  );
}
