import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Trash2, Shield, Pencil, Copy, Users, Check, X,
  ChevronDown, ChevronUp, Info, Lock, Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useCustomRoles, type CustomRole, type RolePermissions, DEFAULT_PERMISSIONS } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

// ─── Permission config ────────────────────────────────────────────────────────

const RESOURCE_GROUPS = [
  {
    group: "CRM Core",
    color: "text-blue-500",
    resources: [
      { key: "leads", label: "Leads", icon: "👤", actions: ["create", "read", "update", "delete"] },
      { key: "clients", label: "Clients", icon: "🏢", actions: ["create", "read", "update", "delete"] },
      { key: "tasks", label: "Tasks", icon: "✅", actions: ["create", "read", "update", "delete"] },
    ],
  },
  {
    group: "Finance",
    color: "text-emerald-500",
    resources: [
      { key: "invoices", label: "Invoices", icon: "🧾", actions: ["create", "read", "update", "delete"] },
    ],
  },
  {
    group: "Analytics & Reports",
    color: "text-purple-500",
    resources: [
      { key: "reports", label: "Reports", icon: "📊", actions: ["view", "export"] },
    ],
  },
  {
    group: "Administration",
    color: "text-amber-500",
    resources: [
      { key: "team", label: "Team Management", icon: "👥", actions: ["invite", "manage"] },
      { key: "settings", label: "Settings", icon: "⚙️", actions: ["manage"] },
      { key: "roles", label: "Roles & Permissions", icon: "🔐", actions: ["manage"] },
    ],
  },
];

const ACTION_LABELS: Record<string, string> = {
  create: "Create", read: "Read", update: "Edit", delete: "Delete",
  invite: "Invite", manage: "Manage", view: "View", export: "Export",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  read: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  update: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  delete: "bg-red-500/10 text-red-600 border-red-500/20",
  invite: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  manage: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  view: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  export: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
};

// ─── System role presets ──────────────────────────────────────────────────────

const ROLE_PRESETS: Record<string, { label: string; description: string; permissions: RolePermissions }> = {
  content_writer: {
    label: "Content Writer",
    description: "Can view leads and tasks, update tasks assigned to them",
    permissions: {
      leads: { create: false, read: true, update: false, delete: false },
      clients: { create: false, read: true, update: false, delete: false },
      tasks: { create: false, read: true, update: true, delete: false },
      invoices: { create: false, read: false, update: false, delete: false },
      team: { invite: false, manage: false },
      reports: { view: false, export: false },
      settings: { manage: false },
      roles: { manage: false },
    },
  },
  account_manager: {
    label: "Account Manager",
    description: "Full access to leads and clients, can create tasks",
    permissions: {
      leads: { create: true, read: true, update: true, delete: false },
      clients: { create: true, read: true, update: true, delete: false },
      tasks: { create: true, read: true, update: true, delete: false },
      invoices: { create: false, read: true, update: false, delete: false },
      team: { invite: false, manage: false },
      reports: { view: true, export: false },
      settings: { manage: false },
      roles: { manage: false },
    },
  },
  billing_manager: {
    label: "Billing Manager",
    description: "Full invoices access + read-only on clients",
    permissions: {
      leads: { create: false, read: true, update: false, delete: false },
      clients: { create: false, read: true, update: false, delete: false },
      tasks: { create: false, read: true, update: false, delete: false },
      invoices: { create: true, read: true, update: true, delete: false },
      team: { invite: false, manage: false },
      reports: { view: true, export: true },
      settings: { manage: false },
      roles: { manage: false },
    },
  },
  read_only: {
    label: "Read Only",
    description: "Can only view data, no modifications",
    permissions: {
      leads: { create: false, read: true, update: false, delete: false },
      clients: { create: false, read: true, update: false, delete: false },
      tasks: { create: false, read: true, update: false, delete: false },
      invoices: { create: false, read: true, update: false, delete: false },
      team: { invite: false, manage: false },
      reports: { view: true, export: false },
      settings: { manage: false },
      roles: { manage: false },
    },
  },
};

