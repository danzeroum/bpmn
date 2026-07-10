import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider, LedgerStatus, PT_BR, type LedgerVerificationReport } from '../src/index.js';

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider messages={PT_BR}>{children}</I18nProvider>
);

const intact: LedgerVerificationReport = {
  intact: true,
  entries: 7,
  verifiedAt: '2026-07-08T12:00:00.000Z',
};

const broken: LedgerVerificationReport = {
  intact: false,
  entries: 7,
  firstBreak: { index: 3, expected: 'a'.repeat(64), actual: 'b'.repeat(64) },
  verifiedAt: '2026-07-08T12:00:00.000Z',
};

describe('LedgerStatus (Handoff 4 §B1 — the chip stops being decorative)', () => {
  it('runs the verifier on click and reports an intact chain', async () => {
    render(<LedgerStatus verify={() => intact} />, { wrapper });
    const chip = screen.getByRole('button', { name: 'Verificar ledger' });
    expect(chip).toHaveTextContent('ledger · verificar');

    fireEvent.click(chip);
    await waitFor(() => expect(chip).toHaveTextContent('ledger íntegro ✓'));
    const popover = screen.getByRole('status');
    expect(popover).toHaveTextContent('Cadeia íntegra ✓');
    expect(popover).toHaveTextContent('7 entradas reverificadas.');

    fireEvent.click(screen.getByRole('button', { name: 'Fechar relatório' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reports the exact break point with expected vs found hashes', async () => {
    render(<LedgerStatus verify={() => Promise.resolve(broken)} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar ledger' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Verificar ledger' })).toHaveTextContent(
        'ledger quebrado ✗',
      ),
    );
    const popover = screen.getByRole('status');
    expect(popover).toHaveTextContent('entrada #3 de 7');
    expect(popover).toHaveTextContent('aaaaaaaaaaaa…');
    expect(popover).toHaveTextContent('bbbbbbbbbbbb…');
  });
});
