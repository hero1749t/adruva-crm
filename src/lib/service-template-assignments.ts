import { supabase } from "@/integrations/supabase/client";

interface ApplyServiceTemplateArgs {
  clientId: string;
  templateId: string;
  assignedManager?: string | null;
  appliedBy?: string | null;
  businessName?: string | null;
}

export async function applyServiceTemplateToClient({
  clientId,
  templateId,
  assignedManager,
  appliedBy,
  businessName,
}: ApplyServiceTemplateArgs) {
  const { data: template, error: templateError } = await supabase
    .from("service_templates")
    .select("id, name")
    .eq("id", templateId)
    .single();

  if (templateError) {
    throw templateError;
  }

  const { data: existingAssignment, error: assignmentLookupError } = await supabase
    .from("client_service_template_assignments")
    .select("id")
    .eq("client_id", clientId)
    .eq("service_template_id", templateId)
    .maybeSingle();

  if (assignmentLookupError) {
    throw assignmentLookupError;
  }

  if (existingAssignment) {
    throw new Error(`"${template.name}" is already assigned to this client`);
  }

  const { data: steps, error: stepsError } = await supabase
    .from("service_template_steps")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order");

  if (stepsError) {
    throw stepsError;
  }

  if (!steps || steps.length === 0) {
    throw new Error("No steps found in this service template");
  }

  const { error: assignmentError } = await supabase
    .from("client_service_template_assignments")
    .insert({
      client_id: clientId,
      service_template_id: templateId,
      assigned_by: appliedBy || null,
      assignment_name: template.name,
      is_active: true,
    });

  if (assignmentError) {
    throw assignmentError;
  }

  const now = new Date();
  const tasks = steps.map((step) => ({
    client_id: clientId,
    task_title: step.title,
    priority: (step.priority || "medium") as "urgent" | "high" | "medium" | "low",
    deadline: new Date(now.getTime() + (step.deadline_offset_days || 7) * 86400000).toISOString(),
    assigned_to: assignedManager || null,
    status: "pending" as const,
    notes: step.description || null,
    business_name: businessName || null,
    service_template_id: templateId,
    service_template_name: template.name,
  }));

  const { error: taskError } = await supabase.from("tasks").insert(tasks);
  if (taskError) {
    throw taskError;
  }

  return {
    template,
    tasksCreated: tasks.length,
  };
}
