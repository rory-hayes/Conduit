import Link from 'next/link';
import { getOpenReviewItems } from '../../lib/queries';
import { DealLinker } from '../../components/DealLinker';

export default async function ReviewQueuePage() {
  const items = await getOpenReviewItems();
  const needsLinking = items.filter((item) => item.reason === 'needs_deal_linking');
  const general = items.filter((item) => item.reason !== 'needs_deal_linking');

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Review Queue</h2>

      <div className="space-y-3">
        <h3 className="font-medium text-white">Needs Linking</h3>
        {needsLinking.length === 0 ? (
          <p className="text-sm text-slate-400">No ambiguous deal links right now.</p>
        ) : (
          needsLinking.map((item) => (
            <div key={item.id} className="space-y-2 rounded border border-amber-800 bg-slate-900 p-3">
              <Link href={`/threads/${item.thread_id}`} className="text-white hover:underline">
                Thread {item.thread_id}
              </Link>
              <DealLinker threadId={item.thread_id} candidates={item.payload_json?.candidates ?? []} />
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 text-sm text-slate-300">
        <h3 className="font-medium text-white">Other Review Items</h3>
        <ul className="space-y-2">
          {general.map((item) => (
            <li key={item.id} className="rounded border border-slate-800 bg-slate-900 p-3">
              <Link href={`/threads/${item.thread_id}`} className="text-white hover:underline">
                Thread {item.thread_id}
              </Link>
              <p>reason: {item.reason}</p>
              <p className="text-slate-400">status: {item.status}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
