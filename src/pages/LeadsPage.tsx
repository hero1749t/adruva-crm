import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Download, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import NewLeadDrawer from "@/components/NewLeadDrawer";

const leadStatusConfig: Record<string, { label: string; color: string }> = {
  new_lead: { label: "New Lead", color: "bg-muted text-muted-foreground" },
  audit_booked: { label: "Audit Booked", color: "bg-primary/20 text-primary" },
  audit_done: { label: "Audit Done", color: "bg-accent/20 text-accent" },
  in_progress: { label: "In Progress", color: "bg-warning/20 text-warning" },
  lead_won: { label: "Lead Won", color: "bg-success/20 text-success" },
  lead_lost: { label: "Lead Lost", color: "bg-destructive/20 text-destructive" },
};

const LeadsPage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const perPage = 20;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", statusFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*, profiles!leads_assigned_to_fkey(name)")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company_name.ilike.%${search}%`);
      }

      const { data } = await query;
      return data || [];
    },
  });

  const totalPages = Math.ceil(leads.length / perPage);
  const paged = leads.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">{leads.length} total leads</p>
        </div>
        {isOwnerOrAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Lead
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 border-border bg-muted/30 pl-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40 border-border bg-muted/30 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(leadStatusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Name</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Company</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Phone</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Assigned To</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Source</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No leads found
                </td>
              </tr>
            ) : (
              paged.map((lead) => {
                const statusConf = leadStatusConfig[lead.status] || leadStatusConfig.new_lead;
                const assignedName = (lead as any).profiles?.name || "Unassigned";
                return (
                  <tr key={lead.id} className="border-b border-border/50 transition-colors hover:bg-primary/[0.03] cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.company_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{assignedName}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{lead.source?.replace("_", " ") || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "—"}</td>
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
    </div>
  );
};

export default LeadsPage;
