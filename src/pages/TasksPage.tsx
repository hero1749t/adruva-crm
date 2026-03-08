import { useState } from "react";
import { Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockTasks, taskPriorityConfig, taskStatusConfig, currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TasksPage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const isOwnerOrAdmin = currentUser.role === "owner" || currentUser.role === "admin";

  const filtered = mockTasks
    .filter((t) => statusFilter === "all" || t.status === statusFilter)
    .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
    .filter(
      (t) =>
        !search ||
        t.task_title.toLowerCase().includes(search.toLowerCase()) ||
        t.client_name?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} tasks</p>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
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
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Task</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Client</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Priority</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Assigned To</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => {
              const priorityConf = taskPriorityConfig[task.priority];
              const statusConf = taskStatusConfig[task.status];
              const isOverdue = task.status === "overdue";
              return (
                <tr
                  key={task.id}
                  className={cn(
                    "border-b border-border/50 transition-colors hover:bg-primary/[0.03] cursor-pointer",
                    isOverdue && "border-l-2 border-l-destructive"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{task.task_title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{task.client_name}</td>
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
                  <td className="px-4 py-3 text-muted-foreground">{task.assigned_to_name || "Unassigned"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(task.deadline).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TasksPage;
