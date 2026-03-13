import { supabase } from "@/integrations/supabase/client";

type AutomationAction = {
  type: string;
  config: Record<string, unknown>;
};

type AutomationRule = {
  id: string;
  name: string;
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;
  actions: AutomationAction[];
  execution_count?: number;
};

type AutomationEntityData = Record<string, unknown> & {
  _entity_type: "lead" | "client" | "task";
};

const today = () => new Date().toISOString().slice(0, 10);

const interpolateTemplate = (template: string, data: Record<string, unknown>) =>
  (template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => String(data?.[key] || ""));

const matchesConditions = (
  conditions: Record<string, unknown>,
  entityData: Record<string, unknown>,
  oldData?: Record<string, unknown>
) => {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  for (const [key, value] of Object.entries(conditions)) {
    if (key === "status_changed_to") {
      if (entityData?.status !== value) return false;
      if (oldData?.status === value) return false;
      continue;
    }

    if (key === "status_changed_from") {
      if (oldData?.status !== value) return false;
      continue;
    }

    if (entityData?.[key] !== value) return false;
  }

  return true;
};

async function insertNotificationsForUsers(userIds: string[], title: string, message: string, taskId?: string | null) {
  if (userIds.length === 0) return;

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    title,
    message,
    type: "automation",
    task_id: taskId || null,
    notification_date: today(),
  }));

  const { error } = await supabase.from("notifications").insert(notifications as never);
  if (error) {
    throw error;
  }
}

async function executeAction(action: AutomationAction, entityId: string, entityData: AutomationEntityData) {
  const { type, config } = action;

  switch (type) {
    case "assign_to": {
      const userId = String(config.user_id || "");
      if (!userId) return;

      if (entityData._entity_type === "lead") {
        await supabase.from("leads").update({ assigned_to: userId }).eq("id", entityId);
      } else if (entityData._entity_type === "client") {
        await supabase.from("clients").update({ assigned_manager: userId }).eq("id", entityId);
      } else if (entityData._entity_type === "task") {
        await supabase.from("tasks").update({ assigned_to: userId }).eq("id", entityId);
      }
      return;
    }

    case "send_notification": {
      const title = interpolateTemplate(String(config.title || "Automation"), entityData);
      const message = interpolateTemplate(String(config.message || ""), entityData);
      const target = String(config.target || "admins");

      let userIds: string[] = [];
      if (target === "assigned") {
        const assignedUser = String(entityData.assigned_to || entityData.assigned_manager || "");
        if (assignedUser) userIds = [assignedUser];
      } else if (target === "specific" && config.user_id) {
        userIds = [String(config.user_id)];
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("status", "active")
          .in("role", ["owner", "admin"]);
        userIds = (data || []).map((row) => row.id);
      }

      await insertNotificationsForUsers(userIds, title, message, entityData._entity_type === "task" ? entityId : null);
      return;
    }

    case "create_tasks_from_template": {
      const templateId = String(config.template_id || "");
      if (!templateId) return;

      const { data: steps, error: stepsError } = await supabase
        .from("service_template_steps")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order");

      if (stepsError || !steps || steps.length === 0) return;

      let clientId = entityId;
      if (entityData._entity_type === "lead") {
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("lead_id", entityId)
          .maybeSingle();
        if (!client?.id) return;
        clientId = client.id;
      }

      const assignee = String(entityData.assigned_to || entityData.assigned_manager || "") || null;
      const now = new Date();
      const tasks = steps.map((step: any) => ({
        client_id: clientId,
        task_title: step.title,
        priority: step.priority || "medium",
        deadline: new Date(now.getTime() + (Number(step.deadline_offset_days || 7) * 86400000)).toISOString(),
        assigned_to: assignee,
        status: "pending",
        notes: step.description || null,
      }));

      await supabase.from("tasks").insert(tasks as never);
      return;
    }

    case "update_status": {
      const status = String(config.status || "");
      if (!status) return;

      if (entityData._entity_type === "lead") {
        await supabase.from("leads").update({ status }).eq("id", entityId);
      } else if (entityData._entity_type === "client") {
        await supabase.from("clients").update({ status }).eq("id", entityId);
      } else if (entityData._entity_type === "task") {
        await supabase.from("tasks").update({ status }).eq("id", entityId);
      }
      return;
    }

    case "create_activity_log": {
      const content = interpolateTemplate(String(config.content || "Automation executed"), entityData);

      if (entityData._entity_type === "lead") {
        await supabase.from("lead_activities").insert({
          lead_id: entityId,
          type: "automation",
          content,
        } as never);
      }

      await supabase.from("activity_logs").insert({
        entity: entityData._entity_type,
        entity_id: entityId,
        action: "automation_executed",
        metadata: { content, rule_source: "app_fallback" },
      } as never);
    }
  }
}

export async function executeAutomationRules({
  triggerEvent,
  entityId,
  entityData,
  oldData,
}: {
  triggerEvent: string;
  entityId: string;
  entityData: AutomationEntityData;
  oldData?: Record<string, unknown>;
}) {
  try {
    const { data: rules, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("trigger_event", triggerEvent)
      .eq("is_active", true);

    if (error || !rules || rules.length === 0) return;

    for (const rule of rules as unknown as AutomationRule[]) {
      if (!matchesConditions(rule.trigger_conditions || {}, entityData, oldData)) {
        continue;
      }

      const executedActions: string[] = [];
      let status = "success";
      let errorMessage: string | null = null;

      for (const action of rule.actions || []) {
        try {
          await executeAction(action, entityId, entityData);
          executedActions.push(action.type);
        } catch (error: any) {
          status = "partial";
          errorMessage = error?.message || "Automation action failed";
        }
      }

      await supabase
        .from("automation_rules")
        .update({
          execution_count: Number(rule.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq("id", rule.id);

      await supabase.from("automation_logs").insert({
        rule_id: rule.id,
        trigger_event: triggerEvent,
        trigger_entity_id: entityId,
        actions_executed: executedActions,
        status,
        error_message: errorMessage,
      } as never);
    }
  } catch (error) {
    console.error("Failed to execute automation rules:", error);
  }
}
