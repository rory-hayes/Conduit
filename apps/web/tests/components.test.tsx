import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Nav } from '../src/components/Nav';
import { StatCard } from '../src/components/StatCard';
import { DealReadinessPanel } from '../src/components/DealReadinessPanel';
import { DealLinker, triggerLink } from '../src/components/DealLinker';
import { DriftAlertBanner } from '../src/components/DriftAlertBanner';
import { RollupViewer } from '../src/components/RollupViewer';

describe('web components', () => {
  it('renders nav links', () => {
    const html = renderToStaticMarkup(<Nav />);
    expect(html).toContain('Today');
    expect(html).toContain('/review-queue');
  });

  it('renders stat card helper text when present', () => {
    const html = renderToStaticMarkup(<StatCard title="Open" value="10" helper="today" />);
    expect(html).toContain('Open');
    expect(html).toContain('today');
  });

  it('omits stat card helper when absent', () => {
    const html = renderToStaticMarkup(<StatCard title="Open" value="10" />);
    expect(html).not.toContain('mt-1');
  });

  it('renders deal readiness missing keys and questions', () => {
    const html = renderToStaticMarkup(
      <DealReadinessPanel
        readiness={{ framework: 'BANT', missing_keys: ['authority', 'need'], readiness_score: 50 }}
        facts={[{ key: 'budget', confidence: 0.6, value_json: { signal: true } }]}
        suggestedQuestions={['Who besides you needs to approve this?']}
      />
    );

    expect(html).toContain('Deal Readiness (BANT)');
    expect(html).toContain('authority');
    expect(html).toContain('Who besides you needs to approve this?');
  });

  it('renders deal linker candidates', () => {
    const html = renderToStaticMarkup(
      <DealLinker
        threadId="t1"
        candidates={[{ crm: 'hubspot', crm_deal_id: 'd1', title: 'Deal 1', score: 0.9, why: 'participant_email_match' }]}
      />
    );

    expect(html).toContain('Needs Linking');
    expect(html).toContain('Deal 1');
    expect(html).toContain('Link');
  });


  it('renders drift alert banner count and links', () => {
    const html = renderToStaticMarkup(<DriftAlertBanner openAlerts={3} />);
    expect(html).toContain('Drift alerts open: 3');
    expect(html).toContain('/review-queue');
  });

  it('renders weekly rollup viewer summary', () => {
    const html = renderToStaticMarkup(
      <RollupViewer weekStart="2026-01-01" weekEnd="2026-01-07" summaryMd="### What happened this week\n- Event" />
    );
    expect(html).toContain('2026-01-01');
    expect(html).toContain('What happened this week');
  });

  it('triggerLink uses callback when provided', async () => {
    const onLink = vi.fn();
    const mode = await triggerLink({
      threadId: 't1',
      candidate: { crm: 'hubspot', crm_deal_id: 'd1', title: 'Deal 1', score: 0.9, why: 'participant_email_match' },
      onLink
    });

    expect(mode).toBe('callback');
    expect(onLink).toHaveBeenCalledTimes(1);
  });
});
