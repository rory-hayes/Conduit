import Link from 'next/link';
import { getOpenReviewItems } from '../../lib/queries';

export default async function ReviewQueuePage() {
  const items = await getOpenReviewItems();

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Review Queue</h2>
      <ul className="space-y-2 text-sm text-slate-300">
        {items.map((item) => (
          <li key={item.id} className="rounded border border-slate-800 bg-slate-900 p-3">
            <Link href={`/threads/${item.thread_id}`} className="text-white hover:underline">
              Thread {item.thread_id}
            </Link>
            <p>reason: {item.reason}</p>
            <p className="text-slate-400">status: {item.status}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
