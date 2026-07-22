# Reconciliação — Handoff 22 "Squad Lane" vs. §10 (critérios de aceite)

Placar item-a-item da entrega (SL-1…SL-13) contra a seção **§10** do
[`README.md`](./README.md). Cada critério aponta ONDE é satisfeito (arquivo +
teste) e em qual SL entrou. "✅" = coberto e verde na suíte completa sob cobertura
(`pnpm test:coverage`); todas as mudanças são **MINOR** (aditivas).

| # | Critério §10 | Status | Onde (SL · arquivo · teste) |
|---|---|---|---|
| 1 | **Acidez** — `agentflow` sem NENHUM import do ecossistema com todos os módulos novos | ✅ | Todos os módulos headless (SL-1,3,4,5,7,8,10) vivem em `packages/agentflow/src/*` e só importam `./`/`../`. `tests/independence.test.ts` + `acidez.test.ts` seguem verdes; integrações chegam por injeção degradável (`resolveTool`/`resolveDelegate`/`resolveMemberStatus`/`resolveWorkflow`/`AgentRunner`). |
| 2 | **Contratos** — vetores +/−/remediação para TODOS os códigos §6; binding só ref versionada | ✅ | `TOOL_*` (SL-1, `validate.test.ts`), `BUDGET_*` (SL-3, `simulate.test.ts`), `SCHEMA_*`/`DELEGATE_*`/`AUTONOMY_CHAIN` (SL-4), `PROMPT_VAR_UNUSED` (SL-5, `promptCoverage.test.ts`), `EVAL_BELOW_THRESHOLD` (SL-7, `evalSet.test.ts`), `CTX_*`/`SQUAD_*`/`SQUAD_EDGE_ROLE_UNKNOWN` (SL-8, `squad.test.ts`), `GATE_NOT_COVERING` (SL-12, `agentTask.test.ts`), `MAPPING_TRANSFORM_ILLEGAL` (SL-12, `eventIo.test.ts`). Binding de ferramenta é seletor/ref versionada (SL-2) — string solta é impossível (cerca). |
| 3 | **Determinismo** — `simulateSquad` 10× = trilha idêntica; `BUDGET_EXCEEDED`/`DELEGATE_*` param honestamente | ✅ | SL-10 `squadSim.test.ts` "same squad 10× → byte-identical facts"; parada cross-agente nomeia agente+nó+razão. `BUDGET_EXCEEDED` honesto em SL-3 (`simulate.ts`, `cell:'budget'`). |
| 4 | **Evidência** — bundle JSON canônico; `verify()` valida sem código novo; `policyRefs`/`decisionRuleRefs`/`maskingPolicyRef` obrigatórios; fixture × evidência-declarada visíveis | ✅ | SL-11 `evidenceBundleLedger.ts` — `canonicalEvidenceBundle` (core `canonicalJsonExact`), `hashEvidenceBundle` 2× idêntico, os três refs obrigatórios (builder recusa sem `maskingPolicyRef`), `AuditLedger.verify()` valida a entrada sem código novo (+ detecção de adulteração). `fixture`×`evidencia-declarada` na trilha (SL-10, `SquadTrail`, rótulo distinto "não verificada"). |
| 5 | **Gate real** — fixture com rota de fallback que contorna o gate → `GATE_NOT_COVERING` nomeando a rota | ✅ | SL-12 `agentTask.ts` `gateBypassRoute` + `agentGateCoverageViolations` sobre `reachableGateFrom`; `agentTask.test.ts` "flags a gate that a fallback route bypasses — names the route". Distinto de `TOOL_EFFECT_UNGATED` (SL-1, contrato) e do grounding-check do squad (SL-11) — sem duplicar. |
| 6 | **Squad** — toggle não perde seleção/undo; promoção com membro candidata → warning agregado; ctx-contract reusado por 2 squads (ref) | ✅ | SL-9 `SquadStudio` toggle mexe só em `viewMode` (foco/undo intactos, `squadStudio.test.tsx`); `SQUAD_MEMBER_STALE` agregado + `staleMembers` (SL-8/SL-9); `ContextContract` é artefato próprio referenciado por `contextContractRef` (SL-8) — dois squads compartilham por ref, nunca cópia (`squad.test.ts`). |
| 7 | **Prontidão** — `readinessState()` é a ÚNICA origem dos badges (teste que quebra se algum componente derivar estado próprio); "apto" nunca vira "executando" sem host | ✅ | SL-8 `readinessState()` (puro, teto `apto-para-integracao`). SL-13 `ReadinessBadge` deriva SÓ de `readinessState()`; `readinessBadge.test.tsx` compara badge ≡ `readinessState()` nos 4 estados (quebra se um componente derivar sozinho) e prova que `apto` não vira `executando` sem `hostStatus`. Ligado ao AgentStudio. |
| 8 | **Ponte** — duplo-clique abre Studio via `?load`; voltar restaura viewport/seleção; simulação integrada atravessa o agentTask | ✅ (react)/host | SL-12 `bridge/deepLink.ts` — `readLoadVersionId`/`resolveDeepLink` (resolver injetado, degradável), `buildLoadSearch`; `BpmnDesigner.initialCanvasState` restaura viewport/seleção (`deepLink.test.tsx`). O host detém URL/histórico e o duplo-clique→`?load` (composição do `example`, contrato pronto). |
| 9 | **A11y (E9)** — 6 arestas distinguíveis SEM cor; legenda navegável; foco anuncia; axe sem regressão | ✅ | SL-9 `SquadStudio`/`squadPlugin` — 6 `SQUAD_EDGE_STYLES` distintas por marcador+traço+glifo+rótulo, legenda de botões navegável, `aria-live` anuncia origem/destino/tipo; axe sem serious/critical (`squadStudio.test.tsx`, `readinessBadge.test.tsx`, `squadTrail.test.tsx`). |
| 10 | **Perf** — trilha 500 passos a 60fps (virtualização própria); simulação de squad no worker não bloqueia o canvas | ✅ | SL-10 `SquadTrail` — virtualização PRÓPRIA (janela por `scrollTop`, sem react-window); teste prova DOM limitado em trilha de 1000 (`squadTrail.test.tsx`). `squadSimJob` roda no worker F7, byte-idêntico ao síncrono (`workers.test.ts`). |
| 11 | **Globais** — zero deps novas; zero strings hardcoded; corpus byte-estável; RECONCILIACAO.md preenchida | ✅ | `check:no-runtime-deps`/`check:no-hardcoded-strings`/`check:no-key-generation` verdes; corpus de conformidade intocado (round-trip byte-estável); i18n EN+PT_BR em todas as superfícies novas (`MIGRATED` atualizado); ESTE arquivo. |

