import { IntegrationsPanel } from './IntegrationsPanel';

export default function IntegrationsPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Integrations</h2>
      <p className="text-sm text-slate-300">Connect HubSpot and Salesforce. Conduit stores raw content; CRM receives curated outcomes only.</p>
      <IntegrationsPanel />
    </section>
  );
}
