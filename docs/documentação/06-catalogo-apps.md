# 06 — Catálogo de Dados: Biblioteca + Aplicações

Mapa de dados (mapa de dados) do cluster **catálogo + aplicação** do monorepo BPMN. Cobre 100% dos arquivos `src` de `library`, `library-react`, `adapters-bpmn`, `studio`, `cli` e `example`, arquivo por arquivo, incluindo dados transitórios que nunca deixam a função. Testes `*.spec.ts` (e2e Playwright) e assets não-TS recebem uma linha cada.

Convenção do template por arquivo: **Papel**, **Entradas**, **Processamento (intermediário)**, **Saídas**, **Estruturas de dados que trafegam**.

---

## library

O núcleo genérico da Biblioteca. Não importa NADA do resto do ecossistema (nem `@buildtovalue/core`, nem `registry`, nem React). O único vocabulário compartilhado é `LifecycleStatus` (seis estados), estruturalmente compatível com o `VersionStatus` do core sem dependência nominal.

### `packages/library/src/types.ts`
**Papel:** Define o contrato `ArtifactAdapter` — o coração da Biblioteca genérica (Handoff 6 §3).
**Entradas:** Nenhuma (só declarações de tipo e a const `LIFECYCLE_STATUSES`).
**Processamento (intermediário):** Deriva `LifecycleStatus` do array literal `LIFECYCLE_STATUSES`; a ordem do array é também a ordem de sort de `sort: 'status'`.
**Saídas:** Tipos exportados; nenhum dado em runtime além da const congelada.
**Estruturas de dados que trafegam:** `LIFECYCLE_STATUSES` (`['draft','test','candidate','active','deprecated','retired']`), `LifecycleStatus`, `ArtifactRef` (`{adapterId, artifactId}`), `ThumbnailSpec` (união `svg`/`icon`/`none`), `ArtifactAction` (`{id,label,kind:'navigate'|'download'|'external',href?,payload?}`), `VersionEntry` (`{version,status,timestamp?,note?}`), `ArtifactSummary` (ref, name, typeLabel, version, status, channel?, boundRuns?, meta?, thumbnail?, updatedAt?), `ArtifactDetail extends ArtifactSummary` (effectiveFrom/Until, approvers, changeSummary, provenance `{ledgerHash,author,createdAt}`, versions[], actions[]), `LibrarySort` (`'name'|'updated'|'status'`), `LibraryQuery` (`{text?, statuses?, adapterIds?, sort?}`), `ArtifactAdapter` (`id, typeLabel, list(query), get(id), subscribe?`).

### `packages/library/src/adapters.ts`
**Papel:** Valida adapters no registro (avisa, nunca quebra — Handoff 6 §3).
**Entradas:** `readonly ArtifactAdapter[]`; `RegisterAdaptersOptions.onWarning?`.
**Processamento (intermediário):** Um `Map<string, ArtifactAdapter> accepted`; para cada adapter faz trim do `id` e do `typeLabel`; descarta id vazio, typeLabel vazio, ou id duplicado (o primeiro registro vence), emitindo `AdapterWarning` em cada descarte.
**Saídas:** `ArtifactAdapter[]` já validado/deduplicado; efeitos colaterais via `warn`.
**Estruturas de dados que trafegam:** `AdapterWarning` (`{adapterId,message}`), `RegisterAdaptersOptions`.

### `packages/library/src/catalog.ts`
**Papel:** Catálogo headless (Handoff 6 §1/§4): agrega adapters, implementa busca, filtro por status/tipo, ordenação e contagem de chips. Read-only por construção.
**Entradas:** `readonly ArtifactAdapter[]`, `LibraryCatalogOptions.onWarning?`; em runtime, `LibraryQuery` para `list`, `ArtifactRef` para `get`, callback para `subscribe`.
**Processamento (intermediário):** `STATUS_ORDER` (Map status→índice) para o sort. `list`: `Promise.allSettled` sobre `adapter.list(query)`; `aggregate: ArtifactSummary[]` acumulado; adapters que falham viram `warn`. `searched` = filtro textual (`matchesText` sobre name/typeLabel/meta, case-insensitive). `counts` (`emptyCounts`) contados sobre o conjunto pós-texto ANTES do estreitamento por status/adapter (cada chip mostra o que selecioná-lo renderia). `items` filtrado por `Set` de statuses e adapterIds; ordenado por `byName`/`byUpdated`/`byStatus`. `get`: resolve `byId` (Map).
**Saídas:** `LibraryResult` (`{items, counts}`), `ArtifactDetail` (via adapter), função de unsubscribe.
**Estruturas de dados que trafegam:** `LibraryCounts` (`{total, byStatus: Record<LifecycleStatus,number>, byAdapter: Record<string,number>}`), `LibraryResult`, `LibraryCatalogOptions`, `LibraryCatalog`.

### `packages/library/src/index.ts`
**Papel:** Barril de exportação pública do pacote.
**Entradas:** N/A. **Processamento (intermediário):** N/A. **Saídas:** re-exporta tipos e `createLibraryCatalog`, `registerAdapters`, `LIFECYCLE_STATUSES`.
**Estruturas de dados que trafegam:** todas as acima.

---

## library-react

A costura headless→React da Biblioteca. Toda a lógica de catálogo vive em `@buildtovalue/library`; aqui só há fiação de estado e renderização.

### `packages/library-react/src/useLibrary.ts`
**Papel:** Hook que conecta o catálogo headless ao React: estado de query, resultados, seleção+detalhe do drawer, invalidação (subscribe → reload).
**Entradas:** `UseLibraryOptions` (`adapters`, `initialQuery?`, `onQueryChange?`, `initialSelection?`, `onSelectionChange?`, `onWarning?`).
**Processamento (intermediário):** `catalog` memoizado por `createLibraryCatalog`. Estados: `query`, `generation` (contador de invalidação), `result`, `selected`, `detail`. `useEffect` assina o catálogo (bump em `generation`), chama `catalog.list(query)` (com guarda `alive`), e `catalog.get(selected)` para o detalhe. `setQuery`/`select` disparam os callbacks do host.
**Saídas:** `UseLibraryState` (query, setQuery, result, selected, select, detail, adapters).
**Estruturas de dados que trafegam:** `LibraryQuery`, `LibraryResult`, `ArtifactRef`, `ArtifactDetail`, `ArtifactAdapter`.

### `packages/library-react/src/LibraryView.tsx`
**Papel:** TELA 1 — Biblioteca (Handoff 6 §4): chips de status (vocabulário fixo), chips de tipo (um por adapter — dinâmico), busca, grid de cards ordenável e drawer de detalhe. Read-only: única saída externa é `onAction`.
**Entradas:** `LibraryViewProps` (`adapters`, `onAction`, `initialQuery?`, callbacks de query/seleção, `onWarning?`).
**Processamento (intermediário):** `useLibrary` provê estado. `toggleStatus`/`toggleAdapter` mutam `Set`s e chamam `setQuery`. `isSelected` compara `ref`. Consts locais `SORTS`. Renderiza contagens de `result.counts` (total/byStatus/byAdapter) e mapeia `result.items` em `ArtifactCard`.
**Saídas:** Tela React (toolbar de filtros, grid, drawer); `onAction(ref, action)` ao host.
**Estruturas de dados que trafegam:** `LibraryQuery`, `LibrarySort`, `ArtifactAction`, `ArtifactRef`, `SORTS`, `LIFECYCLE_STATUSES`, `SEAL_LABELS`.

