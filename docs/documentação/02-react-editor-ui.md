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
**Papel:** Barril de exportação pública do pacote `@buildtovalue/react` (editor completo + features).
**Entradas:** Nenhuma (apenas `export * from`/`export {}` de todos os módulos).
**Processamento (intermediário):** Nenhum — reexporta componentes de entrada, contexts, state, canvas, gestures, shapes, plugins, ui, i18n e workers.
**Saídas:** Superfície de API (símbolos reexportados). O viewer leve também é reexportado aqui por compatibilidade drop-in.
**Estruturas de dados que trafegam:** Nenhuma própria; apenas re-tipos dos módulos referenciados.

### `packages/react/src/BpmnDesigner.tsx`
**Papel:** Superfície de edição completa: canvas + gestos + command stack + sistema de plugins, com o chrome de versão.
**Entradas:** `BpmnDesignerProps` — `diagram: BpmnDiagram` (inicial), `plugins?: BpmnPlugin[]`, `onChange?: (BpmnDiagram) => void`, `readOnly?`, `children`/`overlay?: ReactNode`, `showClosed?`, `messages?: Messages`.
**Processamento (intermediário):** `useEditorConfig()` lê o config resolvido; `DesignerBody` extrai `config.ruleEngine`, `config.edgeRouter`, `config.emitEditorEvent` para injetar no `DiagramProvider`. Decisão condicional de montar `<I18nProvider>` apenas quando `messages` é dado (compose-not-shadow).
**Saídas:** Árvore de providers (`EditorConfigProvider` → `DiagramProvider` → `CanvasProvider`) envolvendo `<BpmnCanvas>`, `<ContextMenu>`, `<VersionBanner>`, `<ResilienceLayer>` (só editável) e `children`. Reexporta `resolveEditorConfig`.
**Estruturas de dados que trafegam:** `BpmnDesignerProps`, `BpmnDiagram`, `BpmnPlugin`, `Messages`, `EditorConfig` (via context).

### `packages/react/src/BpmnEditor.tsx`
**Papel:** Editor "baterias inclusas": `BpmnDesigner` + Toolbar + Palette + PropertiesPanel + MiniMap + StatusBadge no arranjo padrão.
**Entradas:** `BpmnEditorProps extends BpmnDesignerProps` + `toolbarExtra?: ReactNode`, `hidePalette?`, `hideInspector?`, `hideMiniMap?`.
**Processamento (intermediário):** Desestrutura flags de chrome; repassa `...designerProps`. Gate `!designerProps.readOnly` esconde a paleta.
**Saídas:** JSX de layout — `<div className="bpmnr-chrome-*">` posicionando as peças de chrome como `children` do `BpmnDesigner`.
**Estruturas de dados que trafegam:** `BpmnEditorProps`, `BpmnDesignerProps`.

### `packages/react/src/viewer.ts`
**Papel:** Entrypoint leve, tree-shakeable, somente-leitura (`@buildtovalue/react/viewer`) — só o substrato de render + pan/zoom, sem o grafo do editor.
**Entradas:** Nenhuma (barril).
**Processamento (intermediário):** Nenhum.
**Saídas:** Reexporta `BpmnViewer`, `ViewerCanvas`, tipos de props, e `I18nProvider`/`useT`/`EN`/`PT_BR`/`Messages` para consumidores viewer-only.
**Estruturas de dados que trafegam:** `BpmnViewerProps`, `ViewerCanvasProps`, `Messages`, `TFunction`, `TParams`.

---

### `packages/react/src/simulation.ts` · `replay.ts` · `agent.ts` · `copilot.ts`
**Papel:** Barrels de subpath opt-in (`@buildtovalue/react/simulation` etc., espelhando `./viewer`) — consumidores editor-only não dependem de tree-shaking para descartar as superfícies pesadas; o barrel raiz segue reexportando por compatibilidade.
**Entradas/Saídas:** Reexports puros das superfícies respectivas (sem dados próprios).

## contexts

