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

    // Stale thresholds: remind at 3 days, 7 days, 14 days without update
    const staleDays = [3, 7, 14];
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    let notificationsCreated = 0;

    // Get all open leads (not won/lost and not deleted)
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("id, name, company_name, assigned_to, status, updated_at")
      .eq("is_deleted", false)
      .not("status", "in", '("lead_won","lead_lost")');

    if (leadsErr) throw leadsErr;
    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No open leads found", notifications: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get owners and admins for notification
    const { data: managers } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["owner", "admin"])
      .eq("status", "active");

    for (const lead of leads) {
      if (!lead.updated_at) continue;

      const lastUpdate = new Date(lead.updated_at);
      const daysSinceUpdate = Math.floor(
        (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Find the matching stale threshold
      const matchedThreshold = staleDays.find((d) => daysSinceUpdate === d);
      if (!matchedThreshold) continue;

      // Check if we already sent this reminder today for this lead
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", "lead_followup")
        .eq("notification_date", todayStr)
        .ilike("message", `%${lead.name}%${matchedThreshold} day%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Determine who to notify
      const notifyUsers = new Set<string>();
      if (managers) managers.forEach((m) => notifyUsers.add(m.id));
      if (lead.assigned_to) notifyUsers.add(lead.assigned_to);

      const leadLabel = lead.company_name
        ? `${lead.name} (${lead.company_name})`
        : lead.name;

      for (const userId of notifyUsers) {
        const { error: insertErr } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            title: "Lead Follow-up Reminder",
            message: `${leadLabel} hasn't been updated in ${matchedThreshold} days. Status: ${lead.status.replace("_", " ")}. Follow up now!`,
            type: "lead_followup",
            notification_date: todayStr,
          });

        if (insertErr) {
          console.error(`Failed to notify ${userId} about lead ${lead.id}:`, insertErr);
          continue;
        }
        notificationsCreated++;
      }
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      entity: "lead",
      entity_id: "00000000-0000-0000-0000-000000000000",
      action: "lead_followup_check",
      metadata: {
        notifications_created: notificationsCreated,
        open_leads: leads.length,
        date: todayStr,
        thresholds: staleDays,
      },
    });

    console.log(`Lead follow-up reminders: ${notificationsCreated} notifications created`);

    return new Response(
      JSON.stringify({
        message: `Created ${notificationsCreated} follow-up reminders`,
        notifications: notificationsCreated,
        openLeads: leads.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("lead-followup-reminders error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
