import {
  Users,
  UserPlus,
  Trophy,
  XCircle,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  mockLeads,
  mockClients,
  mockTasks,
  mockTeam,
  currentUser,
  leadStatusConfig,
} from "@/lib/mock-data";
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

// Metric card component
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
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="font-display text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

const CHART_COLORS = ["hsl(217, 91%, 60%)", "hsl(199, 89%, 48%)", "hsl(160, 84%, 39%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(215, 25%, 53%)"];

const DashboardPage = () => {
  const totalLeads = mockLeads.filter((l) => !l.is_deleted).length;
  const newThisMonth = mockLeads.filter((l) => l.created_at >= "2026-03-01").length;
  const leadsWon = mockLeads.filter((l) => l.status === "lead_won").length;
  const leadsLost = mockLeads.filter((l) => l.status === "lead_lost").length;
  const activeClients = mockClients.filter((c) => c.status === "active").length;
  const tasksDueToday = mockTasks.filter((t) => t.deadline.startsWith("2026-03-08") && t.status !== "completed").length;
  const overdueTasks = mockTasks.filter((t) => t.status === "overdue").length;
  const revenueThisMonth = mockClients
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (c.monthly_payment || 0), 0);

  // Lead funnel data
  const funnelData = Object.entries(leadStatusConfig).map(([key, config]) => ({
    name: config.label,
    count: mockLeads.filter((l) => l.status === key).length,
  }));

  // Client status donut
  const clientDonut = [
    { name: "Active", value: mockClients.filter((c) => c.status === "active").length },
    { name: "Paused", value: mockClients.filter((c) => c.status === "paused").length },
    { name: "Completed", value: mockClients.filter((c) => c.status === "completed").length },
  ];

  // Revenue line chart (mock 6 months)
  const revenueData = [
    { month: "Oct", revenue: 72000 },
    { month: "Nov", revenue: 84000 },
    { month: "Dec", revenue: 78000 },
    { month: "Jan", revenue: 95000 },
    { month: "Feb", revenue: 102000 },
    { month: "Mar", revenue: revenueThisMonth },
  ];

  // Team task completion
  const teamTaskData = mockTeam
    .filter((m) => m.status === "active" && m.role !== "owner")
    .map((member) => ({
      name: member.name.split(" ")[0],
      completed: mockTasks.filter((t) => t.assigned_to === member.id && t.status === "completed").length,
      in_progress: mockTasks.filter((t) => t.assigned_to === member.id && t.status === "in_progress").length,
      overdue: mockTasks.filter((t) => t.assigned_to === member.id && t.status === "overdue").length,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your agency performance</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total Leads" value={totalLeads} color="bg-primary/15 text-primary" />
        <MetricCard icon={UserPlus} label="New This Month" value={newThisMonth} color="bg-accent/15 text-accent" />
        <MetricCard icon={Trophy} label="Leads Won" value={leadsWon} color="bg-success/15 text-success" />
        <MetricCard icon={XCircle} label="Leads Lost" value={leadsLost} color="bg-destructive/15 text-destructive" />
        <MetricCard icon={UserCheck} label="Active Clients" value={activeClients} color="bg-success/15 text-success" />
        <MetricCard icon={ClipboardList} label="Due Today" value={tasksDueToday} color="bg-warning/15 text-warning" />
        <MetricCard icon={AlertTriangle} label="Overdue Tasks" value={overdueTasks} color="bg-destructive/15 text-destructive" />
        {currentUser.role === "owner" && (
          <MetricCard icon={DollarSign} label="Revenue (Month)" value={`₹${(revenueThisMonth / 1000).toFixed(0)}K`} color="bg-success/15 text-success" />
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lead Funnel */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-base font-bold text-foreground">Lead Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
              <XAxis type="number" stroke="hsl(215, 25%, 53%)" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="hsl(215, 25%, 53%)" fontSize={11} width={100} />
              <Tooltip
                contentStyle={{ background: "hsl(218, 49%, 13%)", border: "1px solid hsl(213, 50%, 24%)", borderRadius: 8, color: "hsl(214, 32%, 91%)" }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {funnelData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client Status Donut */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 font-display text-base font-bold text-foreground">Client Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={clientDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                {clientDonut.map((_, i) => (
                  <Cell key={i} fill={[CHART_COLORS[2], CHART_COLORS[3], CHART_COLORS[5]][i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(218, 49%, 13%)", border: "1px solid hsl(213, 50%, 24%)", borderRadius: 8, color: "hsl(214, 32%, 91%)" }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: "hsl(215, 25%, 53%)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue chart (Owner only) */}
      {currentUser.role === "owner" && (
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

      {/* Team task completion */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-display text-base font-bold text-foreground">Team Task Completion</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={teamTaskData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
            <XAxis dataKey="name" stroke="hsl(215, 25%, 53%)" fontSize={12} />
            <YAxis stroke="hsl(215, 25%, 53%)" fontSize={12} />
            <Tooltip
              contentStyle={{ background: "hsl(218, 49%, 13%)", border: "1px solid hsl(213, 50%, 24%)", borderRadius: 8, color: "hsl(214, 32%, 91%)" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="completed" fill="hsl(160, 84%, 39%)" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="in_progress" fill="hsl(217, 91%, 60%)" stackId="a" />
            <Bar dataKey="overdue" fill="hsl(0, 84%, 60%)" stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardPage;
