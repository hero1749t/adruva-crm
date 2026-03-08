import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toCSV(leads: any[]): string {
  const headers = ["Name", "Email", "Phone", "Company", "Source", "Service Interest", "Status", "Created At"];
  const rows = leads.map((l) => [
    `"${(l.name || "").replace(/"/g, '""')}"`,
    `"${(l.email || "").replace(/"/g, '""')}"`,
    `"${(l.phone || "").replace(/"/g, '""')}"`,
    `"${(l.company_name || "").replace(/"/g, '""')}"`,
    `"${(l.source || "").replace(/"/g, '""')}"`,
    `"${(l.service_interest || "").replace(/"/g, '""')}"`,
    `"${(l.status || "").replace(/"/g, '""')}"`,
    `"${l.created_at ? new Date(l.created_at).toLocaleString("en-IN") : ""}"`,
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
}

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

    // Get leads created in the last 30 minutes
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: newLeads, error } = await adminClient
      .from("leads")
      .select("*")
      .eq("is_deleted", false)
      .gte("created_at", thirtyMinsAgo)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!newLeads || newLeads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No new leads in the last 30 minutes" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvContent = toCSV(newLeads);
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    // TESTING MODE
    const emails = ["adruvaadsagency@gmail.com"];

    const resend = new Resend(resendKey);
    const { error: emailError } = await resend.emails.send({
      from: "Adruva CRM <onboarding@resend.dev>",
      to: emails,
      subject: `📊 New Leads Report — ${newLeads.length} lead(s) | ${dateStr} ${timeStr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #1a1b2e; border-radius: 12px; padding: 32px; color: #ffffff;">
            <h1 style="margin: 0 0 8px; font-size: 20px;">📊 New Leads Report</h1>
            <p style="margin: 0 0 24px; color: #9ca3af; font-size: 14px;">${dateStr} at ${timeStr}</p>
            <div style="background: #252640; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; font-size: 32px; font-weight: bold; color: #3b82f6;">${newLeads.length}</p>
              <p style="margin: 0; color: #9ca3af; font-size: 14px;">new lead(s) in the last 30 minutes</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #374151;">
                <th style="text-align: left; padding: 8px; color: #9ca3af; font-size: 11px; text-transform: uppercase;">Name</th>
                <th style="text-align: left; padding: 8px; color: #9ca3af; font-size: 11px; text-transform: uppercase;">Company</th>
                <th style="text-align: left; padding: 8px; color: #9ca3af; font-size: 11px; text-transform: uppercase;">Source</th>
              </tr>
              ${newLeads.slice(0, 10).map((l) => `
                <tr style="border-bottom: 1px solid #252640;">
                  <td style="padding: 8px; font-size: 13px;">${l.name}</td>
                  <td style="padding: 8px; font-size: 13px; color: #9ca3af;">${l.company_name || "—"}</td>
                  <td style="padding: 8px; font-size: 13px; color: #9ca3af;">${l.source || "—"}</td>
                </tr>
              `).join("")}
              ${newLeads.length > 10 ? `<tr><td colspan="3" style="padding: 8px; color: #9ca3af; font-size: 12px;">...and ${newLeads.length - 10} more (see attached CSV)</td></tr>` : ""}
            </table>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Full data attached as CSV file. — Adruva CRM</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `new-leads-${now.toISOString().split("T")[0]}.csv`,
          content: csvBase64,
        },
      ],
    });

    if (emailError) throw new Error(emailError.message);

    return new Response(
      JSON.stringify({ message: `CSV report sent with ${newLeads.length} leads` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-new-leads-csv error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
