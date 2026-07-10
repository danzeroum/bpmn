import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnchorSeal, I18nProvider, PT_BR } from '../src/index.js';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider messages={PT_BR}>{children}</I18nProvider>
);

/** The 4 anchor states (Handoff 8 §4.2), icon + label, retry on pending. */
describe('AnchorSeal', () => {
  it('anchored: green pill with adapter + head', () => {
    const { container } = render(
      <AnchorSeal state="anchored" adapterId="git" head="abcdef0123456789" />,
      { wrapper },
    );
    const seal = container.querySelector('.bpmnr-anchor-seal')!;
    expect(seal.getAttribute('data-anchor')).toBe('anchored');
    expect(seal).toHaveTextContent('✓');
    expect(seal).toHaveTextContent('ANCORADA');
    expect(seal).toHaveTextContent('ancorado: git · head #abcdef01');
  });

  it('pending: declares the guarantee in force and offers retry (§1.3)', () => {
    const onRetry = vi.fn();
    render(<AnchorSeal state="pending" onRetry={onRetry} />, { wrapper });
    expect(screen.getByText('PENDENTE')).toBeInTheDocument();
    expect(
      screen.getByText('garantia vigente: assinaturas + hash-chain local'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '↻ Retentar ancoragem' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('pending: retry button disabled while retrying', () => {
    render(<AnchorSeal state="pending" onRetry={() => {}} retrying />, { wrapper });
    expect(screen.getByRole('button', { name: 'retentando…' })).toBeDisabled();
  });

  it('none: neutral "sem âncora configurada" (never simulates proof, §1.4)', () => {
    const { container } = render(<AnchorSeal state="none" />, { wrapper });
    expect(container.querySelector('.bpmnr-anchor-seal')?.getAttribute('data-anchor')).toBe('none');
    expect(screen.getByText('SEM ÂNCORA CONFIGURADA')).toBeInTheDocument();
  });

  it('broken: error pill with local ≠ anchored heads', () => {
    const { container } = render(
      <AnchorSeal state="broken" head="1111aaaa2222" anchoredHead="3333bbbb4444" />,
      { wrapper },
    );
    const seal = container.querySelector('.bpmnr-anchor-seal')!;
    expect(seal.getAttribute('data-anchor')).toBe('broken');
    expect(seal).toHaveTextContent('CADEIA ≠ ÂNCORA');
    expect(seal).toHaveTextContent('local #1111aaaa ≠ ancorado #3333bbbb');
  });
});
