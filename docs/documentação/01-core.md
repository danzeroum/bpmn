# Mapa de Dados — Camada de Domínio (`@buildtovalue/core`)

> Parte do catálogo de dados do sistema (ver `docs/documentação/README.md`).
> Cobre todos os arquivos de `packages/core/src`. Para cada arquivo: dados de
> entrada, processamento intermediário (inclui dados transitórios locais) e saída.

Este catálogo cobre todos os arquivos-fonte de `packages/core/src`, agrupados
por subsistema (a contagem exata vive no código — `find packages/core/src -name '*.ts' | wc -l`). A camada é *pura* (sem I/O, exceto `crypto` e `crypto.subtle`
globais), determinística e serializável em JSON. Datas são strings ISO-8601;
nós e arestas vivem em dicionários `Record<id, …>`.

---

## model

### `packages/core/src/model/types.ts`
> Δ 2026-07: modelo estendido pelos Handoffs 16–19 — `VersionStatus` ganha o estado de parada `in-review` (7 estados); passthrough de extensões estrangeiras (`XmlSubtree` + `foreignExtensions`/`foreignAttributes` em nós e arestas, `processForeignExtensions`/`foreignNamespaces` no diagrama); definições de evento nomeadas (`NamedEventDefinition`/`ErrorEventDefinition`/`EscalationEventDefinition`/`EventDefinitions` + campo `definitions` no diagrama, tudo opcional/aditivo para manter hashes byte-idênticos); `EVENT_DEFINITION_KINDS` inclui `compensate` (Handoff 19); novos guards `isEventSubprocess` (subProcess `triggeredByEvent`) e `startIsInterrupting`.
**Papel:** Modelo de domínio canônico — todas as interfaces de dados e helpers puros de consulta sobre o diagrama.
**Entradas:** Parâmetros dos helpers: `node: BpmnNode`, `diagram: BpmnDiagram`, `type: string`, `hostIds: Iterable<string>`, `nodeId: string`, `point: Point`, `exclude: ReadonlySet<string>`. Consome campos `node.properties.marker`, `.attachedToRef`, `.cancelActivity`, `.parentId`, `.isExpanded`, `.calledElement`, `.eventDefinition`, `.flowNodeRefs`, `.triggeredByEvent`, `.isInterrupting`.
**Processamento (intermediário):** `activityMarkerOf`/`eventDefinitionOf` fazem type-guard string + `includes`. `isEventSubprocess` = `subProcess` com `triggeredByEvent===true`; `startIsInterrupting` = `startEvent` sem `isInterrupting:false` (default OMG interrompe) — ambos são a fonte única do predicado (reforço 9: lint e matriz de execução consomem o helper, nunca a property crua). `attachedBoundaryEventIds` monta um `Set` de hosts e filtra `activeNodes`. `descendantIdsOf` faz DFS com `out: string[]`, `seen: Set`, `stack` (guarda contra ciclos). `containmentDepth` sobe a cadeia `parentId` com `seen: Set` e contador `depth`. `subProcessContainerAt` itera todos os nós mantendo `best`/`bestDepth`, testa contido no retângulo, desempata por profundidade e menor área (`node.width*node.height`). `childrenOf` filtra por `parentId`. Constantes locais transitórias em cada laço.
**Saídas:** Valores de retorno puros: `ActivityMarker|undefined`, `boolean`, `string[]`, `BpmnNode[]`, `BpmnNode|undefined`, `string|undefined`. Nenhuma mutação (todos os helpers são read-only).
**Estruturas de dados que trafegam:** Types/interfaces `VersionStatus` (`draft`, `test`, `candidate`, `in-review`, `active`, `deprecated`, `retired`), `Point`, `Size`, `Rect`, `AuditEventRecord`, `AuditTrail`, `XmlSubtree` (`tag`, `attributes`, `children`, `text` — forma de armazenamento das extensões estrangeiras preservadas), `BpmnNode`, `BpmnEdge` (ambos com `foreignExtensions?`/`foreignAttributes?`), `ApprovalRecord`, `BpmnVersion` (inclui `changeSummaryOrigin`), `NamedEventDefinition` (`id`, `name`), `ErrorEventDefinition` (+`errorCode?`), `EscalationEventDefinition` (+`escalationCode?`), `EventDefinitions` (buckets `messages`/`signals`/`errors`/`escalations?`), `BpmnDiagram` (+`definitions?`/`processForeignExtensions?`/`foreignNamespaces?`), `UserContext`, `EventDefinitionKind`, `ActivityMarker`. Consts: `BUILT_IN_EDGE_TYPES` (`sequenceFlow`, `messageFlow`, `association`), `EVENT_DEFINITION_KINDS` (`message`, `timer`, `error`, `signal`, `escalation`, `compensate`, `conditional`, `link`, `terminate` — 9 tipos; `compensate` == prefixo OMG, round-trip pela mesma máquina `${kind}EventDefinition`), `ACTIVITY_MARKERS` (`loop`, `parallelMultiInstance`, `sequentialMultiInstance`), `EVENT_NODE_TYPES` (`startEvent`, `endEvent`, `intermediateCatchEvent`, `intermediateThrowEvent`, `boundaryEvent`), `CONTAINER_NODE_TYPES` (`pool`, `lane`), `DATA_ASSOCIATION_EDGE_TYPE` (`'dataAssociation'`). Funções exportadas: `activityMarkerOf`, `isEventType`, `boundaryAttachedTo`, `isNonInterrupting`, `isEventSubprocess`, `startIsInterrupting`, `attachedBoundaryEventIds`, `nodeParentId`, `childrenOf`, `descendantIdsOf`, `isSubProcessExpanded`, `subProcessContainerAt`, `calledElementOf`, `eventDefinitionOf`, `isContainerType`, `laneFlowNodeRefs`, `activeNodes`, `activeEdges` (internas: `containmentDepth`).

### `packages/core/src/model/flow.ts`
**Papel:** Classificação de fluxo de sequência compartilhada pelas análises estruturais (soundness, simulation, replay) — hospedada no core para que concordem por construção (antes duplicada em cada pacote).
**Entradas:** `node: BpmnNode`, `edge: BpmnEdge`, `diagram: BpmnDiagram`.
**Processamento (intermediário):** `isFlowNode` = não-container e fora de `NON_FLOW_TYPES`; `isFlowEdge` = fora de `NON_FLOW_EDGE_TYPES`; `flowScopeOf` resolve boundary event para o escopo do host via `boundaryAttachedTo` + `nodeParentId`.
**Saídas:** Booleans e `string|undefined` (escopo). Sem mutação.
**Estruturas de dados que trafegam:** Consts `NON_FLOW_TYPES` (`dataObject`, `dataStore`, `textAnnotation`, `group`), `NON_FLOW_EDGE_TYPES` (`messageFlow`, `association`, `dataAssociation`); funções `isFlowNode`, `isFlowEdge`, `flowScopeOf`.

### `packages/core/src/model/errors.ts`
**Papel:** Hierarquia de erros do domínio, permitindo ramificar por tipo/código.
**Entradas:** `code: string`, `message: string`, `line?: number` (apenas `BpmnParseError`).
**Processamento (intermediário):** Construtor de `BpmnError` seta `this.name = new.target.name` e `this.code`; `BpmnParseError` concatena `(line N)` na mensagem quando `line` presente.
**Saídas:** Instâncias de `Error` com propriedades `code` (readonly) e `line`. Efeito: lança/propaga exceções.
**Estruturas de dados que trafegam:** Classes `BpmnError` (base), `BpmnValidationError` (`VALIDATION`), `BpmnLifecycleError` (`LIFECYCLE`), `BpmnAuditError` (`AUDIT`), `BpmnParseError` (`PARSE`, com `line?`), `BpmnRuleError` (`RULE`).

### `packages/core/src/model/factory.ts`
**Papel:** Fábricas que produzem versões, nós, arestas e diagramas com defaults.
**Entradas:** `CreateVersionOptions`, `CreateNodeOptions`, `CreateEdgeOptions`, `CreateDiagramOptions`; `registry: NodeTypeRegistry` (default `createDefaultRegistry()`). Leituras externas: `globalThis.crypto.randomUUID()`, `new Date().toISOString()`, `registry.get(type)` (para `label` e `defaultSize`).
**Processamento (intermediário):** `createAuditTrail` monta `{ createdAt, createdBy, history: [] }`. Aplica defaults via `??` (semanticVersion `0.1.0`, status `draft`, createdBy `anonymous`, type de aresta `sequenceFlow`, versionId `'0'`). Inclusão condicional de campos opcionais com spread `...(cond ? {...} : {})` (dados transitórios de construção).
**Saídas:** Retornam `string` (`generateId`, `nowIso`), `BpmnVersion`, `BpmnNode`, `BpmnEdge`, `BpmnDiagram` novos (`snapshotHash` inicia `''`, `approvedBy: []`, `nodes/edges/metadata: {}`).
**Estruturas de dados que trafegam:** Interfaces `CreateVersionOptions`, `CreateNodeOptions`, `CreateEdgeOptions`, `CreateDiagramOptions`. Funções `generateId`, `nowIso`, `createVersion`, `createNode`, `createEdge`, `createDiagram` (interna `createAuditTrail`).

