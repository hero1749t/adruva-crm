import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
    const dayOfMonth = now.getDate(); // 1-31

    // Get active recurring templates matching today's schedule
    const { data: weeklyTemplates, error: e1 } = await supabase
      .from("recurring_task_templates")
      .select("*")
      .eq("is_active", true)
      .eq("schedule_type", "weekly")
      .eq("schedule_day", dayOfWeek);

    if (e1) throw e1;

    const { data: monthlyTemplates, error: e2 } = await supabase
      .from("recurring_task_templates")
      .select("*")
      .eq("is_active", true)
      .eq("schedule_type", "monthly")
      .eq("schedule_day", dayOfMonth);

    if (e2) throw e2;

    const templates = [...(weeklyTemplates || []), ...(monthlyTemplates || [])];

    if (templates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recurring templates scheduled for today", created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active clients
    const { data: activeClients, error: e3 } = await supabase
      .from("clients")
      .select("id, client_name, assigned_manager")
      .eq("status", "active");

    if (e3) throw e3;

    if (!activeClients || activeClients.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active clients found", created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let tasksCreated = 0;

    for (const template of templates) {
      for (const client of activeClients) {
        // Check if this recurring task was already created today for this client
        const todayStart = `${now.toISOString().split("T")[0]}T00:00:00`;
        const todayEnd = `${now.toISOString().split("T")[0]}T23:59:59`;

        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("client_id", client.id)
          .eq("task_title", template.title)
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd)
          .limit(1);

        if (existing && existing.length > 0) continue; // Skip duplicate

        const deadline = new Date(now);
        deadline.setDate(deadline.getDate() + (template.deadline_offset_days || 3));

        const assignedTo = template.assigned_to || client.assigned_manager;

        const { error: insertErr } = await supabase.from("tasks").insert({
          client_id: client.id,
          task_title: template.title,
          priority: template.priority || "medium",
          deadline: deadline.toISOString(),
          assigned_to: assignedTo,
          status: "pending",
          start_date: now.toISOString().split("T")[0],
          notes: `Auto-created recurring task (${template.schedule_type})`,
        });

        if (insertErr) {
          console.error(`Failed to create task for client ${client.id}:`, insertErr);
          continue;
        }

        tasksCreated++;

        // Notify assigned user
        if (assignedTo) {
          await supabase.from("notifications").insert({
            user_id: assignedTo,
            title: "Recurring Task Created",
            message: `"${template.title}" for ${client.client_name} has been auto-created`,
            type: "recurring_task",
          });
        }
      }
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      entity: "task",
      entity_id: "00000000-0000-0000-0000-000000000000",
      action: "recurring_tasks_created",
      metadata: {
        templates_matched: templates.length,
        tasks_created: tasksCreated,
        date: now.toISOString().split("T")[0],
      },
    });

    console.log(`Created ${tasksCreated} recurring tasks from ${templates.length} templates`);

    return new Response(
      JSON.stringify({
        message: `Created ${tasksCreated} recurring tasks`,
        created: tasksCreated,
        templatesMatched: templates.length,
        activeClients: activeClients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-recurring-tasks error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
