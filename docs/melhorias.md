# Melhorias estruturadas — backend, frontend e processo

> **Análise profunda do monorepo** (`@buildtovalue/*`, 24 pacotes) feita a partir do
> catálogo de dados de `docs/documentação/`, com leitura dirigida do código-fonte de
> produção, testes, configuração e CI. Cada achado traz **arquivo:linha verificado**,
> severidade (**P0** corrige já / **P1** alta alavancagem / **P2** higiene) e esforço
> estimado (**P**equeno ≤ ½ dia · **M**édio 1–3 dias · **G**rande > 3 dias).
>
> Data da análise: 2026-07-14. Complementa `pendencias.md` (decisões de produto) —
> aqui o foco é **dívida técnica e oportunidade de engenharia**, não escopo de produto.

## Status da implementação (2026-07-14 — mesma branch)

O roadmap foi **implementado nesta branch** na sequência Fase 1 → 2 → 3. Estado por item:

| Status | Itens |
|---|---|
| ✅ Implementado | **Backend:** B1 (`canonicalJsonExact` + receita v2 do ledger com `hashVersion`; v1 legado verifica para sempre — decisão em `DECISIONS.md`), B2 (parser lazy-line), B3 (warning multi-processo), B4 (`core/model/flow.ts`), B5 (validação estrutural), B6 (suíte DMN `roundtrip.test.ts`), B7 (preimage v2 sem `join('\|')`), B8 (taxonomia — com exceções arquiteturais abaixo), B9 (índice de lanes), B11 (TAB/CR), B12 (CLI `valueOf`), B13 (diff fast path). **Frontend:** F1 (clipboard/duplicate/select-all + context menu), F2 (foco rondante + gate axe serious), F3 passo 1 (cache em `canvas/activeCache.ts` — na camada react, não no core: import/fixtures mutam records in-place), F4 (seletores consolidados), F5 (i18n canvas + guard), F6 (subpaths `./simulation`/`./replay`/`./agent`/`./copilot`), F8 (tema manual nos blocos DMN restantes — atributo do projeto é `data-bpmnr-theme`), F9 parcial (debounce do rule engine; hit-testing extraído para `canvas/hitTest.ts`), F10 (testes do example + snapshot SVG determinístico), F11 (nudge: seta=1px, Shift=grade). **Processo:** T1, T2 (changesets), T3 (TypeDoc 23 pacotes), T4 (contagens corrigidas + números frágeis removidos + anotações Δ), T5 (`docs/README.md`), T6 (ESLint: `no-explicit-any` on, react-hooks, glob ampliado), T7 (matriz Node 20/22 + artifact lcov), T9 (CONTRIBUTING + stub esclarecido), T10 (`DECISIONS.md` + pendências enxutas). |
| 📌 Adiado com registro | F7 (routing no worker — harness pronto e sem consumidores; pipeline assíncrono sobre seeding que não pode entrar no undo exige PR dedicada com guardas de corrida; ver `DECISIONS.md`), F9 split completo do `useInteractions` (extração parcial feita; split por gesto é refactor de risco próprio), F3 passo 2 (índice espacial — condicionado a profiling), T8 (Prettier **removido** em vez de imposto: 134–267 arquivos reformatariam; ver `DECISIONS.md`), regras compiler do react-hooks v6 (flagam ~50 padrões deliberados). |
| ⚖️ Exceções arquiteturais (B8) | `agentflow` e `library` são zero-import por teste de independência — seus erros locais NÃO estendem `BpmnError` de propósito; idem `recipeAdapter` (teste ácido só permite importar de `@buildtovalue/library`). |

## 0. Estado geral (o que NÃO precisa melhorar)

A base é saudável — as melhorias abaixo são cirúrgicas, não de resgate:

- Grafo de dependências entre pacotes **acíclico e em camadas** (core → registry/identity/soundness → audit/copilot → adapters/cli).
- **~5 usos de `any`** no backend, todos em seams genéricos justificados; **zero `TODO`/`FIXME`** em produção.
- Utilitários críticos **centralizados** (SHA-256/`canonicalJson` só em `core/persistence/hash.ts`; parser XML reusado por dmn/identity) — a única duplicação real está no achado B4.
- Frontend com **store externo + `useSyncExternalStore`** e seletores com cache shallow (`packages/react/src/state/createStore.ts`), culling de viewport (`canvas/culling.ts`), gestos coalescidos em rAF, undo limitado a 200 entradas.
- CI com 8 gates (audit, no-runtime-deps, no-key-generation, no-hardcoded-strings, lint, build, typecheck, docs-fresh) + cobertura com thresholds por pacote + e2e Playwright com canário de FPS.

