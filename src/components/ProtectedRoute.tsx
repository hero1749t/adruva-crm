import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/hooks/useActivityLog";
import { useToast } from "@/hooks/use-toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  routeName?: string;
}

export function ProtectedRoute({ children, allowedRoles, routeName }: ProtectedRouteProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const userRole = profile?.role || "team";
  const isBlocked = !allowedRoles.includes(userRole);

  useEffect(() => {
    if (isBlocked && profile?.id) {
      // Log the blocked access attempt
      logActivity({
        entity: "security",
        entityId: profile.id,
        action: "access_denied",
        metadata: {
          route: routeName || window.location.pathname,
          requiredRoles: allowedRoles,
          userRole,
        },
      });
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
    }
  }, [isBlocked, profile?.id, allowedRoles, userRole, routeName, toast]);

  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
