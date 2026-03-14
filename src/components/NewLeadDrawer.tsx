import { useState } from "react";
import { logActivity } from "@/hooks/useActivityLog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyLeadAssigned } from "@/lib/email-notifications";
import { notifyLeadAssignmentInApp } from "@/lib/in-app-notifications";
import { executeAutomationRules } from "@/lib/automation-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const phoneRegex = /^[+]?[\d\s\-()]{7,15}$/;

const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
  email: z.string().trim().email("Invalid email").max(255, "Max 255 characters"),
  phone: z.string().trim().min(1, "Phone is required").regex(phoneRegex, "Invalid phone number"),
  company_name: z.string().trim().max(100, "Max 100 characters").optional().or(z.literal("")),
  assigned_to: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Max 1000 characters").optional().or(z.literal("")),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface NewLeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewLeadDrawer = ({ open, onOpenChange }: NewLeadDrawerProps) => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
  });

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "", email: "", phone: "", company_name: "",
      assigned_to: "", notes: "",
    },
  });

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = form;
  const watchedNotes = watch("notes") || "";
  const watchedName = watch("name") || "";

  const checkEmailUnique = async (email: string) => {
    if (!email || !z.string().email().safeParse(email).success) return;
    setEmailChecking(true);
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("email", email.trim())
      .eq("is_deleted", false)
      .limit(1);
    setEmailExists((data?.length ?? 0) > 0);
    setEmailChecking(false);
  };

  const createLead = useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const { data, error } = await supabase.from("leads").insert({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        company_name: values.company_name?.trim() || null,
        assigned_to: values.assigned_to || null,
        notes: values.notes?.trim() || null,
      } as any).select("id").single();
      if (error) throw error;
      return { id: data.id, name: values.name.trim() };
    },
    onSuccess: (result) => {
      logActivity({ entity: "lead", entityId: result.id, action: "created", metadata: { name: result.name } });
      executeAutomationRules({
        triggerEvent: "lead_created",
        entityId: result.id,
        entityData: {
          _entity_type: "lead",
          id: result.id,
          name: result.name,
          assigned_to: form.getValues("assigned_to") || null,
          status: "new_lead",
          email: form.getValues("email"),
        },
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead created successfully" });
      // Notify assigned member
      const assignedId = form.getValues("assigned_to");
      if (assignedId) {
        const member = teamMembers.find((m) => m.id === assignedId);
        notifyLeadAssignmentInApp({
          leadName: result.name,
          assignedToId: assignedId,
          assignedToName: member?.name,
        });
        notifyLeadAssigned({
          leadName: result.name,
          assignedToId: assignedId,
          assignedToName: member?.name,
        });
      }
      reset();
      setEmailExists(false);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create lead", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: LeadFormValues) => {
    if (emailExists) return;
    createLead.mutate(values);
  };

  const handleClose = () => {
    reset();
    setEmailExists(false);
    onOpenChange(false);
  };

  const FieldLabel = ({ label, required, counter, max }: { label: string; required?: boolean; counter?: string; max?: number }) => (
    <div className="flex items-center justify-between">
      <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {max !== undefined && counter !== undefined && (
        <span className={`font-mono text-[10px] ${counter.length > max * 0.9 ? "text-warning" : "text-muted-foreground"}`}>
          {counter.length}/{max}
        </span>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-xl font-bold text-foreground">
            New Lead
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add a new lead to your pipeline
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <FieldLabel label="Name" required counter={watchedName} max={100} />
            <Input
              {...register("name")}
              placeholder="Full name"
              className="border-border bg-muted/30"
              maxLength={100}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <FieldLabel label="Email" required />
            <Input
              {...register("email")}
              type="email"
              placeholder="lead@company.com"
              className="border-border bg-muted/30"
              maxLength={255}
              onBlur={(e) => checkEmailUnique(e.target.value)}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            {emailChecking && <p className="text-xs text-muted-foreground">Checking…</p>}
            {emailExists && <p className="text-xs text-destructive">A lead with this email already exists</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <FieldLabel label="Phone" required />
            <Input
              {...register("phone")}
              placeholder="+91 98765 43210"
              className="border-border bg-muted/30"
              maxLength={15}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <FieldLabel label="Company" />
            <Input
              {...register("company_name")}
              placeholder="Company name"
              className="border-border bg-muted/30"
              maxLength={100}
            />
            {errors.company_name && <p className="text-xs text-destructive">{errors.company_name.message}</p>}
          </div>

          {/* Assign To */}
          <div className="space-y-1.5">
            <FieldLabel label="Assign To" />
            <Select value={watch("assigned_to") || "unassigned"} onValueChange={(v) => setValue("assigned_to", v === "unassigned" ? "" : v)}>
              <SelectTrigger className="border-border bg-muted/30">
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

          {/* Notes */}
          <div className="space-y-1.5">
            <FieldLabel label="Notes" counter={watchedNotes} max={1000} />
            <Textarea
              {...register("notes")}
              placeholder="Initial notes about this lead…"
              className="min-h-[80px] border-border bg-muted/30"
              maxLength={1000}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 gap-2" disabled={createLead.isPending || emailExists}>
              {createLead.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Lead
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewLeadDrawer;