### `packages/library-react/src/ArtifactCard.tsx`
**Papel:** Card de galeria (Handoff 3 §5): thumb 108px + type-chip, nome, selo (`StatusBadge`) + canal + execuções presas + meta.
**Entradas:** `ArtifactCardProps` (`item: ArtifactSummary`, `selected`, `onSelect`).
**Processamento (intermediário):** Deriva rótulo pluralizado de `boundRuns` ("execução presa"/"execuções presas"); renderização condicional de channel/meta.
**Saídas:** Botão React (card acessível por teclado).
**Estruturas de dados que trafegam:** `ArtifactSummary`, `StatusBadge` seal (`{status, semanticVersion}`).

### `packages/library-react/src/ArtifactDrawer.tsx`
**Papel:** Drawer de detalhe (Handoff 3 §5/6 §4): kicker, nome, selo, e SÓ as seções que o adapter forneceu (campos opcionais → UI opcional).
**Entradas:** `ArtifactDrawerProps` (`detail: ArtifactDetail`, `onAction`, `onClose`).
**Processamento (intermediário):** `formatDate` (ISO → dd/mm/aaaa pt-BR via `Intl.DateTimeFormat`, fallback ao trecho `slice(0,10)`). Flags `hasVigencia`/`hasAprovacao`. Renderiza vigência, aprovação, changeSummary, provenance (ledgerHash/author/createdAt), timeline `detail.versions`, botões `detail.actions` (o índice 0 é primário).
**Saídas:** Tela React `<aside>`; `onAction(detail.ref, action)`.
**Estruturas de dados que trafegam:** `ArtifactDetail`, `ArtifactAction`, `VersionEntry`.

### `packages/library-react/src/Thumbnail.tsx`
**Papel:** Coloca o thumbnail que o adapter forneceu (§3.1): string SVG, ícone nomeado, ou nada. A biblioteca nunca desenha formas de domínio.
**Entradas:** `{spec?: ThumbnailSpec}`.
**Processamento (intermediário):** Ramifica por `spec.kind`; SVG entra via `dangerouslySetInnerHTML` (código do host confiável, não input do usuário).
**Saídas:** `<span>` com a arte, ícone ou placeholder vazio.
**Estruturas de dados que trafegam:** `ThumbnailSpec`.

### `packages/library-react/src/index.ts`
**Papel:** Barril de exportação do pacote React da Biblioteca.
**Entradas/Processamento:** N/A. **Saídas:** `LibraryView`, `ArtifactCard`, `ArtifactDrawer`, `Thumbnail`, `useLibrary` + tipos de props.
**Estruturas de dados que trafegam:** as props acima.

---

## adapters-bpmn

Adapters concretos que mapeiam `RegistryEntry` → `ArtifactSummary`/`Detail`, o thumbnail SVG headless, e a cola de injeção de ledger (payloads `AuditEntryInput` para simulação/replay/sessões de agente).

### `packages/adapters-bpmn/src/registryAdapter.ts`
**Papel:** Ponte genérica registry→library; cada adapter concreto do pacote é uma configuração fina desta factory. Read-only sobre o registry.
**Entradas:** `RegistryAdapterOptions` (`id`, `typeLabel`, `registry: VersionRegistry`, `match?`, `target?: ObserverTarget`, `now?`, `boundRuns?`, `thumbnail?`); em runtime `LibraryQuery`/`artifactId`.
**Processamento (intermediário):** `logicalArtifacts` agrupa `registry.list()` por `entry.snapshot.id` (`Map<string,RegistryEntry[]>`, ordenado por `version.createdAt`). `relevantEntry` escolhe a entry+`publication` visível ao observador (`openPublicationAt` casa channel/environment/janela `effectiveFrom..effectiveUntil`); sem target, a versão mais nova vence. `matching()` filtra por `match(snapshot)`. `toSummary`: conta nós ativos (`!removedInVersion`), monta `ArtifactSummary` (status vem da `publication?.status ?? version.status`, meta = description ou "N nós"). `versionTimeline` mapeia entries→`VersionEntry[]` (reverse, mais novo primeiro). `defaultActions` gera "Abrir no Designer"/"Diff vs versão ativa" com payload `{artifactId, versionId}`. `get`: adiciona approvers (userIds), changeSummary, provenance (`snapshotHash`/createdBy/createdAt), effectiveFrom/Until. Set de `listeners` para subscribe/notifyChanged.
**Saídas:** `ArtifactSummary[]`, `ArtifactDetail`, funções de subscribe/notify.
**Estruturas de dados que trafegam:** `ObserverTarget` (`{channel, environment?}`), `RegistryAdapterOptions`, `RegistryArtifactAdapter` (+`notifyChanged`), `LogicalArtifact` (`{id, entries: RegistryEntry[]}`), `Publication`, `RegistryEntry`, `VersionEntry`, `ArtifactAction`.

### `packages/adapters-bpmn/src/adapters.ts`
**Papel:** Fábricas dos adapters concretos BuildToValue (flow/persona/prompt/connector/policy).
**Entradas:** `VersionRegistry`, `BtvAdapterOptions` (`Pick<...,'target'|'now'|'boundRuns'>`).
**Processamento (intermediário):** `kindAdapter` embrulha `createRegistryAdapter` com `match: (diagram) => classifyDiagram(diagram) === kind`, fixando `id`/`typeLabel`/`kind`.
**Saídas:** `RegistryArtifactAdapter` por tipo (`bpmn-diagram`/FLUXO, `btv-persona`/PERSONA, `btv-prompt`/PROMPT, `btv-connector`/CONNECTOR, `btv-policy`/POLÍTICA).
**Estruturas de dados que trafegam:** `BtvAdapterOptions`, `BtvArtifactKind`.

### `packages/adapters-bpmn/src/classify.ts`
**Papel:** Classifica um diagrama registrado numa "kind" de catálogo.
**Entradas:** `BpmnDiagram`.
**Processamento (intermediário):** 1) `metadata.artifactType` explícito (via `METADATA_ALIASES` pt/en) vence; 2) heurística: se todos os nós ativos compartilham um único `btv:` mapeado (`NODE_KIND`), o diagrama É aquele artefato; 3) senão `flow`. Usa `activeNodes` e um `Set` de kinds.
**Saídas:** `BtvArtifactKind`.
**Estruturas de dados que trafegam:** `BtvArtifactKind`, `BTV_ARTIFACT_KINDS`, `NODE_KIND`, `METADATA_ALIASES`.

### `packages/adapters-bpmn/src/thumbnails.ts`
**Papel:** Renderizador headless de mini-fluxo: o adapter desenha, a biblioteca só coloca a string. SVG puro sobre a geometria do diagrama.
**Entradas:** `BpmnDiagram` (para `diagramThumbnail`); `rules: number` (para `decisionThumbnail`).
**Processamento (intermediário):** Consts de cor por token `--btv-*` (`INK`/`GOLD`/`PAPER`) e `PADDING`. `nodeShape` desenha por tipo (persona=rect arredondado, gate=hexágono, deliverable=pennant, gateway=diamante, event=círculo, default=rect). `hexagon`/`pennant`/`edgePath` (via `waypointsToPath`) são geometria transitória. `diagramThumbnail`: calcula bounding box (min/max de `activeNodes`), monta paths de `activeEdges` + shapes, retorna `viewBox`. `decisionThumbnail`: glifo de tabela (1..4 linhas).
**Saídas:** `ThumbnailSpec` (`{kind:'svg', svg}` ou `{kind:'none'}`).
**Estruturas de dados que trafegam:** `ThumbnailSpec`, `BpmnNode`, `BpmnDiagram`.

