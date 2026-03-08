import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
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
  canDrag: boolean;
  onDayClick: (day: Date) => void;
}

const DroppableWeekDay = ({
  dateKey,
  day,
  dayTasks,
  today,
  isLast,
  canCreate,
  canDrag,
  onDayClick,
}: {
  dateKey: string;
  day: Date;
  dayTasks: CalendarTask[];
  today: boolean;
  isLast: boolean;
  canCreate: boolean;
  canDrag: boolean;
  onDayClick: (day: Date) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey, data: { date: day } });

  return (
    <div
      ref={setNodeRef}
      onClick={() => canCreate && onDayClick(day)}
      className={cn(
        "group flex flex-col gap-1 border-r border-border/50 p-2 transition-colors",
        today && "bg-primary/[0.03]",
        canCreate && "cursor-pointer hover:bg-muted/40",
        isLast && "border-r-0",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/30"
      )}
    >
      {dayTasks.length === 0 && canCreate && (
        <div className="flex flex-1 items-center justify-center">
          <Plus className="h-5 w-5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
      {dayTasks.map((task) => (
        <TaskPill key={task.id} task={task} expanded canDrag={canDrag} />
      ))}
    </div>
  );
};

const WeekView = ({ currentWeekDate, tasksByDate, canCreate, canDrag, onDayClick }: WeekViewProps) => {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeekDate);
    const end = endOfWeek(currentWeekDate);
    return eachDayOfInterval({ start, end });
  }, [currentWeekDate]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
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

      <div className="grid grid-cols-7 min-h-[400px]">
        {weekDays.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate.get(key) || [];
          const today = isToday(day);

          return (
            <DroppableWeekDay
              key={key}
              dateKey={key}
              day={day}
              dayTasks={dayTasks}
              today={today}
              isLast={i === 6}
              canCreate={canCreate}
              canDrag={canDrag}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
};

export default WeekView;
