import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Pencil, Check, X, Tags } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CustomFieldsSectionProps {
  entityType: "lead" | "client";
  entityId: string;
}

interface FieldDefinition {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  options: any;
  is_required: boolean;
  is_visible: boolean;
  sort_order: number;
}

export function CustomFieldsSection({ entityType, entityId }: CustomFieldsSectionProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: definitions = [] } = useQuery({
    queryKey: ["custom-field-defs", entityType],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("entity_type", entityType)
        .eq("is_visible", true)
        .order("sort_order");
      return (data || []) as FieldDefinition[];
    },
  });

  const { data: values = [] } = useQuery({
    queryKey: ["custom-field-values", entityType, entityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_field_values")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      return data || [];
    },
    enabled: !!entityId,
  });

  const upsertValue = useMutation({
    mutationFn: async ({ defId, value }: { defId: string; value: string }) => {
      const existing = values.find((v) => v.field_definition_id === defId);
      if (existing) {
        const { error } = await supabase
          .from("custom_field_values")
          .update({ value: value as any, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("custom_field_values").insert({
          entity_type: entityType,
          entity_id: entityId,
          field_definition_id: defId,
          value: value as any,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-values", entityType, entityId] });
      toast({ title: "Field updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  if (definitions.length === 0) return null;

  const getFieldValue = (defId: string): string => {
    const v = values.find((val) => val.field_definition_id === defId);
    if (v?.value == null) return "";
    const raw = v.value;
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      return (raw as any).value ?? (raw as any).label ?? JSON.stringify(raw);
    }
    return String(raw).replace(/^"|"$/g, "");
  };

  const startEdit = (defId: string) => {
    setEditingField(defId);
    setEditValue(getFieldValue(defId));
  };

  const saveEdit = (defId: string) => {
    upsertValue.mutate({ defId, value: editValue });
    setEditingField(null);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-widest text-primary flex items-center gap-1.5">
        <Tags className="h-3.5 w-3.5" /> Custom Fields
      </h2>
      <div className="space-y-0.5">
        {definitions.map((def) => {
          const currentValue = getFieldValue(def.id);
          const isEditing = editingField === def.id;
          const isSelect = def.field_type === "select" || def.field_type === "multi_select";
          const options: string[] = Array.isArray(def.options) ? def.options : [];

          return (
            <div key={def.id} className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
              <Tags className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {def.label}
                </p>
                {isEditing ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    {isSelect ? (
                      <Select value={editValue} onValueChange={(v) => setEditValue(v)}>
                        <SelectTrigger className="h-7 border-border bg-muted/30 text-sm">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={def.field_type === "number" ? "number" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 border-border bg-muted/30 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(def.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => saveEdit(def.id)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelEdit}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-foreground">{currentValue || "—"}</p>
                    {isOwnerOrAdmin && (
                      <button onClick={() => startEdit(def.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                        <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
