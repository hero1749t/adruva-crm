import { Target, UserCheck, ClipboardList } from "lucide-react";

interface MyWorkCardProps {
  leadsCount: number;
  clientsCount: number;
  pendingTasksCount: number;
  onLeadsClick?: () => void;
  onClientsClick?: () => void;
  onTasksClick?: () => void;
}

export function MyWorkCard({
  leadsCount,
  clientsCount,
  pendingTasksCount,
  onLeadsClick,
  onClientsClick,
  onTasksClick,
}: MyWorkCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl glass glow-sm p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold text-foreground">My Work</h3>
        <p className="text-xs text-muted-foreground">Quick overview of your assignments</p>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div
          onClick={onLeadsClick}
          className="group cursor-pointer rounded-xl glass-subtle p-4 transition-all hover:border-primary/40 hover:glow-sm"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 transition-all group-hover:bg-primary/25 group-hover:scale-110">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">{leadsCount}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Assigned Leads
          </p>
        </div>

        <div
          onClick={onClientsClick}
          className="group cursor-pointer rounded-xl glass-subtle p-4 transition-all hover:border-success/40"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 transition-all group-hover:bg-success/25 group-hover:scale-110">
            <UserCheck className="h-5 w-5 text-success" />
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">{clientsCount}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active Clients
          </p>
        </div>

        <div
          onClick={onTasksClick}
          className="group cursor-pointer rounded-xl glass-subtle p-4 transition-all hover:border-warning/40"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 transition-all group-hover:bg-warning/25 group-hover:scale-110">
            <ClipboardList className="h-5 w-5 text-warning" />
          </div>
          <p className="font-mono text-2xl font-bold text-foreground">{pendingTasksCount}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pending Tasks
          </p>
        </div>
      </div>
    </div>
  );
}
