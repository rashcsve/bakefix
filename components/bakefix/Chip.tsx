type ChipProps = {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
};

export function Chip({ type, name, value, label, defaultChecked }: ChipProps) {
  return (
    <label className="has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-action inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors has-checked:border-action has-checked:bg-action has-checked:text-white">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {label}
    </label>
  );
}
