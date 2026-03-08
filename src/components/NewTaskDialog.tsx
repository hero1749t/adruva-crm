import { useState } from "react";
import { logActivity } from "@/hooks/useActivityLog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type TaskPriority = Database["public"]["Enums"]["task_priority"];

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: Date;
}

const NewTaskDialog = ({ open, onOpenChange, defaultDate }: NewTaskDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [notes, setNotes] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, client_name")
        .eq("status", "active")
        .order("client_name");
      return data || [];
    },
    enabled: open,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const [assignedTo, setAssignedTo] = useState("");

  const createTask = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("tasks").insert({
        task_title: title,
        client_id: clientId,
        priority,
        deadline: defaultDate.toISOString(),
        assigned_to: assignedTo || null,
        notes: notes || null,
        status: "pending",
      }).select("id").single();
      if (error) throw error;
      return { id: data.id };
    },
    onSuccess: (result) => {
      logActivity({ entity: "task", entityId: result.id, action: "created", metadata: { name: title } });
      toast({ title: "Task created", description: `"${title}" added for ${format(defaultDate, "MMM d, yyyy")}` });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      resetAndClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetAndClose = () => {
    setTitle("");
    setClientId("");
    setPriority("medium");
    setNotes("");
    setAssignedTo("");
    onOpenChange(false);
  };

  const canSubmit = title.trim() && clientId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            New Task — {format(defaultDate, "MMM d, yyyy")}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) createTask.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="e.g. Monthly SEO report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-notes">Notes (optional)</Label>
            <Textarea
              id="task-notes"
              placeholder="Any additional details…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || createTask.isPending}>
              {createTask.isPending ? "Creating…" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewTaskDialog;
