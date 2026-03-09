import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, type RolePermissions } from "@/hooks/usePermissions";
import { logActivity } from "@/hooks/useActivityLog";
import { useToast } from "@/hooks/use-toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  /** Resource key from RolePermissions to check custom role access */
  resource?: keyof RolePermissions;
  /** Minimum access level needed (defaults to "view") */
  minAccess?: "view" | "edit" | "full";
  routeName?: string;
}

export function ProtectedRoute({ children, allowedRoles, resource, minAccess = "view", routeName }: ProtectedRouteProps) {
  const { profile } = useAuth();
  const { hasAccessLevel, isOwner, isAdmin } = usePermissions();
  const { toast } = useToast();
  const userRole = profile?.role || "team";

  // Check system role first
  let isAllowed = false;
  if (allowedRoles) {
    isAllowed = allowedRoles.includes(userRole);
  }

  // Check resource-level permission from custom roles
  if (!isAllowed && resource) {
    isAllowed = hasAccessLevel(resource, minAccess);
  }

  // Owner always has access
  if (isOwner) isAllowed = true;

  const isBlocked = !isAllowed;

  useEffect(() => {
    if (isBlocked && profile?.id) {
      logActivity({
        entity: "security",
        entityId: profile.id,
        action: "access_denied",
        metadata: {
          route: routeName || window.location.pathname,
          requiredRoles: allowedRoles,
          resource,
          minAccess,
          userRole,
        },
      });
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
    }
  }, [isBlocked, profile?.id]);

  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
