import { getPolicySettings } from '../../lib/queries';

export default async function SettingsPage() {
  const settings = await getPolicySettings();

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>
      <p className="text-sm text-slate-300">Configure policy controls for drift safety and weekly CRM curation.</p>

      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
          <span>Pause CRM writes on drift</span>
          <span className="font-medium text-white">{settings.pause_on_drift ? 'On' : 'Off'}</span>
        </label>
        <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
          <span>Weekly rollup: write summary note to CRM</span>
          <span className="font-medium text-white">{settings.write_weekly_rollup_to_crm ? 'On' : 'Off'}</span>
        </label>
        <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
          <span>Weekly rollup: create delta field updates</span>
          <span className="font-medium text-white">{settings.create_crm_deltas ? 'On' : 'Off'}</span>
        </label>
      </div>
    </section>
  );
}
