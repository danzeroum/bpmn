# adapters-bpmn/src

## Classes

### AdapterError

An adapter lookup or mapping failed (unknown artifact, bad reference).

#### Extends

- `BpmnError`

#### Constructors

##### Constructor

```ts
new AdapterError(message): AdapterError;
```

###### Parameters

###### message

`string`

###### Returns

[`AdapterError`](#adaptererror)

###### Overrides

```ts
BpmnError.constructor
```

#### Properties

##### code

```ts
readonly code: string;
```

###### Inherited from

```ts
BpmnError.code
```

## Interfaces

### AgentReferenceWarning

A process→agent reference whose target version is not current (§5).

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### ref

```ts
ref: string;
```

##### status

```ts
status: "draft" | "test" | "candidate" | "active" | "deprecated" | "retired";
```

##### message

```ts
message: string;
```

***

### AgentSimulationSession

A finished mock agent-simulation run, ready to record.

#### Properties

##### workflowRef

```ts
workflowRef: string;
```

The sub-workflow's versioned ref, e.g. `agnt-rsch@2.1.0`.

##### steps

```ts
steps: number;
```

Number of trail steps the run produced.

##### complete

```ts
complete: boolean;
```

True when the run finished cleanly; false when it stopped on a block.

##### blocked?

```ts
optional blocked?: object;
```

The honest stop (node + reason), when the run blocked.

###### nodeId

```ts
nodeId: string;
```

###### reason

```ts
reason: string;
```

##### author

```ts
author: string;
```

##### timestamp

```ts
timestamp: string;
```

ISO-8601 timestamp, supplied by the host.

***

### AgentArtifactVersion

One stored version of an agent artifact (canonical-JSON + hash store).

#### Properties

##### workflow

```ts
workflow: AgentWorkflow;
```

The versioned sub-workflow (carries id/version/name/autonomyLevel/graph).

##### status

```ts
status: "draft" | "test" | "candidate" | "active" | "deprecated" | "retired";
```

##### createdAt?

```ts
optional createdAt?: string;
```

ISO timestamp of the version, when known.

##### changeSummary?

```ts
optional changeSummary?: string;
```

##### author?

```ts
optional author?: string;
```

##### ledgerHash?

```ts
optional ledgerHash?: string;
```

Ledger hash of the promotion, if the host recorded one.

##### originTemplate?

```ts
optional originTemplate?: string;
```

The template this agent was instantiated from (card "templates de origem").

***

### AgentWorkflowAdapterOptions

#### Properties

##### id?

```ts
optional id?: string;
```

Adapter id; default `btv-agent`.

##### typeLabel?

```ts
optional typeLabel?: string;
```

Type label on chips/cards; default `AGENTE`.

##### source

```ts
source: AgentArtifactSource;
```

##### boundRuns?

```ts
optional boundRuns?: (artifactId) => number;
```

###### Parameters

###### artifactId

`string`

###### Returns

`number`

***

### AgentArtifactAdapter

ArtifactAdapter plus the host invalidation handle (§3 subscribe).

#### Extends

- `ArtifactAdapter`

#### Properties

##### id

```ts
id: string;
```

Unique id — "bpmn-diagram", "prompt", "dmn-decision"…

###### Inherited from

```ts
ArtifactAdapter.id
```

##### typeLabel

```ts
typeLabel: string;
```

###### Inherited from

```ts
ArtifactAdapter.typeLabel
```

#### Methods

##### notifyChanged()

```ts
notifyChanged(): void;
```

###### Returns

`void`

##### list()

```ts
list(query): Promise<ArtifactSummary[]>;
```

###### Parameters

###### query

`LibraryQuery`

###### Returns

`Promise`\<`ArtifactSummary`[]\>

###### Inherited from

```ts
ArtifactAdapter.list
```

##### get()

```ts
get(id): Promise<ArtifactDetail>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`ArtifactDetail`\>

###### Inherited from

```ts
ArtifactAdapter.get
```

##### subscribe()?

```ts
optional subscribe(cb): () => void;
```

Optional invalidation: call cb when the adapter's data changes.

###### Parameters

###### cb

() => `void`

###### Returns

() => `void`

###### Inherited from

```ts
ArtifactAdapter.subscribe
```

***

### DmnDecisionAdapterOptions

#### Properties

##### target?

```ts
optional target?: ObserverTarget;
```

##### now?

```ts
optional now?: () => string;
```

###### Returns

`string`

***

### GovernedEventDefinitionRecord

One governed definition version as the host's catalog records it.

#### Properties

##### kind

```ts
kind: "error" | "message" | "signal" | "escalation";
```

The referenceable kind — single source (`escalation` added in Handoff 18 §5c).

##### name

```ts
name: string;
```

Artifact name — the `nome` half of the pinned `nome@semver` binding.

##### semanticVersion

```ts
semanticVersion: string;
```

##### status

```ts
status: "draft" | "test" | "candidate" | "active" | "deprecated" | "retired";
```

##### definition

```ts
definition: object;
```

The payload mirrored into diagrams on bind (per-type code by kind).

###### name

```ts
name: string;
```

###### errorCode?

```ts
optional errorCode?: string;
```

###### escalationCode?

```ts
optional escalationCode?: string;
```

***

### RecipeAdapter

#### Extends

- `ArtifactAdapter`

#### Properties

##### id

```ts
id: string;
```

Unique id — "bpmn-diagram", "prompt", "dmn-decision"…

###### Inherited from

```ts
ArtifactAdapter.id
```

##### typeLabel

```ts
typeLabel: string;
```

###### Inherited from

```ts
ArtifactAdapter.typeLabel
```

#### Methods

##### notifyChanged()

```ts
notifyChanged(): void;
```

Fires subscribers — lets tests exercise the invalidation path.

###### Returns

`void`

##### list()

```ts
list(query): Promise<ArtifactSummary[]>;
```

###### Parameters

###### query

`LibraryQuery`

###### Returns

`Promise`\<`ArtifactSummary`[]\>

###### Inherited from

```ts
ArtifactAdapter.list
```

##### get()

```ts
get(id): Promise<ArtifactDetail>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`ArtifactDetail`\>

###### Inherited from

```ts
ArtifactAdapter.get
```

##### subscribe()?

```ts
optional subscribe(cb): () => void;
```

Optional invalidation: call cb when the adapter's data changes.

###### Parameters

###### cb

() => `void`

###### Returns

() => `void`

###### Inherited from

```ts
ArtifactAdapter.subscribe
```

***

### ObserverTarget

Observer target: when set, the summary reflects the version in effect on
that channel (Handoff 6 §3: "versão relevante ao canal do observador");
without it, the latest registered version wins.

#### Properties

##### channel

```ts
channel: string;
```

##### environment?

```ts
optional environment?: string;
```

***

### RegistryAdapterOptions

#### Properties

##### id

```ts
id: string;
```

Unique adapter id ("bpmn-diagram", "btv-persona"…).

##### typeLabel

```ts
typeLabel: string;
```

Free type label shown on chips/cards ("FLUXO", "PERSONA"…).

##### registry

```ts
registry: VersionRegistry;
```

##### match?

```ts
optional match?: (diagram) => boolean;
```

Claims a logical artifact by inspecting its latest snapshot.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`boolean`

##### target?

```ts
optional target?: ObserverTarget;
```

##### now?

```ts
optional now?: () => string;
```

ISO clock — injectable for tests; defaults to the real time.

###### Returns

`string`

##### boundRuns?

```ts
optional boundRuns?: (artifactId) => number;
```

Pinned-run counter, provided by the host (the registry stores none).

###### Parameters

###### artifactId

`string`

###### Returns

`number`

##### thumbnail?

```ts
optional thumbnail?: (diagram) => ThumbnailSpec;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`ThumbnailSpec`

***

### RegistryArtifactAdapter

ArtifactAdapter plus the invalidation handle the host wires (§3 subscribe).

#### Extends

- `ArtifactAdapter`

#### Properties

##### id

```ts
id: string;
```

Unique id — "bpmn-diagram", "prompt", "dmn-decision"…

###### Inherited from

```ts
ArtifactAdapter.id
```

##### typeLabel

```ts
typeLabel: string;
```

###### Inherited from

```ts
ArtifactAdapter.typeLabel
```

#### Methods

##### notifyChanged()

```ts
notifyChanged(): void;
```

Call after register/publish so subscribed views refresh.

###### Returns

`void`

##### list()

```ts
list(query): Promise<ArtifactSummary[]>;
```

###### Parameters

###### query

`LibraryQuery`

###### Returns

`Promise`\<`ArtifactSummary`[]\>

###### Inherited from

```ts
ArtifactAdapter.list
```

##### get()

```ts
get(id): Promise<ArtifactDetail>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`ArtifactDetail`\>

###### Inherited from

```ts
ArtifactAdapter.get
```

##### subscribe()?

```ts
optional subscribe(cb): () => void;
```

Optional invalidation: call cb when the adapter's data changes.

###### Parameters

###### cb

() => `void`

###### Returns

() => `void`

###### Inherited from

```ts
ArtifactAdapter.subscribe
```

***

### LogicalArtifact

All registered versions of one logical artifact (same snapshot.id).

#### Properties

##### id

```ts
id: string;
```

##### entries

```ts
entries: RegistryEntry[];
```

Ascending by version.createdAt.

***

### AttachedReplayAnalysis

A replay analysis read back from the chain for the Approver Review block.

#### Properties

##### headline

```ts
headline: string;
```

##### fitness

```ts
fitness: number;
```

##### totalCases

```ts
totalCases: number;
```

##### analyzedVersion

```ts
analyzedVersion: string;
```

##### bottleneck?

```ts
optional bottleneck?: string;
```

##### deviation?

```ts
optional deviation?: string;
```

##### deviationCases?

```ts
optional deviationCases?: number;
```

##### author

```ts
author: string;
```

##### timestamp

```ts
timestamp: string;
```

***

### ReviewThreadRef

The thread fields the ledger needs — structural, no react import.

#### Properties

##### id

```ts
id: string;
```

##### elementId

```ts
elementId: string;
```

##### versionRef

```ts
versionRef: string;
```

***

### SignedChangeRequestRef

The signed-request fields the ledger persists — structural mirror of
identity's `SignedApproval` (no nominal dependency, same discipline as
`ReviewThreadRef`).

