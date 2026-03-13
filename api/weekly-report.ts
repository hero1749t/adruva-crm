import { createClient } from "@supabase/supabase-js";

type UserRole = "owner" | "admin" | "team" | "task_manager" | string;

type ProfileRow = {
  id: string;
  name: string;
  role: UserRole;
  status: string;
  email: string | null;
};

type InvoiceRow = {
  id: string;
  status: string | null;
  total_amount: number;
  client_id: string;
  created_at: string | null;
};

type TaskRow = {
  id: string;
  status: string | null;
  assigned_to: string | null;
  client_id: string;
  completed_at: string | null;
  deadline: string | null;
};

type ClientRow = {
  id: string;
  client_name: string;
  status: string | null;
  monthly_payment: number | null;
  assigned_manager: string | null;
};

type LeadRow = {
  id: string;
  status: string;
  source: string | null;
  assigned_to: string | null;
  created_at: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fmtINR = (value: number) => `Rs ${value.toLocaleString("en-IN")}`;
const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
};

const sendResendEmail = async (apiKey: string, payload: Record<string, unknown>) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let details = response.statusText;
    try {
      const body = await response.json();
      details = body?.message || body?.error || JSON.stringify(body);
    } catch {
      // Ignore JSON parse failures and fall back to the status text above.
    }

    throw new Error(`Resend request failed: ${details}`);
  }
};

const getSandboxRecipient = (message: string) => {
  const match = message.match(/\(([^\s)]+@[^\s)]+)\)/);
  return match?.[1] || null;
};

