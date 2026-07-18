# E-0 — Reconciliação do Handoff 16 contra a main

> Estado: **AGUARDA VALIDAÇÃO DO OWNER**. Nenhum código de feature antes dela.
> Base: main `56fe142` (pós-merge do passthrough #119 — o pré-requisito declarado).

## 3a — Definições nomeadas de primeira classe

| Item da spec | Estado | Evidência na main |
|---|---|---|
| Event definitions tipados (8 kinds) | ✅ | `EVENT_DEFINITION_KINDS` (core/model/types.ts); export `<bpmn:{kind}EventDefinition/>` (elementSerializer); import do kind (`readEventDefinition`, elementDeserializer); paleta já cria variantes tipadas (paletteItems: timerEvent/messageEvent) |
| `diagram.definitions.{messages,signals,errors}[]` | ⬜ | `BpmnDiagram` não tem o campo; `messageRef/signalRef/errorRef` = zero ocorrências em todo o core (grep) |
| Root elements OMG no import/export | ⬜ | `fromXml` visita só `process` + `collaboration`; `<bpmn:message>` root de definitions é ignorado **em silêncio** (⚠ ver conflito 1); `messageRef` no child eventDefinition idem (`readEventDefinition` lê só o kind) |
| Comandos undoáveis (criar/rename cascata = 1 undo/excluir bloqueado) | ⬜ novo sobre ✅ fundação | `compositeCommand` = 1 undo atômico (padrão Delete/Paste); veto por regra com mensagem = padrão do rule engine; comandos de DEFINIÇÃO são novos |
| Byte-estabilidade + neutralidade de hash | ✅ padrão pronto | Molde da #119: campo opcional ausente ⇒ bytes idênticos; fixture congelada (`passthroughFrozen.json`) é o critério a replicar |
| Corpus real com `messageRef` | ✅ material pronto | corpus-external tem `<semantic:messageEventDefinition messageRef="…"/>` em arquivos reais (OMG/Trisotech) |
| Matriz CONFORMANCE promovível | ✅ | Gerador `conformance/src/render.ts` + gate de frescor (matrix.test) — promover é editar a fonte |

## 3b — Refs governadas cross-model

| Item | Estado | Evidência |
|---|---|---|
| Padrão `nome@semver` + resolução + codes estáveis | ✅ | `resolveCallActivities` (registry/callActivity.ts, code `CALL_REF_MISSING`); agentflow `ref.ts` (`agnt-rsch@2.1.0`, forma canônica id@semver); `agentReferenceCurrencyWarnings` (adapters) = o warning de vigência |
| Contrato de resolução INJETADO | ✅ | Moldes AIProvider/AnchorAdapter/EngineBridge/ReviewStore; agentGovernance documenta que o pacote nunca consulta registry |
| Chip + selo de vigência no canvas | ⚠ parcial | `CallActivityShape` já mostra footer mono com binding injetado (`calledElementLabel`, ex. "Billing@4.2.0") e o estado quebrado é pintado pelo overlay de issues — o chip/selo de EVENTO é novo, mas o molde visual e o overlay existem |
| `SIG_REF_MISSING` badge+código | ⬜ novo | Molde: CALL_REF_MISSING (issueBadges + código estável) |
| Adapter de definições na Biblioteca | ✅ molde | `lintProfileAdapter`/`copilotPromptAdapter` (artefato versionado headless) |
| Troca de ref = comando + ledger | ✅ molde | `updateNodeCommand` + builders de ledger (reviewLedger/anchorRecordedEntry — host appends) |

## 3c — I/O de eventos na aba Execução

| Item | Estado | Evidência |
|---|---|---|
| Aba Execução gated + progressive disclosure | ✅ | PropertiesPanel: `showTabs = engine !== null && executable` (U-6); deploy gate VIGENTE+assinada |
| Props de I/O de eventos + assimetria throw/catch | ⬜ novo | Nenhuma prop de evento na aba hoje (o panel nem edita eventDefinition — o kind vem da paleta) |
| Lossless via passthrough | ✅ | #119 mergeada: `foreignExtensions` round-tripam byte-estáveis — pré-requisito cumprido |

## 3d — Lint EVT_*/TIMER_* + parser ISO 8601 + editor de timer

| Item | Estado | Evidência |
|---|---|---|
| Perfil lint + `fix(ctx)→command` + "corrigir todos" 1 composto | ✅ | U-5: códigos estáveis (`EXEC_*`, `LINT_*`), quick-fix undoável, dock existente — ZERO UI nova, como a spec pede |
| Regras EVT_*/TIMER_* | ⬜ novas | Perfil aceita regras novas por construção |
| Parser ISO 8601 headless | ⬜ | Zero parsing de duração/ciclo no core (grep P1M/duration) |
| Editor de timer + preview humano | ⬜ | Não existe NENHUMA edição de timer hoje — nem a prop da expressão (⚠ ver conflito 2) |

## 3e — Matching honesto no simulador

| Item | Estado | Evidência |
|---|---|---|
| Paradas honestas + `BlockedDecision` | ✅ | simulation/engine.ts (`BlockedDecision`, "DECLARED stop, never a guess") |
| Boundary por decisão do usuário | ✅ | `boundaryOptions` + `fireBoundary` — o simulador JÁ dispara boundary como decisão explícita; matching por `errorRef` é a novidade |
| limitations.md | ✅ | docs/limitations.md existe (disciplina H7/H9) |

## Conflitos / decisões para o owner (antes da E-1)

1. **"Deixa de ser warning" — hoje o descarte é SILENCIOSO.** Root elements `bpmn:message/signal/error` e o atributo `messageRef` são perdidos sem warning nenhum na main (o import nem os visita). Proposta: cumprir o aceite por PRESERVAÇÃO REAL (roots → `diagram.definitions`; `*Ref` → prop do nó), e o warning só nasce para o caso NOVO de ref órfã (ver 2 abaixo). O texto do aceite §5 fica satisfeito: importa sem warning porque nada é descartado.
2. **Ref órfã no import** (`messageRef="X"` sem root `<bpmn:message id="X">`): proposta — sintetizar a definição (`id=X, name=X`) para não perder a ligação, MAIS um warning informativo nomeando o ref sintetizado. Alternativa: sintetizar em silêncio. Preciso da sua escolha.
3. **Campos do timer são OMG também**: a expressão do timer exporta como filhos padrão `bpmn:timeDate/timeDuration/timeCycle` (cerca §1.1) — hoje nem a prop existe. Proposta: prop canônica `properties.timer = { kind: 'date' | 'duration' | 'cycle', expression }`, com converter (export/import dos filhos OMG) entrando na **E-5** junto do parser/editor — a E-1 NÃO toca timer (a ordem §4 já isola core+lint+react na E-5). Confirmar o sequenciamento.
4. **Interação com o fora-de-escopo da #119**: lá registramos "filhos estrangeiros de `definitions` fora do processo" como não preservados. Os roots OMG `message/signal/error` NÃO são estrangeiros — viram modelo de primeira classe (3a). Roots OMG que este handoff não cobre (ex.: `bpmn:escalation`, `bpmn:dataStore` global) permanecem na pendência compensação/coreografia. Registrado, sem mudança de escopo.
5. **Referência no nó**: proposta de forma canônica — o nó guarda `properties.eventDefinitionRef` (o ID da definição; o kind continua em `properties.eventDefinition`). Rename de definição NUNCA toca nós (refs por id) — "cascata = 1 undo" é por construção, com teste provando 2 eventos refletindo o novo nome após 1 undo/redo.

## Plano da E-1 (core headless, 3a) — critérios de aceite

**Escopo**: modelo + comandos + converter. Zero UI (E-2).

1. **Modelo (aditivo)**: `NamedEventDefinition { id, name }` / `ErrorEventDefinition { id, name, errorCode? }`; `diagram.definitions?: { messages; signals; errors }`. Ausente ⇒ `computeDiagramHash` e `toXml` byte-idênticos aos de antes (fixture congelada `eventDefsFrozen.json` capturada do build pré-E-1, mesmo critério da #119).
2. **Comandos undoáveis**: `addEventDefinitionCommand` (id auto estável `msg-1`/`sig-1`/`err-1`, colisão-safe), `updateEventDefinitionCommand` (rename/errorCode), `removeEventDefinitionCommand` **vetado** quando referenciado — verdict lista os nós usuários (id + label), teste incluso. Rename com 2 eventos usando a definição = 1 undo restaura tudo (teste).
3. **Converter export (padrão OMG)**: roots `<bpmn:message id name/>` / `<bpmn:signal/>` / `<bpmn:error errorCode/>` como filhos de `definitions` ANTES de collaboration/process (ordem do XSD); evento com `eventDefinitionRef` emite `messageRef/signalRef/errorRef` no child. Round-trip byte-estável entre os nossos exports (teste).
4. **Converter import**: roots → `diagram.definitions`; `*Ref` → `properties.eventDefinitionRef`; ref órfã conforme a decisão 2. Corpus: ≥1 arquivo REAL com `messageRef` importa com a ligação preservada e sem warning de descarte (asserção no corpusExternal); `corpus-warnings.json` regenerado com diff explicado no PR.
5. **CONFORMANCE**: matriz promove `bpmn:message/signal/error` (root) e os `*Ref` para supported — via gerador, gate de frescor intacto.
6. **Transversais**: apiSurface core atualizado; format-spec ganha a seção "Named event definitions"; pisos de cobertura; regime completo (pipeline local → PR → Actions verdes antes do merge → relatório contra a checklist 3a-core).

**Fora da E-1** (explícito): picker/«+»/rename UI (E-2), refs governadas da Biblioteca (E-3), timer (E-5), matching (E-6).
