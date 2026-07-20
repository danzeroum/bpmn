# Mapa de Dados — Apresentação React (editor + UI)

> Parte do catálogo de dados do sistema (ver `docs/documentação/README.md`).
> Cobre os arquivos de editor/UI de `packages/react/src` (exceto simulation,
> replay, agent, copilot, workers, i18n — ver 03-react-features.md).

Este documento cataloga **todos** os dados que circulam na camada de
apresentação editor/UI: entradas (props, params, estado de store/context,
eventos de ponteiro/teclado), dados intermediários (locais transitórios,
cálculos de coordenadas, throttling por rAF, seletores) e saídas (JSX/SVG,
`Command`s despachados, `setState` no `canvasStore`, eventos de editor,
callbacks e efeitos colaterais).

Dois **eixos de dados** dominam a camada:

- **Dado visual/interação** — o `CanvasState` (store externo por instância,
  `state/canvasStore.ts`): viewport, seleção, gestos em andamento
  (`dragState`, `connectState`, `resizeState`, `selectionBox`, `edgeDrag`),
  `boundarySnap`, `settling`, `issueBadges`, `dismissals`, `contextMenu` etc.
  Atualizado a alta frequência via `requestAnimationFrame`, nunca via context.
- **Dado de domínio** — o `BpmnDiagram` imutável, versionado pelo
  `CommandStack` dentro do `DiagramContext`. Toda mutação de domínio é um
  `Command` (undoável, auditado, sujeito ao `RuleEngine`).

O `EditorConfig` resolvido (`contexts/EditorConfigContext.tsx`) é o terceiro
dado estrutural: registry de tipos, shapes, paleta, estilos de aresta, engines
(rule/validation/lifecycle), roteador de arestas e canal de eventos — tudo
mesclado a partir dos plugins.

---

## entry

### `packages/react/src/index.ts`
> Δ 2026-07: passa a reexportar os novos subsistemas `commands/*` (menuRegistry/globalCommands) e `review/*` (`createInMemoryReviewStore`, `reviewThreadsRule`, tipos), o `BpmnDiffViewer`, e os novos componentes de ui (`SearchPanel`, `CommandPalette`, `Cheatsheet`, `EmptyState`, `LintPanel`, `TimerSection`) e helpers de `canvas/arrange`.
**Papel:** Barril de exportação pública do pacote `@buildtovalue/react` (editor completo + features).
**Entradas:** Nenhuma (apenas `export * from`/`export {}` de todos os módulos).
**Processamento (intermediário):** Nenhum — reexporta componentes de entrada, contexts, state, canvas, gestures, shapes, plugins, commands, ui, viewer/review, i18n e workers.
**Saídas:** Superfície de API (símbolos reexportados). O viewer leve e o `BpmnDiffViewer` também são reexportados aqui por compatibilidade drop-in.
**Estruturas de dados que trafegam:** Nenhuma própria; apenas re-tipos dos módulos referenciados.

### `packages/react/src/BpmnDesigner.tsx`
> Δ 2026-07: o chrome do `DesignerBody` agora monta também `<SearchPanel>`, `<CommandPalette>`, `<Cheatsheet>`, `<EmptyState>` (Handoff 15 §2f) e `<LayoutProposalCard>` (Handoff 14 §1e) — todos auto-gating.
**Papel:** Superfície de edição completa: canvas + gestos + command stack + sistema de plugins, com o chrome de versão.
**Entradas:** `BpmnDesignerProps` — `diagram: BpmnDiagram` (inicial), `plugins?: BpmnPlugin[]`, `onChange?: (BpmnDiagram) => void`, `readOnly?`, `children`/`overlay?: ReactNode`, `showClosed?`, `messages?: Messages`.
**Processamento (intermediário):** `useEditorConfig()` lê o config resolvido; `DesignerBody` extrai `config.ruleEngine`, `config.edgeRouter`, `config.emitEditorEvent` para injetar no `DiagramProvider`. Decisão condicional de montar `<I18nProvider>` apenas quando `messages` é dado (compose-not-shadow).
**Saídas:** Árvore de providers (`EditorConfigProvider` → `DiagramProvider` → `CanvasProvider`) envolvendo `<BpmnCanvas>`, `<ContextMenu>`, `<SearchPanel>`, `<CommandPalette>`, `<Cheatsheet>`, `<EmptyState>`, `<LayoutProposalCard>`, `<VersionBanner>`, `<ResilienceLayer>` (só editável) e `children`. Reexporta `resolveEditorConfig`.
**Estruturas de dados que trafegam:** `BpmnDesignerProps`, `BpmnDiagram`, `BpmnPlugin`, `Messages`, `EditorConfig` (via context).

### `packages/react/src/BpmnEditor.tsx`
**Papel:** Editor "baterias inclusas": `BpmnDesigner` + Toolbar + Palette + PropertiesPanel + MiniMap + StatusBadge no arranjo padrão.
**Entradas:** `BpmnEditorProps extends BpmnDesignerProps` + `toolbarExtra?: ReactNode`, `hidePalette?`, `hideInspector?`, `hideMiniMap?`.
**Processamento (intermediário):** Desestrutura flags de chrome; repassa `...designerProps`. Gate `!designerProps.readOnly` esconde a paleta.
**Saídas:** JSX de layout — `<div className="bpmnr-chrome-*">` posicionando as peças de chrome como `children` do `BpmnDesigner`.
**Estruturas de dados que trafegam:** `BpmnEditorProps`, `BpmnDesignerProps`.

### `packages/react/src/viewer.ts`
> Δ 2026-07: passa a reexportar também `BpmnDiffViewer`/`BpmnDiffViewerProps` e o contrato de review (`createInMemoryReviewStore`, `MIN_DISMISS_JUSTIFICATION`, `reviewThreadsRule`, tipos `ReviewStore`/`ReviewThread`/`ReviewMessage`) — a superfície de revisão é viewer-only por construção (Handoff 15 N-7).
**Papel:** Entrypoint leve, tree-shakeable, somente-leitura (`@buildtovalue/react/viewer`) — o substrato de render + pan/zoom e a superfície de diff/revisão, sem o grafo do editor.
**Entradas:** Nenhuma (barril).
**Processamento (intermediário):** Nenhum.
**Saídas:** Reexporta `BpmnViewer`, `ViewerCanvas`, `BpmnDiffViewer`, contrato de review, tipos de props, e `I18nProvider`/`useT`/`EN`/`PT_BR`/`Messages` para consumidores viewer-only.
**Estruturas de dados que trafegam:** `BpmnViewerProps`, `ViewerCanvasProps`, `BpmnDiffViewerProps`, `ReviewStore`, `Messages`, `TFunction`, `TParams`.

---

### `packages/react/src/simulation.ts` · `replay.ts` · `agent.ts` · `copilot.ts`
**Papel:** Barrels de subpath opt-in (`@buildtovalue/react/simulation` etc., espelhando `./viewer`) — consumidores editor-only não dependem de tree-shaking para descartar as superfícies pesadas; o barrel raiz segue reexportando por compatibilidade.
**Entradas/Saídas:** Reexports puros das superfícies respectivas (sem dados próprios).

## contexts

### `packages/react/src/contexts/DiagramContext.tsx`
> Δ 2026-07: novo `announceVeto(reason)` no `DiagramContextValue` (Handoff 17 ES-3) — canal para vetos ocorridos FORA do stack (connect rejeitado, Tab no shell de event subprocess), que compartilham o slot `lastVeto` (mesmo ciclo: substituído pelo próximo veto, limpo pelo próximo execute bem-sucedido). Novo hook tolerante `useDiagramOrNull()` para shapes puros fora de provider.
**Papel:** Guarda o **dado de domínio** — o `BpmnDiagram` imutável dirigido pelo `CommandStack` — e expõe execute/undo/redo + emissão de eventos de editor.
**Entradas:** `DiagramProviderProps` — `diagram`, `ruleEngine?`, `edgeRouter?: EdgeRouterFn`, `onChange?`, `emitEditorEvent?`, `children`.
**Processamento (intermediário):** `stackRef` cria uma única `CommandStack` semeada com `deriveAstarRoutes(diagram, edgeRouter)` (derivação de apresentação, fora do histórico/ledger); `useSyncExternalStore` assina `stack.current`; `lastVeto` em `useState`; refs para `onChange`, `edgeRouter`, `emitEditorEvent`; `loadedOnce` garante um único `diagram.loaded`. `emitElementEvent()` mapeia `command.toAuditEvent()` → eventos `element.added/removed/changed`. `execute()` chama `stack.execute` e captura o `RuleVerdict`.
**Saídas:** `DiagramContextValue` — `{ diagram, stack, execute, undo, redo, canUndo, canRedo, lastVeto, announceVeto, replaceDiagram }`. Efeitos colaterais: `onChange(next)` em cada mutação; eventos `diagram.loaded`, `command.executed|undone`, `element.*`. `replaceDiagram` reseta o stack (re-deriva A*) e re-emite loaded.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `CommandStack`, `Command`, `RuleEngine`, `RuleVerdict`, `EmitEditorEvent`, `DiagramContextValue`, `DiagramProviderProps`; sets `ELEMENT_ADDED`/`ELEMENT_REMOVED`.

### `packages/react/src/contexts/CanvasContext.tsx`
**Papel:** Provê o **store de estado visual** (`CanvasStore`) por instância e o hook de subscrição granular.
**Entradas:** `initial?: Partial<CanvasState>`, `children`.
**Processamento (intermediário):** `storeRef` cria uma única `createCanvasStore(initial)`; `useCanvasState(selector)` delega a `useStore` (re-render só quando o slice selecionado muda).
**Saídas:** Context com o `CanvasStore`; hooks `useCanvasStore()` e `useCanvasState<S>(selector)`.
**Estruturas de dados que trafegam:** `CanvasStore`, `CanvasState`, `Partial<CanvasState>`.

### `packages/react/src/contexts/EditorConfigContext.tsx`
> Δ 2026-07: o `EditorConfig` resolvido inclui `engine: EngineBridge | null` (Handoff 14 §1f — liga a aba "Execução") e `eventDefinitionResolver: EventDefinitionResolver | null` (Handoff 16 §3b — liga a seção "Da Biblioteca" e os chips de vigência), ambos "primeiro plugin vence".
**Papel:** Resolve e provê o `EditorConfig` — mescla de plugins com registry, shapes, paleta, estilos, engines, roteador, resolver de definições, bridge de execução e canal de eventos.
**Entradas:** `plugins?: BpmnPlugin[]`.
**Processamento (intermediário):** `resolveEditorConfig()` deduplica plugins por `id` (último vence); parte de `createDefaultRegistry`, `BUILT_IN_SHAPES`, `BUILT_IN_PALETTE(_GROUPS)`, `createDefaultRuleEngine`, `BUILT_IN_VALIDATION_RULES`, `cubicBezierConnection`; `wheelClaims: Map<number,string>` detecta colisão de `colorWheelDegree` (console.warn), valida cores reservadas (gold/green); loop de plugins acumula `nodeTypes`/`preferredTypes`, `shapes`, `edgeStyles`, `paletteItems`, `inspectorSections`, `paletteGroups` (merge por id), `validationRules`, `registerRules`, `eventHandlers`, `autosave`, `lifecycleConfig`, `edgeRouter` (via `resolveRouter`). `emitEditorEvent` carimba `ts: Date.now()` e faz fan-out; `warnDeprecatedAliasOnce` para `node.created`. `useMemo` sobre `plugins`.
**Saídas:** `EditorConfig` completo via context; hook `useEditorConfig()`; `resolveEditorConfig` exportada. Efeitos colaterais: `console.warn` de colisões/depreciações.
**Estruturas de dados que trafegam:** `EditorConfig`, `BpmnPlugin`, `NodeTypeRegistry`, `RuleEngine`, `ValidationEngine`, `LifecycleEngine`, `EdgeRouterFn`, `EdgeStyle`, `PaletteItem`, `PaletteGroup`, `InspectorSection`, `ShapeComponent`, `EditorEventName`/`EditorEventPayloads`.

---

## state

### `packages/react/src/state/canvasStore.ts`
> Δ 2026-07: além de `focusedElementId` (foco de teclado rondante — o elemento com `tabIndex=0`), muitos campos novos de UI (Handoffs 14–19): `alignGuides`/`spacingBadges` (smart guides), `searchOpen`, `paletteOpen` (⌘K), `cheatsheetOpen` ("?"), `lintOpen` (dock de lint), `layoutProposal` (proposta de auto-layout) + `layoutSettle` (crossfade pós-aplicar) e `searchPulse` (halos do hit de busca).
**Papel:** Define **todo o formato do dado visual** (`CanvasState`) e a fábrica do store.
**Entradas:** `createCanvasStore(partial?: Partial<CanvasState>)`.
**Processamento (intermediário):** Constrói o estado inicial (viewport 1200×800, `gridSize: 20`, `snapEnabled: true`, flags de overlay em `false`, coleções vazias) e faz merge com `partial`. Constantes `MIN_VIEWPORT_WIDTH=200`, `MAX_VIEWPORT_WIDTH=20000`.
**Saídas:** `CanvasStore` (= `Store<CanvasState>`).
**Estruturas de dados que trafegam (o dado visual central):**
- `Viewport` `{x,y,width,height}` — retângulo de mundo do `viewBox`.
- `selectedIds: string[]`, `focusedElementId`, `hoveredId`, `hoveredEdgeId`.
- `alignGuides` / `spacingBadges` — guias e badges de espaçamento durante o drag de um nó.
- `searchOpen` / `paletteOpen` / `cheatsheetOpen` / `lintOpen` — visibilidade dos overlays de busca / ⌘K / "?" / lint.
- `layoutProposal: LayoutProposalState | null` (`command`, `moved`, `reroutedCount`, `manualCount`, `baseDiagram`) — proposta de auto-layout pendente; `layoutSettle` — ghosts do crossfade pós-aplicar.
- `searchPulse: {elementId, token} | null` — 2 halos ao redor do hit (null sob reduced-motion).
- `DragState` — `nodeIds` (com descendentes + boundary), `rootIds` (só os agarrados, reparentam), `origin: Point`, `dx`/`dy` (offset visual), `active` (limiar 4px), `dropLaneId?`, `reparentTargetId?`.
- `ConnectState` — `sourceId`, `sourcePoint`, `currentPoint`, `hoverTargetId`, `invalidReason`.
- `SelectionBoxState` — `start`/`current: Point` (laço).
- `ResizeState` — `nodeId`, `corner: ResizeCorner`, `initial`/`current` rect, `origin`.
- `EdgeDragState` — `edgeId`, `index`, `waypoints: Point[]` (rota viva), `origin`, `grabbed`, `active` (R-3).
- `editingNodeId`/`editingEdgeId` (edição inline de rótulo).
- `isPanning`, `gridSize`, `snapEnabled`, `readOnly`.
- `lastCreatedNodeId` (animação de entrada), `dirtySinceExport` (guarda beforeunload), `drillId` (drill-down).
- `issueBadges: Record<string, NodeIssueBadge>` (`{severity, code?}`).
- `dismissals: DismissalEntry[]` (pilha única de Esc, `{id, close}`).
- `settling: SettlingEntry[] | null` (`{edgeId, path}` — crossfade de re-rota).
- `boundarySnap: BoundarySnapTarget | null` (`{hostId, side, t, point}`).
- `contextMenu: ContextMenuState | null` (`{kind, targetId?, client, world}`).

