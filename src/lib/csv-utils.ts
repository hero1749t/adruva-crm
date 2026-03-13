import { supabase } from "@/integrations/supabase/client";
import type { CustomFieldDef } from "@/hooks/useCustomFields";
import { isMissingRelationError } from "@/lib/supabase-errors";

const CSV_HEADERS = [
  "name",
  "email",
  "phone",
  "company_name",
  "source",
  "service_interest",
  "business_type",
  "budget",
  "status",
  "notes",
] as const;

const REQUIRED_FIELDS = ["name", "email", "phone"] as const;

const BUDGET_MAP: Record<string, string> = {
  "5k_10k": "5k_10k", "10k_25k": "10k_25k", "25k_50k": "25k_50k", "50k_1l": "50k_1l", "1l_plus": "1l_plus",
};

const STATUS_MAP: Record<string, string> = {
  "new_lead": "new_lead", "new lead": "new_lead",
  "audit_booked": "audit_booked", "free audit booked": "audit_booked", "audit booked": "audit_booked",
  "audit_done": "audit_done", "audit done": "audit_done",
  "in_progress": "in_progress", "in progress": "in_progress",
  "lead_won": "lead_won", "lead won": "lead_won",
  "lead_lost": "lead_lost", "lead lost": "lead_lost",
};

const SOURCE_MAP: Record<string, string> = {
  "website_form": "website_form", "website": "website_form",
  "whatsapp": "whatsapp",
  "facebook_ads": "facebook_ads", "facebook": "facebook_ads",
  "google_ads": "google_ads", "google ads": "google_ads",
  "instagram": "instagram",
  "referral": "referral",
  "cold_call": "cold_call", "cold call": "cold_call",
  "manual_entry": "manual_entry", "manual entry": "manual_entry",
};

const BUSINESS_TYPE_MAP: Record<string, string> = {
  "restaurant": "restaurant", "clinic": "clinic", "real_estate": "real_estate", "real estate": "real_estate",
  "ecommerce": "ecommerce", "education": "education", "gym_fitness": "gym_fitness", "gym": "gym_fitness",
  "salon": "salon", "local_shop": "local_shop", "local shop": "local_shop", "corporate": "corporate", "other": "other",
};

