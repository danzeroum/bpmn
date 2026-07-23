# @buildtovalue/engine

## 1.1.0-next.3

### Minor Changes

- 2c9e2b4: AG-2.2 etapa 4 — fronteira do `agentTask` (ADENDO-02 D27) + proveniência verificada (D30).

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

## 1.1.0-next.2

### Patch Changes

- b0075ff: ENGINE_VERSION agora é derivada do package.json no build (scripts/sync-version.mjs gera src/version.ts; version-packages re-sincroniza; teste de sincronia trava deriva). Corrige a divergência constante (1.1.0-next.0) × pacote publicado (1.1.0-next.1) — a versão gravada por instância é a que replay (D6) e StateMigrator (D14) usam.

## 1.1.0-next.1

### Patch Changes

- Updated dependencies [0627ee6]
- Updated dependencies [a99b6f9]
- Updated dependencies [cbe56a7]
- Updated dependencies [b9b625a]
- Updated dependencies [e04c719]
- Updated dependencies [2dc3518]
- Updated dependencies [6d7f410]
- Updated dependencies [56fe142]
- Updated dependencies [40d6efd]
- Updated dependencies [8825d62]
- Updated dependencies [24c4684]
- Updated dependencies [47d0de8]
- Updated dependencies [dc29b38]
- Updated dependencies [031c379]
  - @buildtovalue/core@1.2.0-next.0
