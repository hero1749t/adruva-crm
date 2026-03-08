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
  Receipt,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[];
};

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Leads", path: "/leads" },
  { icon: UserCheck, label: "Clients", path: "/clients" },
  { icon: ClipboardList, label: "Tasks", path: "/tasks" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: Receipt, label: "Invoices", path: "/invoices", roles: ["owner", "admin"] },
  { icon: UsersRound, label: "Team", path: "/team", roles: ["owner"] },
  { icon: Settings, label: "Settings", path: "/settings", roles: ["owner"] },
  { icon: ScrollText, label: "Logs", path: "/logs", roles: ["owner", "admin"] },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile } = useAuth();
  const userRole = profile?.role || "team";

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems
          .filter((item) => !item.roles || item.roles.includes(userRole))
          .map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
