import type { PromptTemplateRef } from './types.js';

/**
 * The versioned prompt templates for C1/C2 (cerca §1.5 — dogfooding): each is
 * an artifact with an id + version shown in the panel header and recorded in
 * ledger authorship. The full Biblioteca adapter lands in CP-5; the constants
 * here are the single source the panel and the adapter share.
 */
export interface CopilotPromptTemplate extends PromptTemplateRef {
  /** System prompt sent to the provider. */
  system: string;
}

const CONTRACT = `Responda APENAS com JSON: {"commands": [{"type", "params"}...],
"rationale": string, "promptTemplateRef": {"id", "version"}}.
Comandos permitidos (whitelist): addNode, addEdge, updateNode, updateEdge,
moveNode, removeNode, removeEdge. Node params: id, type (BPMN: startEvent,
task, userTask, serviceTask, businessRuleTask, exclusiveGateway,
parallelGateway, endEvent...), label, x, y, properties?. Edge params: id,
sourceId, targetId, label?, purpose?. Propostas com comandos fora da
whitelist são rejeitadas por inteiro.`;

/** C1 — texto → rascunho. */
export const COPILOT_DRAFT_PROMPT: CopilotPromptTemplate = {
  id: 'copilot-draft',
  version: '1.0.0',
  system: `Você rascunha processos BPMN a partir de descrições em linguagem
natural. Gere um processo completo (start → ... → end), com gateways para
decisões e labels claros em português. ${CONTRACT}`,
};

/** C2 — ajuste conversacional sobre o rascunho existente. */
export const COPILOT_ADJUST_PROMPT: CopilotPromptTemplate = {
  id: 'copilot-adjust',
  version: '1.0.0',
  system: `Você propõe AJUSTES INCREMENTAIS a um processo BPMN existente
(o estado atual segue na conversa). Proponha apenas os comandos necessários
para a mudança pedida; ids novos não podem colidir. ${CONTRACT}`,
};

/** C3 — explicar (read-only ABSOLUTO: sem comandos, sem ledger — a única
 * capacidade sem trilha, por design). Resposta em texto puro. */
export const COPILOT_EXPLAIN_PROMPT: CopilotPromptTemplate = {
  id: 'copilot-explain',
  version: '1.0.0',
  system: `Você explica processos BPMN em linguagem natural para um aprovador.
Receberá o estado do diagrama (e diff quando houver). Responda em TEXTO PURO
(sem JSON), em português, objetivo: o que o processo faz, decisões, riscos.`,
};

/** C4 — change_summary proposto a partir do diff REAL; o humano edita e
 * assina — a IA nunca submete. Resposta em texto puro. */
export const COPILOT_SUMMARY_PROMPT: CopilotPromptTemplate = {
  id: 'copilot-summary',
  version: '1.0.0',
  system: `Você redige o change_summary de uma promoção de versão a partir do
diff real fornecido. Responda em TEXTO PURO (sem JSON), 1-3 frases em
português, factual — apenas o que mudou.`,
};
