import { buildCrmIdempotencyKey, hashPayload } from '@conduit/shared';
import type { JobProcessor } from '../types.js';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';
import {
  getDealCandidateProvider,
  type DealCandidate,
  type DealCandidateProvider
} from '../../connectors/dealCandidates.js';
import {
  computeBantReadiness,
  suggestQuestions,
  type BantKey,
  type DealFact
} from '../../governance/dealReadiness.js';

const isDryRun = process.env.DRY_RUN !== 'false';

interface ThreadContext {
  workspaceId: string;
  threadId: string;
  status: string;
  messages: Array<{ from_email: string; to_email: string | null; text: string | null }>;
  fields: Array<{ field_key: string; field_value_json: unknown; confidence: number; evidence_json: unknown }>;
}

const loadThreadContext = async (threadId: string): Promise<ThreadContext> => {
  return withClient(async (client) => {
    const threadResult = await client.query(`SELECT id, workspace_id, status FROM threads WHERE id = $1 LIMIT 1`, [threadId]);
    const thread = threadResult.rows[0];
    if (!thread) {
      throw new Error(`thread not found for ${threadId}`);
    }

    const messagesResult = await client.query(
      `SELECT from_email, to_email, text
       FROM messages
       WHERE thread_id = $1
       ORDER BY created_at DESC`,
      [threadId]
    );

    const fieldsResult = await client.query(
      `SELECT field_key, field_value_json, confidence, evidence_json
       FROM field_values
       WHERE thread_id = $1
       ORDER BY created_at DESC`,
      [threadId]
    );

    return {
      workspaceId: thread.workspace_id as string,
      threadId,
      status: (thread.status as string) ?? 'new',
      messages: messagesResult.rows as ThreadContext['messages'],
      fields: fieldsResult.rows as ThreadContext['fields']
    };
  });
};

const collectParticipantEmails = (messages: ThreadContext['messages']): string[] => {
  const emails = new Set<string>();
  for (const message of messages) {
    if (message.from_email) {
      emails.add(message.from_email.toLowerCase());
    }
    if (message.to_email) {
      for (const item of message.to_email.split(',')) {
        const value = item.trim().toLowerCase();
        if (value.includes('@')) {
          emails.add(value);
        }
      }
    }
  }
  return Array.from(emails);
};

const deriveCompanyDomain = (emails: string[]): string | undefined => {
  const firstExternal = emails.find((email) => email.includes('@'));
  if (!firstExternal) {
    return undefined;
  }

  return firstExternal.split('@')[1];
};

export const deriveDealFacts = (input: {
  fields: ThreadContext['fields'];
  latestMessageText: string;
}): DealFact[] => {
  const facts: DealFact[] = [];
  const timelineField = input.fields.find((field) => field.field_key === 'timeline');
  if (timelineField) {
    facts.push({
      key: 'timeline',
      value_json: timelineField.field_value_json,
      confidence: Number(timelineField.confidence ?? 0.7),
      evidence_json: timelineField.evidence_json
    });
  }

  const budgetRegex = /(\$\s?\d|budget|pricing|\d+\s?(usd|dollars|k|m))/i;
  if (budgetRegex.test(input.latestMessageText)) {
    facts.push({
      key: 'budget',
      value_json: { signal: 'budget_heuristic_detected' },
      confidence: 0.6,
      evidence_json: { heuristic: 'budget_regex' }
    });
  }

  return facts;
};

const upsertDealAndLink = async (params: {
  workspaceId: string;
  threadId: string;
  candidate: DealCandidate;
}): Promise<{ dealId: string }> => {
  return withClient(async (client) => {
    const dealResult = await client.query(
      `INSERT INTO deals (workspace_id, crm, crm_deal_id, title, primary_domain, updated_at)
       VALUES ($1, $2, $3, $4, split_part($3, '@', 2), now())
       ON CONFLICT (workspace_id, crm, crm_deal_id)
       DO UPDATE SET title = EXCLUDED.title, updated_at = now()
       RETURNING id`,
      [params.workspaceId, params.candidate.crm, params.candidate.crm_deal_id, params.candidate.title]
    );
    const dealId = dealResult.rows[0].id as string;

    await client.query(
      `INSERT INTO thread_links (workspace_id, thread_id, deal_id, link_confidence, link_reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, thread_id)
       DO UPDATE SET deal_id = EXCLUDED.deal_id, link_confidence = EXCLUDED.link_confidence, link_reason = EXCLUDED.link_reason`,
      [params.workspaceId, params.threadId, dealId, params.candidate.score, params.candidate.why || 'participant_email_match']
    );

    await client.query(
      `UPDATE association_candidates
       SET status = 'resolved', resolved_at = now()
       WHERE workspace_id = $1 AND thread_id = $2 AND status = 'open'`,
      [params.workspaceId, params.threadId]
    );

    await client.query(
      `UPDATE review_items
       SET status = 'resolved', resolved_at = now()
       WHERE workspace_id = $1 AND thread_id = $2 AND reason = 'needs_deal_linking' AND status = 'open'`,
      [params.workspaceId, params.threadId]
    );

    return { dealId };
  });
};

