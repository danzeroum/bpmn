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
    // #150 — aplicar ≠ aprovar made visible: the three card states. Copy for
    // applying NEVER says "accept/approve"; the green pill belongs to the
    // host's lifecycle alone.
    'copilot.proposal.pill': 'PROPOSAL',
    'copilot.proposal.summary_one': '{count} proposed edit',
    'copilot.proposal.summary_other': '{count} proposed edits',
    'copilot.soundnessPreview': 'soundness: {errors} errors · {warnings} warnings',
    'copilot.proposal.apply': 'Apply to draft',
    'copilot.proposal.discard': 'Discard',
    'copilot.proposal.discarded': 'Discarded — nothing was applied.',
    'copilot.applied.pill': 'APPLIED · NOT APPROVED',
    'copilot.applied.banner':
      'Applied to the draft — it went through the same validation as any edit; approval is a separate action.',
    'copilot.applied.undo': 'Undo',
    'copilot.applied.viewDiff': 'View diff',
    'copilot.applied.submitApproval': 'Send for approval',
    'copilot.approved.pill': 'APPROVED',
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
    'copilot.proposal.pill': 'PROPOSTA',
    'copilot.proposal.summary_one': '{count} edição proposta',
    'copilot.proposal.summary_other': '{count} edições propostas',
    'copilot.soundnessPreview': 'soundness: {errors} erros · {warnings} avisos',
    'copilot.proposal.apply': 'Aplicar no rascunho',
    'copilot.proposal.discard': 'Descartar',
    'copilot.proposal.discarded': 'Descartada — nada foi aplicado.',
    'copilot.applied.pill': 'APLICADA · NÃO APROVADA',
    'copilot.applied.banner':
      'Aplicada no rascunho — passou pela mesma validação de qualquer edição; aprovação é ação separada.',
    'copilot.applied.undo': 'Desfazer',
    'copilot.applied.viewDiff': 'Ver diff',
    'copilot.applied.submitApproval': 'Enviar p/ aprovação',
    'copilot.approved.pill': 'APROVADA',
  },
};