### `packages/adapters-bpmn/src/dmnDecisionAdapter.ts`
**Papel:** Decisões DMN como artefatos de catálogo — "mais um adapter". Uma decisão é um nó `dmn:decision`; o id do artefato é `<diagramId>::<nodeId>`. Duck-typed sobre o vocabulário DMN (headless).
**Entradas:** `VersionRegistry`, `DmnDecisionAdapterOptions` (`target?`, `now?`); `artifactId` em runtime.
**Processamento (intermediário):** `decisions()` percorre `logicalArtifacts` e coleta nós `dmn:decision` ativos. `decisionTable(node)` extrai `properties.decisionTable` (`DecisionTableLike` — `{hitPolicy?, rules?}`). `toSummary`: conta `rules`, meta = "hit policy X · N regras", thumbnail via `decisionThumbnail(rules)`. `get`: split de `artifactId` por `::`, valida nó existe/ativo/tipo, monta timeline apenas das versões onde o nó existe (reverse), action única "Abrir no Designer" com `{artifactId, versionId, nodeId}`.
**Saídas:** `ArtifactSummary`/`ArtifactDetail` (typeLabel "DECISÃO").
**Estruturas de dados que trafegam:** `DmnDecisionAdapterOptions`, `DecisionTableLike`, `LogicalArtifact`, `BpmnNode`.

### `packages/adapters-bpmn/src/recipeAdapter.ts`
**Papel:** Fixture do teste ácido (Handoff 6 §10.1): adapter fake de receitas de cozinha, SEM relação com BPMN. Importa SÓ de `@buildtovalue/library`. Cobre os seis estados de ciclo de vida.
**Entradas:** Nenhuma (dados embutidos `RECIPES`); `artifactId` em runtime.
**Processamento (intermediário):** `RECIPES` (const de 6 receitas com history). `toSummary` mapeia `Recipe`→`ArtifactSummary` (meta = "rende N porções", thumbnail `POT_SVG`). `get` monta detail com history→versions e actions ("Abrir receita"/"Baixar PDF" `href`).
**Saídas:** `ArtifactSummary[]`/`ArtifactDetail` (typeLabel "RECEITA"); `notifyChanged`.
**Estruturas de dados que trafegam:** `Recipe` (interna: id,name,status,version,servings,updatedAt,changeSummary,history[]), `RecipeAdapter`, `RECIPES`, `POT_SVG`.

### `packages/adapters-bpmn/src/copilotPromptAdapter.ts`
**Papel:** CP-5 (dogfooding): os próprios templates de prompt do copiloto na Biblioteca — "PROMPT DO COPILOTO", a versão embarcada é a ativa. Read-only sobre `COPILOT_PROMPTS`.
**Entradas:** `templateId` (para `activeCopilotPromptVersion`); `artifactId` em runtime.
**Processamento (intermediário):** `CAPABILITY_NAMES` (id→nome pt-BR C1..C6). `activeCopilotPromptVersion` faz lookup de `.version`. `toSummary`: status sempre `'active'`, meta cita "ia.copilot@<modelo> + este template", thumbnail `SPARK_SVG`. `get` monta detail com changeSummary fixo e uma única `VersionEntry` (sem actions).
**Saídas:** `ArtifactSummary`/`ArtifactDetail`; `version` ativa ou `undefined`.
**Estruturas de dados que trafegam:** `CopilotPromptTemplate`, `CAPABILITY_NAMES`, `SPARK_SVG`.

### `packages/adapters-bpmn/src/roteiroAdapter.ts`
**Papel:** Sessão de simulação gravada oferecida à Biblioteca como artefato "ROTEIRO" versionado (Handoff 7A §3). Injeção de host; o pacote `simulation` fica headless.
**Entradas:** `source: () => RoteiroRecord[]`; `artifactId` (=`scenarioHash`) em runtime.
**Processamento (intermediário):** `label(session)` = "covered/total caminhos". `records()` deduplica por `scenarioHash` (primeiro vence). `toSummary`: meta = cobertura% (`coveragePercent`) + author, thumbnail `TOKEN_SVG`, updatedAt = `session.timestamp`. `get`: changeSummary com nº de decisões, provenance opcional (se `ledgerHash`), versão única, action "Reproduzir no simulador" (`{diagramId, versionId, scenarioHash}`).
**Saídas:** `ArtifactSummary`/`ArtifactDetail` (typeLabel "ROTEIRO"); `notifyChanged`.
**Estruturas de dados que trafegam:** `RoteiroRecord` (`{session: SimulationSession, name?, status?, ledgerHash?}`), `RoteiroAdapter`, `SimulationSession`, `TOKEN_SVG`.

### `packages/adapters-bpmn/src/simulationLedger.ts`
**Papel:** Cola de injeção conectando uma `SimulationSession` headless à governança (Handoff 7A-3): mapeia sessão→entrada de ledger, lê cobertura de volta, e oferece um gate opcional de promoção por cobertura.
**Entradas:** `SimulationSession`, `actor?`; `entries: AuditEntry[]` + `versionId` para leitura; `CoveragePromotionOptions` para o gate.
**Processamento (intermediário):** `simulationSessionEntry` monta `AuditEntryInput` (type `SIMULATION_SESSION`, `details.artifactId`=diagramId, semanticVersion, roteiroHash, covered/total, exercised espalhado). `latestSessionCoverage` varre entries e guarda o melhor ratio (`bestRatio` transitório). `coveragePromotionRule` produz `PromotionRule`: se target ≠ active → allowed; sem cobertura → allowed (degrada); ratio < min → bloqueia com razão pt/en.
**Saídas:** `AuditEntryInput`, `RecordedCoverage`, `PromotionRule`.
**Estruturas de dados que trafegam:** `SIMULATION_SESSION_TYPE`, `AuditEntryInput`, `RecordedCoverage` (`{covered,total}`), `CoveragePromotionOptions`.

### `packages/adapters-bpmn/src/replayLedger.ts`
**Papel:** Cola de injeção conectando uma `ReplayAnalysis` headless à governança (Handoff 7B-3): mapeia análise comparativa→entrada de ledger (anexada à candidata) e lê de volta para o bloco da Revisão do Aprovador.
**Entradas:** `ReplayAnalysis`, `actor?`, `attachTo?` (id da candidata); `entries` + `versionId` para leitura.
**Processamento (intermediário):** `replayAnalysisEntry` monta `AuditEntryInput` (type `REPLAY_ANALYSIS_ATTACHED`, versionId = `attachTo ?? analysis.versionId`, details com artifactId/analyzedVersion/headline/fitness/totalCases + bottleneck/deviation/candidateVersion opcionais). `latestReplayAnalysis` pega o último match (entries cronológicas) e coage os campos de `details` em `AttachedReplayAnalysis`.
**Saídas:** `AuditEntryInput`, `AttachedReplayAnalysis` ou `undefined`.
**Estruturas de dados que trafegam:** `REPLAY_ANALYSIS_TYPE`, `AttachedReplayAnalysis` (`headline,fitness,totalCases,analyzedVersion,bottleneck?,deviation?,deviationCases?,author,timestamp`).

