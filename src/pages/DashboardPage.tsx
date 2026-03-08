import {
  Users,
  UserPlus,
  Trophy,
  XCircle,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  DollarSign,
  ChevronRight,
  Activity,
  UserX,
  UserCog,
  Shield,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

const CHART_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(199, 89%, 48%)", "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(215, 25%, 53%)",
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("is_deleted", false);
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*");
      return data || [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks-dashboard"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*, profiles!tasks_assigned_to_fkey(name)");
      return data || [];
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["recent-activity-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*, profiles!activity_logs_user_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = now.toISOString().split("T")[0];

  const totalLeads = leads.length;
  const newThisMonth = leads.filter((l) => l.created_at && l.created_at >= monthStart).length;
  const leadsWon = leads.filter((l) => l.status === "lead_won").length;
  const leadsLost = leads.filter((l) => l.status === "lead_lost").length;
  const activeClients = clients.filter((c) => c.status === "active").length;
  const tasksDueToday = tasks.filter((t) => t.deadline?.startsWith(todayStr) && t.status !== "completed").length;
  const overdueTasks = tasks.filter((t) => t.status === "overdue").length;
  const revenueThisMonth = clients
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (Number(c.monthly_payment) || 0), 0);

  const statusLabels: Record<string, string> = {
    new_lead: "New Lead", audit_booked: "Audit Booked", audit_done: "Audit Done",
    in_progress: "In Progress", lead_won: "Lead Won", lead_lost: "Lead Lost",
  };

  const funnelData = Object.entries(statusLabels).map(([key, name]) => ({
    name,
    count: leads.filter((l) => l.status === key).length,
  }));

  // Conversion funnel: stage-to-stage rates
  const funnelStages = ["new_lead", "audit_booked", "audit_done", "in_progress", "lead_won"];
  const funnelStageLabels = ["New Lead", "Audit Booked", "Audit Done", "In Progress", "Won"];
  const FUNNEL_COLORS = ["hsl(217, 91%, 60%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)", "hsl(160, 84%, 39%)", "hsl(142, 71%, 45%)"];

  const conversionFunnelData = funnelStages.map((stage, i) => {
    // Count leads that reached this stage or beyond
    const reachedCount = leads.filter((l) => {
      const idx = funnelStages.indexOf(l.status as string);
      // lead_lost doesn't count toward funnel progression
      return idx >= i || (l.status === "lead_lost" && funnelStages.indexOf("lead_lost") >= i);
    }).length;
    // For lead_won, only count exact matches
    const count = i === funnelStages.length - 1
      ? leads.filter((l) => l.status === "lead_won").length
      : reachedCount;
    return {
      name: funnelStageLabels[i],
      value: Math.max(count, 0),
      fill: FUNNEL_COLORS[i],
      rate: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(0) + "%" : "0%",
    };
  });

  const clientDonut = [
    { name: "Active", value: clients.filter((c) => c.status === "active").length },
    { name: "Paused", value: clients.filter((c) => c.status === "paused").length },
    { name: "Completed", value: clients.filter((c) => c.status === "completed").length },
  ];

  const revenueData = [
    { month: "Oct", revenue: 72000 },
    { month: "Nov", revenue: 84000 },
    { month: "Dec", revenue: 78000 },
    { month: "Jan", revenue: 95000 },
    { month: "Feb", revenue: 102000 },
    { month: "Mar", revenue: revenueThisMonth },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your agency performance</p>
      </div>

      {overdueTasks > 0 && (
        <div
          className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-3.5 cursor-pointer transition-colors hover:bg-destructive/15"
          onClick={() => navigate("/tasks?status=overdue")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">
                {overdueTasks} overdue task{overdueTasks !== 1 ? "s" : ""} need attention
              </p>
              <p className="text-xs text-destructive/70">Click to view and resolve overdue tasks</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-destructive/50" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total Leads" value={totalLeads} color="bg-primary/15 text-primary" />
        <MetricCard icon={UserPlus} label="New This Month" value={newThisMonth} color="bg-accent/15 text-accent" />
        <MetricCard icon={Trophy} label="Leads Won" value={leadsWon} color="bg-success/15 text-success" />
        <MetricCard icon={XCircle} label="Leads Lost" value={leadsLost} color="bg-destructive/15 text-destructive" />
        <MetricCard icon={UserCheck} label="Active Clients" value={activeClients} color="bg-success/15 text-success" />
        <MetricCard icon={ClipboardList} label="Due Today" value={tasksDueToday} color="bg-warning/15 text-warning" />
        <MetricCard icon={AlertTriangle} label="Overdue Tasks" value={overdueTasks} color="bg-destructive/15 text-destructive" />
        {profile?.role === "owner" && (
          <MetricCard icon={DollarSign} label="Revenue (Month)" value={`₹${(revenueThisMonth / 1000).toFixed(0)}K`} color="bg-success/15 text-success" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-base font-bold text-foreground">Lead Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
              <XAxis type="number" stroke="hsl(215, 25%, 53%)" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="hsl(215, 25%, 53%)" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: "hsl(218, 49%, 13%)", border: "1px solid hsl(213, 50%, 24%)", borderRadius: 8, color: "hsl(214, 32%, 91%)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnelData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-base font-bold text-foreground">Client Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={clientDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                {clientDonut.map((_, i) => (
                  <Cell key={i} fill={[CHART_COLORS[2], CHART_COLORS[3], CHART_COLORS[5]][i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(218, 49%, 13%)", border: "1px solid hsl(213, 50%, 24%)", borderRadius: 8, color: "hsl(214, 32%, 91%)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">Pipeline Conversion Funnel</h3>
            <p className="text-xs text-muted-foreground">Stage-to-stage progression from all {totalLeads} leads</p>
          </div>
        </div>
        {totalLeads === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No leads yet to show conversion data</p>
        ) : (
          <div className="flex flex-col gap-3">
            {conversionFunnelData.map((stage, i) => {
              const pct = totalLeads > 0 ? (stage.value / totalLeads) * 100 : 0;
              const prevPct = i > 0 && conversionFunnelData[i - 1].value > 0
                ? ((stage.value / conversionFunnelData[i - 1].value) * 100).toFixed(0)
                : null;
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                    {stage.name}
                  </span>
                  <div className="relative flex-1 h-9 rounded-lg bg-muted/30 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: stage.fill,
                        opacity: 0.85,
                      }}
                    />
                    <div className="relative z-10 flex h-full items-center justify-between px-3">
                      <span className="text-xs font-bold text-foreground drop-shadow-sm">
                        {stage.value} lead{stage.value !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[10px] font-mono font-medium text-foreground/80 drop-shadow-sm">
                        {stage.rate}
                        {prevPct && (
                          <span className="ml-1.5 text-muted-foreground">
                            ({prevPct}% from prev)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Team Activity */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold text-foreground">Recent Activity</h3>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-1">
            {recentActivity.map((log) => {
              const actionIcons: Record<string, React.ElementType> = {
                member_created: UserPlus,
                member_deleted: Trash2,
                member_deactivated: UserX,
                member_reactivated: UserCheck,
                role_changed: Shield,
              };
              const actionColors: Record<string, string> = {
                member_created: "text-success",
                member_deleted: "text-destructive",
                member_deactivated: "text-warning",
                member_reactivated: "text-success",
                role_changed: "text-primary",
              };
              const ActionIcon = actionIcons[log.action] || UserCog;
              const actionColor = actionColors[log.action] || "text-muted-foreground";
              const meta = (log.metadata as Record<string, string>) || {};
              const userName = (log.profiles as any)?.name || "Unknown";

              let description = log.action.replace(/_/g, " ");
              if (meta.member_name) {
                if (log.action === "role_changed") {
                  description = `Changed ${meta.member_name}'s role from ${meta.old_role} to ${meta.new_role}`;
                } else if (log.action === "member_deactivated") {
                  description = `Deactivated ${meta.member_name}`;
                } else if (log.action === "member_reactivated") {
                  description = `Reactivated ${meta.member_name}`;
                } else if (log.action === "member_created") {
                  description = `Created team member ${meta.member_name}`;
                } else if (log.action === "member_deleted") {
                  description = `Deleted ${meta.member_name}`;
                }
              }

              const getEntityLink = () => {
                const entity = log.entity;
                const id = log.entity_id;
                if (entity === "lead") return `/leads/${id}`;
                if (entity === "client") return `/clients/${id}`;
                if (entity === "task") return `/tasks`;
                if (entity === "team") return `/team`;
                return null;
              };
              const link = getEntityLink();

              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30 ${link ? "cursor-pointer" : ""}`}
                  onClick={() => link && navigate(link)}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 ${actionColor}`}>
                    <ActionIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{userName}</span>{" "}
                      <span className="text-muted-foreground">{description}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {log.entity} · {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {profile?.role === "owner" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-base font-bold text-foreground">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
              <XAxis dataKey="month" stroke="hsl(215, 25%, 53%)" fontSize={12} />
              <YAxis stroke="hsl(215, 25%, 53%)" fontSize={12} tickFormatter={(v) => `₹${v / 1000}K`} />
              <Tooltip
                contentStyle={{ background: "hsl(218, 49%, 13%)", border: "1px solid hsl(213, 50%, 24%)", borderRadius: 8, color: "hsl(214, 32%, 91%)" }}
                formatter={(value: number) => [`₹${value.toLocaleString()}`, "Revenue"]}
              />
              <Line type="monotone" dataKey="revenue" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ fill: "hsl(160, 84%, 39%)", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
