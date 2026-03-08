import { useMemo } from "react";
import { Plus } from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import { WEEKDAYS, type CalendarTask } from "./calendar-config";
import TaskPill from "./TaskPill";

interface WeekViewProps {
  currentWeekDate: Date;
  tasksByDate: Map<string, CalendarTask[]>;
  canCreate: boolean;
  onDayClick: (day: Date) => void;
}

const WeekView = ({ currentWeekDate, tasksByDate, canCreate, onDayClick }: WeekViewProps) => {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeekDate);
    const end = endOfWeek(currentWeekDate);
    return eachDayOfInterval({ start, end });
  }, [currentWeekDate]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-border bg-surface">
        {weekDays.map((day, i) => {
          const today = isToday(day);
          return (
            <div
              key={i}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-3",
                today && "bg-primary/[0.06]"
              )}
            >
              <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {WEEKDAYS[i]}
              </span>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  today
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 min-h-[400px]">
        {weekDays.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate.get(key) || [];
          const today = isToday(day);

          return (
            <div
              key={key}
              onClick={() => canCreate && onDayClick(day)}
              className={cn(
                "group flex flex-col gap-1 border-r border-border/50 p-2 transition-colors",
                today && "bg-primary/[0.03]",
                canCreate && "cursor-pointer hover:bg-muted/40",
                i === 6 && "border-r-0"
              )}
            >
              {dayTasks.length === 0 && canCreate && (
                <div className="flex flex-1 items-center justify-center">
                  <Plus className="h-5 w-5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              {dayTasks.map((task) => (
                <TaskPill key={task.id} task={task} expanded />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeekView;
