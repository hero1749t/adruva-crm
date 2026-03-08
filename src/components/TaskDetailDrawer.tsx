import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Building2, FileText, Globe, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-destructive/20 text-destructive" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-400" },
  medium: { label: "Medium", color: "bg-warning/20 text-warning" },
  low: { label: "Low", color: "bg-success/20 text-success" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", color: "bg-primary/20 text-primary" },
  completed: { label: "Completed", color: "bg-success/20 text-success" },
  overdue: { label: "Overdue", color: "bg-destructive/20 text-destructive" },
};

interface TaskDetailDrawerProps {
  task: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/5"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

export default function TaskDetailDrawer({ task, open, onOpenChange }: TaskDetailDrawerProps) {
  if (!task) return null;

  const priority = priorityConfig[task.priority || "medium"];
  const status = statusConfig[task.status || "pending"];
  const clientName = task.clients?.client_name || "—";
  const assignedName = task.profiles?.name || "Unassigned";
  const hasLinks = task.website_link || task.gmb_link || task.meta_link;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-xl">{task.task_title}</SheetTitle>
          <SheetDescription className="sr-only">Task details</SheetDescription>
          <div className="flex items-center gap-2 pt-1">
            <span className={cn("inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider", priority.color)}>
              {priority.label}
            </span>
            <span className={cn("inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider", status.color)}>
              {status.label}
            </span>
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-1">
          <DetailRow icon={Building2} label="Client">
            {clientName}
          </DetailRow>
          <DetailRow icon={User} label="Assigned To">
            {assignedName}
          </DetailRow>
          <DetailRow icon={Calendar} label="Deadline">
            {task.deadline ? new Date(task.deadline).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }) : "—"}
          </DetailRow>
          {task.start_date && (
            <DetailRow icon={Calendar} label="Start Date">
              {new Date(task.start_date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
            </DetailRow>
          )}
          {task.completed_at && (
            <DetailRow icon={Clock} label="Completed At">
              {new Date(task.completed_at).toLocaleString()}
            </DetailRow>
          )}
        </div>

        {task.notes && (
          <>
            <Separator className="my-4" />
            <DetailRow icon={FileText} label="Notes">
              <p className="whitespace-pre-wrap text-muted-foreground">{task.notes}</p>
            </DetailRow>
          </>
        )}

        {hasLinks && (
          <>
            <Separator className="my-4" />
            <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Links</p>
            <div className="flex flex-col gap-2">
              <LinkRow label="Website" url={task.website_link} />
              <LinkRow label="Google Business" url={task.gmb_link} />
              <LinkRow label="Meta Business" url={task.meta_link} />
            </div>
          </>
        )}

        <Separator className="my-4" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Created {task.created_at ? new Date(task.created_at).toLocaleDateString() : "—"}</span>
          <span>Updated {task.updated_at ? new Date(task.updated_at).toLocaleDateString() : "—"}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
