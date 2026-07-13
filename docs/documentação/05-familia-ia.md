# 05 — Mapa de Dados: Família BPMN + Cluster de IA

Catálogo de dados (mapa de dados) para o cluster **família BPMN + IA** do monorepo TypeScript. Mapeia TODO dado que circula — entradas, dados intermediários/de processamento (inclusive locais transitórios que nunca deixam a função, "mesmo que os dados se percam na própria classe") e saídas — arquivo por arquivo.

Pacotes cobertos: `dmn`, `sfeel`, `healthcare`, `domain-example`, `simulation`, `copilot`, `agentflow`. **44 arquivos de código-fonte** (nenhum `*.test.ts` sob `src/`).

O caminho de injeção em runtime que costura tudo: **`simulation` (engine) ↔ `DecisionEvaluator` (interface injetada) ↔ `dmn` (`createSfeelDecisionSupport`) ↔ `sfeel` (`evaluate`)**. O engine de token nunca importa `dmn` nem `sfeel`; recebe um objeto estrutural via `SimulationOptions.decisions`.

---

## dmn

### `packages/dmn/src/model.ts`
**Papel:** Vocabulário estático da família DMN/DRD — tipos de nó, tipos de aresta de requisito e quem pode possuir cada requisito.
**Entradas:** Nenhuma (constantes de módulo).
**Processamento (intermediário):** Nenhum runtime; apenas declarações. `DmnEdgeType` derivado de `DMN_EDGE_TYPES` via `typeof[number]`.
**Saídas:** `DMN_NODE_TYPES: NodeTypeDefinition[]` (decision/inputData/knowledgeSource/businessKnowledgeModel com `defaultSize` e `xml.tag`); `DMN_EDGE_TYPES` (information/knowledge/authorityRequirement); `REQUIREMENT_OWNERS: Record<DmnEdgeType,string[]>`.
**Estruturas de dados que trafegam:** `NodeTypeDefinition`, `DMN_NODE_TYPES`, `DMN_EDGE_TYPES`, `DmnEdgeType`, `REQUIREMENT_OWNERS`.

### `packages/dmn/src/decisionTable.ts`
**Papel:** Modelo central da tabela de decisão DMN e comandos undoáveis (vincular/criar/gravar tabela) com eventos de auditoria.
**Entradas:** `Partial<DecisionTable>` (createDecisionTable); `node.properties` (decisionTableOf); `DecisionTable` (validate/setDecisionTable); `nodeId`, `decisionRef`, `BpmnNode decision` (comandos).
**Processamento (intermediário):** `nextId` (seq monotônico + `Date.now().toString(36)`); `validateDecisionTable` varre cada célula com o balanceador `balanced()` — locais transitórios `depth` e `quote` percorrem os caracteres detectando aspas/colchetes desbalanceados e saída vazia; `withAudit` embrulha um `Command` com `toAuditEvent`.
**Saídas:** `DecisionTable` (starter: 1 input/1 output/1 regra `-`); `InvalidCell[]` (ruleId, column, message pt-BR); `Command` (linkDecision/unlinkDecision/createDecision/setDecisionTable — cada um com 1 evento de ledger: DECISION_LINKED/UNLINKED/CREATED/TABLE_CHANGED).
**Estruturas de dados que trafegam:** `HIT_POLICIES` (U/A/P/F/R/O/C), `HitPolicy`, `DecisionTableColumn` (id/label/expression/typeRef), `DecisionRule` (inputEntries[]/outputEntries[]/annotation?), `DecisionTable` (hitPolicy/inputs/outputs/rules), `InvalidCell`.

### `packages/dmn/src/decisionTableXml.ts`
**Papel:** Serialização canônica DMN 1.3 round-trip de uma DecisionTable (`<dmn:decisionTable>` com input/output/rule).
**Entradas:** `XmlBuilder`, `DecisionTable`, `decisionId` (write); `XmlElement` (readColumn/readRule/readDecisionTable).
**Processamento (intermediário):** Mapeamento `HIT_POLICY_TO_XML` (letra→UNIQUE/ANY/…) e inverso `XML_TO_HIT_POLICY`; ids derivados deterministicamente (`${decisionId}_dt`, `${input.id}_expr`, `${rule.id}_i${index}`/`_o${index}`) para export byte-estável; `textOf` extrai `<dmn:text>` filho; `readColumn` distingue input (lê `inputExpression`) de output (lê atributo `name`).
**Saídas:** XML escrito no builder (efeito colateral); `DecisionTableColumn`, `DecisionRule`, ou `DecisionTable | undefined` (readDecisionTable).
**Estruturas de dados que trafegam:** `DecisionTable`, `DecisionRule`, `DecisionTableColumn`, `HitPolicy`, `HIT_POLICY_TO_XML`, `XmlElement`, `XmlBuilder`.

### `packages/dmn/src/DmnXmlConverter.ts`
**Papel:** Conversor bidirecional DRD (BpmnDiagram com nós `dmn:*`) ⇄ DMN 1.3 XML, incluindo DMNDI e extensão de governança bpmnr.
**Entradas:** `BpmnDiagram` (toXml); `xmlText: string` (fromXml).
**Processamento (intermediário):** `toXml`: `definitionsId` regex-saneado; `requirementsByOwner: Map<string,BpmnEdge[]>` agrupa arestas de requisito por target; para cada nó calcula `meta` (`nodeMeta` → `property:*` JSON.stringify, exclui `decisionTable`), delega tabela a `writeDecisionTable`; DMNDI emite `DMNShape`+`Bounds` e `DMNEdge`+waypoints (`edgeWaypoints` cai em `straightConnection`). `fromXml`: `MiniXmlParser` (XXE-safe), lê `diagramMeta`/`versionMeta`, monta `diagram` via `createDiagram`, `readVersion` (valida status contra `VERSION_STATUSES`), `readNode` (parse de `bpmnr:meta`/`property` com JSON.parse tolerante), `readDecisionTable` sobrepõe blob legado, `readRequirements` cria `BpmnEdge` a partir de `href="#id"`, `applyDi` aplica bounds/waypoints ou grid automático; acumula `warnings[]`.
**Saídas:** `string` (XML canônico) ou `DmnImportResult { diagram: BpmnDiagram; warnings: string[] }`.
**Estruturas de dados que trafegam:** `BpmnDiagram`, `BpmnNode`, `BpmnEdge`, `Point`, `VersionStatus`, `XmlElement`, `DmnImportResult`, `REQUIREMENT_LOCAL_TO_TYPE`, `REQUIREMENT_TYPE_SET`, consts de NS (`DMN_NS`, `DMNDI_NS`, `DMN_SPEC_VERSION`).

