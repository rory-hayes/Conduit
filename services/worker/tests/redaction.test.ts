import { describe, expect, it } from 'vitest';
import { redactSnippet, truncateSnippet } from '../src/llm/redaction.js';

describe('redaction', () => {
  it('masks email local-part and phone numbers deterministically', () => {
    const output = redactSnippet('Contact jane.doe@Acme.com or +1 (415) 555-0199 today');
    expect(output).toContain('***@acme.com');
    expect(output).toContain('[redacted-phone]');
    expect(output).not.toContain('jane.doe');
  });

  it('truncates snippets with ellipsis', () => {
    const output = truncateSnippet('x'.repeat(300), 10);
    expect(output).toBe('xxxxxxxxx…');
  });
});
