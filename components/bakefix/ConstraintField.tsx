import { Chip } from "@/components/bakefix/Chip";

const DIETARY_CONSTRAINTS = ["Egg-free", "Dairy-free", "Gluten-free"] as const;

export function ConstraintField() {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-text-primary">
        Any dietary constraints?
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {DIETARY_CONSTRAINTS.map((constraint) => (
          <Chip
            key={constraint}
            type="checkbox"
            name="constraints"
            value={constraint}
            label={constraint}
          />
        ))}
      </div>
    </fieldset>
  );
}
