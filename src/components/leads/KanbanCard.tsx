import { useDraggable } from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Building2, Phone, User } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  company_name: string | null;
  phone: string;
  assigned_to: string | null;
  profiles?: { name: string } | null;
}

interface Props {
  lead: Lead;
  isDragging?: boolean;
  canDrag?: boolean;
}

export default function KanbanCard({ lead, isDragging, canDrag }: Props) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
    disabled: !canDrag,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const assignedName = (lead as any).profiles?.name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && navigate(`/leads/${lead.id}`)}
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md",
        isDragging && "rotate-2 scale-105 shadow-xl ring-2 ring-primary/30",
        canDrag && "cursor-grab active:cursor-grabbing"
      )}
    >
      <p className="text-sm font-semibold text-foreground truncate">{lead.name}</p>
      {lead.company_name && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
          <Building2 className="h-3 w-3 shrink-0" /> {lead.company_name}
        </p>
      )}
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Phone className="h-3 w-3 shrink-0" /> {lead.phone}
      </p>
      {assignedName && (
        <div className="mt-2 flex items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
            {assignedName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] text-muted-foreground truncate">{assignedName}</span>
        </div>
      )}
    </div>
  );
}
