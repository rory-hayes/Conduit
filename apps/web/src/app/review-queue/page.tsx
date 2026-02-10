export default function ReviewQueuePage() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Review Queue</h2>
      <p className="text-sm text-slate-300">
        Low-confidence extractions and drift alerts appear here. Approve or reject to resume CRM
        writes.
      </p>
    </section>
  );
}
