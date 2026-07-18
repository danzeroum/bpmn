# ES-0 — Reconciliação Handoff 17 × main

**Base**: main `2dd5404` (Handoff 16 completo, E-0..E-6 / #120–#127). Tabela ✅ (existe e reusa) / ⚠ (existe, precisa de aperto/extensão) / ⬜ (novo), com evidência.

## 4a — Modelo + XML OMG (core)

| Item | Estado | Evidência |
|---|---|---|
| Contenção F7 (parentId, childrenOf, DI absoluto, expand/collapse, drill, z-order) | ✅ reusa por inteiro | `core/src/model/types.ts:308` (`nodeParentId`), `:313` (`childrenOf`); DI estrutural + `isExpanded` reservado (`elementSerializer.ts:139`); drill/breadcrumb no canvas (F7 #25–#26) |
| `properties.triggeredByEvent` / `properties.isInterrupting` → atributos OMG | ⬜ novo | grep no repo: **zero ocorrências** de `triggeredByEvent`/`isInterrupting`. Import externo hoje DESCARTA o atributo em silêncio (deserializer lê só atributos conhecidos; `foreignAttributes` preserva apenas prefixados `ns:`) — confirma o "subProcess comum silencioso" da spec. Molde de reserva do soup: `eventDefinitionRef`/`calledElement` (`elementSerializer.ts:115-140`) |
| Veto de conexão pela regra padrão | ⚠ canal pronto, regra nova | Hook `edge.connect.pre` existe com veto self-connect (`rules.ts:77`); o gesto JÁ avalia o canal (`useInteractions.ts:481` durante o drag, `:698` no drop); falta a regra da casca |
| Isenção do unreachable | ⚠ molde, isenção nova | `unreachableNodeRule` (`validation.ts:82`) isenta startEvent/boundary/pool/lane — `CONTAINER_NODE_TYPES = ['pool','lane']` (`types.ts:429`): **subProcess NÃO é isento hoje**; a isenção nova vale SÓ para event subprocess (comum continua acusando) |
| Fixture congelada de neutralidade | ✅ molde | `eventDefsFrozen.json` + `passthroughFrozen.json` (critério #119/E-1); nova `eventSubprocFrozen` pelo mesmo script-padrão |
| Corpus + CONFORMANCE | ✅ molde | `corpusExternal.test.ts` (asserções nomeadas por arquivo) + matriz via gerador (`gen-conformance.mjs`, gate de frescor) |

## 4b — Visual normativo (react)

| Item | Estado | Evidência |
|---|---|---|
| Contêiner com faixa de título 30px, rx, borda | ✅ molde F7 | `SubProcessShape` em `shapes/shapes.tsx` (`SUBPROCESS_TITLE_HEIGHT` exportado); borda sólida hoje — o PONTILHADO é condicional a `triggeredByEvent` (⬜) |
| Círculo TRACEJADO não-interrupting | ✅ molde H6 | `shapes.tsx:155-156` — boundary com `strokeDasharray` por `cancelActivity`; reuso no start é aplicação direta (⬜ no start) |
| Colapsado com glifo do gatilho | ⚠ | Expand/collapse/drill herdados sem mudança (✅); glifos por kind existem nos shapes de evento H6; a COMPOSIÇÃO no colapsado é nova |
| Paleta «Subprocesso de evento» = 1 composto | ⬜ novo | Paleta/`BUILT_IN_PALETTE` existem; molde do composto atômico: «+» da E-2 (`compositeCommand` add+ref) e `buildGovernedExample` |
| Export fiel (pontilhado = geometria) | ✅ por construção | Shapes usam atributos SVG (não CSS transiente) — exporters preservam |

## 4c — Interações

| Item | Estado | Evidência |
|---|---|---|
| Reparent-on-drop para dentro | ✅ herdado | `ReparentTargetOverlay` (#99–#101), gesto inalterado |
| Portas suprimidas + veto declarado nos 2 sentidos | ⬜ novo | Canal pronto: `lastVeto` (DiagramContext:139) + 🔒 na toolbar (E-2 usa o mesmo); supressão de portas no NodeRenderer é nova |
| Toggle "Interrompe o escopo" | ⬜ novo | Molde: campos de seção do properties panel (E-2/E-5), `updateNodeCommand` undoável |
| Aperto da matriz E-4 | ⚠ a apertar | `react/src/ui/eventExecution.ts:38-41`: `parent?.type === 'subProcess'` — a aproximação NOMEADA na E-4 ("aproximação honesta do event subprocess, pendência própria"). Aperto: exigir `triggeredByEvent` no pai. **Impacto registrado**: fixtures `eventIo.test.tsx` (es1) e demo `?eventio=1` usam subProcess comum — atualizam na ES-3 |

## 4d — Lint

| Item | Estado | Evidência |
|---|---|---|
| Perfis versionados pela mesma fonte | ✅ molde | `lint-etiquette`/`lint-engine` **1.1.0** (E-5); header do dock + `lintProfileAdapter` leem a MESMA fonte (testes já pinam) |
| `EVT_ERROR_START_TOPLEVEL` | ⚠ a apertar | `lint/src/index.ts` `evtErrorStartToplevelRule`: `parent?.type === 'subProcess'` — MESMO predicado da matriz E-4 (concordância declarada na E-5). Aperto quebra o teste `nested` de `eventRules.test.ts` — atualiza na ES-4 |
| `EVT_SUBPROC_FLOW` / `EVT_SUBPROC_START` | ⬜ novas | Perfil aceita regras por construção; quick-fix mecânico: molde `fixEvtRefMissing` (reforço 9 da E-5 — composto add+ref, 1 undo) |
| Concordância lint⇄matriz | ⚠ arquitetura | Lint não importa react: o predicado compartilhado precisa de **helper headless no core** (`isEventSubprocess`) que os DOIS lados importam + teste de concordância nos dois lados (proposto na ES-1) |

## 4e — Simulação

| Item | Estado | Evidência |
|---|---|---|
| Matching honesto (throwError/Signal/Message, catch-all declarado, precedência, BlockedDecision) | ✅ base E-6 | `engine.ts` (#127): precedência específico>catch-all, trilha nomeada, replay bit a bit, compat fireBoundary |
| Espelho gov-* idêntico | ✅ molde | Reforço 9 da E-6 (`eventMatching.test.ts`) |
| Candidatos incluem starts de event subprocess | ⬜ novo | `throwError` hoje só olha `boundariesByHost`; grafo por escopo EXCLUI filhos do contêiner (`buildSimGraph` + `flowScopeOf`) — ver **conflito 1** |
| Timer/conditional start = card manual | ⬜ novo | Molde `boundaryOptions`/`errorThrowOptions` |
| limitations.md | ✅ a atualizar | Seção "Event matching" (E-6) diz "event sub-process container is its own pendency" — remove-se; propagação/escalation/compensação ficam |

## Conflitos / decisões para o owner (antes da ES-1)

1. **Posição do token no disparo (4e)** — o mock da trilha mostra "token no start st-1" (nó INTERNO do contêiner), mas o grafo de simulação é por escopo (filhos do subProcess ficam fora do grafo do escopo do token) e a limitação vigente "sub-process token descent is not modelled" vale desde o 7A. **Proposta (recomendo)**: o disparo coloca o token no CONTÊINER (nó do escopo corrente — mesma semântica do subProcess-como-atividade), com a trilha nomeando o start ativado e o modo: `caught by event subprocess «Tratar exceções» (start st-1, errorRef "err-limite")` — descida interna segue não-simulada (o escopo interno é simulável à parte, como hoje). Alternativa: implementar descida real só para event subprocess (motor multi-escopo — mais código, quebra a simetria com subProcess comum). Preciso da escolha.
2. **Aperto quebra artefatos da E-4/E-5 (registro, não pergunta)** — `eventIo.test.tsx`, demo `?eventio=1` (es1) e o teste `nested` de `eventRules.test.ts` usam subProcess comum; passam a `triggeredByEvent: true` nas PRs do aperto (ES-3 para a matriz, ES-4 para o lint). Entre ES-1 e ES-3 a aproximação antiga continua valendo — sem quebra intermediária, por construção da ordem §4.
3. **Idioma da mensagem do veto de conexão** — o veto da E-1 (exclusão de definição) é PT-BR; as regras default do core são EN ("A node cannot connect to itself"). O mock da spec é PT. Proposta: mensagem PT-BR (consistente com o veto irmão da E-1). Confirmar.
4. **"Mesmo default da paleta" no quick-fix de 0 starts (4d)** — a paleta (react) usa i18n ("Nova mensagem"); o lint é headless EN ("New message", reforço 9 da E-5). Proposta: o contrato documentado é a FORMA (startEvent kind message + definição nomeada referenciada, UM composto); os rótulos seguem a camada (lint EN como as demais regras, paleta i18n). Confirmar.

## Plano da ES-1 (core headless, 4a) — critérios de aceite

**Escopo**: modelo + converter + veto de conexão + isenção + fixture. Zero UI (ES-2/ES-3), zero lint (ES-4), zero simulação (ES-5).

1. **Helpers headless**: `isEventSubprocess(node)` (subProcess + `properties.triggeredByEvent === true`) e `startIsInterrupting(node)` (default OMG true; false só explícito) em `core/model/types.ts` — o predicado ÚNICO que matriz (ES-3) e lint (ES-4) importarão para a concordância; apiSurface +2.
2. **Converter export**: `triggeredByEvent="true"` como atributo padrão do `<bpmn:subProcess>` (reservado do soup exatamente quando emitido — molde `calledElement`); `isInterrupting="false"` no `<bpmn:startEvent>` SÓ quando false (**default OMG omitido** — teste dos dois lados: true nunca escrito, false presente). Round-trip byte-estável dos dois atributos.
3. **Import**: atributos → properties; arquivo REAL do corpus com `triggeredByEvent` importa como contêiner de primeira classe SEM warning (asserção no corpusExternal); `corpus-warnings.json` regenerado com diff explicado no PR se mudar.
4. **Veto de conexão**: regra padrão em `edge.connect.pre` vetando conexão DE ou PARA a casca de event subprocess, mensagem PT-BR nomeando a regra OMG (conflito 3); filhos↔filhos e subProcess comum passam (teste dos dois sentidos + dois negativos).
5. **Isenção do unreachable**: event subprocess isento (molde boundary); subProcess comum CONTINUA acusando `UNREACHABLE_NODE` (negativo vinculante).
6. **Fixture congelada `eventSubprocFrozen`** capturada do build PRÉ-ES-1: sem `triggeredByEvent`, `toXml` e `computeDiagramHash` byte-idênticos (cerca §1.4); `eventDefsFrozen`/`passthroughFrozen` intactas.
7. **Transversais**: CONFORMANCE promove event subprocess via gerador; format-spec ganha a seção "Event subprocess"; apiSurface core; pisos de cobertura; regime completo.

**Fora da ES-1** (explícito): shapes/paleta (ES-2), portas/toggle/aperto da matriz (ES-3), EVT_SUBPROC_*/aperto TOPLEVEL (ES-4), disparo no simulador/limitations (ES-5).
