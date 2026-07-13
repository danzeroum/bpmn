# Mapa de Dados — @buildtovalue/react (feature surfaces)

Catálogo linha-a-linha dos dados que circulam nas superfícies React que embrulham
os motores headless (`@buildtovalue/simulation`, `@buildtovalue/replay`,
`@buildtovalue/agentflow`, `@buildtovalue/copilot`) e a infra i18n/workers.
Escopo: `packages/react/src/{simulation, replay, agent, copilot, workers, i18n}`.
Nenhuma semântica de negócio vive aqui — estas superfícies são orquestração +
projeção de estado dos engines para SVG/DOM.

---

## simulation

### `packages/react/src/simulation/BpmnSimulator.tsx`
**Papel:** Superfície drop-in do modo simulação — `BpmnEditor` read-only com overlay de token, cards de escolha e o painel de 300px; constrói o artefato de sessão para o ledger via injeção.
**Entradas:** props `BpmnSimulatorProps` — `diagram: BpmnDiagram`, `plugins?: BpmnPlugin[]`, `onExit?`, `onRecord?: (session: SimulationSession) => void|Promise`, `author='anônimo'`, `recordedInfo?: ReactNode`, `decisions?: DecisionEvaluator` (suporte a tabela de decisão injetado pelo host). Do hook `useSimulation`: `state` (SimulationState), `coverage`, `travels`, etc.
**Processamento (intermediário):** `sim = useSimulation(diagram, {decisions})`; deriva `choice = state.pendingChoice`, `gatewayLabel` (label do nó via `diagram.nodes[choice.nodeId]`), `advanceLabel` (string condicional a deadlocked/complete/choice), `defaultRecordedInfo` (JSX com hash+coverage). Estado local `recorded: SimulationSession|null`. `handleRecord` (useCallback) chama `buildSession(engine.scenario, coverage, {author, timestamp})` async, invoca `onRecord`, seta `recorded`.
**Saídas:** JSX — `<BpmnEditor>` com `overlay=<SimulationOverlaySvg>`, slots para `GatewayChoiceCard`/`DecisionInputCard`/`BlockedDecisionNotice`, `<SimulationPanel>`; pill "MODO SIMULAÇÃO"; callback `onRecord(session)`.
**Estruturas de dados que trafegam:** `BpmnSimulatorProps`, `SimulationSession` (scenarioHash, coverage {covered,total}, version, author, timestamp), `SimulationState`, `CoverageSummary`.

### `packages/react/src/simulation/useSimulation.ts`
**Papel:** Controller React em torno do `SimulationEngine` headless — possui o engine + `CoverageTracker` (sobrevive a resets), espelha estado para React e transforma cada passo em animações de token sobre a geometria real da aresta.
**Entradas:** `diagram: BpmnDiagram`, `options: { decisions?: DecisionEvaluator }`.
**Processamento (intermediário):** `engine = useMemo(new SimulationEngine(diagram,{decisions}))`; `tracker = useMemo(new CoverageTracker(engine.graph))`. Estado local: `force` (rerender dummy), `sessionNumber`, `stepMode` (default = `prefersReducedMotion()`), `travels: TokenTravel[]`, `travelKey` (ref contador). `emitTravels(transitions)` filtra `TransitionRecord[]` por `type==='move'|'split'` com `edgeId`, gera `TokenTravel` {key, edgeId, targetNodeId, durationMs=450}. `advance/choose/fireBoundary` chamam o engine, emitem travels e, se `engine.complete`, `tracker.record(state.traversedEdges)`. `reset` faz fold da cobertura antes de `engine.reset()`. `statusLine` (useMemo) — string derivada de deadlocked/complete/blockedDecision/pendingDecisionInput/pendingChoice/token atual.
**Saídas:** `UseSimulationResult` — `state`, `coverage`, `sessionNumber`, `stepMode`, `setStepMode`, `hasApproximateSemantics`, `canAdvance`, `travels`, `clearTravel`, `statusLine`, `advance/choose/fireBoundary/reset`, `engine` (acesso vivo para captura de cenário).
**Estruturas de dados que trafegam:** `TokenTravel` {key:number, edgeId, targetNodeId, durationMs}, `SimulationState`, `TransitionRecord`, `CoverageSummary`, `Decision`, `DecisionEvaluator`.

