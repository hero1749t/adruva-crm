import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Trash2, Pencil, Loader2, GripVertical, Eye, EyeOff,
  Type, Hash, Calendar, List, Link, Mail, Phone, CheckSquare, DollarSign, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldDefinition {
  id: string;
  entity_type: "lead" | "client";
  field_key: string;
  label: string;
  field_type: string;
  options: { label: string; value: string; color?: string }[];
  is_required: boolean;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text", label: "Text", icon: Type, description: "Single line text" },
  { value: "number", label: "Number", icon: Hash, description: "Numeric value" },
  { value: "currency", label: "Currency", icon: DollarSign, description: "Monetary value" },
  { value: "date", label: "Date", icon: Calendar, description: "Date picker" },
  { value: "select", label: "Select", icon: List, description: "Single choice" },
  { value: "multi_select", label: "Multi Select", icon: Tag, description: "Multiple choices" },
  { value: "url", label: "URL", icon: Link, description: "Web address" },
  { value: "email", label: "Email", icon: Mail, description: "Email address" },
  { value: "phone", label: "Phone", icon: Phone, description: "Phone number" },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare, description: "True / False toggle" },
];

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  number: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  currency: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  date: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  select: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  multi_select: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  url: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  email: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  phone: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  checkbox: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const OPTION_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

function toFieldKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// ─── Field Form ───────────────────────────────────────────────────────────────

function FieldForm({
  entityType,
  initial,
  onSubmit,
  isPending,
  onClose,
}: {
  entityType: "lead" | "client";
  initial?: FieldDefinition | null;
  onSubmit: (data: Omit<FieldDefinition, "id" | "created_at">) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [fieldType, setFieldType] = useState(initial?.field_type ?? "text");
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);
  const [options, setOptions] = useState<{ label: string; value: string; color?: string }[]>(
    initial?.options ?? []
  );
  const [newOption, setNewOption] = useState("");
  const [selectedColor, setSelectedColor] = useState(OPTION_COLORS[0]);

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    setOptions(prev => [...prev, { label: trimmed, value: toFieldKey(trimmed), color: selectedColor }]);
    setNewOption("");
  };

  const needsOptions = fieldType === "select" || fieldType === "multi_select";

  const handleSubmit = () => {
    if (!label.trim()) return;
    onSubmit({
      entity_type: entityType,
      field_key: initial?.field_key ?? toFieldKey(label),
      label: label.trim(),
      field_type: fieldType,
      options: needsOptions ? options : [],
      is_required: isRequired,
      is_visible: initial?.is_visible ?? true,
      sort_order: initial?.sort_order ?? 999,
    });
  };

  const FieldIcon = FIELD_TYPES.find(f => f.value === fieldType)?.icon ?? Type;

  return (
    <div className="space-y-5 pt-2">
      {/* Field type picker */}
      <div className="space-y-1.5">
        <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Field Type
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {FIELD_TYPES.map((ft) => {
            const Icon = ft.icon;
            return (
              <button
                key={ft.value}
                type="button"
                onClick={() => setFieldType(ft.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all",
                  fieldType === ft.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"
                )}
                title={ft.description}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] leading-tight">{ft.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Field Label <span className="text-destructive">*</span>
        </label>
        <div className="flex items-center gap-2">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", FIELD_TYPE_COLORS[fieldType] ?? "")}>
            <FieldIcon className="h-4 w-4" />
          </div>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Project Budget, Property Type…"
            className="border-border bg-muted/30"
          />
        </div>
        {label && (
          <p className="text-[10px] text-muted-foreground">
            Key: <code className="rounded bg-muted px-1">{toFieldKey(label)}</code>
          </p>
        )}
      </div>

      {/* Options (for select types) */}
      {needsOptions && (
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Options
          </label>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {OPTION_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform",
                    selectedColor === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Input
              value={newOption}
              onChange={e => setNewOption(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addOption()}
              placeholder="Add option…"
              className="border-border bg-muted/30 flex-1"
            />
            <Button type="button" size="sm" variant="outline" onClick={addOption} className="shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {options.map((opt, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: opt.color ?? "#6b7280" }}
              >
                {opt.label}
                <button onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))} type="button">
                  <span className="opacity-70 hover:opacity-100">×</span>
                </button>
              </span>
            ))}
            {options.length === 0 && (
              <span className="text-xs text-muted-foreground italic">No options yet</span>
            )}
          </div>
        </div>
      )}

      {/* Required toggle */}
      <label className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Required field</p>
          <p className="text-xs text-muted-foreground">Force users to fill this before saving</p>
        </div>
        <Switch checked={isRequired} onCheckedChange={setIsRequired} />
      </label>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1 gap-2"
          onClick={handleSubmit}
          disabled={isPending || !label.trim()}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? "Save Changes" : "Add Field"}
        </Button>
      </div>
    </div>
  );
}