### `packages/core/src/model/registry.ts`
**Papel:** Registro de tipos de nó (BPMN padrão + plugins) com resolução por tag XML.
**Entradas:** `NodeTypeDefinition` (no `register`), `type: string`, `tag: string`, `preferred: string[]`.
**Processamento (intermediário):** `NodeTypeRegistry.definitions` é um `Map<string, NodeTypeDefinition>` (estado interno). `register` verifica duplicidade (lança `BpmnValidationError`). `typeForXmlTag` percorre primeiro a lista `preferred`, depois todas as definições, comparando `def.xml.tag`. `createDefaultRegistry` itera `BUILT_IN_NODE_TYPES` registrando cada uma.
**Saídas:** `void` (register), `boolean` (has), `NodeTypeDefinition` (get; lança se ausente), `NodeTypeDefinition[]` (list), `NodeTypeDefinition|undefined` (typeForXmlTag), nova `NodeTypeRegistry`. Mutação: preenche o `Map` interno.
**Estruturas de dados que trafegam:** Type `NodeCategory` (`event`, `activity`, `gateway`, `data`, `artifact`, `container`, `custom`), interface `NodeTypeDefinition` (`type`, `label`, `category`, `defaultSize: Size`, `xml.tag`, `visual?.shadow`), classe `NodeTypeRegistry`. Const `BUILT_IN_NODE_TYPES`: tabela de 27 tipos — startEvent/endEvent/intermediateCatch/intermediateThrow/boundaryEvent (36×36), task/userTask/serviceTask/scriptTask/sendTask/receiveTask/manualTask/businessRuleTask/callActivity/agentTask (120×60, agentTask mapeia tag `task`), exclusive/parallel/inclusive/eventBased/complexGateway (50×50), subProcess (300×160), dataObject (36×50, tag `dataObjectReference`), dataStore (50×50, tag `dataStoreReference`), textAnnotation (120×40), group (220×140), pool (600×250, tag `participant`), lane (570×120).

### `packages/core/src/model/eventDefinitions.ts`
> Δ 2026-07: NOVO (Handoff 16 §3a, Handoff 18 §5a, Handoff 19 §6b) — helpers headless das definições de evento nomeadas (fonte única de buckets/ids/refs) e das enumerações compartilhadas de escalação e compensação.
**Papel:** Camada de consulta pura das definições de evento nomeadas (message/signal/error/escalation) e enumerações de catches de escalação e atividades compensáveis, consumidas por lint, picker e simulador sem reimplementar a topologia.
**Entradas:** `diagram: BpmnDiagram`, `kind: EventDefinitionRefKind`, `id: string`, `node: BpmnNode`, `throwRef?: string`, `scope?: string`. Lê `diagram.definitions`, `node.properties.eventDefinition`/`.eventDefinitionRef`/`.attachedToRef`/`.triggeredByEvent`, `node.type`. Usa `activeNodes`, `boundaryAttachedTo`, `isEventSubprocess`, `nodeParentId` (types) e `flowScopeOf` (flow).
**Processamento (intermediário):** `eventDefinitionsOf` tolera campo ausente E bucket `escalations` ausente (preenche → `Required<EventDefinitions>`). `eventDefinitionList`/`findEventDefinition` indexam por bucket. `nextEventDefinitionId` monta um `Set` de ids tomados e incrementa `counter` até `${prefix}-N` livre (prefixos `msg`/`sig`/`err`/`esc`). `eventDefinitionRefOf` valida string não-vazia. `eventDefinitionUsages` filtra nós ativos com kind+ref batendo (id + label, para vetos honestos). `eligibleEscalationCatches` itera `activeNodes` classificando cada catch de escalação em `boundary` ou `esubStart` (start de event subprocess) e casa por `catchAll` (sem ref) vs `exact` (mesmo `throwRef`) — enumeração pura, sem escopo/precedência. `compensableActivitiesOf` enumera hosts de boundary `compensate` no escopo dado (`flowScopeOf`), deduplicando por `seen: Set` (primeiro boundary vence).
**Saídas:** `Required<EventDefinitions>`, listas/`undefined` de definições, `string` (próximo id), `EscalationCatch[]`, `CompensableActivity[]`, `Array<{nodeId, label}>`. Sem mutação.
**Estruturas de dados que trafegam:** Const `EVENT_DEFINITION_REF_KINDS` (`message`, `signal`, `error`, `escalation`), type `EventDefinitionRefKind`, const `EVENT_DEFINITION_BUCKETS` (kind→bucket), interfaces `EscalationCatch` (`node`, `catchKind: boundary|esubStart`, `matchType: exact|catchAll`), `CompensableActivity` (`activityId`, `label`, `boundaryId`). Funções `emptyEventDefinitions`, `eventDefinitionsOf`, `eventDefinitionList`, `findEventDefinition`, `nextEventDefinitionId`, `eventDefinitionRefOf`, `eventDefinitionUsages`, `eligibleEscalationCatches`, `compensableActivitiesOf` (const interna `ID_PREFIX`).

### `packages/core/src/model/iso8601.ts`
> Δ 2026-07: NOVO (Handoff 16 E-5, §3d) — parser total (nunca lança) de expressões de timer ISO 8601 para os três sabores OMG (`date`/`duration`/`cycle`).
**Papel:** Parser headless de expressões de timer ISO 8601, decidindo o trap P1M (1 mês) vs PT1M (1 minuto) uma única vez, e extração da property canônica `timer` de um nó.
**Entradas:** `kind: TimerKind`, `expression: string` (parseTimerExpression); `node: BpmnNode` (timerPropertyOf, lê `properties.timer`).
**Processamento (intermediário):** `parseTimerExpression` faz trim; `date` valida via `DATE_RE` + `Date.parse`; `duration` via `DURATION_RE` (`parseDurationParts` — rejeita `P`/`PT` vazios e `T` pendente); `cycle` divide por `/` em `R[n]/duração` ou `R[n]/início/duração`, valida repetições (`null` = ilimitado) e âncora opcional. `timerPropertyOf` valida objeto `{kind∈TIMER_KINDS, expression:string}`.
**Saídas:** `TimerParseResult` (união discriminada `valid:true` por kind ou `valid:false` com `error`), `TimerProperty|undefined`. Sem mutação, nunca lança.
**Estruturas de dados que trafegam:** Type `TimerKind` (`date|duration|cycle`), interfaces `TimerProperty` (`kind`, `expression`), `DurationParts` (`years`…`seconds`), type `TimerParseResult`. Consts internas `DATE_RE`, `DURATION_RE`, `TIMER_KINDS`. Funções `parseTimerExpression`, `timerPropertyOf` (internas `parseDurationParts`, `parseDate`).

---

## events

### `packages/core/src/events/EventBus.ts`
**Papel:** Barramento de eventos síncrono com prioridades, cancelamento e transformação de payload.
**Entradas:** `event: string`, `handler: EventHandler<T>`, `priority = 0` (on/once/off); `payload: T` (fire).
**Processamento (intermediário):** `listeners: Map<string, Registration[]>` e contador monotônico `seq`. `on` insere `{ handler, priority, seq }` e reordena por prioridade desc / seq asc. `once` embrulha o handler num `wrapper` que se desinscreve. `fire` copia a lista (`[...list]`), acumula `current = payload`; retorno `false` cancela (skip do resto), qualquer não-`undefined` substitui o payload. `off` faz `findIndex`/`splice` e remove chave vazia.
**Saídas:** `() => void` (unsubscribe) de on/once; `FireResult<T>` (`{ cancelled, payload }`) de fire; `void` de off/clear. Mutação do `Map` interno.
**Estruturas de dados que trafegam:** Type `EventHandler<T>`, interface `FireResult<T>`, interface interna `Registration` (`handler`, `priority`, `seq`), classe `EventBus`.

---

## commands

### `packages/core/src/commands/types.ts`
**Papel:** Contratos do padrão Command (transformação reversível e pura do diagrama) e do interceptor de regras.
**Entradas:** N/A (apenas definições de tipo). `execute`/`undo` recebem `diagram: BpmnDiagram`.
**Processamento (intermediário):** Nenhum (arquivo declarativo).
**Saídas:** Tipos consumidos por toda a camada de comandos/engine.
**Estruturas de dados que trafegam:** Interface `Command` (`id`, `description`, `execute(d)→d`, `undo(d)→d`, `toAuditEvent?()→{type, details}`), `RuleVerdict` (`allowed: boolean`, `reason?`), `CommandInterceptor` (`evaluateCommand(command, diagram)→RuleVerdict`).

### `packages/core/src/commands/CommandStack.ts`
**Papel:** Dono do estado do diagrama e do histórico undo/redo, com semântica git-like.
**Entradas:** `initial: BpmnDiagram`, `CommandStackOptions` (`bus?`, `interceptor?`, `limit? = 200`); `command: Command`; `listener`.
**Processamento (intermediário):** Estado interno: `stack: Command[]`, `cursor = -1`, `diagram`, `changeListeners: Set`. `execute` consulta interceptor (veta), dispara `command.pre` (cancelável), aplica `command.execute`, descarta o "futuro" (`stack.slice(0, cursor+1)`), faz push, aplica limite (`shift`), atualiza `cursor`, dispara `command.post`. `undo`/`redo` movem o cursor e reaplicam `undo`/`execute`. `notifyChanged` dispara `stack.changed` e chama listeners.
**Saídas:** `RuleVerdict` (execute), `boolean` (undo/redo), `void` (reset), `() => void` (subscribe), getters `current`/`canUndo`/`canRedo`. Efeitos: eventos no bus (`command.pre`, `command.post`, `command.undone`, `command.redone`, `stack.changed`); mutação do estado interno.
**Estruturas de dados que trafegam:** Interfaces `CommandStackOptions`, `CommandStackEvent` (`command`, `diagram`), classe `CommandStack`.

