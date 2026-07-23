---
'@buildtovalue/engine': minor
'@buildtovalue/agentflow': minor
---

AG-2.2 etapa 4 — fronteira do `agentTask` (ADENDO-02 D27) + proveniência verificada (D30).

**engine:** `agentTask` passa a ser tratado como uma ESPERA determinística (espelho
do `serviceTask`): ao ser alcançado, emite `CreateJob{ jobType: 'agent' }` com
`payload { elementId, agentRef }` (a ref DECLARADA no BPMN — o host substitui pelo
pin efetivo), o token pausa, e `JobCompleted` retoma o avanço. O INTERIOR do agente
(o walk LLM/tool/decision) roda no host, FORA do caminho determinístico — nunca entra
no engine nem no corpus de replay. Só o RESULTADO (variáveis via `JobCompleted`, D13)
volta. Corpus de replay ganha o cenário do avanço ao redor (byte-idêntico) e um lint
(aceite 7) que FALHA se qualquer fixture contiver interior de agente — a invariante
D27 verificada pelos dois lados. `agentTask` sem `agentWorkflowRef` → incidente
estrutural (o lint de deploy deveria barrar antes).

**agentflow:** `FactSource` ganha a terceira rung `'evidencia-verificada'` (D30). O
tipo carrega o rótulo para a trilha do host gravar; `simulate`/`simulateSquad` NUNCA
o emitem — um mock determinístico não verifica realidade, então a evidência verificada
é exclusiva do runtime real. Teste do aceite: mesmo com todos os papéis declarados como
evidência, o simulador nunca produz o rótulo verificado.
