import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const roleBadge: Record<string, string> = {
  owner: "bg-destructive/20 text-destructive",
  admin: "bg-primary/20 text-primary",
  team: "bg-success/20 text-success",
};

const statusBadge: Record<string, string> = {
  active: "bg-success/20 text-success",
  inactive: "bg-muted text-muted-foreground",
};

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters").max(72),
  role: z.enum(["admin", "team"]),
});

const TeamPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "team" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  if (profile && profile.role !== "owner") {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      return data || [];
    },
  });

  const createMember = useMutation({
    mutationFn: async () => {
      const parsed = createUserSchema.safeParse(formData);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
        setFormErrors(errs);
        throw new Error("Validation failed");
      }
      setFormErrors({});

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-team-member`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(parsed.data),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create user");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({ title: "Team member created" });
      setFormData({ name: "", email: "", password: "", role: "team" });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") {
        toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
      }
    },
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">{team.length} members</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-foreground">
                Create Team Member
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Full name"
                  className="border-border bg-muted/30"
                />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="user@adruva.com"
                  className="border-border bg-muted/30"
                />
                {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Password <span className="text-destructive">*</span>
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="Min 8 characters"
                  className="border-border bg-muted/30"
                />
                {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Role <span className="text-destructive">*</span>
                </label>
                <Select value={formData.role} onValueChange={(v) => updateField("role", v)}>
                  <SelectTrigger className="border-border bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => createMember.mutate()}
                disabled={createMember.isPending}
              >
                {createMember.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Name</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Role</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Status</th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-primary">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  ))}
                </tr>
              ))
            ) : (
              team.map((member) => (
                <tr key={member.id} className="border-b border-border/50 transition-colors hover:bg-primary/[0.03]">
                  <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${roleBadge[member.role] || ""}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${statusBadge[member.status] || ""}`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{member.created_at ? new Date(member.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamPage;
