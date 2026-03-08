import { cn } from "@/lib/utils";
import type { HealthScore } from "@/hooks/useClientHealthScore";

interface Props {
  health: HealthScore | undefined;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export default function HealthScoreBadge({ health, showLabel = true, size = "sm" }: Props) {
  if (!health) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "relative rounded-full",
        size === "sm" ? "h-3 w-3" : "h-4 w-4",
      )}>
        {/* Background ring */}
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-muted" />
          <circle
            cx="18" cy="18" r="15" fill="none" strokeWidth="4"
            strokeDasharray={`${health.score * 0.94} 100`}
            strokeLinecap="round"
            className={cn(
              health.score >= 80 ? "stroke-success" :
              health.score >= 50 ? "stroke-warning" : "stroke-destructive"
            )}
          />
        </svg>
      </div>
      {showLabel && (
        <span className={cn(
          "font-mono font-medium uppercase tracking-wider",
          size === "sm" ? "text-[9px]" : "text-[10px]",
          health.color,
        )}>
          {health.score}
        </span>
      )}
    </div>
  );
}