## 1. Sumário executivo — top 10 por impacto/esforço

| # | Melhoria | Área | Sev. | Esf. | Ref. |
|---|---|---|---|---|---|
| 1 | Separar `canonicalJson` de **hashing** (sem arredondamento) do geométrico — hoje todo número é arredondado a 2 casas antes de entrar em hash de auditoria/assinatura | Backend | P0 | M | [B1](#b1) |
| 2 | Corrigir parse XML **O(n²)** (`line()` recalculada por atributo/texto) | Backend | P0 | P | [B2](#b2) |
| 3 | **Clipboard/duplicate/select-all** no editor (Ctrl+C/X/V/D/A) | Frontend | P0 | M | [F1](#f1) |
| 4 | **Navegação por teclado** nos elementos do canvas (roving `tabIndex`) | Frontend | P0 | M | [F2](#f2) |
| 5 | Corrigir escopo obsoleto `@bpmn-react` no `release.yml` antes do primeiro publish | Processo | P0 | P | [T1](#t1) |
| 6 | Hoistear classificação flow-node/edge duplicada (soundness × simulation) para o core | Backend | P1 | P | [B4](#b4) |
| 7 | i18n nas superfícies do canvas (strings hardcoded EN/PT misturadas) | Frontend | P1 | P | [F5](#f5) |
| 8 | Cache de `activeNodes` + índice espacial para hit-testing por frame | Frontend | P1 | M | [F3](#f3) |
| 9 | TypeDoc para os 23 pacotes sem referência de API (hoje só `react`) | Processo | P1 | P | [T3](#t3) |
| 10 | Adotar `@changesets/cli` (versões congeladas em 1.0.0 com `## Unreleased` cheio) | Processo | P0 | M | [T2](#t2) |

---

## 2. Backend / domínio

### <a id="b1"></a>B1 · P0 · Integridade — `canonicalJson` arredonda números e é usado em hashing sensível

`packages/core/src/persistence/hash.ts:20` — `sortValue` aplica `roundCoord` (arredondamento
a 2 casas, `hash.ts:33-35`) a **todo** número, e `canonicalJson` é a base de:

- hash da cadeia de auditoria — `packages/core/src/audit/ledger.ts:55` (`canonicalJson(entry.details)`);
- payload de assinatura Ed25519 — `packages/identity/src/payload.ts:27` (`encodePayload`);
- atestações e assurance case — `packages/audit/src/attest.ts`, `packages/audit/src/assuranceCase.ts`.

O arredondamento existe para estabilizar **coordenadas de geometria**, mas em `details`
de auditoria e payloads assinados ele silencia precisão de dados de negócio: `1.005` e
`1.006` produzem o mesmo hash; `0.001` vira `0` antes de assinar.

**Proposta:** criar `canonicalJsonExact` (sem arredondamento) e usá-lo em ledger,
identity e audit; manter o atual para snapshot/diff de diagrama (onde o round de
coordenada é desejado). **Atenção — fronteira de compatibilidade:** o comentário em
`ledger.ts:40-44` avisa que mudar a receita **quebra toda cadeia existente**. A troca
precisa de versionamento do hash (ex.: campo `hashVersion` na entrada, verificadores
aceitando v1 legado), registrado como decisão em `pendencias.md`.

### <a id="b2"></a>B2 · P0 · Performance — parser XML O(n²)

`packages/core/src/xml/MiniXmlParser.ts:68-74` — `line()` varre a fonte **desde o início**
para contar `\n`, e é chamada avidamente por atributo (`:146`) e por chunk de texto
(`:208`) mesmo sem erro (o número de linha só é usado em mensagens de erro). Em BPMN
com milhares de elementos o custo agregado é quadrático.

**Proposta:** rastrear a linha incrementalmente durante o avanço do cursor, ou passar
um thunk `() => this.line()` avaliado apenas no caminho de erro. Correção pontual,
ganho direto no import de arquivos grandes (inclusive no corpus de conformance).

### <a id="b3"></a>B3 · P1 · Fidelidade — colaborações multi-processo não fazem round-trip

`packages/core/src/persistence/BpmnXmlConverter.ts:132-140` — no export, todos os pools
referenciam o **mesmo** `processRef`; no import (`:188`) só o **primeiro** `<process>` é
lido. Diagramas Camunda/bpmn.io com participantes de processos distintos perdem
estrutura silenciosamente. É o perfil v1 documentado (`pendencias.md` §3), mas o
import deveria ao menos **emitir warning** no `ImportResult.warnings` ao descartar
processos adicionais. Esforço: P (warning) / G (colaboração real — decisão de produto).

### <a id="b4"></a>B4 · P1 · Duplicação — classificação flow-node/edge repetida em dois pacotes

`packages/soundness/src/graph.ts:46-64` e `packages/simulation/src/graph.ts:30-44`
duplicam literalmente `NON_FLOW_TYPES`, `NON_FLOW_EDGE_TYPES`, `isFlowNode` e
`flowScopeOf`. O comentário em `simulation/src/graph.ts` justifica a cópia "porque
simulation só pode depender de core" — mas **ambos já dependem de core**. Hoistear a
classificação para `core` (ex.: `core/src/model/flow.ts`) elimina a divergência
estrutural e o teste-âncora `soundnessAgreement.test.ts`.

### <a id="b5"></a>B5 · P1 · Fronteira — `JsonSerializer.deserialize` sem validação estrutural

`packages/core/src/persistence/serializer.ts:15-36` valida apenas a **presença** de
`id/name/version/nodes/edges` e faz `as BpmnDiagram`. `{"nodes": "x"}` passa e explode
adiante — e este é exatamente o caminho `.json` da CLI (`packages/cli/src/io.ts`).
**Proposta:** validar que `nodes`/`edges` são objetos e que cada item tem `id`/`type`
coerentes, lançando `BpmnParseError` com caminho do campo.

### <a id="b6"></a>B6 · P1 · Testes — conversor DMN XML sem suíte dedicada

`packages/dmn/src/DmnXmlConverter.ts` (416 linhas) + `decisionTableXml.ts` têm apenas
cobertura incidental, apesar de interop DMN 1.3 (Camunda/dmn-js) ser objetivo declarado.
**Proposta:** suíte de round-trip dedicada espelhando o padrão do corpus BPMN
(`packages/conformance/`), com edge-cases de tabela (entradas vazias, aspas em S-FEEL,
anotações).

### <a id="b7"></a>B7 · P2 · Segurança de canonicalização — preimage do ledger com `join('|')`

`packages/core/src/audit/ledger.ts:45-57` — o preimage concatena campos com `|` sem
escape: `type="A|B", user="C"` colide com `type="A", user="B|C"`. Severidade baixa (IDs
internos), mas é fraqueza de canonicalização em fronteira de integridade. Corrigir
junto com B1 (mesma janela de quebra de compatibilidade): usar `canonicalJsonExact` do
objeto inteiro ou campos comprimento-prefixados.

### <a id="b8"></a>B8 · P2 · Erros — taxonomia inconsistente

Existe a hierarquia `BpmnError → BpmnValidationError/BpmnLifecycleError/BpmnAuditError/
BpmnParseError/BpmnRuleError` (`packages/core/src/model/errors.ts`), mas ~14 arquivos
lançam `Error` genérico (`core/src/xml/XmlBuilder.ts`, `audit/src/attest.ts`,
`dmn/src/DmnXmlConverter.ts`, `copilot/src/plan.ts`, `cli/src/registry.ts`,
`adapters-bpmn/src/*Adapter.ts`, `library/src/catalog.ts`) e há subclasses ad-hoc fora
da taxonomia (`sfeel`, `agentflow`, `simulation`). Padronizar melhora o tratamento na
CLI e em hosts (discriminação por `instanceof`).

### <a id="b9"></a>B9 · P2 · Performance — `VersionRegistry` sem índice por lane

`packages/registry/src/VersionRegistry.ts:166-177` — `publish()` varre todas as
entradas × publicações; `publicationAt`/`channelTimeline` (`:194-210`) fazem
`flatMap`+`sort` por consulta. Um `Map<laneKey, Publication[]>` mantido no publish
resolve. Degrada só com histórico grande — sem urgência.

### <a id="b10"></a>B10 · P2 · Testes — lacunas em soundness e conformance

- `packages/soundness/src/graph.ts` (Tarjan SCC iterativo) e `promotion.ts` só são
  exercitados indiretamente por `rules.test.ts`.
- `packages/conformance/src/manifest.ts`, `render.ts`, `corpusPolicy.ts` sem testes
  próprios (lógica de certificação).

### <a id="b11"></a>B11 · P2 · Round-trip — `escapeXmlAttribute` não escapa TAB/CR

`packages/core/src/xml/XmlBuilder.ts:10-12` escapa `"` e `\n` mas não `\t`/`\r`;
parsers estritos normalizam esses caracteres para espaço na releitura, quebrando
round-trip exato de labels. Correção de 2 linhas + teste.

### <a id="b12"></a>B12 · P2 · CLI — parsing de flags frágil

`packages/cli/src/bin.ts:274-277` — `valueOf` retorna `args[index + 1]` sem checar se o
próximo token é outra flag: `--reason --json` consome `--json` como valor de `--reason`.
Validar que o valor não começa com `--` e emitir erro claro.

### <a id="b13"></a>B13 · P2 · Micro-otimizações

- `diff.fieldChanges` (`packages/core/src/diff/index.ts:56-70`) canonicaliza JSON até
  campos escalares (`x`, `y`, `label`) para comparar — comparar primitivos direto e
  canonicalizar só `properties`/`waypoints`.
- `activeNodes`/`activeEdges` (`packages/core/src/model/types.ts:372-379`) realocam o
  array filtrado a cada chamada — ver também F3 (o custo real aparece no frontend).

---

## 3. Frontend (React)

### <a id="f1"></a>F1 · P0 · UX — sem clipboard, duplicate e select-all

Não existe copiar/recortar/colar/duplicar em lugar nenhum do editor —
`packages/react/src/gestures/useKeyboardShortcuts.ts` liga undo/redo/delete/nudge/
escape/pan/context-menu, mas **não** Ctrl+C/X/V, Ctrl+D nem Ctrl+A. Para um editor de
diagramas é a maior lacuna de uso diário. **Proposta:** comando de duplicação no core
(clonagem de subconjunto com remap de ids + offset), serialização do subconjunto para o
clipboard (JSON no `navigator.clipboard`, com fallback interno), e atalhos + itens de
context menu. Select-all é trivial (`selectedIds = activeNodes ∪ activeEdges`).

### <a id="f2"></a>F2 · P0 · A11y — canvas não navegável por teclado

Os `<g>` de nós têm `role="button"` + `aria-label` mas **nenhum `tabIndex`**
(`packages/react/src/canvas/NodeRenderer.tsx:80-81`; só há 3 `tabIndex` no pacote, em
ContextMenu/AgentStudio). Usuário só de teclado não consegue selecionar nem conectar
elementos. O teste de a11y "keyboard navigation" (`packages/react/tests/a11y.test.tsx`)
só verifica `role`/name — não exercita navegação real. **Proposta:** roving `tabIndex`
(um elemento focável por vez, setas movem foco entre elementos, Enter/Espaço seleciona,
atalho para iniciar conexão), + e2e de edição keyboard-only.

Relacionado: o gate axe falha só em **CRITICAL** (`tests/a11y.test.tsx:30-42`) —
serious/moderate são logados e tolerados. Depois de fechar os pendentes, promover o
gate para falhar também em `serious`.

### <a id="f3"></a>F3 · P1 · Performance — hit-testing O(N) por frame sem cache

`findNodeAt`/`findBoundarySnap` em `packages/react/src/canvas/useInteractions.ts` chamam
`activeNodes(diagram)` — que **realoca o array filtrado** (`core/src/model/types.ts:372`)
— e fazem varredura linear **a cada pointermove** durante connect/boundary-snap.
**Proposta em 2 passos:** (1) cache de `activeNodes` por identidade de diagrama
(WeakMap) — ganho imediato, esforço P; (2) índice espacial (grid uniforme já basta;
quadtree se necessário) reconstruído por edição, não por frame — esforço M.

### <a id="f4"></a>F4 · P1 · Performance — ~7–11 subscriptions de store por elemento

`ConnectedNode` chama `useCanvasState` 7× e `NodeRendererInner` mais 4
(`packages/react/src/canvas/NodeRenderer.tsx:455-498`); `ConnectedEdge` ~6
(`EdgeRenderer.tsx:486-497`). Como o store notifica **todos** os listeners a cada
`setState` (`state/createStore.ts:31`), um frame de drag com ~300 elementos culled
avalia 2–3 mil seletores. **Proposta:** consolidar num único seletor memoizado por
elemento (tupla shallow-comparada), e/ou indexar estado de drag/seleção por id para que
só elementos afetados recomputem.

Relacionado (P2): o rule engine é avaliado **por frame** durante connect
(`useInteractions.ts`, hook `edge.connect.pre`) — debouncar para disparar só na mudança
de alvo de hover protege contra regras caras de host.

### <a id="f5"></a>F5 · P1 · i18n — strings hardcoded e idioma misto no canvas

O guard `scripts/check-no-hardcoded-strings.mjs` cobre um **allowlist** que exclui os
arquivos de renderização do canvas. Resultado — vazamentos em ambos os idiomas:

- `canvas/NodeRenderer.tsx:231` — `aria-label="Connection port"` (EN fixo);
- `canvas/NodeRenderer.tsx:337-340` — selo `FECHADO v…`/`FECHADO #…` (PT fixo);
- `canvas/ResilienceLayer.tsx:86` — `Rascunho não salvo de … encontrado` (PT fixo);
- `canvas/EdgeRenderer.tsx:325` — `<title>No obstacle-free route…` (EN fixo).

Um host com `messages={PT_BR}` ainda vê aria-labels em inglês; um host EN vê "FECHADO".
**Proposta:** rotear pelos `useT()`/fragments existentes e **adicionar esses arquivos ao
`MIGRATED`** do guard para não regredir. Esforço P — a infraestrutura i18n já existe.

### <a id="f6"></a>F6 · P1 · Bundle — barrel único anula imports granulares

`packages/react/src/index.ts` re-exporta com `export *` também simulation, replay,
agent e copilot (UI + pacotes irmãos). Um consumidor que só quer o editor depende do
tree-shaking do bundler para descartar tudo isso — e barrels `export *` frequentemente o
derrotam. **Proposta:** subpath exports `./simulation`, `./replay`, `./agent`,
`./copilot` espelhando o `./viewer` que já existe, mantendo o barrel raiz por
compatibilidade e documentando os subpaths como forma preferida.

### <a id="f7"></a>F7 · P1 · Performance — workers prontos mas fora do hot path

`packages/react/src/workers/executor.ts` + `jobs.ts` implementam harness síncrono/worker
para routing/soundness, mas o único consumidor real é `ui/ContextMenu.tsx`. O
roteamento A* (`computeRoutedWaypoints`, `rerouteConnectedEdges`) roda síncrono na main
thread (`useInteractions.ts`, `DiagramContext.tsx:99,156`). Mover routing/soundness
para o worker por padrão (com fallback síncrono já existente) é o ganho pretendido e
não realizado da infraestrutura.

### <a id="f8"></a>F8 · P2 · Theming — dark mode só automático

`packages/react/styles.css` (2807 linhas) usa 4 blocos `@media (prefers-color-scheme:
dark)` e nenhum hook `data-theme`/classe — host não consegue oferecer toggle manual
claro/escuro/alto-contraste. **Proposta:** duplicar os overrides sob
`[data-theme='dark']` (e `[data-theme='light']` para forçar claro), mantendo o media
query como default. Aproveitar para extrair os fallbacks inline `var(--x, #hex)`
espalhados nos componentes SVG (`NodeRenderer.tsx:119,132,296,300`, `shapes.tsx`) para
constantes geradas de uma única fonte — hoje a paleta vive em dois lugares.

### <a id="f9"></a>F9 · P2 · Manutenibilidade — mega-hook de 1104 linhas

`packages/react/src/canvas/useInteractions.ts` concentra drag, connect, pan, lasso,
resize, waypoint-drag, boundary-snap, reparent, long-press e context menu. Funciona,
mas não é testável por gesto. Dividir em hooks por gesto (cada um retornando handlers
compostos) permite unit-test sem montar o canvas inteiro.

### <a id="f10"></a>F10 · P2 · Testes — example sem unit tests; sem regressão visual

- `packages/example` tem **0 testes unitários** (só e2e).
- Não há snapshot/visual-regression do SVG do canvas — mudanças de shape passam
  despercebidas fora do canário de FPS. Playwright já está no repo
  (`toHaveScreenshot` resolveria com baixo custo).

### <a id="f11"></a>F11 · P2 · Papercuts de UX

- Nudge invertido em relação à convenção: hoje plain = passo de grade, **Shift = 1px**
  (`gestures/useKeyboardShortcuts.ts:145`); na maioria dos editores Shift é o passo
  **maior**.
- Culling só engaja acima de 300 elementos (`canvas/culling.ts:21`) — vale perfilar um
  threshold menor ou culling sempre ativo para diagramas médios.

---

## 4. Documentação, tooling e processo

### <a id="t1"></a>T1 · P0 · Release — escopo obsoleto `@bpmn-react` no workflow

`.github/workflows/release.yml:7` ainda instrui "The npm scope (@bpmn-react) must
exist", mas o rename global para `@buildtovalue` já foi executado (`pendencias.md` §1).
Corrigir o comentário/checklist **antes** do primeiro publish real evita seguir
instrução errada no momento mais sensível. (O publish em si segue bloqueado só pelo
secret `NPM_TOKEN` — pendência já registrada.)

### <a id="t2"></a>T2 · P0 · Versionamento — adotar changesets

Não há `.changeset/`; todos os 24 pacotes estão congelados em `1.0.0` enquanto o
`CHANGELOG.md` acumula um `## Unreleased` com pacotes inteiros novos (library,
adapters-bpmn, library-react…). O lockstep manual já divergiu do estado real.
**Proposta:** `@changesets/cli` com changeset por PR, versão/changelog gerados, e
integração no `release.yml` (o `pnpm -r publish` atual passa a consumir os bumps).

### <a id="t3"></a>T3 · P1 · API reference — 23 de 24 pacotes sem docs geradas

`typedoc.json:3-6` só tem `entryPoints` de `packages/react` — `docs/api/` é 100% do
pacote react, embora o README linke todos os pacotes. Adicionar entryPoints de core,
registry, audit, identity, dmn, sfeel, soundness, simulation, replay, cli etc. O gate
`check:docs-fresh` já existe e passa a proteger o conjunto todo automaticamente.

### <a id="t4"></a>T4 · P1 · Catálogo de dados com drift e sem gate de frescor

`docs/documentação/` afirma contagens que já divergiram: `01-core.md` diz **31**
arquivos em `packages/core/src` (real: **29**); o README do catálogo soma **259**
(real: **258**); a camada 05 declara 44 cobrindo pacotes que somam 45. **Proposta:**
gerar as contagens por script (mesmo padrão do `check:docs-fresh`) **ou** remover
números absolutos que envelhecem, mantendo o catálogo qualitativo.

### <a id="t5"></a>T5 · P1 · Discoverability — ~330 KB de docs órfãos

A seção Documentation do `README.md:84` não linka `docs/uml/` (arquitetura C4/4+1),
`docs/documentação/` (catálogo de dados), `docs/api/` (TypeDoc), `docs/assurance-case.md`
nem `CONFORMANCE.md`. **Proposta:** criar `docs/README.md` como índice único e linkar
do README raiz. Registrar também a convenção de idioma (EN para docs públicos, PT-BR
para docs internos — hoje é implícita e inconsistente).

### <a id="t6"></a>T6 · P1 · ESLint abaixo do rigor do projeto

`eslint.config.mjs` usa só `tseslint.configs.recommended` e **desliga
`no-explicit-any`** (`:10`) — contradizendo `CONTRIBUTING.md` ("no `any` unless
justified"). Não há `eslint-plugin-react-hooks` num projeto React, e `pnpm lint` cobre
só `packages/*/src` (tests/, scripts/, e2e/ fora). **Proposta:** habilitar
`recommended-type-checked`, religar `no-explicit-any` (os ~5 usos legítimos ganham
`eslint-disable` com justificativa — que é exatamente a política do CONTRIBUTING),
adicionar `react-hooks` e ampliar o glob do lint.

### <a id="t7"></a>T7 · P2 · CI — matriz de Node e publicação de cobertura

O CI roda só Node 22, mas `engines` declara `>=20` — adicionar matriz {20, 22}. O
`test:coverage` gera lcov que ninguém vê — publicar como artifact (ou Codecov) para dar
visibilidade aos thresholds de `vitest.config.mts`. Verificar explicitamente que os
thresholds do root config são honrados com o workspace file (um floor silenciosamente
ignorado é pior que nenhum).

### <a id="t8"></a>T8 · P2 · Prettier declarado e não imposto

`prettier` está em `devDependencies` mas não há `.prettierrc`, script `format` nem step
de CI. Ou adicionar config + `format:check` no CI, ou remover a dependência.

### <a id="t9"></a>T9 · P2 · Docs desatualizados/órfãos

- `CONTRIBUTING.md:21` lista 5 pacotes publicáveis; hoje são ~21 (e `domain-example`
  virou privado).
- `docs/design_handoff_btv_trust/` contém só um README (stub), diferente do
  `_trust_anchor/` completo — resolver o resquício.
- Os `design_handoff_*` somam ~3 MB de screenshots dentro de `docs/` — considerar
  mover para `docs/design/` (ou anexos fora do repo) separando handoff de design de
  documentação de engenharia.

### <a id="t10"></a>T10 · P2 · `pendencias.md` — separar pendências de histórico

~60% do arquivo (818 linhas) é registro de decisões **fechadas**. Extrair um
`DECISIONS.md` (histórico) e manter `pendencias.md` só com o realmente aberto tornaria
o rastreio confiável. Abertas de fato hoje: publish npm (`NPM_TOKEN`), roteador A*
completo (adiado por decisão), multi-pool real, swimlane layout, node type "política",
deep-link por `versionId`.

---

## 5. Roadmap sugerido

### Fase 1 — correções P0 (cada item cabe em 1 PR)

| Item | Esforço | Observação |
|---|---|---|
| T1 escopo no release.yml | P | fazer antes de qualquer publish |
| B2 parser O(n²) | P | sem mudança de API |
| B1 `canonicalJsonExact` em hashing | M | **quebra compat de hash** — exige `hashVersion` + decisão registrada; combinar com B7 na mesma janela |
| F1 clipboard/duplicate/select-all | M | comando no core + atalhos no react |
| F2 navegação por teclado no canvas | M | + e2e keyboard-only |
| T2 changesets | M | destrava o fluxo de release |

### Fase 2 — P1 de maior alavancagem

B4 (hoistear classificação de grafo) → B5 (validação do deserialize) → F5 (i18n canvas)
→ F3 passo 1 (cache `activeNodes`) → T3 (TypeDoc todos os pacotes) → T5 (índice de docs)
→ T6 (ESLint) → F6 (subpath exports) → B3 (warning no import multi-processo) → B6
(suíte DMN) → F4 (consolidar seletores) → F7 (routing no worker) → T4 (gate do catálogo).

### Fase 3 — P2 / higiene contínua

B8–B13, F8–F11, T7–T10, e F3 passo 2 (índice espacial) se o perfil justificar.

### Dependências e riscos

- **B1+B7 são a única mudança que quebra compatibilidade** (cadeias de auditoria e
  hashes existentes). Tudo o mais é aditivo ou interno.
- F4 e F7 devem ser guiados pelo canário de FPS existente (`packages/example/e2e/perf.spec.ts`)
  — medir antes/depois, não otimizar às cegas.
- T2 (changesets) muda o fluxo de contribuição — atualizar `CONTRIBUTING.md` junto (T9).

## Fora de escopo deste documento

Este documento **prioriza e especifica**; não implementa. Decisões de produto
(multi-pool real, roteador A* completo, node type "política") permanecem em
`pendencias.md` — aqui só entram os ganchos de engenharia relacionados.
