import { RollupViewer } from '../../components/RollupViewer';
import { getWeeklyRollups } from '../../lib/queries';

export default async function ReportsPage() {
  const rollups = await getWeeklyRollups();

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Reports</h2>
      <p className="text-sm text-slate-300">
        Weekly rollups are generated from internal evidence. CRM receives only curated summaries and optional
        high-confidence deltas.
      </p>
      {rollups.length === 0 ? (
        <p className="text-sm text-slate-400">No weekly rollups generated yet.</p>
      ) : (
        <div className="space-y-3">
          {rollups.map((rollup) => (
            <RollupViewer
              key={rollup.id}
              weekStart={rollup.week_start}
              weekEnd={rollup.week_end}
              summaryMd={rollup.summary_md}
              highlights={rollup.highlights_json ?? undefined}
              generationMethod={rollup.generation_method}
            />
          ))}
        </div>
      )}
    </section>
  );
}
