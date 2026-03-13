import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2, MoreHorizontal, UserX, UserCheck, Shield, Pencil, Copy, Users, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Navigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { logActivity } from "@/hooks/useActivityLog";
import { useCustomRoles, type CustomRole, type RolePermissions, DEFAULT_PERMISSIONS, ROLE_PRESETS, RESOURCE_GROUPS, ACCESS_LEVELS, accessLevelToActions, type AccessLevel } from "@/hooks/usePermissions";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Ban, Eye, PenLine, Crown, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const roleBadge: Record<string, string> = {
  owner: "bg-destructive/20 text-destructive",
  admin: "bg-primary/20 text-primary",
  task_manager: "bg-warning/20 text-warning",
  team: "bg-success/20 text-success",
};

const statusBadge: Record<string, string> = {
  active: "bg-success/20 text-success",
  inactive: "bg-muted text-muted-foreground",
};

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters").max(72),
  role: z.enum(["admin", "team", "task_manager"]),
});

// ─── Access Level Picker ──────────────────────────────────────────────────────

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

function AccessLevelPicker({ value, onChange, disabled }: { value: AccessLevel; onChange: (level: AccessLevel) => void; disabled?: boolean }) {
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

function PermissionMatrix({ permissions, onChange, disabled }: { permissions: RolePermissions; onChange: (perms: RolePermissions) => void; disabled?: boolean }) {
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
                {groupLevel !== "none" && groupLevel !== "mixed" && (
                  <Badge className={cn("h-4 px-1.5 text-[9px] border", ACCESS_LEVEL_COLORS[groupLevel])}>
                    {groupLevel.charAt(0).toUpperCase() + groupLevel.slice(1)}
                  </Badge>
                )}
                {groupLevel === "mixed" && <Badge variant="outline" className="h-4 px-1.5 text-[9px]">Mixed</Badge>}
              </div>
              {!disabled && (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {(["none", "view", "edit", "full"] as AccessLevel[]).map(level => (
                    <button
                      key={level}
                      type="button"
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                        groupLevel === level ? ACCESS_LEVEL_COLORS[level] : "text-muted-foreground/60 hover:bg-muted/60"
                      )}
                      onClick={() => setGroupAccess(group, level)}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isExpanded && (
              <div className="divide-y divide-border/40">
                {group.resources.map((res) => {
                  const currentLevel: AccessLevel = (permissions as any)[res.key]?.access || "none";
                  return (
                    <div key={res.key} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10">
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <span className="text-base leading-none">{res.icon}</span>
                        <div>
                          <span className="text-sm font-medium text-foreground">{res.label}</span>
                          <p className="text-[10px] text-muted-foreground">{res.description}</p>
                        </div>
                      </div>
                      <AccessLevelPicker value={currentLevel} onChange={(level) => setResourceAccess(res.key, level)} disabled={disabled} />
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

// ─── Delete Member Dialog with Reassignment ───────────────────────────────────

function DeleteMemberDialog({
  member,
  team,
  onConfirm,
  isPending,
}: {
  member: { id: string; name: string };
  team: { id: string; name: string; role: string; status: string }[];
  onConfirm: (reassignTo: string | null) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState<string>("none");
  const [showCounts, setShowCounts] = useState<{ leads: number; clients: number; tasks: number } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const activeMembers = team.filter(m => m.id !== member.id && m.status === "active" && m.role !== "owner");

  const loadCounts = async () => {
    setLoadingCounts(true);
    try {
      const [leads, clients, tasks] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", member.id).not("status", "in", '("lead_won","lead_lost")'),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("assigned_manager", member.id).eq("status", "active"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assigned_to", member.id).in("status", ["pending", "in_progress"]),
      ]);
      setShowCounts({
        leads: leads.count || 0,
        clients: clients.count || 0,
        tasks: tasks.count || 0,
      });
    } catch {
      setShowCounts({ leads: 0, clients: 0, tasks: 0 });
    } finally {
      setLoadingCounts(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        setReassignTo("none");
        setShowCounts(null);
        loadCounts();
      }
    }}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => e.preventDefault()}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete User
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete {member.name}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            This will permanently remove this user. This action cannot be undone.
          </p>

          {loadingCounts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking active assignments...
            </div>
          ) : showCounts && (showCounts.leads > 0 || showCounts.clients > 0 || showCounts.tasks > 0) ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-warning">
                <ArrowRightLeft className="h-4 w-4" />
                Active Assignments Found
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                {showCounts.leads > 0 && <span>{showCounts.leads} active lead{showCounts.leads > 1 ? "s" : ""}</span>}
                {showCounts.clients > 0 && <span>{showCounts.clients} active client{showCounts.clients > 1 ? "s" : ""}</span>}
                {showCounts.tasks > 0 && <span>{showCounts.tasks} active task{showCounts.tasks > 1 ? "s" : ""}</span>}
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Reassign to
                </label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger className="border-border bg-muted/30">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't reassign (nullify)</SelectItem>
                    {activeMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Active leads, clients and tasks will be transferred to this member
                </p>
              </div>
            </div>
          ) : showCounts ? (
            <p className="text-sm text-muted-foreground">No active assignments found for this member.</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm(reassignTo === "none" ? null : reassignTo);
              setOpen(false);
            }}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TeamPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { can } = usePermissions();
  const { data: customRoles = [] } = useCustomRoles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "team", customRoleId: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState<string>("");

  const canInvite = can("team", "invite");
  const canManage = can("team", "manage");

  if (profile && !canInvite && !canManage && profile.role !== "owner") {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      return data || [];
    },
  });

  const createMember = useMutation({
    mutationFn: async () => {
      const parsed = createUserSchema.safeParse(formData);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
        setFormErrors(errs);
        throw new Error("Validation failed");
      }
      setFormErrors({});
      const { data: userId, error } = await supabase.rpc("create_team_member" as any, {
        p_name: parsed.data.name,
        p_email: parsed.data.email,
        p_password: parsed.data.password,
        p_role: parsed.data.role,
      });

      if (error || !userId) {
        throw new Error(error?.message || "Failed to create user");
      }

      if (formData.customRoleId) {
        const { error: customRoleError } = await supabase
          .from("profiles")
          .update({ custom_role_id: formData.customRoleId })
          .eq("id", userId as string);
        if (customRoleError) {
          throw new Error(customRoleError.message);
        }
      }
      return { userId, name: parsed.data.name, role: parsed.data.role, email: parsed.data.email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Team member created" });
      setFormData({ name: "", email: "", password: "", role: "team", customRoleId: "" });
      setDialogOpen(false);
      logActivity({ entity: "team", entityId: data.userId as string, action: "member_created", metadata: { member_name: data.name, role: data.role, email: data.email } });
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
    },
  });

  const deleteMember = useMutation({
    mutationFn: async ({ userId, memberName, reassignTo }: { userId: string; memberName: string; reassignTo: string | null }) => {
      const { error } = await supabase.rpc("delete_team_member" as any, {
        p_user_id: userId,
        p_reassign_to: reassignTo,
      });
      if (error) throw new Error(error.message || "Failed to delete user");
      return { memberName, userId, reassignedTo: reassignTo };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Team member deleted" });
      logActivity({ entity: "team", entityId: data.userId, action: "member_deleted", metadata: { member_name: data.memberName } });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete user", description: err.message, variant: "destructive" });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole, memberName, oldRole }: { userId: string; newRole: string; memberName: string; oldRole: string }) => {
      const { error } = await supabase.from("profiles").update({ role: newRole as any }).eq("id", userId);
      if (error) throw error;
      return { userId, newRole, memberName, oldRole };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Role updated" });
      setRoleEditId(null);
      logActivity({ entity: "team", entityId: data.userId, action: "role_changed", metadata: { member_name: data.memberName, old_role: data.oldRole, new_role: data.newRole } });
    },
    onError: (err: Error) => toast({ title: "Failed to update role", description: err.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ userId, currentStatus, memberName }: { userId: string; currentStatus: string; memberName: string }) => {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const { error } = await supabase.from("profiles").update({ status: newStatus as any }).eq("id", userId);
      if (error) throw error;
      return { userId, newStatus, memberName, oldStatus: currentStatus };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: data.newStatus === "active" ? "Member reactivated" : "Member deactivated" });
      logActivity({ entity: "team", entityId: data.userId, action: data.newStatus === "active" ? "member_reactivated" : "member_deactivated", metadata: { member_name: data.memberName } });
    },
    onError: (err: Error) => toast({ title: "Failed to update status", description: err.message, variant: "destructive" }),
  });

  const updateCustomRole = useMutation({
    mutationFn: async ({ userId, customRoleId }: { userId: string; customRoleId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ custom_role_id: customRoleId }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Permission role updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const getCustomRoleName = (customRoleId: string | null) => {
    if (!customRoleId) return null;
    const role = customRoles.find(r => r.id === customRoleId);
    return role?.name || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">{team.length} members</p>
        </div>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {profile?.role === "owner" && <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Create User</Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-card sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display text-xl font-bold text-foreground">Create Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Name <span className="text-destructive">*</span></label>
                    <Input value={formData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Full name" className="border-border bg-muted/30" />
                    {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Email <span className="text-destructive">*</span></label>
                    <Input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="user@company.com" className="border-border bg-muted/30" />
                    {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Password <span className="text-destructive">*</span></label>
                    <Input type="password" value={formData.password} onChange={(e) => updateField("password", e.target.value)} placeholder="Min 8 characters" className="border-border bg-muted/30" />
                    {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">System Role <span className="text-destructive">*</span></label>
                    <Select value={formData.role} onValueChange={(v) => updateField("role", v)}>
                      <SelectTrigger className="border-border bg-muted/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="task_manager">Task Manager</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {customRoles.filter((r) => r.name !== "Owner").length > 0 && (
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Permission Role</label>
                      <Select value={formData.customRoleId} onValueChange={(v) => updateField("customRoleId", v)}>
                        <SelectTrigger className="border-border bg-muted/30"><SelectValue placeholder="Select permission role" /></SelectTrigger>
                        <SelectContent>
                          {customRoles.filter((r) => r.name !== "Owner").map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">Assigns granular permissions via a custom role</p>
                    </div>
                  )}
                  <Button className="w-full gap-2" onClick={() => createMember.mutate()} disabled={createMember.isPending}>
                    {createMember.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Name</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">System Role</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Permission Role</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  team.map((member) => {
                    const isOwner = member.role === "owner";
                    const isSelf = member.id === profile?.id;
                    const customRoleName = getCustomRoleName(member.custom_role_id);

                    return (
                      <tr key={member.id} className="border-b border-border/50 transition-colors hover:bg-primary/[0.03]">
                        <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                        <td className="px-4 py-3">
                          {roleEditId === member.id ? (
                            <Select
                              value={roleEditValue}
                              onValueChange={(v) => {
                                setRoleEditValue(v);
                                updateRole.mutate({ userId: member.id, newRole: v, memberName: member.name, oldRole: member.role });
                              }}
                            >
                              <SelectTrigger className="h-8 w-28 border-border bg-muted/30 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="task_manager">Task Manager</SelectItem>
                                <SelectItem value="team">Team</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${roleBadge[member.role] || ""}`}>
                              {member.role}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isOwner ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : !isSelf && profile?.role === "owner" ? (
                            <Select
                              value={member.custom_role_id || "none"}
                              onValueChange={(v) => updateCustomRole.mutate({ userId: member.id, customRoleId: v === "none" ? null : v })}
                            >
                              <SelectTrigger className="h-8 w-36 border-border bg-muted/30 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No custom role</SelectItem>
                                {customRoles.filter(r => r.name !== "Owner").map(r => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">{customRoleName || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusBadge[member.status] || ""}`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isOwner && !isSelf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setRoleEditId(member.id); setRoleEditValue(member.role); }}>
                                  Change System Role
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleStatus.mutate({ userId: member.id, currentStatus: member.status, memberName: member.name })}>
                                  {member.status === "active" ? <><UserX className="mr-2 h-4 w-4" /> Deactivate</> : <><UserCheck className="mr-2 h-4 w-4" /> Reactivate</>}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DeleteMemberDialog
                                  member={{ id: member.id, name: member.name }}
                                  team={team as any}
                                  onConfirm={(reassignTo) => deleteMember.mutate({ userId: member.id, memberName: member.name, reassignTo })}
                                  isPending={deleteMember.isPending}
                                />
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {profile?.role === "owner" && (
          <TabsContent value="roles" className="mt-4">
            <RolesSection customRoles={customRoles} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

/* ─── Roles & Permissions Section (Notion-style) ─── */

function RolesSection({ customRoles }: { customRoles: CustomRole[] }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const roles = customRoles;

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [showPresets, setShowPresets] = useState(false);

  const resetForm = () => { setFormName(""); setFormDescription(""); setFormPermissions(DEFAULT_PERMISSIONS); setShowPresets(false); };

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

  const updateRoleMut = useMutation({
    mutationFn: async (role: CustomRole) => {
      const { error } = await supabase.from("custom_roles").update({ name: formName.trim(), description: formDescription.trim() || null, permissions: formPermissions as any }).eq("id", role.id);
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

  const getAccessBadges = (perms: RolePermissions) => {
    const badges: { key: string; icon: string; label: string; level: AccessLevel }[] = [];
    RESOURCE_GROUPS.flatMap(g => g.resources).forEach(res => {
      const level = (perms as any)[res.key]?.access || "none";
      if (level !== "none") badges.push({ key: res.key, icon: res.icon, label: res.label, level });
    });
    return badges;
  };

  const roleFormContent = (onSubmit: () => void, isPending: boolean, submitLabel: string, isSystem?: boolean) => (
    <div className="space-y-5 pt-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Role Name <span className="text-destructive">*</span></label>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Account Manager" className="border-border bg-muted/30" disabled={isSystem} />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Description</label>
          <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Brief description" className="border-border bg-muted/30" />
        </div>
      </div>
      {!isSystem && (
        <div>
          <button type="button" onClick={() => setShowPresets(!showPresets)} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Sparkles className="h-3.5 w-3.5" />
            {showPresets ? "Hide presets" : "Start from a preset"}
          </button>
          {showPresets && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                <button key={key} type="button" onClick={() => { setFormName(preset.label); setFormDescription(preset.description); setFormPermissions(preset.permissions); setShowPresets(false); }}
                  className="group/preset rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-all">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                    <p className="text-xs font-semibold text-foreground">{preset.label}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground leading-tight">{preset.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">Access Control Matrix</h4>
          {!isSystem && (
            <div className="flex gap-2">
              <button type="button" className="text-[10px] font-medium text-emerald-600 hover:underline" onClick={() => {
                const full: any = {};
                RESOURCE_GROUPS.flatMap(g => g.resources).forEach(r => { full[r.key] = { access: "full", create: true, read: true, update: true, delete: true }; });
                setFormPermissions(full as RolePermissions);
              }}>Grant All</button>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-[10px] font-medium text-red-500 hover:underline" onClick={() => setFormPermissions(DEFAULT_PERMISSIONS)}>Revoke All</button>
            </div>
          )}
        </div>
        <PermissionMatrix permissions={formPermissions} onChange={setFormPermissions} disabled={isSystem} />
      </div>
      <Button className="w-full gap-2" onClick={onSubmit} disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Roles & Permissions
          </h2>
          <p className="text-sm text-muted-foreground">Create custom roles with Notion-style access levels: None → View → Edit → Full</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New Role</Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">Create Custom Role</DialogTitle>
            </DialogHeader>
            {roleFormContent(() => createRole.mutate(), createRole.isPending, "Create Role")}
          </DialogContent>
        </Dialog>
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
        <Dialog open={!!editingRole} onOpenChange={(open) => { if (!open) { setEditingRole(null); resetForm(); } }}>
          <DialogContent className="border-border bg-card sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">
                Edit: {editingRole.name} {editingRole.is_system && <Badge variant="secondary" className="ml-2 text-xs">System</Badge>}
              </DialogTitle>
            </DialogHeader>
            {roleFormContent(() => updateRoleMut.mutate(editingRole), updateRoleMut.isPending, "Save Changes", editingRole.is_system)}
          </DialogContent>
        </Dialog>
      )}

      {/* Roles grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const memberCount = profilesByRole[role.id] || 0;
          const badges = getAccessBadges(role.permissions);
          return (
            <div key={role.id} className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-bold text-foreground">{role.name}</h3>
                      {role.is_system && <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">System</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{role.description || "No description"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(role)}><Pencil className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateRole(role)}><Copy className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
                  {!role.is_system && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{role.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>{memberCount > 0 ? `${memberCount} member(s) will lose custom permissions.` : "This cannot be undone."}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteRole.mutate(role.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {badges.slice(0, 6).map(b => (
                  <span key={b.key} className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", ACCESS_LEVEL_COLORS[b.level])}>
                    {b.icon} {b.label} <span className="opacity-70">{b.level}</span>
                  </span>
                ))}
                {badges.length > 6 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{badges.length - 6} more</span>}
                {badges.length === 0 && <span className="text-[10px] text-muted-foreground italic">No permissions set</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TeamPage;
