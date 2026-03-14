import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
import { executeAutomationRules } from "@/lib/automation-engine";
import { applyServiceTemplateToClient } from "@/lib/service-template-assignments";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PropertyMultiSelect } from "@/components/PropertyMultiSelect";
import { useEntityPropertyOptions } from "@/lib/property-options";

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewClientDialog = ({ open, onOpenChange }: NewClientDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { sourceOptions, businessTypeOptions, serviceInterestOptions } = useEntityPropertyOptions("client");
  const { data: serviceTemplates = [] } = useQuery({
    queryKey: ["service-templates-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_templates")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });
  const [form, setForm] = useState({
    client_name: "",
    email: "",
    phone: "",
    company_name: "",
    source: "",
    business_type: "",
    plan: "",
    monthly_payment: "",
    services: [] as string[],
    service_templates: [] as string[],
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.client_name.trim() || !form.email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          client_name: form.client_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          company_name: form.company_name.trim() || null,
          source: form.source || null,
          business_type: form.business_type || null,
          plan: form.plan.trim() || null,
          monthly_payment: form.monthly_payment ? Number(form.monthly_payment) : null,
          services: form.services.length > 0 ? form.services : null,
          assigned_manager: user?.id,
          status: "new",
          billing_status: "due",
          start_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (error) throw error;

      for (const templateId of form.service_templates) {
        await applyServiceTemplateToClient({
          clientId: data.id,
          templateId,
          assignedManager: user?.id || null,
          appliedBy: user?.id || null,
          businessName: form.company_name.trim() || form.client_name.trim(),
        });
      }

      logActivity({
        entity: "client",
        entityId: data.id,
        action: "created",
        metadata: { name: form.client_name },
      });
      executeAutomationRules({
        triggerEvent: "client_created",
        entityId: data.id,
        entityData: {
          _entity_type: "client",
          id: data.id,
          name: form.client_name.trim(),
          client_name: form.client_name.trim(),
          email: form.email.trim(),
          assigned_manager: user?.id || null,
          status: "new",
          plan: form.plan.trim() || null,
          source: form.source || null,
          business_type: form.business_type || null,
        },
      });

      toast({
        title: `Client "${form.client_name}" added successfully`,
        description: form.service_templates.length > 0
          ? `${form.service_templates.length} template(s) assigned and tasks created`
          : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      setForm({
        client_name: "",
        email: "",
        phone: "",
        company_name: "",
        source: "",
        business_type: "",
        plan: "",
        monthly_payment: "",
        services: [],
        service_templates: [],
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to add client", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">New Client</DialogTitle>
          <DialogDescription>Add a new client. They will be assigned to you automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client_name">Client Name *</Label>
            <Input id="client_name" value={form.client_name} onChange={(e) => handleChange("client_name", e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="client@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+91 98765..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Input id="plan" value={form.plan} onChange={(e) => handleChange("plan", e.target.value)} placeholder="e.g. Basic, Pro" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company</Label>
              <Input id="company_name" value={form.company_name} onChange={(e) => handleChange("company_name", e.target.value)} placeholder="Company name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_payment">Monthly Payment (₹)</Label>
              <Input id="monthly_payment" type="number" min="0" value={form.monthly_payment} onChange={(e) => handleChange("monthly_payment", e.target.value)} placeholder="e.g. 15000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(value) => handleChange("source", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Select value={form.business_type} onValueChange={(value) => handleChange("business_type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  {businessTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Service Interested</Label>
            <PropertyMultiSelect
              options={serviceInterestOptions}
              value={form.services}
              onChange={(value) => setForm((prev) => ({ ...prev, services: value }))}
              placeholder="Select interested services"
            />
          </div>
          <div className="space-y-2">
            <Label>Service Templates</Label>
            <PropertyMultiSelect
              options={serviceTemplates.map((template) => ({ value: template.id, label: template.name }))}
              value={form.service_templates}
              onChange={(value) => setForm((prev) => ({ ...prev, service_templates: value }))}
              placeholder="Select one or more templates"
            />
            <p className="text-xs text-muted-foreground">
              Selected templates will create client tasks immediately and also show in calendar.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Adding…" : "Add Client"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewClientDialog;
