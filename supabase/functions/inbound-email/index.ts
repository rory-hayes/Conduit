import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';

const aliasTokenFromAddress = (address: string): string => {
  const localPart = address.split('@')[0] ?? '';
  const token = localPart.split('-').slice(1).join('-');
  return token || localPart;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const payload = await req.json();
  if (!payload?.to || !payload?.from || !payload?.message_id || !payload?.received_at) {
    return new Response(JSON.stringify({ error: 'invalid payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const aliasToken = aliasTokenFromAddress(payload.to);

  const { data: alias } = await supabase
    .from('inbound_aliases')
    .select('workspace_id')
    .eq('alias', aliasToken)
    .maybeSingle();

  const workspaceId = alias?.workspace_id;
  if (!workspaceId) {
    return new Response(JSON.stringify({ error: 'workspace alias not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let threadId: string | null = null;
  if (payload.in_reply_to || payload.references?.length) {
    const referenceIds = [payload.in_reply_to, ...(payload.references ?? [])].filter(Boolean);
    const { data: existing } = await supabase
      .from('messages')
      .select('thread_id')
      .in('message_id', referenceIds)
      .limit(1)
      .maybeSingle();
    threadId = existing?.thread_id ?? null;
  }

  if (!threadId) {
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .insert({
        workspace_id: workspaceId,
        subject: payload.subject,
        primary_contact_email: payload.from,
        status: 'new'
      })
      .select('id')
      .single();

    if (threadError) {
      return new Response(JSON.stringify({ error: threadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    threadId = thread.id;
  }

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      workspace_id: workspaceId,
      thread_id: threadId,
      from_email: payload.from,
      to_email: payload.to,
      subject: payload.subject,
      text: payload.text ?? null,
      html: payload.html ?? null,
      message_id: payload.message_id,
      in_reply_to: payload.in_reply_to ?? null,
      references_json: payload.references ?? [],
      received_at: payload.received_at
    })
    .select('id')
    .single();

  if (messageError) {
    return new Response(JSON.stringify({ error: messageError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      workspace_id: workspaceId,
      type: 'extract_thread',
      status: 'queued',
      payload: { thread_id: threadId }
    })
    .select('id')
    .single();

  if (jobError) {
    return new Response(JSON.stringify({ error: jobError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  await supabase.from('audit_events').insert({
    workspace_id: workspaceId,
    thread_id: threadId,
    job_id: job.id,
    type: 'inbound_email_received',
    data_json: {
      message_id: payload.message_id,
      attachment_count: payload.attachments?.length ?? 0
    }
  });

  return new Response(JSON.stringify({ thread_id: threadId, message_id: payload.message_id, job_id: job.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