### `packages/react/src/state/createStore.ts`
**Papel:** Micro-store externo (zero deps) + hook de subscrição por slice.
**Entradas:** `createStore<T>(initial)`; `useStore(store, selector)`.
**Processamento (intermediário):** `setState` aceita patch ou função; compara chaves com `Object.is` e só notifica se algo mudou; `useStore` mantém `cache: {state, selected}` e usa `shallowEqual` para evitar re-render quando o slice é equivalente. `useSyncExternalStore` liga tudo.
**Saídas:** `Store<T>` (`getState`/`setState`/`subscribe`); valor selecionado memoizado.
**Estruturas de dados que trafegam:** `Store<T>`, cache `{state, selected}`.

### `packages/react/src/state/autosave.ts`
**Papel:** Persistência best-effort do diagrama em `localStorage` + leitura para recuperação.
**Entradas:** `writeAutosave(diagram)`, `readAutosave(diagramId)`, `clearAutosave(diagramId)`.
**Processamento (intermediário):** `storage()` protege contra modo privado/iframe; `computeDiagramHash(diagram)` gera `hash` (conteúdo, audit-independente); chave `bpmnr:autosave:${id}`; serializa/parseia JSON.
**Saídas:** `AutosavePayload` `{savedAt, hash, diagram}` gravado/lido; efeito colateral em `localStorage`. `AUTOSAVE_DEBOUNCE_MS=2000`.
**Estruturas de dados que trafegam:** `AutosavePayload`, `BpmnDiagram`.

---

## canvas

### `packages/react/src/canvas/Canvas.tsx`
> Δ 2026-07: a camada de overlay ganhou `ContextPad`, `AlignmentGuidesOverlay`, `SearchPulseOverlay`, `EventBindingOverlay`, `LayoutPreviewOverlay` e `LayoutSettleOverlay` (Handoffs 14–19); o `<svg>` editável recebe `tabIndex=0` (entrada de foco rondante de teclado — read-only fica byte-idêntico ao viewer).
**Papel:** O SVG `<svg>` principal do editor: pan/zoom via `viewBox`, monta defs, grid, arestas, nós e a camada de overlay; liga os gestos.
**Entradas:** `CanvasProps` `{ overlay?, showClosed=true }`. Do store: `viewport`, `gridSize`, `isPanning`, `drillId` (via `useCanvasState`). Do domínio: `diagram`. Config via `useEditorConfig`. Eventos de ponteiro/wheel do `<svg>`.
**Processamento (intermediário):** `useInteractions(svgRef)` produz o objeto de handlers; `useKeyboardShortcuts`. Efeitos: monitor de pacing por `requestAnimationFrame` durante pan (reporta `render.slow` uma vez/gesto se frame > 32ms); assinatura de `selectedIds` para emitir `selection.changed` (diff de arrays); listener nativo não-passivo de `wheel` → `applyWheelZoom`. `hiddenIds = hiddenNodeIds(diagram, drillId)` memoizado; `selectRenderList(diagram, hiddenIds, viewport, showClosed)` → `{nodes, edges}` visíveis/z-ordenados/culled. Banda semântica `1200/viewport.width >= SEMANTIC_ZOOM_MIN`.
**Saídas:** Árvore SVG (`Defs`, `GridLayer`, camadas `edges`/`nodes`/`overlay` com `SettlingOverlay`, `ConnectionPreview`, `BoundarySnapOverlay`, `ReparentTargetOverlay`, `SelectionBoxOverlay`, `EdgeLabelEditor` e `overlay`). `setState({viewport})` no zoom; eventos `render.slow`, `selection.changed`.
**Estruturas de dados que trafegam:** `CanvasProps`, `Viewport`, `BpmnDiagram`, `Interactions`, `{nodes: BpmnNode[], edges: BpmnEdge[]}`.

### `packages/react/src/canvas/viewport.ts`
> Δ 2026-07: novos `reducedMotion()` (lê `prefers-reduced-motion`) e `panViewportTo(store, x, y, rafRef)` — pan animado (ou instantâneo sob reduced-motion) usado por busca/lint/eventDefs para centralizar num elemento.
**Papel:** Matemática de viewport — conversão tela→mundo, zoom no cursor, pan, fit, wheel e pan animado.
**Entradas:** `screenToWorld(svg, clientX, clientY)`, `zoomViewportAt(viewport, worldPoint, factor)`, `panViewport(viewport, dxWorld, dyWorld)`, `applyWheelZoom(store, svg, event)`, `fitViewport(bounds, aspectRatio, padding=60)`, `panViewportTo(store, x, y, rafRef)`, `reducedMotion()`.
**Processamento (intermediário):** Usa `getScreenCTM().inverse()` com `DOMPoint` (fallback matemático via `viewBox` para jsdom); `clamp` da largura entre MIN/MAX; fator `Math.exp(deltaY*0.0015)`; recomputa `x/y/width/height` mantendo o ponto de mundo sob o cursor fixo; `panViewportTo` interpola o alvo por rAF (guarda o id em `rafRef`), instantâneo se `reducedMotion()`.
**Saídas:** Novos `Viewport`/`Point`; `applyWheelZoom`/`panViewportTo` fazem `store.setState({viewport})`; `boolean` de reduced-motion.
**Estruturas de dados que trafegam:** `Point`, `Viewport`, `CanvasStore`.

### `packages/react/src/canvas/culling.ts`
**Papel:** Virtualização (culling) do SVG — só renderiza elementos que interceptam o viewport expandido, acima de um limiar.
**Entradas:** `cullToViewport(nodes, edges, allNodes, viewport)`. `CULL_THRESHOLD=300`, `MARGIN_RATIO=0.5`.
**Processamento (intermediário):** `nodeRect`/`edgeRect` (bbox por waypoints ou centros de endpoints); `visibleRect(viewport)` expandido; `intersects(a,b)`. Abaixo do limiar retorna as listas por identidade.
**Saídas:** `{ nodes: BpmnNode[], edges: BpmnEdge[] }` filtrados.
**Estruturas de dados que trafegam:** `Rect` (local), `Viewport`, `BpmnNode`, `BpmnEdge`.

### `packages/react/src/canvas/visibility.ts`
**Papel:** Decide quais nós renderizam considerando sub-processos colapsados e o modo drill-down.
**Entradas:** `isNodeVisible(diagram, node, drillId)`, `hiddenNodeIds(diagram, drillId)`.
**Processamento (intermediário):** Sobe a cadeia de `nodeParentId` com `Set` anti-ciclo; esconde filhos de `subProcess` colapsado (`isSubProcessExpanded`); em drill, só mostra conteúdo do `drillId`; `drillId` obsoleto vira "sem drill".
**Saídas:** `boolean` / `Set<string>` de ids ocultos.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `BpmnNode`, `Set<string>`.

### `packages/react/src/canvas/renderList.ts`
**Papel:** Computação compartilhada de "o que pintar" — visível + z-ordenado + culled — usada pelo editor e pelo `ViewerCanvas`.
**Entradas:** `selectRenderList(diagram, hiddenIds, viewport, showClosed)`; `orderByZ(nodes, diagram)`. `SEMANTIC_ZOOM_MIN=0.6`.
**Processamento (intermediário):** Filtra `activeNodes`/`activeEdges` (ou todos, se `showClosed`) menos `hiddenIds`; `orderByZ` ranqueia pool(0)/lane(1)/profundidade de contenção (sort estável); delega a `cullToViewport`.
**Saídas:** `{ nodes, edges }`.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `BpmnNode[]`, `BpmnEdge[]`, `Set<string>`, `Viewport`.

### `packages/react/src/canvas/activeCache.ts`
**Papel:** Cache por-diagrama de `activeNodes`/`activeEdges` para os hot paths por frame (hit-testing, renderList, lasso, MiniMap). Vive na camada react de propósito: diagramas aqui vêm do `CommandStack` (structural sharing — identidade de objeto é chave válida); o core não pode cachear porque import/fixtures montam `diagram.nodes` mutando no lugar.
**Entradas:** `diagram: BpmnDiagram`.
**Processamento (intermediário):** `WeakMap<BpmnDiagram, BpmnNode[]/BpmnEdge[]>` — miss delega ao core e memoiza.
**Saídas:** `BpmnNode[]`/`BpmnEdge[]` (arrays compartilhados — read-only por convenção).
**Estruturas de dados que trafegam:** Funções `activeNodesCached`, `activeEdgesCached`.

### `packages/react/src/canvas/hitTest.ts`
**Papel:** Hit-testing puro extraído do `useInteractions` (parâmetros explícitos em vez de closures do hook — testável sem montar canvas).
**Entradas:** `diagram`, `registry: NodeTypeRegistry`, `drillId`, `dragged: BpmnNode`, `pointer/point: Point`.
**Processamento (intermediário):** `findBoundarySnapAt` varre hosts activity visíveis mantendo `best` por distância (zona `BOUNDARY_SNAP_THRESHOLD`); `findNodeAtPoint` filtra visíveis e varre em ordem reversa (topo vence) testando contenção no retângulo.
**Saídas:** `BoundarySnap|null` (`{hostId, side, t, point}`), `BpmnNode|undefined`.
**Estruturas de dados que trafegam:** Interface `BoundarySnap`; funções `findBoundarySnapAt`, `findNodeAtPoint`.

### `packages/react/src/canvas/useInteractions.ts`
> Δ 2026-07: o drag de um único nó agora passa por `computeGuideSnap` (smart guides, H14 §1b) — grava `alignGuides`/`spacingBadges` no store durante o move e os zera no `pointerup`; connect rejeitado usa o canal `announceVeto` (mesma superfície 🔒 do `lastVeto`).
**Papel:** Motor central de gestos de ponteiro — **produz dado transitório por rAF no `canvasStore` e comita `Command`s no `pointerup`**. Uma única `pointermove`/`pointerup` serve drag, connect, pan, laço, resize, edição de rota, boundary snap e context menu.
**Entradas:** `svgRef`; do domínio `{diagram, execute}`; store `canvasStore`; `config` (registry, ruleEngine, edgeRouter, emitEditorEvent). Eventos `ReactPointerEvent`/teclado (via shortcuts). `DRAG_THRESHOLD=4`.
**Processamento (intermediário) — dados transitórios:**
- `schedule(work)` acumula `pendingMove` e agenda **um** `requestAnimationFrame` (fallback `setTimeout(16)`), coalescendo movimentos de ponteiro.
- `diagramRef`/refs de sessão (`panSession {startClient, scale}`, `rafId`, `longPress` timer).
- `world(event)` = `screenToWorld`.
- **pointerdown** grava no store o gesto inicial: `dragState` (dobra descendentes `descendantIdsOf` + boundary `attachedBoundaryEventIds`, `rootIds` = agarrados), `connectState` (`getAnchorPoint`), `resizeState` (rect inicial), `edgeDrag` (waypoints de handle ou bend inserido em segmento), ou `selectionBox`/`panSession`.
- **onPointerMove (dentro do rAF):** por gesto ativo, recalcula: pan (delta client × scale → `panViewport`); `edgeDrag` (delta aplicado a `grabbed`, snap opcional, `active` por hipotenusa×escala>4, atualiza waypoint no `index`); `dragState` (`dx/dy` snapados, `dropLaneId` via `dropTargetLane`, `boundarySnap` via `findBoundarySnap` se evento solo, `reparentTargetId` via `subProcessContainerAt` — boundary tem precedência); `resizeState` (novo rect por corner com MIN=20); `connectState` (`findNodeAt`, veredito `ruleEngine.evaluate('edge.connect.pre')` → `invalidReason`); `selectionBox` (`current`).
- Locais que se perdem: `findBoundarySnap` percorre `activeNodes` calculando `nearestBoundaryAnchor` e `best {hostId, side, t, point, distance}`; `findNodeAt` itera nós em reverso; `appendRerouteCommands` monta snapshot `nextDiagram` pós-move e deriva `settling`.
**Saídas (commits no pointerup):** limpa o gesto no store e despacha `Command`s undoáveis via `execute`:
- edgeDrag ativo → `updateEdgeCommand({waypoints, routeMode:'manual', routeCollision?})`.
- dragState com snap → `attachBoundaryCommand`/`detachBoundaryCommand`; senão `moveNodeCommand[]` + `laneMembershipCommands` (`updateNodeCommand{flowNodeRefs}`) + `reparentCommands` (`updateNodeCommand{parentId}`) + reroutes (`appendRerouteCommands`), agrupados em `compositeCommand('Move nodes')`; grava `settling` no store (crossfade, salvo `prefers-reduced-motion`).
- resizeState → `resizeNodeCommand` + reflow de boundary (`moveNodeCommand`) em composite.
- connectState → `createEdge` (tipo `dataAssociation` se cruza data↔activity) + `addEdgeCommand`; seleciona a aresta; emite `edge.connected`.
- selectionBox → `setState({selectedIds})` com nós interceptados (`rectsIntersect` + `isNodeVisible`).
- `openContextMenu`/`onNode|Edge|CanvasContextMenu`/`armLongPress`(500ms touch)/`openContextMenuForSelection` gravam `contextMenu` (converte mundo↔client). `cancelGestures` zera todos os gestos.
**Estruturas de dados que trafegam:** `DragState`, `ConnectState`, `ResizeState`, `EdgeDragState`, `SelectionBoxState`, `BoundarySnapTarget`, `SettlingEntry`, `ContextMenuState`, `PanSession` (local), `Command`, `ConnectPayload`, `Point`, `Interactions` (retorno memoizado). Helpers `candidateLanes`/`laneAt`/`dropTargetLane`/`laneMembershipCommands`/`reparentCommands`/`appendRerouteCommands`/`prefersReducedMotion`/`svgScale`.

