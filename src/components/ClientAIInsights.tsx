import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useClientHealthScore } from "@/hooks/useClientHealthScore";
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Sparkles, Loader2, RefreshCw, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HealthPrediction {
  score: number;
  trend: "improving" | "stable" | "declining";
  summary: string;
}

interface RecommendedAction {
  action: string;
  priority: "high" | "medium" | "low";
  reason: string;
}

interface Insights {
  health_prediction: HealthPrediction;
  activity_summary: string;
  recommended_actions: RecommendedAction[];
  risk_flags: string[];
}

const trendConfig = {
  improving: { icon: TrendingUp, label: "Improving", color: "text-success" },
  stable: { icon: Minus, label: "Stable", color: "text-primary" },
  declining: { icon: TrendingDown, label: "Declining", color: "text-destructive" },
};

const priorityColors = {
  high: "bg-destructive/15 text-destructive border-destructive/20",
  medium: "bg-warning/15 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

export function ClientAIInsights({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const { healthScore } = useClientHealthScore(clientId);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateLocalInsights = async () => {
    const [{ data: tasks }, { data: client }, { data: leadActivities }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, status, deadline, updated_at")
        .eq("client_id", clientId),
      supabase
        .from("clients")
        .select("client_name, billing_status, updated_at")
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("activity_logs")
        .select("created_at, action")
        .eq("entity", "client")
        .eq("entity_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const now = new Date();
    const taskList = tasks || [];
    const overdueTasks = taskList.filter(
      (task) => task.deadline && new Date(task.deadline) < now && task.status !== "completed"
    );
    const pendingTasks = taskList.filter((task) => task.status === "pending" || task.status === "in_progress");
    const recentActivityCount = (leadActivities || []).length;
    const score = healthScore?.score ?? 65;
    const trend: HealthPrediction["trend"] =
      score >= 80 ? "improving" : score >= 50 ? "stable" : "declining";

    const riskFlags = [
      ...(overdueTasks.length > 0 ? [`${overdueTasks.length} overdue task(s) need attention`] : []),
      ...(client?.billing_status === "overdue" ? ["Billing is currently overdue"] : []),
      ...(recentActivityCount === 0 ? ["No recent client activity logged"] : []),
    ];

    const recommendedActions: RecommendedAction[] = [
      ...(overdueTasks.length > 0
        ? [{ action: "Clear overdue tasks", priority: "high" as const, reason: "Open overdue items reduce delivery confidence." }]
        : []),
      ...(pendingTasks.length > 0
        ? [{ action: "Review pending deliverables", priority: "medium" as const, reason: "Pending work should be prioritized for smoother progress." }]
        : []),
      ...(recentActivityCount === 0
        ? [{ action: "Schedule a client touchpoint", priority: "medium" as const, reason: "A recent update or call can improve retention confidence." }]
        : [{ action: "Maintain current engagement", priority: "low" as const, reason: "Client activity is being tracked consistently." }]),
    ];

    return {
      health_prediction: {
        score,
        trend,
        summary:
          score >= 80
            ? "Client health looks strong based on delivery activity and billing."
            : score >= 50
              ? "Client health is stable, but a few operational signals need attention."
              : "Client health is at risk and needs immediate follow-up.",
      },
      activity_summary: `${client?.client_name || "This client"} has ${taskList.length} total task(s), ${pendingTasks.length} active task(s), and ${recentActivityCount} recent logged update(s).`,
      recommended_actions: recommendedActions,
      risk_flags: riskFlags,
    } satisfies Insights;
  };

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-ai-insights", {
        body: { clientId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInsights(data);
      setHasGenerated(true);
    } catch (err: any) {
      try {
        const fallbackInsights = await generateLocalInsights();
        setInsights(fallbackInsights);
        setHasGenerated(true);
        toast({
          title: "AI insights ready",
          description: "Live AI function was unavailable, so a local insights fallback was used.",
        });
      } catch (fallbackError: any) {
        toast({
          title: "Failed to generate insights",
          description: fallbackError.message || err.message || "Please try again later",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 75) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  const scoreGradient = (score: number) => {
    if (score >= 75) return "from-success/20 to-success/5";
    if (score >= 50) return "from-warning/20 to-warning/5";
    return "from-destructive/20 to-destructive/5";
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            AI Insights
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={generateInsights}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : hasGenerated ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? "Analyzing..." : hasGenerated ? "Refresh" : "Generate"}
        </Button>
      </div>

      {!insights && !loading && (
        <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
          <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Get AI-powered health predictions, activity summaries, and action recommendations.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={generateInsights}
          >
            <Brain className="h-3.5 w-3.5" /> Analyze Client
          </Button>
        </div>
      )}

      {loading && !insights && (
        <div className="mt-4 flex flex-col items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-xs text-muted-foreground">Analyzing client data with AI...</p>
        </div>
      )}

      {insights && (
        <div className="mt-4 space-y-4">
          {/* Health Prediction */}
          <div className={`rounded-lg bg-gradient-to-br ${scoreGradient(insights.health_prediction.score)} p-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`font-display text-3xl font-bold ${scoreColor(insights.health_prediction.score)}`}>
                  {insights.health_prediction.score}
                </div>
                <div>
                  <p className="font-mono text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                    Predicted Health
                  </p>
                  {(() => {
                    const t = trendConfig[insights.health_prediction.trend];
                    const TrendIcon = t.icon;
                    return (
                      <div className={`flex items-center gap-1 text-xs font-medium ${t.color}`}>
                        <TrendIcon className="h-3 w-3" /> {t.label}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-foreground/80">{insights.health_prediction.summary}</p>
          </div>

          {/* Activity Summary */}
          <div>
            <p className="mb-1.5 font-mono text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
              Activity Summary
            </p>
            <p className="text-sm leading-relaxed text-foreground/80">{insights.activity_summary}</p>
          </div>

          {/* Risk Flags */}
          {insights.risk_flags.length > 0 && (
            <div>
              <p className="mb-1.5 font-mono text-[9px] font-medium uppercase tracking-widest text-destructive">
                Risk Flags
              </p>
              <div className="space-y-1">
                {insights.risk_flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-1.5">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                    <p className="text-xs text-destructive">{flag}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          <div>
            <p className="mb-1.5 font-mono text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
              Recommended Actions
            </p>
            <div className="space-y-1.5">
              {insights.recommended_actions.map((action, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-2 ${priorityColors[action.priority]}`}
                >
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{action.action}</p>
                    <p className="mt-0.5 text-[10px] opacity-75">{action.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
