import { supabase } from "@/integrations/supabase/client";
import { notifyPaymentDueInApp } from "@/lib/in-app-notifications";

let sweepPromise: Promise<void> | null = null;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function runPaymentAutomationSweep() {
  if (sweepPromise) {
    return sweepPromise;
  }

  sweepPromise = (async () => {
    const today = new Date();
    const todayStr = isoDate(today);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = isoDate(threeDaysAgo);

    const { data: dueInvoices, error: dueError } = await supabase
      .from("invoices")
      .select("id, client_id, invoice_number, next_payment_date, payment_status, clients!invoices_client_id_fkey(client_name, company_name, assigned_manager)")
      .not("next_payment_date", "is", null)
      .lte("next_payment_date", todayStr)
      .neq("payment_status", "paid");

    if (dueError) {
      throw dueError;
    }

    const invoices = dueInvoices || [];
    if (invoices.length === 0) {
      return;
    }

    const dueToday = invoices.filter((invoice) => invoice.next_payment_date === todayStr);
    for (const invoice of dueToday) {
      const client = (invoice as any).clients;
      await notifyPaymentDueInApp({
        clientId: invoice.client_id,
        clientName: client?.company_name || client?.client_name || "Client",
        invoiceNumber: invoice.invoice_number,
        assignedManagerId: client?.assigned_manager || null,
      });
    }

    const overdueInvoices = invoices.filter((invoice) => (invoice.next_payment_date || "") < todayStr);
    if (overdueInvoices.length > 0) {
      await supabase
        .from("invoices")
        .update({ payment_status: "overdue", status: "overdue" as any })
        .in("id", overdueInvoices.map((invoice) => invoice.id));

      await supabase
        .from("clients")
        .update({ billing_status: "overdue" as any })
        .in("id", overdueInvoices.map((invoice) => invoice.client_id));
    }

    const dueInvoicesNotOverdue = invoices.filter((invoice) => invoice.next_payment_date === todayStr);
    if (dueInvoicesNotOverdue.length > 0) {
      await supabase
        .from("invoices")
        .update({ payment_status: "due" })
        .in("id", dueInvoicesNotOverdue.map((invoice) => invoice.id));

      await supabase
        .from("clients")
        .update({ billing_status: "due" as any })
        .in("id", dueInvoicesNotOverdue.map((invoice) => invoice.client_id));
    }

    const clientsToPause = overdueInvoices
      .filter((invoice) => (invoice.next_payment_date || "") <= threeDaysAgoStr)
      .map((invoice) => invoice.client_id);

    if (clientsToPause.length > 0) {
      await supabase
        .from("tasks")
        .update({ status: "paused" as any, paused_reason: "payment_overdue" })
        .in("client_id", clientsToPause)
        .in("status", ["pending", "in_progress", "overdue"]);

      await supabase
        .from("clients")
        .update({ status: "paused" as any })
        .in("id", clientsToPause);
    }
  })();

  try {
    await sweepPromise;
  } finally {
    sweepPromise = null;
  }
}
