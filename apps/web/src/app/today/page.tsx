import Link from 'next/link';
import { getTodayThreads } from '../../lib/queries';

export default async function TodayPage() {
  const threads = await getTodayThreads();

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Today</h2>
      <ul className="space-y-2 text-sm text-slate-300">
        {threads.map((thread) => (
          <li key={thread.id} className="rounded border border-slate-800 bg-slate-900 p-3">
            <Link href={`/threads/${thread.id}`} className="font-medium text-white hover:underline">
              {thread.subject}
            </Link>
            <p>{thread.primary_contact_email ?? 'unknown contact'}</p>
            <p className="text-slate-400">status: {thread.status}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
