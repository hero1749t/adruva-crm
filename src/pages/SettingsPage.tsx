import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  Check,
  X,
  Loader2,
  Sun,
  Moon,
  Bell,
  CalendarClock,
  Clock,
  AlertTriangle,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  Timer,
  Repeat,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type TaskPriority = Database["public"]["Enums"]["task_priority"];

interface Template {
  id: string;
  title: string;
  priority: TaskPriority | null;
  deadline_offset_days: number | null;
  sort_order: number | null;
  is_active: boolean | null;
}

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "bg-destructive" },
  { value: "high", label: "High", color: "bg-warning" },
  { value: "medium", label: "Medium", color: "bg-primary" },
  { value: "low", label: "Low", color: "bg-muted-foreground" },
];

// Helper to extract function name from cron command URL
const extractFunctionName = (command: string): string => {
  const match = command.match(/functions\/v1\/([a-z0-9-]+)/);
  return match ? match[1] : "unknown";
};

// Friendly schedule descriptions
const describeSchedule = (schedule: string): string => {
  const map: Record<string, string> = {
    "0 * * * *": "Every hour",
    "*/30 * * * *": "Every 30 minutes",
    "30 2 * * *": "Daily at 8:00 AM IST",
    "0 7 * * *": "Daily at 12:30 PM IST",
    "* * * * *": "Every minute",
  };
  return map[schedule] || schedule;
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

interface CronJob {
  jobid: number;
  schedule: string;
  command: string;
  active: boolean;
  last_run: {
    status: string;
    start_time: string;
    end_time: string;
    return_message: string;
  } | null;
}

const CronJobsMonitor = () => {
  const { data: jobs = [], isLoading, refetch, isFetching } = useQuery<CronJob[]>({
    queryKey: ["cron-jobs-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("cron-status");
      if (error) throw error;
      return data.jobs || [];
    },
    refetchInterval: 60000, // auto-refresh every minute
  });

  // Deduplicate by function name, keeping the latest jobid
  const deduped = Object.values(
    jobs.reduce<Record<string, CronJob>>((acc, job) => {
      const name = extractFunctionName(job.command);
      if (!acc[name] || job.jobid > acc[name].jobid) acc[name] = job;
      return acc;
    }, {})
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Scheduled Jobs
          </h2>
          <p className="text-sm text-muted-foreground">
            Automated background tasks and their last execution status
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border max-w-full">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-[1fr_150px_100px_180px] gap-2 border-b border-border bg-surface px-4 py-2.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Function
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Schedule
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Status
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Last Execution
            </span>
          </div>

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-b border-border/50 px-4 py-3">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : deduped.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No scheduled jobs found.
            </div>
          ) : (
            deduped.map((job) => {
              const fnName = extractFunctionName(job.command);
              const lastRun = job.last_run;
              const isSuccess = lastRun?.status === "succeeded";
              const isFailed = lastRun?.status === "failed";

              return (
                <div
                  key={job.jobid}
                  className={cn(
                    "grid grid-cols-[1fr_150px_100px_180px] items-center gap-2 border-b border-border/50 px-4 py-3 transition-colors",
                    !job.active && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{fnName}</span>
                      {!job.active && (
                        <span className="ml-2 text-[10px] font-medium uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {describeSchedule(job.schedule)}
                  </span>
                  <div>
                    {!lastRun ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : isSuccess ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span className="text-xs font-medium text-success">Success</span>
                      </div>
                    ) : isFailed ? (
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-xs font-medium text-destructive">Failed</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{lastRun.status}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {lastRun?.start_time ? formatTime(lastRun.start_time) : "Never"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">About scheduled jobs</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><strong>check-overdue</strong> — Marks tasks past deadline as overdue (hourly)</li>
          <li><strong>deadline-reminder</strong> — Sends email & in-app notifications for tasks due today/tomorrow (daily 8 AM IST)</li>
          <li>Status auto-refreshes every 60 seconds</li>
        </ul>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
  const [editDays, setEditDays] = useState(7);

  // New template state
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDays, setNewDays] = useState(7);

  // Notification preferences
  type NotifPrefs = { due_tomorrow: boolean; due_today: boolean; overdue: boolean };
  const defaultPrefs: NotifPrefs = { due_tomorrow: true, due_today: true, overdue: true };

  const { data: notifPrefs = defaultPrefs } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("due_tomorrow, due_today, overdue")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as NotifPrefs | null) || defaultPrefs;
    },
    enabled: !!user,
  });

  const updateNotifPref = useMutation({
    mutationFn: async (updates: Partial<NotifPrefs>) => {
      const merged = { ...notifPrefs, ...updates };
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          { user_id: user!.id, ...merged, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast({ title: "Preferences saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["task-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_templates")
        .select("*")
        .order("sort_order", { ascending: true });
      return (data || []) as Template[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const maxOrder = templates.reduce((m, t) => Math.max(m, t.sort_order || 0), 0);
      const { error } = await supabase.from("task_templates").insert({
        title: newTitle.trim(),
        priority: newPriority,
        deadline_offset_days: newDays,
        sort_order: maxOrder + 1,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "Template created" });
      setNewTitle("");
      setNewPriority("medium");
      setNewDays(7);
      setShowNew(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Template> }) => {
      const { error } = await supabase
        .from("task_templates")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      setEditingId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditPriority(t.priority || "medium");
    setEditDays(t.deadline_offset_days || 7);
  };

  const saveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    updateTemplate.mutate({
      id,
      updates: {
        title: editTitle.trim(),
        priority: editPriority,
        deadline_offset_days: editDays,
      },
    });
  };

  return (
    <div className="space-y-8 min-w-0">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage task templates and default configurations
        </p>
      </div>

      {/* Appearance Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Appearance
          </h2>
          <p className="text-sm text-muted-foreground">
            Customize how the app looks
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            {theme === "dark" ? (
              <Moon className="h-5 w-5 text-primary" />
            ) : (
              <Sun className="h-5 w-5 text-warning" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </p>
              <p className="text-xs text-muted-foreground">
                {theme === "dark"
                  ? "Switch to light mode for a brighter interface"
                  : "Switch to dark mode for easier viewing in low light"}
              </p>
            </div>
          </div>
          <Switch checked={theme === "light"} onCheckedChange={toggleTheme} />
        </div>
      </div>

      {/* Notification Preferences Section */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Notification Preferences
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose which task deadline reminders you receive
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-border overflow-hidden">
          {([
            { key: "due_tomorrow" as const, label: "Due tomorrow", desc: "Get notified 1 day before a task deadline", icon: <CalendarClock className="h-4 w-4 text-primary" /> },
            { key: "due_today" as const, label: "Due today", desc: "Get notified on the day a task is due", icon: <Clock className="h-4 w-4 text-warning" /> },
            { key: "overdue" as const, label: "Overdue", desc: "Get notified when a task passes its deadline", icon: <AlertTriangle className="h-4 w-4 text-destructive" /> },
          ]).map((item, i) => (
            <div
              key={item.key}
              className={cn(
                "flex items-center justify-between px-4 py-3",
                i < 2 && "border-b border-border"
              )}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Switch
                checked={notifPrefs[item.key]}
                onCheckedChange={(checked) => updateNotifPref.mutate({ [item.key]: checked })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Task Templates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              Task Templates
            </h2>
            <p className="text-sm text-muted-foreground">
              Templates are auto-created when a lead is converted to a client
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setShowNew(true)}
            disabled={showNew}
          >
            <Plus className="h-4 w-4" /> Add Template
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border max-w-full">
          <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-[1fr_140px_120px_80px_60px] gap-2 border-b border-border bg-surface px-4 py-2.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Task Title
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Priority
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Deadline (days)
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Active
            </span>
            <span />
          </div>

          {/* New template row */}
          {showNew && (
            <div className="grid grid-cols-[1fr_140px_120px_80px_60px] items-center gap-2 border-b border-border bg-primary/[0.03] px-4 py-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title"
                className="h-8 border-border bg-muted/30 text-sm"
                autoFocus
              />
              <Select value={newPriority} onValueChange={(v) => setNewPriority(v as TaskPriority)}>
                <SelectTrigger className="h-8 border-border bg-muted/30 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", p.color)} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                max={365}
                value={newDays}
                onChange={(e) => setNewDays(Number(e.target.value))}
                className="h-8 border-border bg-muted/30 text-sm"
              />
              <div />
              <div className="flex gap-1">
                <button
                  onClick={() => newTitle.trim() && createTemplate.mutate()}
                  disabled={!newTitle.trim() || createTemplate.isPending}
                  className="rounded p-1 text-success hover:bg-success/10 disabled:opacity-40"
                >
                  {createTemplate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => { setShowNew(false); setNewTitle(""); }}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Template rows */}
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-b border-border/50 px-4 py-3">
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : templates.length === 0 && !showNew ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No task templates yet. Add one to auto-generate tasks for new clients.
            </div>
          ) : (
            templates.map((template) => {
              const isEditing = editingId === template.id;
              const prio = priorityOptions.find((p) => p.value === template.priority) || priorityOptions[2];

              return (
                <div
                  key={template.id}
                  className={cn(
                    "grid grid-cols-[1fr_140px_120px_80px_60px] items-center gap-2 border-b border-border/50 px-4 py-2 transition-colors",
                    !template.is_active && "opacity-50"
                  )}
                >
                  {isEditing ? (
                    <>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8 border-border bg-muted/30 text-sm"
                        autoFocus
                      />
                      <Select value={editPriority} onValueChange={(v) => setEditPriority(v as TaskPriority)}>
                        <SelectTrigger className="h-8 border-border bg-muted/30 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              <div className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full", p.color)} />
                                {p.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={editDays}
                        onChange={(e) => setEditDays(Number(e.target.value))}
                        className="h-8 border-border bg-muted/30 text-sm"
                      />
                      <div />
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveEdit(template.id)}
                          className="rounded p-1 text-success hover:bg-success/10"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                        <span className="text-sm text-foreground">{template.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", prio.color)} />
                        <span className="text-sm text-muted-foreground">{prio.label}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {template.deadline_offset_days} day{template.deadline_offset_days !== 1 ? "s" : ""}
                      </span>
                      <Switch
                        checked={!!template.is_active}
                        onCheckedChange={(checked) =>
                          updateTemplate.mutate({ id: template.id, updates: { is_active: checked } })
                        }
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(template)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTemplate.mutate(template.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How templates work</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>When a lead status changes to <strong>"Lead Won"</strong>, the lead is automatically converted to a client</li>
            <li>All active templates are created as tasks for that new client</li>
            <li>The <strong>deadline offset</strong> sets how many days from conversion the task is due</li>
            <li>Tasks inherit the template's <strong>priority</strong> and are assigned to the lead's manager</li>
          </ul>
        </div>
      </div>

      {/* Recurring Tasks Section */}
      <RecurringTasksSection />

      {/* Cron Jobs Monitoring Section */}
      <CronJobsMonitor />
    </div>
  );
};

export default SettingsPage;
