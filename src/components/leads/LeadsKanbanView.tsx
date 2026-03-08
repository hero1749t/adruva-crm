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
  { id: "new_lead", label: "New Lead", color: "border-muted-foreground/30" },
  { id: "audit_booked", label: "Audit Booked", color: "border-primary/40" },
  { id: "audit_done", label: "Audit Done", color: "border-accent/40" },
  { id: "in_progress", label: "In Progress", color: "border-warning/40" },
  { id: "lead_won", label: "Lead Won", color: "border-success/40" },
  { id: "lead_lost", label: "Lead Lost", color: "border-destructive/40" },
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

    // Check it's a valid column
    if (!COLUMNS.some((c) => c.id === newStatus)) return;

    const oldStatus = lead.status;
    await supabase.from("leads").update({ status: newStatus as any }).eq("id", leadId);
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    logActivity({ entity: "lead", entityId: leadId, action: "status_changed", metadata: { name: lead.name, from: oldStatus, to: newStatus } });
    sendStatusEmail({ entity: "lead", entityName: lead.name, oldStatus, newStatus, assignedTo: lead.assigned_to });
    toast({ title: `${lead.name} → ${COLUMNS.find((c) => c.id === newStatus)?.label}` });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-6 gap-3">
        {COLUMNS.map((col) => (
          <div key={col.id} className="space-y-3 rounded-xl border border-border bg-surface/50 p-3">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded bg-muted/50" />
            <div className="h-20 animate-pulse rounded bg-muted/50" />
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
            leads={grouped[col.id] || []}
            canDrag={canDrag}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <KanbanCard lead={activeLead} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
