import { useState } from "react";
import { Search, Plus, Download, UserPlus, CheckCircle2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
import { cn } from "@/lib/utils";

const taskPriorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-destructive/20 text-destructive" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-400" },
  medium: { label: "Medium", color: "bg-warning/20 text-warning" },
  low: { label: "Low", color: "bg-success/20 text-success" },
};

const taskStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-primary/20 text-primary" },
  completed: { label: "Completed", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
};

const TasksPage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", statusFilter, priorityFilter, search, assignedFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, clients!tasks_client_id_fkey(client_name), profiles!tasks_assigned_to_fkey(name)")
        .order("deadline", { ascending: true });

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as any);
      if (search) query = query.ilike("task_title", `%${search}%`);
      if (assignedFilter !== "all") {
        if (assignedFilter === "unassigned") {
          query = query.is("assigned_to", null);
        } else {
          query = query.eq("assigned_to", assignedFilter);
        }
      }

      const { data } = await query;
      return data || [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
  });

  const totalPages = Math.ceil(tasks.length / perPage);
  const paged = tasks.slice((page - 1) * perPage, page * perPage);
  const allSelected = paged.length > 0 && paged.every((t) => selected.has(t.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map((t) => t.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const bulkAssign = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("tasks")
        .update({ assigned_to: bulkAssignTo || null })
        .in("id", ids);
      if (error) throw error;
      for (const id of ids) {
        const task = tasks.find((t) => t.id === id);
        logActivity({
          entity: "task",
          entityId: id,
          action: "assigned",
          metadata: {
            title: task?.task_title,
            to: teamMembers.find((m) => m.id === bulkAssignTo)?.name || "Unassigned",
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: `${selected.size} task(s) reassigned` });
      clearSelection();
      setAssignDialogOpen(false);
      setBulkAssignTo("");
    },
    onError: (err: Error) => {
      toast({ title: "Assign failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkComplete = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" as any, completed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      for (const id of ids) {
        const task = tasks.find((t) => t.id === id);
        logActivity({
          entity: "task",
          entityId: id,
          action: "completed",
          metadata: { title: task?.task_title },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: `${selected.size} task(s) marked as completed` });
      clearSelection();
      setCompleteDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Complete failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tasks.length} tasks</p>
        </div>
        {isOwnerOrAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-foreground">
            {selected.size} task{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isOwnerOrAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setCompleteDialogOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <UserPlus className="h-4 w-4" /> Assign
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-border bg-muted/30 pl-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36 border-border bg-muted/30 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(taskStatusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36 border-border bg-muted/30 text-sm">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {Object.entries(taskPriorityConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="h-9 w-44 border-border bg-muted/30 text-sm">
            <SelectValue placeholder="All Assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assigned</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {isOwnerOrAdmin && (
                <th className="w-10 px-3 py-3">
                  <Checkbox
                    checked={allSelected && tasks.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Task</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Client</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Priority</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Assigned To</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: isOwnerOrAdmin ? 7 : 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={isOwnerOrAdmin ? 7 : 6} className="px-4 py-12 text-center text-muted-foreground">No tasks found</td>
              </tr>
            ) : (
              paged.map((task) => {
                const priorityConf = taskPriorityConfig[task.priority || "medium"];
                const statusConf = taskStatusConfig[task.status || "pending"];
                const isOverdue = task.status === "overdue";
                const clientName = (task as any).clients?.client_name || "—";
                const assignedName = (task as any).profiles?.name || "Unassigned";
                const isSelected = selected.has(task.id);
                return (
                  <tr
                    key={task.id}
                    className={cn(
                      "border-b border-border/50 transition-colors cursor-pointer",
                      isOverdue && "border-l-2 border-l-destructive",
                      isSelected ? "bg-primary/[0.06]" : "hover:bg-primary/[0.03]"
                    )}
                  >
                    {isOwnerOrAdmin && (
                      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(task.id)}
                          aria-label={`Select ${task.task_title}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-foreground">{task.task_title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{clientName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${priorityConf.color}`}>
                        {priorityConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{assignedName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{task.deadline ? new Date(task.deadline).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Assign Dialog */}
      <AlertDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign {selected.size} task{selected.size !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              Select a team member to assign the selected tasks to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
            <SelectTrigger className="w-full border-border">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkAssignTo("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!bulkAssignTo || bulkAssign.isPending}
              onClick={(e) => { e.preventDefault(); bulkAssign.mutate(); }}
            >
              {bulkAssign.isPending ? "Assigning..." : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Complete Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete {selected.size} task{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the selected tasks as completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkComplete.isPending}
              onClick={(e) => { e.preventDefault(); bulkComplete.mutate(); }}
            >
              {bulkComplete.isPending ? "Completing..." : "Mark Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TasksPage;
