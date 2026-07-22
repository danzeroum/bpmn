import type { Messages } from '../messages.js';

/** Squad Lane SL-13 — readiness badge strings (EN + PT-BR). The four derived
 * states plus the two host-informed runtime states. */
export const readiness: { en: Messages; ptBR: Messages } = {
  en: {
    'readiness.aria': 'Readiness: {state}',
    'readiness.rascunho': 'Draft',
    'readiness.validado': 'Validated',
    'readiness.simulado-com-evidencia': 'Simulated · evidence',
    'readiness.apto-para-integracao': 'Ready for integration',
    'readiness.executando': 'Running (host)',
    'readiness.erro-de-integracao': 'Integration error (host)',
  },
  ptBR: {
    'readiness.aria': 'Prontidão: {state}',
    'readiness.rascunho': 'Rascunho',
    'readiness.validado': 'Validado',
    'readiness.simulado-com-evidencia': 'Simulado · evidência',
    'readiness.apto-para-integracao': 'Apto para integração',
    'readiness.executando': 'Executando (host)',
    'readiness.erro-de-integracao': 'Erro de integração (host)',
  },
};
