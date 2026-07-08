import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { VersionTimeline, type VersionTimelineItem } from '../src/index.js';

const ITEMS: VersionTimelineItem[] = [
  {
    id: 'v1',
    semanticVersion: '1.0.0',
    status: 'deprecated',
    changeSummary: 'Initial release',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    approvers: ['owner'],
  },
  {
    id: 'v2',
    semanticVersion: '2.0.0',
    status: 'active',
    changeSummary: 'Adds the compliance gate',
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    approvers: ['owner', 'compliance'],
    channel: 'general',
    current: true,
  },
];

describe('VersionTimeline', () => {
  it('renders each version with canonical seal, vigência, channel and approvers', () => {
    render(<VersionTimeline items={ITEMS} />);
    const list = screen.getByRole('list', { name: 'Version history' });
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(2);

    const v2 = list.querySelector('[data-version-id="v2"]')!;
    expect(v2).toHaveTextContent('v2.0.0');
    // Canonical PT seal label (same table as the StatusBadge).
    expect(v2).toHaveTextContent('ATIVA');
    expect(v2.querySelector('.bpmnr-timeline-status')).toHaveAttribute('data-status', 'active');
    expect(v2).toHaveTextContent('general');
    expect(v2).toHaveTextContent('vigente desde 2026-06-01');
    expect(within(v2 as HTMLElement).getByText('compliance')).toBeInTheDocument();
  });

  it('answers "which version was active on day X": vigência per version (B3)', () => {
    // Three consecutive validity windows — v1 and v2 closed, v3 open.
    const items: VersionTimelineItem[] = [
      { id: 'v1', semanticVersion: '1.0.0', status: 'retired', effectiveFrom: '2026-01-01T00:00:00Z', effectiveUntil: '2026-03-01T00:00:00Z' },
      { id: 'v2', semanticVersion: '2.0.0', status: 'deprecated', effectiveFrom: '2026-03-01T00:00:00Z', effectiveUntil: '2026-06-01T00:00:00Z' },
      { id: 'v3', semanticVersion: '3.0.0', status: 'active', effectiveFrom: '2026-06-01T00:00:00Z', current: true },
    ];
    const { container } = render(<VersionTimeline items={items} />);
    expect(container.querySelector('[data-version-id="v1"]')).toHaveTextContent(
      'vigente 2026-01-01 → 2026-03-01',
    );
    expect(container.querySelector('[data-version-id="v2"]')).toHaveTextContent(
      'vigente 2026-03-01 → 2026-06-01',
    );
    expect(container.querySelector('[data-version-id="v3"]')).toHaveTextContent(
      'vigente desde 2026-06-01',
    );
  });

  it('shows the pinned-runs chip only when the host reports runs (bindRun)', () => {
    const items: VersionTimelineItem[] = [
      { id: 'v1', semanticVersion: '1.0.0', status: 'deprecated', pinnedRuns: 1 },
      { id: 'v2', semanticVersion: '2.0.0', status: 'active', pinnedRuns: 12 },
      { id: 'v3', semanticVersion: '3.0.0', status: 'draft', pinnedRuns: 0 },
    ];
    const { container } = render(<VersionTimeline items={items} />);
    expect(container.querySelector('[data-version-id="v1"]')).toHaveTextContent('1 execução presa');
    expect(container.querySelector('[data-version-id="v2"]')).toHaveTextContent(
      '12 execuções presas',
    );
    expect(container.querySelector('[data-version-id="v3"] .bpmnr-timeline-runs')).toBeNull();
  });

  it('defaults to newest-first and flips with order="asc"', () => {
    const { rerender, container } = render(<VersionTimeline items={ITEMS} />);
    let ids = [...container.querySelectorAll('[data-version-id]')].map((el) => el.getAttribute('data-version-id'));
    expect(ids).toEqual(['v2', 'v1']);

    rerender(<VersionTimeline items={ITEMS} order="asc" />);
    ids = [...container.querySelectorAll('[data-version-id]')].map((el) => el.getAttribute('data-version-id'));
    expect(ids).toEqual(['v1', 'v2']);
  });

  it('marks the current entry with aria-current', () => {
    const { container } = render(<VersionTimeline items={ITEMS} />);
    expect(container.querySelector('[data-version-id="v2"]')).toHaveAttribute('aria-current', 'true');
    expect(container.querySelector('[data-version-id="v1"]')).not.toHaveAttribute('aria-current');
  });

  it('reports selection through onSelect when interactive', () => {
    const onSelect = vi.fn();
    const { container } = render(<VersionTimeline items={ITEMS} onSelect={onSelect} />);
    fireEvent.click(container.querySelector('[data-version-id="v1"] button')!);
    expect(onSelect).toHaveBeenCalledWith('v1');
  });

  it('disables the entries when no onSelect is given', () => {
    const { container } = render(<VersionTimeline items={ITEMS} />);
    expect(container.querySelector('[data-version-id="v1"] button')).toBeDisabled();
  });

  it('renders an empty state', () => {
    render(<VersionTimeline items={[]} />);
    expect(screen.getByText('No versions yet')).toBeInTheDocument();
  });
});
