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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    // Get tasks due today or tomorrow that are not completed/overdue
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
    const dayAfter = new Date(now.getTime() + 2 * 86400000).toISOString().split("T")[0];

    // Tasks due today
    const { data: dueTodayTasks, error: e1 } = await supabase
      .from("tasks")
      .select("id, task_title, deadline, assigned_to, client_id, clients(client_name)")
      .gte("deadline", `${today}T00:00:00`)
      .lt("deadline", `${tomorrow}T00:00:00`)
      .in("status", ["pending", "in_progress"]);

    if (e1) throw e1;

    // Tasks due tomorrow
    const { data: dueTomorrowTasks, error: e2 } = await supabase
      .from("tasks")
      .select("id, task_title, deadline, assigned_to, client_id, clients(client_name)")
      .gte("deadline", `${tomorrow}T00:00:00`)
      .lt("deadline", `${dayAfter}T00:00:00`)
      .in("status", ["pending", "in_progress"]);

    if (e2) throw e2;

    const allTasks = [
      ...(dueTodayTasks || []).map((t) => ({ ...t, urgency: "due today" })),
      ...(dueTomorrowTasks || []).map((t) => ({ ...t, urgency: "due tomorrow" })),
    ];

    if (allTasks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming deadlines", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group tasks by assigned_to
    const tasksByUser: Record<string, typeof allTasks> = {};
    for (const task of allTasks) {
      const userId = task.assigned_to || "unassigned";
      if (!tasksByUser[userId]) tasksByUser[userId] = [];
      tasksByUser[userId].push(task);
    }

    let emailsSent = 0;
    let notificationsCreated = 0;

    for (const [userId, tasks] of Object.entries(tasksByUser)) {
      // Create in-app notifications
      if (userId !== "unassigned") {
        for (const task of tasks) {
          // Check user preferences
          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("*")
            .eq("user_id", userId)
            .single();

          const shouldNotify =
            !prefs ||
            (task.urgency === "due today" && prefs.due_today) ||
            (task.urgency === "due tomorrow" && prefs.due_tomorrow);

          if (shouldNotify) {
            await supabase.from("notifications").insert({
              user_id: userId,
              title: `Task ${task.urgency}`,
              message: `"${task.task_title}" for ${(task as any).clients?.client_name || "Unknown"} is ${task.urgency}`,
              type: task.urgency === "due today" ? "due_today" : "due_tomorrow",
              task_id: task.id,
            });
            notificationsCreated++;
          }
        }
      }

      // Build email summary
      const taskListHtml = tasks
        .map(
          (t) =>
            `<tr>
              <td style="padding:8px;border-bottom:1px solid #eee">${t.task_title}</td>
              <td style="padding:8px;border-bottom:1px solid #eee">${(t as any).clients?.client_name || "—"}</td>
              <td style="padding:8px;border-bottom:1px solid #eee">
                <span style="color:${t.urgency === "due today" ? "#dc2626" : "#f59e0b"};font-weight:bold">
                  ${t.urgency.toUpperCase()}
                </span>
              </td>
              <td style="padding:8px;border-bottom:1px solid #eee">${new Date(t.deadline).toLocaleDateString()}</td>
            </tr>`
        )
        .join("");

      // Send consolidated email to management
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Adruva CRM <onboarding@resend.dev>",
          to: ["adruvaadsagency@gmail.com"],
          subject: `⏰ ${tasks.length} Task${tasks.length > 1 ? "s" : ""} ${tasks[0].urgency} — Deadline Reminder`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#1a1a2e">📋 Task Deadline Reminder</h2>
              <p>${tasks.length} task${tasks.length > 1 ? "s" : ""} need${tasks.length === 1 ? "s" : ""} attention:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <thead>
                  <tr style="background:#f8f9fa">
                    <th style="padding:8px;text-align:left">Task</th>
                    <th style="padding:8px;text-align:left">Client</th>
                    <th style="padding:8px;text-align:left">Status</th>
                    <th style="padding:8px;text-align:left">Deadline</th>
                  </tr>
                </thead>
                <tbody>${taskListHtml}</tbody>
              </table>
              <p style="color:#666;font-size:13px">— Adruva CRM</p>
            </div>
          `,
        }),
      });

      if (emailRes.ok) emailsSent++;
    }

    console.log(
      `Deadline reminder: ${emailsSent} emails sent, ${notificationsCreated} notifications created`
    );

    return new Response(
      JSON.stringify({
        message: "Deadline reminders sent",
        emailsSent,
        notificationsCreated,
        totalTasks: allTasks.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("deadline-reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
