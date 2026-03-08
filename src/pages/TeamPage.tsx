import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2, MoreHorizontal, UserX, UserCheck, Shield, Pencil, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Navigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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
import { useCustomRoles, type CustomRole, type RolePermissions, DEFAULT_PERMISSIONS } from "@/hooks/usePermissions";
import { usePermissions } from "@/hooks/usePermissions";

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

  // Only owners and admins with invite permission can view team page
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

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(parsed.data),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create user");

      // Assign custom role if selected
      if (formData.customRoleId && result.userId) {
        await supabase.from("profiles").update({ custom_role_id: formData.customRoleId }).eq("id", result.userId);
      }

      return { ...result, name: parsed.data.name, role: parsed.data.role, email: parsed.data.email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-role-count"] });
      toast({ title: "Team member created" });
      setFormData({ name: "", email: "", password: "", role: "team", customRoleId: "" });
      setDialogOpen(false);
      logActivity({ entity: "team", entityId: data.userId, action: "member_created", metadata: { member_name: data.name, role: data.role, email: data.email } });
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") {
        toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
      }
    },
  });

  const deleteMember = useMutation({
    mutationFn: async ({ userId, memberName }: { userId: string; memberName: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-team-member`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to delete user");
      return { ...result, memberName, userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({ title: "Team member deleted" });
      logActivity({ entity: "team", entityId: data.userId, action: "member_deleted", metadata: { member_name: data.memberName } });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete user", description: err.message, variant: "destructive" });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole, memberName, oldRole }: { userId: string; newRole: string; memberName: string; oldRole: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole as any })
        .eq("id", userId);
      if (error) throw error;
      return { userId, newRole, memberName, oldRole };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({ title: "Role updated" });
      setRoleEditId(null);
      logActivity({ entity: "team", entityId: data.userId, action: "role_changed", metadata: { member_name: data.memberName, old_role: data.oldRole, new_role: data.newRole } });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ userId, currentStatus, memberName }: { userId: string; currentStatus: string; memberName: string }) => {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus as any })
        .eq("id", userId);
      if (error) throw error;
      return { userId, newStatus, memberName, oldStatus: currentStatus };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({ title: data.newStatus === "active" ? "Member reactivated" : "Member deactivated" });
      logActivity({ entity: "team", entityId: data.userId, action: data.newStatus === "active" ? "member_reactivated" : "member_deactivated", metadata: { member_name: data.memberName } });

      // Send in-app notification to the affected user
      const actionLabel = data.newStatus === "active" ? "Reactivated" : "Deactivated";
      const notifications: Array<{ user_id: string; title: string; message: string; type: string }> = [
        {
          user_id: data.userId,
          title: data.newStatus === "active" ? "Account Reactivated" : "Account Deactivated",
          message: data.newStatus === "active"
            ? "Your account has been reactivated. You can now access the system."
            : "Your account has been deactivated. Please contact an administrator for more information.",
          type: data.newStatus === "active" ? "account_reactivated" : "account_deactivated",
        },
      ];

      // Notify all owners and admins (except the current user who performed the action)
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["owner", "admin"])
        .neq("id", profile?.id ?? "");

      if (admins) {
        admins.forEach((admin) => {
          notifications.push({
            user_id: admin.id,
            title: `Team Member ${actionLabel}`,
            message: `${data.memberName} has been ${actionLabel.toLowerCase()} by ${profile?.name ?? "an owner"}.`,
            type: data.newStatus === "active" ? "member_reactivated" : "member_deactivated",
          });
        });
      }

      await supabase.from("notifications").insert(notifications);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
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
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="border-border bg-card sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display text-xl font-bold text-foreground">
                    Create Team Member
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="Full name"
                      className="border-border bg-muted/30"
                    />
                    {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="user@adruva.com"
                      className="border-border bg-muted/30"
                    />
                    {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Password <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      placeholder="Min 8 characters"
                      className="border-border bg-muted/30"
                    />
                    {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Role <span className="text-destructive">*</span>
                    </label>
                    <Select value={formData.role} onValueChange={(v) => updateField("role", v)}>
                      <SelectTrigger className="border-border bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="task_manager">Task Manager</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {customRoles.filter((r) => !r.is_system || r.name !== "Owner").length > 0 && (
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Permission Role
                      </label>
                      <Select value={formData.customRoleId} onValueChange={(v) => updateField("customRoleId", v)}>
                        <SelectTrigger className="border-border bg-muted/30">
                          <SelectValue placeholder="Select permission role" />
                        </SelectTrigger>
                        <SelectContent>
                          {customRoles
                            .filter((r) => r.name !== "Owner")
                            .map((r) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">Assign granular permissions via a custom role</p>
                    </div>
                  )}
                  <Button
                    className="w-full gap-2"
                    onClick={() => createMember.mutate()}
                    disabled={createMember.isPending}
                  >
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
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Role</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Created</th>
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
                              <SelectTrigger className="h-8 w-28 border-border bg-muted/30 text-xs">
                                <SelectValue />
                              </SelectTrigger>
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
                          <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusBadge[member.status] || ""}`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{member.created_at ? new Date(member.created_at).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {!isOwner && !isSelf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRoleEditId(member.id);
                                    setRoleEditValue(member.role);
                                  }}
                                >
                                  Change Role
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => toggleStatus.mutate({ userId: member.id, currentStatus: member.status, memberName: member.name })}
                                >
                                  {member.status === "active" ? (
                                    <><UserX className="mr-2 h-4 w-4" /> Deactivate</>
                                  ) : (
                                    <><UserCheck className="mr-2 h-4 w-4" /> Reactivate</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete {member.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently remove this user and all their data. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteMember.mutate({ userId: member.id, memberName: member.name })}
                                        disabled={deleteMember.isPending}
                                      >
                                        {deleteMember.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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
            <RolesSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

/* ─── Roles & Permissions Section ─── */

const RESOURCES = [
  { key: "leads", label: "Leads", actions: ["create", "read", "update", "delete"] },
  { key: "clients", label: "Clients", actions: ["create", "read", "update", "delete"] },
  { key: "tasks", label: "Tasks", actions: ["create", "read", "update", "delete"] },
  { key: "invoices", label: "Invoices", actions: ["create", "read", "update", "delete"] },
  { key: "team", label: "Team", actions: ["invite", "manage"] },
  { key: "reports", label: "Reports", actions: ["view", "export"] },
  { key: "settings", label: "Settings", actions: ["manage"] },
  { key: "roles", label: "Roles", actions: ["manage"] },
];

const ACTION_LABELS: Record<string, string> = {
  create: "Create", read: "Read", update: "Update", delete: "Delete",
  invite: "Invite", manage: "Manage", view: "View", export: "Export",
};

function PermissionMatrix({
  permissions,
  onChange,
  disabled,
}: {
  permissions: RolePermissions;
  onChange: (perms: RolePermissions) => void;
  disabled?: boolean;
}) {
  const toggle = (resource: string, action: string) => {
    const updated = { ...permissions };
    const res = { ...(updated as any)[resource] };
    res[action] = !res[action];
    (updated as any)[resource] = res;
    onChange(updated);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Resource</th>
            <th className="px-3 py-2 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-primary" colSpan={4}>
              Permissions
            </th>
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((res) => (
            <tr key={res.key} className="border-b border-border/50 hover:bg-muted/20">
              <td className="px-3 py-2.5 font-medium text-foreground">{res.label}</td>
              <td className="px-1 py-2.5">
                <div className="flex flex-wrap gap-3">
                  {res.actions.map((action) => {
                    const val = (permissions as any)[res.key]?.[action] ?? false;
                    return (
                      <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                        <Switch
                          checked={val}
                          onCheckedChange={() => toggle(res.key, action)}
                          disabled={disabled}
                          className="scale-75"
                        />
                        <span className="text-muted-foreground">{ACTION_LABELS[action]}</span>
                      </label>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RolesSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roles = [], isLoading } = useCustomRoles();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);

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
    onError: (err: Error) => {
      toast({ title: "Failed to create role", description: err.message, variant: "destructive" });
    },
  });

  const updateRoleMut = useMutation({
    mutationFn: async (role: CustomRole) => {
      const { error } = await supabase
        .from("custom_roles")
        .update({
          name: formName.trim(),
          description: formDescription.trim() || null,
          permissions: formPermissions as any,
        })
        .eq("id", role.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast({ title: "Role updated" });
      setEditingRole(null);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("custom_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete role", description: err.message, variant: "destructive" });
    },
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

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPermissions(DEFAULT_PERMISSIONS);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Roles & Permissions
          </h2>
          <p className="text-sm text-muted-foreground">Create custom roles and configure granular permissions</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Role
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">Create Custom Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Role Name <span className="text-destructive">*</span>
                  </label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Content Writer" className="border-border bg-muted/30" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Description</label>
                  <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Brief description" className="border-border bg-muted/30" />
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Permission Matrix</h4>
                <PermissionMatrix permissions={formPermissions} onChange={setFormPermissions} />
              </div>
              <Button className="w-full gap-2" onClick={() => createRole.mutate()} disabled={createRole.isPending}>
                {createRole.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Role
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit role dialog */}
      {editingRole && (
        <Dialog open={!!editingRole} onOpenChange={(open) => { if (!open) { setEditingRole(null); resetForm(); } }}>
          <DialogContent className="border-border bg-card sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">
                Edit: {editingRole.name} {editingRole.is_system && <span className="text-xs text-muted-foreground">(System)</span>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Role Name</label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="border-border bg-muted/30" disabled={editingRole.is_system} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Description</label>
                  <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="border-border bg-muted/30" />
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Permission Matrix</h4>
                <PermissionMatrix permissions={formPermissions} onChange={setFormPermissions} />
              </div>
              <Button className="w-full gap-2" onClick={() => updateRoleMut.mutate(editingRole)} disabled={updateRoleMut.isPending}>
                {updateRoleMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Roles list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted/20" />
          ))
        ) : roles.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
            No custom roles yet. Create one to assign granular permissions to team members.
          </div>
        ) : (
          roles.map((role) => {
            const memberCount = profilesByRole[role.id] || 0;
            const enabledPerms = Object.entries(role.permissions).reduce((count, [, actions]) => {
              return count + Object.values(actions as Record<string, boolean>).filter(Boolean).length;
            }, 0);
            const totalPerms = Object.entries(role.permissions).reduce((count, [, actions]) => {
              return count + Object.keys(actions as Record<string, boolean>).length;
            }, 0);

            return (
              <div key={role.id} className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold text-foreground">{role.name}</h3>
                        {role.is_system && (
                          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] font-medium uppercase text-muted-foreground">
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {role.description || "No description"} · {memberCount} member{memberCount !== 1 ? "s" : ""} · {enabledPerms}/{totalPerms} permissions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(role)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateRole(role)} title="Duplicate">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {!role.is_system && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{role.name}" role?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {memberCount > 0
                                ? `${memberCount} member(s) are using this role. They will lose their custom permissions.`
                                : "This action cannot be undone."}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default TeamPage;