### `packages/dmn/src/sfeelSupport.ts`
**Papel:** Adaptador que implementa estruturalmente o `DecisionEvaluator` da simulação usando `@buildtovalue/sfeel`, SEM importar `simulation` — o ponto de injeção runtime.
**Entradas:** `BpmnDiagram`, `resolveTable(node)=>DecisionTable?`; em runtime `nodeId` + `context: Record<string, number|string|boolean>`.
**Processamento (intermediário):** `tableOf(nodeId)` resolve nó→tabela; `asSfeelTable` é pass-through de tipo (DecisionTable é estruturalmente `SfeelTable`); `evaluate` chama `sfeel.evaluate` e traduz `EvaluateResult` para o shape de outcome do simulador (`nonSimulable`/`noMatch`/`outputs`+`ruleIndex`); `defaultResolve` só resolve `businessRuleTask`/`decision`.
**Saídas:** `SfeelDecisionSupport` (`hasDecision`/`inputsOf`/`evaluate`); `NonSimulable[]` (nonSimulableCells → `checkTable`).
**Estruturas de dados que trafegam:** `SfeelDecisionSupport`, `SfeelTable`, `NonSimulable`, `DecisionTable`, contexto de avaliação, outcome `{outputs?,ruleIndex?,noMatch?,nonSimulable?}`.

### `packages/dmn/src/DecisionTableEditor.tsx`
**Papel:** Editor DOM da tabela de decisão (fora do orçamento SVG); cada mutação é 1 comando no CommandStack compartilhado.
**Entradas:** Props `{decisionId, breadcrumbLevels?, onNavigate?, onPromote?}`; via `useDiagram` o `diagram`/`execute`.
**Processamento (intermediário):** Estados locais transitórios: `selectedCell`/`editingCell`/`selectedRule`/`hitMenuOpen`/`headerPopover`; `readOnly` derivado de `version.status !== 'draft'`; memos `invalid` (`validateDecisionTable`) e `notSimulable` (`nonSimulableCells`); helpers `setEntry`/`addRule`/`addColumn`/`ruleOp`/`updateColumn`/`removeColumn` produzem uma nova `DecisionTable` imutável e chamam `commit`→`setDecisionTableCommand`; `moveCell` calcula navegação de célula (transitório).
**Saídas:** JSX (tabela editável, ▲ inválido, ⚠ não-simulável); efeito colateral: `Command` executado no stack.
**Estruturas de dados que trafegam:** `DecisionTable`, `DecisionRule`, `HitPolicy`, `HIT_POLICIES`, `InvalidCell`, `NonSimulable`, `GovernanceBreadcrumbLevel`.

### `packages/dmn/src/DecisionPeek.tsx`
**Papel:** Overlay DOM read-only (300px) que resume a decisão vinculada a um businessRuleTask selecionado — zero nós no SVG.
**Entradas:** Props `{resolveDecision?, onOpen?}`; estado do canvas (`selectedIds`, `viewport`, `drillId`) e `diagram`.
**Processamento (intermediário):** Deriva `node`/`ref` (decisionRef do node); lógica de dismissal (`dismissedFor`/`lastSelectionKey`); `useLayoutEffect` projeta coordenadas world→screen (`scale`, `toScreen`, flip esquerda/direita) — cálculos transitórios de posição `pos`; `fallback()` monta `DecisionSummary` a partir de um `dmn:decision` do diagrama; `policyWord`/`extraRules` derivados.
**Saídas:** JSX (cabeçalho com selo/semver, resumo hit policy + N regras + inputs→outputs, 2 primeiras regras).
**Estruturas de dados que trafegam:** `DecisionSummary` (ref/label/semanticVersion/status/table), `DecisionTable`, `HIT_POLICIES`, `VersionStatus`, `SEAL_LABELS`.

### `packages/dmn/src/decisionInspector.tsx`
**Papel:** Seção `DECISÃO · DMN` do inspector do businessRuleTask — vincular/criar/desvincular tabela, cada ação 1 comando + 1 ledger.
**Entradas:** `DecisionInspectorOptions {searchDecisions?, onOpen?, onDiff?, specVersion?}`; `node: BpmnNode`; `diagram`/`execute`/`registry`.
**Processamento (intermediário):** Estado `query`; `decisionRef` do node; `fromDiagram(ref)` monta `DecisionSummary`; `search` (default filtra `dmn:decision` por substring label/id); `createDecision` cria nó `dmn:decision` via `createNode` com `properties.decisionTable = createDecisionTable()` e executa `createDecisionCommand`.
**Saídas:** `InspectorSection` (id/appliesTo/component); JSX com card (semver/selo/hit/regras) ou busca+resultados; efeitos: `linkDecisionCommand`/`unlinkDecisionCommand`/`createDecisionCommand`.
**Estruturas de dados que trafegam:** `DecisionSummary`, `DecisionTable`, `InspectorSection`, `DecisionInspectorOptions`, `DMN_SPEC_VERSION`.

### `packages/dmn/src/plugin.tsx`
**Papel:** Definição do plugin da família DMN (nós, shapes, estilos das 3 arestas de requisito, paleta, seção de inspector padrão).
**Entradas:** Nenhuma dinâmica (composição de módulos).
**Processamento (intermediário):** Componente `Icon` embrulha SVGs de paleta.
**Saídas:** `dmnPlugin: BpmnPlugin` (`colorWheelDegree: 185`, `bodyColor`, `nodeTypes`, `shapes`, `edgeStyles` com marker filled/open/disc + dash, `inspectorSections: [decisionInspectorSection()]`, `paletteGroups`/`paletteItems`).
**Estruturas de dados que trafegam:** `BpmnPlugin`, `DMN_NODE_TYPES`.