## Fronteiras registradas (composição, não lacuna)

- **Três camadas de gate mantidas distintas de propósito:** `TOOL_EFFECT_UNGATED` (SL-1, nível-contrato, `agentflow`) · grounding→commitment do squad (SL-11, nível-squad, `agentflow`) · `GATE_NOT_COVERING` (SL-12, nível-processo, `core` sobre `reachableGateFrom`). Comentários apontando a fronteira em `validate.ts`, `toolContract.ts`, `squad.ts`.
- **Round-trip manifesto↔diagrama** do Squad Studio permanece pendência declarada (o diagrama é projeção read-only; edição via UI de manifesto) — ver [`pendencias.md`](../../pendencias.md).
- **Masking off-thread** (`squad-sim` job): política-função não cruza `postMessage`, então o caminho do worker usa redação conservadora (nunca vaza; documentado em `pendencias.md`).
- **`executando`/`erro-de-integracao`** nunca são derivados — só exibidos quando o host os informa (`ReadinessBadge.hostStatus`).

## Pendências abertas por esta entrega

Registradas em [`pendencias.md`](../../pendencias.md) §11: round-trip manifesto↔diagrama;
extensibilidade do announce ao schema da aresta; refino de cobertura de gate por
caminho quando o squad JÁ tem gate (a projeção do squad ainda não emite nós de gate —
`GATE_NOT_COVERING` opera sobre o `BpmnDiagram` geral); masking custom off-thread.
Nada falha em silêncio: cada uma tem contrato honesto até ser priorizada.
