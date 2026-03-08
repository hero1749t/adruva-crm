import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Loader2, Check, X, Pencil, ChevronRight,
  LayoutTemplate, Search as SearchIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ServiceTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
  steps?: ServiceTemplateStep[];
}

interface ServiceTemplateStep {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  deadline_offset_days: number | null;
  priority: string | null;
}

const CATEGORIES = [
  { value: "seo", label: "SEO" },
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "content", label: "Content" },
  { value: "general", label: "General" },
];

export function ServiceTemplatesSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("general");

  // New step state
  const [showNewStep, setShowNewStep] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDays, setNewStepDays] = useState(7);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["service-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_templates")
        .select("*, service_template_steps(*)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        steps: (t.service_template_steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      })) as ServiceTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_templates").insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        category: newCategory,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-templates"] });
      toast({ title: "Service template created" });
      setNewName("");
      setNewDesc("");
      setShowNew(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const addStep = useMutation({
    mutationFn: async ({ templateId }: { templateId: string }) => {
      const template = templates.find((t) => t.id === templateId);
      const maxOrder = (template?.steps || []).reduce((m, s) => Math.max(m, s.sort_order), 0);
      const { error } = await supabase.from("service_template_steps").insert({
        template_id: templateId,
        title: newStepTitle.trim(),
        sort_order: maxOrder + 1,
        deadline_offset_days: newStepDays,
        priority: "medium",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-templates"] });
      setNewStepTitle("");
      setNewStepDays(7);
      setShowNewStep(false);
    },
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_template_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-templates"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            Service Templates
          </h2>
          <p className="text-sm text-muted-foreground">
            Reusable project templates for SEO, Google Ads, Website, and more
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Button size="sm" className="gap-2" onClick={() => setShowNew(true)} disabled={showNew}>
            <Plus className="h-4 w-4" /> Add Template
          </Button>
        )}
      </div>

      {/* New template form */}
      {showNew && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., SEO Package"
                className="mt-1 h-9 border-border bg-muted/30"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-muted/30 px-3 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description"
                className="mt-1 h-9 border-border bg-muted/30"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => newName.trim() && createTemplate.mutate()}
              disabled={!newName.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create
            </Button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/10" />
        ))
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
          <LayoutTemplate className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No service templates yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create templates to standardize your service delivery
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => {
            const isExpanded = expandedId === template.id;
            const catLabel = CATEGORIES.find((c) => c.value === template.category)?.label || template.category;

            return (
              <div key={template.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : template.id)}
                >
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{template.name}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                        {catLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {template.steps?.length || 0} steps
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{template.description}</p>
                    )}
                  </div>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTemplate.mutate(template.id); }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Steps */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    {(template.steps || []).map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-3 rounded-lg bg-muted/10 px-3 py-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{step.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {step.deadline_offset_days} day{step.deadline_offset_days !== 1 ? "s" : ""} offset
                          </p>
                        </div>
                        {isOwnerOrAdmin && (
                          <button
                            onClick={() => deleteStep.mutate(step.id)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add step */}
                    {isOwnerOrAdmin && (
                      showNewStep && expandedId === template.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newStepTitle}
                            onChange={(e) => setNewStepTitle(e.target.value)}
                            placeholder="Step title"
                            className="h-8 border-border bg-muted/30 text-sm flex-1"
                            autoFocus
                          />
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={newStepDays}
                            onChange={(e) => setNewStepDays(Number(e.target.value))}
                            className="h-8 w-20 border-border bg-muted/30 text-sm"
                            placeholder="Days"
                          />
                          <button
                            onClick={() => newStepTitle.trim() && addStep.mutate({ templateId: template.id })}
                            className="rounded p-1 text-success hover:bg-success/10"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setShowNewStep(false); setNewStepTitle(""); }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => setShowNewStep(true)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Step
                        </Button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">About service templates</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Define standardized workflows for your agency services</li>
          <li>Each template contains <strong>steps</strong> with deadline offsets</li>
          <li>Templates can be applied to clients to auto-generate project tasks</li>
          <li>Categories: SEO, Google Ads, Meta Ads, Website, Social Media, Content</li>
        </ul>
      </div>
    </div>
  );
}
