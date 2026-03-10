import { useState } from "react";
import { logActivity } from "@/hooks/useActivityLog";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft, Phone, Mail, Building2, Calendar, IndianRupee,
  Check, X, Pencil, Loader2, ExternalLink, Activity,
  ClipboardList, FileText, MessageSquare, BarChart3, Settings2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { useClientHealthScore } from "@/hooks/useClientHealthScore";
import HealthScoreBadge from "@/components/HealthScoreBadge";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { CommunicationLog } from "@/components/CommunicationLog";
import { ClientAIInsights } from "@/components/ClientAIInsights";
import { ApplyServiceTemplateDialog } from "@/components/ApplyServiceTemplateDialog";
import { CustomFieldsSection } from "@/components/CustomFieldsSection";

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
  const isOwner = profile?.role === "owner";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const { healthScore } = useClientHealthScore(id || "");

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

  const { data: invoices = [] } = useQuery({
    queryKey: ["client-invoices", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", id!)
        .order("due_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch team members for assign dropdown - only show team/task_manager (not owner/admin)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-assignable"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("status", "active")
        .in("role", ["team", "task_manager"])
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

  const deleteClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", id!);
      if (error) throw error;
      logActivity({ entity: "client", entityId: id!, action: "deleted", metadata: { name: client?.client_name } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client deleted" });
      navigate("/clients");
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
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
    // Log blocked access attempt when client is not found (likely due to RLS)
    if (id && profile?.id) {
      logActivity({
        entity: "security",
        entityId: id,
        action: "access_denied",
        metadata: {
          resource: "client",
          reason: "client_not_found_or_unauthorized",
          userRole: profile.role,
        },
      });
    }
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

  const invoiceStats = {
    total: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    pending: invoices.filter((i) => i.status === "sent" || i.status === "draft").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
    totalAmount: invoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0),
    paidAmount: invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0),
  };

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

      {/* Tabbed Layout */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 text-xs">
            <ClipboardList className="h-3.5 w-3.5" /> Tasks
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px]">{totalTasks}</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Invoices
            <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px]">{invoices.length}</span>
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" /> Communication
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" /> Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Left: Client Info */}
            <div className="space-y-4 lg:col-span-2">
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
                      <SelectTrigger className="h-9 border-border bg-muted/30 text-sm"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger className="h-9 border-border bg-muted/30 text-sm capitalize"><SelectValue placeholder="Select plan" /></SelectTrigger>
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
                      <SelectTrigger className="h-9 border-border bg-muted/30 text-sm"><SelectValue /></SelectTrigger>
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
                      <SelectTrigger className="h-9 border-border bg-muted/30 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
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

              {/* Custom Fields */}
              <CustomFieldsSection entityType="client" entityId={id!} />
            </div>

            {/* Right: Summary Cards */}
            <div className="space-y-4 lg:col-span-3">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tasks</p>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">{completedTasks}/{totalTasks}</p>
                  <p className="text-[10px] text-muted-foreground">completed</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Invoices</p>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">{invoiceStats.paid}/{invoiceStats.total}</p>
                  <p className="text-[10px] text-muted-foreground">paid</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Revenue</p>
                  <p className="mt-1 font-display text-2xl font-bold text-success">₹{(invoiceStats.paidAmount / 1000).toFixed(0)}K</p>
                  <p className="text-[10px] text-muted-foreground">collected</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Overdue</p>
                  <p className="mt-1 font-display text-2xl font-bold text-destructive">{invoiceStats.overdue}</p>
                  <p className="text-[10px] text-muted-foreground">invoices</p>
                </div>
              </div>

              {/* Onboarding */}
              <OnboardingChecklist clientId={id!} clientName={client.client_name} />

              {/* Task Progress */}
              {totalTasks > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
                    Task Progress
                  </h2>
                  <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {completedTasks} of {totalTasks} tasks completed ({totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%)
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
                Tasks ({completedTasks}/{totalTasks} completed)
              </h2>
              {isOwnerOrAdmin && (
                <ApplyServiceTemplateDialog
                  clientId={id!}
                  clientName={client.client_name}
                  assignedManager={client.assigned_manager}
                />
              )}
            </div>

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
                            <span className="font-mono text-[9px] text-muted-foreground">{assignee}</span>
                            {task.deadline && (
                              <span className={`font-mono text-[9px] ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                                Due {new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>
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
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
              <p className="mt-1 font-display text-xl font-bold text-foreground">₹{invoiceStats.totalAmount.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Collected</p>
              <p className="mt-1 font-display text-xl font-bold text-success">₹{invoiceStats.paidAmount.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pending</p>
              <p className="mt-1 font-display text-xl font-bold text-warning">{invoiceStats.pending}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Overdue</p>
              <p className="mt-1 font-display text-xl font-bold text-destructive">{invoiceStats.overdue}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_100px_100px_80px] gap-2 border-b border-border bg-surface px-4 py-2.5">
              <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Invoice</span>
              <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Amount</span>
              <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Due Date</span>
              <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</span>
              <span />
            </div>
            {invoices.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No invoices yet</div>
            ) : (
              invoices.map((inv) => {
                const statusColors: Record<string, string> = {
                  paid: "bg-success/20 text-success",
                  sent: "bg-primary/20 text-primary",
                  draft: "bg-muted text-muted-foreground",
                  overdue: "bg-destructive/20 text-destructive",
                  cancelled: "bg-muted text-muted-foreground",
                };
                return (
                  <div key={inv.id} className="grid grid-cols-[1fr_100px_100px_100px_80px] items-center gap-2 border-b border-border/50 px-4 py-2.5">
                    <span className="text-sm font-medium text-foreground">{inv.invoice_number}</span>
                    <span className="text-sm text-foreground">₹{Number(inv.total_amount).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(inv.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${statusColors[inv.status] || ""}`}>
                      {inv.status}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => navigate(`/invoices`)}
                    >
                      View
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Communication Tab */}
        <TabsContent value="communication">
          <CommunicationLog entityType="client" entityId={id!} />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <ClientAIInsights clientId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetailPage;
