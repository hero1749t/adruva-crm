import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import KanbanCard from "./KanbanCard";

interface Lead {
  id: string;
  name: string;
  company_name: string | null;
  phone: string;
  status: string;
  assigned_to: string | null;
  profiles?: { name: string } | null;
}

interface Props {
  id: string;
  label: string;
  color: string;
  bgTint: string;
  countColor: string;
  leads: Lead[];
  canDrag: boolean;
}

export default function KanbanColumn({ id, label, color, bgTint, countColor, leads, canDrag }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] flex-col rounded-xl border-t-2 p-2 transition-all duration-300",
        color,
        bgTint,
        isOver && "ring-2 ring-primary/30 scale-[1.01] shadow-lg"
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums transition-all duration-300",
            countColor,
          )}
          key={leads.length} // re-mount for animation
        >
          <span className="inline-block animate-scale-in">{leads.length}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {leads.map((lead, i) => (
          <div
            key={lead.id}
            className="animate-fade-in"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
          >
            <KanbanCard lead={lead} canDrag={canDrag} />
          </div>
        ))}
        {leads.length === 0 && (
          <div className={cn(
            "flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 transition-all duration-300",
            isOver ? "border-primary/40 bg-primary/[0.04]" : "border-border/50"
          )}>
            <span className="text-xs text-muted-foreground/50">
              {isOver ? "Drop here" : "No leads"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
