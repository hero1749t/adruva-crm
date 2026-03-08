import { format } from "date-fns";

/* ── types ── */
interface ReportMetrics {
  totalRevenue: number;
  outstanding: number;
  collectionRate: number;
  activeClients: number;
  completedTasks: number;
  totalTasks: number;
}

interface MonthlyRevenue {
  label: string;
  month: string;
  collected: number;
  billed: number;
}

interface InvoiceStatus {
  name: string;
  value: number;
}

interface TeamPerf {
  fullName: string;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  total: number;
}

interface ClientRevenue {
  name: string;
  revenue: number;
}

export interface ReportExportData {
  metrics: ReportMetrics;
  monthlyRevenue: MonthlyRevenue[];
  invoiceStatusDist: InvoiceStatus[];
  teamPerformance: TeamPerf[];
  clientRevenue: ClientRevenue[];
  dateRange: { start?: Date; end?: Date };
}

/* ── helpers ── */
const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dateRangeLabel(start?: Date, end?: Date) {
  if (!start && !end) return "All Time";
  const s = start ? format(start, "dd MMM yyyy") : "—";
  const e = end ? format(end, "dd MMM yyyy") : "—";
  return `${s} to ${e}`;
}

/* ── CSV export ── */
export function exportReportCsv(data: ReportExportData) {
  const lines: string[] = [];
  const range = dateRangeLabel(data.dateRange.start, data.dateRange.end);
  const ts = format(new Date(), "dd MMM yyyy HH:mm");

  lines.push(`Report Export — ${range}`);
  lines.push(`Generated: ${ts}`);
  lines.push("");

  // KPI summary
  lines.push("KEY METRICS");
  lines.push("Metric,Value");
  lines.push(`Total Revenue,${fmtINR(data.metrics.totalRevenue)}`);
  lines.push(`Outstanding,${fmtINR(data.metrics.outstanding)}`);
  lines.push(`Collection Rate,${data.metrics.collectionRate}%`);
  lines.push(`Active Clients,${data.metrics.activeClients}`);
  lines.push(`Tasks Completed,${data.metrics.completedTasks} / ${data.metrics.totalTasks}`);
  lines.push("");

  // Monthly revenue
  if (data.monthlyRevenue.length) {
    lines.push("MONTHLY REVENUE TREND");
    lines.push("Month,Billed,Collected");
    data.monthlyRevenue.forEach((r) =>
      lines.push(`${r.label},${r.billed},${r.collected}`)
    );
    lines.push("");
  }

  // Invoice status
  if (data.invoiceStatusDist.length) {
    lines.push("INVOICE STATUS DISTRIBUTION");
    lines.push("Status,Count");
    data.invoiceStatusDist.forEach((s) => lines.push(`${s.name},${s.value}`));
    lines.push("");
  }

  // Team performance
  if (data.teamPerformance.length) {
    lines.push("TEAM PERFORMANCE");
    lines.push("Member,Completed,In Progress,Pending,Overdue,Total");
    data.teamPerformance.forEach((m) =>
      lines.push(`${m.fullName},${m.completed},${m.inProgress},${m.pending},${m.overdue},${m.total}`)
    );
    lines.push("");
  }

  // Client revenue
  if (data.clientRevenue.length) {
    lines.push("TOP CLIENTS BY REVENUE");
    lines.push("Client,Revenue");
    data.clientRevenue.forEach((c) => lines.push(`"${c.name}",${c.revenue}`));
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `report-${format(new Date(), "yyyy-MM-dd")}.csv`);
}

