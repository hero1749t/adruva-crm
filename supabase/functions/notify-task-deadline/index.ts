import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split("T")[0];

    // Get tasks due tomorrow (1 day before) or day after (2 days before)
    const { data: tasks, error } = await adminClient
      .from("tasks")
      .select("id, task_title, deadline, assigned_to, client_id, clients!tasks_client_id_fkey(client_name), profiles!tasks_assigned_to_fkey(name)")
      .in("status", ["pending", "in_progress"])
      .not("assigned_to", "is", null)
      .or(`deadline.gte.${tomorrowStr},deadline.lt.${dayAfterStr}T23:59:59`)
      .gte("deadline", tomorrowStr)
      .lte("deadline", dayAfterStr + "T23:59:59");

    if (error) throw error;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks due soon" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendKey);

    // TESTING MODE: all emails go to owner
    const testEmail = "adruvaadsagency@gmail.com";

    let sentCount = 0;
    for (const task of tasks) {
      const deadlineDate = new Date(task.deadline);
      const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const urgency = diffDays <= 1 ? "⚠️ Due Tomorrow" : "📅 Due in 2 Days";
      const clientName = (task as any).clients?.client_name || "Unknown";
      const assigneeName = (task as any).profiles?.name || "Team Member";

      const { error: emailError } = await resend.emails.send({
        from: "Adruva CRM <onboarding@resend.dev>",
        to: [testEmail],
        subject: `${urgency}: ${task.task_title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: #1a1b2e; border-radius: 12px; padding: 32px; color: #ffffff;">
              <h1 style="margin: 0 0 8px; font-size: 20px;">${urgency}</h1>
              <p style="margin: 0 0 24px; color: #9ca3af; font-size: 14px;">Task deadline reminder for ${assigneeName}</p>
              <div style="background: #252640; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 16px;"><strong>${task.task_title}</strong></p>
                <p style="margin: 0 0 8px; color: #9ca3af; font-size: 14px;">Client: ${clientName}</p>
                <p style="margin: 0; color: #f59e0b; font-size: 14px; font-weight: 600;">
                  Deadline: ${deadlineDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">— Adruva CRM</p>
            </div>
          </div>
        `,
      });

      if (!emailError) sentCount++;
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} deadline reminders`, tasks: tasks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-task-deadline error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
