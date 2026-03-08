import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Plus, Trash2, Power, PowerOff, Loader2,
  ChevronDown, ChevronRight, Play, Clock, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const TRIGGER_EVENTS = [
  { value: "lead_created", label: "Lead Created", description: "When a new lead is added" },
  { value: "lead_status_changed", label: "Lead Status Changed", description: "When a lead moves to a new stage" },
  { value: "client_created", label: "Client Created", description: "When a new client is onboarded" },
  { value: "task_overdue", label: "Task Overdue", description: "When a task passes its deadline" },
] as const;

const ACTION_TYPES = [
  { value: "assign_to", label: "Assign To User", icon: "👤" },
  { value: "send_notification", label: "Send Notification", icon: "🔔" },
  { value: "create_tasks_from_template", label: "Create Tasks from Template", icon: "📋" },
  { value: "update_status", label: "Update Status", icon: "🔄" },
  { value: "create_activity_log", label: "Log Activity", icon: "📝" },
] as const;

const LEAD_STATUSES = [
  { value: "new_lead", label: "New Lead" },
  { value: "audit_booked", label: "Audit Booked" },
  { value: "audit_done", label: "Audit Done" },
  { value: "in_progress", label: "In Progress" },
  { value: "lead_won", label: "Lead Won" },
  { value: "lead_lost", label: "Lead Lost" },
];

interface ActionConfig {
  type: string;
  config: Record<string, unknown>;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;
  actions: ActionConfig[];
  is_active: boolean;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
}