### `packages/core/src/commands/commands.ts`
> Δ 2026-07: CRUD undoable das definições de evento nomeadas (Handoff 16 §3a) — `addEventDefinitionCommand`/`updateEventDefinitionCommand`/`removeEventDefinitionCommand` sobre `diagram.definitions`; refs vivem em `properties.eventDefinitionRef` (id), então rename nunca toca nós e um só undo restaura tudo. `removeEventDefinitionCommand` carrega o marcador estrutural `eventDefinitionRemoval` que a regra `command.pre` inspeciona para vetar exclusão de definição em uso. `withoutUndefined` poda chaves `undefined` dos property-bags mesclados (removal semantics = campo ausente).
**Papel:** Fábricas de comandos concretos (add/move/resize/update/remove/supersede/composite/restore + CRUD de definições de evento) — cada um puro e reversível.
**Entradas:** `node: BpmnNode`, `edge: BpmnEdge`, `nodeId`/`edgeId: string`, `from`/`to: Point` (& `Size` em resize), `hostId`, `side`, `t`, `position: Point`, `NodePatch`, `EdgePatch`, `actor: UserContext` (default `SYSTEM_USER`), `snapshot: BpmnDiagram`, `commands: Command[]`, `description`; `kind: EventDefinitionRefKind`, `definition: EditableDefinition`, `definitionId`, `patch: {name?, errorCode?, escalationCode?}`.
**Processamento (intermediário):** Helpers puros de estrutura: `withNode`/`withEdge` (spread inserindo no dicionário), `withoutNode`/`withoutEdge` (desestruturação removendo chave), `appendHistory` (adiciona `AuditEventRecord` à trilha), `withoutUndefined` (filtra entries `undefined`). Muitos comandos capturam estado anterior em closures transitórias: `previous: BoundarySnapshot|NodePatch|EdgePatch|EditableDefinition`, `before: BpmnDiagram|null`, `deletedNodes`/`deletedEdges`/`closedIds`/`closed`, `hadDefinitions`/`removed`. `removeNodeCommand` cascateia sobre `descendantIdsOf` (monta `ids: Set`, predicado `touches` para arestas), decide hard-delete (status `draft`) vs. fechamento (`removedInVersion`). `compositeCommand` usa `reduce` (undo em ordem reversa). `restoreDiagramCommand` troca o diagrama por snapshot e guarda `before`. CRUD de definições opera via `bucketOf`/`replaceBucket`/`withDefinitions` (kind→bucket por `EVENT_DEFINITION_BUCKETS`); `addEventDefinitionCommand` restaura hash-neutralidade removendo o campo `definitions` no undo quando o diagrama não o tinha; `updateEventDefinitionCommand` só faz patch por id.
**Saídas:** Cada fábrica retorna um `Command` (ou `EventDefinitionRemovalCommand`); `execute`/`undo` retornam novos `BpmnDiagram` (structural sharing); `toAuditEvent` retorna `{ type, details }`. `isEventDefinitionRemoval` retorna `boolean` (type-guard). Sem mutação de entrada.
**Estruturas de dados que trafegam:** Const `SYSTEM_USER` (`{id:'system', role:'system'}`), interfaces `BoundarySnapshot`, `NodePatch` (`label?`, `properties?`), `EdgePatch` (`label?`, `purpose?`, `properties?`, `waypoints?: Point[]|null`), `EventDefinitionRemovalCommand` (`Command` + `eventDefinitionRemoval: {kind, definitionId}`), type interno `EditableDefinition` (`NamedEventDefinition` + `errorCode?`/`escalationCode?`). Tipos de audit-event emitidos: `NODE_ADDED`, `NODE_MOVED`, `NODE_RESIZED`, `BOUNDARY_ATTACHED`, `BOUNDARY_DETACHED`, `NODE_UPDATED`, `EDGE_UPDATED`, `EDGE_CREATED`, `NODE_REMOVED`, `EDGE_REMOVED`, `EDGE_SUPERSEDED`, `COMPOSITE`, `DIAGRAM_RESTORED`, `EVENT_DEFINITION_ADDED`, `EVENT_DEFINITION_UPDATED`, `EVENT_DEFINITION_REMOVED`. Funções: `addNodeCommand`, `moveNodeCommand`, `resizeNodeCommand`, `attachBoundaryCommand`, `detachBoundaryCommand`, `updateNodeCommand`, `updateEdgeCommand`, `addEdgeCommand`, `removeNodeCommand`, `removeEdgeCommand`, `supersedeEdgeCommand`, `compositeCommand`, `restoreDiagramCommand`, `addEventDefinitionCommand`, `updateEventDefinitionCommand`, `removeEventDefinitionCommand`, `isEventDefinitionRemoval` (internas `withoutUndefined`, `bucketOf`, `replaceBucket`, `withDefinitions`).

---

## engine

### `packages/core/src/engine/lifecycle.ts`
> Δ 2026-07: `DEFAULT_TRANSITIONS` ganha o estado de parada `in-review` (Handoff 15 §2e, EM REVISÃO ⟲) — entrado só por request-changes (`candidate → in-review`) e deixado só por re-submissão (`in-review → candidate`).
**Papel:** Governança do ciclo de vida da versão (transições, aprovações, gates de promoção, clonagem para draft).
**Entradas:** `LifecycleConfig` (transitions?, minApprovalRoles? = 2, minChangeSummaryLength? = 20, requireDiff? = false, promotionRules? = []); `PromotionInput` (`diagram`, `target`, `actor`, `reason`, `diff?`); `version: string` + `bump: SemverBump` (bumpSemver); `diagram` (computeDiagramHash). Leitura externa: `sha256Hex`/`canonicalJson`, `nowIso`, `generateId`.
**Processamento (intermediário):** `bumpSemver` faz `version.split('.').map(parseInt)` com defaults, produz nova string. `computeDiagramHash` strippa `audit` de cada nó/aresta (`strippedNodes`/`strippedEdges` via `Object.fromEntries`), canonicaliza e faz SHA-256. `evaluateGates` monta array `gates: PromotionGate[]`: gate `transition` (via `canTransition`), e se target=`active`: gate `approvals` (conta `Set` de roles distintos em `approvedBy`), `change-summary` (comprimento trim), `diff` (se requireDiff), mais um gate `rule:N` por cada `promotionRule` (avaliada async). `promote` acha o primeiro gate insatisfeito e lança seu `detail`; senão constrói `BpmnVersion` `promoted` (novo id, parentVersionId encadeado, snapshotHash, effectiveFrom/effectiveUntil condicionais). `approve` verifica aprovação duplicada, cria `ApprovalRecord`. `createDraftFrom` cria `draftVersion` com semver bumpado e clona `nodes`/`edges`.
**Saídas:** `string` (bumpSemver), `Promise<string>` (computeDiagramHash), `boolean`/`VersionStatus[]` (canTransition/allowedTargets), `BpmnDiagram` (approve), `Promise<PromotionGate[]>` (evaluateGates), `Promise<BpmnDiagram>` (promote, createDraftFrom). Lança `BpmnLifecycleError`. Sem mutação de entrada (sempre nova versão).
**Estruturas de dados que trafegam:** Const `DEFAULT_TRANSITIONS` (draft→[test], test→[candidate,draft], candidate→[active,test,in-review], in-review→[candidate], active→[deprecated], deprecated→[retired], retired→[]). Interfaces `PromotionInput`, `PromotionGate` (id `transition|approvals|change-summary|diff|rule:N`, `label`, `satisfied`, `detail`, `required?`, `current?`), `LifecycleConfig`; types `PromotionRule`, `SemverBump` (`major|minor|patch`); classe `LifecycleEngine`. Funções `bumpSemver`, `computeDiagramHash`.

### `packages/core/src/engine/rules.ts`
> Δ 2026-07: quatro novos vetos padrão além dos dois originais — (17) fluxo de sequência nunca toca a casca de um event subprocess (`isEventSubprocess`, ambas direções); (19) handler de compensação (`isForCompensation`) não recebe/emite fluxo de sequência e boundary `compensate` só conecta por associação (associações são explicitamente liberadas); (16) remover definição de evento referenciada é vetado com a lista honesta de usos (`isEventDefinitionRemoval` + `eventDefinitionUsages`).
**Papel:** Motor declarativo de pré-condições (veto de comandos/conexões) e regras padrão de governança.
**Entradas:** `event: string`, `rule: Rule<T>` (register); `payload: T`, `diagram: BpmnDiagram` (evaluate); `command: Command` (evaluateCommand); `engine: RuleEngine`. Importa `isEventSubprocess` (types), `isEventDefinitionRemoval` (commands), `eventDefinitionUsages` (eventDefinitions).
**Processamento (intermediário):** `RuleEngine.rules` é `Map<string, Rule[]>`. `register` faz push e devolve unregister (splice). `evaluate` percorre as regras do evento e retorna o primeiro veredito negativo. `registerDefaultRules` registra: regra `command.pre` que veta se `diagram.version.status ∈ LOCKED_STATUSES`; regra `edge.connect.pre` que veta auto-conexão (`sourceId === targetId`); regra `edge.connect.pre` que veta conectar à casca de um event subprocess (Handoff 17, mensagem OMG); regra `edge.connect.pre` de compensação (Handoff 19) que libera `edgeType==='association'`, veta qualquer endpoint com `isForCompensation===true` e veta origem boundary com `eventDefinition==='compensate'`; regra `command.pre` que, se `isEventDefinitionRemoval(command)`, consulta `eventDefinitionUsages` e veta listando `label (nodeId)` dos eventos que ainda referenciam.
**Saídas:** `() => void` (register), `RuleVerdict` (evaluate/evaluateCommand), `void` (registerDefaultRules), nova `RuleEngine` (createDefaultRuleEngine). Mutação do `Map` interno.
**Estruturas de dados que trafegam:** Type `Rule<T>`, interface `ConnectPayload` (`sourceId`, `targetId`, `edgeType?`), classe `RuleEngine` (implementa `CommandInterceptor`). Const interna `LOCKED_STATUSES` (`active`, `deprecated`, `retired`). Funções `registerDefaultRules`, `createDefaultRuleEngine`.

