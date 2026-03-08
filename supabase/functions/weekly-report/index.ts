import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── helpers ── */
const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendKey);

    /* ── Fetch all data ── */
    const [
      { data: profiles },
      { data: invoices },
      { data: tasks },
      { data: clients },
      { data: leads },
    ] = await Promise.all([
      admin.from("profiles").select("id, name, role, status").eq("status", "active"),
      admin.from("invoices").select("id, status, total_amount, client_id, created_at"),
      admin.from("tasks").select("id, status, assigned_to, client_id, completed_at, deadline"),
      admin.from("clients").select("id, client_name, status, monthly_payment, assigned_manager"),
      admin.from("leads").select("id, status, source, assigned_to, created_at").eq("is_deleted", false),
    ]);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ message: "No active profiles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* ── Compute global metrics ── */
    const paidInvoices = (invoices || []).filter((i) => i.status === "paid");
    const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);
    const outstanding = (invoices || [])
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((s, i) => s + (i.total_amount || 0), 0);
    const collectionRate = pct(paidInvoices.length, (invoices || []).length);
    const activeClients = (clients || []).filter((c) => c.status === "active").length;
    const completedTasks = (tasks || []).filter((t) => t.status === "completed").length;
    const overdueTasks = (tasks || []).filter((t) => t.status === "overdue").length;
    const totalTasks = (tasks || []).length;

    // Lead stats
    const totalLeads = (leads || []).length;
    const wonLeads = (leads || []).filter((l) => l.status === "lead_won").length;
    const newLeads = (leads || []).filter((l) => l.status === "new_lead").length;

    // Lead source breakdown
    const sourceCounts: Record<string, number> = {};
    (leads || []).forEach((l) => {
      const src = l.source || "Unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const sourceRows = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `<tr><td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:13px">${name}</td><td style="padding:10px 16px;border-bottom:1px solid #1e293b;text-align:right;color:#f1f5f9;font-weight:600;font-size:13px">${count}</td></tr>`)
      .join("");

    // Top 5 clients by revenue
    const clientRevMap: Record<string, { name: string; rev: number }> = {};
    paidInvoices.forEach((inv) => {
      const cl = (clients || []).find((c) => c.id === inv.client_id);
      const name = cl?.client_name || "Unknown";
      if (!clientRevMap[inv.client_id]) clientRevMap[inv.client_id] = { name, rev: 0 };
      clientRevMap[inv.client_id].rev += inv.total_amount || 0;
    });
    const topClients = Object.values(clientRevMap)
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);
    const topClientRows = topClients
      .map(
        (c) =>
          `<tr><td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:13px">${c.name}</td><td style="padding:10px 16px;border-bottom:1px solid #1e293b;text-align:right;color:#34d399;font-weight:700;font-size:13px">${fmtINR(c.rev)}</td></tr>`
      )
      .join("");

    // MRR
    const mrr = (clients || [])
      .filter((c) => c.status === "active" && c.monthly_payment)
      .reduce((s, c) => s + (c.monthly_payment || 0), 0);

    /* ── Build HTML template ── */
    const buildEmail = (recipientName: string, scopedSection: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">
  <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;text-align:center">
    <h1 style="color:#60a5fa;margin:0;font-size:20px;letter-spacing:1px">📊 Weekly Report</h1>
    <p style="color:#94a3b8;margin:8px 0 0;font-size:13px">${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
  </div>
  <div style="background:#ffffff;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
    <p style="color:#334155;margin:0 0 20px;font-size:14px">Hi ${recipientName},</p>
    <p style="color:#475569;margin:0 0 20px;font-size:13px">Here's your weekly performance summary:</p>

    <!-- KPIs -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td style="padding:12px;background:#f0fdf4;border-radius:8px;text-align:center;width:33%">
          <div style="font-size:22px;font-weight:700;color:#16a34a">${fmtINR(totalRevenue)}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Total Revenue</div>
        </td>
        <td style="width:8px"></td>
        <td style="padding:12px;background:#eff6ff;border-radius:8px;text-align:center;width:33%">
          <div style="font-size:22px;font-weight:700;color:#2563eb">${collectionRate}%</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Collection Rate</div>
        </td>
        <td style="width:8px"></td>
        <td style="padding:12px;background:#fefce8;border-radius:8px;text-align:center;width:33%">
          <div style="font-size:22px;font-weight:700;color:#ca8a04">${fmtINR(outstanding)}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px">Outstanding</div>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td style="padding:12px;background:#f0f9ff;border-radius:8px;text-align:center;width:25%">
          <div style="font-size:20px;font-weight:700;color:#0891b2">${activeClients}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-top:4px">Active Clients</div>
        </td>
        <td style="width:6px"></td>
        <td style="padding:12px;background:#f0fdf4;border-radius:8px;text-align:center;width:25%">
          <div style="font-size:20px;font-weight:700;color:#16a34a">${fmtINR(mrr)}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-top:4px">MRR</div>
        </td>
        <td style="width:6px"></td>
        <td style="padding:12px;background:#faf5ff;border-radius:8px;text-align:center;width:25%">
          <div style="font-size:20px;font-weight:700;color:#7c3aed">${completedTasks}/${totalTasks}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-top:4px">Tasks Done</div>
        </td>
        <td style="width:6px"></td>
        <td style="padding:12px;background:#fef2f2;border-radius:8px;text-align:center;width:25%">
          <div style="font-size:20px;font-weight:700;color:#dc2626">${overdueTasks}</div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-top:4px">Overdue</div>
        </td>
      </tr>
    </table>

    <!-- Leads -->
    <h3 style="color:#1e293b;font-size:13px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px">Lead Pipeline</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
      <tr>
        <td style="padding:8px 0;color:#475569;font-size:13px">Total Leads</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:13px">${totalLeads}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#475569;font-size:13px">New Leads</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#2563eb;font-size:13px">${newLeads}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#475569;font-size:13px">Won</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#16a34a;font-size:13px">${wonLeads}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#475569;font-size:13px">Conversion Rate</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#7c3aed;font-size:13px">${pct(wonLeads, totalLeads)}%</td>
      </tr>
    </table>

    ${sourceRows ? `
    <h3 style="color:#1e293b;font-size:13px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px">Lead Sources</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><th style="padding:6px 12px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Source</th><th style="padding:6px 12px;text-align:right;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Count</th></tr>
      ${sourceRows}
    </table>` : ""}

    ${topClientRows ? `
    <h3 style="color:#1e293b;font-size:13px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px">Top Clients by Revenue</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><th style="padding:6px 12px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Client</th><th style="padding:6px 12px;text-align:right;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Revenue</th></tr>
      ${topClientRows}
    </table>` : ""}

    ${scopedSection}

    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center">
      <p style="color:#94a3b8;font-size:11px;margin:0">Adruvaa Digital Agency — Automated Weekly Report</p>
    </div>
  </div>
</div>
</body>
</html>`;

    /* ── Send emails ── */
    const { data: authUsers } = await admin.auth.admin.listUsers();
    const emailMap: Record<string, string> = {};
    (authUsers?.users || []).forEach((u) => {
      emailMap[u.id] = u.email || "";
    });

    let sent = 0;

    for (const profile of profiles) {
      const email = emailMap[profile.id];
      if (!email) continue;

      let scopedSection = "";

      if (profile.role === "team" || profile.role === "task_manager") {
        // Scoped report for team members
        const myTasks = (tasks || []).filter((t) => t.assigned_to === profile.id);
        const myCompleted = myTasks.filter((t) => t.status === "completed").length;
        const myOverdue = myTasks.filter((t) => t.status === "overdue").length;
        const myPending = myTasks.filter((t) => t.status === "pending").length;
        const myLeads = (leads || []).filter((l) => l.assigned_to === profile.id);
        const myClients = (clients || []).filter((c) => c.assigned_manager === profile.id);

        scopedSection = `
    <h3 style="color:#1e293b;font-size:13px;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin:24px 0 12px">Your Summary</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:8px 0;color:#475569">Your Tasks</td><td style="text-align:right;font-weight:600">${myTasks.length}</td></tr>
      <tr><td style="padding:8px 0;color:#475569">Completed</td><td style="text-align:right;font-weight:600;color:#16a34a">${myCompleted}</td></tr>
      <tr><td style="padding:8px 0;color:#475569">Pending</td><td style="text-align:right;font-weight:600;color:#ca8a04">${myPending}</td></tr>
      <tr><td style="padding:8px 0;color:#475569">Overdue</td><td style="text-align:right;font-weight:600;color:#dc2626">${myOverdue}</td></tr>
      <tr><td style="padding:8px 0;color:#475569">Assigned Leads</td><td style="text-align:right;font-weight:600">${myLeads.length}</td></tr>
      <tr><td style="padding:8px 0;color:#475569">Managed Clients</td><td style="text-align:right;font-weight:600">${myClients.length}</td></tr>
    </table>`;
      }

      const html = buildEmail(profile.name, scopedSection);

      await resend.emails.send({
        from: "Adruvaa Reports <adruvaadsagency@gmail.com>",
        to: [email],
        subject: `📊 Weekly Report — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
        html,
      });

      sent++;
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly report error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
