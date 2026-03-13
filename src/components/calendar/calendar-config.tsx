import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export const priorityConfig: Record<string, { dot: string; label: string }> = {
  urgent: { dot: "bg-destructive", label: "Urgent" },
  high: { dot: "bg-warning", label: "High" },
  medium: { dot: "bg-primary", label: "Medium" },
  low: { dot: "bg-muted-foreground", label: "Low" },
};

export const statusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-3 w-3 text-success shrink-0" />,
  overdue: <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />,
  in_progress: <Clock className="h-3 w-3 text-warning shrink-0" />,
  pending: <Clock className="h-3 w-3 text-muted-foreground shrink-0" />,
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalendarTask {
  id: string;
  business_name?: string | null;
  task_title: string;
  deadline: string;
  priority: string | null;
  service_template_name?: string | null;
  status: string | null;
  client_id: string;
  assigned_to: string | null;
  clients?: { client_name: string; company_name?: string | null } | null;
  profiles?: { name: string } | null;
}