### `packages/react/src/contexts/DiagramContext.tsx`
**Papel:** Guarda o **dado de domínio** — o `BpmnDiagram` imutável dirigido pelo `CommandStack` — e expõe execute/undo/redo + emissão de eventos de editor.
**Entradas:** `DiagramProviderProps` — `diagram`, `ruleEngine?`, `edgeRouter?: EdgeRouterFn`, `onChange?`, `emitEditorEvent?`, `children`.
**Processamento (intermediário):** `stackRef` cria uma única `CommandStack` semeada com `deriveAstarRoutes(diagram, edgeRouter)` (derivação de apresentação, fora do histórico/ledger); `useSyncExternalStore` assina `stack.current`; `lastVeto` em `useState`; refs para `onChange`, `edgeRouter`, `emitEditorEvent`; `loadedOnce` garante um único `diagram.loaded`. `emitElementEvent()` mapeia `command.toAuditEvent()` → eventos `element.added/removed/changed`. `execute()` chama `stack.execute` e captura o `RuleVerdict`.
**Saídas:** `DiagramContextValue` — `{ diagram, stack, execute, undo, redo, canUndo, canRedo, lastVeto, replaceDiagram }`. Efeitos colaterais: `onChange(next)` em cada mutação; eventos `diagram.loaded`, `command.executed|undone`, `element.*`. `replaceDiagram` reseta o stack (re-deriva A*) e re-emite loaded.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `CommandStack`, `Command`, `RuleEngine`, `RuleVerdict`, `EmitEditorEvent`, `DiagramContextValue`, `DiagramProviderProps`; sets `ELEMENT_ADDED`/`ELEMENT_REMOVED`.

### `packages/react/src/contexts/CanvasContext.tsx`
**Papel:** Provê o **store de estado visual** (`CanvasStore`) por instância e o hook de subscrição granular.
**Entradas:** `initial?: Partial<CanvasState>`, `children`.
**Processamento (intermediário):** `storeRef` cria uma única `createCanvasStore(initial)`; `useCanvasState(selector)` delega a `useStore` (re-render só quando o slice selecionado muda).
**Saídas:** Context com o `CanvasStore`; hooks `useCanvasStore()` e `useCanvasState<S>(selector)`.
**Estruturas de dados que trafegam:** `CanvasStore`, `CanvasState`, `Partial<CanvasState>`.

### `packages/react/src/contexts/EditorConfigContext.tsx`
**Papel:** Resolve e provê o `EditorConfig` — mescla de plugins com registry, shapes, paleta, estilos, engines, roteador e canal de eventos.
**Entradas:** `plugins?: BpmnPlugin[]`.
**Processamento (intermediário):** `resolveEditorConfig()` deduplica plugins por `id` (último vence); parte de `createDefaultRegistry`, `BUILT_IN_SHAPES`, `BUILT_IN_PALETTE(_GROUPS)`, `createDefaultRuleEngine`, `BUILT_IN_VALIDATION_RULES`, `cubicBezierConnection`; `wheelClaims: Map<number,string>` detecta colisão de `colorWheelDegree` (console.warn), valida cores reservadas (gold/green); loop de plugins acumula `nodeTypes`/`preferredTypes`, `shapes`, `edgeStyles`, `paletteItems`, `inspectorSections`, `paletteGroups` (merge por id), `validationRules`, `registerRules`, `eventHandlers`, `autosave`, `lifecycleConfig`, `edgeRouter` (via `resolveRouter`). `emitEditorEvent` carimba `ts: Date.now()` e faz fan-out; `warnDeprecatedAliasOnce` para `node.created`. `useMemo` sobre `plugins`.
**Saídas:** `EditorConfig` completo via context; hook `useEditorConfig()`; `resolveEditorConfig` exportada. Efeitos colaterais: `console.warn` de colisões/depreciações.
**Estruturas de dados que trafegam:** `EditorConfig`, `BpmnPlugin`, `NodeTypeRegistry`, `RuleEngine`, `ValidationEngine`, `LifecycleEngine`, `EdgeRouterFn`, `EdgeStyle`, `PaletteItem`, `PaletteGroup`, `InspectorSection`, `ShapeComponent`, `EditorEventName`/`EditorEventPayloads`.

