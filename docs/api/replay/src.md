# replay/src

## Interfaces

### ReplayAnalysis

A serializable governance summary of a replay (Handoff 7B-3): the real
bottleneck, fitness and the top deviation for one version, plus a
ready-to-render `headline`. Neutral JSON — the host attaches it to a
promotion request and writes it to the ledger by injection; `@buildtovalue/
replay` never imports audit/registry.

#### Properties

##### diagramId

```ts
diagramId: string;
```

##### versionId

```ts
versionId: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### totalCases

```ts
totalCases: number;
```

##### fitness

```ts
fitness: number;
```

Token-replay fitness, 0–1.

##### bottleneck?

```ts
optional bottleneck?: object;
```

###### nodeId

```ts
nodeId: string;
```

###### label

```ts
label: string;
```

###### avgMs

```ts
avgMs: number;
```

##### topDeviation?

```ts
optional topDeviation?: object;
```

###### from

```ts
from: string;
```

###### to

```ts
to: string;
```

###### label

```ts
label: string;
```

###### cases

```ts
cases: number;
```

###### share

```ts
share: number;
```

##### candidateSemanticVersion?

```ts
optional candidateSemanticVersion?: string;
```

Candidate version this analysis argues for, if any.

##### author

```ts
author: string;
```

##### timestamp

```ts
timestamp: string;
```

##### headline

```ts
headline: string;
```

Human one-liner for the comparison card / review block.

***

### SummarizeOptions

#### Properties

##### diagramId

```ts
diagramId: string;
```

##### versionId

```ts
versionId: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### author

```ts
author: string;
```

##### timestamp

```ts
timestamp: string;
```

ISO-8601, supplied by the host — the package never reads a clock.

##### label

```ts
label: (nodeId) => string;
```

Node id → label (injected; the graph carries only ids).

###### Parameters

###### nodeId

`string`

###### Returns

`string`

##### formatMs

```ts
formatMs: (ms) => string;
```

Duration formatter (injected so this package stays presentation-free).

###### Parameters

###### ms

`number`

###### Returns

`string`

##### candidateSemanticVersion?

```ts
optional candidateSemanticVersion?: string;
```

##### candidateChange?

```ts
optional candidateChange?: string;
```

What the candidate changes (its change summary), for the headline.

***

### CsvMapping

#### Properties

##### case?

```ts
optional case?: string | number;
```

Column name (or 0-based index) for the case id. Default: "case".

##### activity?

```ts
optional activity?: string | number;
```

Column name/index for the activity. Default: "activity".

##### timestamp?

```ts
optional timestamp?: string | number;
```

Column name/index for the timestamp. Default: "timestamp".

##### delimiter?

```ts
optional delimiter?: string;
```

Field delimiter. Default: ",".

***

### ReplayNode

A node in the injected graph. `name` (when present) is matched against the
log activity name; otherwise `id` is used.

#### Properties

##### id

```ts
id: string;
```

##### name?

```ts
optional name?: string;
```

***

### ReplayEdge

A directed edge in the injected graph.

#### Properties

##### id

```ts
id: string;
```

##### source

```ts
source: string;
```

##### target

```ts
target: string;
```

***

### ReplayGraph

The abstract graph the log is replayed against.

#### Properties

##### nodes

```ts
nodes: ReplayNode[];
```

##### edges

```ts
edges: ReplayEdge[];
```

***

### LogEvent

One event of a trace. `timestamp` is epoch milliseconds (optional).

#### Properties

##### activity

```ts
activity: string;
```

##### timestamp?

```ts
optional timestamp?: number;
```

***

### Trace

One case: an ordered sequence of events.

#### Properties

##### caseId

```ts
caseId: string;
```

##### events

```ts
events: LogEvent[];
```

***

### NodeStat

Per-node aggregate: frequency and average sojourn time (⌀ chip).

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### count

```ts
count: number;
```

##### avgMs?

```ts
optional avgMs?: number;
```

Average time (ms) until the next event in the same case; undefined when
timestamps are absent or the node never has a successor.

***

### EdgeStat

Per-edge aggregate: frequency (heatmap thickness) and average transition time.

#### Properties

##### edgeId

```ts
edgeId: string;
```

##### source

```ts
source: string;
```

##### target

```ts
target: string;
```

##### count

```ts
count: number;
```

##### avgMs?

```ts
optional avgMs?: number;
```

***

### Deviation

A transition seen in the log that has no corresponding edge in the model —
the dashed red "▲ DESVIO" path. `from`/`to` are node ids; an unmapped
activity is encoded as `?<activity>`.

#### Properties

##### from

```ts
from: string;
```

##### to

```ts
to: string;
```

##### count

```ts
count: number;
```

Total occurrences across the log.

##### cases

```ts
cases: number;
```

Distinct cases exhibiting this deviation (the "N casos" label).

