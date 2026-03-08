import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Check, ClipboardCheck, Loader2, Plus, Trash2, GripVertical, Pencil, X,
} from "lucide-react";

interface OnboardingChecklistItem {
  id: string;
  client_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

interface OnboardingChecklistProps {
  clientId: string;
  clientName: string;
}

export const OnboardingChecklist = ({ clientId, clientName }: OnboardingChecklistProps) => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["onboarding-checklist", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_checklist_items")
        .select("*")
        .eq("client_id", clientId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as OnboardingChecklistItem[];
    },
  });

  const toggleItem = useMutation({
    mutationFn: async ({ itemId, completed }: { itemId: string; completed: boolean }) => {
      const updates: Record<string, unknown> = {
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? profile?.id : null,
      };
      const { error } = await supabase
        .from("onboarding_checklist_items")
        .update(updates)
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-checklist", clientId] });
    },
  });

  const completedCount = items.filter((i) => i.is_completed).length;
  const totalCount = items.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex h-20 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return null; // Don't show section if no checklist items
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-primary">
            Onboarding Checklist
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-medium",
            percentage === 100
              ? "bg-success/20 text-success"
              : percentage >= 50
                ? "bg-warning/20 text-warning"
                : "bg-muted text-muted-foreground"
          )}>
            {percentage}%
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            percentage === 100 ? "bg-success" : percentage >= 50 ? "bg-warning" : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/30",
              item.is_completed && "opacity-60"
            )}
          >
            <Checkbox
              checked={item.is_completed}
              onCheckedChange={(checked) =>
                toggleItem.mutate({ itemId: item.id, completed: !!checked })
              }
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className={cn(
                "text-sm font-medium",
                item.is_completed ? "text-muted-foreground line-through" : "text-foreground"
              )}>
                {item.title}
              </p>
              {item.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</p>
              )}
              {item.is_completed && item.completed_at && (
                <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                  Completed {new Date(item.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
            {item.is_completed && (
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20">
                <Check className="h-3 w-3 text-success" />
              </div>
            )}
          </div>
        ))}
      </div>

      {percentage === 100 && (
        <div className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-center">
          <p className="text-xs font-medium text-success">
            ✅ Onboarding complete for {clientName}!
          </p>
        </div>
      )}
    </div>
  );
};

// Onboarding Templates Manager for Settings page
interface OnboardingTemplate {
  id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
}

export const OnboardingTemplatesSection = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["onboarding-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_templates")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as OnboardingTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const maxOrder = templates.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);
      const { error } = await supabase.from("onboarding_templates").insert({
        title: newTitle,
        description: newDescription || null,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] });
      setNewTitle("");
      setNewDescription("");
      setShowForm(false);
      toast({ title: "Onboarding step added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add step", description: err.message, variant: "destructive" });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("onboarding_templates").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] });
      setEditingId(null);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-templates"] });
      toast({ title: "Onboarding step removed" });
    },
  });

  const startEdit = (t: OnboardingTemplate) => {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDescription(t.description || "");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Onboarding Checklist
          </h2>
          <p className="text-sm text-muted-foreground">
            Steps auto-created for every new client when a lead is won
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="h-4 w-4" /> Add Step
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Step Title</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Collect Brand Assets"
              className="border-border bg-muted/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description (optional)</label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g., Gather logo, fonts, color palette"
              className="border-border bg-muted/30"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createTemplate.mutate()}
              disabled={!newTitle.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border bg-muted/30 px-4 py-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Step</span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Active</span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground w-16">Actions</span>
        </div>

        {templates.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No onboarding steps configured.
          </p>
        ) : (
          templates.map((t) => {
            const isEditing = editingId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "grid grid-cols-[1fr_auto_auto] gap-4 items-center border-b border-border px-4 py-2.5 last:border-b-0",
                  !t.is_active && "opacity-50"
                )}
              >
                {isEditing ? (
                  <>
                    <div className="space-y-1">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8 border-border bg-muted/30 text-sm"
                        autoFocus
                      />
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="h-8 border-border bg-muted/30 text-xs"
                        placeholder="Description"
                      />
                    </div>
                    <div />
                    <div className="flex gap-1 w-16 justify-end">
                      <button
                        onClick={() => updateTemplate.mutate({ id: t.id, updates: { title: editTitle, description: editDescription || null } })}
                        className="rounded p-1 text-success hover:bg-success/10"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                        <span className="text-sm font-medium text-foreground">{t.title}</span>
                      </div>
                      {t.description && (
                        <p className="ml-6 text-[11px] text-muted-foreground">{t.description}</p>
                      )}
                    </div>
                    <Switch
                      checked={!!t.is_active}
                      onCheckedChange={(checked) =>
                        updateTemplate.mutate({ id: t.id, updates: { is_active: checked } })
                      }
                    />
                    <div className="flex gap-1 w-16 justify-end">
                      <button
                        onClick={() => startEdit(t)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTemplate.mutate(t.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How onboarding works</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>When a lead is won and converted to a client, all active onboarding steps are automatically created</li>
          <li>Team members can check off steps as they complete them on the <strong>Client Detail</strong> page</li>
          <li>Completion percentage is tracked and displayed per client</li>
          <li>Changes to templates only affect <strong>future</strong> clients — existing checklists are not modified</li>
        </ul>
      </div>
    </div>
  );
};
