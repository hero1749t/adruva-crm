import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, TrendingUp, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TaskRow {
  assigned_to: string | null;
  status: string | null;
  profiles?: { name: string } | null;
}

interface TeamLeaderboardProps {
  tasks: TaskRow[];
  dateRange?: string;
}

interface MemberStats {
  id: string;
  name: string;
  initials: string;
  completed: number;
  pending: number;
  overdue: number;
  total: number;
  rate: number;
}

const RANK_STYLES = [
  { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/15", ring: "ring-yellow-500/30" },
  { icon: Medal, color: "text-muted-foreground", bg: "bg-muted/30", ring: "ring-muted-foreground/20" },
  { icon: Medal, color: "text-amber-700", bg: "bg-amber-700/15", ring: "ring-amber-700/20" },
];

export function TeamLeaderboard({ tasks, dateRange = "30d" }: TeamLeaderboardProps) {
  const navigate = useNavigate();
  const leaderboard = useMemo<MemberStats[]>(() => {
    const map = new Map<string, MemberStats>();

    tasks.forEach((t) => {
      if (!t.assigned_to) return;
      const id = t.assigned_to;
      const profileName = (t.profiles as any)?.name || "Unknown";

      if (!map.has(id)) {
        const words = profileName.split(" ");
        const initials = words.length >= 2
          ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
          : profileName.slice(0, 2).toUpperCase();
        map.set(id, { id, name: profileName, initials, completed: 0, pending: 0, overdue: 0, total: 0, rate: 0 });
      }

      const s = map.get(id)!;
      s.total++;
      if (t.status === "completed") s.completed++;
      else if (t.status === "overdue") s.overdue++;
      else s.pending++;
    });

    const arr = Array.from(map.values());
    arr.forEach((s) => (s.rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0));
    arr.sort((a, b) => b.completed - a.completed || b.rate - a.rate);
    return arr;
  }, [tasks]);

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-2xl glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-display text-base font-bold text-foreground">Team Leaderboard</h3>
        </div>
        <p className="py-6 text-center text-sm text-muted-foreground">No assigned tasks yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass p-5 transition-all hover:glow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-display text-base font-bold text-foreground">Team Leaderboard</h3>
            <p className="text-xs text-muted-foreground">Task completion rankings ({dateRange})</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">{leaderboard.length} members</span>
        </div>
      </div>

      <div className="space-y-3">
        {leaderboard.map((member, idx) => {
          const rankStyle = RANK_STYLES[idx] || null;

          return (
            <div
              key={member.id}
              onClick={() => navigate(`/tasks?assigned_to=${member.id}`)}
              className="group flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-4 py-3 transition-all hover:bg-muted/20 hover:border-border animate-fade-in cursor-pointer"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Rank */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                {rankStyle ? (
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${rankStyle.bg} ring-1 ${rankStyle.ring}`}>
                    <rankStyle.icon className={`h-3.5 w-3.5 ${rankStyle.color}`} />
                  </div>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                )}
              </div>

              {/* Avatar + Name */}
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                  {member.initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="truncate text-sm font-semibold text-foreground">{member.name}</span>
                  <span className="shrink-0 ml-2 text-xs font-bold text-foreground">{member.rate}%</span>
                </div>
                <Progress value={member.rate} className="h-1.5" />
              </div>

              {/* Stats */}
              <TooltipProvider delayDuration={200}>
                <div className="flex shrink-0 items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">{member.completed}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Completed</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-warning">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">{member.pending}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Pending</p></TooltipContent>
                  </Tooltip>
                  {member.overdue > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span className="text-xs font-bold">{member.overdue}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top"><p>Overdue</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            </div>
          );
        })}
      </div>
    </div>
  );
}
