import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
} from "lucide-react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import NewTaskDialog from "@/components/NewTaskDialog";
import { useAuth } from "@/contexts/AuthContext";

const priorityConfig: Record<string, { dot: string; label: string }> = {
  urgent: { dot: "bg-destructive", label: "Urgent" },
  high: { dot: "bg-warning", label: "High" },
  medium: { dot: "bg-primary", label: "Medium" },
  low: { dot: "bg-muted-foreground", label: "Low" },
};

const statusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-3 w-3 text-success shrink-0" />,
  overdue: <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />,
  in_progress: <Clock className="h-3 w-3 text-warning shrink-0" />,
  pending: <Clock className="h-3 w-3 text-muted-foreground shrink-0" />,
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Task {
  id: string;
  task_title: string;
  deadline: string;
  priority: string | null;
  status: string | null;
  client_id: string;
  assigned_to: string | null;
  clients?: { client_name: string } | null;
  profiles?: { name: string } | null;
}

const CalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canCreate = profile?.role === "owner" || profile?.role === "admin";

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: tasks = [] } = useQuery({
    queryKey: ["calendar-tasks", format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const calStart = startOfWeek(monthStart);
      const calEnd = endOfWeek(monthEnd);
      const { data } = await supabase
        .from("tasks")
        .select("*, clients!tasks_client_id_fkey(client_name), profiles!tasks_assigned_to_fkey(name)")
        .gte("deadline", calStart.toISOString())
        .lte("deadline", calEnd.toISOString())
        .order("deadline");
      return (data || []) as Task[];
    },
  });

  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const key = format(parseISO(task.deadline), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return map;
  }, [tasks]);

  // Stats for the month
  const monthTasks = tasks.filter((t) => {
    const d = parseISO(t.deadline);
    return isSameMonth(d, currentMonth);
  });
  const completedCount = monthTasks.filter((t) => t.status === "completed").length;
  const overdueCount = monthTasks.filter((t) => t.status === "overdue").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthTasks.length} tasks this month · {completedCount} done · {overdueCount} overdue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center font-display text-lg font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Priority legend */}
      <div className="flex items-center gap-4">
        {Object.entries(priorityConfig).map(([key, conf]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", conf.dot)} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {conf.label}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border bg-surface">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center font-mono text-[10px] font-medium uppercase tracking-widest text-primary"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={key}
                onClick={() => canCreate && setNewTaskDate(day)}
                className={cn(
                  "min-h-[100px] border-b border-r border-border/50 p-1.5 transition-colors",
                  !inMonth && "bg-background/50",
                  inMonth && "bg-card",
                  today && "bg-primary/[0.04]",
                  canCreate && "cursor-pointer hover:bg-muted/40",
                  // Remove right border on last column
                  (idx + 1) % 7 === 0 && "border-r-0"
                )}
              >
                {/* Day number */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      today
                        ? "bg-primary text-primary-foreground"
                        : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Task pills */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => {
                    const prio = priorityConfig[task.priority || "medium"];
                    return (
                      <Tooltip key={task.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => navigate(`/clients/${task.client_id}`)}
                            className={cn(
                              "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[10px] leading-tight transition-colors",
                              "hover:bg-muted/80",
                              task.status === "completed"
                                ? "text-muted-foreground line-through opacity-60"
                                : "text-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                                prio.dot
                              )}
                            />
                            <span className="truncate">{task.task_title}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[220px] space-y-1 text-xs"
                        >
                          <p className="font-medium">{task.task_title}</p>
                          <div className="flex items-center gap-1.5">
                            {statusIcon[task.status || "pending"]}
                            <span className="capitalize">
                              {(task.status || "pending").replace("_", " ")}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="capitalize">{prio.label}</span>
                          </div>
                          {(task as any).clients?.client_name && (
                            <p className="text-muted-foreground">
                              {(task as any).clients.client_name}
                            </p>
                          )}
                          {(task as any).profiles?.name && (
                            <p className="text-muted-foreground">
                              → {(task as any).profiles.name}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <span className="block px-1.5 font-mono text-[9px] text-muted-foreground">
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