### `packages/core/src/engine/validation.ts`
> Δ 2026-07: `unreachableNodeRule` isenta o event subprocess (Handoff 17 §4a) — ele dispara pelo start, nunca por fluxo de entrada, então é exumado como boundary event (um subProcess COMUM ainda alerta) via `isEventSubprocess`. Contagem de regras built-in inalterada (9); os vetos estruturais de event subprocess/compensação vivem em `engine/rules.ts`, não aqui.
**Papel:** Validação estrutural do diagrama por regras plugáveis, produzindo issues classificados.
**Entradas:** `diagram: BpmnDiagram` (cada regra), `registry: NodeTypeRegistry` (unknownTypeRule), `rules: ValidationRule[]` (construtor). Consome `activeNodes`/`activeEdges`, `nodeParentId`, `boundaryAttachedTo`, `isEventSubprocess`, `laneFlowNodeRefs`, `isContainerType`.
**Processamento (intermediário):** Cada regra monta um array local `issues`. `orphanEdgeRule` checa refs faltantes; `selfConnectionRule` filtra `sourceId===targetId`; `missingStartEventRule` procura startEvent top-level; `unreachableNodeRule` usa `NON_FLOW_TYPES: Set`, isenta start/boundary/containers/event subprocess (`isEventSubprocess`) e testa incoming; `eventFlowDirectionRule` checa end/start com fluxo indevido; `staleLaneRefRule` verifica refs de lane; `boundaryEventHostRule` valida host; `subProcessParentRule` valida parentId e detecta ciclos com `seen: Set` subindo a cadeia; `crossScopeEdgeRule` computa `scopeOf` (via host/parent) e compara escopos, pulando messageFlow/association/dataAssociation. `ValidationEngine.validate` faz `flatMap` das regras e calcula `valid` (sem erros).
**Saídas:** `ValidationIssue[]` (cada regra), `ValidationResult` (`{ valid, issues }`) do engine, `void` (addRule). Sem mutação.
**Estruturas de dados que trafegam:** Type `IssueSeverity` (`error|warning|info`), interfaces `ValidationIssue` (`code`, `severity`, `message`, `nodeId?`, `edgeId?`), `ValidationResult` (`valid`, `issues`), type `ValidationRule`. Códigos de issue: `ORPHAN_EDGE`, `SELF_CONNECTION`, `MISSING_START_EVENT`, `UNREACHABLE_NODE`, `END_EVENT_OUTGOING`, `START_EVENT_INCOMING`, `STALE_LANE_REF`, `BOUNDARY_EVENT_WITHOUT_HOST`, `INVALID_PARENT_REF`, `PARENT_CYCLE`, `CROSS_SCOPE_EDGE`, `UNKNOWN_NODE_TYPE`. Const `NON_FLOW_TYPES` (`textAnnotation`, `dataObject`, `dataStore`, `group`), `BUILT_IN_VALIDATION_RULES` (9 regras). Classe `ValidationEngine`. Funções `unknownTypeRule` + as regras exportadas.

### `packages/core/src/engine/agentTask.ts`
**Papel:** Peças que o core detém para o tipo `agentTask` (Agent Lane): regra de gate por autonomia e resolução de sub-workflow com fallback de snapshot.
**Entradas:** `node: BpmnNode` (lê `properties.autonomyLevel`, `.agentWorkflowRef`, `.agentWorkflowSnapshot`), `diagram: BpmnDiagram`, `startId: string`, `isGate: (node)→boolean` (injetado), `AgentGateRuleOptions` (`requiresGate` injetado de agentflow, `isGate`, `locale? = 'en'`), `resolveFromRegistry: (ref)→unknown|undefined` (injetado).
**Processamento (intermediário):** `agentAutonomyLevelOf` type-guard numérico finito. `agentTasksOf` filtra nós tipo `agentTask`. `reachableGateFrom` monta mapa `outgoing: Map<string,string[]>` de sequenceFlow e faz BFS forward com `seen: Set` e `queue`. `agentGateViolations` itera agentTasks, coleta `violations` para os que exigem gate mas não têm; `remediationFor` gera texto pt/en. `agentAutonomyGateRule` só atua em target=`active`. `resolveAgentWorkflow` tenta registry, senão `JSON.parse` do snapshot (try/catch — snapshot corrompido cai em unresolved).
**Saídas:** `number|undefined`, `BpmnNode[]`, `boolean`, `AgentGateViolation[]`, `PromotionRule`, `AgentWorkflowResolution` (`{source, workflow?, warning?}`). Sem mutação.
**Estruturas de dados que trafegam:** Interfaces `AgentGateRuleOptions`, `AgentGateViolation` (`nodeId`, `autonomyLevel`, `remediation`), `AgentWorkflowResolution` (`source: registry|snapshot|unresolved`). Funções `agentAutonomyLevelOf`, `agentTasksOf`, `reachableGateFrom`, `agentGateViolations`, `agentAutonomyGateRule`, `resolveAgentWorkflow` (interna `remediationFor`).

---

## diff

### `packages/core/src/diff/index.ts`
> Δ 2026-07: comparação de campos via helper `differs` — primitivos com `Object.is` (números via `roundCoord`), só objetos/arrays caem no `canonicalJson`; extensões estrangeiras preservadas viram mudanças NOMEADAS (`foreignChanges`): cada tag (`"zeebe:taskDefinition"`) e cada atributo (`"@zeebe:modelerTemplate"`, convenção `@`) é uma chave própria — nunca um blob opaco; `normalizeForDiff` projeta `foreignExtensions`/`foreignAttributes` e o bag `definitions` quando presentes.
**Papel:** Diff estruturado entre dois estados de diagrama e projeção canônica para verificação de round-trip.
**Entradas:** `before`/`after: BpmnDiagram` (computeDiff), `before`/`after: BpmnEdge` (edgeVersionDiff), `diagram: BpmnDiagram` (normalizeForDiff), `diff: BpmnDiff` (isEmptyDiff). Usa `canonicalJson`/`roundCoord`.
**Processamento (intermediário):** `differs(a,b)` compara `a ?? null` vs `b ?? null` (números por `roundCoord`, demais primitivos por `Object.is`, objetos/arrays por `canonicalJson`). `fieldChanges` acumula `changes: Record<string, FieldChange>` sobre `NODE_FIELDS`/`EDGE_FIELDS`; `foreignChanges` agrupa subtrees estrangeiras por tag (achatando singleton) e compara atributos estrangeiros, emitindo chaves nomeadas. `computeDiff` monta `diff: BpmnDiff`; itera `after.nodes` (add/update mesclando `fieldChanges`+`foreignChanges`), `before.nodes` (remove); para arestas detecta `supersede` via `supersedesEdgeId` (mantém `supersededOldIds: Set`), senão add/update/remove; compara `metadata` unindo chaves. `normalizeForDiff` projeta nós/arestas ordenados por id, coords arredondadas (`roundCoord`), props canonicalizadas (`canonProps` via JSON.parse(canonicalJson)), inclui condicionalmente `foreignExtensions`/`foreignAttributes`/`removedInVersion`/`supersedesEdgeId` e o bag `definitions`, stripando audit/versão.
**Saídas:** `boolean` (isEmptyDiff), `BpmnDiff` (computeDiff, edgeVersionDiff), `NormalizedDiagramContent` (normalizeForDiff). Sem mutação.
**Estruturas de dados que trafegam:** Interfaces `FieldChange` (`from`, `to`), types `NodeDiffOp` (add/remove/update), `EdgeDiffOp` (add/remove/update/supersede), interface `BpmnDiff` (`nodes`, `edges`, `metadata`), `NormalizedDiagramContent` (`nodes`, `edges`, `definitions?`). Consts internas `NODE_FIELDS`, `EDGE_FIELDS`. Funções `isEmptyDiff`, `computeDiff`, `edgeVersionDiff`, `normalizeForDiff` (internas `differs`, `fieldChanges`, `foreignChanges`).

### `packages/core/src/diff/diffDiagrams.ts`
> Δ 2026-07: NOVO (Handoff 15 §2a, V-1) — diff semântico de revisão que classifica o `computeDiff` cru em cinco categorias e ordena por leitura estável do grafo. Consome `computeDiff` sem tocá-lo.
**Papel:** Camada de revisão sobre o diff cru — classifica cada mudança em `added`/`removed`/`moved`/`changed`/`rerouted` e devolve as entradas em ordem determinística (rank topológico do grafo), a lista única que canvas, navegação e a aba "Mudanças" consomem.
**Entradas:** `base`/`target: BpmnDiagram`. Reusa `computeDiff` (index) e `isFlowEdge` (flow).
**Processamento (intermediário):** `classifyNode`/`classifyEdge` decidem a categoria: lifecycle (`removedInVersion` set → `removed`, limpo → `added`) primeiro; nó só com `x`/`y` → `moved`, com posição + outros campos → `changed` + `moved:true`; aresta só com `waypoints` → `rerouted`; supersessão → `changed` com field-change `supersededBy`; `withoutKeys` remove `x`/`y`/`waypoints`/`removedInVersion` do bag `changes` (seu tamanho é o badge ΔN). `flowRanks` faz BFS determinístico sobre sequence flows (fontes sem incoming, vizinhos ordenados, ciclos tolerados, desconectados após o grafo). A ordenação final combina `rankOf` (rank do grafo target, senão base; aresta lê após o endpoint de maior rank +0.5), `posOf` (posição base y depois x) e id.
**Saídas:** `DiffEntry[]` classificado e ordenado. Sem mutação.
**Estruturas de dados que trafegam:** Type `DiffKind` (`added|removed|moved|changed|rerouted`), interface `DiffEntry` (`kind`, `elementKind: node|edge`, `elementId`, `label?`, `changes?`, `from?`/`to?: Point`, `moved?`). Consts internas `NODE_GEOMETRY`, `EDGE_ROUTE`, `LIFECYCLE`. Função `diffDiagrams` (internas `nodePoint`, `withoutKeys`, `flowRanks`, `classifyNode`, `classifyEdge`).