### `packages/react/src/simulation/SimulationOverlaySvg.tsx`
**Papel:** Camada SVG em coordenadas de mundo — arestas exercitadas em verde, highlight do nó com token, discos de token animados via `<animateMotion>` sobre a rota real.
**Entradas:** props — `tokenNodeIds: string[]`, `traversedEdges: string[]`, `travels: TokenTravel[]`, `clearTravel(key)`. De contextos: `diagram` (useDiagram), `config` (useEditorConfig, para `edgeRouter`).
**Processamento (intermediário):** `pathFor(edgeId)` recomputa geometria via `edgeGeometryFor(edge, source, target, config.edgeRouter)` → `path`. `travelingTargets = new Set(travels.map(t=>t.targetNodeId))` para suprimir disco em repouso durante voo. Componente interno `TravelingToken` monta `setTimeout(onDone, durationMs)` por travel key.
**Saídas:** SVG `<g data-simulation-overlay>` — `<path>` verdes por aresta exercitada, `<rect>` highlight dourado por nó, `<g><TokenDisc/>` em repouso, `<TravelingToken>` com `<animateMotion>`; callback `clearTravel(key)` ao fim da animação.
**Estruturas de dados que trafegam:** `SimulationOverlaySvgProps`, `TokenTravel`, `EdgeGeometry` {path,start,end,midpoint}, `BpmnNode`/`BpmnEdge`.

### `packages/react/src/simulation/SimulationPanel.tsx`
**Papel:** Painel de 300px que substitui o inspector — status + avançar/reiniciar, disparo de boundary, cobertura de caminhos, trilha da sessão e registro no ledger.
**Entradas:** props `SimulationPanelProps` — `sessionNumber`, `statusLine`, `canAdvance`, `onAdvance`, `onReset`, `advanceLabel`, `boundaryOptions: BoundaryOption[]`, `onFireBoundary(id)`, `stepMode`, `onToggleStepMode`, `coverage: CoverageSummary`, `trail: TransitionRecord[]`, `hasApproximateSemantics`, `onRecord?`, `canRecord?`, `recordedInfo?: ReactNode`. `t` de `useT()`.
**Processamento (intermediário):** `pct = round(coverage.covered/coverage.total*100)` (transitório). Mapeia `coverage.paths` (id, label, covered) para `<li>`, `trail` (step, message, approximate) para `<div>`, `boundaryOptions` (boundary, label, interrupting) para botões.
**Saídas:** JSX `<aside>` — botões avançar/reset/boundary, checkbox stepMode, card de cobertura com progressbar (`aria-valuenow=pct`), card de trilha, aviso de semântica aproximada, botão de registro; callbacks `onAdvance/onReset/onFireBoundary/onToggleStepMode/onRecord`.
**Estruturas de dados que trafegam:** `SimulationPanelProps`, `BoundaryOption` {boundary, label, interrupting}, `CoverageSummary` {covered, total, paths[{id,label,covered}]}, `TransitionRecord` {step, message, approximate}.

### `packages/react/src/simulation/GatewayChoiceCard.tsx`
**Papel:** Card flutuante de escolha de gateway na base do canvas (touch-first, alvos ≥44px); OR-gateway é multi-seleção com confirmação explícita.
**Entradas:** props — `choice: PendingChoice`, `gatewayLabel: string`, `onChoose(decision: Decision)`.
**Processamento (intermediário):** estado local `selected: Set<string>` (edgeIds selecionados no modo múltiplo); `toggle(edgeId)` adiciona/remove do Set. Ramo por `choice.multiple` e `choice.kind`.
**Saídas:** JSX botões por `choice.options` (edgeId, label); `onChoose` com Decision — `{kind:'exclusive'|'eventBased', gateway, edge}` (simples) ou `{kind:'inclusive', gateway, edges:[...selected]}` (confirmação múltipla).
**Estruturas de dados que trafegam:** `GatewayChoiceCardProps`, `PendingChoice` {nodeId, kind, multiple, approximate, options[{edgeId,label}]}, `Decision`.

### `packages/react/src/simulation/DecisionInputCard.tsx`
**Papel:** Card de entrada de decisão S-FEEL (businessRuleTask) + o "stop honesto" `BlockedDecisionNotice` quando a decisão não é simulável.
**Entradas:** `DecisionInputCard`: `pending: PendingDecisionInput`, `onDecide(decision)`. `BlockedDecisionNotice`: `blocked: BlockedDecision`.
**Processamento (intermediário):** estado local `values: Record<string,string>` (texto por input). No submit, monta `context: Record<string, number|string|boolean>` coagindo cada `pending.inputs[i]` via `coerce()` (transitório: 'true'/'false'→boolean, numérico→number, resto→string).
**Saídas:** `onDecide({kind:'decision', node: pending.nodeId, context})`; JSX form com inputs; notice com `blocked.cell` + `blocked.reason` + link para limitations.md.
**Estruturas de dados que trafegam:** `PendingDecisionInput` {nodeId, label, inputs: string[]}, `BlockedDecision` {nodeId?, cell?, reason}, `Decision` (variante 'decision').

