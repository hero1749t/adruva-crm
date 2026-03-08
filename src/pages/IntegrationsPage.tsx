import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";

const IntegrationsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect and manage external API integrations</p>
      </div>
      <IntegrationsSettings />
    </div>
  );
};

export default IntegrationsPage;