### `packages/dmn/src/shapes.tsx`
**Papel:** Shapes SVG da DRD (185° teal) — differentiation por forma; glifo de tabela quando a decisão tem `decisionTable`.
**Entradas:** `ShapeProps {node, selected}`.
**Processamento (intermediário):** `hasTable = node.properties.decisionTable !== undefined`; helpers `strokeOf`/`widthOf`; paths transitórios (base ondulada de knowledgeSource, polígono chanfrado de BKM).
**Saídas:** JSX SVG (`DmnDecisionShape`, `DmnInputDataShape`, `DmnKnowledgeSourceShape`, `DmnBusinessKnowledgeModelShape`).
**Estruturas de dados que trafegam:** `ShapeProps`, tokens `theme`.

### `packages/dmn/src/index.ts`
**Papel:** Barrel de exportação pública do pacote dmn.
**Entradas/Processamento:** Nenhum (re-exports).
**Saídas:** Re-exporta model, DmnXmlConverter, decisionTable (comandos + tipos), editor/peek/inspector, shapes, plugin, e o `createSfeelDecisionSupport`/`nonSimulableCells`.
**Estruturas de dados que trafegam:** todos os tipos DMN públicos.

---

## sfeel

### `packages/sfeel/src/types.ts`
**Papel:** Contratos de valor do subconjunto S-FEEL (independente do ecossistema).
**Entradas:** Nenhuma.
**Processamento (intermediário):** Nenhum (apenas tipos).
**Saídas:** Tipos.
**Estruturas de dados que trafegam:** `SfeelValue` (number|string|boolean), `SfeelContext` (Record<string, SfeelValue|undefined>), `SfeelColumn` (expression/typeRef?), `SfeelRule` (inputEntries/outputEntries), `SfeelTable` (hitPolicy/inputs/outputs/rules — estruturalmente compatível com `DecisionTable`), `NonSimulable` (cell/reason/ruleIndex?/columnIndex?), `SfeelMatch` (outputs/ruleIndex), `EvaluateResult` (`{result: SfeelMatch|null}` | `{nonSimulable}`), `CellCheck` (`{simulable:true}` | `{simulable:false,reason}`).

### `packages/sfeel/src/parse.ts`
**Papel:** Parser do subconjunto S-FEEL (testes unários de input + literais de output); a cerca de exclusões é aplicada aqui.
**Entradas:** `cell: string` (parseUnaryTests/parseOutputLiteral/checkUnaryCell/checkOutputCell/isIrrelevant).
**Processamento (intermediário):** `tokenize` produz `Token[]` (num/str/bool/ident/op/brackets/paren/comma/dotdot) e faz `fail()` com razão nomeada para construções fora do subset (`{}`, `@`, `+*/`, `?`, aritmética `-`, quantificadores, invocação de função, referências de identificador); `Cursor` percorre tokens; `parseTest` monta `UnaryTest`; `identFailure` gera razões precisas; `CellError` é o carrier interno de falha convertido em `{ok:false}` na fronteira. Todos os locais (`tokens`, `depth`, cursores) são transitórios.
**Saídas:** `ParsedCell` (`{ok:true,tests:UnaryTest[]}` | `{ok:false,reason}`), `ParsedOutput` (`{ok:true,value:SfeelValue}` | `{ok:false,reason}`), `CellCheck`, `boolean` (isIrrelevant).
**Estruturas de dados que trafegam:** `UnaryTest` (any | cmp{op,value} | range{lo,hi,loIncl,hiIncl} | not{values}), `ParsedCell`, `ParsedOutput`, `Token`, `SfeelValue`, `CellCheck`.

### `packages/sfeel/src/evaluate.ts`
**Papel:** Avaliação da tabela de decisão sobre o subconjunto (política U e F); contrato de honestidade — resultado ou `nonSimulable`, nunca resultado silenciosamente errado.
**Entradas:** `SfeelTable` + `SfeelContext` (evaluate); `SfeelTable` (checkTable).
**Processamento (intermediário):** `checkTable` faz análise estática (política não simulável, aridade de entradas/saídas por regra, parse de cada célula) acumulando `NonSimulable[]`; `evaluate` percorre regras — locais transitórios: `matches: SfeelMatch[]`, flag `all`, `value = context[variable]`, `outputs` acumulados; `testMatches` avalia cada `UnaryTest` (cmp/range/not) e lança `Honesty` em mismatch de tipo / variável ausente; violação de política Unique (2 matches) vira `nonSimulable`.
**Saídas:** `EvaluateResult`; `NonSimulable[]`; `SIMULABLE_HIT_POLICIES = ['U','F']`.
**Estruturas de dados que trafegam:** `EvaluateResult`, `SfeelMatch`, `NonSimulable`, `SfeelTable`, `SfeelContext`, `UnaryTest`, classe interna `Honesty`.

### `packages/sfeel/src/index.ts`
**Papel:** Barrel público do pacote sfeel.
**Entradas/Processamento:** Nenhum.
**Saídas:** Re-exporta types, parse, evaluate.
**Estruturas de dados que trafegam:** todos os tipos S-FEEL públicos.

---

## healthcare

### `packages/healthcare/src/model.ts`
**Papel:** Vocabulário clínico (305° violeta) mapeado para elementos BPMN interoperáveis.
**Entradas:** Nenhuma.
**Processamento (intermediário):** Nenhum.
**Saídas:** `HC_NODE_TYPES: NodeTypeDefinition[]` (clinicalTask→userTask, clinicalDecision→businessRuleTask, guideline→dataObjectReference, pathwayGate→exclusiveGateway).
**Estruturas de dados que trafegam:** `NodeTypeDefinition`, `HC_NODE_TYPES`.

### `packages/healthcare/src/plugin.tsx`
**Papel:** Pacote healthcare + regra de validação visível para decisão clínica sem tabela DMN vinculada.
**Entradas:** `BpmnDiagram` (clinicalDecisionLinkedRule).
**Processamento (intermediário):** `clinicalDecisionLinkedRule` filtra `hc:clinicalDecision`, checa `properties.decisionRef` string não-vazia, acumula `ValidationIssue[]` (transitório `issues`).
**Saídas:** `healthcarePlugin: BpmnPlugin` (305°, nodeTypes/shapes/validationRules/paleta); `clinicalDecisionLinkedRule: ValidationRule`; `HC_DECISION_UNLINKED` code.
**Estruturas de dados que trafegam:** `BpmnPlugin`, `ValidationRule`, `ValidationIssue`, `HC_NODE_TYPES`.