#### Properties

##### payload

```ts
payload: Record<string, unknown>;
```

##### signature

```ts
signature: string;
```

##### signer

```ts
signer: Record<string, unknown>;
```

##### signedAt

```ts
signedAt: string;
```

***

### RoteiroRecord

A recorded simulation session offered to the Biblioteca as a versioned
"ROTEIRO" artifact (Handoff 7A §3). The host holds the sessions (from
`onRecord`) and exposes them through this adapter — the `simulation` package
stays headless and library-agnostic; this is pure host injection (§2).

#### Properties

##### session

```ts
session: SimulationSession;
```

##### name?

```ts
optional name?: string;
```

Display name; defaults to a derived label.

##### status?

```ts
optional status?: "draft" | "test" | "candidate" | "active" | "deprecated" | "retired";
```

Lifecycle status for library sorting/filtering; defaults to `active`.

##### ledgerHash?

```ts
optional ledgerHash?: string;
```

Ledger hash of the registration, when the host has it (provenance).

***

### RoteiroAdapter

#### Extends

- `ArtifactAdapter`

#### Properties

##### id

```ts
id: string;
```

Unique id — "bpmn-diagram", "prompt", "dmn-decision"…

###### Inherited from

```ts
ArtifactAdapter.id
```

##### typeLabel

