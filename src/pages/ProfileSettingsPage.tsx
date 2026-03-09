import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Lock, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const nameSchema = z.string().trim().min(1, "Name is required").max(100, "Name too long");
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Minimum 8 characters").max(72, "Maximum 72 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ProfileSettingsPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(profile?.name || "");
  const [nameError, setNameError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const updateName = useMutation({
    mutationFn: async () => {
      const parsed = nameSchema.safeParse(name);
      if (!parsed.success) {
        setNameError(parsed.error.errors[0].message);
        throw new Error("Validation failed");
      }
      setNameError("");
      const { error } = await supabase
        .from("profiles")
        .update({ name: parsed.data })
        .eq("id", profile!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Profile updated" });
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") {
        toast({ title: "Failed to update", description: err.message, variant: "destructive" });
      }
    },
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      const parsed = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
        setPwErrors(errs);
        throw new Error("Validation failed");
      }
      setPwErrors({});

      // Verify current password by signing in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (signInErr) {
        setPwErrors({ currentPassword: "Current password is incorrect" });
        throw new Error("Validation failed");
      }

      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") {
        toast({ title: "Failed to change password", description: err.message, variant: "destructive" });
      }
    },
  });

  const roleBadge: Record<string, string> = {
    owner: "bg-destructive/20 text-destructive",
    admin: "bg-primary/20 text-primary",
    task_manager: "bg-warning/20 text-warning",
    team: "bg-success/20 text-success",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Email</label>
            <Input value={user?.email || ""} disabled className="border-border bg-muted/30 opacity-60" />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Role</label>
            <div>
              <span className={`inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${roleBadge[profile?.role || "team"] || ""}`}>
                {profile?.role || "team"}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              className="border-border bg-muted/30"
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => updateName.mutate()}
            disabled={updateName.isPending || name === profile?.name}
          >
            {updateName.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Name
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>Enter your current password to set a new one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Current Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPwErrors((p) => { const n = { ...p }; delete n.currentPassword; return n; }); }}
                className="border-border bg-muted/30 pr-10"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwErrors.currentPassword && <p className="text-xs text-destructive">{pwErrors.currentPassword}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              New Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPwErrors((p) => { const n = { ...p }; delete n.newPassword; return n; }); }}
                placeholder="Min 8 characters"
                className="border-border bg-muted/30 pr-10"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwErrors.newPassword && <p className="text-xs text-destructive">{pwErrors.newPassword}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Confirm New Password <span className="text-destructive">*</span>
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwErrors((p) => { const n = { ...p }; delete n.confirmPassword; return n; }); }}
              className="border-border bg-muted/30"
            />
            {pwErrors.confirmPassword && <p className="text-xs text-destructive">{pwErrors.confirmPassword}</p>}
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => changePassword.mutate()}
            disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
          >
            {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
