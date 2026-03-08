import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RolePermissions {
  leads: { create: boolean; read: boolean; update: boolean; delete: boolean };
  clients: { create: boolean; read: boolean; update: boolean; delete: boolean };
  tasks: { create: boolean; read: boolean; update: boolean; delete: boolean };
  invoices: { create: boolean; read: boolean; update: boolean; delete: boolean };
  team: { invite: boolean; manage: boolean };
  reports: { view: boolean; export: boolean };
  settings: { manage: boolean };
  roles: { manage: boolean };
}

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: RolePermissions;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PERMISSIONS: RolePermissions = {
  leads: { create: false, read: true, update: false, delete: false },
  clients: { create: false, read: true, update: false, delete: false },
  tasks: { create: false, read: true, update: false, delete: false },
  invoices: { create: false, read: false, update: false, delete: false },
  team: { invite: false, manage: false },
  reports: { view: false, export: false },
  settings: { manage: false },
  roles: { manage: false },
};

export function useCustomRoles() {
  return useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as CustomRole[];
    },
  });
}

export function usePermissions() {
  const { profile } = useAuth();

  const { data: roles = [] } = useCustomRoles();

  // Find the user's assigned role permissions
  const userRole = roles.find((r) => r.id === (profile as any)?.custom_role_id);
  const permissions: RolePermissions = userRole?.permissions || DEFAULT_PERMISSIONS;

  // Owner always has full permissions regardless
  const isOwner = profile?.role === "owner";

  const can = (resource: keyof RolePermissions, action: string): boolean => {
    if (isOwner) return true;
    const resourcePerms = permissions[resource] as Record<string, boolean> | undefined;
    return resourcePerms?.[action] ?? false;
  };

  return { permissions, can, isOwner, userRole };
}

export { DEFAULT_PERMISSIONS };
