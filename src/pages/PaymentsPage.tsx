import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, FileText } from "lucide-react";
import { PaymentGatewaySettings } from "@/components/settings/PaymentGatewaySettings";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Inline the invoices content from InvoicesPage
import InvoicesPage from "@/pages/InvoicesPage";

const PaymentsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">Manage billing systems, invoice collection, and payment gateways in one place</p>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList className="bg-muted/30 border border-border">
          <TabsTrigger value="invoices" className="gap-2 data-[state=active]:bg-background">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="gateway" className="gap-2 data-[state=active]:bg-background">
            <CreditCard className="h-4 w-4" />
            Payment Gateway
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <InvoicesPage />
        </TabsContent>

        <TabsContent value="gateway">
          <PaymentGatewaySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentsPage;