### `packages/react/src/canvas/NodeRenderer.tsx`
> Δ 2026-07: `ConnectedNode` consolida as ~7 assinaturas de store num único selector achatado em primitivos (cache shallowEqual efetivo por frame); foco de teclado rondante (`tabIndex` 0/-1 via `focusedElementId`, `data-focused`, `onFocus`); aria-labels/selo FECHADO via `useT()` (fragment `canvas.*`).
**Papel:** Renderiza um nó BPMN com halo de seleção, portas, handles de resize, selo de fechado, badge de issue, controles de sub-processo e editor inline de rótulo.
**Entradas:** `NodeRendererProps` — `node`, `selected`, `editable`, `interactions`, `dx`/`dy` (offset de drag), `connectHover: 'valid'|'invalid'|null`, `resizeRect`, `editing`. `ConnectedNode` lê do store: `selectedIds.includes`, `readOnly`, `dragState` (offset), `connectState.hoverTargetId`, `dropLaneId`, `resizeState.current`, `editingNodeId`, `lastCreatedNodeId`, `issueBadges[id]`, `hoveredId` (só closed), banda de sombra/zoom.
**Processamento (intermediário):** `SHADOW_MIN_ZOOM=0.5`; `rendered` = node com override de `resizeRect`; `typeDef` do registry; `hasShadow` some no drag; seletores booleanos evitam re-render por passo de zoom. `SubProcessControls` calcula posição do marcador [+]/[−] e drill.
**Saídas:** `<g transform="translate(x+dx,y+dy)">` com `Shape` (via `config.shapes[type]` ou `DefaultShape`, dentro de `ShapeErrorBoundary`), hatch de fechado, halo, `ClosedSeal`, `IssueBadge`, `ConnectionPorts` (→ `onPortPointerDown`), `ResizeHandles` (→ `onResizePointerDown`), `NodeLabelEditor`. Efeitos: `store.setState({hoveredId})`, `{lastCreatedNodeId:null}` no fim da animação, `execute(updateNodeCommand{isExpanded})` no toggle, `setState({drillId, viewport})` no drill.
**Estruturas de dados que trafegam:** `NodeRendererProps`, `BpmnNode`, `NodeIssueBadge`, `Interactions`.

### `packages/react/src/canvas/EdgeRenderer.tsx`
> Δ 2026-07: `ConnectedEdge` consolidado num selector achatado (sdx/sdy/tdx/tdy primitivos); foco rondante como nos nós; `<title>` de rota e aria via `useT()`.
**Papel:** Renderiza uma aresta: rota (waypoints/roteador/live), estilo por estado (closed/selected/domínio/fallback/manual), decorações, handles de edição de rota e rótulo.
**Entradas:** `EdgeRendererProps` — `edge`, `source`/`target`, `selected`, `hovered?`, `liveWaypoints?`, `readOnly?`, `interactions?`, `sourceOffset`/`targetOffset {dx,dy}`, `onSelect`, `onHoverChange`. `ConnectedEdge` lê do store: `selectedIds`, `hoveredEdgeId`, `readOnly`, `edgeDrag.waypoints` (se ativo p/ esta aresta), offsets de `dragState`. `chipsVisible` por zoom.
**Processamento (intermediário):** `CHIP_MIN_ZOOM=0.6`, `CHIP_MAX_CHARS=24`; escolhe `geometry: EdgeGeometry` (live > waypoints salvos > `config.edgeRouter` > `straightConnection` p/ DMN); `manual = isManualEdge`; deriva `stroke`/`strokeWidth`/`dash`/`marker` por precedência de estado; `fallback`/`collision`/`manualActive` por `edge.properties`; `editWaypoints`, `showHandles`, `editable`; `labelPoint` via `longestSegmentMidpoint`. `DOMAIN_MARKER` mapeia marker→id.
**Saídas:** `<g data-edge-id>` com path de hit invisível + path visível + decorações (`ApprovalCheckDisc`, `PurposeChip`, `FallbackChip`, `ManualBadge`), `RouteEditLayer` (segmentos → `onEdgeSegmentPointerDown`, handles → `onEdgeHandlePointerDown`/`onEdgeWaypointDoubleClick`), rótulo, `<title>` de purpose. `ConnectedEdge` faz `setState({hoveredEdgeId})` e `{selectedIds}` no select.
**Estruturas de dados que trafegam:** `EdgeRendererProps`, `BpmnEdge`, `BpmnNode`, `EdgeGeometry`, `Point[]`, `EdgeStyle`, `Interactions`.

### `packages/react/src/canvas/Defs.tsx`
**Papel:** `<defs>` SVG compartilhados: arrowheads, marcadores de domínio, filtros de sombra, padrões de grid e hatch de fechado; e a camada de grid.
**Entradas:** `Defs({gridSize})`, `GridLayer({viewport})`.
**Processamento (intermediário):** IDs constantes exportados (`ARROW_MARKER_*`, `EDGE_MARKER_*`, `CLOSED_HATCH_PATTERN_ID`, `SHADOW_FILTER_ID`, `SHADOW_HOVER_FILTER_ID`); marcadores de domínio usam `context-stroke`.
**Saídas:** Elementos `<defs>` (filtros, markers, patterns) e um `<rect>` de grid sobredimensionado.
**Estruturas de dados que trafegam:** `{gridSize}`, `viewport` `{x,y,width,height}`; constantes de IDs.

### `packages/react/src/canvas/EdgeLabelEditor.tsx`
**Papel:** Editor inline de rótulo de aresta em `<foreignObject>` no ponto de rótulo (segmento mais longo).
**Entradas:** Store `editingEdgeId`; domínio `{diagram, execute}`; `config.edgeRouter`; `useT`.
**Processamento (intermediário):** `value` (useState), `inputRef`, `committedRef`; `route = edge.waypoints ?? computeRoutedWaypoints(...)`; `anchor = longestSegmentMidpoint(route)`; efeito seleciona texto ao iniciar edição.
**Saídas:** `<input>` posicionado; `commit()` → `execute(updateEdgeCommand{label})` se mudou; `close()` → `setState({editingEdgeId:null})`; cancela em Escape.
**Estruturas de dados que trafegam:** `BpmnEdge`, `Point[]`.

### `packages/react/src/canvas/NodeLabelEditor.tsx`
**Papel:** Editor inline de rótulo de nó em `<foreignObject>` sobre o nó.
**Entradas:** `{ node }`; domínio `{execute}`; store; `useT`.
**Processamento (intermediário):** `value` inicial `node.label`; `committedRef`; efeito de foco/seleção.
**Saídas:** `<input>`; `commit()` → `execute(updateNodeCommand{label})` se não-vazio e mudou; `close()` → `setState({editingNodeId:null})`.
**Estruturas de dados que trafegam:** `BpmnNode`.

### `packages/react/src/canvas/ResilienceLayer.tsx`
> Δ 2026-07: banner de recuperação via `useT()` (`canvas.recovery.*`) — antes PT fixo.
**Papel:** Resiliência do editor: autosave debounced, banner de recuperação e guarda `beforeunload` enquanto sujo.
**Entradas:** `config.autosave`; domínio `{diagram, execute, stack}`; store; `diagramRef`.
**Processamento (intermediário):** Efeito assina `stack.subscribe` → marca `dirtySinceExport:true` e `setTimeout(writeAutosave, AUTOSAVE_DEBOUNCE_MS)`; efeito de detecção compara `computeDiagramHash(diagram)` com `saved.hash` → `recovery` (useState); efeito registra `beforeunload` que preventDefault se `dirtySinceExport`.
**Saídas:** `setState({dirtySinceExport})`; gravação em `localStorage`; banner `.bpmnr-recovery`; `restore()` → `execute(restoreDiagramCommand(recovery.diagram))`; `discard()` → `clearAutosave`.
**Estruturas de dados que trafegam:** `AutosavePayload`, `BpmnDiagram`.

### `packages/react/src/canvas/SettlingOverlay.tsx`
> Δ 2026-07: além do `SettlingOverlay` de arestas, exporta `LayoutSettleOverlay` (Handoff 14 §1e) — mesmo crossfade só-opacidade dos ghosts das posições ANTIGAS após aplicar uma proposta de layout, dirigido por `store.layoutSettle`.
**Papel:** Crossfade de acomodação (R-2b): pinta os paths de preview ortogonal por cima e faz fade-out para revelar a rota A* cacheada. `LayoutSettleOverlay` faz o análogo para os retângulos movidos por auto-layout.
**Entradas:** Store `settling: SettlingEntry[] | null` / `layoutSettle`. `SETTLE_MS=160`.
**Processamento (intermediário):** `opacity` (useState) vai 1→0 num rAF; `setTimeout` autoritativo limpa `settling`/`layoutSettle` no store após `SETTLE_MS+40`.
**Saídas:** `<g>` de paths/ghosts desvanecentes; `setState({settling:null})`/`{layoutSettle:null}`.
**Estruturas de dados que trafegam:** `SettlingEntry` `{edgeId, path}`; `layoutSettle.ghosts[]` `{id,x,y,width,height}`.

### `packages/react/src/canvas/ShapeErrorBoundary.tsx`
**Papel:** Error boundary por shape: um shape que lança vira placeholder de erro dimensionado ao nó; retenta quando a referência do nó muda.
**Entradas:** `ShapeErrorBoundaryProps` `{node, onError, children}`.
**Processamento (intermediário):** Estado `{error, failedFor}`; `getDerivedStateFromError`; `componentDidUpdate` reseta ao trocar `node`.
**Saídas:** `children` ou `<g data-shape-error>` (retângulo + `!` + tipo). Efeito: `onError({nodeId, nodeType, message})` → `shape.render.error`.
**Estruturas de dados que trafegam:** `ShapeErrorBoundaryProps`, `ShapeErrorBoundaryState`, `BpmnNode`.

### `packages/react/src/canvas/overlays.tsx`
> Δ 2026-07: novos overlays além dos de gesto — `AlignmentGuidesOverlay` (guias + badges de espaçamento, H14 §1b), `SearchPulseOverlay` (2 halos ao redor do hit de busca, H14 §1c), `LayoutPreviewOverlay` (ghosts "DEPOIS" da proposta de layout, H14 §1e) e `EventBindingOverlay` (chip governado `nome@semver` com selo ✓/⚠/✕, + chip de autoridade ↟ de escalação H18, + chip ⟲ de compensação H19). Todos transientes (nunca exportados).
**Papel:** Overlays de gesto e de estado em coordenadas de mundo: preview de conexão, highlight de boundary snap, highlight de reparent, retângulo de laço, guias de alinhamento, pulso de busca, ghosts de layout e chips de binding/autoridade/compensação.
**Entradas:** Store `connectState`, `boundarySnap`, `dragState.reparentTargetId`, `selectionBox`, `alignGuides`, `spacingBadges`, `searchPulse`, `layoutProposal`; domínio `diagram`; `config.eventDefinitionResolver`; `useT`.
**Processamento (intermediário):** `ConnectionPreview` deriva `invalid` de `invalidReason`; `SelectionBoxOverlay` computa `x/y/width/height` (ignora < 2px); `SearchPulseOverlay` limpa `searchPulse` ao fim da animação; `EventBindingOverlay` resolve `resolver.resolve(binding, kind)` → seal por estado, filtra chips de autoridade (`escalationAuthority` settled) e de compensação (`compensateActivityRef` ou broadcast).
**Saídas:** Elementos SVG (`<line>`/`<circle>`/`<rect>`/`<text>`); `SearchPulseOverlay` faz `setState({searchPulse:null})`; os demais são puramente visuais.
**Estruturas de dados que trafegam:** `ConnectState`, `BoundarySnapTarget`, `DragState`, `SelectionBoxState`, `AlignGuide[]`, `SpacingBadge[]`, `LayoutProposalState`, `EventDefinitionResolver`.

### `packages/react/src/canvas/routers.ts`
**Papel:** Roteadores de aresta nomeados (bezier/orthogonal/straight/astar) + resolução de nome→função.
**Entradas:** `roundedOrthogonalConnection`, `straightRouter`, `astarConnection`, `NAMED_ROUTERS`, `resolveRouter(value, fallback)`.
**Processamento (intermediário):** `astarConnection` delega a `routeAStar` lendo `context.obstacles`/`routedEdges`; aplica `waypointsToPath` com `EDGE_CORNER_RADIUS`.
**Saídas:** `EdgeGeometry`; `EdgeRouterFn` resolvida.
**Estruturas de dados que trafegam:** `EdgeRouterFn`, `EdgeRouterContext`, `EdgeGeometry`, `RouterName`.

### `packages/react/src/canvas/routeEdge.ts`
**Papel:** Ciclo de vida de roteamento A* (Handoff 10): resolução de preferência, obstáculos, re-rota em move, derivação em load, rotas manuais e colisões — tudo produzindo `Command`s ou dados de derivação.
**Entradas:** funções puras sobre `(diagram, edge, defaultRouter)` e sets de ids movidos; `CORRIDOR_GAP=8`, `PORT_HYSTERESIS=0.2`.
**Processamento (intermediário):** `resolveEdgeRouterName` (edge→diagram→editor); `edgeObstacles`/`routedEdgeWaypoints` (dados montados por render de rota); `computeRoutedWaypoints` (com hysteresis de porta via `sideOfAnchor`); `rerouteConnectedEdges` monta `EdgeReroute[]` sobre snapshot pós-move; `deriveAstarRoutes` cacheia waypoints `routeMode:'auto'`/`routeFallback`; `routeAndSpread` faz duas passadas e espalha corredores paralelos (`spreadPort`); `translateManualEdges`/`translateManualWaypoints` transladam rígido; `edgeRouteCollides`/`segmentIntersectsRect` (Liang–Barsky); `backToAutoPatch`; `clearRoutingCommands`.
**Saídas:** `Command[]` (`updateEdgeCommand`), `BpmnDiagram` derivado, `EdgeReroute`/`AutoRoute`/`ManualTranslation`/`ClearRoutingResult`, booleans de colisão.
**Estruturas de dados que trafegam:** `EdgeReroute`, `AutoRoute`, `ManualTranslation`, `ClearRoutingResult`, `RouteMode`, `Rect`, `Side`, `Point[]`, `EdgeRouterFn`/`EdgeRouterContext`.