---

## audit

### `packages/core/src/audit/ledger.ts`
**Papel:** Ledger de auditoria append-only com encadeamento SHA-256, mais conexão ao CommandStack e navegação de cadeias de supersessão.
**Entradas:** `AuditEntryInput` (`type`, `userId`, `versionId`, `details?`) no append; `entry` (computeEntryHash); `data.entries` (import); `stack: CommandStack` + `user: UserContext` (connectCommandStack); `filter` (query); `diagram` + `edgeId` (getEdgeChain); `AuditSink` opcional.
**Processamento (intermediário):** `computeEntryHash` despacha pela versão da receita: v2 (`entry.hashVersion === 2`, o padrão para entradas novas) = SHA-256 de `canonicalJsonExact` do objeto inteiro (sem arredondamento e sem ambiguidade de delimitador); v1 legado (campo ausente) junta `previousHash|id|seq|type|timestamp|userId|versionId|canonicalJson(details)` — cadeias antigas seguem verificando. `AuditLedger` mantém `entries: AuditEntry[]` e uma `queue: Promise` que serializa appends; cada append lê o `previous`, monta `base` (seq = length, previousHash encadeado), calcula `hash`, empurra e escreve no `sink`. `verify` recomputa a cadeia rastreando `previousHash`. `query` filtra por type/nodeId/edgeId (checando `details.edgeId/oldEdgeId/newEdgeId`). `connectCommandStack` inscreve `record` em `command.post/undone/redone` (prioridade -100), montando o tipo com sufixo. `getEdgeChain` caminha para trás por `supersedesEdgeId` (com `visited: Set`) e para frente via `byPredecessor: Map`.
**Saídas:** `Promise<AuditEntry>` (append), `Promise<LedgerVerification>` (verify), `readonly AuditEntry[]` (getEntries), `AuditEntry[]` (query), `{entries}` (export), `Promise<AuditLedger>` (import — lança `BpmnAuditError` se inválido), `() => void` (connectCommandStack), `Promise<void>` (flush), `BpmnEdge[]` (getEdgeChain). Efeito: escrita opcional no `AuditSink`.
**Estruturas de dados que trafegam:** Interfaces `AuditEntry` (`id`, `seq`, `type`, `timestamp`, `userId`, `versionId`, `details`, `previousHash`, `hash`, `hashVersion?: 2`), `AuditEntryInput`, `LedgerVerification` (`valid`, `brokenAt?`), `AuditSink` (`write`), classe `AuditLedger`. Funções `computeEntryHash`, `getEdgeChain` (alias interno `entryHash`).

---

## geometry

### `packages/core/src/geometry/index.ts`
**Papel:** Primitivas geométricas puras: âncoras, conexões (reta/Bézier/ortogonal), waypoints, bounding box, snap.
**Entradas:** `value/min/max: number`, `a`/`b`/`point/towards: Point`, `rect/source/target: Rect`, `points: Point[]`, `cornerRadius`, `portOffset`, `gridSize`, `rects: Rect[]`, options `{cornerRadius?, portOffset?}`. Usa `roundCoord`.
**Processamento (intermediário):** `clamp`, `distance` (hypot), `rectCenter`. `getAnchorSide` compara deltas normalizados por width/height. `getAnchorPoint`/`sideNormal` mapeiam lado→ponto/normal. `straightConnection`/`cubicBezierConnection` computam start/end/pontos de controle (`c1`,`c2`) e midpoint (`cubicBezierPoint`). `collapseWaypoints` remove pontos duplicados/colineares (laço com `result` e splice). `routeOrthogonal` empurra âncoras pelo `portOffset` clampeado, calcula `bends` (L/Z via midX/midY) e colapsa. `waypointsToPath` gera path SVG com cantos arredondados (Q) clampando raio (`round2`, cross product para colinearidade). `getBoundingBox` acumula min/max. `rectContains`/`rectsIntersect`/`snapToGrid`.
**Saídas:** `number`, `Point`, `Side`, `{point, side}`, `EdgeGeometry` (`path`, `start`, `end`, `midpoint`), `Point[]`, `string` (path), `Rect`, `boolean`. Sem mutação de entrada.
**Estruturas de dados que trafegam:** Type `Side` (`left|right|top|bottom`), interface `EdgeGeometry`. Const `DEFAULT_PORT_OFFSET` (16). Funções `clamp`, `distance`, `rectCenter`, `getAnchorSide`, `getAnchorPoint`, `straightConnection`, `cubicBezierConnection`, `cubicBezierPoint`, `collapseWaypoints`, `routeOrthogonal`, `waypointsToPath`, `orthogonalConnection`, `getBoundingBox`, `rectContains`, `rectsIntersect`, `snapToGrid` (internas `sideNormal`, `round2`).

### `packages/core/src/geometry/astar.ts`
**Papel:** Roteador headless de arestas com desvio de obstáculos — grade de visibilidade (Hanan) + A\* com custo composto, determinístico.
**Entradas:** `source`/`target: Rect`, `AStarRouteOptions` (`obstacles?`, `routedEdges?`, `clearance? = 12`, `portOffset?`, `preferredSourceSide?`, `preferredTargetSide?`, `hysteresis?`, `sourcePort?`).
**Processamento (intermediário):** Muitos dados transitórios: `inflated` (obstáculos inflados por clearance), `sourcePorts`/`targetPorts`/`usableSource`/`usableTarget` (portas candidatas por lado), `span` (bbox+margem), `xs`/`ys: Set<number>` de linhas Hanan → `xLines`/`yLines` ordenadas. `buildGrid` constrói `blocked: Uint8Array`, `adjacency: Map<number, Neighbour[]>` (custo `distance + CROSS_WEIGHT*crossCount`), com helpers `blockedAt`/`segmentFree`/`crossCount`/`insideInterior`/`segmentHitsRect`/`segmentsCross`. A busca A\* usa `gScore`/`cameFrom: Map`, heurística Manhattan `h`, estados `(key,dir)`, turn cost `BEND_WEIGHT`, e um `MinHeap` binário (ordenado por f,g,state). Coleta `candidates` de todos os pares de portas, ordena por custo/lado, aplica histerese de porta. `selfLoop` para laços; `directRoute` fallback. `reconstruct` reconstrói waypoints e colapsa.
**Saídas:** `AStarRoute` (`waypoints: Point[]`, `routed: boolean`, `sourceSide?`, `targetSide?`). Sem mutação de entrada (nunca reroteia globalmente).
**Estruturas de dados que trafegam:** Interfaces `AStarRouteOptions`, `AStarRoute`, internas `Grid`, `Neighbour` (`to`, `dir`, `base`), `HeapNode` (`f`,`g`,`key`,`dir`,`state`), classe `MinHeap`. Consts `DEFAULT_CLEARANCE` (12), `BEND_WEIGHT` (2), `CROSS_WEIGHT` (4), `SELF_LOOP_OFFSET` (24), `SIDES`. Função exportada `routeAStar` (internas `inflate`, `insideInterior`, `segmentHitsRect`, `segmentsCross`, `port`, `selfLoop`, `directRoute`, `getSpan`, `buildGrid`, `reconstruct`, `round2`).

### `packages/core/src/geometry/boundary.ts`
**Papel:** Ancoragem paramétrica (side + t) de boundary events na borda do host, com derivação a partir da geometria DI.
**Entradas:** `host: BoundaryRect`, `side: BoundarySide`, `t: number`, `point: Point`, `node` (Pick de x/y/width/height/properties, lê `boundarySide`/`boundaryT`), `size: {width, height}`.
**Processamento (intermediário):** `clamp01`. `boundaryPositionOf` calcula o ponto na borda por lado × t. `nearestBoundaryAnchor` itera os quatro lados computando `t` e `distance` (hypot), mantendo `best`. `boundaryAnchorOf` prefere o par armazenado em properties, senão deriva do centro do nó. `boundaryNodePosition` centraliza o nó na âncora.
**Saídas:** `Point` (boundaryPositionOf, boundaryNodePosition), `BoundaryAnchor` (`side`, `t`, `point`, `distance`), `{side, t}` (boundaryAnchorOf). Sem mutação.
**Estruturas de dados que trafegam:** Type `BoundarySide` (`top|right|bottom|left`), interfaces `BoundaryRect`, `BoundaryAnchor`. Const `BOUNDARY_SNAP_THRESHOLD` (12). Funções `boundaryPositionOf`, `nearestBoundaryAnchor`, `boundaryAnchorOf`, `boundaryNodePosition` (interna `clamp01`).

### `packages/core/src/geometry/layout.ts`
> Δ 2026-07: NOVO — auto-layout em camadas (Sugiyama, sem dependências) mais alinhamento/distribuição de nós; determinístico por desempate estável de id.
**Papel:** Passe de layout automático em camadas (ranking por caminho mais longo, ordenação por baricentro, colocação de linhas pela média dos predecessores) e helpers de alinhar/distribuir seleções.
**Entradas:** `diagram: BpmnDiagram`, `LayoutOptions` (`gapX? = 72`, `gapY? = 40`, `origin? = {60,60}`); `nodes: BpmnNode[]` + `mode: AlignMode`/`axis` (align/distribute). Usa `activeNodes`/`activeEdges`, `boundaryAttachedTo`, `isContainerType`, `nodeParentId` (types), `isFlowEdge`/`isFlowNode` (flow).
**Processamento (intermediário):** `computeLayeredLayout` retorna `null` fora do escopo v1 (diagrama com pools/lanes) ou vazio; escopo = flow nodes top-level sem boundary. 1) Ranking: DFS de caminho mais longo com `visitState` (guarda back edges). 2) Ordenação: agrupa por rank em `layers: Map`, duas varreduras de baricentro sobre predecessores (`layerIndex`), desempate por id. 3) Coordenadas: por camada, coluna = nó mais largo, `centerY` média dos predecessores, resolve sobreposição para baixo, `round` para múltiplos de 10. 4) Seguidores: filhos de subprocesso e boundary events herdam o deslocamento exato do ancestral reposicionado (nunca re-arredondado — a âncora paramétrica sobrevive). `alignPositions` calcula âncora min/max/center por eixo; `distributePositions` ordena e espaça uniformemente (gap = (span − total)/(n−1)).
**Saídas:** `Map<string, Point> | null` (computeLayeredLayout), `Map<string, Point>` (align/distribute — só nós que realmente movem). Sem mutação.
**Estruturas de dados que trafegam:** Interface `LayoutOptions`, type `AlignMode` (`left|centerX|right|top|centerY|bottom`). Funções `computeLayeredLayout`, `alignPositions`, `distributePositions` (interna `round`).

