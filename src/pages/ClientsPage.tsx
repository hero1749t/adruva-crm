import { mockClients, clientStatusConfig, currentUser } from "@/lib/mock-data";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const ClientsPage = () => {
  const [search, setSearch] = useState("");
  const isOwnerOrAdmin = currentUser.role === "owner" || currentUser.role === "admin";

  const filtered = mockClients.filter(
    (c) =>
      !search ||
      c.client_name.toLowerCase().includes(search.toLowerCase()) ||
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} clients</p>
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
            {filtered.map((client) => {
              const statusConf = clientStatusConfig[client.status];
              return (
                <tr key={client.id} className="border-b border-border/50 transition-colors hover:bg-primary/[0.03] cursor-pointer">
                  <td className="px-4 py-3 font-medium text-foreground">{client.client_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.company_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary">
                      {client.plan?.replace("_", " ") || "—"}
                    </span>
                  </td>
                  {isOwnerOrAdmin && (
                    <td className="px-4 py-3 text-muted-foreground">₹{client.monthly_payment?.toLocaleString() || "—"}</td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusConf.color}`}>
                      {statusConf.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{client.assigned_manager_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.start_date ? new Date(client.start_date).toLocaleDateString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientsPage;