### `packages/adapters-bpmn/src/agentSimulationLedger.ts`
**Papel:** Agent Lane (Handoff 12 §7): sessão mock de simulação de agente gravada no ledger como tipo aditivo (mesmo padrão do `SIMULATION_SESSION`). Clock-free.
**Entradas:** `AgentSimulationSession`, `actor?`.
**Processamento (intermediário):** `agentSimulationSessionEntry` monta `AuditEntryInput` (type `AGENT_SIMULATION_SESSION`, versionId = `workflowRef` com versão, `details.artifactId` = id sem `@`, steps, complete, blockedNode/blockedReason opcionais). Split de `workflowRef.split('@')[0]` transitório.
**Saídas:** `AuditEntryInput`.
**Estruturas de dados que trafegam:** `AGENT_SIMULATION_SESSION_TYPE`, `AgentSimulationSession` (`workflowRef,steps,complete,blocked?,author,timestamp`).

### `packages/adapters-bpmn/src/agentWorkflowAdapter.ts`
**Papel:** Agent Lane (A-6): adapter "AGENTE" bespoke sobre o contrato `ArtifactAdapter` (não um kindAdapter — evita a mentira de tipo de forçar `AgentWorkflow` num `BpmnDiagram`). Store próprio de versões como JSON canônico + hash.
**Entradas:** `AgentWorkflowAdapterOptions` (`id?`, `typeLabel?`, `source: AgentArtifactSource`, `boundRuns?`); `artifactId` em runtime.
**Processamento (intermediário):** `groupAgentVersions` agrupa por `workflow.id` (`Map`), ordena por `compareSemver` (parse transitório de partes numéricas). `relevant(group)` escolhe a versão ativa ou a mais nova. `summaryOf`: meta = "N nós · M arestas · autonomia X" (autonomyLevel viaja como TEXTO), thumbnail `{kind:'icon', icon:'🤖'}`. `timelineOf` (reverse). `get`: provenance com `ledgerHash ?? sha256Hex(canonicalJson(wf))` (hash calculado como identidade do store).
**Saídas:** `ArtifactSummary`/`ArtifactDetail` (typeLabel "AGENTE"); `notifyChanged`.
**Estruturas de dados que trafegam:** `AgentArtifactVersion` (`workflow, status, createdAt?, changeSummary?, author?, ledgerHash?, originTemplate?`), `AgentArtifactSource`, `AgentWorkflowAdapterOptions`, `AgentArtifactAdapter`, `AgentGroup` (interno), `AgentWorkflow`.

### `packages/adapters-bpmn/src/agentGovernance.ts`
**Papel:** Agent Lane (A-6): cola de governança do agente — gate de promoção (validação do grafo §3) e avisos de vigência (processo→agente reutilizando a regra do call activity).
**Entradas:** `AgentWorkflow` + locale (gate); `BpmnDiagram` + `AgentArtifactSource` + locale (avisos).
**Processamento (intermediário):** `agentPromotionGate`: `validateGraph` filtra severidade `error`; codes deduplicados (`Set`); retorna `RuleVerdict`. `agentReferenceCurrencyWarnings`: percorre nós `agentTask`, parseia `properties.agentWorkflowRef` (`toRef`, try/catch), casa contra `source()`; se resolvido e não-ativo, empurra `AgentReferenceWarning`.
**Saídas:** `RuleVerdict`, `AgentReferenceWarning[]`.
**Estruturas de dados que trafegam:** `AgentReferenceWarning` (`{nodeId, ref, status, message}`), `RuleVerdict`, `AgentWorkflow`.

### `packages/adapters-bpmn/src/index.ts`
**Papel:** Barril de exportação do pacote de adapters.
**Entradas/Processamento:** N/A. **Saídas:** re-exporta classify/thumbnails/registryAdapter/adapters concretos/dmn/recipe/copilot/roteiro/simulation+replay+agent ledgers/agentWorkflowAdapter/agentGovernance.
**Estruturas de dados que trafegam:** todas as acima.

---

## studio

O shell do BuildToValue Studio: três telas (Biblioteca, Revisão do Aprovador, Auditoria/Ledger Explorer). Leitura + decisões de governança; edição é o Designer.

### `packages/studio/src/StudioShell.tsx`
**Papel:** Shell de três telas (Handoff 6 §1/§2): header com nav, navegação por hash (`#/biblioteca|revisao|auditoria`), identidade do usuário.
**Entradas:** `StudioShellProps` (`user: UserContext`, `library: LibraryViewProps`, `review: Omit<ReviewScreenProps,'actor'>`, `audit?: LedgerExplorerProps`, `footer?`, `messages?: Messages`).
**Processamento (intermediário):** `screenFromHash()` lê `window.location.hash` (valida contra `SCREENS`). Estado `screen`; `useEffect` escuta `hashchange`; `navigate` seta hash + estado. `I18nProvider` embrulha; `useT()` traduz.
**Saídas:** Tela React; passa `library`/`review`/`audit` para os componentes filhos; `actor` = `user`.
**Estruturas de dados que trafegam:** `StudioScreen` (`'biblioteca'|'revisao'|'auditoria'`), `SCREENS`, `UserContext`, `Messages`.

### `packages/studio/src/review/queue.ts`
**Papel:** Fila do aprovador (Handoff 6 §5): versões candidatas que o usuário ainda NÃO aprovou. Derivada, nunca armazenada; a regra de aprovação vem só dos gates do engine.
**Entradas:** `PendingPromotionsInput` (`candidates: readonly BpmnDiagram[]`, `engine: LifecycleEngine`, `user: UserContext`, `now?`).
**Processamento (intermediário):** Para cada candidato: pula não-`candidate`; pula se o user já aprovou (`approvedBy.some`); `engine.evaluateGates({diagram, target:'active', actor, reason})`; monta `PromotionRequest` com `gates`, `approvedRoles` (`Set` de roles distintos), `approvals` (gate id `'approvals'`), `slaDays` (dif de `effectiveFrom` vs `now`, ms→dias). `approvalsProgress` formata "current/required aprovações".
**Saídas:** `PromotionRequest[]`; string de progresso.
**Estruturas de dados que trafegam:** `PromotionRequest` (`{diagram, gates: PromotionGate[], approvals?, approvedRoles, slaDays?}`), `PendingPromotionsInput`.

### `packages/studio/src/review/checks.ts`
**Papel:** Grade 2×2 de "verificações automáticas" da Revisão (§5): cada card é resultado de uma chamada REAL (analyze/certify/verify/resolve), nunca estado local.
**Entradas:** `ReviewChecksInput` (`diagram`, `ledger: LedgerLike`, `registry?`, `converter?`, `now?`).
**Processamento (intermediário):** Soundness via `analyzeSoundness` (filtra errors, codes deduplicados). Conformidade: `converter.toXml` → `certifyXml`; ok = wellFormed && xxeSafe && achievedClass ≠ none; try/catch. Ledger: `verifyLedger` → `report.intact` + índice do primeiro break. Dependências: `resolveCallActivities`; `unresolved` = refs com calledElement sem entry.
**Saídas:** `ReviewCheck[]` (4 cards).
**Estruturas de dados que trafegam:** `ReviewCheck` (`{id:'soundness'|'conformance'|'ledger'|'dependencies', label, ok, detail}`), `ReviewChecksInput`.

