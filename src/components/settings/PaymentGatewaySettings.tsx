import { useState } from "react";
import {
  CreditCard, IndianRupee, Shield, CheckCircle2, QrCode, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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
    status: "available",
    supportsUpi: true,
  },
];

export function PaymentGatewaySettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isOwner = profile?.role === "owner";
  const [enabledGateways, setEnabledGateways] = useState<Set<string>>(new Set());
  const [upiId, setUpiId] = useState("");
  const [savedUpiId, setSavedUpiId] = useState("");
  const [upiDialogOpen, setUpiDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleGateway = (id: string) => {
    if (id === "upi" && !enabledGateways.has(id)) {
      setUpiDialogOpen(true);
      return;
    }
    setEnabledGateways((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveUpi = () => {
    if (!upiId.trim() || !upiId.includes("@")) {
      toast({ title: "Invalid UPI ID", description: "Enter a valid UPI ID like yourname@upi", variant: "destructive" });
      return;
    }
    setSavedUpiId(upiId.trim());
    setEnabledGateways((prev) => new Set([...prev, "upi"]));
    setUpiDialogOpen(false);
    toast({ title: "UPI Enabled", description: `Payments can now be received at ${upiId.trim()}` });
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText(savedUpiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateQrUrl = (vpa: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodeURIComponent(vpa)}&pn=ADRUVA%20CRM`;
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
          const isUpi = gw.id === "upi";

          return (
            <div
              key={gw.id}
              className={cn(
                "rounded-xl border border-border bg-card p-4 transition-all",
                isEnabled && "border-primary/30 bg-primary/[0.02]",
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
                      {isUpi && isEnabled && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-success/20 text-success border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{gw.description}</p>
                    
                    {/* Show saved UPI ID when enabled */}
                    {isUpi && isEnabled && savedUpiId && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                        <span className="font-mono text-sm text-foreground">{savedUpiId}</span>
                        <button
                          onClick={copyUpiId}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    )}

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
                  ) : isUpi ? (
                    <>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleGateway(gw.id)}
                      />
                      {isEnabled && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs gap-1.5">
                              <QrCode className="h-3 w-3" />
                              QR Code
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-sm">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-primary" />
                                UPI QR Code
                              </DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center gap-4 py-4">
                              <div className="rounded-xl border border-border bg-white p-4">
                                <img
                                  src={generateQrUrl(savedUpiId)}
                                  alt="UPI QR Code"
                                  className="h-48 w-48"
                                />
                              </div>
                              <div className="text-center">
                                <p className="font-mono text-sm font-medium text-foreground">{savedUpiId}</p>
                                <p className="text-xs text-muted-foreground mt-1">Scan to pay via any UPI app</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={copyUpiId}
                              >
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? "Copied!" : "Copy UPI ID"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </>
                  ) : (
                    <>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleGateway(gw.id)}
                      />
                      {isEnabled && (
                        <Button variant="outline" size="sm" className="text-xs gap-1.5">
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

      {/* UPI Setup Dialog */}
      <Dialog open={upiDialogOpen} onOpenChange={setUpiDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              Setup UPI Payments
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Your UPI ID / VPA
              </label>
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@upi"
                className="border-border bg-muted/30 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter your UPI ID from Google Pay, PhonePe, Paytm, or any bank app
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Examples:</strong> yourname@oksbi, yourname@ybl, yourname@paytm, 9876543210@upi
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveUpi} className="flex-1 gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Enable UPI
              </Button>
              <Button variant="outline" onClick={() => setUpiDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
