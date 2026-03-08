import { useState } from "react";
import {
  CreditCard, IndianRupee, Zap, ExternalLink, Shield, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Gateway {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  features: string[];
  status: "coming_soon" | "available";
  supportsUpi?: boolean;
}

const GATEWAYS: Gateway[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Global payments — cards, wallets, subscriptions & invoicing",
    icon: CreditCard,
    color: "text-purple-500",
    features: ["Credit/Debit Cards", "Subscriptions", "Invoicing", "Global Currencies"],
    status: "available",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    description: "India-first payments — UPI, cards, net banking & more",
    icon: IndianRupee,
    color: "text-blue-600",
    features: ["UPI Payments", "Credit/Debit Cards", "Net Banking", "EMI Options"],
    status: "coming_soon",
    supportsUpi: true,
  },
  {
    id: "upi",
    name: "UPI Direct",
    description: "Accept UPI payments directly via QR code or VPA",
    icon: IndianRupee,
    color: "text-green-600",
    features: ["QR Code Payments", "VPA/UPI ID", "Instant Settlement", "Zero MDR"],
    status: "coming_soon",
    supportsUpi: true,
  },
];

export function PaymentGatewaySettings() {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const [enabledGateways, setEnabledGateways] = useState<Set<string>>(new Set());

  const toggleGateway = (id: string) => {
    setEnabledGateways((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Gateway
          </h2>
          <p className="text-sm text-muted-foreground">Only owners can manage payment gateways</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Payment Gateway
        </h2>
        <p className="text-sm text-muted-foreground">
          Connect payment providers to accept payments from clients — Stripe, Razorpay, UPI
        </p>
      </div>

      <div className="grid gap-3">
        {GATEWAYS.map((gw) => {
          const GwIcon = gw.icon;
          const isEnabled = enabledGateways.has(gw.id);
          const isComingSoon = gw.status === "coming_soon";

          return (
            <div
              key={gw.id}
              className={cn(
                "rounded-xl border border-border bg-card p-4 transition-all",
                isEnabled && !isComingSoon && "border-primary/30 bg-primary/[0.02]",
                isComingSoon && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/30", gw.color)}>
                    <GwIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{gw.name}</p>
                      {isComingSoon && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Coming Soon
                        </Badge>
                      )}
                      {gw.supportsUpi && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600">
                          UPI ✓
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{gw.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {gw.features.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isComingSoon ? (
                    <Button variant="outline" size="sm" disabled className="text-xs">
                      Notify Me
                    </Button>
                  ) : (
                    <>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleGateway(gw.id)}
                      />
                      {isEnabled && (
                        <Button variant="outline" size="sm" className="text-xs gap-1.5">
                          <ExternalLink className="h-3 w-3" />
                          Configure
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          About payment gateways
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>All payment data is handled securely by the provider — no card data stored on our servers</li>
          <li><strong>Stripe</strong> — Best for international clients, supports subscriptions & recurring billing</li>
          <li><strong>Razorpay</strong> — Best for Indian clients with UPI, net banking & EMI support</li>
          <li><strong>UPI Direct</strong> — Zero-cost UPI payments via QR code or VPA ID</li>
          <li>Payment status auto-syncs with your invoices</li>
        </ul>
      </div>
    </div>
  );
}