### `packages/react/src/canvas/quickAdd.ts`
> Δ 2026-07: novo (Handoff 14 §1a) — "adicionar já conectado".
**Papel:** Cria o próximo elemento **já conectado** a um nó de origem, como UM `compositeCommand` (undo atômico). Compartilhado pelo context pad e pelo atalho `Tab` (encadeamento sem mouse).
**Entradas:** `quickAddPosition(diagram, source, size, drillId)`, `buildQuickAddCommand(diagram, registry, source, type, drillId)`. `QUICK_ADD_OFFSET=140`.
**Processamento (intermediário):** Posição = `source.centerX + 140` na mesma linha (com `max()` para nós largos), descendo em passos de +24 abaixo de slots ocupados (`findNodeAtPoint`, até 10 tentativas). `createNode`/`createEdge` herdam `versionId` e o `parentId` do escopo da origem.
**Saídas:** `{ command: compositeCommand('Append ${type}', [addNodeCommand, addEdgeCommand]), nodeId }`.
**Estruturas de dados que trafegam:** `BpmnNode`, `Command`, `NodeTypeRegistry`, `Point`.

### `packages/react/src/canvas/ContextPad.tsx`
> Δ 2026-07: novo (Handoff 14 §1a) — pad de ações do nó selecionado, estilo bpmn-js.
**Papel:** Coluna flutuante de ações ao lado do **único** nó selecionado: append task / XOR gateway / end event, conectar-a-existente, 5º slot de PLUGIN (contrato N-5) e ⋯ (abre o context menu, inclusive delete). Afordância passiva da seleção (como portas/handles): **não** entra na pilha de Esc — Esc limpa a seleção e o pad some junto.
**Entradas:** `{ interactions }`; domínio `{diagram, execute}`; store (`selectedIds` único, `readOnly`, `busy` de gesto, `drillId`, borda direita do viewport); `config` (registry, plugins); `useT`. `PAD_OFFSET=8`, `HALO=3`, `BUTTON=26`, `TOUCH_TARGET=44`.
**Processamento (intermediário):** Só renderiza com 1 selecionado não-container/não-fechado e sem gesto ativo. `quickAdd(type)` → `buildQuickAddCommand` + `execute` + seleção. Shell de event subprocess (ES-3 §4c) zera os appends/connect (veto shell-only); filhos mantêm o pad completo. 5º slot = primeiro `plugin.contextPadItems(target)` após `when()`. Flip para a esquerda quando colide com a borda; alvo de toque ≥44px em ponteiro grosseiro (`matchMedia('(pointer: coarse)')`).
**Saídas:** `<g data-context-pad role="toolbar">` de botões SVG; `execute(...)` de quick-add/plugin; `interactions.onPortPointerDown` (connect por drag) e `interactions.openContextMenuForSelection` (⋯).
**Estruturas de dados que trafegam:** `Interactions`, `ContextPadItem`, `MenuTarget`, `Command`, `PadEntry` (local).

### `packages/react/src/canvas/smartGuides.ts`
> Δ 2026-07: novo (Handoff 14 §1b) — guias de alinhamento + badges de espaçamento igual.
**Papel:** Enquanto **um** nó é arrastado, magnetiza bordas/centros a nós vizinhos e detecta espaçamento igual entre 3+ vizinhos (badges de distância estilo Figma). Puro. Candidatos limitados a nós que interceptam o viewport (custo por frame acompanha o visível); aplicado **depois** do snap de grade.
**Entradas:** `computeGuideSnap(diagram, drillId, viewport, dragged, dx, dy, excludeIds)`. `GUIDE_THRESHOLD=4`.
**Processamento (intermediário):** Coleta vizinhos visíveis via `activeNodesCached` + `isNodeVisible` + `rectsIntersect`; busca o melhor candidato de eixo (left/center/right e top/center/bottom, `|delta| ≤ 4`); `equalSpacing('h'|'v', ...)` detecta os casos "between" (equaliza os dois gaps) e "chain" (estende o ritmo dos dois vizinhos mais próximos). Só há espaçamento num eixo não já snapado (os dois ímãs brigariam).
**Saídas:** `GuideSnap` `{dx, dy, guides: AlignGuide[], badges: SpacingBadge[]}`.
**Estruturas de dados que trafegam:** `AlignGuide` (`axis, position, from, to`), `SpacingBadge` (`axis, value, from, to, position`), `GuideSnap`, `Candidate` (local), `Rect`, `BpmnNode`.

### `packages/react/src/canvas/arrange.ts`
> Δ 2026-07: novo (Handoff 14 §1e, item 2) — auto-layout como PROPOSTA + alinhar/distribuir.
**Papel:** Comandos de arranjo, cada um como UM composite de `moveNodeCommand`s (undo atômico, auditado). O auto-layout é uma **proposta** (cerca §1.7 — nada silencioso): `buildLayoutProposal` calcula as posições-alvo, translada rígido as rotas 📍 manuais dos nós movidos (o MESMO contrato `translateManualEdges` do drag, R-3 — nunca re-roteia) e empacota tudo como UM composite mais as contagens que o card mostra. Nada executa até o usuário confirmar.
**Entradas:** `buildLayoutProposal(diagram)`, `buildLayoutCommand(diagram)` (compat), `buildAlignCommand(diagram, nodes, mode)`, `buildDistributeCommand(diagram, nodes, axis)`.
**Processamento (intermediário):** `computeLayeredLayout` (core) → posições; `movesFrom` filtra no-ops; `manualTranslationsForLayout` agrupa nós por delta e passa cada grupo por `translateManualEdges` sobre um snapshot pós-move (grupos posteriores veem os shifts anteriores); `reroutedCount` conta arestas auto tocando nós movidos; `alignPositions`/`distributePositions` (core) para alinhar/distribuir.
**Saídas:** `LayoutProposal` `{command, moved: LayoutMove[], reroutedCount, manualCount, baseDiagram}`; `Command | null` para align/distribute; grava-se em `store.layoutProposal`.
**Estruturas de dados que trafegam:** `LayoutMove`, `LayoutProposal`, `ManualTranslation`, `AlignMode`, `Command`, `Point`, `Map<string, Point>`.

### `packages/react/src/canvas/eventBinding.ts`
> Δ 2026-07: novo (Handoff 16 §3b, estendido em H18 §5b) — refs governadas `nome@semver` de definições de evento.
**Papel:** Bindings governados de definição de evento: a string PINADA `nome@semver` em `properties.eventDefinitionBinding` (serializa como `bpmnr:property`, round-trip byte-estável). Mantém um MIRROR local read-only (`gov-{nome}`) para o export OMG ficar válido; o mirror conta como uso normal no veto de deleção.
**Entradas:** `eventBindingOf(node)`, `mirrorIdOf(binding)`, `isMirrorDefinition(id)`, `bindingStateOf(resolver, binding, kind)`, `buildBindCommand(...)`, `buildUnbindCommand(...)`, `eventBindingRule(resolver)`. `SIG_REF_MISSING`/`SIG_REF_STALE`.
**Processamento (intermediário):** `bindingStateOf` chama `resolver.resolve` → `active`/`stale`/`missing`; `buildBindCommand` = UM composite (upsert do mirror + `eventDefinitionRef` + pin do binding); `buildUnbindCommand` = UM composite que limpa ref/binding e faz GC do mirror órfão (bypass deliberado do veto por marcador, pois o unlink está no mesmo passo atômico); `eventBindingRule` gera issues `error`/`warning` que pintam via `issueBadges`.
**Saídas:** `Command` (composite), `BindingState`, `ValidationRule`, ids de mirror.
**Estruturas de dados que trafegam:** `EventDefinitionResolver`, `ResolvedEventDefinition`, `EventDefinitionRefKind`, `BindingState`, `ValidationRule`, `Command`, `BpmnNode`.

---

## shapes

### `packages/react/src/shapes/common.tsx`
> Δ 2026-07: `ActivityBox` agora também compõe `CompensationMarker` ◀◀ (Handoff 19 §6b) — lido de `properties.isForCompensation` (não de `marker`, que é loop/MI); desloca à esquerda quando há loop/MI para os dois marcadores coexistirem.
**Papel:** Tokens de tema, helpers de traço/preenchimento, rótulo com wrap e caixa de atividade compartilhada.
**Entradas:** `ShapeProps` (`{node, selected}`); params de `ShapeLabel` (`label, width, y, fontSize, color, maxLines, halo`). `EDGE_CORNER_RADIUS=8`.
**Processamento (intermediário):** `theme` (CSS vars); `strokeFor`/`strokeWidthFor`; `wrapLabel(label, charsPerLine, maxLines)` quebra palavras e trunca com `…` (dado transitório: array `lines`); `ActivityMarker` deriva glyph de `activityMarkerOf(node)`; `CompensationMarker` desenha o ◀◀ quando `isForCompensation`.
**Saídas:** `<text>`/`<g>`/`<rect>` SVG; `ActivityBox` compõe corpo+label+marker(+comp).
**Estruturas de dados que trafegam:** `ShapeProps`, `theme` (tokens), `string[]` de linhas.

### `packages/react/src/shapes/index.ts`
**Papel:** Barril de shapes + mapa `BUILT_IN_SHAPES` (nodeType → componente).
**Entradas:** Componentes de `shapes.js`.
**Processamento (intermediário):** Nenhum — monta o `Record<string, ShapeComponent>`.
**Saídas:** `BUILT_IN_SHAPES`, reexports (`DefaultShape`, `theme`, `ShapeLabel`, `wrapLabel`, `EDGE_CORNER_RADIUS`).
**Estruturas de dados que trafegam:** `Record<string, ShapeComponent>`.

### `packages/react/src/shapes/shapes.tsx`
> Δ 2026-07: `eventGlyph` ganhou os glifos `compensate` (rewind ◀◀, H19 §6b) e `escalation` (chevron); `StartEventShape` desenha DASHED quando não-interrupting (event subprocess, `startIsInterrupting` — H17 §4b); `SubProcessShape` reconhece o EVENT subprocess (`isEventSubprocess`) — borda pontilhada `2,3`, tag `event subProcess` e glifo de gatilho do start filho quando colapsado (via `useDiagramOrNull`/`childrenOf`, degradação declarada fora de provider).
**Papel:** Todos os componentes de shape BPMN built-in (eventos, tarefas, gateways, sub-process, call/agent activity, data, group, pool/lane, default).
**Entradas:** `ShapeProps` `{node, selected}` por shape; alguns leem `node.properties` (`decisionRef`, `calledElementLabel`, `agentWorkflowRef`), `eventDefinitionOf`, `isNonInterrupting`, `startIsInterrupting`, `isEventSubprocess`, `isSubProcessExpanded`; `useDiagramOrNull` (gatilho do event subprocess colapsado).
**Processamento (intermediário):** Cálculos geométricos locais (raios, diamantes, pentágono do event-gateway, cilindro do data store, dobra do data object, banda rotacionada de swimlane); `eventGlyph(kind, cx, cy, r, filled)` desenha glifos tipados (message/timer/error/signal/escalation/compensate/conditional/link/terminate). `SUBPROCESS_TITLE_HEIGHT=30` exportado.
**Saídas:** Elementos SVG puros (sem despacho nem store) — apenas apresentação.
**Estruturas de dados que trafegam:** `ShapeProps`, `BpmnNode`, `EventDefinitionKind`.

---

## gestures

### `packages/react/src/gestures/clipboard.ts`
**Papel:** Clipboard do editor: coleta do subconjunto selecionado, serialização auto-descritiva, remap de ids na colagem e transporte (navigator.clipboard + fallback interno de módulo).
**Entradas:** `diagram`, `selectedIds` (coleta); `payload: ClipboardPayload`, `options {description?, offsetX?, offsetY?, userId?}` (colagem); texto JSON (parse).
**Processamento (intermediário):** `collectClipboardPayload` filtra nós ativos selecionados + arestas com ambos os endpoints no conjunto (clones estruturais). `buildPasteCommand` gera UUIDs novos (`idMap`), remapeia `sourceId`/`targetId`/`parentId`/`attachedToRef`/`flowNodeRefs` (refs externas mantidas se o alvo ainda existe, descartadas senão; boundary sem host é descartado), aplica offset (+24 default), audit fresco e `createdInVersion` corrente, e monta UM `compositeCommand` (undo atômico). Transporte tenta `navigator.clipboard` e cai para variável de módulo.
**Saídas:** `ClipboardPayload|null`, `{command, newIds}|null`, `Promise<void>`/`Promise<ClipboardPayload|null>`.
**Estruturas de dados que trafegam:** Interface `ClipboardPayload` (`kind: 'bpmnr-elements'`, `nodes`, `edges`); const `PASTE_OFFSET`; funções `collectClipboardPayload`, `buildPasteCommand`, `serializeClipboardPayload`, `parseClipboardPayload`, `writeClipboardPayload`, `readClipboardPayload`, `hasClipboardContent`.

### `packages/react/src/gestures/useKeyboardShortcuts.ts`
> Δ 2026-07: além de Ctrl/Cmd+A (select-all), C/X/V (clipboard), D (duplicar) e navegação rondante por setas (Enter seleciona, Shift+Enter aditivo, nudge = 1px / Shift = grade), novos ramos read-only-safe Ctrl/Cmd+F (busca), "?" (cheatsheet) e Ctrl/Cmd+K (paleta ⌘K), e `Tab` (Handoff 14 §1a — quick-add encadeado via `buildQuickAddCommand`, com veto declarado no shell de event subprocess via `announceVeto`). Novo `KEYBOARD_SHORTCUT_CATALOG` exportado — fonte declarativa do cheatsheet, com teste de varredura amarrando cada tecla ao handler.
**Papel:** Atalhos de teclado do editor: undo/redo, busca/paleta/cheatsheet, select-all, clipboard, duplicar, quick-add (Tab), delete, escape (pilha de dismissal + cancelar gestos + subir breadcrumb), setas (nudge/rondar), espaço (pan).
**Entradas:** `interactions: Interactions`; domínio `{diagram, execute, undo, redo, announceVeto}`; store; `config` (registry, ruleEngine). Eventos `KeyboardEvent` (window). `KEYBOARD_SHORTCUT_CATALOG: ShortcutCatalogEntry[]`.
**Processamento (intermediário):** `isEditingTarget` ignora inputs; `meta = ctrl||cmd`; lê `state` do store (readOnly, contextMenu, dismissals, selectedIds, focusedElementId, drillId, gridSize); busca/"?"/⌘K abrem via `setState`; foco rondante usa `document.activeElement`/`data-node-id`; `Tab` (foco no canvas, 1 nó não-container) → `buildQuickAddCommand` ou veto ES-3; `arrows` map `{ArrowX:[dx,dy]}`; `step = shift?gridSize:1`. Escape: pop `dismissals.slice(0,-1)` e `top.close()`, senão cancelar seleção/gestos, senão subir um nível de drill (`fitViewport(getBoundingBox(scope))`).
**Saídas:** `undo()/redo()`; `execute(removeNodeCommand/removeEdgeCommand)` ou `compositeCommand('Delete selection')`; `moveNodeCommand`/`compositeCommand('Nudge selection')`; `setState({selectedIds:[]})`, `{drillId, viewport}`; `interactions.setPanKey`/`cancelGestures`/`openContextMenuForSelection`.
**Estruturas de dados que trafegam:** `Interactions`, `Command`, `BpmnDiagram`, `CanvasState` (lido).