### `packages/healthcare/src/shapes.tsx`
**Papel:** Shapes clínicos violeta com chanfro dourado; a decisão clínica mostra badge DMN vinculado ou chip ▲ âmbar.
**Entradas:** `ShapeProps {node, selected}`.
**Processamento (intermediário):** `decisionRef` do node (transitório); helpers `sw`/`stroke`/`chamferedCard`; subcomponentes `TypeTag`/`GoldChamfer`.
**Saídas:** JSX SVG (`ClinicalTaskShape`, `ClinicalDecisionShape` com badge/aviso, `GuidelineShape`, `PathwayGateShape`).
**Estruturas de dados que trafegam:** `ShapeProps`, tokens `theme`.

### `packages/healthcare/src/index.ts`
**Papel:** Barrel público do pacote healthcare.
**Saídas:** Re-exporta HC_NODE_TYPES, shapes, plugin/regra/code.
**Estruturas de dados que trafegam:** tipos públicos healthcare.

---

## domain-example

### `packages/domain-example/src/index.ts`
**Papel:** Plugin de domínio exemplo (Squad/Persona/Gate) — vocabulário sobre tags BPMN interoperáveis, estilos de aresta e 3 regras de validação.
**Entradas:** `BpmnDiagram` (regras); `engine` (registerRules); `payload {sourceId,targetId}` no hook `edge.connect.pre`.
**Processamento (intermediário):** `gateSinglePredecessorRule` (conta incoming de `btv:gate`), `squadNeedsPersonaRule` (busca aresta a `btv:persona`), `handoffNeedsPurposeRule` (handoff sem purpose) — cada uma acumula `ValidationIssue[]`; hook interceptor bloqueia reconexão a gate aprovado (`approved === true`).
**Saídas:** `DOMAIN_EDGE_TYPES`, `DOMAIN_EDGE_STYLES: Record<string,EdgeStyle>`, `DOMAIN_NODE_TYPES: NodeTypeDefinition[]`, três `ValidationRule`, `domainExamplePlugin: BpmnPlugin` (default export).
**Estruturas de dados que trafegam:** `BpmnPlugin`, `EdgeStyle`, `NodeTypeDefinition`, `ValidationRule`, `ValidationIssue`, `BpmnDiagram`.

### `packages/domain-example/src/shapes.tsx`
**Papel:** Shapes SVG do domínio btv (card com chanfro de valor dourado) + ícones de paleta.
**Entradas:** `ShapeProps {node, selected}`; `node.properties.role`/`approved`.
**Processamento (intermediário):** `chamferedCard`, `sw`, `TypeTag`; `role`/`approved` derivados (transitórios); paths de flâmula/hexágono/pílula.
**Saídas:** JSX SVG (`SquadShape`, `PersonaShape`, `GateShape`, `PromptShape`, `ConnectorShape`, `DeliverableShape`); `BTV_PALETTE_ICONS: Record<string, ReactNode>`.
**Estruturas de dados que trafegam:** `ShapeProps`, `BTV_PALETTE_ICONS`, tokens `theme`.

---

## simulation

### `packages/simulation/src/types.ts`
**Papel:** Tipos de valor públicos do engine headless de simulação de token (todos JSON serializáveis/determinísticos).
**Entradas:** Nenhuma.
**Processamento (intermediário):** Nenhum.
**Saídas:** Tipos.
**Estruturas de dados que trafegam:** `GatewayKind` (exclusive/parallel/inclusive/eventBased), `SimEdge` (id/source/target/label), `SimNode` (id/type/label/gateway?/outgoing/incoming/boundaryHost?/interrupting?/isStart/isEnd), `PendingChoice`, `BoundaryOption`, `Decision` (união: exclusive/eventBased{gateway,edge} | inclusive{gateway,edges} | boundary{host,boundary} | decision{node,context}), `DecisionOutcome` (outputs?/ruleIndex?/noMatch?/nonSimulable{cell,reason}), `DecisionEvaluator` (hasDecision/inputsOf/evaluate — a **interface injetada** do caminho runtime), `PendingDecisionInput`, `BlockedDecision` (nodeId/cell/reason), `TransitionRecord` (step/type/message/nodeId?/edgeId?/approximate?), `Token` (id/nodeId), `SimulationState`, `SimulationOptions` (scope?/decisions?).

### `packages/simulation/src/graph.ts`
**Papel:** Constrói o grafo de controle de fluxo (SimGraph) para um escopo, com a mesma classificação de nó/aresta que a análise de soundness.
**Entradas:** `BpmnDiagram`, `scope?`.
**Processamento (intermediário):** `inScope: Set<string>` filtra flow nodes do escopo; monta `SimNode` por nó (gateway via `gatewayKindOf`, boundary via `boundaryAttachedTo`/`isNonInterrupting`); popula `outgoing`/`incoming` percorrendo `activeEdges` (ignora messageFlow/association/dataAssociation); `label` de aresta cai no label do target; sets/maps transitórios `nodes`/`edges`/`starts`/`boundariesByHost`.
**Saídas:** `SimGraph {scope, nodes:Map, edges:Map, starts:string[], boundariesByHost:Map}`; helpers `isFlowNode`/`flowScopeOf`/`gatewayKindOf`.
**Estruturas de dados que trafegam:** `SimGraph`, `SimNode`, `SimEdge`, `GatewayKind`, `BpmnDiagram`, `BpmnNode`.