### `packages/react/src/simulation/edgePath.ts`
**Papel:** Recomputa a geometria exata que o EdgeRenderer pinta, para o token percorrer a rota real arredondada.
**Entradas:** `edgeGeometryFor(edge: BpmnEdge, source?: BpmnNode, target?: BpmnNode, edgeRouter: EdgeRouterFn)`; `nodeCenter(node: BpmnNode)`.
**Processamento (intermediário):** se `edge.waypoints.length>=2` → `waypointsToPath(points, EDGE_CORNER_RADIUS)` com start/end/midpoint derivados dos pontos; senão delega ao `edgeRouter(source,target)`. `null` se endpoint faltando.
**Saídas:** `EdgeGeometry | null`; `nodeCenter` → `{x,y}` (centro em coordenadas de mundo).
**Estruturas de dados que trafegam:** `BpmnEdge`, `BpmnNode`, `EdgeGeometry`, `EdgeRouterFn`.

---

## replay

### `packages/react/src/replay/BpmnReplay.tsx`
**Papel:** Superfície do modo replay — editor read-only com heatmap de frequência, chips ⌀, desvios e token de variante amostrada; seletor de versão no header e card de comparação que anexa a análise à promoção (tudo por injeção do host).
**Entradas:** `BpmnReplayProps` — `diagram`, `traces?: Trace[]` (modo plano), `versions?: ReplayVersion[]` (bindRun por versão), `candidate?: {semanticVersion, change}`, `onAttachAnalysis?(analysis: ReplayAnalysis)`, `author='replay'`, `fileName='event-log.xes'`, `plugins?`, `onExit?`, `now=()=>ISO`.
**Processamento (intermediário):** `nodeLabel(id)` (label via diagram). `defaultVersionId` (useMemo: 1ª versão com runs). Estado local: `selectedVersionId`, `attached: boolean`. `activeVersion`/`activeTraces` (por versão selecionada). `replay = useReplay(diagram, activeTraces, formatDuration)`. `analysis` (useMemo) = `summarizeReplay(replay.log, {diagramId, versionId, semanticVersion, author, timestamp:now(), label, formatMs, candidateSemanticVersion, candidateChange})`. Objeto `comparison` transitório {headline, candidateSemanticVersion, attached, onAttach}.
**Saídas:** JSX — pill "MODO REPLAY", tablist de versões (`vX · N execuções`/`candidata`), overlay `<ReplayOverlaySvg>`, legenda, `<ReplayPanel>`; callback `onAttachAnalysis(analysis)`.
**Estruturas de dados que trafegam:** `ReplayVersion` {versionId, semanticVersion, status?, runCount, traces: Trace[]}, `BpmnReplayProps`, `ReplayAnalysis` {headline,...}, `Trace`, `AggregatedLog`.

### `packages/react/src/replay/useReplay.ts`
**Papel:** Controller em torno da agregação headless de replay — constrói o grafo abstrato do diagrama, agrega o log em 1 passada e conduz o token de playback de uma variante amostrada.
**Entradas:** `diagram: BpmnDiagram`, `traces: Iterable<Trace>`, `formatMs(ms)=>string`.
**Processamento (intermediário):** `graph = useMemo(diagramToReplayGraph(diagram))`; `log = useMemo(aggregate(graph, traces))`. `nameToId` (Map nome-normalizado→id via `normalizeName`). Estado local: `selectedDeviation: number|null`, `playingVariant: number|null`, `step: number`, `timer` (ref setInterval, STEP_MS=650). `sequence` (useMemo) = variante em reprodução resolvida para sequência de node-ids. `useEffect` avança o token pela sequência; para no fim. `variantTokenNodeId = sequence[step]`.
**Saídas:** `UseReplayResult` — `graph`, `log`, `selectedDeviation`, `selectDeviation`, `playingVariant`, `variantTokenNodeId`, `playVariant`, `stopVariant`, `formatMs`.
**Estruturas de dados que trafegam:** `ReplayGraph` {nodes[{id,name}], edges[{id,source,target}]}, `AggregatedLog`, `Trace`, `UseReplayResult`.

