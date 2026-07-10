import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, PT_BR, SignatureBadge } from '../src/index.js';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider messages={PT_BR}>{children}</I18nProvider>
);

/**
 * The identity badge (Handoff 8 §4.1) — three states, each with an icon glyph
 * AND a text label (state never by color alone), colors keyed by
 * `data-verification` in styles.css.
 */
describe('SignatureBadge', () => {
  it('renders the verified state with signer and fingerprint', () => {
    const { container } = render(
      <SignatureBadge
        state="valid"
        signer={{ subject: 'marta@x', role: 'compliance', publicKeyFingerprint: 'ed25519:fp' }}
        signatureFingerprint="ed25519:#0b9a…f21c"
      />,
      { wrapper },
    );
    const badge = container.querySelector('.bpmnr-signature-badge')!;
    expect(badge.getAttribute('data-verification')).toBe('valid');
    expect(badge).toHaveTextContent('✓');
    expect(badge).toHaveTextContent('ASSINADA · VERIFICADA');
    expect(badge).toHaveTextContent('marta@x · compliance');
    expect(badge).toHaveTextContent('ed25519:#0b9a…f21c');
    // Accessible label, not color-only.
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Assinatura: ASSINADA · VERIFICADA',
    );
  });

  it('renders the legacy (unsigned) state in amber', () => {
    const { container } = render(<SignatureBadge state="legacy" />, { wrapper });
    const badge = container.querySelector('.bpmnr-signature-badge')!;
    expect(badge.getAttribute('data-verification')).toBe('legacy');
    expect(badge).toHaveTextContent('◌');
    expect(badge).toHaveTextContent('NÃO ASSINADA (LEGADO)');
  });

  it('renders the invalid state with the expected × obtained hashes', () => {
    const { container } = render(
      <SignatureBadge state="invalid" expected="ed25519:#0b9a…f21c" obtained="outro hash" />,
      { wrapper },
    );
    const badge = container.querySelector('.bpmnr-signature-badge')!;
    expect(badge.getAttribute('data-verification')).toBe('invalid');
    expect(badge).toHaveTextContent('✕');
    expect(badge).toHaveTextContent('ASSINATURA INVÁLIDA');
    expect(badge).toHaveTextContent('esperado ed25519:#0b9a…f21c · payload atual produz outro hash');
  });

  it('does not render a fingerprint for non-valid states', () => {
    const { container } = render(
      <SignatureBadge state="legacy" signatureFingerprint="should-not-show" />,
      { wrapper },
    );
    expect(container.querySelector('.bpmnr-signature-fingerprint')).toBeNull();
  });
});
