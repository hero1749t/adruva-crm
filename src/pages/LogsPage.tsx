import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ScrollText,
  Search,
  Filter,
  UserPlus,
  UserCheck,
  ClipboardList,
  RefreshCw,
  ArrowUpDown,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

interface ActivityLog {
  id: string;
  created_at: string | null;
  user_id: string | null;
  entity: string;
  entity_id: string;
  action: string;
  metadata: Json | null;
  profiles: { name: string } | null;
}

const entityIcons: Record<string, React.ElementType> = {
  lead: UserPlus,
  client: UserCheck,
  task: ClipboardList,
};

const actionColors: Record<string, string> = {
  created: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  updated: "bg-primary/15 text-primary border-primary/20",
  deleted: "bg-destructive/15 text-destructive border-destructive/20",
  status_changed: "bg-warning/15 text-warning border-warning/20",
  assigned: "bg-accent/15 text-accent-foreground border-accent/20",
  converted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const entityOptions = [
  { value: "all", label: "All entities" },
  { value: "lead", label: "Leads" },
  { value: "client", label: "Clients" },
  { value: "task", label: "Tasks" },
];

const actionOptions = [
  { value: "all", label: "All actions" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "status_changed", label: "Status Changed" },
  { value: "assigned", label: "Assigned" },
  { value: "converted", label: "Converted" },
];

const LogsPage = () => {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const navigate = useNavigate();

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["activity-logs", entityFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("activity_logs")
        .select("*, profiles!activity_logs_user_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (entityFilter !== "all") {
        query = query.eq("entity", entityFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ActivityLog[];
    },
  });

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const meta = log.metadata as Record<string, unknown> | null;
    const name = meta?.name as string || "";
    return (
      log.entity.toLowerCase().includes(s) ||
      log.action.toLowerCase().includes(s) ||
      (log.profiles?.name || "").toLowerCase().includes(s) ||
      name.toLowerCase().includes(s)
    );
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created": return <UserPlus className="h-3.5 w-3.5" />;
      case "updated": return <Pencil className="h-3.5 w-3.5" />;
      case "deleted": return <Trash2 className="h-3.5 w-3.5" />;
      case "status_changed": return <ArrowUpDown className="h-3.5 w-3.5" />;
      case "converted": return <RefreshCw className="h-3.5 w-3.5" />;
      default: return <Eye className="h-3.5 w-3.5" />;
    }
  };

  const formatMetadata = (log: ActivityLog) => {
    const meta = log.metadata as Record<string, unknown> | null;
    if (!meta) return null;

    const parts: string[] = [];
    if (meta.name) parts.push(`"${meta.name}"`);
    if (meta.from && meta.to) parts.push(`${meta.from} → ${meta.to}`);
    if (meta.field) parts.push(`field: ${meta.field}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  return (
    <div className="space-y-6 min-w-0">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Activity Logs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track all actions performed across the CRM
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-border bg-muted/30"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[150px] border-border bg-muted/30">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {entityOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[170px] border-border bg-muted/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Log entries */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_120px_180px_1fr] gap-2 border-b border-border bg-surface px-4 py-2.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            User
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Entity
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Action
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Timestamp
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Details
          </span>
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-border/50 px-4 py-3">
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            </div>
          ))
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <ScrollText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {logs.length === 0 ? "No activity logs yet" : "No logs match your filters"}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const EntityIcon = entityIcons[log.entity] || ScrollText;
            const details = formatMetadata(log);

            return (
              <div
                key={log.id}
                className="grid grid-cols-[1fr_120px_120px_180px_1fr] items-center gap-2 border-b border-border/50 px-4 py-2.5 transition-colors hover:bg-muted/20 cursor-pointer"
                onClick={() => {
                  const entity = log.entity;
                  const id = log.entity_id;
                  if (entity === "lead") navigate(`/leads/${id}`);
                  else if (entity === "client") navigate(`/clients/${id}`);
                  else if (entity === "task") navigate(`/tasks`);
                  else if (entity === "team") navigate(`/team`);
                }}
              >
                <span className="text-sm text-foreground truncate">
                  {log.profiles?.name || "System"}
                </span>
                <div className="flex items-center gap-1.5">
                  <EntityIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm capitalize text-muted-foreground">{log.entity}</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "w-fit gap-1 text-[11px] font-medium capitalize",
                    actionColors[log.action] || "bg-muted/30 text-muted-foreground"
                  )}
                >
                  {getActionIcon(log.action)}
                  {log.action.replace("_", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {log.created_at
                    ? format(new Date(log.created_at), "dd MMM yyyy, hh:mm a")
                    : "—"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {details || "—"}
                </span>
              </div>
            );
          })
        )}
        </div>
      </div>

      {filteredLogs.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filteredLogs.length} of {logs.length} entries
        </p>
      )}
    </div>
  );
};

export default LogsPage;
