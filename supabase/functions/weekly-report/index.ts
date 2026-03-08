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
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#0b1120;font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased">
<div style="max-width:620px;margin:0 auto;padding:32px 16px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px 16px 0 0;padding:36px 40px;border:1px solid #1e3a5f;border-bottom:none">
    <table style="width:100%"><tr>
      <td>
        <div style="font-family:'DM Mono','DM Sans',monospace;font-size:11px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Adruvaa CRM</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px">Weekly Report</h1>
      </td>
      <td style="text-align:right;vertical-align:top">
        <div style="display:inline-block;background:#60a5fa20;border:1px solid #60a5fa30;border-radius:8px;padding:8px 14px">
          <span style="font-family:'DM Mono',monospace;font-size:12px;color:#93c5fd">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
      </td>
    </tr></table>
  </div>

  <!-- Body -->
  <div style="background:#0f172a;padding:36px 40px;border:1px solid #1e3a5f;border-top:none;border-bottom:none">
    <p style="color:#94a3b8;margin:0 0 28px;font-size:15px;line-height:1.5">Hi <strong style="color:#f1f5f9">${recipientName}</strong>, here's your performance snapshot for the week.</p>

    <!-- Primary KPIs -->
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 20px">
      <tr>
        <td style="padding:20px 16px;background:linear-gradient(135deg,#064e3b,#065f46);border-radius:12px;text-align:center;width:33%">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:#34d399;line-height:1">${fmtINR(totalRevenue)}</div>
          <div style="font-size:10px;color:#6ee7b7;text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:500">Revenue</div>
        </td>
        <td style="padding:20px 16px;background:linear-gradient(135deg,#1e3a5f,#1e40af20);border-radius:12px;text-align:center;width:33%">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:#60a5fa;line-height:1">${collectionRate}%</div>
          <div style="font-size:10px;color:#93c5fd;text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:500">Collection</div>
        </td>
        <td style="padding:20px 16px;background:linear-gradient(135deg,#78350f40,#92400e30);border-radius:12px;text-align:center;width:33%">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:#fbbf24;line-height:1">${fmtINR(outstanding)}</div>
          <div style="font-size:10px;color:#fcd34d;text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:500">Outstanding</div>
        </td>
      </tr>
    </table>

    <!-- Secondary KPIs -->
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 32px">
      <tr>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#22d3ee">${activeClients}</div>
          <div style="font-size:9px;color:#67e8f9;text-transform:uppercase;letter-spacing:1px;margin-top:6px">Clients</div>
        </td>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#34d399">${fmtINR(mrr)}</div>
          <div style="font-size:9px;color:#6ee7b7;text-transform:uppercase;letter-spacing:1px;margin-top:6px">MRR</div>
        </td>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#a78bfa">${completedTasks}<span style="color:#64748b;font-size:14px">/${totalTasks}</span></div>
          <div style="font-size:9px;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px;margin-top:6px">Tasks Done</div>
        </td>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:${overdueTasks > 0 ? '#f87171' : '#4ade80'}">${overdueTasks}</div>
          <div style="font-size:9px;color:${overdueTasks > 0 ? '#fca5a5' : '#86efac'};text-transform:uppercase;letter-spacing:1px;margin-top:6px">Overdue</div>
        </td>
      </tr>
    </table>

    <!-- Lead Pipeline -->
    <div style="margin-bottom:28px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #1e3a5f">Lead Pipeline</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px">Total Leads</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#f1f5f9;font-size:14px;font-family:'DM Mono',monospace">${totalLeads}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #1e293b">New Leads</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#60a5fa;font-size:14px;font-family:'DM Mono',monospace;border-top:1px solid #1e293b">${newLeads}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #1e293b">Won</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#34d399;font-size:14px;font-family:'DM Mono',monospace;border-top:1px solid #1e293b">${wonLeads}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #1e293b">Conversion Rate</td><td style="padding:10px 0;text-align:right;font-weight:700;color:#a78bfa;font-size:14px;font-family:'DM Mono',monospace;border-top:1px solid #1e293b">${pct(wonLeads, totalLeads)}%</td></tr>
      </table>
    </div>

    ${sourceRows ? `
    <div style="margin-bottom:28px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #1e3a5f">Lead Sources</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><th style="padding:8px 16px;text-align:left;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Source</th><th style="padding:8px 16px;text-align:right;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Count</th></tr>
        ${sourceRows}
      </table>
    </div>` : ""}

    ${topClientRows ? `
    <div style="margin-bottom:28px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #1e3a5f">Top Clients by Revenue</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><th style="padding:8px 16px;text-align:left;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Client</th><th style="padding:8px 16px;text-align:right;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Revenue</th></tr>
        ${topClientRows}
      </table>
    </div>` : ""}

    ${scopedSection}
  </div>

  <!-- Footer -->
  <div style="background:#0b1120;border-radius:0 0 16px 16px;padding:24px 40px;border:1px solid #1e3a5f;border-top:none;text-align:center">
    <p style="color:#334155;font-size:11px;margin:0;font-family:'DM Mono',monospace;letter-spacing:0.5px">Adruvaa Digital Agency — Automated Weekly Report</p>
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