const buildWeeklyEmail = (
  recipientName: string,
  scopedSection: string,
  metrics: {
    totalRevenue: number;
    collectionRate: number;
    outstanding: number;
    activeClients: number;
    mrr: number;
    completedTasks: number;
    totalTasks: number;
    overdueTasks: number;
    totalLeads: number;
    newLeads: number;
    wonLeads: number;
    sourceRows: string;
    topClientRows: string;
  }
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0b1120;font-family:'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased">
<div style="max-width:620px;margin:0 auto;padding:32px 16px">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px 16px 0 0;padding:36px 40px;border:1px solid #1e3a5f;border-bottom:none">
    <table style="width:100%"><tr>
      <td>
        <div style="font-family:'DM Mono','DM Sans',monospace;font-size:11px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Adruva CRM</div>
        <h1 style="margin:0;font-size:24px;font-weight:700;color:#f1f5f9;letter-spacing:-0.3px">Weekly Report</h1>
      </td>
      <td style="text-align:right;vertical-align:top">
        <div style="display:inline-block;background:#60a5fa20;border:1px solid #60a5fa30;border-radius:8px;padding:8px 14px">
          <span style="font-family:'DM Mono',monospace;font-size:12px;color:#93c5fd">${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
      </td>
    </tr></table>
  </div>
  <div style="background:#0f172a;padding:36px 40px;border:1px solid #1e3a5f;border-top:none;border-bottom:none">
    <p style="color:#94a3b8;margin:0 0 28px;font-size:15px;line-height:1.5">Hi <strong style="color:#f1f5f9">${recipientName}</strong>, here's your performance snapshot for the week.</p>
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 20px">
      <tr>
        <td style="padding:20px 16px;background:linear-gradient(135deg,#064e3b,#065f46);border-radius:12px;text-align:center;width:33%">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:#34d399;line-height:1">${fmtINR(metrics.totalRevenue)}</div>
          <div style="font-size:10px;color:#6ee7b7;text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:500">Revenue</div>
        </td>
        <td style="padding:20px 16px;background:linear-gradient(135deg,#1e3a5f,#1e40af20);border-radius:12px;text-align:center;width:33%">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:#60a5fa;line-height:1">${metrics.collectionRate}%</div>
          <div style="font-size:10px;color:#93c5fd;text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:500">Collection</div>
        </td>
        <td style="padding:20px 16px;background:linear-gradient(135deg,#78350f40,#92400e30);border-radius:12px;text-align:center;width:33%">
          <div style="font-family:'DM Mono',monospace;font-size:24px;font-weight:700;color:#fbbf24;line-height:1">${fmtINR(metrics.outstanding)}</div>
          <div style="font-size:10px;color:#fcd34d;text-transform:uppercase;letter-spacing:1.5px;margin-top:8px;font-weight:500">Outstanding</div>
        </td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 32px">
      <tr>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#22d3ee">${metrics.activeClients}</div>
          <div style="font-size:9px;color:#67e8f9;text-transform:uppercase;letter-spacing:1px;margin-top:6px">Clients</div>
        </td>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#34d399">${fmtINR(metrics.mrr)}</div>
          <div style="font-size:9px;color:#6ee7b7;text-transform:uppercase;letter-spacing:1px;margin-top:6px">MRR</div>
        </td>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#a78bfa">${metrics.completedTasks}<span style="color:#64748b;font-size:14px">/${metrics.totalTasks}</span></div>
          <div style="font-size:9px;color:#c4b5fd;text-transform:uppercase;letter-spacing:1px;margin-top:6px">Tasks Done</div>
        </td>
        <td style="padding:16px 12px;background:#1e293b;border-radius:10px;text-align:center;width:25%">
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:${metrics.overdueTasks > 0 ? "#f87171" : "#4ade80"}">${metrics.overdueTasks}</div>
          <div style="font-size:9px;color:${metrics.overdueTasks > 0 ? "#fca5a5" : "#86efac"};text-transform:uppercase;letter-spacing:1px;margin-top:6px">Overdue</div>
        </td>
      </tr>
    </table>
    <div style="margin-bottom:28px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #1e3a5f">Lead Pipeline</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px">Total Leads</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#f1f5f9;font-size:14px;font-family:'DM Mono',monospace">${metrics.totalLeads}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #1e293b">New Leads</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#60a5fa;font-size:14px;font-family:'DM Mono',monospace;border-top:1px solid #1e293b">${metrics.newLeads}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #1e293b">Won</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#34d399;font-size:14px;font-family:'DM Mono',monospace;border-top:1px solid #1e293b">${metrics.wonLeads}</td></tr>
        <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #1e293b">Conversion Rate</td><td style="padding:10px 0;text-align:right;font-weight:700;color:#a78bfa;font-size:14px;font-family:'DM Mono',monospace;border-top:1px solid #1e293b">${pct(metrics.wonLeads, metrics.totalLeads)}%</td></tr>
      </table>
    </div>
    ${metrics.sourceRows ? `<div style="margin-bottom:28px"><div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #1e3a5f">Lead Sources</div><table style="width:100%;border-collapse:collapse"><tr><th style="padding:8px 16px;text-align:left;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Source</th><th style="padding:8px 16px;text-align:right;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Count</th></tr>${metrics.sourceRows}</table></div>` : ""}
    ${metrics.topClientRows ? `<div style="margin-bottom:28px"><div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#60a5fa;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #1e3a5f">Top Clients by Revenue</div><table style="width:100%;border-collapse:collapse"><tr><th style="padding:8px 16px;text-align:left;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Client</th><th style="padding:8px 16px;text-align:right;color:#475569;font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #1e3a5f">Revenue</th></tr>${metrics.topClientRows}</table></div>` : ""}
    ${scopedSection}
  </div>
  <div style="background:#0b1120;border-radius:0 0 16px 16px;padding:24px 40px;border:1px solid #1e3a5f;border-top:none;text-align:center">
    <p style="color:#334155;font-size:11px;margin:0;font-family:'DM Mono',monospace;letter-spacing:0.5px">Adruva CRM automated weekly report</p>
  </div>
</div>
</body>
</html>`;

const getScopedSection = (
  profile: ProfileRow,
  tasks: TaskRow[],
  clients: ClientRow[],
  leads: LeadRow[]
) => {
  if (profile.role !== "team" && profile.role !== "task_manager") {
    return "";
  }

  const myTasks = tasks.filter((task) => task.assigned_to === profile.id);
  const myCompleted = myTasks.filter((task) => task.status === "completed").length;
  const myOverdue = myTasks.filter((task) => task.status === "overdue").length;
  const myPending = myTasks.filter((task) => task.status === "pending").length;
  const myLeads = leads.filter((lead) => lead.assigned_to === profile.id);
  const myClients = clients.filter((client) => client.assigned_manager === profile.id);

  return `
  <div style="margin-top:8px;padding:20px;background:#1e293b;border-radius:12px;border:1px solid #1e3a5f">
    <div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#fbbf24;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px">Your Summary</div>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px">Your Tasks</td><td style="text-align:right;font-weight:700;color:#f1f5f9;font-family:'DM Mono',monospace;font-size:14px">${myTasks.length}</td></tr>
      <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #0f172a">Completed</td><td style="text-align:right;font-weight:700;color:#34d399;font-family:'DM Mono',monospace;font-size:14px;border-top:1px solid #0f172a">${myCompleted}</td></tr>
      <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #0f172a">Pending</td><td style="text-align:right;font-weight:700;color:#fbbf24;font-family:'DM Mono',monospace;font-size:14px;border-top:1px solid #0f172a">${myPending}</td></tr>
      <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #0f172a">Overdue</td><td style="text-align:right;font-weight:700;color:#f87171;font-family:'DM Mono',monospace;font-size:14px;border-top:1px solid #0f172a">${myOverdue}</td></tr>
      <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #0f172a">Assigned Leads</td><td style="text-align:right;font-weight:700;color:#60a5fa;font-family:'DM Mono',monospace;font-size:14px;border-top:1px solid #0f172a">${myLeads.length}</td></tr>
      <tr><td style="padding:10px 0;color:#94a3b8;font-size:14px;border-top:1px solid #0f172a">Managed Clients</td><td style="text-align:right;font-weight:700;color:#22d3ee;font-family:'DM Mono',monospace;font-size:14px;border-top:1px solid #0f172a">${myClients.length}</td></tr>
    </table>
  </div>`;
};

export default async function handler(req: any, res: any) {
  Object.entries(corsHeaders).forEach(([header, value]) => res.setHeader(header, value));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = String(req.headers.authorization || "");
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) {
      return res.status(401).json({ error: "Missing access token" });
    }

    const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
    const resendKey = requireEnv("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({ error: "Your session is invalid. Please log in again." });
    }

    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("id, name, role, status, email")
      .eq("id", user.id)
      .maybeSingle();

    if (currentProfileError) {
      throw currentProfileError;
    }

    if (!currentProfile || (currentProfile.role !== "owner" && currentProfile.role !== "admin")) {
      return res.status(403).json({ error: "Only owners and admins can send the weekly report." });
    }

    const [
      profilesResult,
      invoicesResult,
      tasksResult,
      clientsResult,
      leadsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("id, name, role, status, email").eq("status", "active"),
      supabase.from("invoices").select("id, status, total_amount, client_id, created_at"),
      supabase.from("tasks").select("id, status, assigned_to, client_id, completed_at, deadline"),
      supabase.from("clients").select("id, client_name, status, monthly_payment, assigned_manager"),
      supabase.from("leads").select("id, status, source, assigned_to, created_at").eq("is_deleted", false),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (invoicesResult.error) throw invoicesResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (clientsResult.error) throw clientsResult.error;
    if (leadsResult.error) throw leadsResult.error;

    const profiles = ((profilesResult.data || []) as ProfileRow[])
      .filter((profile) => profile.email)
      .sort((left, right) => {
        if (left.id === currentProfile.id) return -1;
        if (right.id === currentProfile.id) return 1;
        return left.name.localeCompare(right.name);
      });
    const invoices = (invoicesResult.data || []) as InvoiceRow[];
    const tasks = (tasksResult.data || []) as TaskRow[];
    const clients = (clientsResult.data || []) as ClientRow[];
    const leads = (leadsResult.data || []) as LeadRow[];

    if (profiles.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: "No active team members found." });
    }

    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
    const totalRevenue = paidInvoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);
    const outstanding = invoices
      .filter((invoice) => invoice.status === "sent" || invoice.status === "overdue")
      .reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);
    const collectionRate = pct(paidInvoices.length, invoices.length);
    const activeClients = clients.filter((client) => client.status === "active").length;
    const completedTasks = tasks.filter((task) => task.status === "completed").length;
    const overdueTasks = tasks.filter((task) => task.status === "overdue").length;
    const totalTasks = tasks.length;
    const totalLeads = leads.length;
    const wonLeads = leads.filter((lead) => lead.status === "lead_won").length;
    const newLeads = leads.filter((lead) => lead.status === "new_lead").length;
    const mrr = clients
      .filter((client) => client.status === "active" && client.monthly_payment)
      .reduce((sum, client) => sum + (client.monthly_payment || 0), 0);

    const sourceCounts: Record<string, number> = {};
    leads.forEach((lead) => {
      const source = lead.source || "Unknown";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    const sourceRows = Object.entries(sourceCounts)
      .sort((left, right) => right[1] - left[1])
      .map(
        ([source, count]) =>
          `<tr><td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:13px">${source}</td><td style="padding:10px 16px;border-bottom:1px solid #1e293b;text-align:right;color:#f1f5f9;font-weight:600;font-size:13px">${count}</td></tr>`
      )
      .join("");

    const clientRevenueMap: Record<string, { name: string; revenue: number }> = {};
    paidInvoices.forEach((invoice) => {
      const client = clients.find((entry) => entry.id === invoice.client_id);
      const clientName = client?.client_name || "Unknown";
      if (!clientRevenueMap[invoice.client_id]) {
        clientRevenueMap[invoice.client_id] = { name: clientName, revenue: 0 };
      }
      clientRevenueMap[invoice.client_id].revenue += invoice.total_amount || 0;
    });

    const topClientRows = Object.values(clientRevenueMap)
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 5)
      .map(
        (client) =>
          `<tr><td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:13px">${client.name}</td><td style="padding:10px 16px;border-bottom:1px solid #1e293b;text-align:right;color:#34d399;font-weight:700;font-size:13px">${fmtINR(client.revenue)}</td></tr>`
      )
      .join("");

    const sharedMetrics = {
      totalRevenue,
      collectionRate,
      outstanding,
      activeClients,
      mrr,
      completedTasks,
      totalTasks,
      overdueTasks,
      totalLeads,
      newLeads,
      wonLeads,
      sourceRows,
      topClientRows,
    };

    let sent = 0;
    for (const profile of profiles) {
      const html = buildWeeklyEmail(profile.name, getScopedSection(profile, tasks, clients, leads), sharedMetrics);
      try {
        await sendResendEmail(resendKey, {
          from: "Adruva Reports <onboarding@resend.dev>",
          to: [profile.email],
          subject: `Weekly Report - ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
          html,
        });
      } catch (error: any) {
        const message = String(error?.message || "");
        const isSandboxRestriction = message.includes("You can only send testing emails to your own email address");
        const sandboxRecipient = getSandboxRecipient(message);

        if (isSandboxRestriction && sent > 0) {
          return res.status(200).json({
            success: true,
            sent,
            sandboxMode: true,
            warning:
              "Resend is in sandbox mode. The report was sent to your email only. Verify a domain in Resend to send reports to the full team.",
          });
        }

        if (isSandboxRestriction && sandboxRecipient) {
          await sendResendEmail(resendKey, {
            from: "Adruva Reports <onboarding@resend.dev>",
            to: [sandboxRecipient],
            subject: `Weekly Report - ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
            html: buildWeeklyEmail(currentProfile.name, "", sharedMetrics),
          });

          return res.status(200).json({
            success: true,
            sent: 1,
            sandboxMode: true,
            warning:
              "Resend is in sandbox mode. The report was delivered to your Resend account email only. Verify a domain in Resend to send reports to the full team.",
          });
        }

        throw error;
      }

      sent += 1;
    }

    return res.status(200).json({ success: true, sent });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Failed to send weekly report" });
  }
}
