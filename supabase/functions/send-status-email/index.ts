import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      entity,        // "lead" | "task"
      entityName,    // name or title of the entity
      oldStatus,
      newStatus,
      assignedTo,    // uuid of assigned user (nullable)
    } = await req.json();

    if (!entity || !entityName || !oldStatus || !newStatus) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get caller profile
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("name")
      .eq("id", caller.id)
      .single();

    const changedBy = callerProfile?.name || caller.email || "Someone";

    // Build recipient list: assigned user + all admins/owners (except caller)
    const recipientIds = new Set<string>();

    if (assignedTo && assignedTo !== caller.id) {
      recipientIds.add(assignedTo);
    }

    const { data: adminsOwners } = await adminClient
      .from("profiles")
      .select("id")
      .in("role", ["owner", "admin"])
      .eq("status", "active")
      .neq("id", caller.id);

    if (adminsOwners) {
      adminsOwners.forEach((u) => recipientIds.add(u.id));
    }

    if (recipientIds.size === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TESTING MODE: Send only to verified Resend owner email
    // Remove this override after verifying a custom domain on Resend
    const emails: string[] = ["adruvaadsagency@gmail.com"];

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ message: "No email addresses found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const entityLabel = entity === "lead" ? "Lead" : "Task";
    const formatStatus = (s: string) =>
      s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const resend = new Resend(resendKey);

    const { error: emailError } = await resend.emails.send({
      from: "Adruva CRM <onboarding@resend.dev>",
      to: emails,
      subject: `${entityLabel} Status Updated: ${entityName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #1a1b2e; border-radius: 12px; padding: 32px; color: #ffffff;">
            <h1 style="margin: 0 0 8px; font-size: 20px; color: #ffffff;">
              ${entityLabel} Status Changed
            </h1>
            <p style="margin: 0 0 24px; color: #9ca3af; font-size: 14px;">
              Updated by ${changedBy}
            </p>
            <div style="background: #252640; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; font-size: 14px; color: #9ca3af;">
                <strong style="color: #ffffff;">${entityLabel}:</strong> ${entityName}
              </p>
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="background: #374151; color: #d1d5db; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                  ${formatStatus(oldStatus)}
                </span>
                <span style="color: #6b7280; font-size: 18px;">→</span>
                <span style="background: #3b82f6; color: #ffffff; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                  ${formatStatus(newStatus)}
                </span>
              </div>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              — Adruva CRM
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      throw new Error(emailError.message);
    }

    return new Response(
      JSON.stringify({ message: "Emails sent", count: emails.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-status-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