---

## state

### `packages/react/src/state/canvasStore.ts`
> Δ 2026-07: novo campo `focusedElementId: string | null` (foco de teclado rondante — o elemento com `tabIndex=0`).
**Papel:** Define **todo o formato do dado visual** (`CanvasState`) e a fábrica do store.
**Entradas:** `createCanvasStore(partial?: Partial<CanvasState>)`.
**Processamento (intermediário):** Constrói o estado inicial (viewport 1200×800, `gridSize: 20`, `snapEnabled: true`, coleções vazias) e faz merge com `partial`. Constantes `MIN_VIEWPORT_WIDTH=200`, `MAX_VIEWPORT_WIDTH=20000`.
**Saídas:** `CanvasStore` (= `Store<CanvasState>`).
**Estruturas de dados que trafegam (o dado visual central):**
- `Viewport` `{x,y,width,height}` — retângulo de mundo do `viewBox`.
- `selectedIds: string[]`, `hoveredId`, `hoveredEdgeId`.
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
**Papel:** O SVG `<svg>` principal do editor: pan/zoom via `viewBox`, monta defs, grid, arestas, nós e a camada de overlay; liga os gestos.
**Entradas:** `CanvasProps` `{ overlay?, showClosed=true }`. Do store: `viewport`, `gridSize`, `isPanning`, `drillId` (via `useCanvasState`). Do domínio: `diagram`. Config via `useEditorConfig`. Eventos de ponteiro/wheel do `<svg>`.
**Processamento (intermediário):** `useInteractions(svgRef)` produz o objeto de handlers; `useKeyboardShortcuts`. Efeitos: monitor de pacing por `requestAnimationFrame` durante pan (reporta `render.slow` uma vez/gesto se frame > 32ms); assinatura de `selectedIds` para emitir `selection.changed` (diff de arrays); listener nativo não-passivo de `wheel` → `applyWheelZoom`. `hiddenIds = hiddenNodeIds(diagram, drillId)` memoizado; `selectRenderList(diagram, hiddenIds, viewport, showClosed)` → `{nodes, edges}` visíveis/z-ordenados/culled. Banda semântica `1200/viewport.width >= SEMANTIC_ZOOM_MIN`.
**Saídas:** Árvore SVG (`Defs`, `GridLayer`, camadas `edges`/`nodes`/`overlay` com `SettlingOverlay`, `ConnectionPreview`, `BoundarySnapOverlay`, `ReparentTargetOverlay`, `SelectionBoxOverlay`, `EdgeLabelEditor` e `overlay`). `setState({viewport})` no zoom; eventos `render.slow`, `selection.changed`.
**Estruturas de dados que trafegam:** `CanvasProps`, `Viewport`, `BpmnDiagram`, `Interactions`, `{nodes: BpmnNode[], edges: BpmnEdge[]}`.

### `packages/react/src/canvas/viewport.ts`
**Papel:** Matemática de viewport — conversão tela→mundo, zoom no cursor, pan, fit e wheel.
**Entradas:** `screenToWorld(svg, clientX, clientY)`, `zoomViewportAt(viewport, worldPoint, factor)`, `panViewport(viewport, dxWorld, dyWorld)`, `applyWheelZoom(store, svg, event)`, `fitViewport(bounds, aspectRatio, padding=60)`.
**Processamento (intermediário):** Usa `getScreenCTM().inverse()` com `DOMPoint` (fallback matemático via `viewBox` para jsdom); `clamp` da largura entre MIN/MAX; fator `Math.exp(deltaY*0.0015)`; recomputa `x/y/width/height` mantendo o ponto de mundo sob o cursor fixo.
**Saídas:** Novos `Viewport`/`Point`; `applyWheelZoom` faz `store.setState({viewport})`.
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
**Papel:** Crossfade de acomodação (R-2b): pinta os paths de preview ortogonal por cima e faz fade-out para revelar a rota A* cacheada.
**Entradas:** Store `settling: SettlingEntry[] | null`. `SETTLE_MS=160`.
**Processamento (intermediário):** `opacity` (useState) vai 1→0 num rAF; `setTimeout` autoritativo limpa `settling` no store após `SETTLE_MS+40`.
**Saídas:** `<g>` de paths desvanecentes; `setState({settling:null})`.
**Estruturas de dados que trafegam:** `SettlingEntry` `{edgeId, path}`.

