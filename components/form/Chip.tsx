import type { ComponentPropsWithRef } from "react";

type ChipProps = {
  type: "radio" | "checkbox";
  value: string;
  label: string;
} & Omit<
  ComponentPropsWithRef<"input">,
  "type" | "value" | "className" | "id" | "children"
>;

export function Chip({ type, value, label, ...inputProps }: ChipProps) {
  return (
    <label className="has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-action inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors has-checked:border-action has-checked:bg-action has-checked:text-white">
      <input type={type} value={value} className="sr-only" {...inputProps} />
      {label}
    </label>
  );
}
