import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider, PT_BR, StatusBadge } from '../src/index.js';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider messages={PT_BR}>{children}</I18nProvider>
);

/**
 * Standalone mode (Handoff 6 §10.6): the SAME StatusBadge renders outside
 * the editor from explicit seal data — no <BpmnDesigner>/<BpmnViewer>
 * context required. The editor mode keeps its behavior untouched (covered
 * by the existing ui tests); here we pin the standalone contract.
 */
describe('StatusBadge — standalone seal mode', () => {
  it('renders from explicit data with no editor context', () => {
    render(<StatusBadge seal={{ status: 'candidate', semanticVersion: '2.1.0' }} />, { wrapper });
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-status', 'candidate');
    expect(badge).toHaveTextContent('CANDIDATA');
    expect(badge).toHaveTextContent('v2.1.0');
  });

  it('uses the host-provided meta line verbatim', () => {
    render(
      <StatusBadge seal={{ status: 'active', semanticVersion: '1.0.0', meta: 'vigente desde 02/03/2026' }} />,
      { wrapper },
    );
    expect(screen.getByRole('status')).toHaveTextContent('vigente desde 02/03/2026');
  });

  it('falls back to the channel segment when no meta is given', () => {
    render(<StatusBadge channel="piloto" seal={{ status: 'test', semanticVersion: '0.3.0' }} />, { wrapper });
    expect(screen.getByRole('status')).toHaveTextContent('canal: piloto');
  });

  it('throws outside the editor when no seal is given (unchanged contract)', () => {
    expect(() => render(<StatusBadge />, { wrapper })).toThrow(/useDiagram/);
  });
});
