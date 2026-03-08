import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import NewTaskDialog from "@/components/NewTaskDialog";
import { priorityConfig, type CalendarTask } from "@/components/calendar/calendar-config";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";

type ViewMode = "month" | "week";

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const { profile } = useAuth();
  const canCreate = profile?.role === "owner" || profile?.role === "admin";

  // Compute query range based on view
  const queryRange = useMemo(() => {
    if (viewMode === "month") {
      return {
        start: startOfWeek(startOfMonth(currentDate)),
        end: endOfWeek(endOfMonth(currentDate)),
      };
    }
    return {
      start: startOfWeek(currentDate),
      end: endOfWeek(currentDate),
    };
  }, [currentDate, viewMode]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["calendar-tasks", viewMode, format(queryRange.start, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, clients!tasks_client_id_fkey(client_name), profiles!tasks_assigned_to_fkey(name)")
        .gte("deadline", queryRange.start.toISOString())
        .lte("deadline", queryRange.end.toISOString())
        .order("deadline");
      return (data || []) as CalendarTask[];
    },
  });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    tasks.forEach((task) => {
      const key = format(parseISO(task.deadline), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return map;
  }, [tasks]);

  // Stats
  const visibleTasks = viewMode === "month"
    ? tasks.filter((t) => isSameMonth(parseISO(t.deadline), currentDate))
    : tasks;
  const completedCount = visibleTasks.filter((t) => t.status === "completed").length;
  const overdueCount = visibleTasks.filter((t) => t.status === "overdue").length;

  // Navigation
  const goBack = () =>
    setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  const goForward = () =>
    setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  const headerLabel =
    viewMode === "month"
      ? format(currentDate, "MMMM yyyy")
      : `${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}`;

  const statsLabel =
    viewMode === "month" ? "this month" : "this week";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visibleTasks.length} tasks {statsLabel} · {completedCount} done · {overdueCount} overdue
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                viewMode === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Week
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[200px] text-center font-display text-lg font-semibold text-foreground">
            {headerLabel}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}>
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

      {/* Views */}
      {viewMode === "month" ? (
        <MonthView
          currentMonth={currentDate}
          tasksByDate={tasksByDate}
          canCreate={canCreate}
          onDayClick={setNewTaskDate}
        />
      ) : (
        <WeekView
          currentWeekDate={currentDate}
          tasksByDate={tasksByDate}
          canCreate={canCreate}
          onDayClick={setNewTaskDate}
        />
      )}

      {newTaskDate && (
        <NewTaskDialog
          open={!!newTaskDate}
          onOpenChange={(open) => !open && setNewTaskDate(null)}
          defaultDate={newTaskDate}
        />
      )}
    </div>
  );
};

export default CalendarPage;