// ─── Field Card ───────────────────────────────────────────────────────────────

function FieldCard({
  field,
  onEdit,
  onDelete,
  onToggleVisibility,
}: {
  field: FieldDefinition;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}) {
  const ft = FIELD_TYPES.find(f => f.value === field.field_type);
  const Icon = ft?.icon ?? Type;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab" />
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", FIELD_TYPE_COLORS[field.field_type] ?? "")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{field.label}</span>
          {field.is_required && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-destructive border-destructive/30">
              Required
            </Badge>
          )}
          {!field.is_visible && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Hidden</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge className={cn("h-4 px-1.5 text-[9px] border", FIELD_TYPE_COLORS[field.field_type] ?? "")}>
            {ft?.label ?? field.field_type}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">{field.field_key}</span>
          {field.options.length > 0 && (
            <div className="flex gap-1">
              {field.options.slice(0, 4).map((opt, i) => (
                <span
                  key={i}
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                  style={{ backgroundColor: opt.color ?? "#6b7280" }}
                >
                  {opt.label}
                </span>
              ))}
              {field.options.length > 4 && (
                <span className="text-[10px] text-muted-foreground">+{field.options.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleVisibility} title={field.is_visible ? "Hide" : "Show"}>
          {field.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{field.label}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the field and all its values across all records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomFieldsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"lead" | "client">("lead");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["custom-field-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        options: (d.options as any[]) ?? [],
      })) as FieldDefinition[];
    },
  });

  const leadFields = fields.filter(f => f.entity_type === "lead");
  const clientFields = fields.filter(f => f.entity_type === "client");
  const activeFields = activeTab === "lead" ? leadFields : clientFields;

  const createField = useMutation({
    mutationFn: async (data: Omit<FieldDefinition, "id" | "created_at">) => {
      const { error } = await supabase.from("custom_field_definitions").insert({
        ...data,
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions"] });
      toast({ title: "Field added" });
      setCreateOpen(false);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FieldDefinition> }) => {
      const { error } = await supabase
        .from("custom_field_definitions")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions"] });
      toast({ title: "Field updated" });
      setEditingField(null);
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_field_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions"] });
      toast({ title: "Field deleted" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Custom Fields</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add custom properties to leads and clients — like Notion for your CRM
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Field
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">
                Add Custom Field · {activeTab === "lead" ? "Leads" : "Clients"}
              </DialogTitle>
            </DialogHeader>
            <FieldForm
              entityType={activeTab}
              onSubmit={data => createField.mutate(data)}
              isPending={createField.isPending}
              onClose={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Custom fields</span> appear on lead and client detail pages. 
          Use <span className="font-medium text-foreground">Select / Multi-Select</span> for dropdowns like "Property Type", "Service Package", 
          or <span className="font-medium text-foreground">Text / Number</span> for details like "Budget Range", "Website URL", "GST Number".
        </p>
      </div>

      {/* Edit dialog */}
      {editingField && (
        <Dialog open={!!editingField} onOpenChange={o => { if (!o) setEditingField(null); }}>
          <DialogContent className="border-border bg-card sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">Edit Field</DialogTitle>
            </DialogHeader>
            <FieldForm
              entityType={editingField.entity_type}
              initial={editingField}
              onSubmit={data => updateField.mutate({ id: editingField.id, data })}
              isPending={updateField.isPending}
              onClose={() => setEditingField(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "lead" | "client")}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="lead" className="gap-2">
            👤 Leads
            <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">{leadFields.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="client" className="gap-2">
            🏢 Clients
            <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">{clientFields.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {(["lead", "client"] as const).map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/20" />
              ))
            ) : activeFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">No custom fields yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add fields like "Property Type", "Budget", "GST Number", "Website URL"…
                </p>
                <Button size="sm" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> Add First Field
                </Button>
              </div>
            ) : (
              activeFields.map(field => (
                <FieldCard
                  key={field.id}
                  field={field}
                  onEdit={() => setEditingField(field)}
                  onDelete={() => deleteField.mutate(field.id)}
                  onToggleVisibility={() =>
                    updateField.mutate({ id: field.id, data: { is_visible: !field.is_visible } })
                  }
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Field type reference */}
      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Available Field Types
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FIELD_TYPES.map(ft => {
            const Icon = ft.icon;
            return (
              <div
                key={ft.value}
                className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5", FIELD_TYPE_COLORS[ft.value] ?? "")}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold leading-tight">{ft.label}</p>
                  <p className="text-[10px] opacity-70">{ft.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