### `packages/react/src/replay/ReplayOverlaySvg.tsx`
**Papel:** Heatmap SVG em coordenadas de mundo — espessura de aresta ∝ frequência (nunca só cor) com label de contagem, chips ⌀ de tempo por nó (gargalo em vermelho), desvios tracejados clicáveis e token de variante violeta.
**Entradas:** props — `log: AggregatedLog`, `selectedDeviation: number|null`, `onSelectDeviation(index)`, `variantTokenNodeId: string|null`. Contextos: `diagram`, `config`.
**Processamento (intermediário):** `maxCount = reduce(log.edges, max count)`. `geom(edgeId)` via `edgeGeometryFor`. Por aresta: `heatWidth(edge.count, maxCount)`. Por desvio: centros dos nós `from`/`to`, ponto médio `mid`, path quadrático; ignora endpoints não mapeados. Por nó: `isBottleneck = stat.nodeId===log.bottleneckNodeId`, label `⌀ {formatDuration(avgMs)}` (+GARGALO), largura calculada.
**Saídas:** SVG `<g data-replay-overlay>` — paths de heatmap + `<text>` contagem, paths de desvio + label "▲ DESVIO · N casos" (clicáveis → `onSelectDeviation`), chips ⌀ por nó, disco de token violeta.
**Estruturas de dados que trafegam:** `AggregatedLog` {edges[{edgeId,count}], deviations[{from,to,cases}], nodes[{nodeId,avgMs}], bottleneckNodeId}, `EdgeGeometry`.

### `packages/react/src/replay/ReplayPanel.tsx`
**Papel:** Painel de 306px que substitui o inspector no modo replay — resumo de import, fitness de token-replay, lista de desvios clicáveis, variantes amostradas com ▶ Reproduzir e card de comparação/anexação à promoção.
**Entradas:** `ReplayPanelProps` — `fileName`, `log: AggregatedLog`, `nodeLabel(id)`, `selectedDeviation`, `onSelectDeviation`, `playingVariant`, `onPlayVariant`, `onStopVariant`, `comparison?: ReplayComparison`. `t` de `useT()`.
**Processamento (intermediário):** desestrutura `{fitness, deviations, variants}` de `log`. `fitPct = fitness.fitness*100` (transitório). `empty = log.totalCases===0`. Helpers `pct()`, `int()` (pt-BR), `endpointLabel()` (endpoints não mapeados começam com '?'). Mapeia deviations e variants para listas.
**Saídas:** JSX `<aside>` — meta de casos/eventos/unmapped, card fitness com progressbar, card comparação (`comparison.headline` + botão anexar), lista de desvios, lista de variantes com play/stop; callbacks `onSelectDeviation/onPlayVariant/onStopVariant/comparison.onAttach`.
**Estruturas de dados que trafegam:** `ReplayComparison` {headline, candidateSemanticVersion, attached, onAttach?}, `ReplayPanelProps`, `AggregatedLog` (fitness {fitness, totalMoves, conformingCases, totalCases}, deviations, variants {signature,count,share,activities}, unmapped).

### `packages/react/src/replay/diagramToReplayGraph.ts`
**Papel:** Adaptador do host (injeção, não import) — projeta um BpmnDiagram no grafo abstrato `{nodes,edges}` que o engine headless espera.
**Entradas:** `diagram: BpmnDiagram`.
**Processamento (intermediário):** filtra `activeNodes` removendo container/dataObject/dataStore/textAnnotation/group → `{id, name: label||id}`; `nodeIds` Set transitório; filtra `activeEdges` removendo messageFlow/association/dataAssociation e endpoints ausentes → `{id, source, target}`.
**Saídas:** `ReplayGraph` — `{nodes:[{id,name}], edges:[{id,source,target}]}`.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `ReplayGraph`.

### `packages/react/src/replay/format.ts`
**Papel:** Formatação de duração humana (pt-BR) para os chips ⌀ e cálculo da espessura do heatmap.
**Entradas:** `formatDuration(ms: number)`, `heatWidth(count: number, maxCount: number)`.
**Processamento (intermediário):** `num()` formata com vírgula decimal; `formatDuration` escolhe unidade (s/min/h/dias) por faixas; `heatWidth` = `2 + 6*sqrt(min(count,maxCount)/maxCount)` (banda 2–8px).
**Saídas:** string formatada (ex.: "6,4 h"); número (largura de traço).
**Estruturas de dados que trafegam:** apenas primitivos (number → string/number).

---

## agent

