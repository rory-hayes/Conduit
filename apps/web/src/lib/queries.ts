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

export interface ThreadDetail {
  messages: ThreadMessageRow[];
  fields: FieldValueRow[];
  reviewItems: ReviewItemRow[];
  crmLog: Array<{ id: string; crm: string; action: string; status: string; created_at: string }>;
}

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
    .select('id,thread_id,reason,status,created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(20);

  return data ?? [];
};

export const getThreadDetail = async (threadId: string): Promise<ThreadDetail> => {
  const supabase = createServerClient();
  const [messages, fields, reviewItems, crmLog] = await Promise.all([
    supabase.from('messages').select('id,from_email,subject,text,created_at').eq('thread_id', threadId),
    supabase
      .from('field_values')
      .select('field_key,field_value_json,confidence,evidence_json,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false }),
    supabase.from('review_items').select('id,reason,status,created_at').eq('thread_id', threadId),
    supabase.from('crm_write_log').select('id,crm,action,status,created_at').eq('thread_id', threadId)
  ]);

  return {
    messages: messages.data ?? [],
    fields: fields.data ?? [],
    reviewItems: reviewItems.data ?? [],
    crmLog: crmLog.data ?? []
  };
};
