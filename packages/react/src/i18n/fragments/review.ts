import type { Messages } from '../messages.js';

/**
 * Review-diff dictionary fragment (Handoff 15 §2a). Both official
 * dictionaries side by side; `en.ts` / `ptBR.ts` spread each side into the
 * flat lookup tables. The notation codes (+ADD, −REM, →MOV, ΔN, ↷ROTA) stay
 * literal in the JSX — they are spec glyph codes, not prose.
 */
export const review: { en: Messages; ptBR: Messages } = {
  en: {
    'review.legend.added': 'added',
    'review.legend.removed': 'removed',
    'review.legend.moved': 'moved',
    'review.legend.changed': 'changed',
    'review.legend.rerouted': 'routes',
    'review.legend.total_one': '{count} change',
    'review.legend.total_other': '{count} changes',
    'review.badge.aria_one': '{count} property changed — open details',
    'review.badge.aria_other': '{count} properties changed — open details',
    'review.popover.aria': 'Property changes, before and after',
    'review.popover.close': 'Close change details',
  },
  ptBR: {
    'review.legend.added': 'adicionados',
    'review.legend.removed': 'removidos',
    'review.legend.moved': 'movidos',
    'review.legend.changed': 'alterados',
    'review.legend.rerouted': 'rotas',
    'review.legend.total_one': '{count} mudança',
    'review.legend.total_other': '{count} mudanças',
    'review.badge.aria_one': '{count} propriedade alterada — abrir detalhes',
    'review.badge.aria_other': '{count} propriedades alteradas — abrir detalhes',
    'review.popover.aria': 'Mudanças de propriedades, antes e depois',
    'review.popover.close': 'Fechar detalhes da mudança',
  },
};
