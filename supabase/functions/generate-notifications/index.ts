import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86400000);
    const todayStr = todayStart.toISOString().split("T")[0];

    // Fetch non-completed tasks with deadlines up to tomorrow
    const { data: tasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("id, task_title, deadline, assigned_to, client_id, status, clients!tasks_client_id_fkey(client_name)")
      .in("status", ["pending", "in_progress", "overdue"])
      .lte("deadline", tomorrowEnd.toISOString())
      .not("assigned_to", "is", null);

    if (tasksErr) throw tasksErr;

    // Fetch all user notification preferences
    const { data: allPrefs } = await supabase
      .from("notification_preferences")
      .select("user_id, due_tomorrow, due_today, overdue");

    const prefsMap = new Map<string, { due_tomorrow: boolean; due_today: boolean; overdue: boolean }>();
    for (const p of allPrefs || []) {
      prefsMap.set(p.user_id, p);
    }

    // Default preferences (all enabled) for users without saved preferences
    const defaultPrefs = { due_tomorrow: true, due_today: true, overdue: true };

    const notifications: Array<{
      user_id: string;
      task_id: string;
      type: string;
      title: string;
      message: string;
      notification_date: string;
    }> = [];

    for (const task of tasks || []) {
      const deadline = new Date(task.deadline);
      const userId = task.assigned_to!;
      const clientName = (task.clients as any)?.client_name || "Unknown";
      const prefs = prefsMap.get(userId) || defaultPrefs;

      if (deadline < todayStart && prefs.overdue) {
        notifications.push({
          user_id: userId,
          task_id: task.id,
          type: "overdue",
          title: "Task overdue",
          message: `"${task.task_title}" for ${clientName} is overdue`,
          notification_date: todayStr,
        });
      } else if (deadline >= todayStart && deadline < todayEnd && prefs.due_today) {
        notifications.push({
          user_id: userId,
          task_id: task.id,
          type: "due_today",
          title: "Task due today",
          message: `"${task.task_title}" for ${clientName} is due today`,
          notification_date: todayStr,
        });
      } else if (deadline >= todayEnd && deadline < tomorrowEnd && prefs.due_tomorrow) {
        notifications.push({
          user_id: userId,
          task_id: task.id,
          type: "due_tomorrow",
          title: "Due tomorrow",
          message: `"${task.task_title}" for ${clientName} is due tomorrow`,
          notification_date: todayStr,
        });
      }
    }

    if (notifications.length > 0) {
      const { error: insertErr } = await supabase
        .from("notifications")
        .upsert(notifications, {
          onConflict: "user_id,task_id,type,notification_date",
          ignoreDuplicates: true,
        });
      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({ created: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
