import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Nav } from '../src/components/Nav';
import { StatCard } from '../src/components/StatCard';

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
});