### `packages/react/src/canvas/ShapeErrorBoundary.tsx`
**Papel:** Error boundary por shape: um shape que lança vira placeholder de erro dimensionado ao nó; retenta quando a referência do nó muda.
**Entradas:** `ShapeErrorBoundaryProps` `{node, onError, children}`.
**Processamento (intermediário):** Estado `{error, failedFor}`; `getDerivedStateFromError`; `componentDidUpdate` reseta ao trocar `node`.
**Saídas:** `children` ou `<g data-shape-error>` (retângulo + `!` + tipo). Efeito: `onError({nodeId, nodeType, message})` → `shape.render.error`.
**Estruturas de dados que trafegam:** `ShapeErrorBoundaryProps`, `ShapeErrorBoundaryState`, `BpmnNode`.

### `packages/react/src/canvas/overlays.tsx`
**Papel:** Overlays de gesto em coordenadas de mundo: preview de conexão, highlight de boundary snap, highlight de reparent e retângulo de laço.
**Entradas:** Store `connectState`, `boundarySnap`, `dragState.reparentTargetId`, `selectionBox`; domínio `diagram` (para hosts/containers).
**Processamento (intermediário):** `ConnectionPreview` deriva `invalid` de `invalidReason`; `SelectionBoxOverlay` computa `x/y/width/height` do box (ignora < 2px).
**Saídas:** Elementos SVG (`<line>`/`<circle>`/`<rect>`) — nenhum despacho, puramente visuais.
**Estruturas de dados que trafegam:** `ConnectState`, `BoundarySnapTarget`, `DragState`, `SelectionBoxState`.

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

---

## shapes

### `packages/react/src/shapes/common.tsx`
**Papel:** Tokens de tema, helpers de traço/preenchimento, rótulo com wrap e caixa de atividade compartilhada.
**Entradas:** `ShapeProps` (`{node, selected}`); params de `ShapeLabel` (`label, width, y, fontSize, color, maxLines, halo`). `EDGE_CORNER_RADIUS=8`.
**Processamento (intermediário):** `theme` (CSS vars); `strokeFor`/`strokeWidthFor`; `wrapLabel(label, charsPerLine, maxLines)` quebra palavras e trunca com `…` (dado transitório: array `lines`); `ActivityMarker` deriva glyph de `activityMarkerOf(node)`.
**Saídas:** `<text>`/`<g>`/`<rect>` SVG; `ActivityBox` compõe corpo+label+marker.
**Estruturas de dados que trafegam:** `ShapeProps`, `theme` (tokens), `string[]` de linhas.

### `packages/react/src/shapes/index.ts`
**Papel:** Barril de shapes + mapa `BUILT_IN_SHAPES` (nodeType → componente).
**Entradas:** Componentes de `shapes.js`.
**Processamento (intermediário):** Nenhum — monta o `Record<string, ShapeComponent>`.
**Saídas:** `BUILT_IN_SHAPES`, reexports (`DefaultShape`, `theme`, `ShapeLabel`, `wrapLabel`, `EDGE_CORNER_RADIUS`).
**Estruturas de dados que trafegam:** `Record<string, ShapeComponent>`.