### `packages/simulation/src/engine.ts`
**Papel:** Engine de token small-step determinístico; resolve XOR/AND/event/boundary exato e OR aproximado por dominadores; a lista ordenada de `Decision` É o scenario (replay bit-a-bit).
**Entradas:** `BpmnDiagram` + `SimulationOptions` (com `decisions?: DecisionEvaluator` injetado); `Decision` (choose/replay); `boundaryId`; `Scenario` (replay).
**Processamento (intermediário):** Estado interno mutável: `tokens: Token[]`, `joinArrivals: Map<string,Set>`, `traversedEdges`/`visitedNodes: Set`, `trail: TransitionRecord[]`, `decisions: Decision[]`, `tokenSeq`/`stepSeq`, `blocked: BlockedDecision|null`; `dom` (immediate-dominators). Micro-passos: `step`/`emit`/`deliver` (move/split, sync-join com contagem de arrivals, OR-join adiado); `settleOrJoins` (fixpoint), `orJoinReady`/`canReach` (BFS + dominância); **`decideDecision`** chama `decisionSupport.evaluate(node,context)` → `DecisionOutcome`, roteia pelo primeiro output (`String(values[0])` casado com label de aresta), ou faz `stop()` produzindo `BlockedDecision` + registro `decision-blocked` (nonSimulable/noMatch/output sem flow). Locais transitórios abundantes: `values`, `summary`, `wanted`, `edgeId`, `arrivals`, `live`, `seen`, `queue`.
**Saídas:** `StepResult {moved, transitions}`; getters `state: SimulationState`, `transitions`, `pendingChoice`, `boundaryOptions`, `pendingDecisionInput`, `scenario: Scenario`; `SimulationEngine` (replay estático); erros `SimulationError`.
**Estruturas de dados que trafegam:** `SimulationState`, `Token`, `TransitionRecord`, `Decision`, `DecisionOutcome`, `DecisionEvaluator`, `PendingChoice`, `PendingDecisionInput`, `BlockedDecision`, `BoundaryOption`, `Scenario` (diagramId/versionId/semanticVersion/scope/decisions), `StepResult`, `SimGraph`.

### `packages/simulation/src/dominators.ts`
**Papel:** Análise de dominadores (Cooper-Harvey-Kennedy) sobre o SimGraph — dá regra de convergência correta ao OR-join.
**Entradas:** `SimGraph` (computeDominators); `idom map`, `a`, `b` (dominates).
**Processamento (intermediário):** `ENTRY` sintético; `preds: Map`; DFS pós-ordem iterativo (`postorder`, `stack`, `visited`); `rpo` (reverse-postorder index); `intersect` (dois "dedos" sobem a árvore de dominadores); loop de ponto-fixo atualizando `idom`. Tudo transitório exceto o `idom` retornado.
**Saídas:** `Map<string,string>` (node→idom); `boolean` (dominates).
**Estruturas de dados que trafegam:** `SimGraph`, mapa idom.

### `packages/simulation/src/coverage.ts`
**Papel:** Enumera caminhos estruturais distintos (checklist de cobertura) e rastreia cobertura entre sessões.
**Entradas:** `SimGraph` (enumerate/tracker); `traversedEdges: Iterable<string>` (record).
**Processamento (intermediário):** `walk` DFS recursivo com corte de aresta repetida (`used: Set`), `emit` deduplica por `id = edges.join('>')`; `truncated` ao bater `MAX_PATHS=1000`; `CoverageTracker` guarda `coveredIds: Set`; `record` marca path coberto quando todas as arestas estão em `traversedEdges`. Locais transitórios: `options`, `open`, `edges`, `fresh`.
**Saídas:** `CoveragePath[]`; `CoverageSummary {total, covered, truncated, paths:(CoveragePath&{covered})[]}`; `string[]` (ids recém-cobertos).
**Estruturas de dados que trafegam:** `CoveragePath` (id/label/edges), `CoverageSummary`, `SimGraph`, `MAX_PATHS`.

### `packages/simulation/src/scenario.ts`
**Papel:** JSON canônico e hash de um Scenario (roteiro) para evidência SACM/ledger.
**Entradas:** `Scenario` (canonicalize/hash).
**Processamento (intermediário):** `canonicalDecision` normaliza cada `Decision` (ordena `edges`, ordena chaves de `context`); `JSON.stringify` com ordem fixa; `sha256Hex` truncado em 12 hex.
**Saídas:** `string` (JSON canônico); `Promise<string>` (hash 12 chars).
**Estruturas de dados que trafegam:** `Scenario`, `Decision`.

### `packages/simulation/src/session.ts`
**Papel:** Artefato serializável da sessão de simulação (roteiro + cobertura + versão + autor/timestamp) para ledger/SACM.
**Entradas:** `Scenario`, `CoverageSummary`, `{author, timestamp}` (buildSession); `SimulationSession` (canonicalize); `SessionCoverage` (coveragePercent).
**Processamento (intermediário):** `buildSession` calcula `scenarioHash` (`hashScenario`) e compacta cobertura (`exercised` = ids de paths cobertos); `canonicalizeSession` reordena chaves e ordena `exercised`; `coveragePercent` calcula `round(covered/total*100)`.
**Saídas:** `SimulationSession`, `string` (JSON canônico), `number` (%).
**Estruturas de dados que trafegam:** `SimulationSession` (diagramId/versionId/semanticVersion/scenario/scenarioHash/coverage/author/timestamp), `SessionCoverage` (covered/total/exercised), `Scenario`, `CoverageSummary`.

### `packages/simulation/src/index.ts`
**Papel:** Barrel público do pacote simulation.
**Saídas:** Re-exporta graph, engine (+Scenario/StepResult), coverage, scenario, session e todos os tipos (Decision, DecisionEvaluator, DecisionOutcome, etc.).
**Estruturas de dados que trafegam:** tipos públicos de simulação.

---

## copilot

### `packages/copilot/src/types.ts`
**Papel:** Contratos do copiloto — provider injetado, proposta bruta, validação. Cercas de governança: a IA nunca promove/aprova/assina.
**Entradas:** Nenhuma.
**Processamento (intermediário):** Nenhum.
**Saídas:** Tipos.
**Estruturas de dados que trafegam:** `Msg` (role/content), `AIProvider` (id + `complete({system,messages,schema?})=>Promise<string>` — **request/response do provider**), `ProposedCommand` (type/params), `PromptTemplateRef` (id/version), `SoundnessPreview` (errors/warnings), `CopilotProposal` (commands/rationale/promptTemplateRef/soundnessPreview?), `ProposalError` (index/message), `ProposalValidation` (`{ok:true}` | `{ok:false,errors}`).