***

### Variant

A trace variant (a distinct activity sequence) with its share.

#### Properties

##### signature

```ts
signature: string;
```

Stable signature (normalized activities joined).

##### activities

```ts
activities: string[];
```

##### count

```ts
count: number;
```

##### share

```ts
share: number;
```

Share of all cases, 0–1.

##### sampleCaseId

```ts
sampleCaseId: string;
```

One case id exhibiting this variant (for "▶ Reproduzir").

***

### Fitness

Token-replay fitness (cerca §0.2 — NOT alignments). `fitness` is the fraction
of transition moves that had a corresponding model edge; `conformingCases`
counts traces that replayed with zero deviations (the "N de M casos" note).

#### Properties

##### fitness

```ts
fitness: number;
```

##### fitMoves

```ts
fitMoves: number;
```

##### totalMoves

```ts
totalMoves: number;
```

##### conformingCases

```ts
conformingCases: number;
```

##### totalCases

```ts
totalCases: number;
```

***

### AggregatedLog

The full one-pass aggregation result.

#### Properties

##### totalEvents

```ts
totalEvents: number;
```

##### totalCases

```ts
totalCases: number;
```

##### nodes

```ts
nodes: NodeStat[];
```

##### edges

```ts
edges: EdgeStat[];
```

##### deviations

```ts
deviations: Deviation[];
```

##### variants

```ts
variants: Variant[];
```

##### fitness

```ts
fitness: Fitness;
```

##### unmapped

```ts
unmapped: string[];
```

Distinct log activity names with no matching node.

##### bottleneckNodeId?

```ts
optional bottleneckNodeId?: string;
```

Node with the highest average sojourn time (the "GARGALO").

***

### AggregateOptions

#### Properties

##### topVariants?

```ts
optional topVariants?: number;
```

Max variants returned (default 3, matching the prototype's top-3).

## Functions

### normalizeName()

```ts
function normalizeName(name): string;
```

Normalizes an activity/node name for matching: trim, lowercase, collapse ws.

#### Parameters

##### name

`string`

#### Returns

`string`

***

### aggregate()

```ts
function aggregate(
   graph, 
   traces, 
   options?): AggregatedLog;
```

Replays a log against an injected graph in a **single pass** (cerca §0.3 —
O(n), no DOM): frequency + average time per node and edge, token-replay
fitness with deviation detection (cerca §0.2 — never alignments), variant
extraction, and the bottleneck node. Works on any `{ nodes, edges }`; it
never imports the BPMN model, so the acid test drives it with a fake graph.

Matching is by normalized activity name (node `name`, falling back to `id`);
activities with no node are reported in `unmapped` and every transition
touching them counts as a deviation.

#### Parameters

##### graph

[`ReplayGraph`](#replaygraph)

##### traces

`Iterable`\<[`Trace`](#trace)\>

##### options?

[`AggregateOptions`](#aggregateoptions) = `{}`

#### Returns

[`AggregatedLog`](#aggregatedlog)

***

### summarizeReplay()

```ts
function summarizeReplay(log, options): ReplayAnalysis;
```

Builds a [ReplayAnalysis](#replayanalysis) from an aggregated log. The bottleneck is the
slowest node (`bottleneckNodeId`); the top deviation is the most frequent one.
The headline reads "O gargalo real da vX é … — a vY ataca isso: …" when a
candidate change is supplied.

#### Parameters

##### log

[`AggregatedLog`](#aggregatedlog)

##### options

[`SummarizeOptions`](#summarizeoptions)

#### Returns

[`ReplayAnalysis`](#replayanalysis)

***

### parseTimestamp()

```ts
function parseTimestamp(value): number | undefined;
```

Parses a timestamp cell to epoch ms: numeric epoch, or any Date-parsable string.

#### Parameters

##### value

`string`

#### Returns

`number` \| `undefined`

***

### parseCsv()

```ts
function parseCsv(text, mapping?): Trace[];
```

Parses a CSV event log (minimum columns: case, activity, timestamp) into
traces. Reads line by line and groups events by case (compact tuples — never
a rich object graph, cerca §0.3); each trace is stably sorted by timestamp
when present. Column names are configurable via [CsvMapping](#csvmapping).

#### Parameters

##### text

`string`

##### mapping?

[`CsvMapping`](#csvmapping) = `{}`

#### Returns

[`Trace`](#trace)[]

***

### parseXes()

```ts
function parseXes(xml): Trace[];
```

Parses an XES 2.0 event log into traces. Scans trace-by-trace and
event-by-event without materializing an XML DOM (cerca §0.3): only the
`concept:name` (activity / case id) and `time:timestamp` attributes are
read. Unknown extensions are ignored. Missing case names fall back to a
positional id.

#### Parameters

##### xml

`string`

#### Returns

[`Trace`](#trace)[]