### `packages/react/src/shapes/shapes.tsx`
**Papel:** Todos os componentes de shape BPMN built-in (eventos, tarefas, gateways, sub-process, call/agent activity, data, group, pool/lane, default).
**Entradas:** `ShapeProps` `{node, selected}` por shape; alguns leem `node.properties` (`decisionRef`, `calledElementLabel`, `agentWorkflowRef`), `eventDefinitionOf`, `isNonInterrupting`, `isSubProcessExpanded`.
**Processamento (intermediário):** Cálculos geométricos locais (raios, diamantes, pentágono do event-gateway, cilindro do data store, dobra do data object, banda rotacionada de swimlane); `eventGlyph(kind, cx, cy, r, filled)` desenha glifos tipados. `SUBPROCESS_TITLE_HEIGHT=30` exportado.
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
> Δ 2026-07: novos ramos Ctrl/Cmd+A (select-all), C/X/V (clipboard), D (duplicar); navegação rondante por setas quando o foco DOM está no canvas/elemento não-selecionado (Enter seleciona, Shift+Enter aditivo); nudge segue convenção de editor — seta = 1px, Shift = passo de grade (era o inverso).
**Papel:** Atalhos de teclado do editor: undo/redo, delete, escape (pilha de dismissal + cancelar gestos + subir breadcrumb), setas (nudge), espaço (pan).
**Entradas:** `interactions: Interactions`; domínio `{diagram, execute, undo, redo}`; store. Eventos `KeyboardEvent` (window).
**Processamento (intermediário):** `isEditingTarget` ignora inputs; `meta = ctrl||cmd`; lê `state` do store (readOnly, contextMenu, dismissals, selectedIds, drillId, gridSize); `arrows` map `{ArrowX:[dx,dy]}`; `step = shift?1:gridSize`. Escape: pop `dismissals.slice(0,-1)` e `top.close()`, senão cancelar seleção/gestos, senão subir um nível de drill (`fitViewport(getBoundingBox(scope))`).
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
**Papel:** Contrato de tipos da extensibilidade e do catálogo de eventos do editor — a "linguagem" de dados entre host/plugins e o editor.
**Entradas:** Nenhuma runtime (define types/consts). `EDITOR_EVENTS` (const), `DEPRECATED_EVENT_ALIASES`.
**Processamento (intermediário):** Nenhum executável relevante — declarações.
**Saídas:** Tipos e constantes exportados.
**Estruturas de dados que trafegam:**
- `ShapeProps`/`ShapeComponent`, `InspectorSection`, `PaletteItem`, `PaletteGroup`.
- `EdgeRouterContext` (`obstacles: Rect[]`, `routedEdges: Point[][]`), `EdgeRouterFn`.
- `EDITOR_EVENTS`/`EditorEventName` e `EditorEventPayloads` (payloads tipados por evento: `diagram.loaded`, `element.added/changed/removed`, `edge.connected`, `selection.changed`, `command.executed/undone`, `validation.changed`, `promotion.completed`, `import.warning`, `render.slow`, `shape.render.error`).
- `DEPRECATED_EVENT_ALIASES` (`node.created` → `element.added`).
- `MenuTarget`, `ContextMenuItem`, `EditorEvent`/`EditorEventHandler`.
- `EdgeStyle` (stroke/dash/marker/routing/midDecoration).
- `BpmnPlugin` (id, colorWheelDegree, bodyColor, nodeTypes, shapes, paletteItems/Groups, inspectorSections, edgeStyles, validationRules, registerRules, lifecycleConfig, edgeRouter, onBeforeSave/onAfterLoad, onEditorEvent, contextMenuItems, autosave).

---

## ui

### `packages/react/src/ui/Palette.tsx`
**Papel:** Paleta de elementos: clicar cria um nó do tipo no centro do viewport e seleciona.
**Entradas:** Domínio `{execute, diagram}`; store; `config` (registry, paletteItems/Groups); `useT`. `readOnly` esconde a paleta.
**Processamento (intermediário):** `createAt(nodeType, defaultProperties)` lê `viewport/gridSize/snapEnabled`; centro `cx/cy`; `jitter` por contagem de nós; `snap()`; `createNode(..., registry)`. Agrupa itens em `byGroup: Map` + `ungrouped`; `groupStyle` gera CSS vars.
**Saídas:** `<nav>` de botões; `execute(addNodeCommand(node))`; se permitido, `setState({selectedIds:[id], lastCreatedNodeId:id})` (dispara animação e evento `element.added` via canal).
**Estruturas de dados que trafegam:** `PaletteItem`, `PaletteGroup`, `BpmnNode`, `Command`.