### `packages/copilot/src/whitelist.ts`
**Papel:** Whitelist de comandos (único subconjunto de edição que uma proposta pode executar); tudo de governança é estruturalmente ausente.
**Entradas:** `params: Record<string,unknown>`, `BpmnDiagram`, `newIds: Set<string>` (validate/materialize).
**Processamento (intermediário):** Guards `isString`/`isNumber`/`isRecord`/`nodeExists`; cada `CommandSpec` valida shape dos params contra o diagrama (ids resolvem, novos ids não colidem) e materializa o comando real do core; `newIds` acumula ids novos entre comandos (transitório do batch).
**Saídas:** `COMMAND_WHITELIST: Record<string,CommandSpec>` (addNode/addEdge/updateNode/updateEdge/moveNode/removeNode/removeEdge); `WHITELISTED_COMMANDS: string[]`; `Command` materializado; `string|null` (erro de validação).
**Estruturas de dados que trafegam:** `CommandSpec`, `ProposedCommand`, `Command`, `BpmnDiagram`.

### `packages/copilot/src/plan.ts`
**Papel:** Ciclo de vida da proposta: parse → validação íntegra → 1 composite undoável → projeção em scratch-stack → soundness preview LOCAL.
**Entradas:** `raw: string` (parseProposal — resposta bruta do provider); `BpmnDiagram` + `CopilotProposal` (validate/buildPlan); `CopilotAttribution?`.
**Processamento (intermediário):** `parseProposal` tira cerca ```json, `JSON.parse`, valida commands/rationale/promptTemplateRef, **descarta** `soundnessPreview` fornecido pela IA; `validateProposal` rejeita íntegro (todo comando na whitelist) acumulando `ProposalError[]` com `newIds`; `buildPlan` materializa comandos, envolve em `compositeCommand`, adiciona `toAuditEvent` (`COPILOT_PROPOSAL_APPLIED` com author `ia.copilot@<providerId>`), projeta em `CommandStack` scratch (sem tocar estado vivo), roda `analyzeSoundness(projected)` computando `SoundnessPreview` local; `soundnessErrors` re-lista erros SND_* reais.
**Saídas:** `{proposal}` | `{error}`; `ProposalValidation`; `CopilotPlan {command, projected: BpmnDiagram, soundnessPreview}`; `SoundnessErrorRef[]` (code/message/nodeId?/edgeId?).
**Estruturas de dados que trafegam:** `CopilotProposal`, `CopilotPlan`, `CopilotAttribution`, `ProposalError`, `ProposalValidation`, `SoundnessPreview`, `SoundnessErrorRef`, `Command`, `BpmnDiagram`.

### `packages/copilot/src/ledgerQuery.ts`
**Papel:** C6 — regra de ouro da citabilidade aplicada localmente: resposta só sai se toda citação resolve a um hash real fornecido.
**Entradas:** `raw: string` (resposta do provider), `knownHashes: Iterable<string>`.
**Processamento (intermediário):** Tira cerca ```json, `JSON.parse`, valida `answer` (string não-vazia) e `citations` (array de strings); `known = Set(knownHashes)`; procura `invented` (hash fora do conjunto) — uma citação inventada envenena a resposta inteira; deduplica citações.
**Saídas:** `LedgerQueryResult` (`{ok:true, answer, citations}` | `{ok:false, reason}`).
**Estruturas de dados que trafegam:** `LedgerQueryResult`, citações (hashes string).

### `packages/copilot/src/prompts.ts`
**Papel:** Registro canônico versionado dos templates de prompt do copiloto (C1–C6, dogfooding).
**Entradas:** Nenhuma.
**Processamento (intermediário):** Const `CONTRACT` (texto do contrato JSON + whitelist) interpolado em cada template.
**Saídas:** `CopilotPromptTemplate` extends `PromptTemplateRef` + `system`; 6 templates (`COPILOT_DRAFT/ADJUST/EXPLAIN/SUMMARY/FIX/QUERY_PROMPT`); `COPILOT_PROMPTS: readonly[]`.
**Estruturas de dados que trafegam:** `CopilotPromptTemplate`, `PromptTemplateRef`, `COPILOT_PROMPTS`.

### `packages/copilot/src/index.ts`
**Papel:** Barrel público do pacote copilot.
**Saídas:** Re-exporta types, whitelist, plan (buildPlan/parseProposal/validateProposal/soundnessErrors + tipos), ledgerQuery, prompts.
**Estruturas de dados que trafegam:** tipos públicos do copiloto.

---

## agentflow

### `packages/agentflow/src/types.ts`
**Papel:** Modelo abstrato headless do sub-workflow de agente de IA (3 tipos de nó + decoradores + arestas); zero imports do ecossistema.
**Entradas:** Nenhuma.
**Processamento (intermediário):** Nenhum.
**Saídas:** Tipos.
**Estruturas de dados que trafegam:** `NodeType` (llm|tool|decision), `DecoratorType` (memory|planner|errorBoundary), `EdgeType` (toolCall|data|delegate), `LlmConfig` (model/promptRef/structuredOutput?), `ToolConfig` (usesTool/params?/timeoutMs?), `DecisionRoute` (next/maxRetries?), `END_ROUTE='end'`, `DecisionConfig` (condition/onTrue/onFalse), decoradores (`MemoryDecorator` scope short/long/expiry?, `PlannerDecorator` strategy static/dynamic, `ErrorBoundaryDecorator` maxRetries/backoff?), `AgentNode` (LlmNode|ToolNode|DecisionNode), `AgentEdge` (from/to/edgeType/when?), `SchemaShape` (Record<string,string>), `AutonomyLevel` (0–5), **`AgentWorkflow`** (kind/id/version/name/autonomyLevel/inputSchema/outputSchema/nodes/edges).

