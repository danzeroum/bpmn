import type { Messages } from '../messages.js';

/**
 * Lint panel dictionary fragment (Handoff 14 §1d). Both official dictionaries
 * side by side; `en.ts` / `ptBR.ts` spread each side into the flat lookup
 * tables. Decorative glyphs (✦ ⚠ ● ✕) stay literal in the JSX.
 */
export const lint: { en: Messages; ptBR: Messages } = {
  en: {
    'lint.title': 'Problems',
    'lint.toggleAria': 'Open problems panel',
    'lint.errors_one': '{count} error',
    'lint.errors_other': '{count} errors',
    'lint.warnings_one': '{count} warning',
    'lint.warnings_other': '{count} warnings',
    'lint.policy': 'policy:',
    'lint.active': 'ACTIVE',
    'lint.fix': 'fix',
    'lint.fixAll': 'Fix all ({count})',
    'lint.suggest': 'suggest fix',
    'lint.close': 'Close problems panel',
    'lint.resizeAria': 'Resize problems panel',
    'lint.empty': 'No problems found',
    'lint.sourceEtiquette': 'etiquette',
    'lint.sourceEngine': 'engine',
    'lint.invalidProposal': 'Invalid proposal: {error}',
    'lint.rejectedProposal': 'Proposal rejected in full — nothing was applied',
  },
  ptBR: {
    'lint.title': 'Problemas',
    'lint.toggleAria': 'Abrir painel de problemas',
    'lint.errors_one': '{count} erro',
    'lint.errors_other': '{count} erros',
    'lint.warnings_one': '{count} aviso',
    'lint.warnings_other': '{count} avisos',
    'lint.policy': 'política:',
    'lint.active': 'VIGENTE',
    'lint.fix': 'corrigir',
    'lint.fixAll': 'Corrigir todos ({count})',
    'lint.suggest': 'sugerir correção',
    'lint.close': 'Fechar painel de problemas',
    'lint.resizeAria': 'Redimensionar painel de problemas',
    'lint.empty': 'Nenhum problema encontrado',
    'lint.sourceEtiquette': 'etiqueta',
    'lint.sourceEngine': 'engine',
    'lint.invalidProposal': 'Proposta inválida: {error}',
    'lint.rejectedProposal': 'Proposta rejeitada por inteiro — nada foi aplicado',
  },
};