### `packages/studio/src/review/decide.ts`
**Papel:** Comandos de decisão da Revisão (§5): aprovar/rejeitar, ambos escrevem entrada imutável no ledger. Aprovar NUNCA ativa.
**Entradas:** `ApprovePromotionInput` (`engine`, `ledger`, `diagram`, `actor`, `signedApproval?`); `RejectPromotionInput` (`ledger`, `diagram`, `actor`, `reason`).
**Processamento (intermediário):** `approvePromotion`: `engine.approve` (muta `approvedBy` em cópia imutável), `ledger.append` com type `APPROVAL_RECORDED`, details (artifactId, role, semanticVersion, `signedApproval` opcional que entra na hash-chain). `rejectPromotion`: valida `reason.trim().length >= MIN_REJECTION_REASON_LENGTH` (10), append `PROMOTION_REJECTED`.
**Saídas:** `DecisionResult` (`{kind:'approved'|'rejected', diagram, ledgerEntry}`).
**Estruturas de dados que trafegam:** `APPROVAL_RECORDED`, `PROMOTION_REJECTED`, `MIN_REJECTION_REASON_LENGTH`, `DecisionResult`, `SignedApproval`, `AuditEntry`.

### `packages/studio/src/review/ReviewScreen.tsx`
**Papel:** TELA 2 — Revisão do Aprovador (§5): fila à esquerda, área de revisão ao centro. Read-only absoluto exceto as duas decisões de governança. Suporta assinatura Ed25519 (I-2) e ancoragem externa (I-3).
**Entradas:** `ReviewScreenProps` (`candidates`, `engine`, `ledger`, `actor`, `registry?`, `converter?`, `baselineOf?`, `onDecided?`, `onOpenInDesigner?`, `replayAnalysisFor?`, `explain?`, `now?`, `signer?`, `anchor?`).
**Processamento (intermediário):** Estados: `requests`, `selectedId`, `checks`, `decisions` (Record por versionId), `rejecting`, `explanations`, `reason`, `payloadPreview`. `useEffect`→`pendingPromotions`. `queue` = requests sem decisão. `runReviewChecks` no selecionado. `buildApprovalPayloadFor` (payload canônico antes de assinar). `anchorHead`/`useAnchorCycle` para ancorar cabeça de aprovação assinada. `decide('approve'|'reject')`: assina (`signApproval`) se `signer`, chama approve/reject, grava em `decisions`. `computeDiff(baseline, diagram)`. `lastRole` calcula se é a última aprovação necessária.
**Saídas:** Tela React (fila listbox, blocos de request/changeSummary/diff/replay/checks/payload/decisão); `onDecided(result)`.
**Estruturas de dados que trafegam:** `PromotionRequest`, `ReviewCheck`, `DecisionResult`, `ReviewReplayAnalysis`, `CanonicalApprovalPayload`, `SignedApproval`, `Signer`, `AnchorAdapter`/`AnchorHead`.

### `packages/studio/src/ledger/categorize.ts`
**Papel:** Categorização de eventos do ledger para os chips do Ledger Explorer (§6/§8) — função pura no studio (não há enum central no core).
**Entradas:** `AuditEntry` (ou `Pick<...,'type'>`); `entries` + `LedgerFilter` para filtro.
**Processamento (intermediário):** `categorizeEntry`: remove sufixo `_UNDONE|_REDONE`, casa contra `Set`s (`PROMOTION_TYPES`, `APPROVAL_TYPES`, `SIMULATION_TYPES` [SIMULATION_SESSION + AGENT_SIMULATION_SESSION], `REPLAY_TYPES`), `ANCHOR_RECORDED`/prefixos `VERIFICATION`/`CHAIN_`→verification, default `command`. `filterEntries`: `matchesContext` (artifactId casa versionId OU details.artifactId; janela from/until), conta por categoria (`FilteredLedger.counts` antes do estreitamento), filtra por `Set` de categorias. `aiAuthorOf`: detecta `ia.copilot@` em `details.author` ou `details.changeSummaryOrigin.author`. `describeEntry`: linhas key:value de `details`.
**Saídas:** `LedgerCategory`, `FilteredLedger`, autor IA ou undefined, linhas de payload.
**Estruturas de dados que trafegam:** `LedgerCategory` (6 valores), `LEDGER_CATEGORIES`, `LedgerFilter` (`{categories?, artifactId?, from?, until?}`), `FilteredLedger` (`{entries, counts: Record<LedgerCategory,number> & {total}}`).

### `packages/studio/src/ledger/LedgerExplorer.tsx`
**Papel:** TELA 3 — Ledger Explorer (§6): barra de filtro + trilha vertical + coluna de detalhe. Read-only: verificação, export XES e navegação. Verificação da cadeia e da âncora externa (N-4) são independentes.
**Entradas:** `LedgerExplorerProps` (`ledger: LedgerLike`, `registry?`, `onAction?`, `onDownload?`, `initialFilter?`, `query?`, `anchor?`).
**Processamento (intermediário):** Estados: `filter`, `selectedSeq`, `report: VerificationReport`, `anchorResult: AnchorOutcome`, `anchorRetrying`, `question`/`asking`/`queryResult`. `filterEntries(all, filter)` memoizado. `askLedger`: `query(question)` → `parseLedgerAnswer(raw, hashes reais)` (regra de citabilidade local). `verify`: `verifyLedger` + `verifyAnchor` (independentes). `retryAnchor`: `anchor.adapter.anchor({hash,seq})`. `untrusted`/`anchorUntrusted` marcam entries pós-break. `exportXes`: `toXES` → download. `attestationOf`/`describeEntry` para detalhe. `toggleCategory` muta `Set`.
**Saídas:** Tela React (chips, banners de verificação/âncora, caixa de query, trilha, detalhe com hashblock/payload/attestation); downloads (`VerificationReport.json`, `attestation.json`, `.xes`); `onAction`.
**Estruturas de dados que trafegam:** `LedgerAction` (`{id:'diff'|'open-designer', entry}`), `AnchorOutcome` (interno), `VerificationReport`, `LedgerQueryResult`, `AnchorReceipt`, `LedgerFilter`/`LedgerCategory`.

### `packages/studio/src/index.ts`
**Papel:** Barril de exportação do pacote studio.
**Entradas/Processamento:** N/A. **Saídas:** `StudioShell`, `ReviewScreen`, `queue`/`checks`/`decide`, `LedgerExplorer`, `categorize` + tipos.
**Estruturas de dados que trafegam:** todas as acima.

---

## cli

Ferramenta headless de linha de comando (`bpmn-react`): validate, certify, audit, export-xes, export, diff, approve, promote, registry. Entradas JSON/XML; saídas relatórios + códigos de saída (0 ok · 1 check falhou · 2 uso/parse).

### `packages/cli/src/io.ts`
**Papel:** Carregamento de diagrama e formatação de validação/diff.
**Entradas:** `path` (`.json`/`.xml`/`.bpmn`); `ValidationResult`; `BpmnDiff`.
**Processamento (intermediário):** `loadDiagram`: `readFile`; `.json`→`JsonSerializer().deserialize`; senão `BpmnXmlConverter().fromXml` (retorna warnings). `formatValidation`: linhas por issue (✗/⚠ + code + message + node/edge). `formatDiff`: linhas +/-/~ por op de nó/aresta (add/remove/update/supersede) e mudanças de metadata.
**Saídas:** `LoadResult` (`{diagram, warnings}`); strings formatadas.
**Estruturas de dados que trafegam:** `LoadResult`, `BpmnDiagram`, `BpmnDiff`, `ValidationResult`.

