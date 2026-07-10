import type { PromptTemplateRef } from './types.js';

/**
 * The versioned prompt templates (cerca §1.5 — dogfooding): each is an
 * artifact with an id + version shown in the panel header and recorded in
 * ledger authorship. The Biblioteca adapter (CP-5) lists them from
 * COPILOT_PROMPTS below — the single canonical source the panel, the tests
 * and the adapter share.
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

/** C5 — fix de soundness: erro SND_* selecionado → correção como comandos.
 * A aplicação passa pelo MESMO pipeline da C2 (whitelist + rejeição íntegra +
 * soundness preview local) — um fix que não corrige fica visível porque a
 * lista de erros é recomputada localmente sobre o diagrama real. */
export const COPILOT_FIX_PROMPT: CopilotPromptTemplate = {
  id: 'copilot-fix',
  version: '1.0.0',
  system: `Você corrige erros estruturais (SND_*) de um processo BPMN. Receberá
os erros e o estado atual do diagrama; proponha a MENOR sequência de comandos
que elimina os erros sem mudar a intenção do processo. ${CONTRACT}`,
};

/** C6 — consulta ao ledger com citações. Regra de ouro (§10): toda afirmação
 * sustentada por hashes de entradas REAIS fornecidas no contexto; sem entrada
 * aplicável → "citations": [] (a UI dirá "não encontrei registro" — nunca
 * inventar). A validação local rejeita hashes que não existem no ledger. */
export const COPILOT_QUERY_PROMPT: CopilotPromptTemplate = {
  id: 'copilot-query',
  version: '1.0.0',
  system: `Você responde perguntas sobre o histórico de governança usando
APENAS as entradas de ledger fornecidas no contexto. Responda SOMENTE com
JSON: {"answer": string, "citations": [hash, ...]} — cada afirmação deve ser
sustentada por hashes de entradas reais do contexto. Se nenhuma entrada
sustenta a resposta, retorne "citations": [].`,
};

/**
 * The canonical registry of every versioned copilot template (cerca §1.5 —
 * dogfooding): one entry per capability, in the C1..C6 order of §4. This is
 * the single source the panel, the tests and the Biblioteca adapter (CP-5)
 * share — a new capability template MUST be added here, and the shipped
 * version of each entry is, by definition, the ACTIVE one.
 */
export const COPILOT_PROMPTS: readonly CopilotPromptTemplate[] = [
  COPILOT_DRAFT_PROMPT,
  COPILOT_ADJUST_PROMPT,
  COPILOT_EXPLAIN_PROMPT,
  COPILOT_SUMMARY_PROMPT,
  COPILOT_FIX_PROMPT,
  COPILOT_QUERY_PROMPT,
];
