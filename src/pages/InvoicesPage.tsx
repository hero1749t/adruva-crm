import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Filter, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
import { runPaymentAutomationSweep } from "@/lib/payment-automation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

const statusConfig: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-primary/20 text-primary" },
  paid: { label: "Paid", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};

const InvoicesPage = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const isOwnerOrAdmin = can("invoices", "create");
  const isOwner = profile?.role === "owner";

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [formClientId, setFormClientId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formTax, setFormTax] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formInstallmentType, setFormInstallmentType] = useState("monthly");

  useEffect(() => {
    runPaymentAutomationSweep().catch(() => undefined);
  }, []);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, clients!invoices_client_id_fkey(client_name, company_name)")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.or(`status.eq.${statusFilter},payment_status.eq.${statusFilter}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, client_name, company_name, monthly_payment")
        .in("status", ["new", "active", "paused"])
        .order("client_name");
      if (error) throw error;
      return data || [];
    },
  });

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
        installment_type: formInstallmentType,
        notes: formNotes || null,
        created_by: profile?.id,
        status: "draft" as InvoiceStatus,
        payment_status: "due",
        next_payment_date: formDueDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      resetForm();
      setCreateOpen(false);
      toast({ title: "Invoice created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-dashboard"] });
      toast({ title: "Invoice updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
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
    setFormInstallmentType("monthly");
  };

  const handleClientSelect = (clientId: string) => {
    setFormClientId(clientId);
    const client = clients.find((item) => item.id === clientId);
    if (client?.monthly_payment) {
      setFormAmount(String(client.monthly_payment));
    }
  };

  const filteredInvoices = invoices.filter((invoice: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const clientName = invoice.clients?.client_name?.toLowerCase() || "";
    const companyName = invoice.clients?.company_name?.toLowerCase() || "";
    const invoiceNumber = invoice.invoice_number?.toLowerCase() || "";
    return clientName.includes(q) || companyName.includes(q) || invoiceNumber.includes(q);
  });

  const totalOutstanding = filteredInvoices
    .filter((invoice: any) => invoice.payment_status === "due" || invoice.payment_status === "overdue")
    .reduce((sum: number, invoice: any) => sum + (invoice.total_amount || 0), 0);
  const totalPaid = filteredInvoices
    .filter((invoice: any) => invoice.payment_status === "paid" || invoice.status === "paid")
    .reduce((sum: number, invoice: any) => sum + (invoice.total_amount || 0), 0);
  const overdueCount = filteredInvoices.filter((invoice: any) => invoice.payment_status === "overdue" || invoice.status === "overdue").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage billing, installments, due dates and payment follow-up</p>
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
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_name}{client.company_name ? ` (${client.company_name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Amount</label>
                    <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Tax</label>
                    <Input type="number" value={formTax} onChange={(e) => setFormTax(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Due Date</label>
                    <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Installment</label>
                    <Select value={formInstallmentType} onValueChange={setFormInstallmentType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="twice_a_month">Twice a month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Period Start</label>
                    <Input type="date" value={formPeriodStart} onChange={(e) => setFormPeriodStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Period End</label>
                    <Input type="date" value={formPeriodEnd} onChange={(e) => setFormPeriodEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Notes</label>
                  <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={!formClientId || !formAmount || !formDueDate || createInvoice.isPending}
                    onClick={() => createInvoice.mutate()}
                  >
                    {createInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Invoice"}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Collected</p>
          <p className="mt-1 font-display text-2xl font-bold text-success">₹{totalPaid.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Outstanding</p>
          <p className="mt-1 font-display text-2xl font-bold text-warning">₹{totalOutstanding.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Overdue</p>
          <p className="mt-1 font-display text-2xl font-bold text-destructive">{overdueCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" placeholder="Search by invoice number or client" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="due">Due</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No invoices found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Invoice</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Payment</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Due Date</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Next Due</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Installment</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last Paid</th>
                  {isOwnerOrAdmin && <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice: any) => {
                  const paymentStatus = invoice.payment_status || (invoice.status === "paid" ? "paid" : invoice.status === "overdue" ? "overdue" : "due");
                  const statusStyle = statusConfig[(invoice.status as InvoiceStatus) || "draft"] || statusConfig.draft;
                  return (
                    <tr key={invoice.id} className="border-b border-border last:border-0 align-top hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-medium text-foreground">{invoice.invoice_number}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{invoice.notes || "No notes"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{invoice.clients?.client_name || "Unknown"}</p>
                        {invoice.clients?.company_name && <p className="text-xs text-muted-foreground">{invoice.clients.company_name}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground">₹{Number(invoice.total_amount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Select
                            value={paymentStatus}
                            onValueChange={(value) => updateInvoice.mutate({
                              id: invoice.id,
                              updates: {
                                payment_status: value,
                                status: value === "paid" ? "paid" : value === "overdue" ? "overdue" : invoice.status,
                                last_payment_date: value === "paid" ? new Date().toISOString().slice(0, 10) : invoice.last_payment_date,
                              },
                            })}
                          >
                            <SelectTrigger className={`h-8 w-[110px] border-0 text-xs ${statusStyle.color}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="due">Due</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${statusStyle.color}`}>
                            {paymentStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Input
                            type="date"
                            className="h-8 w-[145px]"
                            defaultValue={invoice.due_date?.slice(0, 10) || ""}
                            onBlur={(e) => {
                              if (e.target.value && e.target.value !== invoice.due_date?.slice(0, 10)) {
                                updateInvoice.mutate({ id: invoice.id, updates: { due_date: e.target.value } });
                              }
                            }}
                          />
                        ) : (
                          <span className="text-muted-foreground">{invoice.due_date || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Input
                            type="date"
                            className="h-8 w-[145px]"
                            defaultValue={invoice.next_payment_date || invoice.due_date?.slice(0, 10) || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (invoice.next_payment_date || invoice.due_date?.slice(0, 10) || "")) {
                                updateInvoice.mutate({ id: invoice.id, updates: { next_payment_date: e.target.value || null } });
                              }
                            }}
                          />
                        ) : (
                          <span className="text-muted-foreground">{invoice.next_payment_date || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Select
                            value={invoice.installment_type || "monthly"}
                            onValueChange={(value) => updateInvoice.mutate({ id: invoice.id, updates: { installment_type: value } })}
                          >
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="twice_a_month">Twice a month</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="capitalize text-muted-foreground">{String(invoice.installment_type || "monthly").replaceAll("_", " ")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Input
                            type="date"
                            className="h-8 w-[145px]"
                            defaultValue={invoice.last_payment_date || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (invoice.last_payment_date || "")) {
                                updateInvoice.mutate({ id: invoice.id, updates: { last_payment_date: e.target.value || null } });
                              }
                            }}
                          />
                        ) : (
                          <span className="text-muted-foreground">{invoice.last_payment_date || "—"}</span>
                        )}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateInvoice.mutate({ id: invoice.id, updates: { status: "sent" } })}
                            >
                              Send
                            </Button>
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  logActivity({ entity: "invoice", entityId: invoice.id, action: "deleted", metadata: { invoice: invoice.invoice_number } });
                                  deleteInvoice.mutate(invoice.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
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
