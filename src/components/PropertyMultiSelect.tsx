import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { PropertyOption } from "@/lib/property-options";
import { getPropertyOptionLabel } from "@/lib/property-options";

interface PropertyMultiSelectProps {
  options: PropertyOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PropertyMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options",
  disabled = false,
}: PropertyMultiSelectProps) {
  const toggleValue = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }

    onChange([...value, optionValue]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-9 w-full justify-between border-border bg-muted/30 px-3 py-2 text-left font-normal"
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1">
            {value.length > 0 ? (
              value.map((item) => (
                <Badge key={item} variant="secondary" className="font-normal">
                  {getPropertyOptionLabel(options, item)}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2" align="start">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => toggleValue(option.value)}
              >
                <Checkbox checked={checked} />
                <span className="flex-1">{option.label}</span>
                {checked && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
