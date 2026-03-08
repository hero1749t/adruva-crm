import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import { WEEKDAYS, type CalendarTask } from "./calendar-config";
import TaskPill from "./TaskPill";

interface MonthViewProps {
  currentMonth: Date;
  tasksByDate: Map<string, CalendarTask[]>;
  canCreate: boolean;
  canDrag: boolean;
  onDayClick: (day: Date) => void;
  onDayDoubleClick?: (day: Date) => void;
}

const DroppableDay = ({
  dateKey,
  day,
  dayTasks,
  inMonth,
  today,
  isLastCol,
  canCreate,
  canDrag,
  onDayClick,
  onDayDoubleClick,
}: {
  dateKey: string;
  day: Date;
  dayTasks: CalendarTask[];
  inMonth: boolean;
  today: boolean;
  isLastCol: boolean;
  canCreate: boolean;
  canDrag: boolean;
  onDayClick: (day: Date) => void;
  onDayDoubleClick?: (day: Date) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey, data: { date: day } });

  return (
    <div
      ref={setNodeRef}
      onClick={() => canCreate && onDayClick(day)}
      onDoubleClick={() => onDayDoubleClick?.(day)}
      className={cn(
        "group min-h-[100px] border-b border-r border-border/50 p-1.5 transition-colors",
        !inMonth && "bg-background/50",
        inMonth && "bg-card",
        today && "bg-primary/[0.04]",
        canCreate && "cursor-pointer hover:bg-muted/40",
        isLastCol && "border-r-0",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/30"
      )}
    >
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
        {dayTasks.length > 0 ? (
          <span className="font-mono text-[9px] text-muted-foreground">
            {dayTasks.length}
          </span>
        ) : canCreate ? (
          <Plus className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        ) : null}
      </div>

      <div className="space-y-0.5">
        {dayTasks.slice(0, 3).map((task) => (
          <TaskPill key={task.id} task={task} canDrag={canDrag} />
        ))}
        {dayTasks.length > 3 && (
          <span className="block px-1.5 font-mono text-[9px] text-muted-foreground">
            +{dayTasks.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
};

const MonthView = ({ currentMonth, tasksByDate, canCreate, canDrag, onDayClick, onDayDoubleClick }: MonthViewProps) => {
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
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

      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate.get(key) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <DroppableDay
              key={key}
              dateKey={key}
              day={day}
              dayTasks={dayTasks}
              inMonth={inMonth}
              today={today}
              isLastCol={(idx + 1) % 7 === 0}
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

export default MonthView;
