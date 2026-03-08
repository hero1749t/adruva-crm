import { useState } from "react";
import { logActivity } from "@/hooks/useActivityLog";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, Phone, Mail, Building2, Calendar, IndianRupee,
  Check, X, Pencil, Loader2, ExternalLink, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { useClientHealthScore } from "@/hooks/useClientHealthScore";
import HealthScoreBadge from "@/components/HealthScoreBadge";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { CommunicationLog } from "@/components/CommunicationLog";
import { ClientAIInsights } from "@/components/ClientAIInsights";

type ClientStatus = Database["public"]["Enums"]["client_status"];
type BillingStatus = Database["public"]["Enums"]["billing_status"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

const statusConfig: Record<ClientStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-success/20 text-success" },
  paused: { label: "Paused", color: "bg-warning/20 text-warning" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground" },
};

const billingConfig: Record<BillingStatus, { label: string; color: string }> = {
  paid: { label: "Paid", color: "bg-success/20 text-success" },
  due: { label: "Due", color: "bg-warning/20 text-warning" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
};

const taskStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-primary/20 text-primary" },
  completed: { label: "Completed", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "text-destructive" },
  high: { label: "High", color: "text-warning" },
  medium: { label: "Medium", color: "text-primary" },
  low: { label: "Low", color: "text-muted-foreground" },
};

const planOptions = ["starter", "growth", "premium", "enterprise", "custom"];

const ClientDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, profiles!clients_assigned_manager_fkey(id, name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["client-tasks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, profiles!tasks_assigned_to_fkey(name)")
        .eq("client_id", id!)
        .order("deadline", { ascending: true });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
  });

  const updateClient = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase.from("clients").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      logActivity({ entity: "client", entityId: id!, action: "updated", metadata: { name: client?.client_name } });
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-tasks", id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  };

  const saveEdit = () => {
    if (editingField) {
      const value = editingField === "monthly_payment" ? (parseFloat(editValue) || null) : (editValue || null);
      updateClient.mutate({ [editingField]: value });
      setEditingField(null);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Clients
        </Button>
        <p className="text-center text-muted-foreground">Client not found</p>
      </div>
    );
  }

  const managerProfile = (client as any).profiles;
  const sConf = statusConfig[client.status || "active"];
  const bConf = billingConfig[client.billing_status || "due"];

  const InfoRow = ({
    icon: Icon, label, field, value, editable = true,
  }: {
    icon: typeof Phone; label: string; field: string; value: string | null; editable?: boolean;
  }) => (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
        {editingField === field ? (
          <div className="mt-1 flex items-center gap-1.5">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 border-border bg-muted/30 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={saveEdit}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-foreground">{value || "—"}</p>
            {editable && isOwnerOrAdmin && (
              <button onClick={() => startEdit(field, value || "")} className="opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const { healthScore } = useClientHealthScore(id || "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{client.client_name}</h1>
          {client.company_name && <p className="text-sm text-muted-foreground">{client.company_name}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${sConf.color}`}>
          {sConf.label}
        </span>
        <span className={`rounded-full px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${bConf.color}`}>
          {bConf.label}
        </span>
        {healthScore && (
          <div className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <HealthScoreBadge health={healthScore} size="md" />
            <span className={`font-mono text-[10px] font-medium uppercase tracking-wider ${healthScore.color}`}>
              {healthScore.label}
            </span>
          </div>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left Panel — Client Info */}
        <div className="space-y-4 lg:col-span-2">
          {/* Status & Plan Card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Status & Plan
            </h2>
            <div className="space-y-3">
              <div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Status</p>
                <Select
                  value={client.status || "active"}
                  onValueChange={(v) => updateClient.mutate({ status: v })}
                  disabled={!isOwnerOrAdmin}
                >
                  <SelectTrigger className="h-9 border-border bg-muted/30 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, conf]) => (
                      <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Plan</p>
                <Select
                  value={client.plan || ""}
                  onValueChange={(v) => updateClient.mutate({ plan: v })}
                  disabled={!isOwnerOrAdmin}
                >
                  <SelectTrigger className="h-9 border-border bg-muted/30 text-sm capitalize">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {planOptions.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Billing Status</p>
                <Select
                  value={client.billing_status || "due"}
                  onValueChange={(v) => updateClient.mutate({ billing_status: v })}
                  disabled={!isOwnerOrAdmin}
                >
                  <SelectTrigger className="h-9 border-border bg-muted/30 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(billingConfig).map(([key, conf]) => (
                      <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Account Manager</p>
                <Select
                  value={client.assigned_manager || "unassigned"}
                  onValueChange={(v) => updateClient.mutate({ assigned_manager: v === "unassigned" ? null : v })}
                  disabled={!isOwnerOrAdmin}
                >
                  <SelectTrigger className="h-9 border-border bg-muted/30 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Info Card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Contact Information
            </h2>
            <div className="space-y-0.5">
              <InfoRow icon={Phone} label="Phone" field="phone" value={client.phone} />
              <InfoRow icon={Mail} label="Email" field="email" value={client.email} />
              <InfoRow icon={Building2} label="Company" field="company_name" value={client.company_name} />
              <InfoRow icon={IndianRupee} label="Monthly Payment" field="monthly_payment" value={client.monthly_payment?.toString() || null} />
              <InfoRow icon={Calendar} label="Start Date" field="start_date" value={client.start_date} />
              <InfoRow icon={Calendar} label="Contract End" field="contract_end_date" value={client.contract_end_date} />
            </div>
          </div>

          {/* Onboarding Checklist */}
          <OnboardingChecklist clientId={id!} clientName={client.client_name} />

          {/* Communication Log */}
          <CommunicationLog entityType="client" entityId={id!} />
        </div>

        {/* Right Panel — Tasks */}
        <div className="space-y-4 lg:col-span-3">
          {/* AI Insights */}
          <ClientAIInsights clientId={id!} />

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
                Tasks
              </h2>
              <span className="font-mono text-[10px] text-muted-foreground">
                {completedTasks}/{totalTasks} completed
              </span>
            </div>

            {/* Progress bar */}
            {totalTasks > 0 && (
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
            )}

            {tasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tasks yet. Tasks are auto-created when a lead is won.
              </p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => {
                  const tConf = taskStatusConfig[task.status || "pending"];
                  const pConf = priorityConfig[task.priority || "medium"];
                  const assignee = (task as any).profiles?.name || "Unassigned";
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "completed";

                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border bg-surface/50 p-3 transition-colors hover:bg-muted/30 ${
                        isOverdue ? "border-l-2 border-l-destructive border-t-border border-r-border border-b-border" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{task.task_title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${tConf.color}`}>
                              {tConf.label}
                            </span>
                            <span className={`font-mono text-[9px] font-medium uppercase tracking-wider ${pConf.color}`}>
                              {pConf.label}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {assignee}
                            </span>
                            {task.deadline && (
                              <span className={`font-mono text-[9px] ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                                Due {new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
                          {/* Links row */}
                          {(task.website_link || task.meta_link || task.gmb_link) && (
                            <div className="mt-1.5 flex gap-2">
                              {task.website_link && (
                                <a href={task.website_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> Website
                                </a>
                              )}
                              {task.meta_link && (
                                <a href={task.meta_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> Meta
                                </a>
                              )}
                              {task.gmb_link && (
                                <a href={task.gmb_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> GMB
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Quick status change */}
                        {isOwnerOrAdmin && task.status !== "completed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-success"
                            onClick={() =>
                              updateTask.mutate({
                                taskId: task.id,
                                updates: { status: "completed" as TaskStatus, completed_at: new Date().toISOString() },
                              })
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        {task.status === "completed" && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/20">
                            <Check className="h-4 w-4 text-success" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDetailPage;
