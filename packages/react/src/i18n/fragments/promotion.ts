import type { Messages } from '../messages.js';

/**
 * Promotion-panel dictionary fragment (Handoff 11 N-6). Holds both official
 * dictionaries for the formal promotion flow side by side; `en.ts` / `ptBR.ts`
 * spread the fragments into the flat lookup tables. Keys are namespaced by
 * surface (`promotion.*`); plural pairs use `_one` / `_other`.
 */
export const promotion: { en: Messages; ptBR: Messages } = {
  en: {
    'promotion.activate': 'Activate v{version}',
    'promotion.kicker.mode': 'FORMAL PROMOTION',
    'promotion.kicker.engine': 'CORE STATE MACHINE',
    'promotion.pendingGates': 'verifying gates…',
    'promotion.changeSummary.aria': 'change_summary',
    'promotion.changeSummary.placeholder_one': 'Describe the change (min. {count} character)',
    'promotion.changeSummary.placeholder_other': 'Describe the change (min. {count} characters)',
    'promotion.suggestSummary': 'Suggest summary',
    'promotion.approver.approved': '{label} approved',
    'promotion.approver.sign': 'Sign approval as {label}',
    'promotion.approver.approve': 'Approve as {label}',
    'promotion.soundness.label': 'Soundness',
    'promotion.soundness.errors_one': '{count} error',
    'promotion.soundness.errors_other': '{count} errors',
    'promotion.soundness.showOnCanvas': 'view on canvas',
    'promotion.coverage.label': 'Path coverage',
    'promotion.coverage.min': 'min {pct}%',
    'promotion.coverage.exercised': '{pct}% exercised',
    'promotion.coverage.noScenarios': 'no scenario recorded for this version',
    'promotion.diff.title': 'Diff vs baseline',
    'promotion.warning.prefix': 'On activation:',
    'promotion.warning.deprecates': 'v{version} becomes Deprecated (effective_until = today)',
    'promotion.warning.runsPinned_one': '{count} in-progress run stays pinned to v{version}',
    'promotion.warning.runsPinned_other': '{count} in-progress runs stay pinned to v{version}',
    'promotion.warning.runsUnpinned': 'in-progress runs stay pinned to v{version}',
    'promotion.warning.runsNoActive':
      'in-progress runs stay pinned to the versions they were born on',
    'promotion.warning.ledger': 'promotion recorded in the hash-chained ledger.',
    'promotion.cancel': 'Cancel',
    'promotion.toast.activated': 'v{version} active',
    'promotion.toast.deprecated': 'deprecated',
    'promotion.toast.ledger': 'ledger #{hash} recorded',
  },
  ptBR: {
    'promotion.activate': 'Ativar v{version}',
    'promotion.kicker.mode': 'PROMOÇÃO FORMAL',
    'promotion.kicker.engine': 'STATE MACHINE DO CORE',
    'promotion.pendingGates': 'verificando gates…',
    'promotion.changeSummary.aria': 'change_summary',
    'promotion.changeSummary.placeholder_one': 'Descreva a mudança (mín. {count} caractere)',
    'promotion.changeSummary.placeholder_other': 'Descreva a mudança (mín. {count} caracteres)',
    'promotion.suggestSummary': 'Sugerir resumo',
    'promotion.approver.approved': '{label} aprovou',
    'promotion.approver.sign': 'Assinar aprovação como {label}',
    'promotion.approver.approve': 'Aprovar como {label}',
    'promotion.soundness.label': 'Soundness',
    'promotion.soundness.errors_one': '{count} erro',
    'promotion.soundness.errors_other': '{count} erros',
    'promotion.soundness.showOnCanvas': 'ver no canvas',
    'promotion.coverage.label': 'Cobertura de caminhos',
    'promotion.coverage.min': 'mín {pct}%',
    'promotion.coverage.exercised': '{pct}% exercitado',
    'promotion.coverage.noScenarios': 'nenhum roteiro registrado para esta versão',
    'promotion.diff.title': 'Diff vs. baseline',
    'promotion.warning.prefix': 'Ao ativar:',
    'promotion.warning.deprecates': 'v{version} passa a Descontinuada (effective_until = hoje)',
    'promotion.warning.runsPinned_one':
      '{count} execução em andamento permanece presa à v{version}',
    'promotion.warning.runsPinned_other':
      '{count} execuções em andamento permanecem presas à v{version}',
    'promotion.warning.runsUnpinned': 'execuções em andamento permanecem presas à v{version}',
    'promotion.warning.runsNoActive':
      'execuções em andamento permanecem presas às versões em que nasceram',
    'promotion.warning.ledger': 'promoção gravada no ledger hash-chained.',
    'promotion.cancel': 'Cancelar',
    'promotion.toast.activated': 'v{version} ativa',
    'promotion.toast.deprecated': 'descontinuada',
    'promotion.toast.ledger': 'ledger #{hash} gravado',
  },
};
