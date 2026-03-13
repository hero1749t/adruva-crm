import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyOption {
  label: string;
  value: string;
  color?: string;
}

type PropertyKey = "source" | "business_type" | "service_interest";
type EntityType = "lead" | "client";

interface PropertyFieldSeed {
  label: string;
  fieldKey: string;
  fieldType: "select" | "multi_select";
  options: PropertyOption[];
}

const leadSourceOptions: PropertyOption[] = [
  { label: "Cold Outreach", value: "cold_outreach" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "Website", value: "website" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Google", value: "google" },
  { label: "Referral", value: "referral" },
];

const businessTypeOptions: PropertyOption[] = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Salon", value: "salon" },
  { label: "Gym", value: "gym" },
  { label: "Clinic", value: "clinic" },
  { label: "Real Estate", value: "real_estate" },
  { label: "Travel Agency", value: "travel_agency" },
  { label: "Beauty & Spa", value: "beauty_spa" },
  { label: "Retail Store", value: "retail_store" },
  { label: "Local Service Business", value: "local_service_business" },
  { label: "Other", value: "other" },
];

const serviceInterestOptions: PropertyOption[] = [
  { label: "Digital Marketing", value: "digital_marketing" },
  { label: "Website Development", value: "website_development" },
  { label: "Google Ads Management", value: "google_ads_management" },
  { label: "Meta Ads Management", value: "meta_ads_management" },
  { label: "Search Engine Optimization (SEO)", value: "seo" },
  { label: "CRM & Automation Systems", value: "crm_automation_systems" },
];

export const SYSTEM_PROPERTY_FIELD_SEEDS: Record<EntityType, Record<PropertyKey, PropertyFieldSeed>> = {
  lead: {
    source: {
      label: "Source",
      fieldKey: "source",
      fieldType: "select",
      options: leadSourceOptions,
    },
    business_type: {
      label: "Business Type",
      fieldKey: "business_type",
      fieldType: "select",
      options: businessTypeOptions,
    },
    service_interest: {
      label: "Service Interest",
      fieldKey: "service_interest",
      fieldType: "multi_select",
      options: serviceInterestOptions,
    },
  },
  client: {
    source: {
      label: "Source",
      fieldKey: "source",
      fieldType: "select",
      options: leadSourceOptions,
    },
    business_type: {
      label: "Business Type",
      fieldKey: "business_type",
      fieldType: "select",
      options: businessTypeOptions,
    },
    service_interest: {
      label: "Service Interested",
      fieldKey: "services",
      fieldType: "multi_select",
      options: serviceInterestOptions,
    },
  },
};

function normalizeOptions(options: unknown, fallback: PropertyOption[]) {
  if (!Array.isArray(options) || options.length === 0) return fallback;
  return options.map((option) => {
    if (typeof option === "object" && option !== null) {
      const label = String((option as any).label ?? (option as any).value ?? "");
      const value = String((option as any).value ?? (option as any).label ?? "");
      return {
        label,
        value,
        color: typeof (option as any).color === "string" ? (option as any).color : undefined,
      };
    }
    const raw = String(option);
    return { label: raw, value: raw };
  });
}

export function formatPropertyValue(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getPropertyOptionLabel(options: PropertyOption[], value: string | null | undefined) {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label || formatPropertyValue(value);
}

export function getPropertyOptionLabels(options: PropertyOption[], values: string[] | null | undefined) {
  if (!Array.isArray(values) || values.length === 0) return [];
  return values.map((value) => getPropertyOptionLabel(options, value)).filter(Boolean);
}

export function useEntityPropertyOptions(entityType: EntityType) {
  const config = SYSTEM_PROPERTY_FIELD_SEEDS[entityType];

  const { data = [] } = useQuery({
    queryKey: ["entity-property-options", entityType],
    queryFn: async () => {
      const fieldKeys = Object.values(config).map((item) => item.fieldKey);
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .select("field_key, options")
        .eq("entity_type", entityType)
        .in("field_key", fieldKeys);

      if (error) {
        return [];
      }

      return data || [];
    },
  });

  const definitionsByKey = new Map(data.map((definition) => [definition.field_key, definition.options]));

  return {
    sourceOptions: normalizeOptions(definitionsByKey.get(config.source.fieldKey), config.source.options),
    businessTypeOptions: normalizeOptions(definitionsByKey.get(config.business_type.fieldKey), config.business_type.options),
    serviceInterestOptions: normalizeOptions(definitionsByKey.get(config.service_interest.fieldKey), config.service_interest.options),
  };
}
