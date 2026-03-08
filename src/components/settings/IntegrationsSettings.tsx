import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Eye, EyeOff, Loader2, Check, X, Power, PowerOff,
  Globe, MessageSquare, BarChart3, CreditCard, Search, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { value: "whatsapp", label: "WhatsApp Business", icon: MessageSquare, color: "text-green-500" },
  { value: "google_ads", label: "Google Ads", icon: BarChart3, color: "text-blue-500" },
  { value: "meta_ads", label: "Meta Ads", icon: Globe, color: "text-indigo-500" },
  { value: "google_analytics", label: "Google Analytics", icon: BarChart3, color: "text-orange-500" },
  { value: "search_console", label: "Search Console", icon: Search, color: "text-green-600" },
  { value: "stripe", label: "Stripe", icon: CreditCard, color: "text-purple-500" },
  { value: "razorpay", label: "Razorpay", icon: CreditCard, color: "text-blue-600" },
  { value: "zapier", label: "Zapier", icon: Zap, color: "text-orange-500" },
  { value: "custom", label: "Custom API", icon: Globe, color: "text-muted-foreground" },
];

interface Integration {
  id: string;
  name: string;
  provider: string;
  api_key_encrypted: string;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export function IntegrationsSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = profile?.role === "owner";

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProvider, setNewProvider] = useState("whatsapp");
  const [newApiKey, setNewApiKey] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Integration[];
    },
  });

  const createIntegration = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("integrations").insert({
        name: newName.trim(),
        provider: newProvider,
        api_key_encrypted: newApiKey.trim(),
        is_active: true,
        config: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({ title: "Integration added" });
      setNewName("");
      setNewApiKey("");
      setShowNew(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("integrations").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({ title: "Integration removed" });
    },
  });

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => {
    if (!key) return "—";
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  const getProviderInfo = (provider: string) =>
    PROVIDERS.find((p) => p.value === provider) || PROVIDERS[PROVIDERS.length - 1];

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Integrations
          </h2>
          <p className="text-sm text-muted-foreground">Only owners can manage API integrations</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {integrations.length} integration{integrations.length !== 1 ? "s" : ""} configured
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Integrations
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect external APIs — WhatsApp, Google Ads, Meta, Stripe, and more
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowNew(true)} disabled={showNew}>
          <Plus className="h-4 w-4" /> Add Integration
        </Button>
      </div>

      {/* New integration form */}
      {showNew && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Display Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., My WhatsApp Business"
                className="mt-1 h-9 border-border bg-muted/30"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <Select value={newProvider} onValueChange={setNewProvider}>
                <SelectTrigger className="mt-1 h-9 border-border bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <p.icon className={cn("h-3.5 w-3.5", p.color)} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">API Key / Token</label>
              <Input
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Paste your API key here"
                className="mt-1 h-9 border-border bg-muted/30 font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setNewName(""); setNewApiKey(""); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => newName.trim() && newApiKey.trim() && createIntegration.mutate()}
              disabled={!newName.trim() || !newApiKey.trim() || createIntegration.isPending}
            >
              {createIntegration.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save Integration
            </Button>
          </div>
        </div>
      )}

      {/* Integrations list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/10" />
          ))
        ) : integrations.length === 0 && !showNew ? (
          <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No integrations configured yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add your first API key to connect external services
            </p>
          </div>
        ) : (
          integrations.map((integration) => {
            const prov = getProviderInfo(integration.provider);
            const ProvIcon = prov.icon;
            const isVisible = visibleKeys.has(integration.id);

            return (
              <div
                key={integration.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:shadow-sm",
                  !integration.is_active && "opacity-50"
                )}
              >
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/30", prov.color)}>
                  <ProvIcon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{integration.name}</p>
                    <span className="rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {prov.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="font-mono text-[11px] text-muted-foreground">
                      {isVisible ? integration.api_key_encrypted : maskKey(integration.api_key_encrypted)}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(integration.id)}
                      className="text-muted-foreground/50 hover:text-muted-foreground"
                    >
                      {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={integration.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: integration.id, is_active: checked })}
                  />
                  <button
                    onClick={() => deleteIntegration.mutate(integration.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">About integrations</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>API keys are stored securely and only visible to owners</li>
          <li>Toggle integrations on/off without removing them</li>
          <li>Supported: WhatsApp Business, Google Ads, Meta Ads, Google Analytics, Search Console, Stripe, Razorpay</li>
          <li>Use <strong>Custom API</strong> for any other service</li>
        </ul>
      </div>
    </div>
  );
}
