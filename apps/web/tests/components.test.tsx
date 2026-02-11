import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Nav } from '../src/components/Nav';
import { StatCard } from '../src/components/StatCard';
import { DealReadinessPanel } from '../src/components/DealReadinessPanel';
import { DealLinker, triggerLink } from '../src/components/DealLinker';
import { DriftAlertBanner } from '../src/components/DriftAlertBanner';
import { RollupViewer } from '../src/components/RollupViewer';
import { AIRollupsToggle } from '../src/components/AIRollupsToggle';
import { IntegrationCard } from '../src/components/IntegrationCard';
import { RetentionSettingsCard } from '../src/components/RetentionSettingsCard';
import { ConnectionHealthCard } from '../src/components/ConnectionHealthCard';
import { ClaimInstallCard } from '../src/components/ClaimInstallCard';

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

  it('renders weekly rollup viewer summary and highlights', () => {
    const html = renderToStaticMarkup(
      <RollupViewer
        weekStart="2026-01-01"
        weekEnd="2026-01-07"
        summaryMd="### What happened this week\n- Event"
        highlights={{ events: ['Event'], risks: ['Risk'], next_actions: ['Action'] }}
        generationMethod="llm"
      />
    );
    expect(html).toContain('2026-01-01');
    expect(html).toContain('What happened this week');
    expect(html).toContain('AI Generated');
    expect(html).toContain('Next actions');
  });

  it('renders AI rollups toggle warning and controls', () => {
    const html = renderToStaticMarkup(
      <AIRollupsToggle
        enabled={false}
        contextLevel="structured_only"
        onEnabledChange={() => undefined}
        onContextLevelChange={() => undefined}
      />
    );

    expect(html).toContain('AI Rollups send minimized context only');
    expect(html).toContain('Enable AI-generated weekly rollups');
    expect(html).toContain('Structured + redacted snippets');
  });


  it('renders integration card status and actions without token leakage', () => {
    const html = renderToStaticMarkup(
      <IntegrationCard
        crm="hubspot"
        status="error"
        lastCheckedAt="2026-01-01T00:00:00Z"
        lastError="scope missing"
        onConnect={async () => undefined}
        onDisconnect={async () => undefined}
      />
    );

    expect(html).toContain('HubSpot');
    expect(html).toContain('Connect');
    expect(html).toContain('Disconnect');
    expect(html).not.toContain('access_token');
  });


  it('renders claim install card with workspace selector and claim action', () => {
    const html = renderToStaticMarkup(
      <ClaimInstallCard
        crm="hubspot"
        installId="pi_1"
        workspaces={[{ id: 'w1', name: 'Workspace 1' }]}
        selectedWorkspaceId="w1"
        onWorkspaceChange={() => undefined}
        onClaim={async () => undefined}
      />
    );

    expect(html).toContain('Claim HubSpot install');
    expect(html).toContain('Install ID: pi_1');
    expect(html).toContain('Claim install');
  });

  it('renders connection health card with reconnect/disconnect actions', () => {
    const html = renderToStaticMarkup(
      <ConnectionHealthCard
        crm="salesforce"
        status="warning"
        lastCheckedAt="2026-01-01T00:00:00Z"
        details="scope mismatch"
        onReconnect={async () => undefined}
        onDisconnect={async () => undefined}
      />
    );

    expect(html).toContain('Salesforce health');
    expect(html).toContain('Reconnect');
    expect(html).toContain('Disconnect');
    expect(html).toContain('scope mismatch');
  });

  it('renders retention settings card validation copy', () => {
    const html = renderToStaticMarkup(
      <RetentionSettingsCard
        rawEmailRetentionDays={0}
        attachmentRetentionDays={0}
        purgeEnabled={true}
        onRawEmailRetentionDaysChange={() => undefined}
        onAttachmentRetentionDaysChange={() => undefined}
        onPurgeEnabledChange={() => undefined}
        onSave={async () => undefined}
      />
    );

    expect(html).toContain('Retention policy');
    expect(html).toContain('Raw email retention must be at least 1 day.');
    expect(html).toContain('Attachment retention must be at least 1 day.');
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