### `packages/react/src/agent/AgentStudio.tsx`
**Papel:** Editor modal de sub-workflow de agente (Agent Studio) sobre o Designer — pilha de undo ISOLADA, simulação mock com trilha, proposta de error-boundary não-silenciosa e registro de sessão no ledger.
**Entradas:** `AgentStudioProps` — `open`, `workflow: AgentWorkflow`, `workflowRef?`, `lifecycleStatus?`, `openedFrom?`, `onSave(workflow)`, `onClose()`, `agentTaskId?`, `simulationFixtures?: Fixtures`, `onRecordSimulation?(record: AgentSimulationRecord)`, `author?`, `timestamp?`. Contextos: `emitEditorEvent` (useEditorConfig), `diagram`+`execute` (useDiagram), `t` (useT), `useDismissal`.
**Processamento (intermediário):** `useReducer(agentEditorReducer, workflow, initEditorState)` → `state` {past,present,future}. Estado local: `selectedId`, `sim: SimulationState|null`, `simStep`, `recorded`, `boundaryResolved`, `proposalOpen`, `timer` (ref). `wf = state.present`. `runSim` → `simulate(wf, {fixtures})` e passo a passo (400ms/step, ou salto sob reduced-motion). `apply(result: EditResult)` dispatcha 'apply' + emite eventos N-3 (`element.added/changed/removed`, `command.executed`). `handleSave`→`onSave(wf)` + abre proposta boundary se `hasErrorBoundary`. `acceptBoundary`→`proposeErrorBoundaryCommand(diagram, agentTaskId)` + `execute(command)`. Derivados transitórios: `issues=validateGraph(wf)`, `errors`, `level=wf.autonomyLevel`, `needsGate`, `layout=layoutWorkflow(wf)`, `pos` Map, `width/height`, `tokNodeId`/`tokenAt`, `simStatus`.
**Saídas:** JSX modal (dialog) — header (título, seal, pill de autonomia, undo/redo/simular/salvar), paleta de nós/decoradores/templates, canvas SVG (edges, nós, token de simulação animado), inspector/`SimulationView`, card de proposta boundary, footer de validação; callbacks `onSave`, `onClose`, `onRecordSimulation(record)`; `execute(Command)` na pilha do macro; eventos do editor.
**Estruturas de dados que trafegam:** `AgentStudioProps`, `AgentSimulationRecord` {workflowRef, steps, complete, blocked?{nodeId,reason}, author, timestamp}, `AgentWorkflow`, `AgentNode`, `SimulationState` (trail[{step,nodeId,message}], complete, blockedDecision), `ValidationIssue`, `EditResult`, `Fixtures`, `NodeType`.

### `packages/react/src/agent/agentEditor.ts`
**Papel:** Transforms puros de edição + pilha de undo ISOLADA (reducer imutável) para o sub-workflow do Agent Studio; layout determinístico do canvas.
**Entradas:** funções recebem `workflow: AgentWorkflow` + params (type, id, patch, from/to, edgeType, decorator). Reducer: `(state: AgentEditorState, action: AgentEditorAction)`.
**Processamento (intermediário):** `DEFAULT_CONFIG` por NodeType (llm/tool/decision). `nextNodeId` (id determinístico `<type>-<n>`). `addNode/updateNodeConfig/removeNode/addEdge/toggleDecorator` retornam NOVO `AgentWorkflow` (nunca mutam) + `EditEffect`. `defaultDecorator` (memory/planner/errorBoundary). Reducer mantém `past/present/future` + `lastEffect` + `historyOp`. `layoutWorkflow`: BFS por colunas (ignora edges 'delegate'), `succ` Map, `column` Map, `rowByCol` Map → `NodeLayout[]`.
**Saídas:** `EditResult` {workflow, effect}, `AgentEditorState`, `NodeLayout[]` {id,x,y,width,height}.
**Estruturas de dados que trafegam:** `EditEffect` {event, kind, id?, elementType?}, `EditResult`, `AgentEditorState` {past,present,future,lastEffect,historyOp}, `AgentEditorAction` (apply/undo/redo/reset), `AgentWorkflow`, `AgentNode`, `AgentEdge`, `NodeLayout`, `DecoratorType`, `EdgeType`, `NodeType`.

### `packages/react/src/agent/agentBoundary.ts`
**Papel:** O ÚNICO comando undoável que PROPÕE um boundary event de erro no agentTask do macro quando o sub-workflow carrega um decorador errorBoundary.
**Entradas:** `proposeErrorBoundaryCommand(diagram: BpmnDiagram, hostId: string)`.
**Processamento (intermediário):** `host = diagram.nodes[hostId]` (null se ausente). Transitórios: `id=`${hostId}_errBoundary``, `size {36,36}`, `position = boundaryNodePosition(host,'bottom',0.75,size)`, `node = createNode({type:'boundaryEvent', eventDefinition:'error', ...})`.
**Saídas:** `Command | null` — `compositeCommand('Propose agent error boundary', [addNodeCommand(node), attachBoundaryCommand(...)])` (um undo remove a proposta inteira).
**Estruturas de dados que trafegam:** `BpmnDiagram`, `BpmnNode`, `Command`.

---

## copilot

