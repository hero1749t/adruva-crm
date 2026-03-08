import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find tasks that are past deadline but not yet marked overdue or completed
    const now = new Date().toISOString();
    const { data: overdueTasks, error: fetchError } = await supabase
      .from("tasks")
      .select("id, task_title, client_id, assigned_to, deadline")
      .lt("deadline", now)
      .in("status", ["pending", "in_progress"]);

    if (fetchError) throw fetchError;

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue tasks found", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const taskIds = overdueTasks.map((t) => t.id);

    // Bulk update status to overdue
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "overdue" })
      .in("id", taskIds);

    if (updateError) throw updateError;

    // Log activity for each updated task
    for (const task of overdueTasks) {
      await supabase.from("activity_logs").insert({
        entity: "task",
        entity_id: task.id,
        action: "auto_marked_overdue",
        metadata: {
          task_title: task.task_title,
          deadline: task.deadline,
        },
      });

      // Create in-app notification for assigned user
      if (task.assigned_to) {
        await supabase.from("notifications").insert({
          user_id: task.assigned_to,
          title: "Task Overdue",
          message: `"${task.task_title}" is now overdue (deadline: ${new Date(task.deadline).toLocaleDateString()})`,
          type: "overdue",
          task_id: task.id,
        });
      }
    }

    console.log(`Marked ${taskIds.length} tasks as overdue`);

    return new Response(
      JSON.stringify({
        message: `Marked ${taskIds.length} tasks as overdue`,
        updated: taskIds.length,
        taskIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-overdue error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
