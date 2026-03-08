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
  leads: Lead[];
  canDrag: boolean;
}

export default function KanbanColumn({ id, label, color, leads, canDrag }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] flex-col rounded-xl border-t-2 bg-surface/50 p-2 transition-colors",
        color,
        isOver && "bg-primary/[0.06] ring-1 ring-primary/20"
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} canDrag={canDrag} />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 p-4">
            <span className="text-xs text-muted-foreground/50">No leads</span>
          </div>
        )}
      </div>
    </div>
  );
}
