import { useState } from "react";
import { logActivity } from "@/hooks/useActivityLog";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyLeadAssigned, notifyClientCreated } from "@/lib/email-notifications";
import { notifyLeadAssignmentInApp, notifyLeadWonInApp } from "@/lib/in-app-notifications";
import { sendStatusEmail } from "@/lib/send-status-email";
import { CommunicationLog } from "@/components/CommunicationLog";
import { CustomFieldsSection } from "@/components/CustomFieldsSection";
import {
  ArrowLeft, Phone, Mail, Building2, Globe, StickyNote,
  Check, X, Pencil, MessageSquare, Calendar, FileText, Send, Loader2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new_lead: { label: "New Lead", color: "bg-muted text-muted-foreground" },
  audit_booked: { label: "Audit Booked", color: "bg-primary/20 text-primary" },
  audit_done: { label: "Audit Done", color: "bg-accent/20 text-accent" },
  in_progress: { label: "In Progress", color: "bg-warning/20 text-warning" },
  lead_won: { label: "Lead Won", color: "bg-success/20 text-success" },
  lead_lost: { label: "Lead Lost", color: "bg-destructive/20 text-destructive" },
};

const activityTypeIcons: Record<string, typeof MessageSquare> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  document: FileText,
};

function invalidateLeadRelatedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["lead"] });
  queryClient.invalidateQueries({ queryKey: ["leads"] });
  queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
  queryClient.invalidateQueries({ queryKey: ["clients"] });
  queryClient.invalidateQueries({ queryKey: ["tasks"] });
  queryClient.invalidateQueries({ queryKey: ["leads-dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["clients-dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["tasks-dashboard"] });
}

const LeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";
  const isOwner = profile?.role === "owner";
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Inline edit state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Activity form state
  const [activityType, setActivityType] = useState("note");
  const [activityContent, setActivityContent] = useState("");

  // Fetch lead
  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, profiles!leads_assigned_to_fkey(id, name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch team members for assign dropdown - only show team/task_manager (not owner/admin)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-assignable"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("status", "active")
        .in("role", ["team", "task_manager"])
        .order("name");
      return data || [];
    },
  });

  // Fetch activities
  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_activities")
        .select("*, profiles!lead_activities_created_by_fkey(name)")
        .eq("lead_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  // Update lead mutation
  const updateLead = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase.from("leads").update(updates).eq("id", id!);
      if (error) throw error;
      return updates;
    },
    onSuccess: (_data, updates) => {
      if (updates.status) {
        const oldStatus = lead?.status || "new_lead";
        logActivity({ entity: "lead", entityId: id!, action: "status_changed", metadata: { name: lead?.name, to: updates.status } });
        sendStatusEmail({ entity: "lead", entityName: lead?.name || "", oldStatus, newStatus: updates.status as string, assignedTo: lead?.assigned_to });
        // If lead_won, notify about client creation
        if (updates.status === "lead_won") {
          const managerName = teamMembers.find((m) => m.id === lead?.assigned_to)?.name;
          notifyLeadWonInApp({
            leadName: lead?.name || "",
            assignedManagerId: lead?.assigned_to,
            assignedManagerName: managerName,
          });
          notifyClientCreated({
            clientName: lead?.name || "",
            companyName: lead?.company_name,
            assignedManager: managerName,
          });
        }
      } else if (updates.assigned_to && updates.assigned_to !== lead?.assigned_to) {
        const member = teamMembers.find((m) => m.id === updates.assigned_to);
        logActivity({ entity: "lead", entityId: id!, action: "assigned", metadata: { name: lead?.name, to: member?.name } });
        notifyLeadAssignmentInApp({
          leadName: lead?.name || "",
          assignedToId: updates.assigned_to as string,
          assignedToName: member?.name,
        });
        notifyLeadAssigned({
          leadName: lead?.name || "",
          assignedToId: updates.assigned_to as string,
          assignedToName: member?.name,
        });
      } else {
        logActivity({ entity: "lead", entityId: id!, action: "updated", metadata: { name: lead?.name } });
      }
      invalidateLeadRelatedQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Lead updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // Add activity mutation
  const addActivity = useMutation({
    mutationFn: async () => {
      const trimmed = activityContent.trim();
      if (!trimmed) return;
      const { error } = await supabase.from("lead_activities").insert({
        lead_id: id!,
        type: activityType,
        content: trimmed,
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activities", id] });
      setActivityContent("");
      toast({ title: "Activity added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add activity", description: err.message, variant: "destructive" });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({ is_deleted: true }).eq("id", id!);
      if (error) throw error;
      logActivity({ entity: "lead", entityId: id!, action: "deleted", metadata: { name: lead?.name } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead deleted" });
      navigate("/leads");
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  };

  const saveEdit = () => {
    if (editingField) {
      updateLead.mutate({ [editingField]: editValue || null });
      setEditingField(null);
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) {
    // Log blocked access attempt when lead is not found (likely due to RLS)
    if (id && profile?.id) {
      logActivity({
        entity: "security",
        entityId: id,
        action: "access_denied",
        metadata: {
          resource: "lead",
          reason: "lead_not_found_or_unauthorized",
          userRole: profile.role,
        },
      });
    }
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/leads")} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </Button>
        <p className="text-center text-muted-foreground">Lead not found</p>
      </div>
    );
  }

  const assignedProfile = (lead as any).profiles;
  const statusConf = statusConfig[lead.status];

  const InfoRow = ({
    icon: Icon,
    label,
    field,
    value,
    editable = true,
  }: {
    icon: typeof Phone;
    label: string;
    field: string;
    value: string | null;
    editable?: boolean;
  }) => (
    <div className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
        {editingField === field ? (
          <div className="mt-1 flex items-center gap-1.5">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 border-border bg-muted/30 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={saveEdit}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-foreground">{value || "—"}</p>
            {editable && isOwnerOrAdmin && (
              <button
                onClick={() => startEdit(field, value || "")}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/leads")} className="gap-2 text-muted-foreground self-start">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl truncate">{lead.name}</h1>
          {lead.company_name && (
            <p className="text-sm text-muted-foreground truncate">{lead.company_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 self-start">
          <span className={`rounded-full px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider whitespace-nowrap ${statusConf.color}`}>
            {statusConf.label}
          </span>
          {isOwner && (
            <Button variant="outline" size="sm" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left Panel — Lead Info */}
        <div className="space-y-4 lg:col-span-2">
          {/* Status & Assignment Card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Status & Assignment
            </h2>
            <div className="space-y-3">
              <div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Status
                </p>
                <Select
                  value={lead.status}
                  onValueChange={(v) => updateLead.mutate({ status: v })}
                  disabled={!isOwnerOrAdmin}
                >
                  <SelectTrigger className="h-9 border-border bg-muted/30 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, conf]) => (
                      <SelectItem key={key} value={key}>{conf.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Assigned To
                </p>
                <Select
                  value={lead.assigned_to || "unassigned"}
                  onValueChange={(v) => updateLead.mutate({ assigned_to: v === "unassigned" ? null : v })}
                  disabled={!isOwnerOrAdmin}
                >
                  <SelectTrigger className="h-9 border-border bg-muted/30 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Info Card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Contact Information
            </h2>
            <div className="space-y-0.5">
              <InfoRow icon={Phone} label="Phone" field="phone" value={lead.phone} />
              <InfoRow icon={Mail} label="Email" field="email" value={lead.email} />
              <InfoRow icon={Building2} label="Company" field="company_name" value={lead.company_name} />
              <InfoRow icon={Globe} label="Source" field="source" value={lead.source} />
              <InfoRow icon={Globe} label="Service Interest" field="service_interest" value={Array.isArray(lead.service_interest) ? lead.service_interest.join(", ") : lead.service_interest} />
            </div>
          </div>

          {/* Notes Card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Notes
            </h2>
            {editingField === "notes" ? (
              <div className="space-y-2">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="min-h-[80px] border-border bg-muted/30 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} className="gap-1">
                    <Check className="h-3.5 w-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div
                className="group cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/30"
                onClick={() => isOwnerOrAdmin && startEdit("notes", lead.notes || "")}
              >
                {lead.notes || <span className="text-muted-foreground">No notes yet. Click to add.</span>}
                {isOwnerOrAdmin && (
                  <Pencil className="ml-2 inline h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </div>
            )}
          </div>

          {/* Custom Fields */}
          <CustomFieldsSection entityType="lead" entityId={id!} />
        </div>

        {/* Right Panel — Activity Timeline */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
              Activity Timeline
            </h2>

            {/* Add Activity Form */}
            <div className="mb-6 rounded-lg border border-border bg-muted/20 p-3">
              <div className="mb-2 flex gap-2">
                {Object.entries(activityTypeIcons).map(([type, Icon]) => (
                  <button
                    key={type}
                    onClick={() => setActivityType(type)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors ${
                      activityType === type
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {type}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder={`Add a ${activityType}...`}
                  value={activityContent}
                  onChange={(e) => setActivityContent(e.target.value)}
                  className="min-h-[60px] flex-1 border-border bg-background text-sm"
                  maxLength={1000}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {activityContent.length}/1000
                </span>
                <Button
                  size="sm"
                  onClick={() => addActivity.mutate()}
                  disabled={!activityContent.trim() || addActivity.isPending}
                  className="gap-1.5"
                >
                  {addActivity.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Add
                </Button>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-0">
              {activities.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No activity yet. Add a note above to get started.
                </p>
              ) : (
                activities.map((activity, idx) => {
                  const Icon = activityTypeIcons[activity.type] || StickyNote;
                  const authorName = (activity as any).profiles?.name || "System";
                  const isLast = idx === activities.length - 1;
                  return (
                    <div key={activity.id} className="relative flex gap-3 pb-4">
                      {/* Timeline connector */}
                      {!isLast && (
                        <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                      )}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-foreground">{authorName}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            {activity.type}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {activity.created_at
                              ? new Date(activity.created_at).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-foreground/80">{activity.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Communication Log */}
          <CommunicationLog entityType="lead" entityId={id!} />
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead "{lead?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will soft-delete this lead. It can be recovered later if needed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteLead.isPending} onClick={(e) => { e.preventDefault(); deleteLead.mutate(); }}>
              {deleteLead.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeadDetailPage;