```ts
typeLabel: string;
```

###### Inherited from

```ts
ArtifactAdapter.typeLabel
```

#### Methods

##### notifyChanged()

```ts
notifyChanged(): void;
```

Fires subscribers when the underlying session list changes.

###### Returns

`void`

##### list()

```ts
list(query): Promise<ArtifactSummary[]>;
```

###### Parameters

###### query

`LibraryQuery`

###### Returns

`Promise`\<`ArtifactSummary`[]\>

###### Inherited from

```ts
ArtifactAdapter.list
```

##### get()

```ts
get(id): Promise<ArtifactDetail>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`ArtifactDetail`\>

###### Inherited from

```ts
ArtifactAdapter.get
```

##### subscribe()?

```ts
optional subscribe(cb): () => void;
```

Optional invalidation: call cb when the adapter's data changes.

###### Parameters

###### cb

() => `void`

###### Returns

() => `void`

###### Inherited from

```ts
ArtifactAdapter.subscribe
```

***

### RecordedCoverage

Coverage counts a session recorded for a version.

#### Properties

##### covered

```ts
covered: number;
```

##### total

```ts
total: number;
```

***

### CoveragePromotionOptions

#### Properties

##### minCoverage

```ts
minCoverage: number;
```

Minimum exercised fraction 0–1 required to activate (e.g. 0.8).

##### coverageFor

```ts
coverageFor: (diagram) => RecordedCoverage | undefined;
```

Injected coverage lookup for a diagram — usually [latestSessionCoverage](#latestsessioncoverage).

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

[`RecordedCoverage`](#recordedcoverage) \| `undefined`

##### locale?

```ts
optional locale?: "en" | "pt";
```

## Type Aliases

### BtvAdapterOptions

```ts
type BtvAdapterOptions = Pick<RegistryAdapterOptions, "target" | "now" | "boundRuns">;
```

Shared knobs for the concrete BuildToValue adapters.

***

### AgentArtifactSource

```ts
type AgentArtifactSource = () => AgentArtifactVersion[];
```

Injected source of agent versions — the adapter never fetches or mutates.

#### Returns

[`AgentArtifactVersion`](#agentartifactversion)[]

***

### BtvArtifactKind

```ts
type BtvArtifactKind = "flow" | "persona" | "prompt" | "connector" | "policy";
```

The catalog kinds a registered diagram can embody. "policy" maps to the
BuildToValue Approval Gate (`btv:gate`) — the closest existing concept;
there is no dedicated policy node type today (see pendencias.md, Handoff 6).

## Variables

### AGENT\_SIMULATION\_SESSION\_TYPE

```ts
const AGENT_SIMULATION_SESSION_TYPE: "AGENT_SIMULATION_SESSION" = 'AGENT_SIMULATION_SESSION';
```

Agent Lane (Handoff 12 §7) — a mock agent-simulation session recorded in the
ledger as an ADDITIVE entry type, the same injection pattern as the H7
`SIMULATION_SESSION` (`simulationLedger.ts`): the `agentflow` engine never
imports the ledger; the host maps a finished run into an audit entry here.
Recognized by the SACM generator (which matches `/SIMULATION/`) and given its
own kind in the Ledger Explorer. Clock-free — `author`/`timestamp` come from
the host.

***

### BTV\_ARTIFACT\_KINDS

```ts
const BTV_ARTIFACT_KINDS: readonly BtvArtifactKind[];
```

***

### COMPENSATION\_TRIGGERED\_TYPE

```ts
const COMPENSATION_TRIGGERED_TYPE: "COMPENSATION_TRIGGERED" = 'COMPENSATION_TRIGGERED';
```

Compensation → ledger glue (Handoff 19 §6e). Same discipline as
`escalationRaisedEntry` (EC-3): the ledger MOTOR stays intact — this is a PURE
builder mapping a TRIGGERED compensation to the `AuditEntryInput` the HOST
appends (via its `command.executed` / simulation glue); the adapter never
touches the ledger, never imports react/simulation, and agentflow stays
independent (no cross-package dependency).

Semantics: `COMPENSATION_TRIGGERED` means the reversal ACTUALLY ran (the host
appends only when `compensate()` did NOT block — reforço 8). The entry binds
the EXECUTED plan: `compensated` in the real REVERSE order (`{activity,
handler}`) and `uncompensated` (`{activity, reason}`) — the declared,
never-omitted losses. `details.author` carries the actor so the Ledger
Explorer's ✦ mixed-authorship seal renders for AI reversals (`ia.copilot@…`)
via the existing `aiAuthorOf`, and stays absent for human ones — the same trail.

***

### ESCALATION\_RAISED\_TYPE

```ts
const ESCALATION_RAISED_TYPE: "ESCALATION_RAISED" = 'ESCALATION_RAISED';
```

Escalation → ledger glue (Handoff 18 §5c). Same discipline as
`eventBindingChangedEntry`/`reviewCommentEntry`: the ledger MOTOR stays
intact — this is a PURE builder mapping a raised escalation to the
`AuditEntryInput` the HOST appends (via its `command.executed` glue); the
adapter never touches the ledger, never imports react, and agentflow stays
independent (no cross-package dependency).

Semantics (reforço 7): `ESCALATION_RAISED` means the escalation ACTUALLY
HAPPENED (an agent/human escalated), NOT that a boundary was drawn — drawing
≠ escalating. In this handoff the entry has no honest runtime trigger yet;
the real glue (append when `throwEscalation` fires in the simulator) lands in
EC-5. `details.author` carries the actor so the Ledger Explorer's ✦
mixed-authorship seal renders for AI escalations (`ia.copilot@…`) via the
existing `aiAuthorOf`, and stays absent for human ones — the same trail.

***

### EVENT\_BINDING\_CHANGED\_TYPE

```ts
const EVENT_BINDING_CHANGED_TYPE: "EVENT_BINDING_CHANGED" = 'EVENT_BINDING_CHANGED';
```

An explicit change of a governed event-definition binding on the chain.

***

### REPLAY\_ANALYSIS\_TYPE

```ts
const REPLAY_ANALYSIS_TYPE: "REPLAY_ANALYSIS_ATTACHED" = 'REPLAY_ANALYSIS_ATTACHED';
```

Ledger entry type for a replay analysis attached to a promotion request.

***

### REVIEW\_COMMENT\_TYPE

```ts
const REVIEW_COMMENT_TYPE: "REVIEW_COMMENT_ADDED" = 'REVIEW_COMMENT_ADDED';
```

A review comment (thread opening or reply) recorded on the chain.

***

### REVIEW\_THREAD\_RESOLVED\_TYPE

```ts
const REVIEW_THREAD_RESOLVED_TYPE: "REVIEW_THREAD_RESOLVED" = 'REVIEW_THREAD_RESOLVED';
```

A thread resolution recorded on the chain.

***

### REVIEW\_THREAD\_DISMISSED\_TYPE

```ts
const REVIEW_THREAD_DISMISSED_TYPE: "REVIEW_THREAD_DISMISSED" = 'REVIEW_THREAD_DISMISSED';
```

A justified dismissal (gate release WITHOUT resolving) on the chain.

***

### REVIEW\_CHANGES\_REQUESTED\_TYPE

```ts
const REVIEW_CHANGES_REQUESTED_TYPE: "REVIEW_CHANGES_REQUESTED" = 'REVIEW_CHANGES_REQUESTED';
```

A signed request-changes act (§2e) on the chain.

***

### SIMULATION\_SESSION\_TYPE

```ts
const SIMULATION_SESSION_TYPE: "SIMULATION_SESSION" = 'SIMULATION_SESSION';
```

Ledger entry type for a registered simulation session. Recognized by the
SACM generator (`@buildtovalue/audit` `buildAssuranceCase`, which matches
`/SIMULATION/`) and given its own kind in the Studio Ledger Explorer.

## Functions

### bpmnDiagramAdapter()

```ts
function bpmnDiagramAdapter(registry, options?): RegistryArtifactAdapter;
```

BPMN flows — every registered diagram not claimed by a specific kind.

#### Parameters

##### registry

`VersionRegistry`

##### options?

[`BtvAdapterOptions`](#btvadapteroptions)

#### Returns

[`RegistryArtifactAdapter`](#registryartifactadapter)

***

### personaAdapter()

```ts
function personaAdapter(registry, options?): RegistryArtifactAdapter;
```

#### Parameters

##### registry

`VersionRegistry`

##### options?

[`BtvAdapterOptions`](#btvadapteroptions)

#### Returns

[`RegistryArtifactAdapter`](#registryartifactadapter)

***

### promptAdapter()

```ts
function promptAdapter(registry, options?): RegistryArtifactAdapter;
```

#### Parameters

##### registry

`VersionRegistry`

##### options?

[`BtvAdapterOptions`](#btvadapteroptions)

#### Returns

[`RegistryArtifactAdapter`](#registryartifactadapter)

***

### connectorAdapter()

```ts
function connectorAdapter(registry, options?): RegistryArtifactAdapter;
```

#### Parameters

##### registry

`VersionRegistry`

##### options?

[`BtvAdapterOptions`](#btvadapteroptions)

#### Returns

[`RegistryArtifactAdapter`](#registryartifactadapter)

***

### policyAdapter()

```ts
function policyAdapter(registry, options?): RegistryArtifactAdapter;
```

"Política" maps to the BuildToValue Approval Gate (`btv:gate`) — the
closest existing concept; a dedicated policy node type is an open product
decision (pendencias.md, Handoff 6).

#### Parameters

##### registry

`VersionRegistry`

##### options?

[`BtvAdapterOptions`](#btvadapteroptions)

#### Returns

[`RegistryArtifactAdapter`](#registryartifactadapter)

***

### agentPromotionGate()

```ts
function agentPromotionGate(workflow, locale?): RuleVerdict;
```

Promotion gate for an agent version (§5): the agentflow §3 graph validation
must produce no error, or promotion is blocked. Returns the standard
RuleVerdict so it drops into the same governance path as
`soundnessPromotionRule` / the autonomy→gate rule.

#### Parameters

##### workflow

`AgentWorkflow`

##### locale?

`"en"` \| `"pt"`

#### Returns

`RuleVerdict`

***

### agentReferenceCurrencyWarnings()

```ts
function agentReferenceCurrencyWarnings(
   diagram, 
   source, 
   locale?): AgentReferenceWarning[];
