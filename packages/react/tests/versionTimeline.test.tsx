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
  it('renders each version with status, date, channel and approvers', () => {
    render(<VersionTimeline items={ITEMS} />);
    const list = screen.getByRole('list', { name: 'Version history' });
    const entries = within(list).getAllByRole('listitem');
    expect(entries).toHaveLength(2);

    const v2 = list.querySelector('[data-version-id="v2"]')!;
    expect(v2).toHaveTextContent('v2.0.0');
    expect(v2).toHaveTextContent('active');
    expect(v2).toHaveTextContent('general');
    expect(v2).toHaveTextContent('2026-06-01'); // effectiveFrom formatted to a date
    expect(within(v2 as HTMLElement).getByText('compliance')).toBeInTheDocument();
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