### `packages/cli/src/index.ts`
**Papel:** Comandos principais validate/export/diff + barril dos submódulos.
**Entradas:** `path`; `format: 'xml'|'json'`, `output?`; `pathA`/`pathB`.
**Processamento (intermediário):** `validateCommand`: `loadDiagram` → `ValidationEngine([...BUILT_IN_VALIDATION_RULES, ...soundnessRules()])` → `engine.validate`. `exportCommand`: serializa (Json ou XML), escreve se `output`. `diffCommand`: `Promise.all` de dois loads → `computeDiff`.
**Saídas:** `{result: ValidationResult, warnings}`; conteúdo serializado; `BpmnDiff`.
**Estruturas de dados que trafegam:** `ValidationResult`, `BpmnDiff`.

### `packages/cli/src/certify.ts`
**Papel:** Certificado de conformidade + caso de garantia SACM (F-C3).
**Entradas:** `path`/`xmlPath`; `CertifyCommandOptions` (`require?`, `report?`); `AssuranceCaseCommandOptions` (`ledger?`, `sacmVersion?`).
**Processamento (intermediário):** `certifyCommand`: `certifyXml(xml, {require})`; escreve JSON se `report`. `assuranceCaseCommand`: `fromXml`, carrega ledger (`{entries}` ou vazio), `buildAssuranceCase` → `renderAssuranceCaseHtml` → writeFile; deriva `{supported, claims, intact}`. `formatCertify`: monta linhas (well-formed/XXE, modo strict, perfil descriptive/analytic %, round-trip, issues estruturais, elementos fora do perfil, warnings, classe certificável).
**Saídas:** `CertifyReport`; `{supported, claims, intact}`; relatório humano; HTML SACM.
**Estruturas de dados que trafegam:** `CertifyReport`, `CertifiableClass`, `CertifyCommandOptions`, `AssuranceCaseCommandOptions`.

### `packages/cli/src/audit.ts`
**Papel:** Re-verifica ledger exportado (`{entries:[...]}`) e exporta XES.
**Entradas:** `path` do ledger.json; `options` (`registryPath?`, `output?`).
**Processamento (intermediário):** `auditCommand`: parse JSON (erro se inválido ou sem array `entries`), `verifyLedger`. `readLedgerFile` idem. `exportXesCommand`: lê ledger + `loadRegistry` opcional → `toXES`. `formatAudit`: relatório íntegro/QUEBRADO (índice, esperado/encontrado do primeiro break).
**Saídas:** `VerificationReport`; string XES; relatório humano.
**Estruturas de dados que trafegam:** `VerificationReport`, `AuditEntry`.

### `packages/cli/src/registry.ts`
**Papel:** Comandos de registry: add, history, publish, active, diff, bind-run.
**Entradas:** `registryPath`/`diagramPath`; opções por comando (versionId, channel, environment, status, at, from/to, runId, notes).
**Processamento (intermediário):** `loadRegistry` (parse `ExportedRegistry` → `VersionRegistry.import`; `createIfMissing` gera vazio em ENOENT). `saveRegistry` exporta+escreve. `registryAddCommand`: `loadDiagram` → `registry.register`. `publish`/`active`/`diffBetween`/`bindRun` delegam ao registry. `formatHistory`: linha por entry com semver/status/id + live lanes; `formatEntry`.
**Saídas:** `RegistryEntry`/`RegistryEntry[]`, `Publication`, `RunBinding`, strings; efeitos de escrita.
**Estruturas de dados que trafegam:** `ExportedRegistry`, `RegistryEntry`, `Publication`, `RunBinding`, `VersionRegistry`.

### `packages/cli/src/promote.ts`
**Papel:** Avança o ciclo de vida via `LifecycleEngine` e escreve o diagrama; registra a aprovação. É o check "process PR" de um pipeline.
**Entradas:** `diagramPath`; `PromoteOptions` (`actorId`, `actorRole`, `reason`, `to`, `output?`, `registryPath?`); `ActorOptions` para approve.
**Processamento (intermediário):** `promoteCommand`: `loadDiagram` → `engine.promote({diagram, target, actor, reason, diff})` (o engine impõe o gate de governança) → serializa+escreve; se `registryPath`, registra a versão promovida. `approveCommand`: `engine.approve` → escreve.
**Saídas:** `BpmnDiagram` promovido/aprovado; efeitos de escrita; `BpmnLifecycleError` escala ao bin.
**Estruturas de dados que trafegam:** `ActorOptions`, `PromoteOptions`, `VersionStatus`, `BpmnDiagram`.

### `packages/cli/src/bin.ts`
**Papel:** Entrypoint executável (`#!/usr/bin/env node`): parse de argv, dispatch de comandos, códigos de saída.
**Entradas:** `process.argv` (comando + flags: `--to`, `--actor-id/role`, `--reason`, `--json`, `--strict`, `--require`, `--report`, `--assurance-case`, `--ledger`, `--registry`, `--channel`, `--version`, etc.).
**Processamento (intermediário):** `USAGE` (const). `main`: switch por comando; `runRegistry` para o subcomando registry. Helpers `valueOf`/`opt`/`notes`/`actorFrom` parseiam flags. Regras de exit: validate → `valid?0:1`; certify → 2 se mal-formado, 1 se strict com issues ou requirement não atendido; promote captura `BpmnLifecycleError`→1; audit → `intact?0:1`; diff/registry-diff → 1 se há mudança. `--xsd` é reservado (exit 2).
**Saídas:** `console.log/warn/error`; `process.exitCode` (0/1/2).
**Estruturas de dados que trafegam:** `VersionStatus`, `BpmnLifecycleError`, todos os relatórios dos comandos.

---

## example

App demo Vite/React. Um único `App.tsx` roteia por parâmetros de URL para dezenas de modos (editor, viewer, library, studio, simulate, replay, sfeel, copilot, drd, etc.). Builders de diagrama sintéticos e composição de plugins.

### `packages/example/src/main.tsx`
**Papel:** Bootstrap React (createRoot + StrictMode).
**Entradas:** DOM `#root`; import de estilos.
**Processamento (intermediário):** Nenhum além de montar `<App/>`.
**Saídas:** App renderizado no DOM.
**Estruturas de dados que trafegam:** N/A.