### `packages/react/src/gestures/useDismissal.ts`
**Papel:** Registra um overlay aberto na pilha única de Esc (`dismissals`).
**Entradas:** `(id: string, open: boolean, close: () => void)`; store.
**Processamento (intermediário):** `closeRef` mantém o `close` atual (evita re-registro por identidade de closure); efeito adiciona/remove a entrada por ordem de abertura.
**Saídas:** `setState({dismissals})` com `DismissalEntry` `{id, close}` adicionada/removida.
**Estruturas de dados que trafegam:** `DismissalEntry`.

---

## plugins

### `packages/react/src/plugins/types.ts`
> Δ 2026-07: contrato ampliado — `PaletteItem.build`/`PaletteBuildContext`/`PaletteInsertResult` (itens compostos de paleta, incl. veto declarado, H17 ES-2); `ContextPadItem extends ContextMenuItem` + `glyph` e `BpmnPlugin.contextPadItems` (5º slot do context pad, H14 §1a); `BpmnPlugin.engine: EngineBridge` (aba Execução + chaves de I/O de evento, H14 §1f/H16 E-4) e `BpmnPlugin.eventDefinitionResolver: EventDefinitionResolver` + `EventDefinitionCatalogEntry`/`ResolvedEventDefinition` (refs governadas, H16 §3b); `EDITOR_EVENTS` cresceu para 16 com `review.thread.opened`/`review.thread.resolved`/`review.changes.requested` (H15 V-0).
**Papel:** Contrato de tipos da extensibilidade e do catálogo de eventos do editor — a "linguagem" de dados entre host/plugins e o editor.
**Entradas:** Nenhuma runtime (define types/consts). `EDITOR_EVENTS` (const), `DEPRECATED_EVENT_ALIASES`.
**Processamento (intermediário):** Nenhum executável relevante — declarações.
**Saídas:** Tipos e constantes exportados.
**Estruturas de dados que trafegam:**
- `ShapeProps`/`ShapeComponent`, `InspectorSection`, `PaletteItem` (com `build?`), `PaletteBuildContext`, `PaletteInsertResult` (`{command,selectId}` | `{veto}`), `PaletteGroup`.
- `ContextPadItem` (extends `ContextMenuItem` + `glyph`), `EngineBridge`, `EventDefinitionResolver`, `EventDefinitionCatalogEntry`, `ResolvedEventDefinition`.
- `EdgeRouterContext` (`obstacles: Rect[]`, `routedEdges: Point[][]`), `EdgeRouterFn`.
- `EDITOR_EVENTS`/`EditorEventName` e `EditorEventPayloads` (16 payloads tipados: `diagram.loaded`, `element.added/changed/removed`, `edge.connected`, `selection.changed`, `command.executed/undone`, `validation.changed`, `promotion.completed`, `import.warning`, `render.slow`, `shape.render.error`, `review.thread.opened`, `review.thread.resolved`, `review.changes.requested`).
- `DEPRECATED_EVENT_ALIASES` (`node.created` → `element.added`).
- `MenuTarget`, `ContextMenuItem`, `EditorEvent`/`EditorEventHandler`.
- `EdgeStyle` (stroke/dash/marker/routing/midDecoration).
- `BpmnPlugin` (id, colorWheelDegree, bodyColor, nodeTypes, shapes, paletteItems/Groups, inspectorSections, edgeStyles, validationRules, registerRules, lifecycleConfig, edgeRouter, onBeforeSave/onAfterLoad, onEditorEvent, contextMenuItems, contextPadItems, autosave, engine, eventDefinitionResolver).

---

## commands

### `packages/react/src/commands/menuRegistry.ts`
> Δ 2026-07: novo (Handoff 15 §2f, V-0 decisão 4) — O registro de comandos das superfícies do editor.
**Papel:** Builder puro dos built-ins condicionais do ContextMenu (extraídos VERBATIM, equivalência pinada por teste) + seções de plugin + ações de pad de plugin. ContextMenu, ⌘K e cheatsheet consomem ESTA fonte — nenhuma superfície define itens próprios, então não podem divergir. Toda ação despacha COMANDOS via `execute`.
**Entradas:** `builtinMenuItems(target, ctx)`, `pluginMenuItems(target, ctx)`, `pluginPadItems(target, ctx)`; `MenuBuildContext {execute, store, config, t}`.
**Processamento (intermediário):** Por `target.kind`: edge (back-to-auto, add-waypoint via `nearestSegmentIndex`/`computeRoutedWaypoints`/`straightRoute`, edit-label), node (edit-label, move-into/remove-from subprocess, copy/duplicate/delete via clipboard compartilhado, align×4 para 2+ nós, distribute×2 para 3+), canvas (paste ancorado no clique se há clipboard). Plugin: `when()` contra o target REAL; pad items dedupam pelo prefixo do plugin.
**Saídas:** `RegisteredMenuItem[]` (`{id, label, section?, run}`).
**Estruturas de dados que trafegam:** `MenuTarget`, `MenuBuildContext`, `RegisteredMenuItem`, `ContextMenuItem`, `ContextPadItem`, `Command`.

### `packages/react/src/commands/globalCommands.ts`
> Δ 2026-07: novo (Handoff 15 §2f) — comandos globais (nível toolbar) do registro.
**Papel:** Ações sem alvo de elemento — undo/redo, zoom/fit, snap, proposta de arranjo, select-all, find, cheatsheet, exports (XML/JSON/SVG/PNG). Presença espelha os guards da Toolbar (é o `when()` dos built-ins). `shortcut` é só notação de exibição; o dispatch fica em `useKeyboardShortcuts`.
**Entradas:** `builtinGlobalCommands(ctx: GlobalCommandContext)` — `{diagram, undo, redo, canUndo, canRedo, announceVeto?, ...MenuBuildContext}`.
**Processamento (intermediário):** Emite comandos condicionais (undo/redo só se disponível; arrange só se `computeLayeredLayout !== null` → grava `layoutProposal`); `zoomBy`/`fit` via `zoomViewportAt`/`fitViewport`; exports usam `BpmnXmlConverter`/`JsonSerializer`/`exportSvg`/`exportPng` + `applyBeforeSave` + `markSaved` (limpa autosave).
**Saídas:** `RegisteredGlobalCommand[]` (`RegisteredMenuItem` + `shortcut?`); efeitos via `store.setState`/`execute`/download.
**Estruturas de dados que trafegam:** `GlobalCommandContext`, `RegisteredGlobalCommand`, `BpmnDiagram`, `Command`.

### `packages/react/src/commands/paletteCommands.ts`
> Δ 2026-07: novo (Handoff 17 ES-2 reforço 8) — itens compostos de paleta como comandos ⌘K.
**Papel:** Cada `PaletteItem` com fábrica `build` vira `palette.insert.{id}`, resolvido pelo MESMO `insertPaletteItem` do clique da paleta — um comando, uma fonte. Itens simples ficam só na paleta. Vive no registro, nunca inline na paleta.
**Entradas:** `paletteInsertCommands(ctx: GlobalCommandContext)`.
**Processamento (intermediário):** Filtra `config.paletteItems` com `build !== undefined`; `run` chama `insertPaletteItem` com `announceVeto` (fallback no-op).
**Saídas:** `RegisteredGlobalCommand[]`.
**Estruturas de dados que trafegam:** `PaletteItem`, `GlobalCommandContext`, `RegisteredGlobalCommand`.

---

## ui

### `packages/react/src/ui/Palette.tsx`
> Δ 2026-07: o clique agora delega ao caminho ÚNICO `insertPaletteItem` (`ui/paletteInsert.ts`, ES-2 reforço 8) — mesmo código de posição+fábrica+seleção do ⌘K; itens compostos (`build`) e vetos declarados (🔒 via `announceVeto`) passam por lá. `element.added` continua emitido pelo canal de comando.
**Papel:** Paleta de elementos: clicar insere o item perto do centro do viewport (snapado/jitter) e seleciona.
**Entradas:** Domínio `{execute, announceVeto, diagram}`; store; `config` (registry, paletteItems/Groups); `useT`. `readOnly` esconde a paleta.
**Processamento (intermediário):** `createAt(item)` → `insertPaletteItem(item, {diagram, registry, store, t, execute, announceVeto})`. Agrupa itens em `byGroup: Map` + `ungrouped`; `groupStyle` gera CSS vars; `paletteItemLabel` traduz `palette.item.{id}` quando existe.
**Saídas:** `<nav>` de botões; via `insertPaletteItem`: `execute(command)` e `setState({selectedIds:[id], lastCreatedNodeId:id})` ou `announceVeto(reason)` no 🔒.
**Estruturas de dados que trafegam:** `PaletteItem`, `PaletteGroup`, `BpmnNode`, `Command`.

### `packages/react/src/ui/paletteItems.ts`
> Δ 2026-07: novos itens COMPOSTOS (com `build`) no grupo `events`: `eventSubprocess` (container + start tipado + definição nomeada, H17 §4b), `escalationBoundary` (boundary + definição local + ref, `cancelActivity:false`, H18 §5b) e `compensationPair` (boundary ⟲ + handler + associação, H19 §6b) — todos nascem lint-clean e podem DECLINAR com veto quando o drop não acha host.
**Papel:** Dados estáticos: grupos e itens da paleta built-in.
**Entradas:** `CORE_PALETTE_ICONS`; fábricas `buildEventSubprocessInsert`/`buildEscalationBoundaryInsert`/`buildCompensationPairInsert`.
**Processamento (intermediário):** Nenhum — arrays literais.
**Saídas:** `BUILT_IN_PALETTE_GROUPS` (`core`, `events` badge F6), `BUILT_IN_PALETTE` (inclui itens que fixam `defaultProperties` como `{eventDefinition:'timer'}`, `{cancelActivity:false}` e itens compostos com `build`).
**Estruturas de dados que trafegam:** `PaletteItem[]`, `PaletteGroup[]`.

### `packages/react/src/ui/paletteIcons.tsx`
> Δ 2026-07: novos ícones `eventSubprocess` (container pontilhado + start), `escalationBoundary` (anel tracejado + chevron) e `compensationPair` (anel + ◀◀) para os itens compostos.
**Papel:** Ícones de linha SVG built-in da paleta.
**Entradas:** Nenhuma (componentes estáticos).
**Processamento (intermediário):** Wrapper `Icon` (18px grid, `currentColor`).
**Saídas:** `CORE_PALETTE_ICONS: Record<string, ReactNode>`.
**Estruturas de dados que trafegam:** `Record<string, ReactNode>`.

### `packages/react/src/ui/paletteInsert.ts`
> Δ 2026-07: novo (Handoff 17 ES-2 reforço 8) — caminho ÚNICO de inserção de item de paleta, mais as fábricas dos itens compostos.
**Papel:** A fábrica única de inserção (posição + comando + seleção) compartilhada pelo clique na paleta e pela entrada ⌘K — um comando, uma fonte. Itens simples viram `addNodeCommand`; itens `build` delegam à sua fábrica (podendo declinar com veto).
**Entradas:** `insertPaletteItem(item, deps)`, `paletteInsertCommand(item, ctx)`, `paletteItemLabel(t, item)`, e as fábricas `buildEventSubprocessInsert`/`buildEscalationBoundaryInsert`/`buildCompensationPairInsert`.
**Processamento (intermediário):** `insertPaletteItem` lê `viewport/gridSize/snapEnabled`, calcula centro+jitter+snap, chama `paletteInsertCommand`; `'veto' in result` → `announceVeto` + `{allowed:false}`; senão `execute` + seleção. As fábricas compostas usam `typedMessageStartCommands`/`compensationHandlerCommands` (pacote lint, anti-drift com os quick-fixes), `boundaryAnchorOf`/`boundaryNodePosition` (âncora N-1) e `findNodeAtPoint` (exige host activity, reforço 7).
**Saídas:** `RuleVerdict`; `PaletteInsertResult` (`{command, selectId}` | `{veto}`); efeitos via `execute`/`announceVeto`/`setState`.
**Estruturas de dados que trafegam:** `PaletteItem`, `PaletteBuildContext`, `PaletteInsertResult`, `Command`, `RuleVerdict`, `NodeTypeRegistry`.

### `packages/react/src/ui/Toolbar.tsx`
> Δ 2026-07: novo botão "Arrumar" (Handoff 14 §1e) — `buildLayoutProposal(diagram)` grava `store.layoutProposal` (a PROPOSTA; o `LayoutProposalCard` aplica/recusa), nunca move direto.
**Papel:** Barra padrão: undo/redo, zoom/fit, snap, breadcrumb, arrumar (proposta), validar, exportar (XML/JSON/SVG/PNG), limpar roteamento, toast/veto/issues.
**Entradas:** Domínio `{diagram, execute, undo, redo, canUndo, canRedo, lastVeto}`; store (`snapEnabled`, `viewport.width`, `drillId`, `readOnly`); `config` (validationEngine, registry, preferredTypes, plugins, edgeRouter, emitEditorEvent); `useT`; `extra?: ReactNode`.
**Processamento (intermediário):** `issues`/`toast` (useState, `toast` some em 5s); `clearRouting(includeManual)` → `clearRoutingCommands` → `compositeCommand('Clear routing')` + monta string do toast; `zoomBy`/`fit` (`fitViewport` com aspect do svg); `validate()` roda `validationEngine.validate(applyBeforeSave())`, monta `badges` e faz `setState({issueBadges})` + emite `validation.changed`; `applyBeforeSave()` encadeia `plugin.onBeforeSave`; `markSaved()` limpa autosave + `dirtySinceExport:false`; `breadcrumbTrail`/`breadcrumbLevels`/`drillTo`; `slug()`.
**Saídas:** JSX de toolbar; `store.setState({viewport})`, `{snapEnabled}`, `{drillId, viewport}`, `{issueBadges}`; `execute(compositeCommand)`; download de arquivos (`downloadFile`/`exportSvg`/`exportPng`); eventos `validation.changed`.
**Estruturas de dados que trafegam:** `ValidationIssue[]`, `GovernanceBreadcrumbLevel[]`, `Command`, `BpmnDiagram`, `BpmnNode`.

