import { supabase } from "@/integrations/supabase/client";
import type { CustomFieldDef } from "@/hooks/useCustomFields";
import { isMissingRelationError } from "@/lib/supabase-errors";

const CSV_HEADERS = [
  "name",
  "email",
  "phone",
  "company_name",
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

function uniqueFieldKeys(headers: string[]) {
  return headers.filter((header, index) => headers.indexOf(header) === index);
}

function getCustomFieldSampleValue(fieldKey: string) {
  switch (fieldKey) {
    case "source":
      return "google";
    case "service_interest":
      return "seo;google_ads_management";
    case "business_type":
      return "restaurant";
    default:
      return "";
  }
}

export function exportLeadsCsv(
  leads: any[],
  customFieldDefs: CustomFieldDef[] = [],
  customFieldValues: Record<string, Record<string, string>> = {}
) {
  const allHeaders = uniqueFieldKeys([...CSV_HEADERS, ...customFieldDefs.map((d) => d.field_key)]);
  const headerRow = allHeaders.map((h) => escapeCsvField(h)).join(",");
  const rows = leads.map((lead) => {
    const row = allHeaders.map((header) => {
      const matchingDef = customFieldDefs.find((def) => def.field_key === header);
      if (matchingDef) {
        return escapeCsvField(customFieldValues[lead.id]?.[matchingDef.id] || "");
      }
      return escapeCsvField(String(lead[header] ?? ""));
    });
    return row.join(",");
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
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

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

    const normalizedEmail = row.email.trim().toLowerCase();
    const normalizedPhone = row.phone.trim();

    if (seenEmails.has(normalizedEmail)) rowErrors.push("duplicate email in CSV");
    if (seenPhones.has(normalizedPhone)) rowErrors.push("duplicate phone in CSV");

    if (rowErrors.length > 0) {
      result.errors.push({ row: i + 1, message: rowErrors.join("; ") });
      continue;
    }

    seenEmails.add(normalizedEmail);
    seenPhones.add(normalizedPhone);

    validLeads.push({
      name: row.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      company_name: row.company_name?.trim() || null,
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

  if (validLeads.length === 0) {
    return result;
  }

  const existingEmails = Array.from(new Set(validLeads.map((lead) => lead.email).filter(Boolean)));
  const existingPhones = Array.from(new Set(validLeads.map((lead) => lead.phone).filter(Boolean)));
  const existingLeadLookup = new Set<string>();

  if (existingEmails.length > 0 || existingPhones.length > 0) {
    let existingQuery = supabase.from("leads").select("email, phone").eq("is_deleted", false);
    const filters: string[] = [];
    if (existingEmails.length > 0) {
      filters.push(...existingEmails.map((email) => `email.eq.${email}`));
    }
    if (existingPhones.length > 0) {
      filters.push(...existingPhones.map((phone) => `phone.eq.${phone}`));
    }
    if (filters.length > 0) {
      existingQuery = existingQuery.or(filters.join(","));
    }

    const { data: existingLeads, error: existingError } = await existingQuery;
    if (existingError) throw existingError;

    for (const lead of existingLeads || []) {
      if (lead.email) existingLeadLookup.add(`email:${lead.email.toLowerCase()}`);
      if (lead.phone) existingLeadLookup.add(`phone:${lead.phone}`);
    }
  }

  const filteredLeads: Record<string, any>[] = [];
  const filteredCustomValues: Record<string, string>[][] = [];

  validLeads.forEach((lead, index) => {
    const duplicateReasons: string[] = [];
    if (lead.email && existingLeadLookup.has(`email:${lead.email.toLowerCase()}`)) {
      duplicateReasons.push("email already exists");
    }
    if (lead.phone && existingLeadLookup.has(`phone:${lead.phone}`)) {
      duplicateReasons.push("phone already exists");
    }

    if (duplicateReasons.length > 0) {
      result.errors.push({
        row: index + 2,
        message: `duplicate skipped: ${duplicateReasons.join(", ")}`,
      });
      return;
    }

    filteredLeads.push(lead);
    filteredCustomValues.push(customValuesPerLead[index] || []);
  });

  if (filteredLeads.length === 0) {
    return result;
  }

  // Batch insert in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < filteredLeads.length; i += CHUNK_SIZE) {
    const chunk = filteredLeads.slice(i, i + CHUNK_SIZE);
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(chunk as any)
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
          const cfValues = filteredCustomValues[leadIdx] || [];
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

  const allHeaders = uniqueFieldKeys([...CSV_HEADERS, ...(customDefs || []).map((d) => d.field_key)]);
  const sampleValues: Record<string, string> = {
    name: "John Doe",
    email: "john@example.com",
    phone: "+1234567890",
    company_name: "Acme Corp",
    budget: "10k_25k",
    status: "new_lead",
    notes: "Initial contact",
  };
  const sampleRow = allHeaders.map((header) => sampleValues[header] ?? getCustomFieldSampleValue(header));
  const csv = allHeaders.join(",") + "\n" + sampleRow.join(",");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "leads-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}
