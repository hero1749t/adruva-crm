import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/hooks/useActivityLog";
import { sendStatusEmail } from "@/lib/send-status-email";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";

const COLUMNS = [
  {
    id: "new_lead",
    label: "New Lead",
    color: "border-muted-foreground/30",
    bgTint: "bg-surface/50",
    countColor: "bg-muted text-muted-foreground",
  },
  {
    id: "audit_booked",
    label: "Audit Booked",
    color: "border-primary/40",
    bgTint: "bg-primary/[0.03]",
    countColor: "bg-primary/15 text-primary",
  },
  {
    id: "audit_done",
    label: "Audit Done",
    color: "border-accent/40",
    bgTint: "bg-accent/[0.03]",
    countColor: "bg-accent/15 text-accent",
  },
  {
    id: "in_progress",
    label: "In Progress",
    color: "border-warning/40",
    bgTint: "bg-warning/[0.03]",
    countColor: "bg-warning/15 text-warning",
  },
  {
    id: "lead_won",
    label: "Lead Won",
    color: "border-success",
    bgTint: "bg-success/[0.06]",
    countColor: "bg-success/20 text-success",
  },
  {
    id: "lead_lost",
    label: "Lead Lost",
    color: "border-destructive",
    bgTint: "bg-destructive/[0.06]",
    countColor: "bg-destructive/20 text-destructive",
  },
] as const;

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
  leads: Lead[];
  isLoading: boolean;
}

export default function LeadsKanbanView({ leads, isLoading }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile } = useAuth();
  const canDrag = profile?.role === "owner" || profile?.role === "admin";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeLead = leads.find((l) => l.id === activeId);

  const grouped = COLUMNS.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.id] = leads.filter((l) => l.status === col.id);
    return acc;
  }, {});

  const handleDragStart = (event: DragStartEvent) => {
    if (!canDrag) return;
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    if (!canDrag) return;
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    if (!COLUMNS.some((c) => c.id === newStatus)) return;

    const oldStatus = lead.status;
    await supabase.from("leads").update({ status: newStatus as any }).eq("id", leadId);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
    logActivity({ entity: "lead", entityId: leadId, action: "status_changed", metadata: { name: lead.name, from: oldStatus, to: newStatus } });
    sendStatusEmail({ entity: "lead", entityName: lead.name, oldStatus, newStatus, assignedTo: lead.assigned_to });
    toast({ title: `${lead.name} → ${COLUMNS.find((c) => c.id === newStatus)?.label}` });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-6 gap-3">
        {COLUMNS.map((col) => (
          <div key={col.id} className={`space-y-3 rounded-xl border-t-2 ${col.color} ${col.bgTint} p-3`}>
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-24 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            bgTint={col.bgTint}
            countColor={col.countColor}
            leads={grouped[col.id] || []}
            canDrag={canDrag}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{
        duration: 250,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}>
        {activeLead ? <KanbanCard lead={activeLead} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
