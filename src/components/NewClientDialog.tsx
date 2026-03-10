import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/hooks/useActivityLog";
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

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewClientDialog = ({ open, onOpenChange }: NewClientDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    email: "",
    phone: "",
    company_name: "",
    plan: "",
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
          plan: form.plan.trim() || null,
          assigned_manager: user?.id,
          status: "active",
          billing_status: "due",
          start_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (error) throw error;

      logActivity({
        entity: "client",
        entityId: data.id,
        action: "created",
        metadata: { name: form.client_name },
      });

      toast({ title: `Client "${form.client_name}" added successfully` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setForm({ client_name: "", email: "", phone: "", company_name: "", plan: "" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to add client", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+91 9876543210" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company</Label>
            <Input id="company_name" value={form.company_name} onChange={(e) => handleChange("company_name", e.target.value)} placeholder="Company name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Input id="plan" value={form.plan} onChange={(e) => handleChange("plan", e.target.value)} placeholder="e.g. Basic, Pro" />
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
