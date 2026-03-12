import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Activity, UserPlus, Trash2, UserX, UserCheck,
  Shield, UserCog, Radio,
} from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  created_at: string | null;
  metadata: any;
  profiles: { name: string } | null;
}

export function LiveActivityFeed() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(true);

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["recent-activity-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*, profiles!activity_logs_user_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(15);
      return (data || []) as ActivityLog[];
    },
  });

  // Realtime subscription for new activity
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["recent-activity-dashboard"] });
          const action = (payload.new as any).action?.replace(/_/g, " ") || "New activity";
          toast.info("New Activity", { description: action, duration: 4000 });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const actionIcons: Record<string, React.ElementType> = {
    member_created: UserPlus, member_deleted: Trash2,
    member_deactivated: UserX, member_reactivated: UserCheck,
    role_changed: Shield,
  };
  const actionColors: Record<string, string> = {
    member_created: "text-success", member_deleted: "text-destructive",
    member_deactivated: "text-warning", member_reactivated: "text-success",
    role_changed: "text-primary",
  };

  const getDescription = (log: ActivityLog) => {
    const meta = (log.metadata as Record<string, string>) || {};
    if (meta.member_name) {
      if (log.action === "role_changed") return `Changed ${meta.member_name}'s role from ${meta.old_role} to ${meta.new_role}`;
      if (log.action === "member_deactivated") return `Deactivated ${meta.member_name}`;
      if (log.action === "member_reactivated") return `Reactivated ${meta.member_name}`;
      if (log.action === "member_created") return `Created team member ${meta.member_name}`;
      if (log.action === "member_deleted") return `Deleted ${meta.member_name}`;
    }
    return log.action.replace(/_/g, " ");
  };

  const getEntityLink = (log: ActivityLog) => {
    if (log.entity === "lead") return `/leads/${log.entity_id}`;
    if (log.entity === "client") return `/clients/${log.entity_id}`;
    if (log.entity === "task") return `/tasks`;
    if (log.entity === "team") return `/team`;
    return null;
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold text-foreground">Live Activity</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio className={`h-3 w-3 ${isLive ? "text-success animate-pulse" : "text-muted-foreground"}`} />
          <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">
            {isLive ? "Live" : "Paused"}
          </span>
        </div>
      </div>
      {recentActivity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent activity</p>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {recentActivity.map((log, idx) => {
            const ActionIcon = actionIcons[log.action] || UserCog;
            const actionColor = actionColors[log.action] || "text-muted-foreground";
            const link = getEntityLink(log);
            const userName = log.profiles?.name || "Unknown";

            return (
              <div
                key={log.id}
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-muted/30 animate-fade-in ${link ? "cursor-pointer" : ""}`}
                style={{ animationDelay: `${idx * 50}ms` }}
                onClick={() => link && navigate(link)}
              >
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 ${actionColor}`}>
                  <ActionIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{userName}</span>{" "}
                    <span className="text-muted-foreground">{getDescription(log)}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {log.entity} · {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
