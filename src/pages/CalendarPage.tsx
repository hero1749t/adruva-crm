import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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
import { useToast } from "@/hooks/use-toast";
import NewTaskDialog from "@/components/NewTaskDialog";
import { priorityConfig, type CalendarTask } from "@/components/calendar/calendar-config";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";

type ViewMode = "month" | "week";

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [activeTask, setActiveTask] = useState<CalendarTask | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canCreate = profile?.role === "owner" || profile?.role === "admin";

  // DnD sensors — require 5px movement before drag starts to allow clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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

  // Reschedule mutation
  const reschedule = useMutation({
    mutationFn: async ({ taskId, newDate }: { taskId: string; newDate: Date }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ deadline: newDate.toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_, { newDate }) => {
      toast({
        title: "Task rescheduled",
        description: `Moved to ${format(newDate, "MMM d, yyyy")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => {
      toast({ title: "Error rescheduling", description: err.message, variant: "destructive" });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTask(event.active.data.current?.task || null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over || !active.data.current?.task) return;

      const task = active.data.current.task as CalendarTask;
      const newDate = over.data.current?.date as Date | undefined;
      if (!newDate) return;

      const oldKey = format(parseISO(task.deadline), "yyyy-MM-dd");
      const newKey = format(newDate, "yyyy-MM-dd");
      if (oldKey === newKey) return;

      reschedule.mutate({ taskId: task.id, newDate });
    },
    [reschedule]
  );

  // Stats
  const visibleTasks =
    viewMode === "month"
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

  const statsLabel = viewMode === "month" ? "this month" : "this week";

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

      {/* Views with DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {viewMode === "month" ? (
          <MonthView
            currentMonth={currentDate}
            tasksByDate={tasksByDate}
            canCreate={canCreate}
            canDrag={canCreate}
            onDayClick={setNewTaskDate}
          />
        ) : (
          <WeekView
            currentWeekDate={currentDate}
            tasksByDate={tasksByDate}
            canCreate={canCreate}
            canDrag={canCreate}
            onDayClick={setNewTaskDate}
          />
        )}

        <DragOverlay>
          {activeTask && (
            <div className="rounded bg-card px-2 py-1 text-xs font-medium text-foreground shadow-lg ring-1 ring-primary/30">
              {activeTask.task_title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