```

Currency (vigência) warnings for a process that references agents (§5) —
the SAME rule as the call activity, not a new one: an agentTask pointing at
an agent version that is not `active` (candidate/deprecated/…) warns at
promotion. Resolution is against the injected agent source (the analog of
`resolveCallActivities`). An unresolved ref is NOT a currency warning — that
is the CALL_REF_MISSING badge the shape already reuses (A-3/A-4).

#### Parameters

##### diagram

`BpmnDiagram`

##### source

[`AgentArtifactSource`](#agentartifactsource)

##### locale?

`"en"` \| `"pt"`

#### Returns

[`AgentReferenceWarning`](#agentreferencewarning)[]

***

### agentSimulationSessionEntry()

```ts
function agentSimulationSessionEntry(session, actor?): AuditEntryInput;
```

Maps an [AgentSimulationSession](#agentsimulationsession) to an audit-ledger append input. The
sub-workflow ref (with version) is the `versionId`, and the bare id is the
`artifactId` so the Ledger Explorer's "filter by this artifact" works.

#### Parameters

##### session

[`AgentSimulationSession`](#agentsimulationsession)

##### actor?

`Pick`\<`UserContext`, `"id"`\>

#### Returns

`AuditEntryInput`

***

### groupAgentVersions()

```ts
function groupAgentVersions(source): AgentGroup[];
```

Groups source versions by agent id (`workflow.id`), ascending by semver.

#### Parameters

##### source

[`AgentArtifactSource`](#agentartifactsource)

#### Returns

`AgentGroup`[]

***

### agentWorkflowAdapter()

```ts
function agentWorkflowAdapter(options): AgentArtifactAdapter;
```

Builds the "AGENTE" adapter over an injected agent-version source.

#### Parameters

##### options

[`AgentWorkflowAdapterOptions`](#agentworkflowadapteroptions)

#### Returns

[`AgentArtifactAdapter`](#agentartifactadapter)

***

### classifyDiagram()

```ts
function classifyDiagram(diagram): BtvArtifactKind;
```

Classifies a registered diagram into a catalog kind:
1. Explicit `diagram.metadata.artifactType` wins (documented convention of
   this package; accepts pt/en aliases).
2. Heuristic: when every active node shares a single mapped `btv:` type,
   the diagram IS that artifact (a persona/prompt/connector/policy
   definition registered as its own versioned diagram).
3. Everything else is a flow.

#### Parameters

##### diagram

`BpmnDiagram`

#### Returns

[`BtvArtifactKind`](#btvartifactkind)

***

### compensationTriggeredEntry()

```ts
function compensationTriggeredEntry(input): AuditEntryInput;
```

Maps a triggered compensation to a ledger append input.

#### Parameters

##### input

###### diagramId

`string`

###### versionId

`string`

###### scope

`string`

`'broadcast'` or the specific activity id/label the throw targeted.

###### actor

`Pick`\<`UserContext`, `"id"`\>

###### compensated

`object`[]

The reversed activities, in real reverse order.

###### uncompensated

`object`[]

Completed activities left uncompensated — declared, never omitted.

#### Returns

`AuditEntryInput`

***

### activeCopilotPromptVersion()

```ts
function activeCopilotPromptVersion(templateId): string | undefined;
```

The active (= shipped) version of a copilot template, or undefined for an
unknown id. The panel header uses this through host injection to append
"ativa" — the SAME registry the Biblioteca lists, never a parallel truth.

#### Parameters

##### templateId

`string`

#### Returns

`string` \| `undefined`

***

### copilotPromptAdapter()

```ts
function copilotPromptAdapter(): ArtifactAdapter;
```

#### Returns

`ArtifactAdapter`

***

### dmnDecisionAdapter()

```ts
function dmnDecisionAdapter(registry, options?): RegistryArtifactAdapter;
```

#### Parameters

##### registry

`VersionRegistry`

##### options?

[`DmnDecisionAdapterOptions`](#dmndecisionadapteroptions) = `{}`

#### Returns

[`RegistryArtifactAdapter`](#registryartifactadapter)

***

### escalationRaisedEntry()

```ts
function escalationRaisedEntry(input): AuditEntryInput;
```

Maps a raised escalation (actor, code, target) to a ledger append input.

#### Parameters

##### input

###### diagramId

`string`

###### versionId

`string`

###### nodeId

`string`

###### actor

`Pick`\<`UserContext`, `"id"`\>

###### code?

`string`

###### target?

`string`

#### Returns

`AuditEntryInput`

***

### eventBindingChangedEntry()

```ts
function eventBindingChangedEntry(input): AuditEntryInput;
```

Maps a binding change (bind, re-bind or unbind) to a ledger append input.
`from`/`to` are pinned `nome@semver` strings — absent `from` means a first
bind, absent `to` means an unbind. `details.artifactId` mirrors the event
node so the Ledger Explorer's per-artifact filter works.

#### Parameters

##### input

###### diagramId

`string`

###### versionId

`string`

###### nodeId

`string`

###### actor

`Pick`\<`UserContext`, `"id"`\>

###### from?

`string`

###### to?

`string`

#### Returns

`AuditEntryInput`

***

### eventDefinitionCatalogAdapter()

```ts
function eventDefinitionCatalogAdapter(records): ArtifactAdapter;
```

Read-only catalog adapter: one card per definition NAME, its version
timeline in the drawer. `artifactId` is the name; the editor's picker lists
the same records through the injected `EventDefinitionResolver` — one
catalog, never a parallel truth.

#### Parameters

##### records

readonly [`GovernedEventDefinitionRecord`](#governedeventdefinitionrecord)[]

#### Returns

`ArtifactAdapter`

***

### activeLintProfileVersion()

```ts
function activeLintProfileVersion(profileId): string | undefined;
```

The active (= shipped) version of a lint profile, or undefined for an
unknown id. The panel header appends "VIGENTE" through this — the SAME
registry the Biblioteca lists.

#### Parameters

##### profileId

`string`

#### Returns

`string` \| `undefined`

***

### lintProfileAdapter()

```ts
function lintProfileAdapter(): ArtifactAdapter;
```

#### Returns

`ArtifactAdapter`

***

### createRecipeAdapter()

```ts
function createRecipeAdapter(): RecipeAdapter;
```

#### Returns

[`RecipeAdapter`](#recipeadapter)

***

### logicalArtifacts()

```ts
function logicalArtifacts(registry): LogicalArtifact[];
```

Groups registry entries by logical artifact (`entry.snapshot.id`).

#### Parameters

##### registry

`VersionRegistry`

#### Returns

[`LogicalArtifact`](#logicalartifact)[]

***

### relevantEntry()

```ts
function relevantEntry(
   artifact, 
   target, 
   at): object;
