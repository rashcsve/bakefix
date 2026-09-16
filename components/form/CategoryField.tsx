"use client";

import { useFormContext } from "react-hook-form";
import { Chip } from "@/components/form/Chip";
import { FieldError } from "@/components/form/FieldError";
import { PASTRY_CATEGORIES } from "@/lib/constants";
import type { BakeFormValues } from "@/lib/schemas/bake-form";

export function CategoryField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<BakeFormValues>();
  const errorId = errors.category ? "category-error" : undefined;

  return (
    <fieldset aria-describedby={errorId}>
      <legend className="text-sm font-semibold text-text-primary">
        What are you baking?
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {PASTRY_CATEGORIES.map((category) => (
          <Chip
            key={category}
            type="radio"
            value={category}
            label={category}
            {...register("category")}
          />
        ))}
      </div>
      <FieldError id="category-error" message={errors.category?.message} />
    </fieldset>
  );
}
