import { StatCard } from '../components/StatCard';

const stats = [
  { title: 'Inbound threads', value: '128', helper: 'Last 24 hours' },
  { title: 'Review queue', value: '7', helper: 'Waiting for analyst' },
  { title: 'CRM updates', value: '56', helper: 'High-confidence writes' }
];

export default function Page() {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">System status</h2>
        <p className="mt-2 text-sm text-slate-300">
          All pipelines are healthy. Low-confidence extractions are routed to the review queue, and
          CRM writes are paused automatically if drift is detected.
        </p>
      </div>
    </section>
  );
}
