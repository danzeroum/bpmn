import type { Messages } from '../messages.js';

/**
 * Ledger status dictionary fragment (Handoff 11 N-6). Holds both official
 * dictionaries for the ledger verification chip and its report popover side by
 * side; `en.ts` / `ptBR.ts` spread the fragments into the flat lookup tables.
 * Keys are namespaced by surface (`ledgerStatus.*`); plural pairs use
 * `_one` / `_other`. Trailing verdict glyphs (`✓` / `✗`) stay literal in JSX.
 */
export const ledgerStatus: { en: Messages; ptBR: Messages } = {
  en: {
    'ledgerStatus.verify.aria': 'Verify ledger',
    'ledgerStatus.button.idle': 'ledger · verify',
    'ledgerStatus.button.intact': 'ledger intact',
    'ledgerStatus.button.broken': 'ledger broken',
    'ledgerStatus.chainIntact': 'Chain intact',
    'ledgerStatus.entriesReverified_one': '{count} entry reverified.',
    'ledgerStatus.entriesReverified_other': '{count} entries reverified.',
    'ledgerStatus.tamperDetected': 'Tampering detected',
    'ledgerStatus.entryOfTotal': 'entry #{index} of {total}.',
    'ledgerStatus.expected': 'expected',
    'ledgerStatus.found': 'found',
    'ledgerStatus.verifiedAt': 'verified at {time}',
    'ledgerStatus.close.aria': 'Close report',
  },
  ptBR: {
    'ledgerStatus.verify.aria': 'Verificar ledger',
    'ledgerStatus.button.idle': 'ledger · verificar',
    'ledgerStatus.button.intact': 'ledger íntegro',
    'ledgerStatus.button.broken': 'ledger quebrado',
    'ledgerStatus.chainIntact': 'Cadeia íntegra',
    'ledgerStatus.entriesReverified_one': '{count} entrada reverificada.',
    'ledgerStatus.entriesReverified_other': '{count} entradas reverificadas.',
    'ledgerStatus.tamperDetected': 'Adulteração detectada',
    'ledgerStatus.entryOfTotal': 'entrada #{index} de {total}.',
    'ledgerStatus.expected': 'esperado',
    'ledgerStatus.found': 'encontrado',
    'ledgerStatus.verifiedAt': 'verificado em {time}',
    'ledgerStatus.close.aria': 'Fechar relatório',
  },
};
