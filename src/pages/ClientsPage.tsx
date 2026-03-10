import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { exportClientsCsv } from "@/lib/csv-utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/hooks/useActivityLog";
import { useDebounce } from "@/hooks/use-debounce";
import { useClientHealthScores } from "@/hooks/useClientHealthScore";
import HealthScoreBadge from "@/components/HealthScoreBadge";
import { useCustomFieldDefs, useCustomFieldValues } from "@/hooks/useCustomFields";

const clientStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-success/20 text-success" },
  paused: { label: "Paused", color: "bg-warning/20 text-warning" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground" },
};

const ClientsPage = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const perPage = 25;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["clients", debouncedSearch, page],
    queryFn: async () => {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let query = supabase
        .from("clients")
        .select("*, profiles!clients_assigned_manager_fkey(name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (debouncedSearch) {
        query = query.or(`client_name.ilike.%${debouncedSearch}%,company_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
      }

      const { data, count } = await query;
      return { clients: data || [], total: count || 0 };
    },
  });

  const clients = data?.clients || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / perPage);
  const startItem = totalCount === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalCount);

  const clientIds = clients.map((c) => c.id);
  const { data: healthScores } = useClientHealthScores(clientIds);

  const { data: customFieldDefs = [] } = useCustomFieldDefs("client");
  const { data: customFieldValues = {} } = useCustomFieldValues("client", clientIds);

  // Filter by health
  const filteredClients = healthFilter === "all"
    ? clients
    : clients.filter((c) => {
        const h = healthScores?.[c.id];
        if (!h) return false;
        if (healthFilter === "critical") return h.label === "Critical";
        if (healthFilter === "at_risk") return h.label === "At Risk";
        if (healthFilter === "healthy") return h.label === "Healthy";
        return true;
      });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {isOwnerOrAdmin ? "Clients" : "My Clients"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} {isOwnerOrAdmin ? "" : "assigned "}client{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportClientsCsv(clients, customFieldDefs, customFieldValues)}>
            <Download className="h-4 w-4" /> Export
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 border-border bg-muted/30 pl-9 text-sm"
          />
        </div>
        <Select value={healthFilter} onValueChange={(v) => { setHealthFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40 border-border bg-muted/30 text-sm">
            <SelectValue placeholder="All Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="healthy">Healthy (80+)</SelectItem>
            <SelectItem value="at_risk">At Risk (50-79)</SelectItem>
            <SelectItem value="critical">Critical (&lt;50)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Client Name</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Company</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Plan</th>
              {isOwnerOrAdmin && (
                <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Monthly</th>
              )}
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Health</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Manager</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Start Date</th>
              {customFieldDefs.map((def) => (
                <th key={def.id} className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">{def.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))
            ) : filteredClients.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No clients found</td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const statusConf = clientStatusConfig[client.status || "active"];
                const managerName = (client as any).profiles?.name || "—";
                const health = healthScores?.[client.id];
                return (
                  <tr key={client.id} className="border-b border-border/50 transition-colors hover:bg-primary/[0.03] cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                    <td className="px-4 py-3 font-medium text-foreground">{client.client_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.company_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
                        {client.plan?.replace("_", " ") || "—"}
                      </span>
                    </td>
                    {isOwnerOrAdmin && (
                      <td className="px-4 py-3 text-muted-foreground">₹{Number(client.monthly_payment)?.toLocaleString() || "—"}</td>
                    )}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {isOwnerOrAdmin ? (
                        <Select
                          value={client.status || "active"}
                          onValueChange={(v) => {
                            supabase.from("clients").update({ status: v as any }).eq("id", client.id).then(() => {
                              queryClient.invalidateQueries({ queryKey: ["clients"] });
                              logActivity({ entity: "client", entityId: client.id, action: "status_changed", metadata: { name: client.client_name, from: client.status, to: v } });
                            });
                          }}
                        >
                          <SelectTrigger className={`h-7 w-[110px] border-none px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(clientStatusConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <HealthScoreBadge health={health} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{managerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.start_date ? new Date(client.start_date).toLocaleDateString() : "—"}</td>
                    {customFieldDefs.map((def) => (
                      <td key={def.id} className="px-4 py-3 text-muted-foreground">
                        {(() => { const v = customFieldValues[client.id]?.[def.id]; return (typeof v === "object" && v !== null ? JSON.stringify(v) : v) || "—"; })()}
                      </td>
                    ))}
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientsPage;
