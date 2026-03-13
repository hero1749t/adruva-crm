import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PropertyMultiSelect } from "@/components/PropertyMultiSelect";

type Option = {
  label: string;
  value: string;
};

interface InlineEditableCellProps {
  value: unknown;
  type?: "text" | "number" | "currency" | "date" | "select" | "multi_select" | "email" | "phone" | "url" | "checkbox";
  options?: Option[];
  editable?: boolean;
  placeholder?: string;
  onSave?: (value: unknown) => Promise<void> | void;
  className?: string;
}

function formatValue(value: unknown, type: InlineEditableCellProps["type"]) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (type === "currency") return `₹${Number(value || 0).toLocaleString("en-IN")}`;
  if (type === "date") return String(value).slice(0, 10);
  if (type === "checkbox") return value ? "Yes" : "No";
  return String(value);
}

export function InlineEditableCell({
  value,
  type = "text",
  options = [],
  editable = false,
  placeholder,
  onSave,
  className,
}: InlineEditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(Array.isArray(value) ? value : value ?? (type === "checkbox" ? false : ""));
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(Array.isArray(value) ? value : value ?? (type === "checkbox" ? false : ""));
    setEditing(true);
  };

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing && editable) {
    return (
      <div className={`flex items-center gap-1 ${className || ""}`} onClick={(e) => e.stopPropagation()}>
        {type === "select" ? (
          <Select value={String(draft || "")} onValueChange={(next) => setDraft(next)}>
            <SelectTrigger className="h-8 min-w-[120px]"><SelectValue placeholder={placeholder || "Select"} /></SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === "multi_select" ? (
          <div className="min-w-[180px]">
            <PropertyMultiSelect
              options={options}
              value={Array.isArray(draft) ? (draft as string[]) : []}
              onChange={(next) => setDraft(next)}
              placeholder={placeholder || "Select"}
            />
          </div>
        ) : type === "checkbox" ? (
          <Checkbox checked={Boolean(draft)} onCheckedChange={(next) => setDraft(Boolean(next))} />
        ) : (
          <Input
            type={type === "number" || type === "currency" ? "number" : type === "date" ? "date" : "text"}
            value={type === "checkbox" ? "" : String(draft ?? "")}
            onChange={(e) => setDraft(type === "number" || type === "currency" ? e.target.value : e.target.value)}
            className="h-8 min-w-[120px]"
          />
        )}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={saving} onClick={save}>
          <Check className="h-3.5 w-3.5 text-success" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={saving} onClick={() => setEditing(false)}>
          <X className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  if (type === "url" && value) {
    return (
      <div className={`group flex items-center gap-1 ${className || ""}`} onClick={(e) => e.stopPropagation()}>
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
          {String(value)}
        </a>
        {editable && (
          <button type="button" onClick={startEditing} className="opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  if (type === "email" && value) {
    return (
      <div className={`group flex items-center gap-1 ${className || ""}`} onClick={(e) => e.stopPropagation()}>
        <a href={`mailto:${String(value)}`} className="truncate text-primary hover:underline">
          {String(value)}
        </a>
        {editable && (
          <button type="button" onClick={startEditing} className="opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  if (type === "phone" && value) {
    return (
      <div className={`group flex items-center gap-1 ${className || ""}`} onClick={(e) => e.stopPropagation()}>
        <a href={`tel:${String(value)}`} className="truncate text-foreground hover:text-primary">
          {String(value)}
        </a>
        {editable && (
          <button type="button" onClick={startEditing} className="opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-1 ${className || ""}`} onClick={(e) => e.stopPropagation()}>
      <span className="truncate">{formatValue(value, type)}</span>
      {editable && (
        <button type="button" onClick={startEditing} className="opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
