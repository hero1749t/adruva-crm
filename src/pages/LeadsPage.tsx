import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Download, Upload, ChevronLeft, ChevronRight, Trash2, UserPlus, X, ArrowUpDown, LayoutGrid, List } from "lucide-react";
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
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
import { sendStatusEmail } from "@/lib/send-status-email";
import { notifyLeadAssigned } from "@/lib/email-notifications";
import NewLeadDrawer from "@/components/NewLeadDrawer";
import ImportLeadsDialog from "@/components/ImportLeadsDialog";
import LeadsKanbanView from "@/components/leads/LeadsKanbanView";
import { exportLeadsCsv } from "@/lib/csv-utils";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useCustomFieldDefs, useCustomFieldValues } from "@/hooks/useCustomFields";
import { useDebounce } from "@/hooks/use-debounce";

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
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const perPage = 25;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const isOwnerOrAdmin = can("leads", "create");
  const isOwner = can("leads", "delete");

  const { data, isLoading } = useQuery({
    queryKey: ["leads", statusFilter, debouncedSearch, assignedFilter, dateFilter, page],
    queryFn: async () => {
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      let query = supabase
        .from("leads")
        .select("*, profiles!leads_assigned_to_fkey(name)", { count: "exact" })
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (assignedFilter !== "all") {
        if (assignedFilter === "unassigned") {
          query = query.is("assigned_to", null);
        } else {
          query = query.eq("assigned_to", assignedFilter);
        }
      }
      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,company_name.ilike.%${debouncedSearch}%`);
      }

      if (dateFilter !== "all") {
        const now = new Date();
        let startDate = "";
        let endDate: string | undefined;
        if (dateFilter === "today") {
          startDate = now.toISOString().split("T")[0];
        } else if (dateFilter === "yesterday") {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = yesterday.toISOString().split("T")[0];
          endDate = now.toISOString().split("T")[0];
        } else if (dateFilter === "this_month") {
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        }
        if (startDate) query = query.gte("created_at", startDate);
        if (endDate) query = query.lt("created_at", endDate);
      }

      const { data, count } = await query;
      return { leads: data || [], total: count || 0 };
    },
  });

  const leads = data?.leads || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / perPage);

  // Kanban: fetch all leads (no pagination)
  const { data: kanbanData, isLoading: kanbanLoading } = useQuery({
    queryKey: ["leads-kanban", statusFilter, debouncedSearch, assignedFilter, dateFilter],
    enabled: viewMode === "kanban",
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*, profiles!leads_assigned_to_fkey(name)")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (assignedFilter !== "all") {
        if (assignedFilter === "unassigned") query = query.is("assigned_to", null);
        else query = query.eq("assigned_to", assignedFilter);
      }
      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,company_name.ilike.%${debouncedSearch}%`);
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

  const allPageSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        leads.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        leads.forEach((l) => next.add(l.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelected(new Set());

  const bulkAssign = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: bulkAssignTo || null })
        .in("id", ids);
      if (error) throw error;
      const assigneeName = teamMembers.find((m) => m.id === bulkAssignTo)?.name || "Unassigned";
      for (const id of ids) {
        const lead = leads.find((l) => l.id === id);
        logActivity({ entity: "lead", entityId: id, action: "assigned", metadata: { name: lead?.name, to: assigneeName } });
      }
      if (bulkAssignTo) {
        for (const id of ids) {
          const lead = leads.find((l) => l.id === id);
          notifyLeadAssigned({ leadName: lead?.name || "", assignedToId: bulkAssignTo, assignedToName: assigneeName });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: `${selected.size} lead(s) reassigned` });
      clearSelection();
      setAssignDialogOpen(false);
      setBulkAssignTo("");
    },
    onError: (err: Error) => {
      toast({ title: "Assign failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkStatusChange = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("leads").update({ status: bulkStatus as any }).in("id", ids);
      if (error) throw error;
      for (const id of ids) {
        const lead = leads.find((l) => l.id === id);
        logActivity({ entity: "lead", entityId: id, action: "status_changed", metadata: { name: lead?.name, from: lead?.status, to: bulkStatus } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: `${selected.size} lead(s) status updated` });
      clearSelection();
      setStatusDialogOpen(false);
      setBulkStatus("");
    },
    onError: (err: Error) => {
      toast({ title: "Status update failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("leads").update({ is_deleted: true }).in("id", ids);
      if (error) throw error;
      for (const id of ids) {
        const lead = leads.find((l) => l.id === id);
        logActivity({ entity: "lead", entityId: id, action: "deleted", metadata: { name: lead?.name } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: `${selected.size} lead(s) deleted` });
      clearSelection();
      setDeleteDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const startItem = totalCount === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {isOwnerOrAdmin ? "Leads" : "My Leads"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} {isOwnerOrAdmin ? "total" : "assigned"} lead{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2.5"
              onClick={() => setViewMode("table")}
            >
              <List className="h-3.5 w-3.5" /> Table
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2.5"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </Button>
          </div>
          {isOwnerOrAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" /> Import
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => exportLeadsCsv(leads)}>
                <Download className="h-4 w-4" /> Export
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setDrawerOpen(true)}>
                <Plus className="h-4 w-4" /> New Lead
              </Button>
            </div>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-foreground">
            {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isOwnerOrAdmin && (
              <>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setStatusDialogOpen(true)}>
                  <ArrowUpDown className="h-4 w-4" /> Status
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssignDialogOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Assign
                </Button>
              </>
            )}
            {isOwner && (
              <Button variant="outline" size="sm" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
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
        <Select value={assignedFilter} onValueChange={(v) => { setAssignedFilter(v); setPage(1); }}>
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
        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40 border-border bg-muted/30 text-sm">
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {viewMode === "kanban" ? (
        <LeadsKanbanView leads={kanbanData || []} isLoading={kanbanLoading} />
      ) : (
      <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {isOwnerOrAdmin && (
                <th className="w-10 px-3 py-3">
                  <Checkbox checked={allPageSelected && leads.length > 0} onCheckedChange={toggleAll} aria-label="Select all" />
                </th>
              )}
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
                  {Array.from({ length: isOwnerOrAdmin ? 8 : 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={isOwnerOrAdmin ? 8 : 7} className="px-4 py-12 text-center text-muted-foreground">No leads found</td>
              </tr>
            ) : (
              leads.map((lead) => {
                const statusConf = leadStatusConfig[lead.status] || leadStatusConfig.new_lead;
                const assignedName = (lead as any).profiles?.name || "Unassigned";
                const isSelected = selected.has(lead.id);
                return (
                  <tr
                    key={lead.id}
                    className={cn(
                      "border-b border-border/50 transition-colors cursor-pointer",
                      isSelected ? "bg-primary/[0.06]" : "hover:bg-primary/[0.03]"
                    )}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    {isOwnerOrAdmin && (
                      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(lead.id)} aria-label={`Select ${lead.name}`} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-foreground">{lead.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.company_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.phone}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {isOwnerOrAdmin ? (
                        <Select
                          value={lead.status}
                          onValueChange={(v) => {
                            const oldStatus = lead.status;
                            supabase.from("leads").update({ status: v as any }).eq("id", lead.id).then(() => {
                              queryClient.invalidateQueries({ queryKey: ["leads"] });
                              logActivity({ entity: "lead", entityId: lead.id, action: "status_changed", metadata: { name: lead.name, from: oldStatus, to: v } });
                              sendStatusEmail({ entity: "lead", entityName: lead.name, oldStatus, newStatus: v, assignedTo: lead.assigned_to });
                            });
                          }}
                        >
                          <SelectTrigger className={`h-7 w-[130px] border-none px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(leadStatusConfig).map(([key, config]) => (
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
      </>
      )}

      <NewLeadDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ImportLeadsDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign {selected.size} lead{selected.size !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>Select a team member to assign the selected leads to.</AlertDialogDescription>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} lead{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will soft-delete the selected leads.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={bulkDelete.isPending} onClick={(e) => { e.preventDefault(); bulkDelete.mutate(); }}>
              {bulkDelete.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change status for {selected.size} lead{selected.size !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>Select a new status to apply to all selected leads.</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-full border-border"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {Object.entries(leadStatusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", config.color.split(" ")[0])} />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkStatus("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!bulkStatus || bulkStatusChange.isPending} onClick={(e) => { e.preventDefault(); bulkStatusChange.mutate(); }}>
              {bulkStatusChange.isPending ? "Updating..." : "Update Status"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeadsPage;
