import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  Plus, Loader2, Trash2, Shield, Pencil, Check, X, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCustomRoles, type CustomRole, type RolePermissions, DEFAULT_PERMISSIONS } from "@/hooks/usePermissions";

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

  if (profile && profile.role !== "owner") {
    return <Navigate to="/dashboard" replace />;
  }

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

  const updateRole = useMutation({
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

  // Count members per role
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create custom roles and configure granular permissions</p>
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

      {/* Editing role dialog */}
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
              <Button className="w-full gap-2" onClick={() => updateRole.mutate(editingRole)} disabled={updateRole.isPending}>
                {updateRole.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Roles list */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted/20" />
          ))
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