```

Picks the entry (and publication) the observer should see: with a target,
the version published on that lane at `at`; otherwise the newest version.

#### Parameters

##### artifact

[`LogicalArtifact`](#logicalartifact)

##### target

[`ObserverTarget`](#observertarget) \| `undefined`

##### at

`string`

#### Returns

`object`

##### entry

```ts
entry: RegistryEntry;
```

##### publication?

```ts
optional publication?: Publication;
```

***

### createRegistryAdapter()

```ts
function createRegistryAdapter(options): RegistryArtifactAdapter;
```

The generic bridge registry → library: every concrete adapter of this
package (flow, persona, prompt, connector, policy) is a thin configuration
of this factory. Read-only over the registry; mutations never happen here.

#### Parameters

##### options

[`RegistryAdapterOptions`](#registryadapteroptions)

#### Returns

[`RegistryArtifactAdapter`](#registryartifactadapter)

***

### replayAnalysisEntry()

```ts
function replayAnalysisEntry(
   analysis, 
   actor?, 
   attachTo?): AuditEntryInput;
```

Maps a replay analysis to an audit-ledger append input. `versionId` defaults
to the analyzed version but is usually overridden with the *candidate*
version id (`attachTo`), so the Approver Review of that candidate finds it.
`details.artifactId` keeps the Ledger Explorer's "filter by artifact" working.

#### Parameters

##### analysis

`ReplayAnalysis`

##### actor?

`Pick`\<`UserContext`, `"id"`\>

##### attachTo?

`string`

#### Returns

`AuditEntryInput`

***

### latestReplayAnalysis()

```ts
function latestReplayAnalysis(entries, versionId): AttachedReplayAnalysis | undefined;
```

Reads the most recent replay analysis attached to a version from the ledger
— the block the Approver Review renders. Returns `undefined` when none is
attached (so the review degrades gracefully). Entries are chronological, so
the last match wins.

#### Parameters

##### entries

readonly `AuditEntry`[]

##### versionId

`string`

#### Returns

[`AttachedReplayAnalysis`](#attachedreplayanalysis) \| `undefined`

***

### reviewCommentEntry()

```ts
function reviewCommentEntry(thread, message): AuditEntryInput;
```

Maps a comment (the opening message or a reply) to a ledger append input.
`details.artifactId` mirrors the element anchor so the Ledger Explorer's
per-artifact filter works; `aiAssisted` records mixed authorship (C4).

#### Parameters

##### thread

[`ReviewThreadRef`](#reviewthreadref)

##### message

###### author

`string`

###### text

`string`

###### aiAssisted?

`boolean`

#### Returns

`AuditEntryInput`

***

### reviewThreadDismissedEntry()

```ts
function reviewThreadDismissedEntry(
   thread, 
   actor, 
   justification): AuditEntryInput;