export function AutomationEngineSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AutomationRule[];
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast({ title: "Automation deleted" });
    },
  });

  const triggerLabel = (event: string) =>
    TRIGGER_EVENTS.find((t) => t.value === event)?.label || event;

  const actionLabel = (type: string) =>
    ACTION_TYPES.find((a) => a.value === type)?.label || type;

  const actionIcon = (type: string) =>
    ACTION_TYPES.find((a) => a.value === type)?.icon || "⚡";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <Zap className="h-5 w-5 text-primary" />
            Automation Engine
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure triggers and actions to automate your workflows
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> New Automation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Automation Rule</DialogTitle>
              </DialogHeader>
              <CreateRuleForm
                onSuccess={() => {
                  setCreateOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center">
          <Zap className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No automations configured yet. Create your first workflow trigger.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isExpanded = expandedRule === rule.id;
            return (
              <div
                key={rule.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Header */}
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/20"
                  onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${rule.is_active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{rule.name}</span>
                      {!rule.is_active && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase text-primary">
                        {triggerLabel(rule.trigger_event)}
                      </span>
                      <span>→</span>
                      <span>
                        {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
                      </span>
                      {rule.execution_count > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" />
                            {rule.execution_count}x
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {isOwnerOrAdmin && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, is_active: v })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteRule.mutate(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-3">
                    {rule.description && (
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    )}

                    {/* Trigger */}
                    <div>
                      <p className="mb-1 font-mono text-[9px] font-medium uppercase tracking-widest text-primary">
                        Trigger
                      </p>
                      <div className="rounded-md border border-border bg-card px-3 py-2">
                        <p className="text-xs font-medium text-foreground">
                          {triggerLabel(rule.trigger_event)}
                        </p>
                        {Object.keys(rule.trigger_conditions).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {Object.entries(rule.trigger_conditions).map(([key, val]) => (
                              <span
                                key={key}
                                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                              >
                                {key}: {String(val)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <p className="mb-1 font-mono text-[9px] font-medium uppercase tracking-widest text-primary">
                        Actions ({rule.actions.length})
                      </p>
                      <div className="space-y-1.5">
                        {rule.actions.map((action, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2"
                          >
                            <span className="text-sm">{actionIcon(action.type)}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground">
                                {actionLabel(action.type)}
                              </p>
                              {Object.entries(action.config || {}).map(([key, val]) => (
                                <span
                                  key={key}
                                  className="mr-1.5 font-mono text-[9px] text-muted-foreground"
                                >
                                  {key}: {String(val)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" /> Executed {rule.execution_count} times
                      </span>
                      {rule.last_executed_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last:{" "}
                          {new Date(rule.last_executed_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Create Rule Form ───────────────────────────────────────

function CreateRuleForm({ onSuccess }: { onSuccess: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<ActionConfig[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-automation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
  });

  const { data: serviceTemplates = [] } = useQuery({
    queryKey: ["service-templates-automation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_templates")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const addAction = (type: string) => {
    const defaultConfig: Record<string, Record<string, unknown>> = {
      assign_to: { user_id: "" },
      send_notification: { title: "Automation", message: "", target: "admins" },
      create_tasks_from_template: { template_id: "" },
      update_status: { status: "" },
      create_activity_log: { content: "" },
    };
    setActions([...actions, { type, config: defaultConfig[type] || {} }]);
  };

  const updateAction = (idx: number, config: Record<string, unknown>) => {
    const updated = [...actions];
    updated[idx] = { ...updated[idx], config };
    setActions(updated);
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim() || !triggerEvent || actions.length === 0) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("automation_rules").insert({
        name: name.trim(),
        description: description.trim() || null,
        trigger_event: triggerEvent,
        trigger_conditions: conditions,
        actions,
        created_by: profile?.id,
      });
      if (error) throw error;
      toast({ title: "Automation created" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const showStatusCondition = triggerEvent === "lead_status_changed";

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Automation Name *
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Lead Won → Create SEO Tasks"
          className="border-border bg-muted/30"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this automation do?"
          className="min-h-[50px] border-border bg-muted/30 text-sm"
        />
      </div>

      {/* Trigger */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
          When (Trigger)
        </p>
        <Select value={triggerEvent} onValueChange={(v) => { setTriggerEvent(v); setConditions({}); }}>
          <SelectTrigger className="border-border bg-background text-sm">
            <SelectValue placeholder="Select trigger event..." />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_EVENTS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <div>
                  <span className="font-medium">{t.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showStatusCondition && (
          <div>
            <label className="text-xs text-muted-foreground">Status changes to:</label>
            <Select
              value={conditions.status_changed_to as string || ""}
              onValueChange={(v) => setConditions({ ...conditions, status_changed_to: v })}
            >
              <SelectTrigger className="mt-1 h-8 border-border bg-background text-xs">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-accent-foreground">
            Then (Actions)
          </p>
          <Select onValueChange={addAction}>
            <SelectTrigger className="h-7 w-[160px] border-border bg-background text-xs">
              <SelectValue placeholder="+ Add action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  <span className="mr-1.5">{a.icon}</span> {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {actions.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Add at least one action
          </p>
        ) : (
          <div className="space-y-2">
            {actions.map((action, idx) => (
              <div key={idx} className="rounded-md border border-border bg-card p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {ACTION_TYPES.find((a) => a.value === action.type)?.icon}{" "}
                    {ACTION_TYPES.find((a) => a.value === action.type)?.label}
                  </span>
                  <button onClick={() => removeAction(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <ActionConfigEditor
                  action={action}
                  teamMembers={teamMembers}
                  serviceTemplates={serviceTemplates}
                  onChange={(config) => updateAction(idx, config)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        className="w-full gap-2"
        onClick={handleSave}
        disabled={saving || !name.trim() || !triggerEvent || actions.length === 0}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {saving ? "Creating..." : "Create Automation"}
      </Button>
    </div>
  );
}

// ─── Action Config Editor ───────────────────────────────────

function ActionConfigEditor({
  action,
  teamMembers,
  serviceTemplates,
  onChange,
}: {
  action: ActionConfig;
  teamMembers: { id: string; name: string; role: string }[];
  serviceTemplates: { id: string; name: string }[];
  onChange: (config: Record<string, unknown>) => void;
}) {
  const { config } = action;

  switch (action.type) {
    case "assign_to":
      return (
        <Select
          value={(config.user_id as string) || ""}
          onValueChange={(v) => onChange({ ...config, user_id: v })}
        >
          <SelectTrigger className="h-8 border-border bg-muted/30 text-xs">
            <SelectValue placeholder="Select user..." />
          </SelectTrigger>
          <SelectContent>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} ({m.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "send_notification":
      return (
        <div className="space-y-1.5">
          <Input
            value={(config.title as string) || ""}
            onChange={(e) => onChange({ ...config, title: e.target.value })}
            placeholder="Notification title"
            className="h-7 border-border bg-muted/30 text-xs"
          />
          <Input
            value={(config.message as string) || ""}
            onChange={(e) => onChange({ ...config, message: e.target.value })}
            placeholder="Message (use {{name}}, {{email}}, {{status}})"
            className="h-7 border-border bg-muted/30 text-xs"
          />
          <Select
            value={(config.target as string) || "admins"}
            onValueChange={(v) => onChange({ ...config, target: v })}
          >
            <SelectTrigger className="h-7 border-border bg-muted/30 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admins">All Admins & Owners</SelectItem>
              <SelectItem value="assigned">Assigned User</SelectItem>
              <SelectItem value="specific">Specific User</SelectItem>
            </SelectContent>
          </Select>
          {config.target === "specific" && (
            <Select
              value={(config.user_id as string) || ""}
              onValueChange={(v) => onChange({ ...config, user_id: v })}
            >
              <SelectTrigger className="h-7 border-border bg-muted/30 text-xs">
                <SelectValue placeholder="Select user..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );

    case "create_tasks_from_template":
      return (
        <Select
          value={(config.template_id as string) || ""}
          onValueChange={(v) => onChange({ ...config, template_id: v })}
        >
          <SelectTrigger className="h-8 border-border bg-muted/30 text-xs">
            <SelectValue placeholder="Select service template..." />
          </SelectTrigger>
          <SelectContent>
            {serviceTemplates.length === 0 ? (
              <SelectItem value="_none" disabled>No templates found</SelectItem>
            ) : (
              serviceTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );

    case "update_status":
      return (
        <Select
          value={(config.status as string) || ""}
          onValueChange={(v) => onChange({ ...config, status: v })}
        >
          <SelectTrigger className="h-8 border-border bg-muted/30 text-xs">
            <SelectValue placeholder="New status..." />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "create_activity_log":
      return (
        <Input
          value={(config.content as string) || ""}
          onChange={(e) => onChange({ ...config, content: e.target.value })}
          placeholder="Log message (use {{name}}, {{status}})"
          className="h-7 border-border bg-muted/30 text-xs"
        />
      );

    default:
      return null;
  }
}
