import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanonicalPayloadCard } from '../src/index.js';

/**
 * The "what you sign" card (Handoff 8 §4.3) — renders the canonical payload
 * BEFORE signing so the user sees exactly what the signature covers.
 */
describe('CanonicalPayloadCard', () => {
  it('shows diagram, version, short hashes and the decision', () => {
    render(
      <CanonicalPayloadCard
        payload={{
          diagramId: 'onboarding',
          version: '2.1.0',
          xmlHash: 'abcdef0123456789',
          ledgerHead: 'fedcba9876543210',
          decision: 'approve',
          role: 'compliance',
        }}
      />,
    );
    const card = screen.getByTestId('canonical-payload');
    expect(card).toHaveTextContent('O QUE VOCÊ ESTÁ ASSINANDO (PAYLOAD CANÔNICO)');
    expect(card).toHaveTextContent('diagrama: onboarding · versão: 2.1.0');
    expect(card).toHaveTextContent('xmlHash: #abcdef… · ledgerHead: #fedcba…');
    expect(card).toHaveTextContent('decisão: APPROVE (papel compliance)');
  });

  it('renders ∅ when there is no ledger head yet', () => {
    render(
      <CanonicalPayloadCard
        payload={{
          diagramId: 'd',
          version: '1.0.0',
          xmlHash: 'aaaaaaaa',
          ledgerHead: '',
          decision: 'approve',
          role: 'ops',
        }}
      />,
    );
    expect(screen.getByTestId('canonical-payload')).toHaveTextContent('ledgerHead: ∅');
  });
});