### `packages/react/src/ui/paletteItems.ts`
**Papel:** Dados estáticos: grupos e itens da paleta built-in.
**Entradas:** `CORE_PALETTE_ICONS`.
**Processamento (intermediário):** Nenhum — arrays literais.
**Saídas:** `BUILT_IN_PALETTE_GROUPS`, `BUILT_IN_PALETTE` (inclui itens que fixam `defaultProperties` como `{eventDefinition:'timer'}`, `{cancelActivity:false}`).
**Estruturas de dados que trafegam:** `PaletteItem[]`, `PaletteGroup[]`.

### `packages/react/src/ui/paletteIcons.tsx`
**Papel:** Ícones de linha SVG built-in da paleta.
**Entradas:** Nenhuma (componentes estáticos).
**Processamento (intermediário):** Wrapper `Icon` (18px grid, `currentColor`).
**Saídas:** `CORE_PALETTE_ICONS: Record<string, ReactNode>`.
**Estruturas de dados que trafegam:** `Record<string, ReactNode>`.

### `packages/react/src/ui/Toolbar.tsx`
**Papel:** Barra padrão: undo/redo, zoom/fit, snap, breadcrumb, validar, exportar (XML/JSON/SVG/PNG), limpar roteamento, toast/veto/issues.
**Entradas:** Domínio `{diagram, execute, undo, redo, canUndo, canRedo, lastVeto}`; store (`snapEnabled`, `viewport.width`, `drillId`, `readOnly`); `config` (validationEngine, registry, preferredTypes, plugins, edgeRouter, emitEditorEvent); `useT`; `extra?: ReactNode`.
**Processamento (intermediário):** `issues`/`toast` (useState, `toast` some em 5s); `clearRouting(includeManual)` → `clearRoutingCommands` → `compositeCommand('Clear routing')` + monta string do toast; `zoomBy`/`fit` (`fitViewport` com aspect do svg); `validate()` roda `validationEngine.validate(applyBeforeSave())`, monta `badges` e faz `setState({issueBadges})` + emite `validation.changed`; `applyBeforeSave()` encadeia `plugin.onBeforeSave`; `markSaved()` limpa autosave + `dirtySinceExport:false`; `breadcrumbTrail`/`breadcrumbLevels`/`drillTo`; `slug()`.
**Saídas:** JSX de toolbar; `store.setState({viewport})`, `{snapEnabled}`, `{drillId, viewport}`, `{issueBadges}`; `execute(compositeCommand)`; download de arquivos (`downloadFile`/`exportSvg`/`exportPng`); eventos `validation.changed`.
**Estruturas de dados que trafegam:** `ValidationIssue[]`, `GovernanceBreadcrumbLevel[]`, `Command`, `BpmnDiagram`, `BpmnNode`.

### `packages/react/src/ui/PropertiesPanel.tsx`
**Papel:** Inspetor do elemento selecionado: rótulo, purpose (aresta), propriedades livres, seções de plugin, meta de versão, "voltar ao auto".
**Entradas:** Domínio `{diagram, execute}`; `config.inspectorSections`/`edgeRouter`; store `selectedIds`/`readOnly`; `useT`.
**Processamento (intermediário):** Requer exatamente 1 selecionado; `node`/`edge` por id; `Field` mantém `draft` (useState, ressincroniza via effect); `PropertiesEditor` lista `Object.entries(properties)` e `parseValue(raw)` (JSON→fallback string); `isManualEdge(edge)` gate do botão.
**Saídas:** `<aside>` de inspeção; `execute(updateNodeCommand/updateEdgeCommand{label|purpose|properties})`, `updateEdgeCommand(backToAutoPatch(...))`; renderiza `inspectorSections` filtradas por `appliesTo`.
**Estruturas de dados que trafegam:** `BpmnNode`, `BpmnEdge`, `Record<string, unknown>` (properties), `InspectorSection`.