const writeNeedsLinking = async (params: {
  workspaceId: string;
  threadId: string;
  candidates: DealCandidate[];
}) => {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO association_candidates (workspace_id, thread_id, candidates_json, status)
       VALUES ($1, $2, $3, 'open')
       ON CONFLICT (workspace_id, thread_id) WHERE status = 'open'
       DO UPDATE SET candidates_json = EXCLUDED.candidates_json`,
      [params.workspaceId, params.threadId, params.candidates]
    );

    await client.query(
      `INSERT INTO review_items (workspace_id, thread_id, reason, status, payload_json)
       VALUES ($1, $2, 'needs_deal_linking', 'open', $3)
       ON CONFLICT DO NOTHING`,
      [params.workspaceId, params.threadId, { candidates: params.candidates }]
    );
  });
};

const writeUnlinked = async (workspaceId: string, threadId: string) => {
  await withClient(async (client) => {
    await client.query(`UPDATE threads SET status = 'unlinked', updated_at = now() WHERE id = $1`, [threadId]);
    await client.query(
      `INSERT INTO review_items (workspace_id, thread_id, reason, status, payload_json)
       VALUES ($1, $2, 'unlinked_thread', 'open', '{}'::jsonb)
       ON CONFLICT DO NOTHING`,
      [workspaceId, threadId]
    );
  });
};

const upsertReadiness = async (params: {
  workspaceId: string;
  dealId: string;
  facts: DealFact[];
  threadId: string;
  jobId: string;
}) => {
  await withClient(async (client) => {
    for (const fact of params.facts) {
      await client.query(
        `INSERT INTO deal_facts (workspace_id, deal_id, key, value_json, confidence, evidence_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (workspace_id, deal_id, key)
         DO UPDATE SET value_json = EXCLUDED.value_json, confidence = EXCLUDED.confidence, evidence_json = EXCLUDED.evidence_json, updated_at = now()`,
        [params.workspaceId, params.dealId, fact.key, fact.value_json, fact.confidence, fact.evidence_json ?? {}]
      );
    }

    const { rows } = await client.query(
      `SELECT key, value_json, confidence, evidence_json
       FROM deal_facts
       WHERE workspace_id = $1 AND deal_id = $2`,
      [params.workspaceId, params.dealId]
    );

    const readiness = computeBantReadiness(rows as DealFact[]);
    await client.query(
      `INSERT INTO deal_readiness (workspace_id, deal_id, framework, missing_keys, readiness_score, updated_at)
       VALUES ($1, $2, 'BANT', $3, $4, now())
       ON CONFLICT (workspace_id, deal_id, framework)
       DO UPDATE SET missing_keys = EXCLUDED.missing_keys, readiness_score = EXCLUDED.readiness_score, updated_at = now()`,
      [params.workspaceId, params.dealId, readiness.missingKeys, readiness.readinessScore]
    );

    await writeAuditEvent({
      workspaceId: params.workspaceId,
      threadId: params.threadId,
      jobId: params.jobId,
      type: 'deal_readiness_updated',
      data: { deal_id: params.dealId, missing_keys: readiness.missingKeys, readiness_score: readiness.readinessScore }
    });

    if (readiness.missingKeys.length > 0) {
      const payload = {
        thread_id: params.threadId,
        deal_id: params.dealId,
        framework: 'BANT',
        action: 'create_followup_tasks',
        questions: suggestQuestions(readiness.missingKeys as BantKey[])
      };
      const idempotencyKey = buildCrmIdempotencyKey({
        workspace_id: params.workspaceId,
        crm_system: 'hubspot',
        object_type: 'deal',
        object_id: params.dealId,
        action: 'followup_tasks',
        source_event_id: params.threadId
      });

      await client.query(
        `INSERT INTO crm_write_log (workspace_id, thread_id, crm, action, idempotency_key, payload_json, payload_hash, status)
         VALUES ($1, $2, 'hubspot', 'create_followup_tasks', $3, $4, $5, $6)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [params.workspaceId, params.threadId, idempotencyKey, payload, hashPayload(payload), isDryRun ? 'dry_run' : 'queued']
      );
    }
  });
};

export const associateThread = (provider: DealCandidateProvider = getDealCandidateProvider()): JobProcessor => {
  return async ({ job }) => {
    const threadId = String(job.payload.thread_id ?? '');
    if (!threadId) {
      throw new Error('missing thread_id payload');
    }

    const context = await loadThreadContext(threadId);
    const participantEmails = collectParticipantEmails(context.messages);
    const companyDomain = deriveCompanyDomain(participantEmails);
    const candidates = await provider.getDealCandidates({
      workspaceId: context.workspaceId,
      participantEmails,
      companyDomain
    });

    if (candidates.length === 1) {
      const candidate = candidates[0];
      const { dealId } = await upsertDealAndLink({ workspaceId: context.workspaceId, threadId, candidate });
      const facts = deriveDealFacts({
        fields: context.fields,
        latestMessageText: context.messages[0]?.text ?? ''
      });
      await upsertReadiness({ workspaceId: context.workspaceId, dealId, facts, threadId, jobId: job.id });
      await writeAuditEvent({
        workspaceId: context.workspaceId,
        threadId,
        jobId: job.id,
        type: 'thread_auto_linked',
        data: { candidate }
      });
      return;
    }

    if (candidates.length > 1) {
      await writeNeedsLinking({ workspaceId: context.workspaceId, threadId, candidates });
      await writeAuditEvent({
        workspaceId: context.workspaceId,
        threadId,
        jobId: job.id,
        type: 'thread_needs_linking',
        data: { candidates_count: candidates.length }
      });
      return;
    }

    await writeUnlinked(context.workspaceId, threadId);
    await writeAuditEvent({
      workspaceId: context.workspaceId,
      threadId,
      jobId: job.id,
      type: 'thread_unlinked',
      data: { participant_count: participantEmails.length }
    });
  };
};

export const associateThreadProcessor = associateThread();
