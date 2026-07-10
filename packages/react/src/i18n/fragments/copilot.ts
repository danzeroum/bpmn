import type { Messages } from '../messages.js';

/**
 * Copilot dictionary fragment (Handoff 11 N-6). Holds both official
 * dictionaries side by side for the AI copilot panel; `en.ts` / `ptBR.ts`
 * spread each side into the flat lookup tables. Keys are namespaced by surface
 * (`copilot.*`); plural pairs use `_one` / `_other`. Decorative symbols
 * (✦ ◌ ⚠) stay literal in the JSX and are not part of these strings.
 */
export const copilot: { en: Messages; ptBR: Messages } = {
  en: {
    'copilot.title': 'Copilot',
    'copilot.promptLabel': 'prompt:',
    'copilot.pill': 'DRAFT ONLY',
    'copilot.sealDraft': 'DRAFT',
    'copilot.sealAuthorship': 'authorship:',
    'copilot.soundness': 'Soundness',
    'copilot.soundnessCount_one': '{count} error',
    'copilot.soundnessCount_other': '{count} errors',
    'copilot.suggestFix': 'Suggest fix',
    'copilot.generate': 'Generate process draft',
    'copilot.adjust': 'Request adjustment',
    'copilot.inputAria': 'Request to the copilot',
    'copilot.placeholderProcess': 'Describe the process…',
    'copilot.placeholderAdjust': 'Describe the adjustment…',
    'copilot.undoAll': 'Undo all',
  },
  ptBR: {
    'copilot.title': 'Copiloto',
    'copilot.promptLabel': 'prompt:',
    'copilot.pill': 'SÓ RASCUNHA',
    'copilot.sealDraft': 'RASCUNHO',
    'copilot.sealAuthorship': 'autoria:',
    'copilot.soundness': 'Soundness',
    'copilot.soundnessCount_one': '{count} erro',
    'copilot.soundnessCount_other': '{count} erros',
    'copilot.suggestFix': 'Sugerir correção',
    'copilot.generate': 'Gerar rascunho do processo',
    'copilot.adjust': 'Pedir ajuste',
    'copilot.inputAria': 'Pedido ao copiloto',
    'copilot.placeholderProcess': 'Descreva o processo…',
    'copilot.placeholderAdjust': 'Descreva o ajuste…',
    'copilot.undoAll': 'Desfazer tudo',
  },
};