### `packages/react/src/copilot/CopilotPanel.tsx`
**Papel:** Painel de chat de 372px onde a IA só RASCUNHA — provider injetado pelo host, proposta validada localmente (whitelist + rejeição integral), plano aplicado como comando composto e footer rastreável no ledger; "Desfazer tudo" reverte o plano inteiro em um undo.
**Entradas:** `CopilotPanelProps` — `provider?: AIProvider`, `resolveLedgerHash?()=>Promise<string|undefined>`, `author='anônimo'`, `promptStatus?(template)=>string`. Contexto: `diagram, execute, undo, stack` (useDiagram), `t` (useT).
**Processamento (intermediário):** estado local: `messages: ChatEntry[]`, `input`, `busy`, `applied`, `conversationId` (ref generateId), `history: Msg[]` (ref — histórico de conversa), `appliedState: BpmnDiagram|null` (ref). `empty` (diagrama vazio → escolhe `COPILOT_DRAFT_PROMPT` senão `COPILOT_ADJUST_PROMPT`). `sndErrors = useMemo(soundnessErrors(diagram))`. `ask(text, promptTemplate?)`: monta `context` (JSON com nodes {id,type,label} + edges {id,sourceId,targetId}) e empurra em `history`; chama `provider.complete({system, messages})` → `raw`; `parseProposal(raw)`; `validateProposal(diagram, proposal)` (verdict com errors); `buildPlan(diagram, proposal, {providerId, conversationId})`; `execute(plan.command)`; resolve `ledgerHash`; empurra ChatEntry com footer. Botão "fix" reusa o mesmo pipeline com `COPILOT_FIX_PROMPT`.
**Saídas:** JSX `<aside>` — header (provider id, template+versão, pill), selo de autoria mista, lista de erros de soundness + botão sugerir correção, chat com footer mono (autoria, ledger, comando, soundness), textarea, botões gerar/ajustar/desfazer-tudo; efeitos: `execute(Command)`, `undo()`.
**Estruturas de dados que trafegam:** `CopilotPanelProps`, `ChatEntry` {role, text, footer?{author,commandId,ledgerHash?,soundness: SoundnessPreview}, error?}, `Msg` {role, content}, `AIProvider`, `CopilotPromptTemplate`, `PromptTemplateRef`, `SoundnessPreview` {errors,warnings}, `CopilotPlan` (command, soundnessPreview) via `buildPlan`.

---

## workers

### `packages/react/src/workers/executor.ts`
**Papel:** Harness genérico de compute off-thread (opt-in) — mesma registry roda in-thread (SyncExecutor) ou dentro de um Worker; job = função pura de entrada serializável → saída serializável.
**Entradas:** `createSyncExecutor(registry: JobRegistry)`, `createWorkerExecutor(worker: Worker)`, `createWorkerHandler(registry)`. Runtime: `run(job: string, input: unknown)`; mensagens `WorkerRequest`/`WorkerResponse`.
**Processamento (intermediário):** Sync: resolve `fn = registry[job]`, `Promise.resolve(fn(input))`. Worker: `nextId` contador, `pending: Map<number, {resolve,reject}>`; `onMessage` casa `data.id` e resolve/rejeita; `postMessage(WorkerRequest)`. Handler: executa `fn(request.input)`, embrulha em WorkerResponse (result ou error).
**Saídas:** `ComputeExecutor` {run→Promise<Output>, dispose}; postMessage payloads `WorkerRequest` {__btvJob:true, id, job, input}; retorno `WorkerResponse` {__btvJob:true, id, result?, error?}.
**Estruturas de dados que trafegam:** `ComputeJob<Input,Output>`, `JobRegistry` (Record<string,ComputeJob>), `ComputeExecutor`, `WorkerRequest`, `WorkerResponse`.

### `packages/react/src/workers/jobs.ts`
**Papel:** Jobs de compute built-in que a camada react POSSUI — só roteamento; a registry padrão do worker.
**Entradas:** `routeJob` recebe `RouteJobInput` {diagram: BpmnDiagram, router?: string ('astar'|'orthogonal'|'bezier'|'straight')}.
**Processamento (intermediário):** resolve o router NOMEADO (funções não cruzam a fronteira do worker) via `resolveRouter(router??'astar', cubicBezierConnection)` e roda `deriveAstarRoutes(diagram, router)` (a passada A* cara).
**Saídas:** `BpmnDiagram` re-roteado; `DEFAULT_JOBS: JobRegistry` = `{ route: routeJob }`.
**Estruturas de dados que trafegam:** `RouteJobInput`, `BpmnDiagram`, `ComputeJob`, `JobRegistry`.

