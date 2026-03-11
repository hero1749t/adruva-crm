import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, Clock, User, Building2, FileText, Globe, ExternalLink, Trash2, Pencil, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-destructive/20 text-destructive" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-400" },
  medium: { label: "Medium", color: "bg-warning/20 text-warning" },
  low: { label: "Low", color: "bg-success/20 text-success" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-primary/20 text-primary" },
  completed: { label: "Completed", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
};

interface TaskDetailDrawerProps {
  task: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/5"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

export default function TaskDetailDrawer({ task, open, onOpenChange }: TaskDetailDrawerProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = profile?.role === "owner";
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editStatus, setEditStatus] = useState("pending");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editDeadline, setEditDeadline] = useState("");

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
    enabled: open && editing,
  });

  const startEditing = () => {
    if (!task) return;
    setEditTitle(task.task_title || "");
    setEditNotes(task.notes || "");
    setEditPriority(task.priority || "medium");
    setEditStatus(task.status || "pending");
    setEditAssignedTo(task.assigned_to || "unassigned");
    setEditDeadline(task.deadline ? new Date(task.deadline).toISOString().split("T")[0] : "");
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const updateTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const updates: any = {
        task_title: editTitle,
        notes: editNotes || null,
        priority: editPriority,
        status: editStatus,
        assigned_to: editAssignedTo === "unassigned" ? null : editAssignedTo,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : task.deadline,
      };
      if (editStatus === "completed" && task.status !== "completed") {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
      if (error) throw error;
      logActivity({ entity: "task", entityId: task.id, action: "updated", metadata: { title: editTitle } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      toast({ title: "Task updated" });
      setEditing(false);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
      logActivity({ entity: "task", entityId: task.id, action: "deleted", metadata: { title: task.task_title } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      toast({ title: "Task deleted" });
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  if (!task) return null;

  const priority = priorityConfig[task.priority || "medium"];
  const status = statusConfig[task.status || "pending"];
  const clientName = task.clients?.client_name || "—";
  const assignedName = task.profiles?.name || "Unassigned";
  const hasLinks = task.website_link || task.gmb_link || task.meta_link;
  const canEdit = isOwnerOrAdmin || task.assigned_to === profile?.id;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) setEditing(false); onOpenChange(v); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">{editing ? "Edit Task" : task.task_title}</SheetTitle>
              {canEdit && !editing && (
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
            <SheetDescription className="sr-only">Task details</SheetDescription>
            {!editing && (
              <div className="flex items-center gap-2 pt-1">
                <span className={cn("inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider", priority.color)}>
                  {priority.label}
                </span>
                <span className={cn("inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider", status.color)}>
                  {status.label}
                </span>
              </div>
            )}
          </SheetHeader>

          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); updateTask.mutate(); }} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([key, c]) => (
                        <SelectItem key={key} value={key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([key, c]) => (
                        <SelectItem key={key} value={key}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isOwnerOrAdmin && (
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={cancelEditing} className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!editTitle.trim() || updateTask.isPending} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> {updateTask.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <Separator className="my-4" />
              <div className="space-y-1">
                <DetailRow icon={Building2} label="Client">{clientName}</DetailRow>
                <DetailRow icon={User} label="Assigned To">{assignedName}</DetailRow>
                <DetailRow icon={Calendar} label="Deadline">
                  {task.deadline ? new Date(task.deadline).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "—"}
                </DetailRow>
                {task.start_date && (
                  <DetailRow icon={Calendar} label="Start Date">
                    {new Date(task.start_date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </DetailRow>
                )}
                {task.completed_at && (
                  <DetailRow icon={Clock} label="Completed At">{new Date(task.completed_at).toLocaleString()}</DetailRow>
                )}
              </div>

              {task.notes && (
                <>
                  <Separator className="my-4" />
                  <DetailRow icon={FileText} label="Notes">
                    <p className="whitespace-pre-wrap text-muted-foreground">{task.notes}</p>
                  </DetailRow>
                </>
              )}

              {hasLinks && (
                <>
                  <Separator className="my-4" />
                  <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Links</p>
                  <div className="flex flex-col gap-2">
                    <LinkRow label="Website" url={task.website_link} />
                    <LinkRow label="Google Business" url={task.gmb_link} />
                    <LinkRow label="Meta Business" url={task.meta_link} />
                  </div>
                </>
              )}

              <Separator className="my-4" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Created {task.created_at ? new Date(task.created_at).toLocaleDateString() : "—"}</span>
                <span>Updated {task.updated_at ? new Date(task.updated_at).toLocaleDateString() : "—"}</span>
              </div>

              {isOwner && (
                <>
                  <Separator className="my-4" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete Task
                  </Button>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task "{task.task_title}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this task. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteTask.isPending} onClick={(e) => { e.preventDefault(); deleteTask.mutate(); }}>
              {deleteTask.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
