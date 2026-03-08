import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
import {
  FileText, Plus, IndianRupee, Calendar, Search,
  Loader2, Check, Send, X, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

const statusConfig: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-primary/20 text-primary" },
  paid: { label: "Paid", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground line-through" },
};

const InvoicesPage = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // New invoice form
  const [formClientId, setFormClientId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formTax, setFormTax] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, clients!invoices_client_id_fkey(client_name, company_name)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "draft" | "sent" | "paid" | "overdue" | "cancelled");
      }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, client_name, company_name, monthly_payment")
        .eq("status", "active")
        .order("client_name");
      return data || [];
    },
  });

  // Create invoice
  const createInvoice = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(formAmount) || 0;
      const tax = parseFloat(formTax) || 0;
      const { error } = await supabase.from("invoices").insert({
        invoice_number: "",
        client_id: formClientId,
        amount,
        tax_amount: tax,
        total_amount: amount + tax,
        due_date: formDueDate,
        billing_period_start: formPeriodStart || null,
        billing_period_end: formPeriodEnd || null,
        notes: formNotes || null,
        created_by: profile?.id,
        status: "draft" as InvoiceStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setCreateOpen(false);
      resetForm();
      toast({ title: "Invoice created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    },
  });

  // Update invoice status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "paid") updates.paid_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: (data) => {
      logActivity({ entity: "invoice", entityId: data.id, action: "status_changed", metadata: { to: data.status } });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: `Invoice marked as ${data.status}` });
    },
  });

  const resetForm = () => {
    setFormClientId("");
    setFormAmount("");
    setFormTax("");
    setFormDueDate("");
    setFormPeriodStart("");
    setFormPeriodEnd("");
    setFormNotes("");
  };

  const handleClientSelect = (clientId: string) => {
    setFormClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (client?.monthly_payment) {
      setFormAmount(client.monthly_payment.toString());
    }
  };

  // Summary stats
  const totalOutstanding = invoices
    .filter((i: any) => i.status === "sent" || i.status === "overdue")
    .reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0);
  const totalPaid = invoices
    .filter((i: any) => i.status === "paid")
    .reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0);
  const overdueCount = invoices.filter((i: any) => i.status === "overdue").length;

  const filtered = search
    ? invoices.filter((i: any) => {
        const clientName = i.clients?.client_name?.toLowerCase() || "";
        const companyName = i.clients?.company_name?.toLowerCase() || "";
        const invNum = i.invoice_number?.toLowerCase() || "";
        const q = search.toLowerCase();
        return clientName.includes(q) || companyName.includes(q) || invNum.includes(q);
      })
    : invoices;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage billing and track payments</p>
        </div>
        {isOwnerOrAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Client</label>
                  <Select value={formClientId} onValueChange={handleClientSelect}>
                    <SelectTrigger className="border-border bg-muted/30"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.client_name} {c.company_name && `(${c.company_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Amount (₹)</label>
                    <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="border-border bg-muted/30" />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Tax (₹)</label>
                    <Input type="number" value={formTax} onChange={(e) => setFormTax(e.target.value)} className="border-border bg-muted/30" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Total: ₹{((parseFloat(formAmount) || 0) + (parseFloat(formTax) || 0)).toLocaleString("en-IN")}
                  </label>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Due Date</label>
                  <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="border-border bg-muted/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Period Start</label>
                    <Input type="date" value={formPeriodStart} onChange={(e) => setFormPeriodStart(e.target.value)} className="border-border bg-muted/30" />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Period End</label>
                    <Input type="date" value={formPeriodEnd} onChange={(e) => setFormPeriodEnd(e.target.value)} className="border-border bg-muted/30" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Notes</label>
                  <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="min-h-[60px] border-border bg-muted/30" placeholder="Optional notes..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => createInvoice.mutate()}
                    disabled={!formClientId || !formAmount || !formDueDate || createInvoice.isPending}
                    className="flex-1 gap-2"
                  >
                    {createInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Create Invoice
                  </Button>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Total Collected</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">₹{totalPaid.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Outstanding</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">₹{totalOutstanding.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Overdue</p>
          <p className="mt-1 font-display text-2xl font-bold text-destructive">{overdueCount} invoices</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by client or invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-border bg-muted/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] border-border bg-muted/30">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusConfig).map(([key, conf]) => (
              <SelectItem key={key} value={key}>{conf.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Invoice Table */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No invoices found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Invoice #</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Due Date</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Period</th>
                  {isOwnerOrAdmin && (
                    <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv: any) => {
                  const sConf = statusConfig[inv.status as InvoiceStatus] || statusConfig.draft;
                  const clientName = inv.clients?.client_name || "Unknown";
                  const isOverdueDate = inv.due_date && new Date(inv.due_date) < new Date() && inv.status === "sent";
                  return (
                    <tr key={inv.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">{inv.invoice_number}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{clientName}</p>
                        {inv.clients?.company_name && (
                          <p className="text-xs text-muted-foreground">{inv.clients.company_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-medium text-foreground">
                        ₹{(inv.total_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Select
                            value={inv.status}
                            onValueChange={(v) => updateStatus.mutate({ id: inv.id, status: v as InvoiceStatus })}
                          >
                            <SelectTrigger className={`h-7 w-[110px] border-0 text-xs font-medium ${sConf.color}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([key, conf]) => (
                                <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${sConf.color}`}>
                            {sConf.label}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isOverdueDate ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {inv.due_date
                          ? new Date(inv.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {inv.billing_period_start && inv.billing_period_end
                          ? `${new Date(inv.billing_period_start).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(inv.billing_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                          : "—"}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === "draft" && (
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-primary"
                                onClick={() => updateStatus.mutate({ id: inv.id, status: "sent" })}
                                title="Mark as Sent"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(inv.status === "sent" || inv.status === "overdue") && (
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-success"
                                onClick={() => updateStatus.mutate({ id: inv.id, status: "paid" })}
                                title="Mark as Paid"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {inv.status !== "cancelled" && inv.status !== "paid" && (
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => updateStatus.mutate({ id: inv.id, status: "cancelled" })}
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