### `packages/react/src/workers/worker.ts`
**Papel:** Entry-point do módulo Worker — liga `createWorkerHandler(DEFAULT_JOBS)` ao `onmessage`, guardado para ser no-op fora de um DedicatedWorker real.
**Entradas:** mensagens `event.data` do escopo do worker (deve ter `__btvJob:true`).
**Processamento (intermediário):** `handleWorkerMessage = createWorkerHandler(DEFAULT_JOBS)`. `scope` cast de globalThis; guarda por `WorkerGlobalScope`/`addEventListener`/`postMessage` (para não disparar em jsdom/SSR/build).
**Saídas:** `postMessage(handleWorkerMessage(data))` — resposta `WorkerResponse`; export `handleWorkerMessage` para teste unitário.
**Estruturas de dados que trafegam:** `WorkerRequest`, `WorkerResponse`.

---

## i18n

### `packages/react/src/i18n/messages.ts`
**Papel:** Primitivo de i18n zero-dependência — resolve chave contra o dicionário ativo com fallback EN por chave, seleção de plural e interpolação `{token}`.
**Entradas:** `translate(dict, fallback, key, params?)`, `mergeMessages(...dicts)`.
**Processamento (intermediário):** `pluralKey` escolhe sibling `_one`/`_other` por `params.count`; `interpolate` faz um passe de replace `{token}`→`params[token]`. `mergeMessages` = Object.assign left-to-right.
**Saídas:** string traduzida; dicionário mesclado.
**Estruturas de dados que trafegam:** `Messages` (Record<string,string>), `TParams` (Record<string, string|number>), `TFunction`.

### `packages/react/src/i18n/I18nContext.tsx`
**Papel:** Context React de i18n — deriva o `t` ativo do dicionário injetado pelo host no topo da árvore; EN é sempre o fallback.
**Entradas:** `I18nProvider({messages?: Messages, children})`; consumidores via `useT()`.
**Processamento (intermediário):** `DEFAULT_T` = `translate(EN, EN, ...)`. `t = useMemo(() => (key,params) => translate(messages??EN, EN, key, params), [messages])`.
**Saídas:** `<I18nContext.Provider value={t}>`; `useT()` retorna `TFunction` (fallback DEFAULT_T fora de provider).
**Estruturas de dados que trafegam:** `TFunction`, `Messages`.

### `packages/react/src/i18n/en.ts` / `packages/react/src/i18n/ptBR.ts`
**Papel:** As duas tabelas de lookup planas oficiais — `EN` (fallback completo embutido) e `PT_BR` (segundo dicionário oficial), montadas a partir de todos os fragmentos.
**Entradas:** `FRAGMENTS` (array de `{en, ptBR}`).
**Processamento (intermediário):** `mergeMessages(...FRAGMENTS.map(f => f.en))` / `...f.ptBR`.
**Saídas:** `EN: Messages`, `PT_BR: Messages` (mapas chave→string planos).
**Estruturas de dados que trafegam:** `Messages`.

### `packages/react/src/i18n/fragments/index.ts`
**Papel:** Registro de todos os fragmentos de dicionário — uma entrada por grupo de superfície migrada.
**Entradas:** imports dos 12 fragmentos.
**Processamento (intermediário):** array `FRAGMENTS` na ordem de montagem.
**Saídas:** `FRAGMENTS: Array<{en: Messages; ptBR: Messages}>`.
**Estruturas de dados que trafegam:** `Messages`.

### Fragmentos de dicionário (`fragments/*.ts`) — dados que carregam
Cada arquivo é um `{ en: Messages; ptBR: Messages }` com mapas chave→string (namespaced por superfície), pares de plural `_one`/`_other` e tokens `{token}` de interpolação. Resumo por superfície de UI que os dados alimentam:

