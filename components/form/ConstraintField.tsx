"use client";

import { useFormContext } from "react-hook-form";
import { Chip } from "@/components/form/Chip";
import { FieldError } from "@/components/form/FieldError";
import { DIETARY_CONSTRAINTS } from "@/lib/constants";
import type { BakeFormValues } from "@/lib/schemas/bake-form";

export function ConstraintField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<BakeFormValues>();
  const errorId = errors.constraints ? "constraints-error" : undefined;

  return (
    <fieldset aria-describedby={errorId}>
      <legend className="text-sm font-semibold text-text-primary">
        Any dietary constraints?
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {DIETARY_CONSTRAINTS.map((constraint) => (
          <Chip
            key={constraint}
            type="checkbox"
            value={constraint}
            label={constraint}
            {...register("constraints")}
          />
        ))}
      </div>
      <FieldError
        id="constraints-error"
        message={errors.constraints?.message}
      />
    </fieldset>
  );
}
