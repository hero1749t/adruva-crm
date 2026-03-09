import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, Trash2, Shield, Pencil, Copy, Users, 
  ChevronDown, ChevronUp, Info, Sparkles, Eye, PenLine, Crown, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  useCustomRoles, type CustomRole, type RolePermissions, type AccessLevel,
  DEFAULT_PERMISSIONS, ROLE_PRESETS, RESOURCE_GROUPS, ACCESS_LEVELS,
  accessLevelToActions,
} from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ─── Access Level Selector ────────────────────────────────────────────────────

const ACCESS_LEVEL_ICONS: Record<AccessLevel, React.ReactNode> = {
  none: <Ban className="h-3 w-3" />,
  view: <Eye className="h-3 w-3" />,
  edit: <PenLine className="h-3 w-3" />,
  full: <Crown className="h-3 w-3" />,
};

const ACCESS_LEVEL_COLORS: Record<AccessLevel, string> = {
  none: "bg-muted text-muted-foreground border-border",
  view: "bg-blue-500/10 text-blue-600 border-blue-500/25",
  edit: "bg-amber-500/10 text-amber-600 border-amber-500/25",
  full: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
};

function AccessLevelPicker({
  value,
  onChange,
  disabled,
}: {
  value: AccessLevel;
  onChange: (level: AccessLevel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {ACCESS_LEVELS.map((level) => (
        <Tooltip key={level.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(level.value)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                value === level.value
                  ? ACCESS_LEVEL_COLORS[level.value]
                  : "bg-transparent text-muted-foreground/50 border-transparent hover:bg-muted/50",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {ACCESS_LEVEL_ICONS[level.value]}
              {level.label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{level.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

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

  const setResourceAccess = (resource: string, level: AccessLevel) => {
    const updated = { ...permissions };
    const actions = accessLevelToActions(level);
    (updated as any)[resource] = { access: level, ...actions };
    onChange(updated);
  };

  const setGroupAccess = (group: typeof RESOURCE_GROUPS[0], level: AccessLevel) => {
    const updated = { ...permissions };
    const actions = accessLevelToActions(level);
    group.resources.forEach(res => {
      (updated as any)[res.key] = { access: level, ...actions };
    });
    onChange(updated);
  };

  const getGroupLevel = (group: typeof RESOURCE_GROUPS[0]): AccessLevel | "mixed" => {
    const levels = group.resources.map(res => (permissions as any)[res.key]?.access || "none");
    const unique = [...new Set(levels)];
    return unique.length === 1 ? unique[0] as AccessLevel : "mixed";
  };

  return (
    <div className="space-y-2">
      {RESOURCE_GROUPS.map((group) => {
        const isExpanded = expandedGroups[group.group];
        const groupLevel = getGroupLevel(group);

        return (
          <div key={group.group} className="rounded-lg border border-border overflow-hidden">
            {/* Group header */}
            <div
              className="flex items-center justify-between px-3 py-2.5 bg-muted/30 cursor-pointer select-none"
              onClick={() => setExpandedGroups(p => ({ ...p, [group.group]: !isExpanded }))}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-sm">{group.icon}</span>
                <span className={cn("font-mono text-[10px] font-semibold uppercase tracking-widest", group.color)}>
                  {group.group}
                </span>
                {groupLevel === "mixed" && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Mixed</Badge>
                )}
                {groupLevel !== "mixed" && groupLevel !== "none" && (
                  <Badge className={cn("h-4 px-1.5 text-[9px] border", ACCESS_LEVEL_COLORS[groupLevel])}>
                    {groupLevel.charAt(0).toUpperCase() + groupLevel.slice(1)}
                  </Badge>
                )}
              </div>
              {!disabled && (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {(["none", "view", "edit", "full"] as AccessLevel[]).map(level => (
                    <button
                      key={level}
                      type="button"
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                        groupLevel === level
                          ? ACCESS_LEVEL_COLORS[level]
                          : "text-muted-foreground/60 hover:bg-muted/60"
                      )}
                      onClick={() => setGroupAccess(group, level)}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Resources */}
            {isExpanded && (
              <div className="divide-y divide-border/40">
                {group.resources.map((res) => {
                  const resourcePerms = (permissions as any)[res.key];
                  const currentLevel: AccessLevel = resourcePerms?.access || "none";
                  return (
                    <div key={res.key} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10">
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <span className="text-base leading-none">{res.icon}</span>
                        <div>
                          <span className="text-sm font-medium text-foreground">{res.label}</span>
                          <p className="text-[10px] text-muted-foreground">{res.description}</p>
                        </div>
                      </div>
                      <AccessLevelPicker
                        value={currentLevel}
                        onChange={(level) => setResourceAccess(res.key, level)}
                        disabled={disabled}
                      />
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
            placeholder="e.g. Account Manager"
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
            <Sparkles className="h-3.5 w-3.5" />
            {showPresets ? "Hide preset templates" : "Start from a preset template"}
          </button>
          {showPresets && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                  className="group/preset rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: preset.color }}
                    />
                    <p className="text-xs font-semibold text-foreground">{preset.label}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground leading-tight">{preset.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permission matrix */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
            Access Control Matrix
          </h4>
          {!isSystem && (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-[10px] font-medium text-emerald-600 hover:underline"
                onClick={() => {
                  const full: any = {};
                  RESOURCE_GROUPS.flatMap(g => g.resources).forEach(r => {
                    full[r.key] = { access: "full", create: true, read: true, update: true, delete: true };
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
    let fullCount = 0;
    let totalCount = 0;
    RESOURCE_GROUPS.flatMap(g => g.resources).forEach(res => {
      totalCount++;
      const level = (perms as any)[res.key]?.access;
      if (level === "full") fullCount++;
    });
    return { fullCount, totalCount };
  };

  const getAccessBadges = (perms: RolePermissions) => {
    const badges: { key: string; icon: string; label: string; level: AccessLevel }[] = [];
    RESOURCE_GROUPS.flatMap(g => g.resources).forEach(res => {
      const level = (perms as any)[res.key]?.access || "none";
      if (level !== "none") {
        badges.push({ key: res.key, icon: res.icon, label: res.label, level });
      }
    });
    return badges;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Notion-style access levels · Define who can view, edit, or fully manage each resource
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
            <div className="mt-1.5 flex flex-wrap gap-2">
              {[
                { label: "Owner", desc: "Full control", color: "bg-red-500/15 text-red-600 border-red-500/25" },
                { label: "Admin", desc: "Manage CRM", color: "bg-blue-500/15 text-blue-600 border-blue-500/25" },
                { label: "Team", desc: "Assigned only", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25" },
                { label: "Task Manager", desc: "Tasks only", color: "bg-amber-500/15 text-amber-600 border-amber-500/25" },
              ].map(r => (
                <span key={r.label} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", r.color)}>
                  {r.label} · {r.desc}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-primary">
              Custom roles extend the base role with Notion-style granular access levels: <strong>None → View → Edit → Full</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Access Level Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {ACCESS_LEVELS.map(level => (
          <div key={level.value} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium", ACCESS_LEVEL_COLORS[level.value])}>
            {ACCESS_LEVEL_ICONS[level.value]}
            <span>{level.label}</span>
            <span className="text-[10px] opacity-70">— {level.description}</span>
          </div>
        ))}
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
              <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-muted/20" />
            ))
          : roles.map((role) => {
              const memberCount = profilesByRole[role.id] || 0;
              const badges = getAccessBadges(role.permissions);

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

                  {/* Members count */}
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {memberCount} member{memberCount !== 1 ? "s" : ""}
                  </div>

                  {/* Access level badges */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {badges.slice(0, 6).map(b => (
                      <span
                        key={b.key}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          ACCESS_LEVEL_COLORS[b.level]
                        )}
                      >
                        {b.icon} {b.label}
                        <span className="opacity-70">{b.level}</span>
                      </span>
                    ))}
                    {badges.length > 6 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{badges.length - 6} more
                      </span>
                    )}
                    {badges.length === 0 && (
                      <span className="text-[10px] text-muted-foreground italic">No permissions set</span>
                    )}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
