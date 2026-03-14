import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Filter, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
import { runPaymentAutomationSweep } from "@/lib/payment-automation";
import { calculateNextInvoicePaymentDate } from "@/lib/invoice-schedule";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

const statusConfig: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-primary/20 text-primary" },
  paid: { label: "Paid", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  due: { label: "Due", color: "bg-warning/20 text-warning" },
  paid: { label: "Paid", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
};

const INVOICE_PREFIX = "ADR";

const getFinancialYearCode = (date = new Date()) => {
  const currentYear = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  return `${String(startYear % 100).padStart(2, "0")}${String(endYear % 100).padStart(2, "0")}`;
};

const getNextInvoiceNumber = (invoices: any[]) => {
  const financialYearCode = getFinancialYearCode();
  const pattern = new RegExp(`^${INVOICE_PREFIX}-${financialYearCode}-(\\d{5})$`);
  const maxSequence = invoices.reduce((max, invoice) => {
    const invoiceNumber = typeof invoice?.invoice_number === "string" ? invoice.invoice_number : "";
    const match = invoiceNumber.match(pattern);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `${INVOICE_PREFIX}-${financialYearCode}-${String(maxSequence + 1).padStart(5, "0")}`;
};

function InvoiceDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10 w-full justify-start border-border bg-background text-left font-normal">
            {selectedDate ? format(selectedDate, "dd-MM-yyyy") : `Select ${label.toLowerCase()}`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] w-auto border-border bg-card p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

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
  const [formNextPaymentDate, setFormNextPaymentDate] = useState("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formInstallmentType, setFormInstallmentType] = useState("monthly");
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    runPaymentAutomationSweep().catch(() => undefined);
  }, []);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, clients!invoices_client_id_fkey(client_name, company_name, plan, services)")
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
        .select("id, client_name, company_name, monthly_payment, plan, services")
        .in("status", ["new", "active", "paused"])
        .order("client_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: invoiceNumberSeed = [] } = useQuery({
    queryKey: ["invoice-number-seed"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("invoice_number");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: templateAssignments = [] } = useQuery({
    queryKey: ["invoice-client-template-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_service_template_assignments")
        .select("client_id, service_templates!client_service_template_assignments_service_template_id_fkey(name)");
      if (error) throw error;
      return data || [];
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(formAmount) || 0;
      const tax = parseFloat(formTax) || 0;
      const { error } = await supabase.from("invoices").insert({
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
        next_payment_date: formInstallmentType === "twice_a_month"
          ? (formNextPaymentDate || calculateNextInvoicePaymentDate({
              installmentType: formInstallmentType,
              dueDate: formDueDate,
              referenceDate: formDueDate,
            }))
          : formDueDate,
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
    onMutate: ({ id }) => {
      setBusyInvoiceId(id);
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
    onSettled: () => {
      setBusyInvoiceId(null);
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => {
      setDeletingInvoiceId(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      setDeletingInvoiceId(null);
    },
  });

  const resetForm = () => {
    setFormClientId("");
    setFormAmount("");
    setFormTax("");
    setFormDueDate("");
    setFormNextPaymentDate("");
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
  const selectedClient = clients.find((client) => client.id === formClientId);
  const selectedClientTemplateNames = templateAssignments
    .filter((assignment: any) => assignment.client_id === formClientId)
    .map((assignment: any) => assignment.service_templates?.name)
    .filter(Boolean);

  const renderTags = (values: string[] | null | undefined, emptyLabel: string) => {
    if (!values?.length) {
      return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
    }

    return (
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-foreground"
          >
            {String(value).replaceAll("_", " ")}
          </span>
        ))}
      </div>
    );
  };
  const nextInvoiceNumber = getNextInvoiceNumber(invoiceNumberSeed);

  const getNextDueFromInvoice = (invoice: any, referenceDate?: string | null) =>
    calculateNextInvoicePaymentDate({
      installmentType: invoice.installment_type || "monthly",
      dueDate: invoice.due_date || null,
      referenceDate: referenceDate ?? invoice.last_payment_date ?? invoice.due_date ?? null,
    });

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
            <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Auto Invoice Number</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-foreground">{nextInvoiceNumber}</p>
                </div>
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
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Client Services</p>
                    {!selectedClient && <span className="text-[11px] text-muted-foreground">Select a client to load services</span>}
                  </div>
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-[11px] font-medium text-foreground">Subscribed Services</p>
                      <div className="mt-1">
                        {selectedClient
                          ? renderTags(selectedClient.services, "No client services added yet")
                          : <span className="text-xs text-muted-foreground">No client selected</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-foreground">Applied Templates</p>
                      <div className="mt-1">
                        {selectedClient
                          ? renderTags(selectedClientTemplateNames, "No service templates assigned yet")
                          : <span className="text-xs text-muted-foreground">No client selected</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-foreground">Plan</p>
                      <div className="mt-1">
                        {selectedClient?.plan ? (
                          <span className="text-xs text-foreground">{String(selectedClient.plan).replaceAll("_", " ")}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{selectedClient ? "No plan added yet" : "No client selected"}</span>
                        )}
                      </div>
                    </div>
                  </div>
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
                  <InvoiceDateField
                    label="Due Date"
                    value={formDueDate}
                    onChange={(value) => {
                      setFormDueDate(value);
                      if (formInstallmentType === "twice_a_month") {
                        setFormNextPaymentDate(
                          calculateNextInvoicePaymentDate({
                            installmentType: formInstallmentType,
                            dueDate: value,
                            referenceDate: value,
                          }) || ""
                        );
                      }
                    }}
                  />
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Installment</label>
                    <Select
                      value={formInstallmentType}
                      onValueChange={(value) => {
                        setFormInstallmentType(value);
                        if (value === "twice_a_month") {
                          setFormNextPaymentDate((current) =>
                            current || calculateNextInvoicePaymentDate({
                              installmentType: value,
                              dueDate: formDueDate,
                              referenceDate: formDueDate,
                            }) || ""
                          );
                        } else {
                          setFormNextPaymentDate("");
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="twice_a_month">Twice a month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formInstallmentType === "twice_a_month" && (
                  <InvoiceDateField
                    label="Next Due Date"
                    value={formNextPaymentDate}
                    onChange={setFormNextPaymentDate}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <InvoiceDateField label="Period Start" value={formPeriodStart} onChange={setFormPeriodStart} />
                  <InvoiceDateField label="Period End" value={formPeriodEnd} onChange={setFormPeriodEnd} />
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
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Services</th>
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
                  const paymentStyle = paymentStatusConfig[paymentStatus] || paymentStatusConfig.due;
                  const invoiceTemplateNames = templateAssignments
                    .filter((assignment: any) => assignment.client_id === invoice.client_id)
                    .map((assignment: any) => assignment.service_templates?.name)
                    .filter(Boolean);
                  const rowBusy = busyInvoiceId === invoice.id || deletingInvoiceId === invoice.id;
                  return (
                    <tr key={invoice.id} className="border-b border-border last:border-0 align-top hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-medium text-foreground">{invoice.invoice_number}</p>
                        <div className="mt-1">
                          <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusStyle.color}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Invoice ID</p>
                        <p className="text-xs text-muted-foreground">{invoice.id}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{invoice.notes || "No notes"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{invoice.clients?.client_name || "Unknown"}</p>
                        {invoice.clients?.company_name && <p className="text-xs text-muted-foreground">{invoice.clients.company_name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Client Services</p>
                            <div className="mt-1">{renderTags(invoice.clients?.services, "No services")}</div>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Templates</p>
                            <div className="mt-1">{renderTags(invoiceTemplateNames, "No templates")}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground">₹{Number(invoice.total_amount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        {(invoice.installment_type || "monthly") === "twice_a_month" && isOwnerOrAdmin ? (
                          <Select
                            value={paymentStatus}
                            disabled={rowBusy}
                            onValueChange={(value) => {
                              const paidOn = new Date().toISOString().slice(0, 10);
                              updateInvoice.mutate({
                                id: invoice.id,
                                updates: {
                                  payment_status: value,
                                  status: value === "paid" ? "paid" : value === "overdue" ? "overdue" : invoice.status === "draft" ? "draft" : "sent",
                                  last_payment_date: value === "paid" ? paidOn : value === "due" ? null : invoice.last_payment_date,
                                  next_payment_date: value === "paid"
                                    ? getNextDueFromInvoice(invoice, paidOn)
                                    : value === "due"
                                      ? invoice.next_payment_date || invoice.due_date || null
                                      : invoice.next_payment_date,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className={`h-8 w-[110px] border-0 text-xs ${paymentStyle.color}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="due">Due</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${paymentStyle.color}`}>
                            {paymentStyle.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Input
                            type="date"
                            className="h-8 w-[145px]"
                            disabled={rowBusy}
                            defaultValue={invoice.due_date?.slice(0, 10) || ""}
                            onBlur={(e) => {
                              if (e.target.value && e.target.value !== invoice.due_date?.slice(0, 10)) {
                                const shouldSyncNextDue =
                                  !invoice.last_payment_date ||
                                  !invoice.next_payment_date ||
                                  invoice.next_payment_date === invoice.due_date?.slice(0, 10);
                                updateInvoice.mutate({
                                  id: invoice.id,
                                  updates: {
                                    due_date: e.target.value,
                                    next_payment_date: shouldSyncNextDue
                                      ? e.target.value
                                      : invoice.next_payment_date || e.target.value,
                                  },
                                });
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
                            disabled={rowBusy}
                            defaultValue={invoice.next_payment_date || invoice.due_date?.slice(0, 10) || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (invoice.next_payment_date || invoice.due_date?.slice(0, 10) || "")) {
                                updateInvoice.mutate({ id: invoice.id, updates: { next_payment_date: e.target.value || null } });
                              }
                            }}
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {(invoice.installment_type || "monthly") === "twice_a_month"
                              ? (invoice.next_payment_date || "—")
                              : "Auto monthly"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOwnerOrAdmin ? (
                          <Select
                            value={invoice.installment_type || "monthly"}
                            disabled={rowBusy}
                            onValueChange={(value) => updateInvoice.mutate({
                              id: invoice.id,
                              updates: {
                                installment_type: value,
                                next_payment_date: calculateNextInvoicePaymentDate({
                                  installmentType: value,
                                  dueDate: invoice.due_date || null,
                                  referenceDate: invoice.last_payment_date || invoice.due_date || null,
                                }),
                              },
                            })}
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
                            disabled={rowBusy}
                            defaultValue={invoice.last_payment_date || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (invoice.last_payment_date || "")) {
                                updateInvoice.mutate({
                                  id: invoice.id,
                                  updates: {
                                    last_payment_date: e.target.value || null,
                                    next_payment_date: e.target.value
                                      ? getNextDueFromInvoice(invoice, e.target.value)
                                      : invoice.due_date || null,
                                  },
                                });
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
                              disabled={rowBusy}
                              onClick={() => updateInvoice.mutate({ id: invoice.id, updates: { status: "sent" } })}
                            >
                              {busyInvoiceId === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                            </Button>
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                disabled={rowBusy}
                                onClick={() => {
                                  if (!window.confirm(`Delete invoice ${invoice.invoice_number || "draft invoice"}?`)) {
                                    return;
                                  }
                                  logActivity({ entity: "invoice", entityId: invoice.id, action: "deleted", metadata: { invoice: invoice.invoice_number } });
                                  deleteInvoice.mutate(invoice.id);
                                }}
                              >
                                {deletingInvoiceId === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