---

## xml

### `packages/core/src/xml/MiniXmlParser.ts`
> Δ 2026-07: `decodeEntities` recebe a linha como thunk lazy (`() => line`) — o rastreio O(pos) da linha só roda no caminho de erro; antes rodava por atributo/chunk de texto, tornando o parse O(n²) em documentos grandes.
**Papel:** Parser XML minimalista, sem dependências, seguro contra XXE (rejeita DOCTYPE), para o subset BPMN.
**Entradas:** `xml: string` (parse); `root: XmlElement`/`name: string` (helpers de busca); `tag: string` (localName).
**Processamento (intermediário):** Estado interno `source`/`pos`. `parse` chama `skipProlog`, `parseElement`, `skipMisc`, valida fim. Métodos privados transitórios: `line()` conta `\n`, `skipWhitespace`/`skipMisc` (comentários, PIs, rejeita DOCTYPE), `parseName` (regex NAME_START/NAME_CHAR), `parseAttributes` (aspas simples/duplas → `attributes` record, decodifica entidades), `parseElement` (recursivo, acumula `children` e `text`, trata CDATA/comentário/PI/fecho, valida tag de fechamento). `decodeEntities` resolve as 5 entidades predefinidas + refs numéricas (dec/hex). Helpers `findByLocalName` (DFS acumulando `found`), `childrenByLocalName`, `firstChildByLocalName`.
**Saídas:** `XmlElement` (árvore parseada), `string` (localName), `XmlElement[]`/`XmlElement|undefined` (buscas). Lança `BpmnParseError` (com linha) em erros de sintaxe/DOCTYPE/entidade.
**Estruturas de dados que trafegam:** Interface `XmlElement` (`tag`, `attributes: Record<string,string>`, `children: XmlElement[]`, `text: string`), classe `MiniXmlParser`. Consts internas `NAME_START`, `NAME_CHAR`. Funções `localName`, `findByLocalName`, `childrenByLocalName`, `firstChildByLocalName` (interna `decodeEntities`).

### `packages/core/src/xml/XmlBuilder.ts`
> Δ 2026-07: `escapeXmlAttribute` também escapa TAB (`&#9;`) e CR (`&#13;`) — round-trip exato de labels; invariantes internas lançam `BpmnError` (code `XML`) em vez de `Error` genérico.
**Papel:** Escritor incremental de XML com escaping automático e indentação.
**Entradas:** `value: string` (escape helpers), options `{indent? = '  ', declaration?}`, `tag: string`, `attributes: XmlAttributes`, `text?: string`.
**Processamento (intermediário):** `stripInvalidXmlChars` remove chars de controle inválidos; `escapeXmlText`/`escapeXmlAttribute` substituem `& < > " \n`. `XmlBuilder` mantém `parts: string[]` (fragmentos), `stack: string[]` (tags abertas), `indent`. `pad()` repete indent por profundidade. `renderAttributes` filtra `undefined` e serializa. `open` empurra tag e stack; `element` escreve self-closing ou com texto; `close` faz pop e valida; `toString` junta com `\n` (lança se stack não vazia).
**Saídas:** `string` (escapes, toString), `this` (open/element/close, encadeável). Lança `Error` em close/toString desbalanceados. Mutação do estado interno.
**Estruturas de dados que trafegam:** Type `XmlAttributes` (`Record<string, string|number|boolean|undefined>`), classe `XmlBuilder`. Funções `escapeXmlText`, `escapeXmlAttribute` (interna `stripInvalidXmlChars`).

### `packages/core/src/xml/adapter.ts`
**Papel:** Costura agnóstica de ambiente para parsing XML (parser embutido vs. DOMParser nativo).
**Entradas:** `xml: string` (parse); leitura externa `globalThis.DOMParser`.
**Processamento (intermediário):** `MiniXmlAdapter` delega a `MiniXmlParser`. `DomXmlAdapter` checa disponibilidade de DOMParser, rejeita DOCTYPE (regex), parseia, checa `parsererror`/`documentElement`. `convertDomElement` (recursivo) copia atributos, filhos (nodeType 1) e texto (nodeType 3/4) para `XmlElement`.
**Saídas:** `XmlElement` (parse), `XmlParserAdapter` (getDefaultXmlAdapter → MiniXmlAdapter). Lança `BpmnParseError`.
**Estruturas de dados que trafegam:** Interface `XmlParserAdapter` (`parse(xml)→XmlElement`), classes `MiniXmlAdapter`, `DomXmlAdapter`. Função `getDefaultXmlAdapter` (interna `convertDomElement`).

---

## persistence

### `packages/core/src/persistence/hash.ts`
**Papel:** SHA-256 via Web Crypto e JSON canônico determinístico (base de hashing/diffing). Duas canonizações: `canonicalJson` (arredonda números a 2 casas — para geometria/snapshot/diff) e `canonicalJsonExact` (números exatos — para fronteiras de integridade: ledger v2, assinaturas, atestações).
**Entradas:** `text: string` (sha256Hex), `value: unknown` (canonicalJson/canonicalJsonExact), `value: number` (roundCoord). Leitura externa `globalThis.crypto.subtle`, `TextEncoder`.
**Processamento (intermediário):** `sha256Hex` codifica texto → digest → hex. `sortValue(value, round)` (recursivo) arredonda números somente quando `round=true`, mapeia arrays, ordena chaves de objeto e filtra `undefined`, montando `result` transitório. `roundCoord` arredonda para 2 casas.
**Saídas:** `Promise<string>` (hash hex), `string` (JSON canônico exato ou arredondado), `number` (roundCoord). Sem mutação.
**Estruturas de dados que trafegam:** Funções `sha256Hex`, `canonicalJson`, `canonicalJsonExact`, `roundCoord` (interna `sortValue`).

### `packages/core/src/persistence/serializer.ts`
**Papel:** Costura de serialização plugável; implementação JSON com validação de campos obrigatórios.
**Entradas:** `diagram: BpmnDiagram` (serialize), `data: string` (deserialize).
**Processamento (intermediário):** `JsonSerializer.serialize` faz `JSON.stringify(diagram, null, 2)`. `deserialize` faz `JSON.parse` (try/catch → `BpmnParseError`), valida objeto e campos obrigatórios (`id`, `name`, `version`, `nodes`, `edges`) **e a forma estrutural**: `nodes`/`edges` são records de objetos com `id`/`type` string (arestas também `sourceId`/`targetId`), `version` é objeto com `id` string — erros citam o caminho (`nodes.<id>.type`); aplica defaults `description: ''`, `metadata: {}`.
**Saídas:** `string` (serialize), `BpmnDiagram` (deserialize). Lança `BpmnParseError`.
**Estruturas de dados que trafegam:** Interface `Serializer<T>` (`serialize`, `deserialize`), classe `JsonSerializer`.

### `packages/core/src/persistence/snapshot.ts`
**Papel:** Captura de snapshot imutável do diagrama com hash de conteúdo e verificação de drift.
**Entradas:** `diagram: BpmnDiagram`, `createdBy = 'anonymous'` (createSnapshot); `snapshot: Snapshot` (verifySnapshot). Usa `computeDiagramHash`, `nowIso`, `structuredClone`.
**Processamento (intermediário):** `createSnapshot` clona o diagrama (`structuredClone`), calcula hash, timestamp. `verifySnapshot` recomputa `computeDiagramHash` e compara com `snapshot.hash`.
**Saídas:** `Promise<Snapshot>` (`diagram`, `hash`, `createdAt`, `createdBy`), `Promise<boolean>` (verifySnapshot). Sem mutação (clona a entrada).
**Estruturas de dados que trafegam:** Interface `Snapshot`. Funções `createSnapshot`, `verifySnapshot`.