```

Maps a justified dismissal to a ledger append input (§2d) — never silent:
the justification text travels in the entry.

#### Parameters

##### thread

[`ReviewThreadRef`](#reviewthreadref)

##### actor

`Pick`\<`UserContext`, `"id"`\>

##### justification

`string`

#### Returns

`AuditEntryInput`

***

### reviewChangesRequestedEntry()

```ts
function reviewChangesRequestedEntry(input): AuditEntryInput;
```

Maps a request-changes decision (§2e: comentário obrigatório + threads
abertas anexadas) to a ledger append input. `versionId` is the CANDIDATE
version the request targets; the resulting `in-review` version chains to it
via `parentVersionId`. When the act was signed, the full signed request
(payload + Ed25519 signature + signer identity) joins the entry so any
third party can verify it offline.

#### Parameters

##### input

###### diagramId

`string`

###### versionId

`string`

###### actor

`Pick`\<`UserContext`, `"id"` \| `"role"`\>

###### justification

`string`

###### threadRefs

readonly `string`[]

###### signedRequest?

[`SignedChangeRequestRef`](#signedchangerequestref)

#### Returns

`AuditEntryInput`

***

### reviewThreadResolvedEntry()

```ts
function reviewThreadResolvedEntry(thread, actor): AuditEntryInput;
```

Maps a thread resolution to a ledger append input.

#### Parameters

##### thread

[`ReviewThreadRef`](#reviewthreadref)

##### actor

`Pick`\<`UserContext`, `"id"`\>

#### Returns

`AuditEntryInput`

***

### createRoteiroAdapter()

```ts
function createRoteiroAdapter(source): RoteiroAdapter;
```

Builds a ROTEIRO adapter over a live list of recorded sessions. Pass a getter
so the catalog reflects registrations as they happen; call `notifyChanged`
after the list grows. Mirrors `recipeAdapter` (self-contained, imports only
from `@buildtovalue/library` + the neutral session type).

#### Parameters

##### source

() => [`RoteiroRecord`](#roteirorecord)[]

#### Returns

[`RoteiroAdapter`](#roteiroadapter)

***

### simulationSessionEntry()

```ts
function simulationSessionEntry(session, actor?): AuditEntryInput;
```

Maps a recorded session to an audit-ledger append input. `details.artifactId`
is included so the Ledger Explorer's "filter by this artifact" works, and the
coverage counts + roteiro hash are stored so the SACM evidence and the
coverage gate can read them straight from the chain — no side store.

#### Parameters

##### session

`SimulationSession`

##### actor?

`Pick`\<`UserContext`, `"id"`\>

#### Returns

`AuditEntryInput`

***

### latestSessionCoverage()

```ts
function latestSessionCoverage(entries, versionId): RecordedCoverage | undefined;
```

Reads the best coverage a version has registered from the ledger — the
`SIMULATION_SESSION` entry for `versionId` with the highest exercised ratio.
Returns `undefined` when the version has no recorded session (so the gate can
degrade gracefully).

#### Parameters

##### entries

readonly `AuditEntry`[]

##### versionId

`string`

#### Returns

[`RecordedCoverage`](#recordedcoverage) \| `undefined`

***

### coveragePromotionRule()

```ts
function coveragePromotionRule(options): PromotionRule;
```

OPTIONAL promotion gate (Handoff 7A §3, cerca §9): require a minimum
registered path coverage before a version may become `active`. **OFF by
default** — the engine's `promotionRules` is empty unless the host adds this.
Degrades gracefully: a version with no recorded coverage is never blocked
(the gate only bites once coverage exists and falls short).

#### Parameters

##### options

[`CoveragePromotionOptions`](#coveragepromotionoptions)

#### Returns

`PromotionRule`

***

### diagramThumbnail()

```ts
function diagramThumbnail(diagram): ThumbnailSpec;
```

Draws the active flow of a diagram as a self-contained SVG string.

#### Parameters

##### diagram

`BpmnDiagram`

#### Returns

`ThumbnailSpec`

***

### decisionThumbnail()

```ts
function decisionThumbnail(rules): ThumbnailSpec;
```

Tiny decision-table glyph for DMN decision artifacts.

#### Parameters

##### rules

`number`

#### Returns

`ThumbnailSpec`

***

### resolveToolContract()

```ts
function resolveToolContract(contracts): ResolveTool;
```

Builds a headless ResolveTool over a contract list — the seam the
react `ToolProvider` and `validateGraph({ resolveTool })` share. Exact
`id@version` match; an unknown ref resolves to `undefined` (declared
degradation upstream, never silent — cerca §2.4).

#### Parameters

##### contracts

readonly `ToolContract`[]

#### Returns

`ResolveTool`

***

### toolAdapter()

```ts
function toolAdapter(contracts): ArtifactAdapter;
```

A Biblioteca adapter over an injected `ToolContract[]`. One artifact per tool
id (versions grouped, newest as the representative); read-only, like the other
JSON-artifact adapters. `authorization`/`effect` travel in `meta` so the
catalog card shows the governance posture at a glance.

#### Parameters

##### contracts

readonly `ToolContract`[]

#### Returns

`ArtifactAdapter`
