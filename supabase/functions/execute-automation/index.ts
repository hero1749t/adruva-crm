import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AutomationRule {
  id: string;
  name: string;
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;
  actions: ActionConfig[];
  is_active: boolean;
}

interface ActionConfig {
  type: string;
  config: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { trigger_event, entity_id, entity_data, old_data } = await req.json();

    if (!trigger_event || !entity_id) {
      return new Response(
        JSON.stringify({ error: "trigger_event and entity_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch matching active rules
    const { data: rules, error: rulesError } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("trigger_event", trigger_event)
      .eq("is_active", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No matching rules", executed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { ruleId: string; ruleName: string; status: string; actions: string[] }[] = [];

    for (const rule of rules as AutomationRule[]) {
      // Check conditions
      if (!matchesConditions(rule.trigger_conditions, entity_data, old_data)) {
        continue;
      }

      const executedActions: string[] = [];
      let ruleStatus = "success";
      let errorMsg: string | null = null;

      for (const action of rule.actions) {
        try {
          await executeAction(supabase, action, entity_id, entity_data);
          executedActions.push(action.type);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Action ${action.type} failed for rule ${rule.name}:`, msg);
          ruleStatus = "partial";
          errorMsg = msg;
        }
      }

      // Update execution count
      await supabase
        .from("automation_rules")
        .update({
          execution_count: (rule as any).execution_count + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq("id", rule.id);

      // Log execution
      await supabase.from("automation_logs").insert({
        rule_id: rule.id,
        trigger_event,
        trigger_entity_id: entity_id,
        actions_executed: executedActions,
        status: ruleStatus,
        error_message: errorMsg,
      });

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        status: ruleStatus,
        actions: executedActions,
      });
    }

    return new Response(
      JSON.stringify({ executed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Automation engine error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function matchesConditions(
  conditions: Record<string, unknown>,
  entityData: Record<string, unknown>,
  oldData?: Record<string, unknown>
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  for (const [key, value] of Object.entries(conditions)) {
    if (key === "status_changed_to") {
      if (entityData?.status !== value) return false;
      if (oldData?.status === value) return false; // must actually change
    } else if (key === "status_changed_from") {
      if (oldData?.status !== value) return false;
    } else if (key === "source") {
      if (entityData?.source !== value) return false;
    } else {
      if (entityData?.[key] !== value) return false;
    }
  }
  return true;
}

async function executeAction(
  supabase: any,
  action: ActionConfig,
  entityId: string,
  entityData: Record<string, unknown>
) {
  const { type, config } = action;

  switch (type) {
    case "assign_to": {
      const userId = config.user_id as string;
      if (!userId) break;
      // Determine table from entity data
      if (entityData?._entity_type === "lead") {
        await supabase.from("leads").update({ assigned_to: userId }).eq("id", entityId);
      } else if (entityData?._entity_type === "client") {
        await supabase.from("clients").update({ assigned_manager: userId }).eq("id", entityId);
      }
      break;
    }

    case "send_notification": {
      const message = interpolateTemplate(config.message as string, entityData);
      const title = interpolateTemplate(config.title as string || "Automation", entityData);
      const targetType = config.target as string || "admins";

      let targetUsers: string[] = [];

      if (targetType === "assigned") {
        const assignee = (entityData?.assigned_to || entityData?.assigned_manager) as string;
        if (assignee) targetUsers = [assignee];
      } else if (targetType === "specific" && config.user_id) {
        targetUsers = [config.user_id as string];
      } else {
        // admins + owners
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .in("role", ["owner", "admin"])
          .eq("status", "active");
        targetUsers = (admins || []).map((u: any) => u.id);
      }

      for (const userId of targetUsers) {
        await supabase.from("notifications").insert({
          user_id: userId,
          title,
          message,
          type: "automation",
        });
      }
      break;
    }

    case "create_tasks_from_template": {
      const templateId = config.template_id as string;
      if (!templateId) break;

      const { data: steps } = await supabase
        .from("service_template_steps")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order");

      if (!steps || steps.length === 0) break;

      // Determine client_id
      let clientId = entityId;
      if (entityData?._entity_type === "lead") {
        // Find client created from this lead
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("lead_id", entityId)
          .single();
        if (client) clientId = client.id;
        else break;
      }

      const assignee = (entityData?.assigned_to || entityData?.assigned_manager) as string || null;
      const now = new Date();

      const tasks = steps.map((step: any) => ({
        client_id: clientId,
        task_title: step.title,
        priority: step.priority || "medium",
        deadline: new Date(now.getTime() + (step.deadline_offset_days || 7) * 86400000).toISOString(),
        assigned_to: assignee,
        status: "pending",
        notes: step.description || null,
      }));

      await supabase.from("tasks").insert(tasks);
      break;
    }

    case "update_status": {
      const newStatus = config.status as string;
      if (!newStatus) break;
      if (entityData?._entity_type === "lead") {
        await supabase.from("leads").update({ status: newStatus }).eq("id", entityId);
      } else if (entityData?._entity_type === "client") {
        await supabase.from("clients").update({ status: newStatus }).eq("id", entityId);
      }
      break;
    }

    case "create_activity_log": {
      const content = interpolateTemplate(config.content as string || "Automation executed", entityData);
      if (entityData?._entity_type === "lead") {
        await supabase.from("lead_activities").insert({
          lead_id: entityId,
          type: "automation",
          content,
        });
      }
      await supabase.from("activity_logs").insert({
        entity: entityData?._entity_type || "unknown",
        entity_id: entityId,
        action: "automation_executed",
        metadata: { content },
      });
      break;
    }

    default:
      console.warn(`Unknown action type: ${type}`);
  }
}

function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return String(data?.[key] || key);
  });
}
