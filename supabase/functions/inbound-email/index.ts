import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseServiceRoleKey, supabaseUrl } from '../_shared/env.ts';
import type { InboundEmail } from '../_shared/types.ts';

// Expected payload (JSON):
// {
//   workspaceId: string (uuid),
//   externalId: string,
//   subject: string,
//   from: string,
//   to: string[],
//   cc?: string[],
//   bodyText?: string,
//   receivedAt: string (ISO),
//   attachments?: [{ filename, contentType, sizeBytes, storagePath? }]
// }

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

  const payload = (await req.json()) as InboundEmail;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      workspace_id: payload.workspaceId,
      subject: payload.subject
    })
    .select('id')
    .single();

  if (threadError) {
    return new Response(JSON.stringify({ error: threadError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      workspace_id: payload.workspaceId,
      thread_id: thread.id,
      external_id: payload.externalId,
      from_email: payload.from,
      to_emails: payload.to,
      cc_emails: payload.cc ?? [],
      body_text: payload.bodyText ?? null,
      received_at: payload.receivedAt
    })
    .select('id')
    .single();

  if (messageError) {
    return new Response(JSON.stringify({ error: messageError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (payload.attachments?.length) {
    const attachments = payload.attachments.map((attachment) => ({
      message_id: message.id,
      filename: attachment.filename,
      content_type: attachment.contentType,
      size_bytes: attachment.sizeBytes,
      storage_path: attachment.storagePath ?? null
    }));

    const { error: attachmentError } = await supabase.from('attachments').insert(attachments);
    if (attachmentError) {
      return new Response(JSON.stringify({ error: attachmentError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  const { error: jobError } = await supabase.from('jobs').insert({
    type: 'extract_thread',
    status: 'queued',
    payload: {
      threadId: thread.id,
      messageId: message.id,
      workspaceId: payload.workspaceId
    }
  });

  if (jobError) {
    return new Response(JSON.stringify({ error: jobError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ thread_id: thread.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
