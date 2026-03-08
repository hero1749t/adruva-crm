import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, PackagePlus, ChevronRight } from "lucide-react";

interface Props {
  clientId: string;
  clientName: string;
  assignedManager: string | null;
}

export function ApplyServiceTemplateDialog({ clientId, clientName, assignedManager }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["service-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_templates")
        .select("id, name, category, description")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: steps = [], isLoading: loadingSteps } = useQuery({
    queryKey: ["template-steps-preview", selectedTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_template_steps")
        .select("*")
        .eq("template_id", selectedTemplateId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTemplateId,
  });

  const applyTemplate = useMutation({
    mutationFn: async () => {
      if (!steps.length) throw new Error("No steps in this template");

      const now = new Date();
      const tasks = steps.map((step) => ({
        client_id: clientId,
        task_title: step.title,
        priority: (step.priority || "medium") as "urgent" | "high" | "medium" | "low",
        deadline: new Date(now.getTime() + (step.deadline_offset_days || 7) * 86400000).toISOString(),
        assigned_to: assignedManager || profile?.id || null,
        status: "pending" as const,
        notes: step.description || null,
      }));

      const { error } = await supabase.from("tasks").insert(tasks);
      if (error) throw error;

      const templateName = templates.find((t) => t.id === selectedTemplateId)?.name;
      await logActivity({
        entity: "client",
        entityId: clientId,
        action: "template_applied",
        metadata: { template: templateName, tasksCreated: tasks.length },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-tasks", clientId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      const templateName = templates.find((t) => t.id === selectedTemplateId)?.name;
      toast({ title: `"${templateName}" applied`, description: `${steps.length} tasks created for ${clientName}` });
      setOpen(false);
      setSelectedTemplateId("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to apply template", description: err.message, variant: "destructive" });
    },
  });

  const priorityColors: Record<string, string> = {
    urgent: "text-destructive",
    high: "text-warning",
    medium: "text-primary",
    low: "text-muted-foreground",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedTemplateId(""); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <PackagePlus className="h-3.5 w-3.5" /> Apply Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Apply Service Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Select Template
            </p>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No service templates found. Create one in Settings → Service Templates.
              </p>
            ) : (
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="border-border bg-muted/30 text-sm">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground capitalize">({t.category})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedTemplateId && (
            <div>
              <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Tasks to Create ({steps.length})
              </p>
              {loadingSteps ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading steps...
                </div>
              ) : steps.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  This template has no steps. Add steps in Settings.
                </p>
              ) : (
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2"
                    >
                      <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">{step.title}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className={`font-mono text-[9px] font-medium uppercase ${priorityColors[step.priority || "medium"]}`}>
                            {step.priority || "medium"}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            +{step.deadline_offset_days || 7}d deadline
                          </span>
                        </div>
                        {step.description && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{step.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full gap-1.5"
            onClick={() => applyTemplate.mutate()}
            disabled={!selectedTemplateId || steps.length === 0 || applyTemplate.isPending}
          >
            {applyTemplate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="h-4 w-4" />
            )}
            {applyTemplate.isPending ? "Creating Tasks..." : `Apply & Create ${steps.length} Tasks`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
