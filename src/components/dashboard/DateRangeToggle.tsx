export type DateRange = "7d" | "30d" | "90d";

interface DateRangeToggleProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const ranges: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

export function DateRangeToggle({ value, onChange }: DateRangeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-xl glass p-1 gap-0.5">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
            value === r.value
              ? "gradient-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