### `packages/agentflow/src/ref.ts`
**Papel:** Parsing de referência versionada `id@semver` (AgentRef); normaliza formas abreviadas para major.minor.patch.
**Entradas:** `RefInput` (string `id@version` ou `{id, version}`).
**Processamento (intermediário):** `normalizeVersion` valida com regex `VERSION_PART`, expande `2`→`2.0.0` e empurra `warnings`; `parseRef` separa pelo ÚLTIMO `@` (id pode conter `-`/`:`/`.`); locais transitórios `at`, `id`, `warnings`; `AgentRefError` para inválidos.
**Saídas:** `ParsedRef {ref: AgentRef, warnings: string[]}`; `AgentRef {id, version}` (toRef); `string` (formatRef); `boolean` (isValidRef).
**Estruturas de dados que trafegam:** `AgentRef`, `RefInput`, `ParsedRef`, `AgentRefError`.

### `packages/agentflow/src/graph.ts`
**Papel:** Helpers puros de grafo sobre AgentWorkflow (sucessores internos, alcançabilidade, SCC/loops, branching) que a validação e a autonomia consomem.
**Entradas:** `AgentWorkflow`, ids de nó, `index?`.
**Processamento (intermediário):** `nodeIndex` (Map id→node); `internalSuccessors` funde rotas de decision (onTrue/onFalse, exclui `end`/delegate) com arestas não-delegate; `canReach` DFS (`seen`/`stack` transitórios); `loopComponents` Tarjan SCC (mapas `idx`/`low`, `onStack`, `stack`, `components`, recursão `strongconnect`); `isBranchingDecision` classifica rotas forward distintas.
**Saídas:** `Map<string,AgentNode>`; `boolean` (hasDelegateEdge/canReach/hasRetryLoop/isBranchingDecision); `string[]` (internalSuccessors); `string[][]` (loopComponents); rotas rotuladas (decisionRoutes).
**Estruturas de dados que trafegam:** `AgentWorkflow`, `AgentNode`, `DecisionNode`, `END_ROUTE`.

### `packages/agentflow/src/autonomy.ts`
**Papel:** Escala normativa de autonomia (0–5); metade agnóstica ao grafo — mínimo coerente, checagem de coerência, requisito de gate.
**Entradas:** `AutonomyLevel` (gateRequirement/requiresDownstreamGate); `AgentWorkflow` (minCoherentLevel/autonomyCoherence).
**Processamento (intermediário):** `minCoherentLevel` deriva do grafo (delegate→4, branching→3, retry→2, senão 1) via helpers de graph.ts; `autonomyCoherence` compara declarado vs mínimo e emite erro se menor.
**Saídas:** `AUTONOMY_SCALE: readonly AutonomyDefinition[]`; `GateRequirement` (required/optional/none); `AutonomyLevel` (minCoherentLevel); `ValidationIssue[]` (AUTONOMY_INCOHERENT); `boolean`.
**Estruturas de dados que trafegam:** `AutonomyDefinition` (level/name/definition/gate), `GateRequirement`, `AutonomyLevel`, `ValidationIssue`, `AgentWorkflow`.

### `packages/agentflow/src/validate.ts`
**Papel:** Validação do grafo (5 regras §3 + proibição de stop implícito §1.4 + coerência de autonomia §4); erro bloqueia promoção.
**Entradas:** `AgentWorkflow` + `ValidateOptions {resolveDelegate?}` (resolução de delegate injetada e degradável).
**Processamento (intermediário):** Acumulador `issues: ValidationIssue[]`; `isStructuredCondition` (regex `\boutput\b`); checagens: `checkImplicitMetric` (proíbe `confidence`), `checkRetryMax` (rota que loopa sem maxRetries), `checkCycleStop` (ciclo sem decision com stop estruturado e saída), `checkStructuredLlm` (LLM que alimenta decision estruturada precisa structuredOutput), `checkRefs` (parseRef de promptRef e delegate; unresolved→warning), `checkSchemasAndStructure` (schemas não-vazios, endpoints existentes, rotas de decision válidas). Cada check produz `ValidationIssue` com code/severity/message/remediation.
**Saídas:** `ValidationIssue[]` (validateGraph, ordem estável); `boolean` (isValid).
**Estruturas de dados que trafegam:** `ValidationIssue` (code/severity/message/nodeId?/remediation?), `ValidateOptions`, `AgentRef`, `AgentWorkflow`.

### `packages/agentflow/src/graph.ts` → (coberto acima)

### `packages/agentflow/src/simTypes.ts`
**Papel:** Shape do resultado de simulação do agente — **estruturalmente idêntico** aos tipos do H7 (`packages/simulation`), por estrutura e não por dependência.
**Entradas:** Nenhuma.
**Processamento (intermediário):** Nenhum.
**Saídas:** Tipos (paridade de shape).
**Estruturas de dados que trafegam:** `Token`, `GatewayKind`, `PendingChoice`, `BoundaryOption`, `PendingDecisionInput`, `TransitionRecord` (mesmos membros do H7), `BlockedDecision` (nodeId/cell/reason), `SimulationState` (tokens/joinArrivals/traversedEdges/visitedNodes/trail/complete/deadlocked/pendingChoice/boundaryOptions/pendingDecisionInput/blockedDecision), `NodeFixture` (outputs?/fails?), `Fixtures`, `SimulateOptions` (fixtures?/maxSteps?).

### `packages/agentflow/src/simulate.ts`
**Papel:** Engine mock determinístico próprio do agentflow (mensagens, data-mapping, retries); stops honestos, nunca importa o engine H7.
**Entradas:** `AgentWorkflow` + `SimulateOptions {fixtures?, maxSteps?}`.
**Processamento (intermediário):** Estado `SimulationState` via `emptyState()`; mapas transitórios de execução: `context` (nodeId→último output), `merged` (output acumulado da data-mapping), `visitCount`/`failCount`/`retryCount`, `clock` (tempo lógico de backoff), `step`; `evaluateCondition` avalia subconjunto `output.<path> <op> <literal>` (regex `CONDITION`, `readPath`, `parseLiteral`) retornando `{value}` ou `{blocked}`; `resolveParams` substitui templates `{{node.output.path}}`; `fixtureOutput` pega i-ésima saída declarada; `backoffDelay` (exponential 2^(n-1)); `entryNode` acha nó de entrada; loop principal processa decision (route/retry/loop) e llm/tool (errorBoundary/memory/planner); `block()` produz `BlockedDecision` + registro `decision-blocked`; `record()` empurra `TransitionRecord`.
**Saídas:** `SimulationState` final (trail completo; `complete` ou `blockedDecision`).
**Estruturas de dados que trafegam:** `SimulationState`, `TransitionRecord`, `BlockedDecision`, `Fixtures`, `SimulateOptions`, `AgentNode`, `AgentWorkflow`.

