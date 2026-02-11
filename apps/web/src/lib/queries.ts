import { createClient } from '@supabase/supabase-js';

const createServerClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return createClient(url, key);
};

export interface ThreadRow {
  id: string;
  subject: string;
  primary_contact_email: string | null;
  status: string;
  created_at: string;
}

export interface ReviewItemRow {
  id: string;
  thread_id: string;
  reason: string;
  status: string;
  payload_json?: { candidates?: DealCandidateRow[] };
  created_at: string;
}

export interface ThreadMessageRow {
  id: string;
  from_email: string;
  subject: string;
  text: string | null;
  created_at: string;
}

export interface FieldValueRow {
  field_key: string;
  field_value_json: unknown;
  confidence: number;
  evidence_json: unknown;
  created_at: string;
}

export interface DealCandidateRow {
  crm: 'hubspot' | 'salesforce';
  crm_deal_id: string;
  title: string;
  score: number;
  why: string;
}

export interface DealRow {
  id: string;
  crm: 'hubspot' | 'salesforce';
  crm_deal_id: string;
  title: string;
  stage: string | null;
}

export interface DealReadinessRow {
  framework: string;
  missing_keys: string[];
  readiness_score: number;
}

export interface DealFactRow {
  key: string;
  value_json: unknown;
  confidence: number;
}

export interface ThreadDetail {
  messages: ThreadMessageRow[];
  fields: FieldValueRow[];
  reviewItems: ReviewItemRow[];
  crmLog: Array<{ id: string; crm: string; action: string; status: string; created_at: string }>;
  threadLink: { deal_id: string; link_confidence: number; link_reason: string } | null;
  deal: DealRow | null;
  dealReadiness: DealReadinessRow | null;
  dealFacts: DealFactRow[];
  needsLinkingCandidates: DealCandidateRow[];
}

const questionMap: Record<string, string> = {
  budget: 'Do you have a budget range allocated for this?',
  authority: 'Who besides you needs to approve this?',
  need: 'What problem are you trying to solve and what happens if you don’t solve it?',
  timeline: 'When do you need this live?'
};

export const suggestDealQuestions = (missingKeys: string[]): string[] => {
  return ['budget', 'authority', 'need', 'timeline']
    .filter((key) => missingKeys.includes(key))
    .map((key) => questionMap[key]);
};

export const formatConfidence = (value: number): string => `${Math.round(value * 100)}%`;

export const getTodayThreads = async (): Promise<ThreadRow[]> => {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('threads')
    .select('id,subject,primary_contact_email,status,created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  return data ?? [];
};

export const getOpenReviewItems = async (): Promise<ReviewItemRow[]> => {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('review_items')
    .select('id,thread_id,reason,status,payload_json,created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(20);

  return data ?? [];
};

export const getThreadDetail = async (threadId: string): Promise<ThreadDetail> => {
  const supabase = createServerClient();

  const [messages, fields, reviewItems, crmLog, threadLink] = await Promise.all([
    supabase.from('messages').select('id,from_email,subject,text,created_at').eq('thread_id', threadId),
    supabase
      .from('field_values')
      .select('field_key,field_value_json,confidence,evidence_json,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false }),
    supabase.from('review_items').select('id,thread_id,reason,status,payload_json,created_at').eq('thread_id', threadId),
    supabase.from('crm_write_log').select('id,crm,action,status,created_at').eq('thread_id', threadId),
    supabase.from('thread_links').select('deal_id,link_confidence,link_reason').eq('thread_id', threadId).maybeSingle()
  ]);

  const linkedDealId = threadLink.data?.deal_id;

  const [deal, dealReadiness, dealFacts] = linkedDealId
    ? await Promise.all([
        supabase.from('deals').select('id,crm,crm_deal_id,title,stage').eq('id', linkedDealId).maybeSingle(),
        supabase
          .from('deal_readiness')
          .select('framework,missing_keys,readiness_score')
          .eq('deal_id', linkedDealId)
          .maybeSingle(),
        supabase.from('deal_facts').select('key,value_json,confidence').eq('deal_id', linkedDealId)
      ])
    : [{ data: null }, { data: null }, { data: [] }];

  const needsLinkingCandidates = (reviewItems.data ?? [])
    .filter((item) => item.reason === 'needs_deal_linking' && item.status === 'open')
    .flatMap((item) => item.payload_json?.candidates ?? []);

  return {
    messages: messages.data ?? [],
    fields: fields.data ?? [],
    reviewItems: reviewItems.data ?? [],
    crmLog: crmLog.data ?? [],
    threadLink: threadLink.data ?? null,
    deal: deal.data ?? null,
    dealReadiness: dealReadiness.data ?? null,
    dealFacts: dealFacts.data ?? [],
    needsLinkingCandidates
  };
};
