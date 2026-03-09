import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─── Access Levels (Notion-style) ─────────────────────────────────────────────
export type AccessLevel = "none" | "view" | "edit" | "full";

export const ACCESS_LEVELS: { value: AccessLevel; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No access" },
  { value: "view", label: "View", description: "Can view only" },
  { value: "edit", label: "Edit", description: "Can view and edit" },
  { value: "full", label: "Full", description: "Full access including delete" },
];

// ─── Permission structure ─────────────────────────────────────────────────────
export interface ResourcePermissions {
  access: AccessLevel;
  // Granular overrides (optional)
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
}

export interface RolePermissions {
  // CRM Core
  leads: ResourcePermissions;
  clients: ResourcePermissions;
  tasks: ResourcePermissions;
  // Finance
  invoices: ResourcePermissions;
  payments: ResourcePermissions;
  // Properties / Listings (Agency)
  properties: ResourcePermissions;
  // Campaigns & Marketing
  campaigns: ResourcePermissions;
  // Communications
  communications: ResourcePermissions;
  // Analytics & Reports
  reports: ResourcePermissions;
  // Administration
  team: ResourcePermissions;
  settings: ResourcePermissions;
  roles: ResourcePermissions;
  integrations: ResourcePermissions;
  customFields: ResourcePermissions;
  automations: ResourcePermissions;
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

// ─── Access level helpers ─────────────────────────────────────────────────────
export function accessLevelToActions(level: AccessLevel): { create: boolean; read: boolean; update: boolean; delete: boolean } {
  switch (level) {
    case "none":
      return { create: false, read: false, update: false, delete: false };
    case "view":
      return { create: false, read: true, update: false, delete: false };
    case "edit":
      return { create: true, read: true, update: true, delete: false };
    case "full":
      return { create: true, read: true, update: true, delete: true };
    default:
      return { create: false, read: false, update: false, delete: false };
  }
}

export function actionsToAccessLevel(perms: { create?: boolean; read?: boolean; update?: boolean; delete?: boolean }): AccessLevel {
  const { create, read, update, delete: del } = perms;
  if (create && read && update && del) return "full";
  if (create && read && update) return "edit";
  if (read && !create && !update && !del) return "view";
  return "none";
}

// ─── Default permissions ──────────────────────────────────────────────────────
const createDefaultResource = (access: AccessLevel = "none"): ResourcePermissions => ({
  access,
  ...accessLevelToActions(access),
});

export const DEFAULT_PERMISSIONS: RolePermissions = {
  leads: createDefaultResource("view"),
  clients: createDefaultResource("view"),
  tasks: createDefaultResource("view"),
  invoices: createDefaultResource("none"),
  payments: createDefaultResource("none"),
  properties: createDefaultResource("none"),
  campaigns: createDefaultResource("none"),
  communications: createDefaultResource("view"),
  reports: createDefaultResource("none"),
  team: createDefaultResource("none"),
  settings: createDefaultResource("none"),
  roles: createDefaultResource("none"),
  integrations: createDefaultResource("none"),
  customFields: createDefaultResource("none"),
  automations: createDefaultResource("none"),
};

// ─── Owner full permissions ───────────────────────────────────────────────────
export const OWNER_PERMISSIONS: RolePermissions = {
  leads: createDefaultResource("full"),
  clients: createDefaultResource("full"),
  tasks: createDefaultResource("full"),
  invoices: createDefaultResource("full"),
  payments: createDefaultResource("full"),
  properties: createDefaultResource("full"),
  campaigns: createDefaultResource("full"),
  communications: createDefaultResource("full"),
  reports: createDefaultResource("full"),
  team: createDefaultResource("full"),
  settings: createDefaultResource("full"),
  roles: createDefaultResource("full"),
  integrations: createDefaultResource("full"),
  customFields: createDefaultResource("full"),
  automations: createDefaultResource("full"),
};

// ─── Role presets ─────────────────────────────────────────────────────────────
export const ROLE_PRESETS: Record<string, { label: string; description: string; color: string; permissions: RolePermissions }> = {
  sales_rep: {
    label: "Sales Representative",
    description: "Manage leads and prospects, track deals",
    color: "#3b82f6",
    permissions: {
      leads: createDefaultResource("full"),
      clients: createDefaultResource("view"),
      tasks: createDefaultResource("edit"),
      invoices: createDefaultResource("view"),
      payments: createDefaultResource("none"),
      properties: createDefaultResource("view"),
      campaigns: createDefaultResource("view"),
      communications: createDefaultResource("full"),
      reports: createDefaultResource("view"),
      team: createDefaultResource("none"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("none"),
    },
  },
  account_manager: {
    label: "Account Manager",
    description: "Full access to clients, leads and tasks",
    color: "#8b5cf6",
    permissions: {
      leads: createDefaultResource("full"),
      clients: createDefaultResource("full"),
      tasks: createDefaultResource("full"),
      invoices: createDefaultResource("edit"),
      payments: createDefaultResource("view"),
      properties: createDefaultResource("edit"),
      campaigns: createDefaultResource("edit"),
      communications: createDefaultResource("full"),
      reports: createDefaultResource("view"),
      team: createDefaultResource("none"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("none"),
    },
  },
  project_manager: {
    label: "Project Manager",
    description: "Manage tasks, timelines, and team coordination",
    color: "#f59e0b",
    permissions: {
      leads: createDefaultResource("view"),
      clients: createDefaultResource("edit"),
      tasks: createDefaultResource("full"),
      invoices: createDefaultResource("view"),
      payments: createDefaultResource("none"),
      properties: createDefaultResource("view"),
      campaigns: createDefaultResource("edit"),
      communications: createDefaultResource("full"),
      reports: createDefaultResource("view"),
      team: createDefaultResource("view"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("view"),
    },
  },
  content_writer: {
    label: "Content Writer",
    description: "View leads, update assigned tasks",
    color: "#10b981",
    permissions: {
      leads: createDefaultResource("view"),
      clients: createDefaultResource("view"),
      tasks: createDefaultResource("edit"),
      invoices: createDefaultResource("none"),
      payments: createDefaultResource("none"),
      properties: createDefaultResource("view"),
      campaigns: createDefaultResource("view"),
      communications: createDefaultResource("view"),
      reports: createDefaultResource("none"),
      team: createDefaultResource("none"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("none"),
    },
  },
  designer: {
    label: "Designer",
    description: "View projects and tasks, limited access",
    color: "#ec4899",
    permissions: {
      leads: createDefaultResource("view"),
      clients: createDefaultResource("view"),
      tasks: createDefaultResource("edit"),
      invoices: createDefaultResource("none"),
      payments: createDefaultResource("none"),
      properties: createDefaultResource("view"),
      campaigns: createDefaultResource("edit"),
      communications: createDefaultResource("view"),
      reports: createDefaultResource("none"),
      team: createDefaultResource("none"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("none"),
    },
  },
  seo_specialist: {
    label: "SEO Specialist",
    description: "Access to clients, campaigns and reports",
    color: "#06b6d4",
    permissions: {
      leads: createDefaultResource("view"),
      clients: createDefaultResource("view"),
      tasks: createDefaultResource("edit"),
      invoices: createDefaultResource("none"),
      payments: createDefaultResource("none"),
      properties: createDefaultResource("none"),
      campaigns: createDefaultResource("full"),
      communications: createDefaultResource("view"),
      reports: createDefaultResource("view"),
      team: createDefaultResource("none"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("none"),
    },
  },
  billing_manager: {
    label: "Billing Manager",
    description: "Full invoices and payments access",
    color: "#22c55e",
    permissions: {
      leads: createDefaultResource("view"),
      clients: createDefaultResource("view"),
      tasks: createDefaultResource("view"),
      invoices: createDefaultResource("full"),
      payments: createDefaultResource("full"),
      properties: createDefaultResource("none"),
      campaigns: createDefaultResource("none"),
      communications: createDefaultResource("view"),
      reports: createDefaultResource("full"),
      team: createDefaultResource("none"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("none"),
    },
  },
  read_only: {
    label: "Read Only",
    description: "Can only view data, no modifications",
    color: "#6b7280",
    permissions: {
      leads: createDefaultResource("view"),
      clients: createDefaultResource("view"),
      tasks: createDefaultResource("view"),
      invoices: createDefaultResource("view"),
      payments: createDefaultResource("view"),
      properties: createDefaultResource("view"),
      campaigns: createDefaultResource("view"),
      communications: createDefaultResource("view"),
      reports: createDefaultResource("view"),
      team: createDefaultResource("none"),
      settings: createDefaultResource("none"),
      roles: createDefaultResource("none"),
      integrations: createDefaultResource("none"),
      customFields: createDefaultResource("none"),
      automations: createDefaultResource("none"),
    },
  },
};

// ─── Resource groups for UI ───────────────────────────────────────────────────
export const RESOURCE_GROUPS = [
  {
    group: "CRM Core",
    color: "text-blue-500",
    icon: "👤",
    resources: [
      { key: "leads", label: "Leads", icon: "👤", description: "Prospect management" },
      { key: "clients", label: "Clients", icon: "🏢", description: "Client accounts" },
      { key: "tasks", label: "Tasks", icon: "✅", description: "Task management" },
    ],
  },
  {
    group: "Properties & Listings",
    color: "text-purple-500",
    icon: "🏠",
    resources: [
      { key: "properties", label: "Properties", icon: "🏠", description: "Real estate listings" },
    ],
  },
  {
    group: "Marketing",
    color: "text-pink-500",
    icon: "📣",
    resources: [
      { key: "campaigns", label: "Campaigns", icon: "📣", description: "Marketing campaigns" },
      { key: "communications", label: "Communications", icon: "💬", description: "Emails, calls, messages" },
    ],
  },
  {
    group: "Finance",
    color: "text-emerald-500",
    icon: "💰",
    resources: [
      { key: "invoices", label: "Invoices", icon: "🧾", description: "Invoice management" },
      { key: "payments", label: "Payments", icon: "💳", description: "Payment tracking" },
    ],
  },
  {
    group: "Analytics",
    color: "text-cyan-500",
    icon: "📊",
    resources: [
      { key: "reports", label: "Reports", icon: "📊", description: "Analytics & reports" },
    ],
  },
  {
    group: "Administration",
    color: "text-amber-500",
    icon: "⚙️",
    resources: [
      { key: "team", label: "Team", icon: "👥", description: "Team management" },
      { key: "roles", label: "Roles", icon: "🔐", description: "Roles & permissions" },
      { key: "settings", label: "Settings", icon: "⚙️", description: "System settings" },
      { key: "integrations", label: "Integrations", icon: "🔌", description: "Third-party connections" },
      { key: "customFields", label: "Custom Fields", icon: "📝", description: "Custom properties" },
      { key: "automations", label: "Automations", icon: "⚡", description: "Workflow automations" },
    ],
  },
];

// ─── Query hook ───────────────────────────────────────────────────────────────
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
      
      // Migrate old permission format to new format
      return (data || []).map(role => {
        const perms = role.permissions as any;
        // Check if already in new format
        if (perms?.leads?.access) {
          return role as unknown as CustomRole;
        }
        // Migrate old format
        const migrated: Partial<RolePermissions> = {};
        Object.entries(perms || {}).forEach(([key, actions]: [string, any]) => {
          if (typeof actions === "object" && actions !== null) {
            const level = actionsToAccessLevel(actions);
            (migrated as any)[key] = { access: level, ...actions };
          }
        });
        // Fill in missing resources
        Object.keys(DEFAULT_PERMISSIONS).forEach(key => {
          if (!(migrated as any)[key]) {
            (migrated as any)[key] = DEFAULT_PERMISSIONS[key as keyof RolePermissions];
          }
        });
        return { ...role, permissions: migrated as RolePermissions } as CustomRole;
      });
    },
  });
}

// ─── Main permissions hook ────────────────────────────────────────────────────
export function usePermissions() {
  const { profile } = useAuth();
  const { data: roles = [] } = useCustomRoles();

  // Find the user's assigned role permissions
  const userRole = roles.find((r) => r.id === (profile as any)?.custom_role_id);
  const permissions: RolePermissions = userRole?.permissions || DEFAULT_PERMISSIONS;

  // Owner always has full permissions regardless
  const isOwner = profile?.role === "owner";
  const isAdmin = profile?.role === "admin";

  /**
   * Check if user can perform action on resource
   * @param resource - Resource key (leads, clients, tasks, etc.)
   * @param action - Action type (create, read, update, delete, view, edit, full)
   */
  const can = (resource: keyof RolePermissions, action: string): boolean => {
    if (isOwner) return true;
    
    // Admin fallback for certain resources
    if (isAdmin) {
      const adminResources = ["leads", "clients", "tasks", "reports", "team"];
      if (adminResources.includes(resource)) {
        return action !== "delete" || resource === "tasks";
      }
    }

    const resourcePerms = permissions[resource];
    if (!resourcePerms) return false;

    // Check access level first
    const level = resourcePerms.access;
    const levelActions = accessLevelToActions(level);

    // Map action to level action
    const actionMap: Record<string, keyof typeof levelActions> = {
      create: "create",
      read: "read",
      view: "read",
      update: "update",
      edit: "update",
      delete: "delete",
      full: "delete", // full implies delete access
      manage: "delete", // manage implies full access
      invite: "create",
      export: "read",
    };

    const mappedAction = actionMap[action] || action;
    
    // Check granular override first, then level
    const granular = (resourcePerms as any)[mappedAction];
    if (typeof granular === "boolean") return granular;
    
    return levelActions[mappedAction as keyof typeof levelActions] ?? false;
  };

  /**
   * Get access level for a resource
   */
  const getAccessLevel = (resource: keyof RolePermissions): AccessLevel => {
    if (isOwner) return "full";
    if (isAdmin) {
      const adminFullResources = ["leads", "clients", "tasks"];
      if (adminFullResources.includes(resource)) return "edit";
    }
    return permissions[resource]?.access || "none";
  };

  /**
   * Check if user has at least the specified access level
   */
  const hasAccessLevel = (resource: keyof RolePermissions, minLevel: AccessLevel): boolean => {
    const levels: AccessLevel[] = ["none", "view", "edit", "full"];
    const currentLevel = getAccessLevel(resource);
    return levels.indexOf(currentLevel) >= levels.indexOf(minLevel);
  };

  return { 
    permissions, 
    can, 
    isOwner, 
    isAdmin,
    userRole,
    getAccessLevel,
    hasAccessLevel,
  };
}