### `packages/example/src/sampleDiagram.ts`
**Papel:** Builders de diagramas de demonstração (fixtures sintéticas) + a tabela de decisão demo.
**Entradas:** Parâmetros numéricos (ex.: `count`, `closedCount`, flag `bad`).
**Processamento (intermediário):** `createDefaultRegistry` + registro de tipos de domínio/DMN/HC. Cada builder cria nós/arestas com `createNode`/`createEdge` e `versionId`. `buildSampleDiagram` (produção de conteúdo com boundary, sub-process, call activity, cadeia de supersessão de aresta, data store). `buildStressDiagram` (grade sintética NxN + banda de sub-processes para NFR 60fps; `closedCount` fecha nós). `buildDeadlockDiagram` (XOR-split→AND-join, trap de soundness). `buildAstar`/`Manual`/`Fallback`/`Fanout` (demos de roteamento). `buildSfeelDiagram` (tabela S-FEEL, `bad` injeta `date()` fora do subset). `buildSimulationDiagram` (3 caminhos: feliz/rejeição/timeout). `buildReplayTraces` (log de eventos sintético com gaps de tempo e desvios). `buildClosedDiagram`/`buildHealthcareDiagram`/`buildDrdDiagram`/`buildBoundaryDiagram`.
**Saídas:** `BpmnDiagram` por builder; `DEMO_DECISION_TABLE`; array de traces.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `DecisionTable`, `DEMO_DECISION_TABLE`, traces (`{caseId, events:[{activity,timestamp}]}`).

### `packages/example/src/App.tsx`
**Papel:** Componente raiz + composição de plugins + roteamento por URL-param para todos os modos de demo.
**Entradas:** `window.location.search` (params: `stress`, `astar`, `manual`, `fallback`, `fanout`, `deadlock`, `boundary`, `drd`, `closed`, `hc`, `library`, `studio`, `simulate`, `replay`, `sfeel`, `copilot`, `viewer`, `fix`, `bad`, `decision`); arquivo XML importado; eventos do editor.
**Processamento (intermediário):** Define plugins (`observabilityPlugin`, `soundnessPlugin`, `bindingPlugin`, `dmnDemoPlugin`, `menuPlugin`, `astarSpyPlugin`) e a lista `PLUGINS`/`ASTAR_PLUGINS`. `demoProcessRegistry`/`DEMO_DECISIONS`/`searchDemoDecisions`. Ledgers em memória (`simulationDemoLedger`, `replayDemoLedger`). `makeFakeCopilotProvider` (provider determinístico com payloads de comandos JSON draft/adjust/fix). `App`: estado inicial de `diagram` escolhido pelos params; `lang`/`messages` (PT_BR/undefined). Ramifica para cada modo. `importXml` (converte, emite warnings). `CopilotDemo`/`DrdTableSurface`/`PedigreeSurface`/`SidePanels` são subcomponentes; `onRecord`/`onAttachAnalysis` injetam entradas de ledger via `simulationSessionEntry`/`replayAnalysisEntry`.
**Saídas:** Telas React de todos os modos; entradas de ledger appended; navegação por `window.location`.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `BpmnPlugin`, `AIProvider`, `DecisionSummary`, `Messages`, payloads de comando do copiloto, `window.__routerCalls` (spy global).

### `packages/example/src/LibrarySurface.tsx`
**Papel:** `?library=1` — superfície da Biblioteca (S-3): `LibraryView` sobre registry demo (bpmn/persona) + fixture recipe (teste ácido §10.1 ao vivo). Query round-trips na URL.
**Entradas:** `window.location.search` (`q`, `status`, `type`, `sort`).
**Processamento (intermediário):** `demoNode` monta `BpmnNode`. `seedRegistry` cria diagrama onboarding (v2 ativo com approvers) + persona candidata, computa `snapshotHash` e registra. `queryFromUrl`/`queryToUrl` (bidirecional; `replaceState`). Estados `adapters`/`lastAction`. `onAction` grava a descrição.
**Saídas:** Tela React da Biblioteca; `lastAction` (observado pelo e2e); URL sincronizada.
**Estruturas de dados que trafegam:** `ArtifactAdapter`, `ArtifactRef`, `ArtifactAction`, `LibraryQuery`, `VersionRegistry`, `BpmnNode`.

### `packages/example/src/StudioSurface.tsx`
**Papel:** `?studio=1` — Studio completo (S-4/S-5/S-6): Biblioteca (todos os adapters incl. DMN e recipe), Revisão e Auditoria sobre um mundo demo. Papel do usuário alternável; assinatura/âncora opt-in.
**Entradas:** params (`q`/`status`/`type`/`sort`/`sel`, `sign`, `anchor`, `anchorflaky`, `anchorbroken`, `tamper`); seleção de usuário.
**Processamento (intermediário):** `demoNode`/`demoEdge`/`buildFlow`/`registerDefinition` montam o `StudioWorld` (`buildWorld`): registry com baseline onboarding v1 (contém `dmn:decision` "Limite de crédito"), definições persona/prompt/connector/política, candidato v2, ledger com NODE_ADDED/UPDATED/APPROVAL_RECORDED/VERSION_ATTESTED, `replayLedger` com análise anexada, âncora quebrada opcional, `tamper` forja um byte. `USERS` (Bruna/Carla). Query/seleção via URL (`libraryQueryFromUrl`/`selectionFromUrl`/`syncUrl`). Gera chave Ed25519 (`crypto.subtle`) e `Signer`; `createGitAnchor` sobre transport em memória. `review` memoizado com `baselineOf`/`replayAnalysisFor`(`latestReplayAnalysis`)/`explain` (fake determinístico). `query` do ledger (fake determinístico com citação real de aprovação).
**Saídas:** `<StudioShell>` cabeado; `lastAction`; URL sincronizada.
**Estruturas de dados que trafegam:** `StudioWorld`, `BpmnDiagram`, `UserContext`, `Signer`, `GitAnchorTransport`, `AnchorReceipt`, `ArtifactAdapter`, `AuditLedger`.

### `packages/example/src/LifecyclePanel.tsx`
**Papel:** Painel de governança demo: aprovar por papéis, promover, clonar draft, inspecionar diff, ativar via `PromotionPanel` (atestação).
**Entradas:** props `{ledger?, onLedgerAppend?}`; `useDiagram`/`useEditorConfig` (engine); ator selecionado.
**Processamento (intermediário):** `ACTORS`. Estados `actor`/`baseline`/`history`/etc. `useEffect` recompõe `history` (`VersionTimelineItem[]`, fecha vigência da ativa anterior). `approve`/`promote`/`cloneDraft` chamam o engine. `suggestChangeSummary` (fake determinístico sobre o diff real, autoria `ia.copilot@claude-4`). `onActivated`: registra no registry local, `attestVersion`, append `VERSION_ATTESTED` com `attestationHash`/`xmlHash`/`ledgerHeadHash`.
**Saídas:** Tela React (aprovações, promote, diff, histórico, meta de versão, `PromotionPanel`); entradas de ledger.
**Estruturas de dados que trafegam:** `VersionTimelineItem`, `BpmnDiagram`, `UserContext`, `VersionStatus`, atestação.

### `packages/example/src/AuditPanel.tsx`
**Papel:** Trilha de auditoria ao vivo: cada comando na pilha é appended a um ledger hash-chained; botão verify re-caminha a cadeia.
**Entradas:** props `{ledger?, refreshToken?}`; `stack` de `useDiagram`.
**Processamento (intermediário):** `ledgerRef` (compartilhado ou novo). `useEffect` conecta `connectCommandStack` + assina `stack.subscribe` (flush→setEntries). `refreshToken` traz entradas appended fora da pilha. `verify` chama `ledger.verify`.
**Saídas:** Tela React (lista das últimas 12 entradas + status de verificação).
**Estruturas de dados que trafegam:** `AuditEntry`, `AuditLedger`.

