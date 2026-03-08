import { useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { priorityConfig, statusIcon, type CalendarTask } from "./calendar-config";

interface TaskPillProps {
  task: CalendarTask;
  expanded?: boolean;
  canDrag?: boolean;
}

const TaskPill = ({ task, expanded, canDrag }: TaskPillProps) => {
  const navigate = useNavigate();
  const prio = priorityConfig[task.priority || "medium"];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !canDrag,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          {...(canDrag ? { ...listeners, ...attributes } : {})}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDragging) navigate(`/clients/${task.client_id}`);
          }}
          className={cn(
            "flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-muted/80",
            expanded ? "text-xs" : "text-[10px] leading-tight",
            task.status === "completed"
              ? "text-muted-foreground line-through opacity-60"
              : "text-foreground",
            isDragging && "opacity-50 shadow-lg ring-1 ring-primary/40 rounded bg-card",
            canDrag && "touch-none"
          )}
        >
          <span
            className={cn(
              "shrink-0 rounded-full",
              expanded ? "h-2 w-2" : "mt-0.5 h-1.5 w-1.5",
              prio.dot
            )}
          />
          <span className="truncate">{task.task_title}</span>
          {expanded && task.clients?.client_name && (
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {task.clients.client_name}
            </span>
          )}
        </button>
      </TooltipTrigger>
      {!isDragging && (
        <TooltipContent side="top" className="max-w-[220px] space-y-1 text-xs">
          <p className="font-medium">{task.task_title}</p>
          <div className="flex items-center gap-1.5">
            {statusIcon[task.status || "pending"]}
            <span className="capitalize">
              {(task.status || "pending").replace("_", " ")}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="capitalize">{prio.label}</span>
          </div>
          {task.clients?.client_name && (
            <p className="text-muted-foreground">{task.clients.client_name}</p>
          )}
          {task.profiles?.name && (
            <p className="text-muted-foreground">→ {task.profiles.name}</p>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  );
};

export default TaskPill;
