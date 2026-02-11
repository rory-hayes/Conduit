import { describe, expect, it, vi } from 'vitest';
import { hubspotClient } from '../src/connectors/hubspot/client';
import { salesforceClient } from '../src/connectors/salesforce/client';
import { enforceWritePolicies } from '../src/governance/writePolicies';
import { jobProcessors } from '../src/jobs/processors';
import { config } from '../src/config';
import { log } from '../src/log';

describe('misc worker modules', () => {
  it('builds connector idempotency keys', async () => {
    const hub = await hubspotClient().writeOutcome({ workspaceId: 'w', threadId: 't' });
    const sf = await salesforceClient().writeOutcome({ workspaceId: 'w', threadId: 't' });
    expect(hub.idempotencyKey).toHaveLength(64);
    expect(sf.idempotencyKey).toHaveLength(64);
  });

  it('blocks payloads when required field policy fails', async () => {
    const blocked = await enforceWritePolicies({ fields: [] });
    expect(blocked).toMatchObject({ blocked: true });
  });

  it('exposes expected job processor mappings', () => {
    expect(Object.keys(jobProcessors)).toEqual([
      'extract_thread',
      'associate_thread',
      'sync_hubspot',
      'sync_salesforce',
      'weekly_digest',
      'ocr_textract'
    ]);
  });

  it('provides config defaults', () => {
    expect(config.openAiModel).toBe('gpt-4o-mini');
  });

  it('logger writes without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    log.info('x', { a: 1 });
    spy.mockRestore();
    expect(true).toBe(true);
  });
});
