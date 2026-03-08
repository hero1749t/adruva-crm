import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

const phoneRegex = /^[+]?[\d\s\-()]{7,15}$/;

const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Max 100 characters"),
  email: z.string().trim().email("Invalid email").max(255, "Max 255 characters"),
  phone: z.string().trim().min(1, "Phone is required").regex(phoneRegex, "Invalid phone number"),
  company_name: z.string().trim().max(100, "Max 100 characters").optional().or(z.literal("")),
  source: z.string().optional().or(z.literal("")),
  service_interest: z.string().trim().max(200, "Max 200 characters").optional().or(z.literal("")),
  assigned_to: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Max 1000 characters").optional().or(z.literal("")),
});

type LeadFormValues = z.infer<typeof leadSchema>;

const sourceOptions = [
  "google", "meta", "referral", "website", "cold_call", "event", "other",
];

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
      source: "", service_interest: "", assigned_to: "", notes: "",
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
      const { error } = await supabase.from("leads").insert({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        company_name: values.company_name?.trim() || null,
        source: values.source || null,
        service_interest: values.service_interest?.trim() || null,
        assigned_to: values.assigned_to || null,
        notes: values.notes?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead created successfully" });
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
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full overflow-y-auto border-border bg-card sm:max-w-lg">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-xl font-bold text-foreground">
              New Lead
            </SheetTitle>
          </div>
        </SheetHeader>

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

          {/* Source */}
          <div className="space-y-1.5">
            <FieldLabel label="Source" />
            <Select value={watch("source") || ""} onValueChange={(v) => setValue("source", v)}>
              <SelectTrigger className="border-border bg-muted/30">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Interest */}
          <div className="space-y-1.5">
            <FieldLabel label="Service Interest" />
            <Input
              {...register("service_interest")}
              placeholder="e.g. SEO, Google Ads, Web Design"
              className="border-border bg-muted/30"
              maxLength={200}
            />
          </div>

          {/* Assign To */}
          <div className="space-y-1.5">
            <FieldLabel label="Assign To" />
            <Select value={watch("assigned_to") || ""} onValueChange={(v) => setValue("assigned_to", v)}>
              <SelectTrigger className="border-border bg-muted/30">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
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
      </SheetContent>
    </Sheet>
  );
};

export default NewLeadDrawer;
