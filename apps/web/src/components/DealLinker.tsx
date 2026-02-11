'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Candidate {
  crm: 'hubspot' | 'salesforce';
  crm_deal_id: string;
  title: string;
  score: number;
  why: string;
}

interface DealLinkerProps {
  threadId: string;
  candidates: Candidate[];
  onLink?: (candidate: Candidate) => Promise<void> | void;
}

const linkViaSupabase = async (threadId: string, candidate: Candidate) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const supabase = createClient(url, key);

  const { data: thread } = await supabase.from('threads').select('workspace_id').eq('id', threadId).maybeSingle();
  if (!thread?.workspace_id) {
    return;
  }

  const { data: deal } = await supabase
    .from('deals')
    .upsert(
      {
        workspace_id: thread.workspace_id,
        crm: candidate.crm,
        crm_deal_id: candidate.crm_deal_id,
        title: candidate.title
      },
      { onConflict: 'workspace_id,crm,crm_deal_id' }
    )
    .select('id')
    .maybeSingle();

  if (!deal?.id) {
    return;
  }

  await supabase.from('thread_links').upsert(
    {
      workspace_id: thread.workspace_id,
      thread_id: threadId,
      deal_id: deal.id,
      link_confidence: candidate.score,
      link_reason: 'manual'
    },
    { onConflict: 'workspace_id,thread_id' }
  );

  await supabase
    .from('association_candidates')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('workspace_id', thread.workspace_id)
    .eq('thread_id', threadId)
    .eq('status', 'open');

  await supabase
    .from('review_items')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('workspace_id', thread.workspace_id)
    .eq('thread_id', threadId)
    .eq('reason', 'needs_deal_linking')
    .eq('status', 'open');
};

export const triggerLink = async (params: {
  threadId: string;
  candidate: Candidate;
  onLink?: (candidate: Candidate) => Promise<void> | void;
}) => {
  if (params.onLink) {
    await params.onLink(params.candidate);
    return 'callback';
  }

  await linkViaSupabase(params.threadId, params.candidate);
  return 'supabase';
};

export function DealLinker({ threadId, candidates, onLink }: DealLinkerProps) {
  const [selectedDeal, setSelectedDeal] = useState<string>(candidates[0]?.crm_deal_id ?? '');
  const [statusText, setStatusText] = useState('');
  const selected = useMemo(
    () => candidates.find((candidate) => candidate.crm_deal_id === selectedDeal),
    [candidates, selectedDeal]
  );

  const handleLink = async () => {
    if (!selected) {
      return;
    }

    const mode = await triggerLink({ threadId, candidate: selected, onLink });
    setStatusText(mode === 'callback' ? 'Linked via callback.' : 'Linked and resolved in review queue. Refresh to confirm.');
  };

  return (
    <section className="space-y-3 rounded border border-amber-700 bg-slate-900 p-4 text-sm text-slate-200">
      <h3 className="font-medium text-white">Needs Linking</h3>
      <p>Thread {threadId} has multiple possible deals. Choose one to resolve linking.</p>
      <ul className="space-y-2">
        {candidates.map((candidate) => (
          <li key={`${candidate.crm}-${candidate.crm_deal_id}`}>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="deal-link"
                checked={selectedDeal === candidate.crm_deal_id}
                onChange={() => setSelectedDeal(candidate.crm_deal_id)}
              />
              <span>
                {candidate.title} ({candidate.crm}) - {Math.round(candidate.score * 100)}%: {candidate.why}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleLink}
        className="rounded bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-500"
      >
        Link
      </button>
      {statusText ? <p className="text-emerald-300">{statusText}</p> : null}
    </section>
  );
}
