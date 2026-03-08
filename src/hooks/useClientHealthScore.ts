import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HealthScore {
  score: number;
  label: "Healthy" | "At Risk" | "Critical";
  color: string;
  bgColor: string;
}

function getHealthLabel(score: number): HealthScore {
  if (score >= 80) return { score, label: "Healthy", color: "text-success", bgColor: "bg-success" };
  if (score >= 50) return { score, label: "At Risk", color: "text-warning", bgColor: "bg-warning" };
  return { score, label: "Critical", color: "text-destructive", bgColor: "bg-destructive" };
}

export function useClientHealthScores(clientIds: string[]) {
  return useQuery({
    queryKey: ["client-health-scores", clientIds.sort().join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch tasks for all clients
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, client_id, status, deadline, updated_at")
        .in("client_id", clientIds);

      // Fetch recent activity logs for clients
      const { data: logs } = await supabase
        .from("activity_logs")
        .select("entity_id, created_at")
        .eq("entity", "client")
        .in("entity_id", clientIds)
        .gte("created_at", thirtyDaysAgo);

      // Fetch billing status from clients
      const { data: clients } = await supabase
        .from("clients")
        .select("id, billing_status")
        .in("id", clientIds);

      const scores: Record<string, HealthScore> = {};

      for (const clientId of clientIds) {
        let score = 100;

        // -20 per overdue task
        const clientTasks = (tasks || []).filter((t) => t.client_id === clientId);
        const overdueTasks = clientTasks.filter(
          (t) => t.deadline && new Date(t.deadline) < now && t.status !== "completed"
        );
        score -= overdueTasks.length * 20;

        // -15 if billing overdue
        const client = (clients || []).find((c) => c.id === clientId);
        if (client?.billing_status === "overdue") score -= 15;

        // -10 if no task updated in 14 days
        const recentTaskUpdate = clientTasks.some(
          (t) => t.updated_at && t.updated_at >= fourteenDaysAgo
        );
        if (clientTasks.length > 0 && !recentTaskUpdate) score -= 10;

        // -10 if no activity in 30 days
        const hasRecentActivity = (logs || []).some((l) => l.entity_id === clientId);
        if (!hasRecentActivity) score -= 10;

        scores[clientId] = getHealthLabel(Math.max(0, Math.min(100, score)));
      }

      return scores;
    },
  });
}

export function useClientHealthScore(clientId: string) {
  const { data, isLoading } = useClientHealthScores(clientId ? [clientId] : []);
  return { healthScore: data?.[clientId], isLoading };
}
