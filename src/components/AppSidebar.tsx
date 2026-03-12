import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, UserCheck, ClipboardList, Calendar,
  UsersRound, Settings, ScrollText, ChevronLeft, ChevronRight,
  CreditCard, BarChart3, Zap, Layers, UserCog, X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, type RolePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";

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
  { icon: Layers, label: "Custom Fields", path: "/custom-fields", roles: ["owner", "admin"], resource: "customFields", dividerBefore: true },
  { icon: Zap, label: "Integrations", path: "/integrations", roles: ["owner"], resource: "integrations" },
  { icon: Settings, label: "Settings", path: "/settings", roles: ["owner"], resource: "settings" },
  { icon: ScrollText, label: "Logs", path: "/logs", roles: ["owner", "admin"] },
  { icon: UserCog, label: "My Profile", path: "/profile", dividerBefore: true },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen, onMobileClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile } = useAuth();
  const { hasAccessLevel, isOwner } = usePermissions();
  const isMobile = useIsMobile();
  const userRole = profile?.role || "team";

  const filteredItems = navItems.filter((item) => {
    if (item.path === "/profile") return true;
    if (isOwner) return true;
    const systemRoleOk = !item.roles || item.roles.includes(userRole);
    const customRoleOk = item.resource ? hasAccessLevel(item.resource, "view") : false;
    return systemRoleOk || customRoleOk;
  });

  const handleNavClick = () => {
    if (isMobile && onMobileClose) onMobileClose();
  };

  const NavContent = ({ isMobileView = false }: { isMobileView?: boolean }) => (
    <>
      <div className={cn(
        "flex items-center gap-3 border-b border-border/50 px-4",
        isMobileView ? "h-14 justify-between" : "h-16"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-primary font-display text-sm font-bold text-primary-foreground shadow-md shadow-primary/20">
            A
          </div>
          {(!collapsed || isMobileView) && (
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              ADRUVA <span className="gradient-text">CRM</span>
            </span>
          )}
        </div>
        {isMobileView && (
          <button onClick={onMobileClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filteredItems.map((item, idx) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          const showDivider = item.dividerBefore && idx > 0;
          return (
            <div key={item.path}>
              {showDivider && (
                <div className={cn("my-3 border-t border-border/30", collapsed && !isMobileView && "mx-1")} />
              )}
              <Link
                to={item.path}
                onClick={handleNavClick}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "glass bg-primary/10 text-primary shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
                title={collapsed && !isMobileView ? item.label : undefined}
              >
                <item.icon className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-transform duration-200",
                  isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]",
                  !isActive && "group-hover:scale-110"
                )} />
                {(!collapsed || isMobileView) && <span>{item.label}</span>}
                {isActive && (!collapsed || isMobileView) && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-sm shadow-primary/50" />
                )}
              </Link>
            </div>
          );
        })}
      </nav>
    </>
  );

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 flex-col glass-strong transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <NavContent isMobileView />
        </aside>
      </>
    );
  }

  // Desktop: collapsible sidebar
  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border/50 bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      <NavContent />

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-20 flex h-7 w-7 items-center justify-center rounded-full glass-strong text-muted-foreground hover:text-foreground hover:shadow-md transition-all duration-200"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}