function mapEnum(value: string | undefined, map: Record<string, string>): string | null {
  if (!value?.trim()) return null;
  return map[value.trim().toLowerCase()] || null;
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

export function exportLeadsCsv(
  leads: any[],
  customFieldDefs: CustomFieldDef[] = [],
  customFieldValues: Record<string, Record<string, string>> = {}
) {
  const allHeaders = [...CSV_HEADERS, ...customFieldDefs.map((d) => d.field_key)];
  const headerRow = allHeaders.map((h) => escapeCsvField(h)).join(",");
  const rows = leads.map((lead) => {
    const baseCols = CSV_HEADERS.map((h) => escapeCsvField(String(lead[h] ?? "")));
    const customCols = customFieldDefs.map((def) =>
      escapeCsvField(customFieldValues[lead.id]?.[def.id] || "")
    );
    return [...baseCols, ...customCols].join(",");
  });
  const csv = [headerRow, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportClientsCsv(
  clients: any[],
  customFieldDefs: CustomFieldDef[] = [],
  customFieldValues: Record<string, Record<string, string>> = {}
) {
  const baseHeaders = ["client_name", "company_name", "email", "phone", "plan", "status", "billing_status", "monthly_payment", "start_date", "contract_end_date"];
  const allHeaders = [...baseHeaders, ...customFieldDefs.map((d) => d.field_key)];
  const headerRow = allHeaders.map((h) => escapeCsvField(h)).join(",");
  const rows = clients.map((client) => {
    const baseCols = baseHeaders.map((h) => escapeCsvField(String(client[h] ?? "")));
    const customCols = customFieldDefs.map((def) =>
      escapeCsvField(customFieldValues[client.id]?.[def.id] || "")
    );
    return [...baseCols, ...customCols].join(",");
  });
  const csv = [headerRow, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `clients-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  success: number;
  errors: { row: number; message: string }[];
}

export async function importLeadsCsv(file: File): Promise<ImportResult> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    return { success: 0, errors: [{ row: 0, message: "CSV file is empty or has no data rows" }] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const missingRequired = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
  if (missingRequired.length > 0) {
    return {
      success: 0,
      errors: [{ row: 0, message: `Missing required columns: ${missingRequired.join(", ")}` }],
    };
  }

  // Detect custom field columns (not in base headers)
  const baseHeaderSet = new Set<string>([...CSV_HEADERS]);
  const customHeaders = headers.filter((h) => !baseHeaderSet.has(h));

  // Fetch custom field definitions for mapping
  let customFieldMap: Record<string, string> = {}; // field_key -> def id
  if (customHeaders.length > 0) {
    const { data: defs, error } = await supabase
      .from("custom_field_definitions")
      .select("id, field_key")
      .eq("entity_type", "lead")
      .in("field_key", customHeaders);
    if (error && !isMissingRelationError(error, "custom_field_definitions")) {
      throw error;
    }
    for (const def of defs || []) {
      customFieldMap[def.field_key] = def.id;
    }
  }

  const result: ImportResult = { success: 0, errors: [] };
  const validLeads: Record<string, any>[] = [];
  const customValuesPerLead: Record<string, string>[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });

    const rowErrors: string[] = [];
    if (!row.name?.trim()) rowErrors.push("name is required");
    if (!row.email?.trim()) rowErrors.push("email is required");
    if (!row.phone?.trim()) rowErrors.push("phone is required");

    if (rowErrors.length > 0) {
      result.errors.push({ row: i + 1, message: rowErrors.join("; ") });
      continue;
    }

    validLeads.push({
      name: row.name.trim(),
      email: row.email.trim(),
      phone: row.phone.trim(),
      company_name: row.company_name?.trim() || null,
      source: mapEnum(row.source, SOURCE_MAP),
      service_interest: row.service_interest?.trim() ? row.service_interest.trim().split(";").map(s => s.trim()) : null,
      business_type: mapEnum(row.business_type, BUSINESS_TYPE_MAP),
      budget: mapEnum(row.budget, BUDGET_MAP),
      status: mapEnum(row.status, STATUS_MAP) || "new_lead",
      notes: row.notes?.trim() || null,
    });

    // Collect custom field values for this row
    const cfValues: Record<string, string>[] = [];
    for (const h of customHeaders) {
      const defId = customFieldMap[h];
      if (defId && row[h]?.trim()) {
        cfValues.push({ defId, value: row[h].trim() });
      }
    }
    customValuesPerLead.push(cfValues);
  }

  // Batch insert in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < validLeads.length; i += CHUNK_SIZE) {
    const chunk = validLeads.slice(i, i + CHUNK_SIZE);
    const { data: inserted, error } = await supabase
      .from("leads")
      .upsert(chunk as any, { onConflict: "email", ignoreDuplicates: true })
      .select("id");
    if (error) {
      result.errors.push({
        row: i + 2,
        message: `Batch insert failed: ${error.message}`,
      });
    } else {
      result.success += chunk.length;

      // Insert custom field values for inserted leads
      if (inserted) {
        const cfInserts: any[] = [];
        for (let j = 0; j < inserted.length; j++) {
          const leadIdx = i + j;
          const cfValues = customValuesPerLead[leadIdx] || [];
          for (const cf of cfValues) {
            cfInserts.push({
              entity_type: "lead",
              entity_id: inserted[j].id,
              field_definition_id: cf.defId,
              value: cf.value,
            });
          }
        }
        if (cfInserts.length > 0) {
          const { error } = await supabase.from("custom_field_values").insert(cfInserts);
          if (error && !isMissingRelationError(error, "custom_field_values")) {
            throw error;
          }
        }
      }
    }
  }

  return result;
}

export async function downloadCsvTemplate() {
  // Fetch custom field definitions for leads dynamically
  const { data: customDefs, error } = await supabase
    .from("custom_field_definitions")
    .select("field_key")
    .eq("entity_type", "lead")
    .eq("is_visible", true)
    .order("sort_order");
  if (error && !isMissingRelationError(error, "custom_field_definitions")) {
    throw error;
  }

  const allHeaders = [...CSV_HEADERS, ...(customDefs || []).map((d) => d.field_key)];
  const sampleRow = ["John Doe", "john@example.com", "+1234567890", "Acme Corp", "google", "SEO;PPC", "restaurant", "10k_25k", "", "Initial contact", ...(customDefs || []).map(() => "")];
  const csv = allHeaders.join(",") + "\n" + sampleRow.join(",");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "leads-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}
