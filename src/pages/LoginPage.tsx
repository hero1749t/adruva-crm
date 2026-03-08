import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Mock login — replace with Supabase auth later
    setTimeout(() => {
      if (email && password) {
        navigate("/dashboard");
      } else {
        setError("Please enter valid credentials");
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Glow effect */}
      <div className="pointer-events-none fixed -top-48 right-0 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />

      <div className="w-full max-w-md animate-fade-in px-4">
        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-display text-xl font-bold text-primary-foreground">
              A
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              ADRUVA <span className="text-primary">CRM</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@adruva.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-border bg-muted/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-border bg-muted/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>

            <button type="button" className="w-full text-center text-sm text-primary hover:underline">
              Forgot password?
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
