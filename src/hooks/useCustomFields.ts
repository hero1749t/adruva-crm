import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isMissingRelationError } from "@/lib/supabase-errors";

export interface CustomFieldDef {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  entity_type: string;
  options: any;
  is_visible: boolean;
  sort_order: number;
}

export function formatCustomFieldValue(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "object") {
    return (raw as any).value ?? (raw as any).label ?? JSON.stringify(raw);
  }
  return String(raw).replace(/^"|"$/g, "");
}

export function useCustomFieldDefs(entityType: "lead" | "client") {
  return useQuery({
    queryKey: ["custom-field-defs", entityType],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("entity_type", entityType)
        .eq("is_visible", true)
        .order("sort_order");
      if (error) {
        if (isMissingRelationError(error, "custom_field_definitions")) {
          return [];
        }
        throw error;
      }
      return (data || []) as CustomFieldDef[];
    },
  });
}

export function useCustomFieldValuesRaw(entityType: "lead" | "client", entityIds: string[]) {
  return useQuery({
    queryKey: ["custom-field-values-bulk-raw", entityType, entityIds],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (entityIds.length === 0) return {};
      const { data, error } = await supabase
        .from("custom_field_values")
        .select("entity_id, field_definition_id, value")
        .eq("entity_type", entityType)
        .in("entity_id", entityIds);
      if (error) {
        if (isMissingRelationError(error, "custom_field_values")) {
          return {};
        }
        throw error;
      }

      // Map: entityId -> { defId -> value }
      const map: Record<string, Record<string, unknown>> = {};
      for (const row of data || []) {
        if (!map[row.entity_id]) map[row.entity_id] = {};
        map[row.entity_id][row.field_definition_id] = row.value;
      }
      return map;
    },
    enabled: entityIds.length > 0,
  });
}

export function useCustomFieldValues(entityType: "lead" | "client", entityIds: string[]) {
  const query = useCustomFieldValuesRaw(entityType, entityIds);

  return {
    ...query,
    data: Object.fromEntries(
      Object.entries(query.data || {}).map(([entityId, fields]) => [
        entityId,
        Object.fromEntries(
          Object.entries(fields).map(([defId, rawValue]) => [defId, formatCustomFieldValue(rawValue)])
        ),
      ])
    ) as Record<string, Record<string, string>>,
  };
}
