import { useState } from "react";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, user } = useAuth();

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) setError(signInError);
    else navigate("/dashboard");
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) setError(error.message);
    else setResetSent(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Mesh gradient background */}
      <div className="pointer-events-none absolute inset-0 mesh-gradient" />
      <div className="pointer-events-none absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/[0.05] blur-[120px]" />

      {/* Floating orbs */}
      <div className="pointer-events-none absolute top-1/4 left-1/4 h-2 w-2 rounded-full bg-primary/40 animate-glow-pulse" />
      <div className="pointer-events-none absolute top-1/3 right-1/3 h-1.5 w-1.5 rounded-full bg-accent/40 animate-glow-pulse" style={{ animationDelay: "1s" }} />
      <div className="pointer-events-none absolute bottom-1/3 right-1/4 h-1 w-1 rounded-full bg-success/40 animate-glow-pulse" style={{ animationDelay: "2s" }} />

      <div className="w-full max-w-md animate-slide-up px-4">
        <div className="glass-strong rounded-2xl p-8 glow">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary font-display text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25">
              A
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {BRAND.shortName} <span className="gradient-text">Solution</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {forgotMode ? "Reset your password" : BRAND.tagline}
            </p>
            {!forgotMode && <p className="mt-2 text-xs text-muted-foreground/80">{BRAND.promise}</p>}
          </div>

          {forgotMode ? (
            resetSent ? (
              <div className="space-y-4 text-center animate-fade-in">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
                  <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  Reset link sent to <strong className="text-foreground">{email}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setResetSent(false); setError(""); }}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@adruvasolution.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 border-glass-border bg-secondary/50 focus:border-primary/50 transition-colors"
                  />
                  {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full h-11 gradient-primary border-0 text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" disabled={resetLoading}>
                  {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send Reset Link
                </Button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(""); }}
                  className="inline-flex w-full items-center justify-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to login
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@adruvasolution.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-glass-border bg-secondary/50 focus:border-primary/50 transition-colors"
                />
              </div>

              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 border-glass-border bg-secondary/50 pr-10 focus:border-primary/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
              </div>

              <Button type="submit" className="w-full h-11 gradient-primary border-0 text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign In
              </Button>

              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(""); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot password?
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/50">
          {BRAND.fullName} - Secure Authentication
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