### `packages/react/src/ui/PropertiesPanel.tsx`
> Δ 2026-07: com `config.engine` registrado, atividades/eventos executáveis ganham a aba "Execução" (Handoff 14 §1f — job type/retries + deploy GATED por VIGENTE+assinada, ou o card "⚑ Deploy bloqueado"; H16 E-4 adiciona payload de throw e variáveis de captura de erro via `eventExecutionModeOf`). Sem engine o painel é byte-idêntico. Novas seções condicionais de evento: `EventDefinitionSection` (definições nomeadas), `TimerSection` (timer), `CompensationSection` (throw de compensação) e `InterruptingToggle` (esub start / boundary).
**Papel:** Inspetor do elemento selecionado: abas geral/execução, rótulo, purpose (aresta), propriedades livres, seções de evento, seções de plugin, meta de versão, "voltar ao auto".
**Entradas:** Domínio `{diagram, execute}`; `config.inspectorSections`/`edgeRouter`/`engine`; store `selectedIds`/`readOnly`; `useT`.
**Processamento (intermediário):** Requer exatamente 1 selecionado; `node`/`edge` por id; `showTabs = engine !== null && executable` (`isExecutableActivity` ou `eventExecutionModeOf !== null`); `ExecutionInspector` separa chaves essenciais por modo + fold avançado + gate de deploy; `PayloadMappingEditor` (rows var→destino, `prunePayloadMappings`); `Field` mantém `draft` (useState, ressincroniza via effect); `PropertiesEditor` lista `Object.entries(properties)` e `parseValue(raw)`; `isManualEdge(edge)` gate do botão.
**Saídas:** `<aside>` de inspeção; `execute(updateNodeCommand/updateEdgeCommand{...})`, `updateEdgeCommand(backToAutoPatch(...))`; `engine.deploy(diagram)`/`engine.onRequestPromotion()`; renderiza as seções de evento e `inspectorSections` filtradas por `appliesTo`.
**Estruturas de dados que trafegam:** `BpmnNode`, `BpmnEdge`, `Record<string, unknown>` (properties), `InspectorSection`, `EngineBridge`, `EventExecutionMode`, `PayloadMapping`.

### `packages/react/src/ui/eventExecution.ts`
> Δ 2026-07: novo (Handoff 16 E-4, §3c) — matriz throw/catch de I/O de evento.
**Papel:** Matriz de eventos executáveis (semântica OMG, vive em react e não na engine): `throw` (mapeamentos payload var→destino: `intermediateThrowEvent`/`endEvent` message|signal) vs `catch-error` (variáveis errCode/errMsg: `boundaryEvent` de erro e `startEvent` de erro dentro de EVENT SUBPROCESS). Todo o resto → `null` (sem aba).
**Entradas:** `eventExecutionModeOf(diagram, node)`, `payloadMappingsOf(node, key)`, `prunePayloadMappings(rows)`.
**Processamento (intermediário):** Lê `eventDefinition` e `type`; `isEventSubprocess` (helper core, ES-1) restringe o error start; `payloadMappingsOf` filtra rows válidas; `prunePayloadMappings` remove rows em branco e retorna `undefined` para lista vazia (modelo limpo, bytes pré-E-4).
**Saídas:** `EventExecutionMode | null`; `PayloadMapping[]` / `undefined`.
**Estruturas de dados que trafegam:** `EventExecutionMode`, `PayloadMapping` (`{source, target}`), `BpmnNode`, `BpmnDiagram`.

### `packages/react/src/ui/EventDefinitionSection.tsx`
> Δ 2026-07: nova (Handoff 16 E-2, §3a) — seção "Evento" com picker de definição nomeada + refs governadas.
**Papel:** Picker de definição nomeada de evento com o fluxo «+» (UM composite: add + referência = 1 undo), rename inline com cascata por id, lista honesta de usos com click-to-navigate (pan animado U-4), deleção com veto pelo canal `lastVeto`, e refs governadas `nome@semver` do resolver injetado (bind/unbind, mirror read-only, selo de vigência). `errorCode`/`escalationCode` só para erro/escalação; autoridade de escalação (H18 §5b) como texto commitado no blur.
**Entradas:** `{ node, readOnly }`; domínio `{diagram, execute}`; store; `config.eventDefinitionResolver`; `useT`. Gate `eventKindOf(node)` (message/signal/error/escalation).
**Processamento (intermediário):** `findEventDefinition`/`eventDefinitionList`/`eventDefinitionUsages`; `setRef` despacha `buildBindCommand`/`buildUnbindCommand` (governadas) ou `updateNodeCommand{eventDefinitionRef}`; `createAndReference` = composite; `goTo(nodeId)` faz `panViewportTo` + `searchPulse`; `bindingStateOf`/`isMirrorDefinition` (mirror trava rename/código).
**Saídas:** `<section>`; `execute(...)` de comandos; `store.setState({selectedIds, focusedElementId, drillId?, searchPulse})`.
**Estruturas de dados que trafegam:** `BpmnNode`, `EventDefinitionRefKind`, `NamedEventDefinition`/`ErrorEventDefinition`, `EventDefinitionResolver`, `Command`.

### `packages/react/src/ui/TimerSection.tsx`
> Δ 2026-07: nova (Handoff 16 E-5, §3d) — editor de timer com preview humano.
**Papel:** Editor de timer: select de kind (date/duration/cycle) + expressão ISO 8601 + preview HUMANO derivado do resultado estruturado do parser (P1M mês vs PT1M minuto decidido no core). Expressão inválida mostra só o aviso glifo+texto; expressão vazia remove `properties.timer` (modelo limpo).
**Entradas:** `{ node, readOnly }`; domínio `{execute}`; `useT`. Gate `isTimerEvent(node)` (`eventDefinition === 'timer'`).
**Processamento (intermediário):** `timerPropertyOf(node)` semeia kind/expression (useState, ressincroniza por effect); `parseTimerExpression(kind, expr)`; `formatTimerPreview(parsed, t)`/`humanDuration`; `commit` compara JSON e só despacha se mudou.
**Saídas:** `<section>`; `execute(updateNodeCommand{timer})`.
**Estruturas de dados que trafegam:** `TimerKind`, `TimerParseResult`, `DurationParts`, `BpmnNode`.

### `packages/react/src/ui/CompensationSection.tsx`
> Δ 2026-07: nova (Handoff 19 §6b) — picker de alvo do throw de compensação.
**Papel:** Picker do alvo de um throw de compensação: lista as atividades compensáveis (com boundary ⟲) do próprio escopo — nunca definições; broadcast (escopo inteiro) é o DEFAULT. Fixa `compensateActivityRef`, que o chip transiente lê.
**Entradas:** `{ node, readOnly }`; domínio `{diagram, execute}`; `useT`. Gate `isCompensationThrow(node)`.
**Processamento (intermediário):** `flowScopeOf(diagram, node)`; `compensableActivitiesOf(diagram, scope)` (fonte única); `current` de `compensateActivityRef`.
**Saídas:** `<section>` com `<select>`; `execute(updateNodeCommand{compensateActivityRef})`.
**Estruturas de dados que trafegam:** `BpmnNode`, `Command`.

### `packages/react/src/ui/InterruptingToggle.tsx`
> Δ 2026-07: nova (Handoff 17 ES-3 §4c; boundaries em H18 §5b) — toggle "Interrompe o escopo".
**Papel:** Toggle interrupting para os dois casos OMG cujo default a personalidade inverte: um START de event subprocess (`isInterrupting`) e um boundary event (`cancelActivity`). Ambos os lados do predicado vêm dos helpers core (`startIsInterrupting`/`isNonInterrupting`); o default OMG (interrupting) é o campo AUSENTE. Boundary de compensação é excluído (dispara pós-conclusão).
**Entradas:** `{ node, readOnly }`; domínio `{execute}`; `useT`. Gates `hasInterruptingToggle`/`isEventSubprocessStart`.
**Processamento (intermediário):** `isBoundary` escolhe o campo (`cancelActivity` vs `isInterrupting`); `interrupting` derivado; toggle grava `undefined` (interrupting) ou `false` (não).
**Saídas:** `<section>` com checkbox; `execute(updateNodeCommand{[field]})`.
**Estruturas de dados que trafegam:** `BpmnNode`, `BpmnDiagram`, `Command`.

### `packages/react/src/ui/MiniMap.tsx`
**Papel:** Mapa de visão geral: cada nó como retângulo + o retângulo do viewport; clicar recentraliza.
**Entradas:** Domínio `{diagram}`; store `viewport`; `useT`. `WIDTH/HEIGHT/PADDING`.
**Processamento (intermediário):** `activeNodes`; `getBoundingBox`; `bounds` com padding; `mapped` = união de bounds+viewport; `recenter` converte clique→mundo.
**Saídas:** `<svg>` de minimapa; `setState({viewport:{...,x,y}})` no clique.
**Estruturas de dados que trafegam:** `BpmnNode[]`, `Viewport`, bbox `{x,y,width,height}`.

### `packages/react/src/ui/ContextMenu.tsx`
> Δ 2026-07: os built-ins e as seções de plugin agora vêm do REGISTRO extraído `commands/menuRegistry.ts` (`builtinMenuItems`/`pluginMenuItems`) — mesma fonte que a paleta ⌘K e o cheatsheet consomem (anti-drift por construção; equivalência pinada por teste). Além de copy/duplicate/paste, o registro traz align/distribute (`selection.*`) para seleções múltiplas.
**Papel:** Menu de contexto plugável (N-5): built-ins condicionais por tipo de alvo + seções por plugin; operável por teclado; registrado na pilha de Esc.
**Entradas:** Store `contextMenu: ContextMenuState`; domínio `{diagram, execute}`; `config.plugins`/`edgeRouter`; `useT`. `MENU_WIDTH=240`, `ITEM_HEIGHT=34`.
**Processamento (intermediário):** `activeIndex` (useState); `useDismissal('context-menu', ...)`; `items = useMemo` = `[...builtinMenuItems(target, ctx), ...pluginMenuItems(target, ctx)]` a partir de `MenuTarget {kind, id?, point:world, diagram, selectedIds}`. Flip nas bordas via `getBoundingClientRect`.
**Saídas:** `<div role="menu">`; `item.run()` (que despacha `execute(...)`/`setState({editingNodeId|editingEdgeId})`); `close()` → `setState({contextMenu:null})`.
**Estruturas de dados que trafegam:** `ContextMenuState`, `MenuTarget`, `RegisteredMenuItem`, `ContextMenuItem`, `Point`, `BpmnEdge`.

### `packages/react/src/ui/CommandPalette.tsx`
> Δ 2026-07: nova (Handoff 15 §2f) — paleta de comandos ⌘K.
**Papel:** Paleta Ctrl/Cmd+K SEM lista própria: cada linha vem dos registros existentes — `builtinMenuItems` (testado contra o ContextMenu), `pluginMenuItems`/`pluginPadItems` (respeitando `when()` contra a seleção REAL), `builtinGlobalCommands` (ações de toolbar) e `paletteInsertCommands` (itens compostos). Anti-drift: `paletteEntries` é exportada e o teste de varredura afere as linhas contra o agregado. Execução SEMPRE via `run()` → `execute`.
**Entradas:** Store `paletteOpen`; domínio `{diagram, execute, undo, redo, canUndo, canRedo, announceVeto}`; `config`; `useT`. `paletteEntries(target, ctx)`, `fuzzyScore(label, query)`.
**Processamento (intermediário):** `single`/`node`/`edge` → `MenuTarget` (node/edge/canvas no centro); `paletteEntries` dedupa por id; `fuzzyScore` (substring > subsequência); `index` navega por ↑↓; Esc anda na pilha única de dismissal; `useDismissal('command-palette', ...)`.
**Saídas:** `<div role="dialog">` com input + listbox por seção; `runEntry` fecha e chama `entry.run()`.
**Estruturas de dados que trafegam:** `RegisteredGlobalCommand`/`RegisteredMenuItem`, `MenuTarget`, `GlobalCommandContext`.

### `packages/react/src/ui/Cheatsheet.tsx`
> Δ 2026-07: nova (Handoff 15 §2f) — cheatsheet "?".
**Papel:** Folha de atalhos gerada, nunca escrita à mão: os atalhos vêm de `KEYBOARD_SHORTCUT_CATALOG` (declarado junto do handler; teste de varredura falha em tecla não declarada) e a lista de comandos é `paletteEntries` — o MESMO agregado do ⌘K. Não há terceira lista.
**Entradas:** Store `cheatsheetOpen`; domínio `{diagram, execute, undo, redo, canUndo, canRedo}`; `config`; `useT`.
**Processamento (intermediário):** Monta o `MenuTarget` como o ⌘K; `useDismissal('cheatsheet', ...)`.
**Saídas:** `<div role="dialog">` em duas colunas (atalhos + comandos).
**Estruturas de dados que trafegam:** `ShortcutCatalogEntry`, `RegisteredGlobalCommand`, `MenuTarget`.

### `packages/react/src/ui/EmptyState.tsx`
> Δ 2026-07: nova (Handoff 15 §2f) — estado vazio didático.
**Papel:** Mostra-se APENAS enquanto o diagrama tem zero elementos ativos (derivação pura, sem flag): ensina os três pontos de entrada (paleta / Tab / ⌘K) e oferece um exemplo governado de um clique (versão real com semver/status/summary/autor).
**Entradas:** Domínio `{diagram, replaceDiagram}`; store `readOnly`; `useT`. `buildGovernedExample(t)`.
**Processamento (intermediário):** `activeNodes(diagram).length > 0` ou `readOnly` → `null`; `buildGovernedExample` monta `createDiagram` + nós/arestas + bloco de versão.
**Saídas:** `<div data-bpmnr-empty-state>`; botão → `replaceDiagram(buildGovernedExample(t))`.
**Estruturas de dados que trafegam:** `BpmnDiagram`.

