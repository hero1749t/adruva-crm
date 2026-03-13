import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InlineEditableCell } from "@/components/InlineEditableCell";
import { supabase } from "@/integrations/supabase/client";
import type { CustomFieldDef } from "@/hooks/useCustomFields";
import { formatCustomFieldValue } from "@/hooks/useCustomFields";
import { useToast } from "@/hooks/use-toast";

interface CustomFieldTableCellProps {
  entityType: "lead" | "client";
  entityId: string;
  definition: CustomFieldDef;
  rawValue: unknown;
  editable?: boolean;
}

function fieldTypeToEditorType(fieldType: string) {
  switch (fieldType) {
    case "number":
      return "number";
    case "currency":
      return "currency";
    case "date":
      return "date";
    case "select":
      return "select";
    case "multi_select":
      return "multi_select";
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "url":
      return "url";
    case "checkbox":
      return "checkbox";
    default:
      return "text";
  }
}

function normalizeSaveValue(fieldType: string, value: unknown) {
  if (fieldType === "multi_select") {
    return Array.isArray(value) ? value : [];
  }
  if (fieldType === "checkbox") {
    return Boolean(value);
  }
  if (fieldType === "number" || fieldType === "currency") {
    return value === "" || value == null ? null : Number(value);
  }
  const stringValue = String(value ?? "").trim();
  return stringValue === "" ? null : stringValue;
}

export function CustomFieldTableCell({
  entityType,
  entityId,
  definition,
  rawValue,
  editable = false,
}: CustomFieldTableCellProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const upsertMutation = useMutation({
    mutationFn: async (nextValue: unknown) => {
      const normalizedValue = normalizeSaveValue(definition.field_type, nextValue);
      const { data: existing, error: lookupError } = await supabase
        .from("custom_field_values")
        .select("id")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("field_definition_id", definition.id)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existing?.id) {
        const { error } = await supabase
          .from("custom_field_values")
          .update({ value: normalizedValue as any, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("custom_field_values")
          .insert({
            entity_type: entityType,
            entity_id: entityId,
            field_definition_id: definition.id,
            value: normalizedValue as any,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-values-bulk-raw", entityType] });
      queryClient.invalidateQueries({ queryKey: ["custom-field-values-bulk", entityType] });
      queryClient.invalidateQueries({ queryKey: ["custom-field-values", entityType, entityId] });
      toast({ title: `${definition.label} updated` });
    },
    onError: (err: Error) => {
      toast({ title: "Custom field update failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <InlineEditableCell
      value={rawValue ?? formatCustomFieldValue(rawValue)}
      type={fieldTypeToEditorType(definition.field_type) as any}
      options={Array.isArray(definition.options)
        ? definition.options.map((option: any) => ({
            value: typeof option === "object" && option !== null ? String(option.value ?? option.label ?? option) : String(option),
            label: typeof option === "object" && option !== null ? String(option.label ?? option.value ?? option) : String(option),
          }))
        : []}
      editable={editable}
      onSave={(nextValue) => upsertMutation.mutateAsync(nextValue)}
      className="max-w-[220px]"
    />
  );
}