### `packages/core/src/persistence/BpmnXmlConverter.ts`
> Δ 2026-07: import de documento com múltiplos `<process>` emite warning explícito em `ImportResult.warnings` (só o primeiro é importado — perfil v1 single-process); antes os demais eram descartados em silêncio.
> Δ 2026-07: definições de evento nomeadas fazem round-trip como root elements OMG (`bpmn:message`/`signal`/`error`/`escalation`, escalation após error com `escalationCode` omitido quando ausente — Handoff 16/18); um `*Ref` sem root correspondente é SINTETIZADO como definição (id=name=ref) com warning nomeando o evento (nunca silêncio/perda). Passthrough: `foreignNamespaces` (xmlns estrangeiros) re-declarados em ordem de prefixo e `processForeignExtensions` do `<process>` capturados no import.
**Papel:** Orquestrador bidirecional entre o modelo bpmn-react e BPMN 2.0 XML (export/import), delegando a colaboradores focados.
**Entradas:** `XmlConverterOptions` (`registry?`, `adapter?`, `preferredTypes? = []`, `extensionNamespace?`); `diagram: BpmnDiagram` (toXml); `xmlText: string` (fromXml).
**Processamento (intermediário):** No construtor instancia `ElementSerializer`, `ElementDeserializer` (recebe `preferredTypes`), `DIHandler`, `ExtensionHandler`. `toXml`: separa `nodes` em `pools`/`lanes`/`flowNodes` (top-level, não-container); `edges` em `messageFlows`/`scopedEdges`/`dataAssocsByActivity`; agrupa `edgesByScope: Map<scope, BpmnEdge[]>` (via `edgeScopeOf`), extrai `processEdges`; calcula `processId` (`xmlSafeId`) e `collaborationId`; abre `bpmn:definitions` (namespaces próprios + `foreignNamespaces` ordenados), emite os root elements de `diagram.definitions` (messages/signals/errors/escalations), escreve collaboration (participants + messageFlows), process (diagram extension, laneSet com flowNodeRefs filtrados, flowNodes recursivos, processEdges), e chama `di.writeDi`. `fromXml`: chama `deserializer.beginImport()`, parseia root (valida `<definitions>`/`<process>`, warning se >1 process), lê extension (`diagramMeta`/`versionMeta`) e `foreignNamespaces` (prefixos fora dos 5 próprios), monta `diagram` esqueleto (incl. `processForeignExtensions`), lê os root elements em `diagram.definitions` (via `readDefinitions` com `codeAttr` por tipo), lê collaboration (pools + messageFlows), `readFlowElements`, valida refs de aresta (warnings), aplica DI, re-deriva âncora paramétrica de boundary events (`boundaryAnchorOf`, mutando `node.properties`), e sintetiza definições para `eventDefinitionRef` órfãos (warning por evento).
**Saídas:** `string` (XML, toXml), `ImportResult` (`diagram`, `warnings`) (fromXml). Lança `BpmnParseError`.
**Estruturas de dados que trafegam:** Consts `BPMN_NS`, `BPMNDI_NS`, `DC_NS`, `DI_NS`, `DEFAULT_EXTENSION_NS` (prefix `bpmnr`, uri `http://bpmn-react.io/schema/1.0`). Interfaces `XmlConverterOptions`, `ImportResult`. Classe `BpmnXmlConverter` (interna `xmlSafeId`).

### `packages/core/src/persistence/elementSerializer.ts`
> Δ 2026-07: `writeNode` emite mais fatos como XML nativo OMG (não `bpmnr:property`) — a ref de definição nomeada vira `messageRef`/`signalRef`/`errorRef`/`escalationRef` no `{kind}EventDefinition` (Handoff 16/18); timer emite `bpmn:timeDate`/`timeDuration`/`timeCycle` só em evento timer (`timerPropertyOf`, reforço 10); compensação (Handoff 19) escreve `isForCompensation="true"` no handler e `activityRef`/`waitForCompletion="false"` no `compensateEventDefinition` só em throw; event subprocess/start (Handoff 17) escrevem `triggeredByEvent="true"`/`isInterrupting="false"` (defaults OMG omitidos), keyed pela TAG. Passthrough: `foreignAttributes` re-emitidos após os atributos padrão e `foreignExtensions`/`processForeignExtensions` re-escritos verbatim (`ext.writeSubtree`) num único `extensionElements`. Cada campo emitido nativamente entra em `reserved` para não duplicar na property soup.
**Papel:** Serialização do modelo semântico (nós, arestas, data associations, extensão do diagrama) para XML BPMN.
**Entradas:** `registry: NodeTypeRegistry`, `ext: ExtensionHandler` (construtor); `xml: XmlBuilder`, `diagram`, `node: BpmnNode`, `edge: BpmnEdge`, `edgesByScope`, `dataAssocsByActivity`, `activityId`, `tag`. Usa `timerPropertyOf` (iso8601).
**Processamento (intermediário):** `writeDiagramExtension` emite `bpmnr:diagram`/`bpmnr:version`/properties do metadata e, ao final, os `processForeignExtensions` verbatim. `edgeScopeOf` resolve o escopo (parentId do host/source). `writeNode` computa muitos transitórios: `tag` (do registry ou `task`), `eventDef`, `marker`, flags `isBoundary`/`attachedToRef`/`nonInterrupting`/`calledElement`/`dataStoreRef`/`dataObjectRef`/`isForCompensation`/`isSubProcess`, `refAttrName`/`eventRef` (ref de definição), `compensateActivityRef`/`waitForCompletionFalse` (só throw), `timer` (só timer event), `triggeredByEvent`/`isInterrupting` (por tag), `nestedNodes`/`nestedEdges`, `dataAssocs`, `agentSnapshot`, `reserved: Set` (chaves não-emitidas como property), `propEntries` filtradas, `attrs` (+`foreignAttributes`), flags `hasChildren`/`needsMeta`; escreve elemento (self-closing ou com meta-block + foreign subtrees, eventDefinition com refs/activityRef e possível filho timer, loopCharacteristics, data associations, filhos recursivos, arestas aninhadas). `groupDataAssociations` monta `byActivity: Map` decidindo input/output por `isDataNode`. `writeDataAssociation` escolhe tag input/output e escreve sourceRef/targetRef. `writeEdge` computa `needsMeta` e emite meta-block com type/purpose/versões (+`foreignAttributes`/`foreignExtensions`).
**Saídas:** `void` (escreve no `XmlBuilder`), `Map<string, BpmnEdge[]>` (groupDataAssociations), `string|undefined` (edgeScopeOf). Efeito: mutação do XmlBuilder.
**Estruturas de dados que trafegam:** Classe `ElementSerializer`. Consome `bpmnr:meta`/`bpmnr:property`, `bpmn:dataInputAssociation`/`dataOutputAssociation`, `standardLoopCharacteristics`/`multiInstanceLoopCharacteristics`, `{kind}EventDefinition` (+`messageRef`/`signalRef`/`errorRef`/`escalationRef`/`activityRef`/`waitForCompletion`), `bpmn:timeDate`/`timeDuration`/`timeCycle`, atributos nativos `isForCompensation`/`triggeredByEvent`/`isInterrupting`, e subtrees estrangeiras verbatim.

### `packages/core/src/persistence/elementDeserializer.ts`
> Δ 2026-07: `VERSION_STATUSES` inclui `in-review`; `readEventDefinition` lê a ref nomeada (`messageRef`/`signalRef`/`errorRef`/`escalationRef` → `properties.eventDefinitionRef`), o timer canônico (`timeDate`/`timeDuration`/`timeCycle` → `properties.timer`) e a compensação do throw (`activityRef`/`waitForCompletion` — Handoff 19); `readNode` lê `isForCompensation="true"` (atributo não-prefixado que seria descartado), `triggeredByEvent`/`isInterrupting` por TAG (Handoff 17) e o passthrough estrangeiro (`withForeignAttributes` + `foreign` de `readExtensionElements`). Handoff 21: as duas degradações silenciosas de tipo agora ALERTAM — `meta.type` não-registrado (por elemento) e entrada de `preferredTypes` não-registrada (uma vez por tipo, dedup via `warnedUnregisteredPreferred`, resetado por `beginImport`). `complexGateway` NÃO é mais descartado (agora é tipo built-in registrado, resolve por `typeForXmlTag`).
**Papel:** Desserialização de flow elements BPMN XML no modelo semântico (nós, arestas, data associations, containers, linhagem de versão).
**Entradas:** `registry`, `preferredTypes: string[]`, `ext` (construtor); `containerEl`/`activityEl`/`el: XmlElement`, `parentId`, `diagram`, `warnings: string[]`, `versionMeta`, `defaultType`, `type: 'pool'|'lane'`. Usa type `TimerProperty` (iso8601).
**Processamento (intermediário):** `beginImport` limpa `warnedUnregisteredPreferred: Set`. `readFlowElements` (recursivo p/ subProcess) itera filhos: pula `extensionElements`, tags estruturais (`STRUCTURAL_CHILD_TAGS: Set`) e `*EventDefinition`; trata `laneSet` (warning se aninhado), `sequenceFlow`/`association` (readEdge), senão `readNode` (carimba `parentId`, lê data associations, recursa em subProcess). `readDataAssociations` lê input/output (`read` closure), monta `BpmnEdge` tipo `dataAssociation` com sourceId/targetId conforme direção. `readVersion` valida status contra `VERSION_STATUSES`, monta `BpmnVersion` (ou createVersion default). `readNode` lê extension (`properties`/`meta`/`elements`/`foreign`), recupera `agentWorkflowSnapshot`, resolve `type` (meta.type registrado, senão `typeForXmlTag(tag, preferredTypes)` — emitindo os warnings de degradação silenciosa) e retorna `undefined` (warning) se irresolúvel, lê eventDefinition (kind + ref + timer + compensate), `isForCompensation`, atributos nativos (attachedToRef/cancelActivity/triggeredByEvent/isInterrupting/calledElement/dataStoreRef/dataObjectRef), marker, e o passthrough (`foreignExtensions`/`foreignAttributes`), monta `BpmnNode` (x/y=0, size do def). `readContainer` monta pool/lane (lane lê `flowNodeRefs`). `readEdge` valida source/target refs, monta `BpmnEdge` (com passthrough). `readEventDefinition` (regex `(.+)EventDefinition` + valida contra `EVENT_DEFINITION_KINDS`, lê refs/timer/compensate)/`readActivityMarker` (tags).
**Saídas:** `void` (readFlowElements/readDataAssociations — mutam `diagram.nodes`/`.edges`), `BpmnVersion` (readVersion), `BpmnNode|undefined` (readNode/readContainer), `BpmnEdge|undefined` (readEdge). Efeito: preenche `diagram` e `warnings`.
**Estruturas de dados que trafegam:** Classe `ElementDeserializer`. Const interna `VERSION_STATUSES` (7, incl. `in-review`), `STRUCTURAL_CHILD_TAGS`. Produz nós/arestas com `audit` `{createdBy:'import'}`, `createdInVersion` default `'0'`, e `foreignExtensions`/`foreignAttributes` quando presentes. Funções internas `readEventDefinition`, `readActivityMarker`, `withForeignAttributes`.

