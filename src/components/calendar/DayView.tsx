import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { format, setHours, getHours, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { priorityConfig, statusIcon, type CalendarTask } from "./calendar-config";
import TaskPill from "./TaskPill";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface DayViewProps {
  currentDay: Date;
  tasks: CalendarTask[];
  canCreate: boolean;
  canDrag: boolean;
  onHourClick: (date: Date) => void;
}

const DroppableHourSlot = ({
  hour,
  day,
  hourTasks,
  canCreate,
  canDrag,
  onHourClick,
}: {
  hour: number;
  day: Date;
  hourTasks: CalendarTask[];
  canCreate: boolean;
  canDrag: boolean;
  onHourClick: (date: Date) => void;
}) => {
  const slotDate = setHours(day, hour);
  const slotId = `day-${format(day, "yyyy-MM-dd")}-${hour}`;
  const { setNodeRef, isOver } = useDroppable({ id: slotId, data: { date: slotDate } });

  const isNow =
    new Date().getHours() === hour &&
    format(new Date(), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");

  return (
    <div
      ref={setNodeRef}
      onClick={() => canCreate && onHourClick(slotDate)}
      className={cn(
        "group flex min-h-[56px] border-b border-border/40 transition-colors",
        canCreate && "cursor-pointer hover:bg-muted/30",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/30",
        isNow && "bg-primary/[0.04]"
      )}
    >
      {/* Time label */}
      <div className="flex w-20 shrink-0 items-start justify-end border-r border-border/40 px-3 pt-1.5">
        <span
          className={cn(
            "font-mono text-[11px]",
            isNow ? "font-semibold text-primary" : "text-muted-foreground"
          )}
        >
          {format(slotDate, "h a")}
        </span>
      </div>

      {/* Task area */}
      <div className="relative flex flex-1 flex-col gap-1 px-3 py-1.5">
        {isNow && (
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-primary" />
        )}
        {hourTasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              "border-border/60 bg-card hover:bg-muted/60",
              task.status === "completed" && "opacity-50"
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                priorityConfig[task.priority || "medium"].dot
              )}
            />
            <TaskPill task={task} expanded canDrag={canDrag} />
          </div>
        ))}
        {hourTasks.length === 0 && canCreate && (
          <Plus className="h-4 w-4 text-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
        )}
      </div>
    </div>
  );
};

const DayView = ({ currentDay, tasks, canCreate, canDrag, onHourClick }: DayViewProps) => {
  // Group tasks by hour
  const tasksByHour = useMemo(() => {
    const map = new Map<number, CalendarTask[]>();
    tasks.forEach((task) => {
      const hour = getHours(parseISO(task.deadline));
      if (!map.has(hour)) map.set(hour, []);
      map.get(hour)!.push(task);
    });
    return map;
  }, [tasks]);

  const totalTasks = tasks.length;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Day header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold text-foreground">
            {format(currentDay, "EEEE")}
          </span>
          <span className="text-sm text-muted-foreground">
            {format(currentDay, "MMMM d, yyyy")}
          </span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {totalTasks} task{totalTasks !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Hour slots — scrollable */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map((hour) => (
          <DroppableHourSlot
            key={hour}
            hour={hour}
            day={currentDay}
            hourTasks={tasksByHour.get(hour) || []}
            canCreate={canCreate}
            canDrag={canDrag}
            onHourClick={onHourClick}
          />
        ))}
      </div>
    </div>
  );
};

export default DayView;
