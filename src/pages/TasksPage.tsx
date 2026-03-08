import { useState } from "react";
import { Search, Plus, Download, UserPlus, CheckCircle2, X, ChevronLeft, ChevronRight, User } from "lucide-react";
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
import { sendStatusEmail } from "@/lib/send-status-email";
import { notifyTaskAssigned } from "@/lib/email-notifications";
import { cn } from "@/lib/utils";
import TaskDetailDrawer from "@/components/TaskDetailDrawer";
import { useDebounce } from "@/hooks/use-debounce";

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
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [detailTask, setDetailTask] = useState<any | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", statusFilter, priorityFilter, debouncedSearch, assignedFilter, dateFilter, page],
    queryFn: async () => {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let query = supabase
        .from("tasks")
        .select("*, clients!tasks_client_id_fkey(client_name), profiles!tasks_assigned_to_fkey(name)", { count: "exact" })
        .order("deadline", { ascending: true })
        .range(from, to);

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter as any);
      if (debouncedSearch) query = query.ilike("task_title", `%${debouncedSearch}%`);
      if (assignedFilter !== "all") {
        if (assignedFilter === "unassigned") {
          query = query.is("assigned_to", null);
        } else {
          query = query.eq("assigned_to", assignedFilter);
        }
      }

      if (dateFilter !== "all") {
        const now = new Date();
        let startDate = "";
        let endDate = "";
        if (dateFilter === "today") {
          startDate = now.toISOString().split("T")[0];
        } else if (dateFilter === "yesterday") {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = yesterday.toISOString().split("T")[0];
          endDate = now.toISOString().split("T")[0];
        } else if (dateFilter === "this_week") {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          startDate = weekStart.toISOString().split("T")[0];
        } else if (dateFilter === "this_month") {
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        }
        if (startDate) query = query.gte("deadline", startDate);
        if (endDate) query = query.lt("deadline", endDate);
      }

      const { data, count } = await query;
      return { tasks: data || [], total: count || 0 };
    },
  });

  const tasks = data?.tasks || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / perPage);

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

  const allSelected = tasks.length > 0 && tasks.every((t) => selected.has(t.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(tasks.map((t) => t.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const bulkAssign = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("tasks").update({ assigned_to: bulkAssignTo || null }).in("id", ids);
      if (error) throw error;
      const assigneeName = teamMembers.find((m) => m.id === bulkAssignTo)?.name || "Unassigned";
      for (const id of ids) {
        const task = tasks.find((t) => t.id === id);
        logActivity({ entity: "task", entityId: id, action: "assigned", metadata: { title: task?.task_title, to: assigneeName } });
      }
      if (bulkAssignTo) {
        for (const id of ids) {
          const task = tasks.find((t) => t.id === id);
          const clientName = (task as any)?.clients?.client_name;
          notifyTaskAssigned({ taskTitle: task?.task_title || "", assignedToId: bulkAssignTo, assignedToName: assigneeName, clientName, deadline: task?.deadline });
        }
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
      const { error } = await supabase.from("tasks").update({ status: "completed" as any, completed_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
      for (const id of ids) {
        const task = tasks.find((t) => t.id === id);
        logActivity({ entity: "task", entityId: id, action: "completed", metadata: { title: task?.task_title } });
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

  const startItem = totalCount === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">{totalCount} tasks</p>
        </div>
        {isOwnerOrAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New Task</Button>
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-foreground">{selected.size} task{selected.size !== 1 ? "s" : ""} selected</span>
          <div className="ml-auto flex items-center gap-2">
            {isOwnerOrAdmin && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setCompleteDialogOpen(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssignDialogOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Assign
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={clearSelection}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {profile?.id && (
          <Button
            variant={assignedFilter === profile.id ? "default" : "outline"}
            size="sm"
            className="h-9 gap-2"
            onClick={() => { setAssignedFilter(assignedFilter === profile.id ? "all" : profile.id); setPage(1); }}
          >
            <User className="h-4 w-4" /> My Tasks
          </Button>
        )}
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 border-border bg-muted/30 pl-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36 border-border bg-muted/30 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(taskStatusConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36 border-border bg-muted/30 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {Object.entries(taskPriorityConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={(v) => { setAssignedFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-44 border-border bg-muted/30 text-sm"><SelectValue placeholder="All Assigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assigned</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {teamMembers.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40 border-border bg-muted/30 text-sm"><SelectValue placeholder="All Dates" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {isOwnerOrAdmin && (
                <th className="w-10 px-3 py-3"><Checkbox checked={allSelected && tasks.length > 0} onCheckedChange={toggleAll} aria-label="Select all" /></th>
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
              <tr><td colSpan={isOwnerOrAdmin ? 7 : 6} className="px-4 py-12 text-center text-muted-foreground">No tasks found</td></tr>
            ) : (
              tasks.map((task) => {
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
                    onClick={() => setDetailTask(task)}
                  >
                    {isOwnerOrAdmin && (
                      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(task.id)} aria-label={`Select ${task.task_title}`} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-foreground">{task.task_title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{clientName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${priorityConf.color}`}>{priorityConf.label}</span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={task.status || "pending"}
                        onValueChange={(v) => {
                          const updates: any = { status: v };
                          if (v === "completed") updates.completed_at = new Date().toISOString();
                          const oldStatus = task.status || "pending";
                          supabase.from("tasks").update(updates).eq("id", task.id).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["tasks"] });
                            logActivity({ entity: "task", entityId: task.id, action: "status_changed", metadata: { title: task.task_title, from: oldStatus, to: v } });
                            sendStatusEmail({ entity: "task", entityName: task.task_title, oldStatus, newStatus: v, assignedTo: task.assigned_to });
                          });
                        }}
                      >
                        <SelectTrigger className={`h-7 w-[120px] border-none px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(taskStatusConfig).map(([key, config]) => (<SelectItem key={key} value={key}>{config.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount > 0 ? `Showing ${startItem}–${endItem} of ${totalCount} results` : "No results"}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      <AlertDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign {selected.size} task{selected.size !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>Select a team member to assign the selected tasks to.</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
            <SelectTrigger className="w-full border-border"><SelectValue placeholder="Select team member" /></SelectTrigger>
            <SelectContent>
              {teamMembers.map((m) => (<SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkAssignTo("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!bulkAssignTo || bulkAssign.isPending} onClick={(e) => { e.preventDefault(); bulkAssign.mutate(); }}>
              {bulkAssign.isPending ? "Assigning..." : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete {selected.size} task{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the selected tasks as completed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={bulkComplete.isPending} onClick={(e) => { e.preventDefault(); bulkComplete.mutate(); }}>
              {bulkComplete.isPending ? "Completing..." : "Mark Complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onOpenChange={(open) => { if (!open) setDetailTask(null); }} />
    </div>
  );
};

export default TasksPage;
