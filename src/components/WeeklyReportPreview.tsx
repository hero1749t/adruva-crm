import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export const WeeklyReportPreviewButton = () => {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";
  if (!isOwnerOrAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-3.5 w-3.5" />
          Preview Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="font-display">Weekly Report Email Preview</DialogTitle>
        </DialogHeader>
        <PreviewContent profileName={profile?.name || "Team Member"} profileId={profile?.id || ""} />
      </DialogContent>
    </Dialog>
  );
};

const PreviewContent = ({ profileName, profileId }: { profileName: string; profileId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["weekly-report-preview"],
    queryFn: async () => {
      const [
        { data: invoices },
        { data: tasks },
        { data: clients },
        { data: leads },
      ] = await Promise.all([
        supabase.from("invoices").select("id, status, total_amount, client_id"),
        supabase.from("tasks").select("id, status, assigned_to, client_id"),
        supabase.from("clients").select("id, client_name, status, monthly_payment, assigned_manager"),
        supabase.from("leads").select("id, status, source, assigned_to").eq("is_deleted", false),
      ]);
      return { invoices: invoices || [], tasks: tasks || [], clients: clients || [], leads: leads || [] };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading preview data…
      </div>
    );
  }

  const { invoices, tasks, clients, leads } = data!;

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + (i.total_amount || 0), 0);
  const collectionRate = pct(paidInvoices.length, invoices.length);
  const activeClients = clients.filter((c) => c.status === "active").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const overdueTasks = tasks.filter((t) => t.status === "overdue").length;
  const totalTasks = tasks.length;
  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === "lead_won").length;
  const newLeads = leads.filter((l) => l.status === "new_lead").length;

  const mrr = clients
    .filter((c) => c.status === "active" && c.monthly_payment)
    .reduce((s, c) => s + (c.monthly_payment || 0), 0);

  const sourceCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const src = l.source || "Unknown";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  const clientRevMap: Record<string, { name: string; rev: number }> = {};
  paidInvoices.forEach((inv) => {
    const cl = clients.find((c) => c.id === inv.client_id);
    const name = cl?.client_name || "Unknown";
    if (!clientRevMap[inv.client_id]) clientRevMap[inv.client_id] = { name, rev: 0 };
    clientRevMap[inv.client_id].rev += inv.total_amount || 0;
  });
  const topClients = Object.values(clientRevMap).sort((a, b) => b.rev - a.rev).slice(0, 5);

  const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="p-4">
      <div className="rounded-xl overflow-hidden border border-border" style={{ background: "#0b1120" }}>
        <div className="p-4" style={{ maxWidth: 620, margin: "0 auto" }}>

          {/* Header */}
          <div className="rounded-t-2xl p-8" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "1px solid #1e3a5f", borderBottom: "none" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[2px]" style={{ color: "#60a5fa" }}>Adruvaa CRM</p>
                <h2 className="text-2xl font-bold mt-1" style={{ color: "#f1f5f9", letterSpacing: "-0.3px" }}>Weekly Report</h2>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "#60a5fa20", border: "1px solid #60a5fa30" }}>
                <span className="font-mono text-xs" style={{ color: "#93c5fd" }}>{dateStr}</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8" style={{ background: "#0f172a", border: "1px solid #1e3a5f", borderTop: "none", borderBottom: "none" }}>
            <p className="text-[15px] mb-7" style={{ color: "#94a3b8" }}>
              Hi <strong style={{ color: "#f1f5f9" }}>{profileName}</strong>, here's your performance snapshot for the week.
            </p>

            {/* Primary KPIs */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <KpiCard value={fmtINR(totalRevenue)} label="Revenue" bg="linear-gradient(135deg,#064e3b,#065f46)" valueColor="#34d399" labelColor="#6ee7b7" />
              <KpiCard value={`${collectionRate}%`} label="Collection" bg="linear-gradient(135deg,#1e3a5f,rgba(30,64,175,0.13))" valueColor="#60a5fa" labelColor="#93c5fd" />
              <KpiCard value={fmtINR(outstanding)} label="Outstanding" bg="linear-gradient(135deg,rgba(120,53,15,0.25),rgba(146,64,14,0.19))" valueColor="#fbbf24" labelColor="#fcd34d" />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-4 gap-2 mb-8">
              <KpiCardSmall value={String(activeClients)} label="Clients" valueColor="#22d3ee" labelColor="#67e8f9" />
              <KpiCardSmall value={fmtINR(mrr)} label="MRR" valueColor="#34d399" labelColor="#6ee7b7" />
              <KpiCardSmall value={`${completedTasks}/${totalTasks}`} label="Tasks Done" valueColor="#a78bfa" labelColor="#c4b5fd" />
              <KpiCardSmall value={String(overdueTasks)} label="Overdue" valueColor={overdueTasks > 0 ? "#f87171" : "#4ade80"} labelColor={overdueTasks > 0 ? "#fca5a5" : "#86efac"} />
            </div>

            {/* Lead Pipeline */}
            <SectionHeader>Lead Pipeline</SectionHeader>
            <div className="mb-7">
              <MetricRow label="Total Leads" value={String(totalLeads)} color="#f1f5f9" />
              <MetricRow label="New Leads" value={String(newLeads)} color="#60a5fa" border />
              <MetricRow label="Won" value={String(wonLeads)} color="#34d399" border />
              <MetricRow label="Conversion Rate" value={`${pct(wonLeads, totalLeads)}%`} color="#a78bfa" border />
            </div>

            {/* Lead Sources */}
            {Object.keys(sourceCounts).length > 0 && (
              <>
                <SectionHeader>Lead Sources</SectionHeader>
                <div className="mb-7">
                  <div className="grid grid-cols-2 px-4 pb-2" style={{ borderBottom: "1px solid #1e3a5f" }}>
                    <span className="font-mono text-[9px] uppercase tracking-[1.5px]" style={{ color: "#475569" }}>Source</span>
                    <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-right" style={{ color: "#475569" }}>Count</span>
                  </div>
                  {Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                    <div key={src} className="grid grid-cols-2 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                      <span className="text-[13px]" style={{ color: "#cbd5e1" }}>{src}</span>
                      <span className="text-[13px] font-semibold text-right" style={{ color: "#f1f5f9" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Top Clients */}
            {topClients.length > 0 && (
              <>
                <SectionHeader>Top Clients by Revenue</SectionHeader>
                <div className="mb-7">
                  <div className="grid grid-cols-2 px-4 pb-2" style={{ borderBottom: "1px solid #1e3a5f" }}>
                    <span className="font-mono text-[9px] uppercase tracking-[1.5px]" style={{ color: "#475569" }}>Client</span>
                    <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-right" style={{ color: "#475569" }}>Revenue</span>
                  </div>
                  {topClients.map((c) => (
                    <div key={c.name} className="grid grid-cols-2 px-4 py-2.5" style={{ borderBottom: "1px solid #1e293b" }}>
                      <span className="text-[13px]" style={{ color: "#cbd5e1" }}>{c.name}</span>
                      <span className="text-[13px] font-bold text-right" style={{ color: "#34d399" }}>{fmtINR(c.rev)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="rounded-b-2xl px-8 py-5 text-center" style={{ background: "#0b1120", border: "1px solid #1e3a5f", borderTop: "none" }}>
            <p className="font-mono text-[11px] tracking-wide" style={{ color: "#334155" }}>Adruvaa Digital Agency — Automated Weekly Report</p>
          </div>

        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-3">This is a live preview using your current data. The actual email will look identical.</p>
    </div>
  );
};

const KpiCard = ({ value, label, bg, valueColor, labelColor }: { value: string; label: string; bg: string; valueColor: string; labelColor: string }) => (
  <div className="rounded-xl p-5 text-center" style={{ background: bg }}>
    <div className="font-mono text-2xl font-bold leading-none" style={{ color: valueColor }}>{value}</div>
    <div className="text-[10px] uppercase tracking-[1.5px] mt-2 font-medium" style={{ color: labelColor }}>{label}</div>
  </div>
);

const KpiCardSmall = ({ value, label, valueColor, labelColor }: { value: string; label: string; valueColor: string; labelColor: string }) => (
  <div className="rounded-[10px] p-4 text-center" style={{ background: "#1e293b" }}>
    <div className="font-mono text-xl font-bold" style={{ color: valueColor }}>{value}</div>
    <div className="text-[9px] uppercase tracking-[1px] mt-1.5" style={{ color: labelColor }}>{label}</div>
  </div>
);

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="font-mono text-[10px] font-medium uppercase tracking-[2px] mb-3.5 pb-2.5" style={{ color: "#60a5fa", borderBottom: "1px solid #1e3a5f" }}>
    {children}
  </div>
);

const MetricRow = ({ label, value, color, border }: { label: string; value: string; color: string; border?: boolean }) => (
  <div className="flex items-center justify-between py-2.5" style={border ? { borderTop: "1px solid #1e293b" } : {}}>
    <span className="text-sm" style={{ color: "#94a3b8" }}>{label}</span>
    <span className="font-mono text-sm font-semibold" style={{ color }}>{value}</span>
  </div>
);