### `packages/core/src/persistence/diHandler.ts`
**Papel:** Leitura/escrita da camada BPMN DI (BPMNDiagram/BPMNShape/BPMNEdge, dc:Bounds, di:waypoint).
**Entradas:** `xml: XmlBuilder`, `diagram: BpmnDiagram`, `planeElement: string` (writeDi); `root: XmlElement`, `diagram`, `warnings` (applyDi). Usa `routeOrthogonal`, `activeNodes`, `isContainerType`.
**Processamento (intermediário):** `writeDi` abre plane, escreve um `BPMNShape` (com `isHorizontal` para containers, `isExpanded` para subProcess) + `dc:Bounds` por nó, e um `BPMNEdge` com waypoints por aresta (`edgeWaypoints`: usa `edge.waypoints` ou `routeOrthogonal`). `applyDi` acha `BPMNShape`s, converte bounds `Number(...)` (warning se NaN), aplica x/y/width/height (+ isExpanded), acha `BPMNEdge`s e coleta `waypoints: Point[]`; se sem DI, espalha nós numa grade (index%4 × floor/4) e emite warning.
**Saídas:** `void`. Efeito: escreve no XmlBuilder / muta `diagram.nodes`/`.edges` e `warnings`.
**Estruturas de dados que trafegam:** Classe `DIHandler` (interna `edgeWaypoints`).

### `packages/core/src/persistence/extensionHandler.ts`
> Δ 2026-07: passthrough de extensões estrangeiras — `readExtensionElements` distingue filhos NOSSOS (prefixo configurado ou sem prefixo, tolerância legada) de ESTRANGEIROS (`zeebe:`/`camunda:`…), agora preservados verbatim em `foreign: XmlSubtree[]` (via `toSubtree`) em vez de misreados/descartados; `writeSubtree` re-emite um subtree preservado exatamente como armazenado (recursivo). Encoding próprio (`bpmnr:meta`/`bpmnr:property`) permanece byte-idêntico.
**Papel:** Codificação/decodificação do payload `<bpmn:extensionElements>` (`bpmnr:meta` + `bpmnr:property` JSON) e preservação de extensões estrangeiras — fonte única do encoding de extensão.
**Entradas:** `ns: ExtensionNamespace` (construtor); `xml: XmlBuilder`, `attrs`, `name`/`value`, `entries`, `metaAttrs`, `properties`, `inner: () => void`, `subtree: XmlSubtree` (writers); `el: XmlElement` (readExtensionElements).
**Processamento (intermediário):** Getters `prefix`/`uri`. `writeExtensionElements` abre/fecha o container em torno de `inner`. `writeMeta` emite `bpmnr:meta`; `writeProperty` emite `bpmnr:property` com `value: JSON.stringify(value)`; `writeProperties` itera entries; `writeMetaBlock` combina meta+properties; `writeSubtree` escreve o subtree estrangeiro (self-closing ou recursivo). `readExtensionElements` acha o container, itera filhos classificando por prefixo: `property` nosso → `JSON.parse` (fallback raw) para `properties`; `meta` nosso → spread de atributos em `meta`; prefixo estrangeiro → `foreign.push(toSubtree(child))`; retorna `properties`/`meta`/`elements` (lista crua)/`foreign`.
**Saídas:** `void` (writers, mutam XmlBuilder), `{properties, meta, elements, foreign}` (readExtensionElements), `string` (getters). 
**Estruturas de dados que trafegam:** Interface `ExtensionNamespace` (`prefix`, `uri`), classe `ExtensionHandler` (interna `toSubtree`). Produz/consome `XmlSubtree`.

---

## entrypoint

### `packages/core/src/index.ts`
**Papel:** Barrel de exportação pública do pacote `@buildtovalue/core`.
**Entradas:** N/A.
**Processamento (intermediário):** Nenhum — apenas `export *` re-exportando model, events, geometry, commands, engine, diff, audit, xml, persistence.
**Saídas:** Superfície pública do pacote (todos os símbolos dos módulos acima).
**Estruturas de dados que trafegam:** Todas as interfaces/types/classes/funções/consts dos subsistemas listados.

---

## Testes (fixtures exercitadas — resumo)

- `tests/model.test.ts` — cria `NodeTypeRegistry`/registry default e nós/arestas via factory; exercita helpers de tipos.
- `tests/eventBus.test.ts` — handlers com prioridade, cancelamento (`false`) e transformação de payload no `EventBus`.
- `tests/commandStack.test.ts` — comandos add/move/remove e undo/redo/limite sobre um `CommandStack` com bus e interceptor.
- `tests/rules.test.ts` — `RuleEngine`/regras default vetando comandos em status travado e auto-conexão.
- `tests/validation.test.ts` — diagramas com arestas órfãs, sem start event, ciclos de subprocesso etc. contra `ValidationEngine`.
- `tests/lifecycle.test.ts` — `bumpSemver`, gates de promoção (aprovações/change-summary/diff) e `createDraftFrom`.
- `tests/agentTask.test.ts` — round-trip do `agentTask` (autonomyLevel, snapshot) e regra de gate.
- `tests/diff.test.ts` — `computeDiff` sobre add/update/remove/supersede e `normalizeForDiff`.
- `tests/ledger.test.ts` — `AuditLedger` append/verify/import e detecção de adulteração da cadeia; `getEdgeChain`.
- `tests/geometry.test.ts` — âncoras, conexões e `waypointsToPath`/`routeOrthogonal`.
- `tests/astar.test.ts` — `routeAStar` com obstáculos, self-loop e determinismo.
- `tests/boundary.test.ts` — âncora paramétrica de boundary events (`nearestBoundaryAnchor`, `boundaryAnchorOf`).
- `tests/xml.test.ts` — `MiniXmlParser` (entidades, CDATA, rejeição de DOCTYPE) e `XmlBuilder`.
- `tests/converter.test.ts` — `BpmnXmlConverter.toXml`/`fromXml` round-trip de nós, arestas, pools/lanes, subprocessos.
- `tests/persistence.test.ts` — `JsonSerializer`, `hash`/`canonicalJson`, `snapshot`.
- `tests/apiSurface.test.ts` — verifica os símbolos exportados pela superfície pública (`index.ts`).

---

## Síntese de dados da camada

Entidades de dados canônicas que entram/saem do core:

- **BpmnDiagram** — agregado raiz (`id`, `name`, `description`, `version`, `nodes: Record<id,BpmnNode>`, `edges: Record<id,BpmnEdge>`, `metadata`, `definitions?`, `processForeignExtensions?`, `foreignNamespaces?`). É a entrada/saída de comandos, validação, diff, snapshot e conversão XML.
- **BpmnNode** — elemento de fluxo/container (`type`, `label`, geometria x/y/width/height, `properties`, `foreignExtensions?`/`foreignAttributes?`, linhagem `createdInVersion`/`removedInVersion`, `audit`).
- **BpmnEdge** — conexão (`type`, `sourceId`/`targetId`, `label?`, `purpose?`, `waypoints?`, `properties`, `foreignExtensions?`/`foreignAttributes?`, `supersedesEdgeId?`, linhagem, `audit`).
- **EventDefinitions** — definições de evento nomeadas de primeira classe (buckets `messages`/`signals`/`errors`/`escalations`), root elements OMG referenciados por eventos via `properties.eventDefinitionRef`; CRUD undoable e vetos de exclusão.
- **BpmnVersion** — versão imutável (`semanticVersion`, `status: VersionStatus`, `approvedBy: ApprovalRecord[]`, `changeSummary`(+`Origin`), `snapshotHash`, `parentVersionId?`).
- **Command** — transformação reversível (`execute`/`undo`/`toAuditEvent`), unidade do histórico do `CommandStack`.
- **AuditEntry** — entrada do ledger encadeado por hash (`seq`, `type`, `details`, `previousHash`, `hash`).
- **BpmnDiff** — mudança estruturada entre estados (`nodes: NodeDiffOp[]`, `edges: EdgeDiffOp[]`, `metadata`).
- **ValidationResult / ValidationIssue** — veredito estrutural (`valid` + issues com código/severidade).
- **PromotionGate / RuleVerdict** — governança: requisitos de promoção e vetos de regras.
- **XmlElement** — árvore XML intermediária (parse → modelo, modelo → build).
- **Snapshot** — cópia imutável do diagrama com hash de conteúdo (`diagram`, `hash`, `createdAt`, `createdBy`).
- **NodeTypeDefinition** (via **NodeTypeRegistry**) — metadados de tipo (categoria, tamanho default, mapeamento de tag XML) que atravessam factory, validação e conversão.

Tabelas de dados/constantes de referência: `BUILT_IN_NODE_TYPES` (27 tipos), `BUILT_IN_EDGE_TYPES`, `EVENT_DEFINITION_KINDS` (9, incl. `compensate`), `EVENT_DEFINITION_REF_KINDS`/`EVENT_DEFINITION_BUCKETS`, `ACTIVITY_MARKERS`, `EVENT_NODE_TYPES`, `CONTAINER_NODE_TYPES`, `DEFAULT_TRANSITIONS`, `BUILT_IN_VALIDATION_RULES` (9), `DEFAULT_PORT_OFFSET`/`DEFAULT_CLEARANCE`/`BEND_WEIGHT`/`CROSS_WEIGHT`, `DEFAULT_EXTENSION_NS`.