/* ── PDF export (HTML → print) ── */
export function exportReportPdf(data: ReportExportData) {
  const range = dateRangeLabel(data.dateRange.start, data.dateRange.end);
  const ts = format(new Date(), "dd MMM yyyy HH:mm");

  const tableStyle = `border-collapse:collapse;width:100%;margin:8px 0 20px;font-size:13px;`;
  const thStyle = `text-align:left;padding:6px 10px;border-bottom:2px solid #334155;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;`;
  const tdStyle = `padding:6px 10px;border-bottom:1px solid #e2e8f0;`;

  const kpiCards = [
    { label: "Total Revenue", value: fmtINR(data.metrics.totalRevenue), color: "#10b981" },
    { label: "Outstanding", value: fmtINR(data.metrics.outstanding), color: "#f59e0b" },
    { label: "Collection Rate", value: `${data.metrics.collectionRate}%`, color: "#3b82f6" },
    { label: "Active Clients", value: data.metrics.activeClients.toString(), color: "#06b6d4" },
  ];

  let html = `<!DOCTYPE html><html><head><title>Report — ${range}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1e293b;padding:30px 40px;max-width:900px;margin:auto}
  h1{font-size:22px;margin:0 0 4px}
  .meta{color:#64748b;font-size:12px;margin-bottom:24px}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
  .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px}
  .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:4px}
  .kpi-value{font-size:22px;font-weight:700}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:0.8px;color:#3b82f6;margin:24px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
  @media print{body{padding:20px}@page{margin:15mm}}
</style></head><body>
<h1>Reports Dashboard</h1>
<div class="meta">${range} &nbsp;·&nbsp; Generated ${ts}</div>

<div class="kpi-grid">${kpiCards.map(k => `
  <div class="kpi">
    <div class="kpi-label">${k.label}</div>
    <div class="kpi-value" style="color:${k.color}">${k.value}</div>
  </div>`).join("")}
</div>`;

  // Monthly Revenue
  if (data.monthlyRevenue.length) {
    html += `<h2>Monthly Revenue Trend</h2>
    <table style="${tableStyle}"><tr><th style="${thStyle}">Month</th><th style="${thStyle}">Billed</th><th style="${thStyle}">Collected</th></tr>
    ${data.monthlyRevenue.map(r => `<tr><td style="${tdStyle}">${r.label}</td><td style="${tdStyle}">${fmtINR(r.billed)}</td><td style="${tdStyle}">${fmtINR(r.collected)}</td></tr>`).join("")}
    </table>`;
  }

  // Invoice Status
  if (data.invoiceStatusDist.length) {
    html += `<h2>Invoice Status Distribution</h2>
    <table style="${tableStyle}"><tr><th style="${thStyle}">Status</th><th style="${thStyle}">Count</th></tr>
    ${data.invoiceStatusDist.map(s => `<tr><td style="${tdStyle}">${s.name}</td><td style="${tdStyle}">${s.value}</td></tr>`).join("")}
    </table>`;
  }

  // Team Performance
  if (data.teamPerformance.length) {
    html += `<h2>Team Performance</h2>
    <table style="${tableStyle}"><tr><th style="${thStyle}">Member</th><th style="${thStyle}">Completed</th><th style="${thStyle}">In Progress</th><th style="${thStyle}">Pending</th><th style="${thStyle}">Overdue</th><th style="${thStyle}">Total</th></tr>
    ${data.teamPerformance.map(m => `<tr><td style="${tdStyle}">${m.fullName}</td><td style="${tdStyle}">${m.completed}</td><td style="${tdStyle}">${m.inProgress}</td><td style="${tdStyle}">${m.pending}</td><td style="${tdStyle}">${m.overdue}</td><td style="${tdStyle}">${m.total}</td></tr>`).join("")}
    </table>`;
  }

  // Client Revenue
  if (data.clientRevenue.length) {
    html += `<h2>Top Clients by Revenue</h2>
    <table style="${tableStyle}"><tr><th style="${thStyle}">Client</th><th style="${thStyle}">Revenue</th></tr>
    ${data.clientRevenue.map(c => `<tr><td style="${tdStyle}">${c.name}</td><td style="${tdStyle}">${fmtINR(c.revenue)}</td></tr>`).join("")}
    </table>`;
  }

  html += `</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
}
