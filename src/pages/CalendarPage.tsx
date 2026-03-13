import { useState, useMemo, useCallback, useEffect } from "react";
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
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format,
  isSameMonth,
  isSameDay,
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
import DayView from "@/components/calendar/DayView";
import { getAssignmentVisibilityMode } from "@/lib/assignment-visibility";
import { runPaymentAutomationSweep } from "@/lib/payment-automation";

type ViewMode = "month" | "week" | "day";

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [activeTask, setActiveTask] = useState<CalendarTask | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canCreate = profile?.role === "owner" || profile?.role === "admin";
  const visibilityMode = getAssignmentVisibilityMode(profile);

  useEffect(() => {
    runPaymentAutomationSweep().catch(() => undefined);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const queryRange = useMemo(() => {
    if (viewMode === "month") {
      return {
        start: startOfWeek(startOfMonth(currentDate)),
        end: endOfWeek(endOfMonth(currentDate)),
      };
    }
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate),
      };
    }
    return {
      start: startOfDay(currentDate),
      end: endOfDay(currentDate),
    };
  }, [currentDate, viewMode]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["calendar-tasks", viewMode, format(queryRange.start, "yyyy-MM-dd")],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, clients!tasks_client_id_fkey(client_name, company_name), profiles!tasks_assigned_to_fkey(name)")
        .gte("deadline", queryRange.start.toISOString())
        .lte("deadline", queryRange.end.toISOString())
        .order("deadline");

      if (visibilityMode === "own_only" && profile?.id) {
        query = query.eq("assigned_to", profile.id);
      } else if (visibilityMode === "own_or_unassigned" && profile?.id) {
        query = query.or(`assigned_to.eq.${profile.id},assigned_to.is.null`);
      }

      const { data } = await query;
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

  const reschedule = useMutation({
    mutationFn: async ({ taskId, newDate }: { taskId: string; newDate: Date; oldDate: Date }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ deadline: newDate.toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_, { taskId, newDate, oldDate }) => {
      toast({
        title: "Task rescheduled",
        description: `Moved to ${format(newDate, "MMM d, yyyy h:mm a")}`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              rescheduleUndo.mutate({ taskId, newDate: oldDate });
            }}
          >
            Undo
          </Button>
        ),
      });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => {
      toast({ title: "Error rescheduling", description: err.message, variant: "destructive" });
    },
  });

  const rescheduleUndo = useMutation({
    mutationFn: async ({ taskId, newDate }: { taskId: string; newDate: Date }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ deadline: newDate.toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_, { newDate }) => {
      toast({ title: "Undo successful", description: `Restored to ${format(newDate, "MMM d, yyyy h:mm a")}` });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => {
      toast({ title: "Undo failed", description: err.message, variant: "destructive" });
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

      const oldDeadline = parseISO(task.deadline);
      if (isSameDay(oldDeadline, newDate) && oldDeadline.getHours() === newDate.getHours() && viewMode === "day") return;
      if (viewMode !== "day" && format(oldDeadline, "yyyy-MM-dd") === format(newDate, "yyyy-MM-dd")) return;

      reschedule.mutate({ taskId: task.id, newDate, oldDate: oldDeadline });
    },
    [reschedule, viewMode]
  );

  // Handle day click from month/week to switch to day view
  const handleDayClick = useCallback(
    (day: Date) => {
      if (viewMode === "month" || viewMode === "week") {
        // Double-click detection: if same day clicked, switch to day view
        // Single click: open new task dialog
        setNewTaskDate(day);
      } else {
        setNewTaskDate(day);
      }
    },
    [viewMode]
  );

  const openDayView = useCallback((day: Date) => {
    setCurrentDate(day);
    setViewMode("day");
  }, []);

  // Stats
  const visibleTasks = useMemo(() => {
    if (viewMode === "month") return tasks.filter((t) => isSameMonth(parseISO(t.deadline), currentDate));
    return tasks;
  }, [tasks, viewMode, currentDate]);

  const completedCount = visibleTasks.filter((t) => t.status === "completed").length;
  const overdueCount = visibleTasks.filter((t) => t.status === "overdue").length;

  // Navigation
  const goBack = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const goForward = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const headerLabel = useMemo(() => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy");
    if (viewMode === "week")
      return `${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}`;
    return format(currentDate, "EEEE, MMMM d, yyyy");
  }, [viewMode, currentDate]);

  const statsLabel =
    viewMode === "month" ? "this month" : viewMode === "week" ? "this week" : "today";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {visibleTasks.length} task{visibleTasks.length !== 1 ? "s" : ""} {statsLabel} · {completedCount} done · {overdueCount} overdue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode}
              </button>
            ))}
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
        {viewMode === "month" && (
          <MonthView
            currentMonth={currentDate}
            tasksByDate={tasksByDate}
            canCreate={canCreate}
            canDrag={canCreate}
            onDayClick={handleDayClick}
            onDayDoubleClick={openDayView}
          />
        )}
        {viewMode === "week" && (
          <WeekView
            currentWeekDate={currentDate}
            tasksByDate={tasksByDate}
            canCreate={canCreate}
            canDrag={canCreate}
            onDayClick={handleDayClick}
            onDayDoubleClick={openDayView}
          />
        )}
        {viewMode === "day" && (
          <DayView
            currentDay={currentDate}
            tasks={tasks}
            canCreate={canCreate}
            canDrag={canCreate}
            onHourClick={setNewTaskDate}
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