### `packages/react/src/ui/SearchPanel.tsx`
> Δ 2026-07: nova (Handoff 14 §1c) — barra de busca Ctrl/Cmd+F.
**Papel:** Busca no diagrama com LISTA de resultados (glifo + lane + tipo): casa label, id, type E valores de propriedade/ref (o diferencial). Enter/↑↓ andam pelos hits; cada hit é selecionado, o viewport panela ANIMADO e o alvo pulsa 2 halos (reduced-motion → pan instantâneo, zero pulsos). Esc pela pilha única.
**Entradas:** Store `searchOpen`; domínio `{diagram}`; `config.registry`; `useT`. `searchElements(diagram, query)`, `laneLabelOf(diagram, id)`.
**Processamento (intermediário):** `searchElements` varre `activeNodes`/`activeEdges` (label→id→type→property via `scanProperties`/`searchableValue`); `goTo(target)` faz `setState({selectedIds, focusedElementId, drillId?, searchPulse})` + `panViewportTo`; `visited` garante que o 1º passo pousa no item atual; `glyphFor` mapeia categoria→glifo; mostra até 8 + overflow.
**Saídas:** `<div role="search">` com input + listbox; `setState`/`panViewportTo`.
**Estruturas de dados que trafegam:** `SearchMatch` (`id, kind, label, type, matchedIn, propertyKey?, propertyValue?`), `BpmnDiagram`.

### `packages/react/src/ui/LayoutProposalCard.tsx`
> Δ 2026-07: nova (Handoff 14 §1e, cerca §1.7) — card Aplicar/Recusar do auto-layout.
**Papel:** "Arrumar" só PROPÕE: enquanto o card está aberto o canvas mostra ghosts nas posições-alvo (`LayoutPreviewOverlay`); Aplicar executa o UM composite (moves + translações 📍 rígidas) e toca o crossfade de 160ms (`layoutSettle`); Recusar/Esc descarta e NADA muda. Proposta computada contra um diagrama que mudou é descartada automaticamente.
**Entradas:** Store `layoutProposal`; domínio `{diagram, execute}`; `useT`. `useDismissal('layout-proposal', ...)`.
**Processamento (intermediário):** Guard de stale (`proposal.baseDiagram !== diagram` → `refuse`); `apply()` executa e grava `layoutSettle` (salvo reduced-motion); contagens `moved`/`reroutedCount`/`manualCount`.
**Saídas:** `<div role="dialog">`; `execute(proposal.command)`; `setState({layoutProposal:null, layoutSettle?})`.
**Estruturas de dados que trafegam:** `LayoutProposalState`, `LayoutMove`, `Command`.

### `packages/react/src/ui/LintPanel.tsx`
> Δ 2026-07: nova (Handoff 14 §1d) — dock de lint no editor.
**Papel:** Dock inferior redimensionável que lista os findings dos perfis de lint ativos, agrupados por regra (etiqueta + prontidão de engine na MESMA superfície; a tag `source` distingue). Clicar seleciona e panela ao elemento (mesmo pan animado da busca); quick-fix "corrigir" = 1 comando, "corrigir todos" = UM composite; findings sem fix mecânico mostram "✦ sugerir correção" (pipeline C5 do copilot, só com `AIProvider`). Enquanto aberto espelha findings como `issueBadges` no canvas.
**Entradas:** `LintPanelProps` `{provider?, profiles=LINT_PROFILES, initialHeight=240}`; domínio `{diagram, execute}`; store `lintOpen`/`readOnly`; `config.emitEditorEvent`; `useT`. `MIN_HEIGHT=120`, `MAX_HEIGHT=560`.
**Processamento (intermediário):** `lintFindings(diagram, profiles)` (useMemo); agrupa por `ruleId`; efeitos emitem `validation.changed` e populam/limpam `issueBadges`; `goTo` faz `panViewportTo` + seleção; `applyFix`/`applyAllFixes` via `fixCommandFor`; `suggest` roda `provider.complete` → `parseProposal`/`validateProposal`/`buildPlan` (copilot). Redimensiona por pointer.
**Saídas:** `<section>` (ou botão-toggle quando fechado); `execute(...)`; `setState({lintOpen, issueBadges})`; eventos `validation.changed`.
**Estruturas de dados que trafegam:** `LintFinding`, `LintProfile`, `AIProvider`, `NodeIssueBadge`, `Command`.

### `packages/react/src/ui/StatusBadge.tsx`
**Papel:** Selo de vigência — pill de status + semver + linha meta derivada da versão e do lifecycle engine; modo standalone via `seal`.
**Entradas:** `StatusBadgeProps` `{channel?, seal?}`; domínio `diagram.version`; `config.lifecycleEngine`; `useT`.
**Processamento (intermediário):** `distinctRoles` de `approvedBy`; meta condicional por status (candidate: `requiredApprovalRoles - roles`; active: `effectiveFrom`/`approvedBy`; deprecated/retired: `effectiveUntil`); `formatDate`. `SEAL_LABELS` exportado.
**Saídas:** `<span data-status>` com pill/semver/meta.
**Estruturas de dados que trafegam:** `VersionStatus`, `StatusBadgeSeal`, `StatusBadgeProps`.

### `packages/react/src/ui/SignatureBadge.tsx`
**Papel:** Badge de identidade criptográfica (valid/legacy/invalid) da aprovação.
**Entradas:** `SignatureBadgeProps` `{state, signer?, signatureFingerprint?, expected?, obtained?}`; `useT`.
**Processamento (intermediário):** `VERIFICATION_GLYPHS`/`VERIFICATION_LABELS`; label via `t`.
**Saídas:** `<span data-verification>` com glifo/label/signer/fingerprint ou mismatch.
**Estruturas de dados que trafegam:** `VerificationState`, `SignerIdentity`.

### `packages/react/src/ui/VersionBanner.tsx`
**Papel:** Banner fixo de contexto de versão (read-only ou versão superada) com contagem de elementos fechados.
**Entradas:** Domínio `diagram.version`/`nodes`/`edges`; store `readOnly`; `useT`.
**Processamento (intermediário):** `superseded = deprecated||retired`; auto-gating (não pinta se editável e não superada); `closedCount` conta `removedInVersion`.
**Saídas:** `<div role="note">` de contexto.
**Estruturas de dados que trafegam:** `VersionStatus`, contagens.

### `packages/react/src/ui/GovernanceBreadcrumb.tsx`
**Papel:** Componente de navegação hierárquica com selo de governança por nível.
**Entradas:** `GovernanceBreadcrumbProps` `{levels: GovernanceBreadcrumbLevel[], onNavigate, ariaLabel?}`; `useT`.
**Processamento (intermediário):** Mapeia níveis; último é `aria-current`, demais são botões.
**Saídas:** `<nav>` de breadcrumb; `onNavigate(id, index)` no clique.
**Estruturas de dados que trafegam:** `GovernanceBreadcrumbLevel` (`id, label, semanticVersion?, status?`).

### `packages/react/src/ui/exporters.ts`
**Papel:** Exportação SVG/PNG auto-contida — inlina CSS vars, imagens (data URI) e fontes; despoja artefatos transitórios.
**Entradas:** `svg: SVGSVGElement`; `filename`; `scale`.
**Processamento (intermediário):** `cloneForExport` clona, remove `TRANSIENT_SELECTORS` (ports, handles, selection-box, preview, halo, issue, closed-seal, settling), inlina `collectCustomProperties` (varre `styleSheets` por `--bpmnr-*`/`--btv-*`); `serializeWithAssets` faz `inlineImages`/`embedFonts` (via `fetchAsDataUri`/`blobToDataUri`); `exportPng` rasteriza no `<canvas>` com scale.
**Saídas:** `svgToString`; download de `.svg`/`.png` (`downloadFile` cria Blob + `<a>`).
**Estruturas de dados que trafegam:** `Record<string,string>` de custom props; strings SVG; `Blob`.

### `packages/react/src/ui/CanonicalPayloadCard.tsx`
**Papel:** Card "o que você está assinando" (payload canônico antes da assinatura).
**Entradas:** `{ payload: CanonicalApprovalPayload }`; `useT`.
**Processamento (intermediário):** `shortHash(hash)` (`#abcdef…`/`∅`).
**Saídas:** `<section>` com id/versão, `xmlHash`/`ledgerHead` curtos, decisão/role.
**Estruturas de dados que trafegam:** `CanonicalApprovalPayload`.

### `packages/react/src/ui/approvalPayload.ts`
**Papel:** Monta o payload canônico de aprovação a partir de diagrama + ledger (bytes idênticos ao Studio).
**Entradas:** `ApprovalPayloadInput` `{diagram, ledger?, decision, role, toXml?}`.
**Processamento (intermediário):** `toXml` (default `BpmnXmlConverter`); `xmlHash = sha256Hex(toXml(diagram))`; `ledgerHead` = último `hash` do ledger; delega a `buildApprovalPayload`.
**Saídas:** `Promise<CanonicalApprovalPayload>`.
**Estruturas de dados que trafegam:** `ApprovalPayloadInput`, `CanonicalApprovalPayload`, `AuditLedger`, `BpmnDiagram`.

### `packages/react/src/ui/AnchorSeal.tsx`
**Papel:** Selo de ancoragem externa da cabeça da cadeia (anchored/pending/none/broken) com retry.
**Entradas:** `AnchorSealProps` `{state, adapterId?, head?, anchoredHead?, onRetry?, retrying?}`; `useT`.
**Processamento (intermediário):** `ANCHOR_GLYPHS`/`ANCHOR_LABELS`; `short(hash)`.
**Saídas:** `<div data-anchor>`; `onRetry()` no botão pending.
**Estruturas de dados que trafegam:** `AnchorState`.

### `packages/react/src/ui/useAnchorCycle.ts`
**Papel:** Hook que dirige o ciclo de terceiro-estado de ancoragem (tenta ancorar+verificar; falha → pending; nunca regride).
**Entradas:** `(adapter?: AnchorAdapter, head?: AnchorHead)`.
**Processamento (intermediário):** `state`/`receipt`/`retrying` (useState); `attempt()` chama `adapter.anchor(head)` + `adapter.verify` → `deriveAnchorState`; catch → `pending`.
**Saídas:** `AnchorCycle` `{state, receipt?, retrying, retry}`.
**Estruturas de dados que trafegam:** `AnchorState`, `AnchorReceipt`, `AnchorAdapter`, `AnchorHead`.

### `packages/react/src/ui/DiffView.tsx`
**Papel:** Renderização estruturada e legível de um `BpmnDiff`.
**Entradas:** `DiffViewProps` `{diff: BpmnDiff, diagram?}`; `useT`.
**Processamento (intermediário):** `isEmptyDiff`; `nodeLabel(id)` resolve rótulo; `describeChanges`/`short` formatam mudanças de campo.
**Saídas:** `<div>` com seções nodes/edges/metadata e `OpTag` (add/remove/update/supersede).
**Estruturas de dados que trafegam:** `BpmnDiff`, `BpmnDiagram`.

### `packages/react/src/ui/PromotionPanel.tsx`
**Papel:** Fluxo formal de promoção: checklist de gates + diff embutido + aprovações por papel (com assinatura) + soundness + coverage + toast de ativação — reflete a máquina de estados do core.
**Entradas:** `PromotionPanelProps` (open, onClose, approvers, actor, baseline, suggestChangeSummary?, previousActive?, ledger?, onActivated?, coverage?, signerFor?, resolvePublicKey?, signedApprovals?, onApprovalSigned?); domínio `{diagram, replaceDiagram}`; `config` (lifecycleEngine, validationEngine, emitEditorEvent); `canvasStore`.
**Processamento (intermediário) — muitos estados transitórios:** `gates`/`error`/`toast`/`busy`/`suggestion` (useState); `payloads`/`signedLocal`/`badges` (Records, useState); `diff = computeDiff(baseline, diagram)` (useMemo); `trail = lifecycleTrail(engine)`; `soundnessErrors` (SND_* errors); efeitos: `evaluateGates` (async, guard `stale`), precompute de `payloads` por approver assinável, derivação de `badges` via `verificationState`. `approve()` assina (`signApproval`) e `replaceDiagram(engine.approve(...))`; `activate()` `engine.promote(...)`, `ledger.append(VERSION_ACTIVATED)`, monta toast.
**Saídas:** Dialog modal; `replaceDiagram(...)` (troca o diagrama + reseta stack); `canvasStore.setState({issueBadges, selectedIds})` no "ver no canvas"; `onApprovalSigned`/`onActivated`; evento `promotion.completed`; entrada no ledger.
**Estruturas de dados que trafegam:** `PromotionGate[]`, `BpmnDiff`, `CanonicalApprovalPayload`, `SignedApproval`, `ApproverBadge` (local), `AuditEntry`, `VersionStatus`, `UserContext`.

### `packages/react/src/ui/LedgerStatus.tsx`
**Papel:** Chip "ledger íntegro" que roda o verificador do host e mostra relatório em popover.
**Entradas:** `LedgerStatusProps` `{verify}`; `useT`.
**Processamento (intermediário):** `report`/`open`/`busy` (useState); `run()` aguarda `verify()`.
**Saídas:** Botão + popover com contagem/ponto de quebra (expected vs found).
**Estruturas de dados que trafegam:** `LedgerVerificationReport` `{intact, entries, firstBreak?, verifiedAt}`.

### `packages/react/src/ui/VersionTimeline.tsx`
**Papel:** Timeline vertical de versões (status, vigência, aprovadores, canal, runs fixadas) — presentacional e controlado.
**Entradas:** `VersionTimelineProps` `{items: VersionTimelineItem[], onSelect?, order?}`; `useT`.
**Processamento (intermediário):** `ordered` (reverse por `order`); `STATUS_COLOR` por status; `formatDate`.
**Saídas:** `<ol>` de itens; `onSelect(id)` no clique.
**Estruturas de dados que trafegam:** `VersionTimelineItem` (id, semanticVersion, status, changeSummary?, approvers?, channel?, effectiveFrom/Until?, pinnedRuns?, current?).

