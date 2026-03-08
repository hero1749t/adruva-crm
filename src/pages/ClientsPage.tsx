import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/hooks/useActivityLog";
import { useState } from "react";

const clientStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-success/20 text-success" },
  paused: { label: "Paused", color: "bg-warning/20 text-warning" },
  completed: { label: "Completed", color: "bg-muted text-muted-foreground" },
};

const ClientsPage = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("*, profiles!clients_assigned_manager_fkey(name)")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(`client_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data } = await query;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">{clients.length} clients</p>
        </div>
        {isOwnerOrAdmin && (
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        )}
      </div>

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 border-border bg-muted/30 pl-9 text-sm"
        />
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
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Manager</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Start Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No clients yet</td>
              </tr>
            ) : (
              clients.map((client) => {
                const statusConf = clientStatusConfig[client.status || "active"];
                const managerName = (client as any).profiles?.name || "—";
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
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{managerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.start_date ? new Date(client.start_date).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsPage;