### `packages/react/src/ui/MiniMap.tsx`
**Papel:** Mapa de visão geral: cada nó como retângulo + o retângulo do viewport; clicar recentraliza.
**Entradas:** Domínio `{diagram}`; store `viewport`; `useT`. `WIDTH/HEIGHT/PADDING`.
**Processamento (intermediário):** `activeNodes`; `getBoundingBox`; `bounds` com padding; `mapped` = união de bounds+viewport; `recenter` converte clique→mundo.
**Saídas:** `<svg>` de minimapa; `setState({viewport:{...,x,y}})` no clique.
**Estruturas de dados que trafegam:** `BpmnNode[]`, `Viewport`, bbox `{x,y,width,height}`.

### `packages/react/src/ui/ContextMenu.tsx`
> Δ 2026-07: novos built-ins `node.copy`/`node.duplicate` (após os de reparent) e `canvas.paste` (cola ancorado no ponto do clique) — despacham via clipboard compartilhado (`gestures/clipboard.ts`).
**Papel:** Menu de contexto plugável (N-5): built-ins condicionais por tipo de alvo + seções por plugin; operável por teclado; registrado na pilha de Esc.
**Entradas:** Store `contextMenu: ContextMenuState`; domínio `{diagram, execute}`; `config.plugins`/`edgeRouter`; `useT`. `MENU_WIDTH=240`, `ITEM_HEIGHT=34`.
**Processamento (intermediário):** `activeIndex` (useState); `useDismissal('context-menu', ...)`; `items = useMemo` monta `RenderedItem[]` a partir de `MenuTarget {kind, id?, point:world, diagram, selectedIds}` — edge (back-to-auto, add-waypoint via `nearestSegmentIndex`/`computeRoutedWaypoints`/`straightRoute`, edit-label), node (edit-label, move-into/remove-from subprocess via `subProcessContainerAt`), plus itens de plugin filtrados por `when()`. Flip nas bordas via `getBoundingClientRect`.
**Saídas:** `<div role="menu">`; `execute(...)` de comandos (`updateEdgeCommand`/`updateNodeCommand`); `setState({editingNodeId|editingEdgeId})`; `close()` → `setState({contextMenu:null})`.
**Estruturas de dados que trafegam:** `ContextMenuState`, `MenuTarget`, `ContextMenuItem`, `RenderedItem` (local), `Point`, `BpmnEdge`.

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
**Papel:** Canvas SVG do viewer — mesma estrutura do `BpmnCanvas` (Defs/grid/edges/nodes/overlay) reusando `ConnectedNode`/`ConnectedEdge`, mas só com pan+zoom.
**Entradas:** `ViewerCanvasProps` `{overlay?, showClosed?}`; domínio `{diagram}`; store `viewport`/`gridSize`/`isPanning`/`drillId`.
**Processamento (intermediário):** `useViewerPan(svgRef)`; `hiddenIds`/`selectRenderList` (mesmos do editor); `NOOP_INTERACTIONS` (stub congelado — nós são read-only, `editable=false`).
**Saídas:** `<svg>` com camadas idênticas; nenhuma emissão de comando/gesto de edição.
**Estruturas de dados que trafegam:** `ViewerCanvasProps`, `{nodes, edges}`, `Interactions` (só type, nunca invocado).

### `packages/react/src/viewer/useViewerPan.ts`
**Papel:** Pan + wheel-zoom somente-leitura (sem seleção/drag/connect/resize/menu/teclado).
**Entradas:** `svgRef`; store. Eventos de ponteiro/wheel.
**Processamento (intermediário):** `panRef {x,y}` (client); efeito de `wheel` não-passivo → `applyWheelZoom`; delta pixel→mundo (`viewport.width/height / clientWidth|Height`).
**Saídas:** `{onPointerDown, onPointerMove, onPointerUp}`; `setState({isPanning})`, `{viewport: panViewport(...)}`.
**Estruturas de dados que trafegam:** `Viewport`, `Point` (client).

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

**Arquivos cobertos:** 57.