### Assets não-TS do example
- **`packages/example/index.html`** — shell HTML do Vite: `<div id="root">` + `<script type="module" src="/src/main.tsx">`; estilo inline zera margens e fixa `height:100%` em html/body/#root.
- **`packages/example/src/demo.css`** — folha de estilo do app demo (174 linhas): classes `.demo-*` (header, main, side, lifecycle, audit, muted, error) usando tokens `--bpmnr-*` com fallbacks de cor; puramente apresentação, sem dados de negócio.

### Testes e2e (Playwright) — `packages/example/e2e/*.spec.ts` (uma linha cada)
- **anchorBanner.spec.ts** — banner CADEIA ≠ ÂNCORA: índice, trilha não-confiável e entrada `ANCHOR_RECORDED`.
- **astar.spec.ts** — roteamento A* com cache: pan sem drag não recalcula (`__routerCalls`).
- **audit.spec.ts** — ativação grava atestação e o chip do ledger verifica a cadeia.
- **boundary.spec.ts** — attach por drag de boundary event: highlight, drop na borda, undo.
- **closed.spec.ts** — snapshot superseded: hatch, selo gated por hover, banner de versão.
- **contextMenu.spec.ts** — menu de contexto (N-5): item duplicar-nó via comando existente.
- **copilot.spec.ts** — C1 draft→diagrama aplicado + autoria mista + rodapé de soundness local.
- **drd.spec.ts** — renderiza DRD com 4 nós DMN e arestas de requisito form-coded.
- **editor.spec.ts** — renderiza o diagrama sample com formas de domínio.
- **export.spec.ts** — export PNG produz raster não-vazio válido.
- **healthcare.spec.ts** — via clínica família 305° com validação visível.
- **i18n.spec.ts** — troca do dicionário injetado em runtime re-traduz a UI.
- **identity.spec.ts** — fluxo de assinatura: payload canônico antes, depois badge verificado.
- **integration.spec.ts** — galeria mostra todo tipo de adapter (DMN/recipe como ordinários §10.1).
- **ledger.spec.ts** — trilha com chips/contagens de categoria; detalhe mostra o encadeamento.
- **library.spec.ts** — galeria renderiza artefatos de todo adapter com selos canônicos.
- **manual.spec.ts** — rotas manuais (R-3): translação rígida do bend, flag ⚠, sem re-roteamento.
- **pedigree.spec.ts** — faixa de pedigree de aresta renderiza a cadeia e abre DiffView adjacente.
- **perf.spec.ts** — pan/zoom de diagrama de 350 nós acima do piso de fps.
- **reparent.spec.ts** — drop em sub-process expandido torna a contenção real (collapse esconde).
- **replay.spec.ts** — renderiza heatmap, fitness e desvios sobre o modelo.
- **resilience.spec.ts** — recupera rascunho não salvo após reload; discard mantém o base.
- **router.spec.ts** — recuperação de fallback (R-4): rota cura ao afastar o obstáculo.
- **sfeel.spec.ts** — roteia o token pela saída da decisão (amount 50 → auto).
- **simulation.spec.ts** — fecha 3/3 em sessões feliz/rejeição/timeout.
- **soundness.spec.ts** — deadlock bloqueia promoção com `SND_DEADLOCK_JOIN` no modal.
- **studio.spec.ts** — shell abre na Biblioteca; nav chega à Revisão via hash.
- **subprocess.spec.ts** — expande/colapsa sub-process no lugar (undoable).
- **viewer.spec.ts** — viewer standalone renderiza diagrama governado com pan/zoom + selo.

---

## Síntese de dados de catálogo/aplicação

O cluster gira em torno de **um contrato de dados unidirecional e read-only**. Toda a informação de catálogo colapsa em duas formas normalizadas:

1. **`ArtifactSummary` / `ArtifactDetail`** — a moeda comum. Cada adapter concreto (registry, dmn, recipe, copilot, roteiro, agent) mapeia sua fonte nativa (`RegistryEntry`, nó `dmn:decision`, `Recipe`, `CopilotPromptTemplate`, `SimulationSession`, `AgentArtifactVersion`) para essas duas interfaces. A biblioteca genérica NUNCA conhece o tipo concreto — só `LifecycleStatus`, `ThumbnailSpec`, `ArtifactAction`, `VersionEntry`.

2. **`AuditEntryInput` / `AuditEntry`** — a moeda de governança. A cola de injeção (`simulationLedger`, `replayLedger`, `agentSimulationLedger`, `decide.ts`) empacota eventos em entradas de ledger hash-chained, sempre carregando `details.artifactId` para o filtro "por artefato" funcionar de ponta a ponta.

**Agregação (library):** `LibraryQuery` entra → `Promise.allSettled` sobre adapters → filtro textual → `LibraryCounts` (contadas antes do estreitamento) → filtro por status/adapter → sort → `LibraryResult`. Falha de adapter degrada (warn), nunca quebra.

**Studio (revisão + auditoria):** `PromotionRequest` (derivada dos gates do engine, nunca armazenada) alimenta a fila; `ReviewCheck` são 4 chamadas reais (soundness/conformance/ledger/dependencies); `DecisionResult` (approve/reject) grava entrada imutável. O `LedgerExplorer` categoriza (`LedgerCategory` × 6) e verifica cadeia + âncora como resultados independentes.

**CLI:** `loadDiagram` normaliza JSON/XML → `BpmnDiagram`; comandos produzem `CertifyReport`, `VerificationReport`, `RegistryEntry`, HTML SACM; a saída real é o **código de saída** (0 ok · 1 check falhou/gate de governança · 2 uso/parse).

**Example:** roteamento por **URL-param** escolhe um builder de diagrama sintético + composição de plugins; ledgers em memória recebem os payloads de injeção; providers fake determinísticos garantem que o CI nunca chama a rede.

### Estruturas de dados-chave
- **`ArtifactSummary`** — cartão normalizado (ref, name, typeLabel, version, status, channel?, boundRuns?, meta?, thumbnail?, updatedAt?).
- **`ArtifactDetail`** — estende Summary com vigência, approvers, provenance (`ledgerHash`/author/createdAt), `versions[]`, `actions[]`.
- **`LibraryQuery`** — filtro de entrada (text, statuses, adapterIds, sort).
- **`LibraryResult` / `LibraryCounts`** — itens + contagens de chip (total, byStatus, byAdapter).
- **`ThumbnailSpec` / `ArtifactAction` / `VersionEntry`** — dados de UI descritivos (SVG/ícone; descritor de ação; linha de timeline).
- **`PromotionRequest` / `ReviewCheck`** — fila derivada dos gates + grade 2×2 de verificações reais.
- **`DecisionResult` / `AuditEntryInput`** — decisão imutável + payload de injeção de ledger (approval/rejection/simulation/replay/agent).
- **`LedgerCategory` / `LedgerFilter` / `FilteredLedger`** — categorização pura + filtro do Ledger Explorer.
- **`CertifyReport` / `VerificationReport`** — relatórios de conformidade e integridade da cadeia (CLI + Studio).
- **`RegistryEntry` / `Publication` / `RunBinding` / `LogicalArtifact`** — dados do registry consumidos pelos adapters e comandos.
- **I/O da CLI** — `LoadResult` (JSON/XML→diagrama), strings formatadas (validation/diff/audit/certify) e códigos de saída 0/1/2.
- **`AttachedReplayAnalysis` / `RecordedCoverage` / `AgentArtifactVersion`** — dados de injeção específicos de replay/simulação/agente.
