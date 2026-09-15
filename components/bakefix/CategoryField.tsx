import { Chip } from "@/components/bakefix/Chip";

const PASTRY_CATEGORIES = [
  "Cake",
  "Cookies",
  "Bread",
  "Choux",
  "Cream",
  "Other",
] as const;

export function CategoryField() {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-text-primary">
        What are you baking?
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {PASTRY_CATEGORIES.map((category) => (
          <Chip
            key={category}
            type="radio"
            name="category"
            value={category}
            label={category}
          />
        ))}
      </div>
    </fieldset>
  );
}
