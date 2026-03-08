import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import {
  IndianRupee, TrendingUp, Users, ClipboardList,
  Loader2, BarChart3, CalendarIcon, X, Download, FileText,
} from "lucide-react";
import { exportReportCsv, exportReportPdf, type ReportExportData } from "@/lib/report-export";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { LeadConversionFunnel } from "@/components/reports/LeadConversionFunnel";
import { MrrBreakdownChart } from "@/components/reports/MrrBreakdownChart";
import { LeadSourceChart } from "@/components/reports/LeadSourceChart";

/* ── palette ── */
const COLORS = {
  primary: "hsl(217, 91%, 60%)",
  success: "hsl(160, 84%, 39%)",
  warning: "hsl(38, 92%, 50%)",
  destructive: "hsl(0, 84%, 60%)",
  accent: "hsl(199, 89%, 48%)",
  muted: "hsl(215, 25%, 53%)",
};

const PIE_COLORS = [COLORS.success, COLORS.primary, COLORS.warning, COLORS.destructive, COLORS.muted];

/* ── helpers ── */
const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const monthLabel = (d: string) => {
  const dt = new Date(d + "-01");
  return dt.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};

const ReportsPage = () => {
  const { profile } = useAuth();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  /* ── date range filter ── */
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(subMonths(new Date(), 5)));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const inRange = (dateStr: string | null) => {
    if (!dateStr || (!startDate && !endDate)) return true;
    const d = new Date(dateStr);
    if (startDate && endDate) return isWithinInterval(d, { start: startDate, end: endDate });
    if (startDate) return d >= startDate;
    if (endDate) return d <= endDate;
    return true;
  };

  const presets = [
    { label: "Last 30d", fn: () => { setStartDate(subMonths(new Date(), 1)); setEndDate(endOfMonth(new Date())); }},
    { label: "Last 3m", fn: () => { setStartDate(startOfMonth(subMonths(new Date(), 2))); setEndDate(endOfMonth(new Date())); }},
    { label: "Last 6m", fn: () => { setStartDate(startOfMonth(subMonths(new Date(), 5))); setEndDate(endOfMonth(new Date())); }},
    { label: "This Year", fn: () => { setStartDate(new Date(new Date().getFullYear(), 0, 1)); setEndDate(endOfMonth(new Date())); }},
    { label: "All Time", fn: () => { setStartDate(undefined); setEndDate(undefined); }},
  ];

  /* ── data fetching ── */
  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["reports-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, status, total_amount, due_date, paid_date, created_at, client_id")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: tasks = [], isLoading: taskLoading } = useQuery({
    queryKey: ["reports-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, status, assigned_to, completed_at, created_at, client_id");
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["reports-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, client_name, status, monthly_payment, start_date");
      return data || [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["reports-team"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("status", "active");
      return data || [];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["reports-leads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, status, source, created_at")
        .eq("is_deleted", false);
      return data || [];
    },
  });

  const isLoading = invLoading || taskLoading;

  /* ── filtered data ── */
  const filteredInvoices = useMemo(() => invoices.filter((i) => inRange(i.created_at)), [invoices, startDate, endDate]);
  const filteredTasks = useMemo(() => tasks.filter((t) => inRange(t.created_at)), [tasks, startDate, endDate]);

  /* ── computed metrics ── */
  const metrics = useMemo(() => {
    const totalRevenue = filteredInvoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + (i.total_amount || 0), 0);
    const outstanding = filteredInvoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((s, i) => s + (i.total_amount || 0), 0);
    const totalInvoices = filteredInvoices.length;
    const paidInvoices = filteredInvoices.filter((i) => i.status === "paid").length;
    const collectionRate = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;
    const activeClients = clients.filter((c) => c.status === "active").length;
    const completedTasks = filteredTasks.filter((t) => t.status === "completed").length;
    const totalTasks = filteredTasks.length;

    return { totalRevenue, outstanding, collectionRate, activeClients, completedTasks, totalTasks };
  }, [filteredInvoices, clients, filteredTasks]);

  /* ── monthly revenue trend ── */
  const monthlyRevenue = useMemo(() => {
    const map: Record<string, { month: string; collected: number; billed: number }> = {};
    filteredInvoices.forEach((inv) => {
      const month = (inv.created_at || "").slice(0, 7);
      if (!month) return;
      if (!map[month]) map[month] = { month, collected: 0, billed: 0 };
      map[month].billed += inv.total_amount || 0;
      if (inv.status === "paid") map[month].collected += inv.total_amount || 0;
    });
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((d) => ({ ...d, label: monthLabel(d.month) }));
  }, [filteredInvoices]);

  /* ── invoice status distribution ── */
  const invoiceStatusDist = useMemo(() => {
    const counts: Record<string, number> = { paid: 0, sent: 0, draft: 0, overdue: 0, cancelled: 0 };
    filteredInvoices.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [filteredInvoices]);

  /* ── team performance ── */
  const teamPerformance = useMemo(() => {
    return teamMembers.map((member) => {
      const memberTasks = filteredTasks.filter((t) => t.assigned_to === member.id);
      const completed = memberTasks.filter((t) => t.status === "completed").length;
      const inProgress = memberTasks.filter((t) => t.status === "in_progress").length;
      const overdue = memberTasks.filter(
        (t) => t.status !== "completed" && t.status === "overdue"
      ).length;
      const pending = memberTasks.filter((t) => t.status === "pending").length;
      return {
        name: member.name.split(" ")[0],
        fullName: member.name,
        completed,
        inProgress,
        overdue,
        pending,
        total: memberTasks.length,
      };
    }).filter((m) => m.total > 0)
      .sort((a, b) => b.completed - a.completed);
  }, [teamMembers, filteredTasks]);

  /* ── client revenue ranking ── */
  const clientRevenue = useMemo(() => {
    const map: Record<string, { name: string; revenue: number }> = {};
    filteredInvoices
      .filter((i) => i.status === "paid")
      .forEach((inv) => {
        const client = clients.find((c) => c.id === inv.client_id);
        const name = client?.client_name || "Unknown";
        if (!map[inv.client_id]) map[inv.client_id] = { name, revenue: 0 };
        map[inv.client_id].revenue += inv.total_amount || 0;
      });
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredInvoices, clients]);

  /* ── monthly new clients ── */
  const filteredClients = useMemo(() => clients.filter((c) => inRange(c.start_date)), [clients, startDate, endDate]);
  const monthlyClients = useMemo(() => {
    const map: Record<string, number> = {};
    filteredClients.forEach((c) => {
      const month = (c.start_date || "").slice(0, 7);
      if (!month) return;
      map[month] = (map[month] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ label: monthLabel(month), clients: count }));
  }, [filteredClients]);

  /* ── lead conversion funnel ── */
  const filteredLeads = useMemo(() => leads.filter((l) => inRange(l.created_at)), [leads, startDate, endDate]);
  const leadFunnelData = useMemo(() => {
    const stages = [
      { key: "new_lead", label: "New Lead" },
      { key: "audit_booked", label: "Audit Booked" },
      { key: "audit_done", label: "Audit Done" },
      { key: "in_progress", label: "In Progress" },
      { key: "lead_won", label: "Won" },
      { key: "lead_lost", label: "Lost" },
    ];
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return stages.map((s) => ({ name: s.label, value: counts[s.key] || 0 }));
  }, [filteredLeads]);

  /* ── lead source breakdown ── */
  const leadSourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const src = (l as any).source || "Unknown";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLeads]);

  /* ── MRR breakdown ── */
  const mrrData = useMemo(() => {
    // Build monthly MRR from active clients with monthly_payment
    const activeWithPayment = clients.filter((c) => c.status === "active" && c.monthly_payment && c.start_date);
    const months: Record<string, { mrr: number; clients: number }> = {};

    // Generate months within range
    const now = new Date();
    const rangeStart = startDate || new Date(Math.min(...activeWithPayment.map((c) => new Date(c.start_date!).getTime()), now.getTime()));
    const rangeEnd = endDate || now;

    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cursor <= rangeEnd) {
      const key = cursor.toISOString().slice(0, 7);
      let mrr = 0;
      let count = 0;
      activeWithPayment.forEach((c) => {
        const cStart = new Date(c.start_date!);
        if (cStart <= new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)) {
          mrr += c.monthly_payment!;
          count++;
        }
      });
      months[key] = { mrr, clients: count };
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, d]) => ({ label: monthLabel(month), ...d }));
  }, [clients, startDate, endDate]);

  const customTooltipStyle = {
    backgroundColor: "hsl(218, 49%, 13%)",
    border: "1px solid hsl(213, 50%, 24%)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(214, 32%, 91%)",
  };

  const exportData: ReportExportData = {
    metrics,
    monthlyRevenue,
    invoiceStatusDist,
    teamPerformance,
    clientRevenue,
    dateRange: { start: startDate, end: endDate },
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Revenue analytics, trends & team performance</p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border bg-muted/30 text-xs"
            onClick={() => exportReportCsv(exportData)}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border bg-muted/30 text-xs"
            onClick={() => exportReportPdf(exportData)}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          <div className="flex gap-1">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
                onClick={p.fn}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          {/* From date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 w-[130px] justify-start gap-1.5 border-border bg-muted/30 text-xs",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {startDate ? format(startDate, "dd MMM yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">–</span>

          {/* To date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 w-[130px] justify-start gap-1.5 border-border bg-muted/30 text-xs",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {endDate ? format(endDate, "dd MMM yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => { setStartDate(undefined); setEndDate(undefined); }}
              title="Clear dates"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Revenue", value: fmtINR(metrics.totalRevenue), icon: IndianRupee, accent: "text-success" },
          { label: "Outstanding", value: fmtINR(metrics.outstanding), icon: TrendingUp, accent: "text-warning" },
          { label: "Collection Rate", value: `${metrics.collectionRate}%`, icon: BarChart3, accent: "text-primary" },
          { label: "Active Clients", value: metrics.activeClients.toString(), icon: Users, accent: "text-accent" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
              <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </p>
            </div>
            <p className={`mt-1 font-display text-2xl font-bold ${kpi.accent}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Row 1: Revenue Trend + Invoice Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Trend (area) */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Monthly Revenue Trend
          </h2>
          {monthlyRevenue.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No invoice data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRevenue}>
                <defs>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,50%,24%)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.muted }} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => fmtINR(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="billed" name="Billed" stroke={COLORS.primary} fillOpacity={1} fill="url(#gradBilled)" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke={COLORS.success} fillOpacity={1} fill="url(#gradCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Invoice Status Pie */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Invoice Status
          </h2>
          {invoiceStatusDist.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No invoices yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={invoiceStatusDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {invoiceStatusDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={customTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 2: Team Performance + Client Revenue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Team Performance (stacked bar) */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Team Performance
          </h2>
          {teamPerformance.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No task assignments yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamPerformance} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,50%,24%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11, fill: COLORS.muted }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill={COLORS.success} radius={[0, 0, 0, 0]} />
                <Bar dataKey="inProgress" name="In Progress" stackId="a" fill={COLORS.primary} />
                <Bar dataKey="pending" name="Pending" stackId="a" fill={COLORS.muted} />
                <Bar dataKey="overdue" name="Overdue" stackId="a" fill={COLORS.destructive} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Clients by Revenue (horizontal bar) */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Top Clients by Revenue
          </h2>
          {clientRevenue.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No paid invoices yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientRevenue} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,50%,24%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: COLORS.muted }} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => fmtINR(v)} />
                <Bar dataKey="revenue" name="Revenue" fill={COLORS.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: New Clients Trend */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
          New Clients per Month
        </h2>
        {monthlyClients.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No client data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyClients} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213,50%,24%)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.muted }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} allowDecimals={false} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="clients" name="New Clients" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 4: Lead Funnel + MRR */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LeadConversionFunnel data={leadFunnelData} />
        <MrrBreakdownChart data={mrrData} />
      </div>
    </div>
  );
};

export default ReportsPage;