// ─── Permission Matrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  permissions,
  onChange,
  disabled,
}: {
  permissions: RolePermissions;
  onChange: (perms: RolePermissions) => void;
  disabled?: boolean;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    RESOURCE_GROUPS.reduce((acc, g) => ({ ...acc, [g.group]: true }), {})
  );

  const toggle = (resource: string, action: string) => {
    const updated = { ...permissions };
    const res = { ...(updated as any)[resource] };
    res[action] = !res[action];
    (updated as any)[resource] = res;
    onChange(updated);
  };

  const toggleAll = (resource: string, val: boolean) => {
    const updated = { ...permissions };
    const all = RESOURCE_GROUPS.flatMap(g => g.resources).find(r => r.key === resource);
    if (!all) return;
    const res = { ...(updated as any)[resource] };
    all.actions.forEach(a => (res[a] = val));
    (updated as any)[resource] = res;
    onChange(updated);
  };

  const toggleGroup = (group: typeof RESOURCE_GROUPS[0], val: boolean) => {
    let updated = { ...permissions };
    group.resources.forEach(res => {
      const r = { ...(updated as any)[res.key] };
      res.actions.forEach(a => (r[a] = val));
      (updated as any)[res.key] = r;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {RESOURCE_GROUPS.map((group) => {
        const isExpanded = expandedGroups[group.group];
        const allEnabled = group.resources.every(res =>
          res.actions.every(a => (permissions as any)[res.key]?.[a])
        );
        const someEnabled = group.resources.some(res =>
          res.actions.some(a => (permissions as any)[res.key]?.[a])
        );

        return (
          <div key={group.group} className="rounded-lg border border-border overflow-hidden">
            {/* Group header */}
            <div
              className="flex items-center justify-between px-3 py-2 bg-muted/30 cursor-pointer select-none"
              onClick={() => setExpandedGroups(p => ({ ...p, [group.group]: !isExpanded }))}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={cn("font-mono text-[10px] font-semibold uppercase tracking-widest", group.color)}>
                  {group.group}
                </span>
                {someEnabled && !allEnabled && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Partial</Badge>
                )}
                {allEnabled && (
                  <Badge className="h-4 px-1.5 text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/20">Full</Badge>
                )}
              </div>
              {!disabled && (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                    onClick={() => toggleGroup(group, true)}
                  >
                    All
                  </button>
                  <button
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                    onClick={() => toggleGroup(group, false)}
                  >
                    None
                  </button>
                </div>
              )}
            </div>

            {/* Resources */}
            {isExpanded && (
              <div className="divide-y divide-border/40">
                {group.resources.map((res) => {
                  const allResEnabled = res.actions.every(a => (permissions as any)[res.key]?.[a]);
                  return (
                    <div key={res.key} className="flex items-center px-4 py-2.5 hover:bg-muted/10">
                      <div className="flex w-36 shrink-0 items-center gap-2">
                        <span className="text-base leading-none">{res.icon}</span>
                        <span className="text-sm font-medium text-foreground">{res.label}</span>
                      </div>
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        {res.actions.map((action) => {
                          const val = (permissions as any)[res.key]?.[action] ?? false;
                          return (
                            <button
                              key={action}
                              disabled={disabled}
                              onClick={() => toggle(res.key, action)}
                              className={cn(
                                "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                                val
                                  ? ACTION_COLORS[action]
                                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60",
                                disabled && "cursor-not-allowed opacity-60"
                              )}
                            >
                              {val ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                              {ACTION_LABELS[action]}
                            </button>
                          );
                        })}
                      </div>
                      {!disabled && (
                        <button
                          className="ml-2 rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                          onClick={() => toggleAll(res.key, !allResEnabled)}
                          title={allResEnabled ? "Disable all" : "Enable all"}
                        >
                          {allResEnabled ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Role Form ─────────────────────────────────────────────────────────────────

function RoleForm({
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  formPermissions,
  setFormPermissions,
  isSystem,
  onSubmit,
  isPending,
  submitLabel,
}: {
  formName: string;
  setFormName: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formPermissions: RolePermissions;
  setFormPermissions: (p: RolePermissions) => void;
  isSystem?: boolean;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div className="space-y-5 pt-2">
      {/* Name + Description */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Role Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Content Writer"
            className="border-border bg-muted/30"
            disabled={isSystem}
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Description</label>
          <Input
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Brief description"
            className="border-border bg-muted/30"
          />
        </div>
      </div>

      {/* Presets */}
      {!isSystem && (
        <div>
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Info className="h-3.5 w-3.5" />
            {showPresets ? "Hide presets" : "Load from preset template"}
          </button>
          {showPresets && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFormName(preset.label);
                    setFormDescription(preset.description);
                    setFormPermissions(preset.permissions);
                    setShowPresets(false);
                  }}
                  className="rounded-lg border border-border p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <p className="text-xs font-semibold text-foreground">{preset.label}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">{preset.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permission matrix */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">Permission Matrix</h4>
          {!isSystem && (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-[10px] font-medium text-emerald-600 hover:underline"
                onClick={() => {
                  const full: any = {};
                  RESOURCE_GROUPS.flatMap(g => g.resources).forEach(r => {
                    full[r.key] = {};
                    r.actions.forEach(a => (full[r.key][a] = true));
                  });
                  setFormPermissions(full as RolePermissions);
                }}
              >
                Grant All
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                className="text-[10px] font-medium text-red-500 hover:underline"
                onClick={() => setFormPermissions(DEFAULT_PERMISSIONS)}
              >
                Revoke All
              </button>
            </div>
          )}
        </div>
        <PermissionMatrix
          permissions={formPermissions}
          onChange={setFormPermissions}
          disabled={isSystem}
        />
      </div>

      <Button className="w-full gap-2" onClick={onSubmit} disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roles = [], isLoading } = useCustomRoles();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPermissions(DEFAULT_PERMISSIONS);
  };

  const createRole = useMutation({
    mutationFn: async () => {
      if (!formName.trim()) throw new Error("Role name is required");
      const { error } = await supabase.from("custom_roles").insert({
        name: formName.trim(),
        description: formDescription.trim() || null,
        permissions: formPermissions as any,
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast({ title: "Role created" });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateRole = useMutation({
    mutationFn: async (role: CustomRole) => {
      const { error } = await supabase
        .from("custom_roles")
        .update({ name: formName.trim(), description: formDescription.trim() || null, permissions: formPermissions as any })
        .eq("id", role.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast({ title: "Role updated" });
      setEditingRole(null);
      resetForm();
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const duplicateRole = (role: CustomRole) => {
    setFormName(`${role.name} (Copy)`);
    setFormDescription(role.description || "");
    setFormPermissions(role.permissions);
    setCreateOpen(true);
  };

  const startEdit = (role: CustomRole) => {
    setFormName(role.name);
    setFormDescription(role.description || "");
    setFormPermissions(role.permissions);
    setEditingRole(role);
  };

  // Member count per role
  const { data: profilesByRole = {} } = useQuery({
    queryKey: ["profiles-role-count"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("custom_role_id");
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.custom_role_id) counts[p.custom_role_id] = (counts[p.custom_role_id] || 0) + 1;
      });
      return counts;
    },
  });

  const getPermSummary = (perms: RolePermissions) => {
    const enabled = Object.entries(perms).reduce(
      (sum, [, acts]) => sum + Object.values(acts as Record<string, boolean>).filter(Boolean).length,
      0
    );
    const total = Object.entries(perms).reduce(
      (sum, [, acts]) => sum + Object.keys(acts as Record<string, boolean>).length,
      0
    );
    return { enabled, total };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define granular access control for your agency team
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Role
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">Create Custom Role</DialogTitle>
            </DialogHeader>
            <RoleForm
              formName={formName}
              setFormName={setFormName}
              formDescription={formDescription}
              setFormDescription={setFormDescription}
              formPermissions={formPermissions}
              setFormPermissions={setFormPermissions}
              onSubmit={() => createRole.mutate()}
              isPending={createRole.isPending}
              submitLabel="Create Role"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* System roles info */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">System Role Hierarchy</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Owner</span> → Full control, billing, team management ·{" "}
              <span className="font-medium text-foreground">Admin</span> → Manage leads, clients, tasks, reports ·{" "}
              <span className="font-medium text-foreground">Team</span> → Access only assigned records ·{" "}
              <span className="font-medium text-foreground">Task Manager</span> → View & update assigned tasks only
            </p>
            <p className="mt-1 text-xs text-primary">
              Custom roles below extend the "Team" base role with granular permissions.
            </p>
          </div>
        </div>
      </div>

      {/* Edit dialog */}
      {editingRole && (
        <Dialog open={!!editingRole} onOpenChange={(o) => { if (!o) { setEditingRole(null); resetForm(); } }}>
          <DialogContent className="border-border bg-card sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">
                Edit: {editingRole.name}
                {editingRole.is_system && (
                  <Badge variant="secondary" className="ml-2 text-xs">System</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <RoleForm
              formName={formName}
              setFormName={setFormName}
              formDescription={formDescription}
              setFormDescription={setFormDescription}
              formPermissions={formPermissions}
              setFormPermissions={setFormPermissions}
              isSystem={editingRole.is_system}
              onSubmit={() => updateRole.mutate(editingRole)}
              isPending={updateRole.isPending}
              submitLabel="Save Changes"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Roles grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-muted/20" />
            ))
          : roles.map((role) => {
              const memberCount = profilesByRole[role.id] || 0;
              const { enabled, total } = getPermSummary(role.permissions);
              const pct = total > 0 ? Math.round((enabled / total) * 100) : 0;

              return (
                <div
                  key={role.id}
                  className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-sm font-bold text-foreground">{role.name}</h3>
                          {role.is_system && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">System</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {role.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(role)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateRole(role)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate</TooltipContent>
                      </Tooltip>
                      {!role.is_system && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{role.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {memberCount > 0
                                  ? `${memberCount} member(s) are assigned this role and will lose custom permissions.`
                                  : "This cannot be undone."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteRole.mutate(role.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{enabled}/{total} permissions</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct >= 80 ? "bg-amber-500" : pct >= 50 ? "bg-primary" : "bg-emerald-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Permission chips preview */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {RESOURCE_GROUPS.flatMap(g => g.resources).map(res => {
                      const perms = (role.permissions as any)[res.key];
                      if (!perms) return null;
                      const enabledActions = res.actions.filter(a => perms[a]);
                      if (enabledActions.length === 0) return null;
                      return (
                        <span
                          key={res.key}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {res.icon} {res.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
