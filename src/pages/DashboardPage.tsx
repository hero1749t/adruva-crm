import { useState, useEffect, useMemo } from "react";
import {
  Users, UserPlus, Trophy, XCircle, UserCheck,
  ClipboardList, AlertTriangle, DollarSign, ChevronRight,
  TrendingDown, CheckSquare, Target, Clock, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { SparklineMetricCard } from "@/components/dashboard/SparklineMetricCard";
import { DateRangeToggle, type DateRange } from "@/components/dashboard/DateRangeToggle";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { TeamLeaderboard } from "@/components/dashboard/TeamLeaderboard";
import { MyWorkCard } from "@/components/dashboard/MyWorkCard";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(199, 89%, 48%)", "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(215, 25%, 53%)",
];
const FUNNEL_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(199, 89%, 48%)", "hsl(38, 92%, 50%)",
  "hsl(160, 84%, 39%)", "hsl(142, 71%, 45%)",
];
const TOOLTIP_STYLE = {
  background: "hsl(222, 47%, 10%)",
  border: "1px solid hsl(222, 30%, 22%)",
  borderRadius: 12,
  color: "hsl(210, 40%, 96%)",
  backdropFilter: "blur(16px)",
};

function getRangeDays(range: DateRange) {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  // Check if user is admin/owner (can see all data)
  const isManager = profile?.role === "owner" || profile?.role === "admin";
  const userId = profile?.id;

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

  // Realtime subscriptions for auto-refresh + toast notifications
  useEffect(() => {
    const channels = [
      supabase.channel("rt-leads").on(
        "postgres_changes", { event: "*", schema: "public", table: "leads" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["leads-dashboard"] });
          if (payload.eventType === "INSERT") toast.success("New lead added!", { duration: 3000 });
        }
      ).subscribe(),
      supabase.channel("rt-clients").on(
        "postgres_changes", { event: "*", schema: "public", table: "clients" },
        () => queryClient.invalidateQueries({ queryKey: ["clients-dashboard"] })
      ).subscribe(),
      supabase.channel("rt-tasks").on(
        "postgres_changes", { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["tasks-dashboard"] });
          if (payload.eventType === "INSERT") toast.info("New task created", { duration: 3000 });
        }
      ).subscribe(),
    ];
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [queryClient]);

  // Filter data based on user role
  const myLeads = useMemo(() => 
    isManager ? leads : leads.filter((l) => l.assigned_to === userId),
    [leads, isManager, userId]
  );
  const myClients = useMemo(() => 
    isManager ? clients : clients.filter((c) => c.assigned_manager === userId),
    [clients, isManager, userId]
  );
  const myTasks = useMemo(() => 
    isManager ? tasks : tasks.filter((t) => t.assigned_to === userId),
    [tasks, isManager, userId]
  );

  const now = new Date();
  const days = getRangeDays(dateRange);
  const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rangeStartISO = rangeStart.toISOString();
  const todayStr = now.toISOString().split("T")[0];

  // Filter data by date range (using filtered data for team members)
  const rangeLeads = useMemo(
    () => myLeads.filter((l) => l.created_at && l.created_at >= rangeStartISO),
    [myLeads, rangeStartISO]
  );
  const rangeTasks = useMemo(
    () => myTasks.filter((t) => t.created_at && t.created_at >= rangeStartISO),
    [myTasks, rangeStartISO]
  );

  // Metrics for team members (personalized)
  const totalLeads = myLeads.length;
  const newInRange = rangeLeads.length;
  const leadsWon = myLeads.filter((l) => l.status === "lead_won").length;
  const leadsLost = myLeads.filter((l) => l.status === "lead_lost").length;
  const activeClients = myClients.filter((c) => c.status === "active").length;
  const tasksDueToday = myTasks.filter((t) => t.deadline?.startsWith(todayStr) && t.status !== "completed").length;
  const overdueTasks = myTasks.filter((t) => t.status === "overdue").length;
  const pendingTasks = myTasks.filter((t) => t.status === "pending" || t.status === "in_progress").length;
  const completedTasks = myTasks.filter((t) => t.status === "completed").length;
  const revenueThisMonth = clients
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (Number(c.monthly_payment) || 0), 0);

  // Sparkline data: leads created per day over range
  const leadsSparkline = useMemo(() => {
    const buckets = Array(Math.min(days, 14)).fill(0);
    const step = days / buckets.length;
    rangeLeads.forEach((l) => {
      if (!l.created_at) return;
      const daysAgo = (now.getTime() - new Date(l.created_at).getTime()) / (24 * 60 * 60 * 1000);
      const idx = Math.min(Math.floor((days - daysAgo) / step), buckets.length - 1);
      if (idx >= 0) buckets[idx]++;
    });
    return buckets;
  }, [rangeLeads, days]);

  const tasksSparkline = useMemo(() => {
    const buckets = Array(Math.min(days, 14)).fill(0);
    const step = days / buckets.length;
    rangeTasks.forEach((t) => {
      if (!t.created_at) return;
      const daysAgo = (now.getTime() - new Date(t.created_at).getTime()) / (24 * 60 * 60 * 1000);
      const idx = Math.min(Math.floor((days - daysAgo) / step), buckets.length - 1);
      if (idx >= 0) buckets[idx]++;
    });
    return buckets;
  }, [rangeTasks, days]);

  // Funnel data (using user's leads)
  const statusLabels: Record<string, string> = {
    new_lead: "New Lead", audit_booked: "Audit Booked", audit_done: "Audit Done",
    in_progress: "In Progress", lead_won: "Lead Won", lead_lost: "Lead Lost",
  };
  const funnelData = Object.entries(statusLabels).map(([key, name]) => ({
    name,
    count: myLeads.filter((l) => l.status === key).length,
    status: key,
  }));

  const funnelStages = ["new_lead", "audit_booked", "audit_done", "in_progress", "lead_won"];
  const funnelStageLabels = ["New Lead", "Audit Booked", "Audit Done", "In Progress", "Won"];
  const conversionFunnelData = funnelStages.map((stage, i) => {
    const reachedCount = myLeads.filter((l) => {
      const idx = funnelStages.indexOf(l.status as string);
      return idx >= i || (l.status === "lead_lost" && funnelStages.indexOf("lead_lost") >= i);
    }).length;
    const count = i === funnelStages.length - 1
      ? myLeads.filter((l) => l.status === "lead_won").length
      : reachedCount;
    return {
      name: funnelStageLabels[i],
      value: Math.max(count, 0),
      fill: FUNNEL_COLORS[i],
      rate: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(0) + "%" : "0%",
    };
  });

  const clientDonut = [
    { name: "Active", value: myClients.filter((c) => c.status === "active").length, status: "active" },
    { name: "Paused", value: myClients.filter((c) => c.status === "paused").length, status: "paused" },
    { name: "Completed", value: myClients.filter((c) => c.status === "completed").length, status: "completed" },
  ];

  // Task completion over range (adaptive weeks)
  const weekCount = Math.min(Math.ceil(days / 7), 12);
  const taskCompletionData = useMemo(() => {
    const weeks: { label: string; completed: number; pending: number; overdue: number }[] = [];
    for (let w = weekCount - 1; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const label = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const completed = myTasks.filter((t) => {
        if (t.status !== "completed" || !t.completed_at) return false;
        const d = new Date(t.completed_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const createdInWeek = myTasks.filter((t) => {
        if (!t.created_at) return false;
        const d = new Date(t.created_at);
        return d >= weekStart && d < weekEnd;
      });
      const pending = createdInWeek.filter((t) => t.status === "pending" || t.status === "in_progress").length;
      const overdueW = createdInWeek.filter((t) => t.status === "overdue").length;
      weeks.push({ label, completed, pending, overdue: overdueW });
    }
    return weeks;
  }, [myTasks, weekCount]);

  const totalCompleted = myTasks.filter((t) => t.status === "completed").length;
  const totalTasks = myTasks.length;
  const completionRate = totalTasks > 0 ? ((totalCompleted / totalTasks) * 100).toFixed(0) : "0";

  const revenueData = [
    { month: "Oct", revenue: 72000 }, { month: "Nov", revenue: 84000 },
    { month: "Dec", revenue: 78000 }, { month: "Jan", revenue: 95000 },
    { month: "Feb", revenue: 102000 }, { month: "Mar", revenue: revenueThisMonth },
  ];

  // Click handlers for chart drill-downs
  const handleFunnelBarClick = (data: any) => {
    if (data?.status) navigate(`/leads?status=${data.status}`);
  };
  const handleDonutClick = (data: any) => {
    if (data?.status) navigate(`/clients?status=${data.status}`);
  };

  // Personal task donut for team members
  const personalTaskDonut = [
    { name: "Completed", value: completedTasks, fill: "hsl(160, 84%, 39%)" },
    { name: "In Progress", value: myTasks.filter((t) => t.status === "in_progress").length, fill: "hsl(217, 91%, 60%)" },
    { name: "Pending", value: myTasks.filter((t) => t.status === "pending").length, fill: "hsl(38, 92%, 50%)" },
    { name: "Overdue", value: overdueTasks, fill: "hsl(0, 84%, 60%)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {isManager ? "Dashboard" : "My Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager ? "Overview of your agency performance" : `Welcome back, ${profile?.name || "Team Member"}! Here's your work summary`}
          </p>
        </div>
        <DateRangeToggle value={dateRange} onChange={setDateRange} />
      </div>

      {!isManager && (
        <MyWorkCard
          leadsCount={totalLeads}
          clientsCount={activeClients}
          pendingTasksCount={pendingTasks}
          onLeadsClick={() => navigate("/leads")}
          onClientsClick={() => navigate("/clients")}
          onTasksClick={() => navigate("/tasks?status=pending")}
        />
      )}

      {overdueTasks > 0 && (
        <div
          className="flex items-center justify-between rounded-2xl glass border-destructive/20 bg-destructive/[0.08] px-5 py-3.5 cursor-pointer transition-all hover:bg-destructive/[0.12] hover:shadow-lg hover:shadow-destructive/5 animate-fade-in"
          onClick={() => navigate("/tasks?status=overdue")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">
                {overdueTasks} overdue task{overdueTasks !== 1 ? "s" : ""} need attention
              </p>
              <p className="text-xs text-destructive/60">Click to view and resolve overdue tasks</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-destructive/40" />
        </div>
      )}

      {/* Metrics Grid - Different for team members */}
      {isManager ? (
        // Manager/Owner view - full metrics
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SparklineMetricCard
            icon={Users} label="Total Leads" value={totalLeads}
            color="bg-primary/15 text-primary"
            sparkData={leadsSparkline} sparkColor="hsl(217, 91%, 60%)"
            onClick={() => navigate("/leads")}
          />
          <SparklineMetricCard
            icon={UserPlus} label={`New (${dateRange})`} value={newInRange}
            color="bg-accent/15 text-accent"
            sparkData={leadsSparkline} sparkColor="hsl(199, 89%, 48%)"
            onClick={() => navigate("/leads")}
          />
          <SparklineMetricCard
            icon={Trophy} label="Leads Won" value={leadsWon}
            color="bg-success/15 text-success" sparkColor="hsl(160, 84%, 39%)"
          />
          <SparklineMetricCard
            icon={XCircle} label="Leads Lost" value={leadsLost}
            color="bg-destructive/15 text-destructive" sparkColor="hsl(0, 84%, 60%)"
          />
          <SparklineMetricCard
            icon={UserCheck} label="Active Clients" value={activeClients}
            color="bg-success/15 text-success"
            onClick={() => navigate("/clients")}
          />
          <SparklineMetricCard
            icon={ClipboardList} label="Due Today" value={tasksDueToday}
            color="bg-warning/15 text-warning"
            sparkData={tasksSparkline} sparkColor="hsl(38, 92%, 50%)"
            onClick={() => navigate("/tasks")}
          />
          <SparklineMetricCard
            icon={AlertTriangle} label="Overdue Tasks" value={overdueTasks}
            color="bg-destructive/15 text-destructive"
            onClick={() => navigate("/tasks?status=overdue")}
          />
          {profile?.role === "owner" && (
            <SparklineMetricCard
              icon={DollarSign} label="Revenue (Month)" value={`₹${(revenueThisMonth / 1000).toFixed(0)}K`}
              color="bg-success/15 text-success" sparkColor="hsl(160, 84%, 39%)"
              onClick={() => navigate("/payments")}
            />
          )}
        </div>
      ) : (
        // Team member view - personal metrics
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SparklineMetricCard
            icon={Target} label="My Leads" value={totalLeads}
            color="bg-primary/15 text-primary"
            sparkData={leadsSparkline} sparkColor="hsl(217, 91%, 60%)"
            onClick={() => navigate("/leads")}
          />
          <SparklineMetricCard
            icon={UserCheck} label="My Clients" value={activeClients}
            color="bg-success/15 text-success"
            onClick={() => navigate("/clients")}
          />
          <SparklineMetricCard
            icon={ClipboardList} label="Total Tasks" value={totalTasks}
            color="bg-accent/15 text-accent"
            sparkData={tasksSparkline} sparkColor="hsl(199, 89%, 48%)"
            onClick={() => navigate("/tasks")}
          />
          <SparklineMetricCard
            icon={CheckCircle2} label="Completed" value={completedTasks}
            color="bg-success/15 text-success"
          />
          <SparklineMetricCard
            icon={Clock} label="Pending" value={pendingTasks}
            color="bg-warning/15 text-warning"
            onClick={() => navigate("/tasks?status=pending")}
          />
          <SparklineMetricCard
            icon={ClipboardList} label="Due Today" value={tasksDueToday}
            color="bg-primary/15 text-primary"
            onClick={() => navigate("/tasks")}
          />
          <SparklineMetricCard
            icon={AlertTriangle} label="Overdue" value={overdueTasks}
            color="bg-destructive/15 text-destructive"
            onClick={() => navigate("/tasks?status=overdue")}
          />
          <SparklineMetricCard
            icon={Trophy} label="Won Leads" value={leadsWon}
            color="bg-success/15 text-success"
          />
        </div>
      )}

      {/* Charts Row - Conditional based on role */}
      {isManager ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl glass p-5 transition-all hover:glow-sm">
            <h3 className="mb-4 font-display text-base font-bold text-foreground">Lead Funnel</h3>
            <p className="mb-2 text-[10px] text-muted-foreground">Click a bar to filter leads</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
                <XAxis type="number" stroke="hsl(215, 25%, 53%)" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="hsl(215, 25%, 53%)" fontSize={11} width={100} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar
                  dataKey="count" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(_: any, idx: number) => handleFunnelBarClick(funnelData[idx])}
                  isAnimationActive={true} animationDuration={800} animationEasing="ease-out"
                >
                  {funnelData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="transition-opacity hover:opacity-80" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl glass p-5 transition-all hover:glow-sm">
            <h3 className="mb-4 font-display text-base font-bold text-foreground">Client Status</h3>
            <p className="mb-2 text-[10px] text-muted-foreground">Click a slice to filter clients</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={clientDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" stroke="none" cursor="pointer"
                  onClick={(data: any) => handleDonutClick(data)}
                  isAnimationActive={true} animationDuration={1000} animationEasing="ease-out"
                >
                  {clientDonut.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS[2], CHART_COLORS[3], CHART_COLORS[5]][i]} className="transition-opacity hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        // Team member - Personal task breakdown and lead status
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl glass p-5 transition-all hover:glow-sm">
            <h3 className="mb-4 font-display text-base font-bold text-foreground">My Task Status</h3>
            <p className="mb-2 text-[10px] text-muted-foreground">Breakdown of your assigned tasks</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={personalTaskDonut.filter(d => d.value > 0)} 
                  cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" stroke="none"
                  isAnimationActive={true} animationDuration={1000} animationEasing="ease-out"
                >
                  {personalTaskDonut.filter(d => d.value > 0).map((entry, i) => (
                    <Cell key={i} fill={entry.fill} className="transition-opacity hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-lg">
            <h3 className="mb-4 font-display text-base font-bold text-foreground">My Lead Pipeline</h3>
            <p className="mb-2 text-[10px] text-muted-foreground">Status of leads assigned to you</p>
            {totalLeads === 0 ? (
              <div className="flex h-[220px] items-center justify-center">
                <p className="text-sm text-muted-foreground">No leads assigned yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData.filter(d => d.count > 0)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
                  <XAxis type="number" stroke="hsl(215, 25%, 53%)" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(215, 25%, 53%)" fontSize={11} width={100} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="count" radius={[0, 4, 4, 0]} cursor="pointer"
                    onClick={(_: any, idx: number) => handleFunnelBarClick(funnelData[idx])}
                    isAnimationActive={true} animationDuration={800} animationEasing="ease-out"
                  >
                    {funnelData.filter(d => d.count > 0).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="transition-opacity hover:opacity-80" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Conversion Funnel - Manager only */}
      {isManager && (
        <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-lg">
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
                  <div
                    key={stage.name}
                    className="flex items-center gap-3 animate-fade-in"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <span className="w-28 shrink-0 text-right text-xs font-medium text-muted-foreground">
                      {stage.name}
                    </span>
                    <div className="relative flex-1 h-9 rounded-lg bg-muted/30 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg transition-all duration-1000 ease-out"
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
                            <span className="ml-1.5 text-muted-foreground">({prevPct}% from prev)</span>
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
      )}

      {/* Task Completion Rate */}
      <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-success" />
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                {isManager ? "Task Completion Rate" : "My Task Progress"}
              </h3>
              <p className="text-xs text-muted-foreground">Weekly breakdown ({dateRange})</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5">
            <span className="text-lg font-bold text-success">{completionRate}%</span>
            <span className="text-[10px] font-medium uppercase text-success/70">Overall</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={taskCompletionData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
            <XAxis dataKey="label" stroke="hsl(215, 25%, 53%)" fontSize={11} />
            <YAxis stroke="hsl(215, 25%, 53%)" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="completed" stackId="a" fill="hsl(160, 84%, 39%)" name="Completed"
              isAnimationActive animationDuration={800}
            />
            <Bar
              dataKey="pending" stackId="a" fill="hsl(38, 92%, 50%)" name="Pending"
              isAnimationActive animationDuration={800}
            />
            <Bar
              dataKey="overdue" stackId="a" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} name="Overdue"
              isAnimationActive animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Team Leaderboard & Live Activity Feed - Manager only shows leaderboard */}
      <div className="grid gap-4 lg:grid-cols-2">
        {isManager && <TeamLeaderboard tasks={rangeTasks} dateRange={dateRange} />}
        <LiveActivityFeed />
        {!isManager && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">Quick Summary</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Completion Rate</span>
                <span className="text-lg font-bold text-success">{completionRate}%</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Leads Won</span>
                <span className="text-lg font-bold text-primary">{leadsWon}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Active Clients</span>
                <span className="text-lg font-bold text-success">{activeClients}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <span className="text-sm text-muted-foreground">Tasks This Week</span>
                <span className="text-lg font-bold text-accent">{rangeTasks.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revenue Chart (owner only) */}
      {profile?.role === "owner" && (
        <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-lg">
          <h3 className="mb-4 font-display text-base font-bold text-foreground">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 50%, 24%)" />
              <XAxis dataKey="month" stroke="hsl(215, 25%, 53%)" fontSize={12} />
              <YAxis stroke="hsl(215, 25%, 53%)" fontSize={12} tickFormatter={(v) => `₹${v / 1000}K`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [`₹${value.toLocaleString()}`, "Revenue"]} />
              <Line
                type="monotone" dataKey="revenue" stroke="hsl(160, 84%, 39%)" strokeWidth={2}
                dot={{ fill: "hsl(160, 84%, 39%)", r: 4 }}
                isAnimationActive animationDuration={1200} animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
