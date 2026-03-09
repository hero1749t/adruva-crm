import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ClipboardList,
  Calendar,
  UsersRound,
  Settings,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  BarChart3,
  Zap,
  Layers,
  UserCog,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, type RolePermissions } from "@/hooks/usePermissions";

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[];
  resource?: keyof RolePermissions;
  dividerBefore?: boolean;
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Leads", path: "/leads", resource: "leads" },
  { icon: UserCheck, label: "Clients", path: "/clients", resource: "clients" },
  { icon: ClipboardList, label: "Tasks", path: "/tasks", resource: "tasks" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: CreditCard, label: "Payments", path: "/payments", roles: ["owner", "admin"], resource: "payments" },
  { icon: BarChart3, label: "Reports", path: "/reports", roles: ["owner", "admin"], resource: "reports" },
  { icon: UsersRound, label: "Team", path: "/team", roles: ["owner", "admin"], resource: "team" },
  // Admin section
  { icon: Layers, label: "Custom Fields", path: "/custom-fields", roles: ["owner", "admin"], resource: "customFields", dividerBefore: true },
  { icon: Zap, label: "Integrations", path: "/integrations", roles: ["owner"], resource: "integrations" },
  { icon: Settings, label: "Settings", path: "/settings", roles: ["owner"], resource: "settings" },
  { icon: ScrollText, label: "Logs", path: "/logs", roles: ["owner", "admin"] },
  // Profile for everyone
  { icon: UserCog, label: "My Profile", path: "/profile", dividerBefore: true },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile } = useAuth();
  const { hasAccessLevel, isOwner } = usePermissions();
  const userRole = profile?.role || "team";

  const filteredItems = navItems.filter((item) => {
    // My Profile is always visible
    if (item.path === "/profile") return true;
    if (isOwner) return true;
    const systemRoleOk = !item.roles || item.roles.includes(userRole);
    const customRoleOk = item.resource ? hasAccessLevel(item.resource, "view") : false;
    return systemRoleOk || customRoleOk;
  });

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
          A
        </div>
        {!collapsed && (
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            ADRUVA <span className="text-primary">CRM</span>
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-4 overflow-y-auto">
        {filteredItems.map((item, idx) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          const showDivider = item.dividerBefore && idx > 0;
          return (
            <div key={item.path}>
              {showDivider && (
                <div className={cn("my-2 border-t border-border/50", collapsed && "mx-1")} />
              )}
              <Link
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