### `packages/agentflow/src/templates.ts`
**Papel:** Três templates iniciais, cada um exemplifica uma rung da escala de autonomia (todos passam `validateGraph`).
**Entradas:** Nenhuma.
**Processamento (intermediário):** Nenhum.
**Saídas:** `APPROVAL_GATE_AGENT` (autonomia 1), `RESEARCH_AGENT` (autonomia 2, retry com memory+errorBoundary), `DOCUMENT_REVIEW_AGENT` (autonomia 3, branch); `DEFAULT_TEMPLATE_ID`; `TEMPLATES: readonly AgentWorkflow[]`.
**Estruturas de dados que trafegam:** `AgentWorkflow` (com `LlmConfig`/`ToolConfig`/`DecisionConfig` e decoradores).

### `packages/agentflow/src/langgraph.ts`
**Papel:** Interop LangGraph JSON (subconjunto documentado ⇄ AgentWorkflow); import/export com warnings declarados para tudo fora do subset.
**Entradas:** `LangGraphJson` (importLangGraph); `AgentWorkflow` (exportLangGraph).
**Processamento (intermediário):** `import`: `warnings[]` para chaves top-level fora de `KNOWN_TOP_LEVEL`; mapeia nós (type deve ∈ `NODE_TYPES`, senão `LangGraphImportError`), config = `node.data`; mapeia arestas (`edgeType` de `data.edgeType` ∈ `EDGE_TYPES`, default `data`); recomputa `autonomyLevel` via `minCoherentLevel`. `export`: warnings para `autonomyLevel` (sempre), decoradores droppados, arestas `delegate` (a2a) droppadas; monta `LangGraphJson` com `input_schema`/`output_schema`.
**Saídas:** `LangGraphImportResult {workflow: AgentWorkflow, warnings}`; `LangGraphExportResult {json: LangGraphJson, warnings}`; `LangGraphImportError`.
**Estruturas de dados que trafegam:** `LangGraphNode`, `LangGraphEdge`, `LangGraphJson`, `LangGraphImportResult`, `LangGraphExportResult`, `AgentWorkflow`, `AgentNode`, `AgentEdge`, `SchemaShape`.

### `packages/agentflow/src/index.ts`
**Papel:** Barrel público do pacote agentflow.
**Saídas:** Re-exporta types, ref, validate, autonomy, graph, templates, simTypes, simulate, langgraph.
**Estruturas de dados que trafegam:** todos os tipos públicos do agentflow.

---

## Síntese de dados família/IA

O cluster gira em torno de poucos "dados espinha-dorsal" que atravessam pacotes independentes, costurados por injeção estrutural (nunca por dependência direta):

- **`DecisionTable` / `DecisionRule` / `DecisionTableColumn` / `HitPolicy`** (dmn) — a tabela de decisão editável, que é estruturalmente também `SfeelTable`, e serializa round-trip em `<dmn:decisionTable>` XML canônico (DMN 1.3).
- **`EvaluateResult` / `SfeelMatch` / `NonSimulable` / `UnaryTest` / `ParsedCell` / `CellCheck`** (sfeel) — o resultado honesto da avaliação de células (match, `null`, ou `nonSimulable{cell,reason}`), sem terceiro estado silencioso.
- **`DecisionEvaluator` / `DecisionOutcome`** (simulation, interface injetada) — o contrato que `dmn.createSfeelDecisionSupport` implementa sem importar simulation; caminho runtime: **engine → DecisionEvaluator → sfeelSupport → sfeel.evaluate → DecisionOutcome/BlockedDecision**.
- **`SimulationState` / `Token` / `TransitionRecord` / `SimNode` / `SimEdge`** (simulation) — o snapshot serializável do frontier de tokens e o trail; `agentflow.simTypes` replica esse shape por estrutura (paridade sem dependência).
- **`Decision` / `Scenario` / `SimulationSession` / `CoveragePath` / `CoverageSummary`** — o roteiro replayável (lista ordenada de decisões), seu hash canônico e a evidência de cobertura SACM/ledger; dominadores (`idom`) sustentam a convergência OR-join.
- **`CopilotProposal` → `CopilotPlan`** (copilot) — proposta bruta da IA parseada, validada íntegra contra a whitelist, materializada como 1 composite undoável, projetada em scratch-stack e com `SoundnessPreview` computado LOCALMENTE (nunca da IA).
- **`AIProvider` (request/response) / `ProposedCommand` / `COMMAND_WHITELIST` / `PromptTemplateRef` / `COPILOT_PROMPTS`** — transporte de IA injetado, subconjunto de comandos de edição permitidos e templates versionados (C1–C6).
- **`LedgerQueryResult` (citações)** — regra de ouro C6: resposta só surge se cada citação resolve a um hash real; uma citação inventada envenena tudo.
- **`AgentWorkflow` / `AgentNode` / `AgentEdge` / `Decorator` / `AutonomyLevel`** (agentflow) — o grafo abstrato de agente (3 nós + decoradores), com a escala normativa de autonomia ("o grafo é quem manda": `minCoherentLevel` vs declarado).
- **`AgentRef` / `ParsedRef`** e **`LangGraphJson` (import/export)** — referências versionadas `id@semver` normalizadas e a interop LangGraph com perdas sempre declaradas em `warnings`.
- **`ValidationIssue`** — moeda comum de validação em agentflow, healthcare (`HC_DECISION_UNLINKED`) e domain-example (regras de gate/squad/handoff), sempre com severidade error/warning.

Fio condutor de honestidade que une os pacotes: toda falha é DECLARADA e nomeada (S-FEEL `nonSimulable`, simulação `BlockedDecision`, agentflow stop honesto, copilot rejeição íntegra, LangGraph warnings) — nunca um resultado silenciosamente errado ou um dado inventado.