- **`toolbar.ts`** (`toolbar.*`) — barra de ferramentas do editor: undo/redo, zoom/fit/snap, export XML/JSON/SVG/PNG, limpar/resetar roteamento (com plurais de arestas re-otimizadas/rotas manuais preservadas), resultado de validação.
- **`properties.ts`** (`properties.*`) — inspector de propriedades: label/propósito, versão criada/encerrada, supersedes, add/remover propriedades, contagem de elementos selecionados.
- **`palette.ts`** (`palette.*`, `minimap.*`) — labels aria da paleta de elementos e do minimapa (labels de item vêm dos plugins, não das chaves).
- **`versioning.ts`** (`version.*`, `diff.*`, `breadcrumb.*`, `status.*`, `signature.*`) — banner/timeline de versão, diff, breadcrumb de governança e o conjunto CANÔNICO de rótulos de selo de status (DRAFT/CANDIDATE/ACTIVE/...) e assinatura.
- **`pedigree.ts`** (`pedigree.*`, `payload.*`, `anchor.*`) — tira de pedigree da aresta, card de payload canônico assinado e selo de âncora (ancorada/pendente/quebrada).
- **`ledgerStatus.ts`** (`ledgerStatus.*`) — chip de verificação do ledger e popover de relatório (cadeia íntegra/adulterada, entradas reverificadas).
- **`promotion.ts`** (`promotion.*`) — painel de promoção formal: change_summary, aprovadores/assinatura, soundness, cobertura, avisos de ativação (deprecação, runs presas), toasts de ledger.
- **`copilot.ts`** (`copilot.*`) — painel do copiloto: título, pill "SÓ RASCUNHA", soundness, gerar/ajustar/desfazer, placeholders.
- **`menus.ts`** (`contextMenu.*`, `edgeLabel.*`, `nodeLabel.*`) — menu de contexto e editores de rótulo inline.
- **`simulation.ts`** (`sim.*`, `replay.*`) — painel de simulação, cards de escolha de gateway/decisão e painel de token-replay (fitness, desvios, variantes, legenda de import XES/CSV).
- **`studio.ts`** (`studio.*`, `review.*`, `ledger.*`) — shell do Studio, Revisão do Aprovador (fila, request, diff, análise de replay anexada, decisão) e Ledger Explorer (verificação de cadeia, âncora, trilha, detalhe de entrada, query).
- **`agentStudio.ts`** (`agent.*`) — o Agent Studio inteiro: título/autonomia, paleta de nós/decoradores/templates, inspector, footer de validação, simulação mock, proposta de boundary, escolha de template.

---

## Síntese de dados das features

Formas de dado principais que atravessam estas superfícies (definidas nos engines headless, projetadas aqui para UI):

- **`SimulationState`** — estado vivo do `SimulationEngine`: `tokens[{nodeId}]`, `traversedEdges: string[]`, `trail: TransitionRecord[]`, `pendingChoice`, `pendingDecisionInput`, `blockedDecision`, `boundaryOptions`, flags `complete`/`deadlocked`. Flui para overlay (tokens/arestas) e painel (trilha/status).
- **`TransitionRecord` / `TokenTravel`** — passo do engine (step, type 'move'/'split', edgeId, nodeId, message, approximate) convertido em `TokenTravel` {key, edgeId, targetNodeId, durationMs} para animação SVG `<animateMotion>`.
- **`Decision` / `PendingChoice` / `PendingDecisionInput` / `BlockedDecision`** — o contrato de escolha do usuário: gateway exclusive/inclusive/eventBased ou decisão S-FEEL (context Record<string, number|string|boolean>) ou o "stop honesto".
- **`CoverageSummary` + `SimulationSession`** — cobertura de caminhos {covered, total, paths[{id,label,covered}]} e o artefato de sessão registrável no ledger {scenarioHash, coverage, author, timestamp}.
- **`ReplayAnalysis` / `AggregatedLog`** — resultado da agregação de log: `edges[{edgeId,count}]`, `nodes[{nodeId,avgMs}]`, `bottleneckNodeId`, `deviations[{from,to,cases}]`, `variants[{signature,count,share,activities}]`, `fitness`, `totalCases/totalEvents`, `unmapped`; `ReplayAnalysis` {headline,...} anexável à promoção.
- **`ReplayGraph`** — projeção `{nodes:[{id,name}], edges:[{id,source,target}]}` do BpmnDiagram (adaptador do host).
- **`AgentEditorState` / `AgentEditorAction` / `EditResult`** — histórico isolado (past/present/future/lastEffect/historyOp) de `AgentWorkflow` + `EditEffect` (element.added/changed/removed) para eventos N-3.
- **`AgentWorkflow` / `AgentNode` / `AgentSimulationRecord`** — grafo de agente (nós llm/tool/decision + decorators memory/planner/errorBoundary + autonomyLevel) e o registro de sessão simulada.
- **`CopilotPlan` (buildPlan) + proposta** — `parseProposal(raw)` → proposta validada (`validateProposal`) → `plan {command: Command, soundnessPreview: {errors,warnings}}`; comando composto único aplicado via `execute`, revertível em um undo.
- **`Msg` / `AIProvider` / `ChatEntry`** — histórico de conversa (role/content), transporte do provider injetado e entradas de chat com footer rastreável (author, commandId, ledgerHash, soundness).
- **`WorkerRequest` / `WorkerResponse` / `ComputeJob`** — payloads de postMessage `{__btvJob:true, id, job, input}` ⇄ `{__btvJob:true, id, result?, error?}`; job puro serializável (ex.: `RouteJobInput` {diagram, router?} → BpmnDiagram re-roteado).
- **`Messages` / `TFunction` / `TParams`** — mapas planos chave→string (EN fallback + PT_BR), montados de 12 fragmentos; `t(key, params)` com plural `_one`/`_other` e interpolação `{token}`.