### `packages/react/src/ui/EdgePedigree.tsx`
**Papel:** Strip de pedigree de aresta: cadeia `getEdgeChain` como miniaturas reais (shapes registrados), diff entre versões adjacentes, hash no hover.
**Entradas:** `EdgePedigreeStripProps` `{edgeId, onClose?, ledgerHash?}`; domínio `{diagram}`; `config.shapes`; `useT`.
**Processamento (intermediário):** `chain = getEdgeChain(diagram, edgeId)` (useMemo); `diffIndex` (useState); `useDismissal` para diff e strip; `versionTag(edge)`; `diff = edgeVersionDiff(chain[i-1], chain[i])`; `CardSnapshot` computa viewBox e usa `straightConnection` + shapes dos endpoints.
**Saídas:** `<aside>` de pedigree com cards, "supersede ▸", `DiffView` embutido; `onClose()`.
**Estruturas de dados que trafegam:** `BpmnEdge`/`BpmnNode`, `BpmnDiff`, cadeia `BpmnEdge[]`, `SEAL_LABELS`.

---

## viewer

### `packages/react/src/viewer/BpmnViewer.tsx`
**Papel:** Viewer leve, tree-shakeable, somente-leitura — render byte-idêntico ao `<BpmnDesigner readOnly>` sem o grafo do editor.
**Entradas:** `BpmnViewerProps` `{diagram, plugins?, overlay?, showClosed?, messages?}`.
**Processamento (intermediário):** `useEditorConfig()` no `ViewerBody` injeta `ruleEngine`/`edgeRouter`/`emitEditorEvent` no `DiagramProvider`; `CanvasProvider initial={{readOnly:true}}` (nasce read-only). Compose-not-shadow do `I18nProvider`.
**Saídas:** Providers → `<ViewerCanvas>` + `<VersionBanner>` (auto-gating).
**Estruturas de dados que trafegam:** `BpmnViewerProps`, `BpmnDiagram`, `BpmnPlugin`, `Messages`.

### `packages/react/src/viewer/ViewerCanvas.tsx`
> Δ 2026-07: nova prop opcional `diffStates?: Record<string, DiffPaintKind>` (Handoff 15 §2a) — quando presente, cada nó/aresta é envolvido em `<g data-diff-state>` para o `BpmnDiffViewer` pintar o diff por cima; sem ela o render é inalterado.
**Papel:** Canvas SVG do viewer — mesma estrutura do `BpmnCanvas` (Defs/grid/edges/nodes/overlay) reusando `ConnectedNode`/`ConnectedEdge`, mas só com pan+zoom.
**Entradas:** `ViewerCanvasProps` `{overlay?, showClosed?, diffStates?}`; domínio `{diagram}`; store `viewport`/`gridSize`/`isPanning`/`drillId`.
**Processamento (intermediário):** `useViewerPan(svgRef)`; `hiddenIds`/`selectRenderList` (mesmos do editor); `NOOP_INTERACTIONS` (stub congelado — nós são read-only, `editable=false`); `diffStates[id] ?? 'unchanged'` carimba `data-diff-state`.
**Saídas:** `<svg>` com camadas idênticas; nenhuma emissão de comando/gesto de edição.
**Estruturas de dados que trafegam:** `ViewerCanvasProps`, `DiffPaintKind`, `{nodes, edges}`, `Interactions` (só type, nunca invocado).

### `packages/react/src/viewer/useViewerPan.ts`
**Papel:** Pan + wheel-zoom somente-leitura (sem seleção/drag/connect/resize/menu/teclado).
**Entradas:** `svgRef`; store. Eventos de ponteiro/wheel.
**Processamento (intermediário):** `panRef {x,y}` (client); efeito de `wheel` não-passivo → `applyWheelZoom`; delta pixel→mundo (`viewport.width/height / clientWidth|Height`).
**Saídas:** `{onPointerDown, onPointerMove, onPointerUp}`; `setState({isPanning})`, `{viewport: panViewport(...)}`.
**Estruturas de dados que trafegam:** `Viewport`, `Point` (client).

### `packages/react/src/viewer/BpmnDiffViewer.tsx`
> Δ 2026-07: novo (Handoff 15 §2a–§2d, V-2/V-3/V-4/V-5) — superfície de revisão/diff sobre o viewer read-only.
**Papel:** O diagrama TARGET no viewer read-only (N-7) com o diff semântico pintado por cima e a barra de navegação mudança-a-mudança; opcionalmente threads de review por elemento (contrato host-injetado). Read-only por construção; nada toca os objetos do diagrama; todos os artefatos SVG são transientes (`[data-diff-overlay]`/`data-diff-state`) — exports ficam limpos.
**Entradas:** `BpmnDiffViewerProps` `{base, target, plugins?, messages?, onClose?, reviewStore?, author?, threadsTab?, onDismissThread?}`; `config` (via `EditorConfigProvider`); store; `useT`.
**Processamento (intermediário):** `diffDiagrams(base, target)` (ordem topológica = ordem de navegação, nunca reordenada); `diffStates` (map id→kind) alimenta o `ViewerCanvas`; `focusPointOf` mira o ghost v-base em removidos; F7/Shift+F7 e ←/→ andam com wrap + `panViewportTo` + 2 pulsos (reduced-motion → instantâneo); chips de categoria filtram (combináveis, contagens); threads lidos por `useSyncExternalStore(reviewStore.subscribe, reviewStore.list)`, órfãos nunca sumem; `blockingThreads` (abertas, não dispensadas, âncora no target) espelham `reviewThreadsRule`; Esc na pilha única (`useDismissal` diff-mode/popover/thread). Subcomponentes: `DiffGhosts` (removed/moved/added/changed/rerouted), `ReviewPins`, `ThreadPopover`, `DiffPopover`, `DismissControl`, `DiffLegend`.
**Saídas:** `<div>` com `ViewerCanvas` + overlay de diff/pins/pulso + barra de navegação + banner de gate + lista lateral (Threads/Mudanças) + notícia de órfãs + legenda/popovers; `reviewStore.open/reply/resolve/dismiss`; `onClose`/`onDismissThread`; eventos `review.thread.opened|resolved`.
**Estruturas de dados que trafegam:** `BpmnDiffViewerProps`, `DiffEntry`/`DiffKind`, `DiffPaintKind`, `ReviewStore`/`ReviewThread`/`ReviewMessage`, `Point`, `PopoverState`/`ThreadPopoverState`/`PulseState` (locais).

---

## review

### `packages/react/src/review/ReviewStore.ts`
> Δ 2026-07: novo (Handoff 15 §2c, V-4) — contrato host-injetado de comentários de revisão.
**Papel:** O editor NUNCA persiste dados de review — threads vivem onde o host decidir, alcançáveis só por este contrato (mesmo molde de `AIProvider`/`AnchorAdapter`). Sem store injetado a superfície de review não existe (degradação declarada). Nada aqui toca o modelo BPMN. Contrato SÍNCRONO com `subscribe`; `list()` retorna identidade ESTÁVEL entre mutações (lido via `useSyncExternalStore`).
**Entradas:** Interface `ReviewStore` (`list`, `open`, `reply`, `resolve`, `dismiss?`, `subscribe?`); `createInMemoryReviewStore(versionRef, seed?)`. `MIN_DISMISS_JUSTIFICATION=10`.
**Processamento (intermediário):** A implementação de referência (espelho otimista) mantém `threads`+`listeners`; `dismiss` rejeita justificativa < 10 chars; âncora é `elementId` (segue moves/layout).
**Saídas:** `ReviewThread`/`ReviewMessage`; notificações de `subscribe`.
**Estruturas de dados que trafegam:** `ReviewMessage` (`id, author, text, at, aiAssisted?`), `ReviewThread` (`id, elementId, versionRef, resolved, messages, dismissed?`), `ReviewStore`.

### `packages/react/src/review/reviewThreadsRule.ts`
> Δ 2026-07: novo (Handoff 15 §2d) — gate de aprovação por threads de review.
**Papel:** `PromotionRule` que o host pluga em `LifecycleConfig.promotionRules` (molde exato de `soundnessPromotionRule`), surgindo como gate `rule:N` no `evaluateGates` e imposto por `promote()`. Só threads ABERTAS bloqueiam; `resolved`/`dismissed`/órfãs liberam. Guarda só a APROVAÇÃO (`target: 'active'`); request-changes (candidate→in-review) passa livre.
**Entradas:** `reviewThreadsRule(threads: () => readonly ReviewThread[])`.
**Processamento (intermediário):** Se `target !== 'active'` → allowed; filtra threads bloqueantes (não resolvida, não dispensada, âncora ainda em `nodes`/`edges` do diagrama); retorna `{allowed:false, reason}` (ERROR) com contagem, senão `{allowed:true}`.
**Saídas:** `RuleVerdict` (`{allowed, reason?}`).
**Estruturas de dados que trafegam:** `PromotionRule`, `ReviewThread`, `BpmnDiagram`.

---

## Síntese de dados da camada de apresentação

### Dado visual/interação — `CanvasState` (store externo, `state/canvasStore.ts`)
Uma instância por editor/viewer (via `CanvasProvider`); atualizado a alta
frequência **por `requestAnimationFrame`** durante gestos e assinado por slice
(`useCanvasState`), de modo que só re-renderiza o componente cujo slice mudou.
Campos:

- **`viewport {x,y,width,height}`** — retângulo de mundo do `viewBox`; pan/zoom/fit escrevem aqui.
- **`selectedIds` / `hoveredId` / `hoveredEdgeId`** — seleção e hover; `selection.changed` é emitido em diffs.
- **`dragState`** (`nodeIds`+`rootIds`, `origin`, `dx/dy`, `active`, `dropLaneId`, `reparentTargetId`) — offset visual por frame; comita `moveNodeCommand`/reparent/lane/reroute no drop.
- **`connectState`** (`sourceId`, `sourcePoint`, `currentPoint`, `hoverTargetId`, `invalidReason`) — preview de aresta; comita `addEdgeCommand` no drop.
- **`resizeState`** (`corner`, `initial`, `current`, `origin`) — rect vivo; comita `resizeNodeCommand`(+reflow boundary).
- **`selectionBox {start,current}`** — laço; comita `setState({selectedIds})`.
- **`edgeDrag`** (`edgeId`, `index`, `waypoints`, `origin`, `grabbed`, `active`) — rota manual em edição; comita `updateEdgeCommand{waypoints, routeMode:'manual'}`.
- **`boundarySnap {hostId, side, t, point}`** — alvo de anexação; comita `attachBoundaryCommand`.
- **`settling: SettlingEntry[]`** (`{edgeId, path}`) — crossfade pós-re-rota (160ms), transitório.
- **`issueBadges: Record<string, {severity, code?}>`** — badges de validação/soundness.
- **`dismissals: DismissalEntry[]`** (`{id, close}`) — pilha única de Esc.
- **`contextMenu {kind, targetId?, client, world}`** — menu aberto.
- **`focusedElementId`** — foco de teclado rondante (`tabIndex=0`).
- **`alignGuides`/`spacingBadges`** — guias/badges de espaçamento durante o drag (H14 §1b).
- **`searchOpen`/`paletteOpen`/`cheatsheetOpen`/`lintOpen`** — flags de overlay (busca / ⌘K / "?" / lint dock).
- **`layoutProposal`/`layoutSettle`** — proposta de auto-layout pendente e crossfade pós-aplicar (H14 §1e); **`searchPulse`** — halos do hit de busca (H14 §1c).
- **`editingNodeId`/`editingEdgeId`**, **`isPanning`**, **`gridSize`**, **`snapEnabled`**, **`readOnly`**, **`lastCreatedNodeId`**, **`dirtySinceExport`**, **`drillId`**.

### Dado de domínio — `BpmnDiagram` via `CommandStack` (`contexts/DiagramContext.tsx`)
Imutável e versionado. Toda mutação passa por `execute(command)` →
`stack.execute` (interceptado pelo `RuleEngine`, retornando `RuleVerdict` que
alimenta `lastVeto`), com `undo`/`redo`, `onChange(next)` e emissão de eventos
(`diagram.loaded`, `command.executed|undone`, `element.*`). `replaceDiagram`
troca o modelo inteiro e reseta o histórico. Rotas A* de arestas `astar` são
**derivadas** (não editadas) via `deriveAstarRoutes` no load/import — fora do
undo e do ledger.

### `EditorConfig` (`contexts/EditorConfigContext.tsx`)
Dado estrutural resolvido dos plugins: `registry`, `shapes`, `paletteItems`,
`paletteGroups`, `edgeStyles`, `inspectorSections`, `ruleEngine`,
`validationEngine`, `lifecycleEngine`, `edgeRouter`, `preferredTypes`,
`emitEditorEvent` e `autosave`. É a fonte da paleta, dos shapes, dos estilos de
aresta e do canal de eventos de editor.

### Fluxo gesto → core (a espinha dorsal desta camada)
1. **pointerdown** grava o gesto inicial no `CanvasState` (dragState/connectState/resizeState/edgeDrag/selectionBox/panSession).
2. **pointermove** é coalescido em **um** `requestAnimationFrame` (`useInteractions.schedule`), recalculando coordenadas de mundo (`screenToWorld`), snap (`snapToGrid`), alvos (`dropTargetLane`/`findBoundarySnap`/`subProcessContainerAt`/`findNodeAt`) e veredito de conexão (`ruleEngine.evaluate('edge.connect.pre')`) — tudo escrito de volta no store como dado **visual transitório** (nada toca o domínio ainda).
3. **pointerup** converte o gesto em **`Command`(s) undoáveis** despachados por `execute` — normalmente um `compositeCommand` que agrupa move + membership de lane + reparent + reroute (`appendRerouteCommands`), ou attach/detach de boundary, ou `addEdgeCommand`, ou `resizeNodeCommand` — e grava `settling` para o crossfade. O `CommandStack` valida, versiona, notifica `onChange` e emite os eventos de editor; o novo `diagram` reflui para os renderers.

Teclado (`useKeyboardShortcuts`) e o `ContextMenu`/paleta/inspetor seguem a
mesma regra: **nunca** mutam o modelo diretamente — sempre via `Command`. O
`ViewerCanvas`/`useViewerPan` escrevem só `viewport`/`isPanning` (pan/zoom),
jamais comandos.

**Arquivos cobertos:** 80.
