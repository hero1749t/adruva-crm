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

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { taskTitle, assignedToId, assignedToName, clientName, deadline } = await req.json();

    if (!taskTitle || !assignedToId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("name")
      .eq("id", caller.id)
      .single();

    const assignedBy = callerProfile?.name || caller.email || "Someone";

    // TESTING MODE
    const emails = ["adruvaadsagency@gmail.com"];

    const deadlineStr = deadline
      ? new Date(deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "Not set";

    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: "Adruva CRM <onboarding@resend.dev>",
      to: emails,
      subject: `Task Assigned: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #1a1b2e; border-radius: 12px; padding: 32px; color: #ffffff;">
            <h1 style="margin: 0 0 8px; font-size: 20px;">📋 Task Assigned to You</h1>
            <p style="margin: 0 0 24px; color: #9ca3af; font-size: 14px;">Assigned by ${assignedBy}</p>
            <div style="background: #252640; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; font-size: 16px;"><strong>${taskTitle}</strong></p>
              ${clientName ? `<p style="margin: 0 0 8px; color: #9ca3af; font-size: 14px;">Client: ${clientName}</p>` : ""}
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 14px;">Assigned to: <strong style="color: #3b82f6;">${assignedToName || "You"}</strong></p>
              <p style="margin: 0; color: #9ca3af; font-size: 14px;">Deadline: <strong style="color: #f59e0b;">${deadlineStr}</strong></p>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">— Adruva CRM</p>
          </div>
        </div>
      `,
    });

    if (emailError) throw new Error(emailError.message);

    return new Response(JSON.stringify({ message: "Email sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-task-assigned error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
