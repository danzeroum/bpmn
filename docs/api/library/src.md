# library/src

## Interfaces

### AdapterWarning

#### Properties

##### adapterId

```ts
adapterId: string;
```

##### message

```ts
message: string;
```

***

### RegisterAdaptersOptions

#### Properties

##### onWarning?

```ts
optional onWarning?: (warning) => void;
```

###### Parameters

###### warning

[`AdapterWarning`](#adapterwarning)

###### Returns

`void`

***

### LibraryCounts

#### Properties

##### total

```ts
total: number;
```

##### byStatus

```ts
byStatus: Record<LifecycleStatus, number>;
```

##### byAdapter

```ts
byAdapter: Record<string, number>;
```

adapterId → count; every registered adapter has an entry (0 included).

***

### LibraryResult

#### Properties

##### items

```ts
items: ArtifactSummary[];
```

##### counts

```ts
counts: LibraryCounts;
```

Chip data: counted over the text-filtered set, BEFORE the status and
adapter narrowing, so each chip shows what selecting it would yield.

***

### LibraryCatalogOptions

#### Properties

##### onWarning?

```ts
optional onWarning?: (warning) => void;
```

###### Parameters

###### warning

[`AdapterWarning`](#adapterwarning)

###### Returns

`void`

***

### LibraryCatalog

#### Properties

##### adapters

```ts
adapters: readonly ArtifactAdapter[];
```

Adapters that survived registration validation, in order.

#### Methods

##### list()

```ts
list(query?): Promise<LibraryResult>;
```

###### Parameters

###### query?

[`LibraryQuery`](#libraryquery)

###### Returns

`Promise`\<[`LibraryResult`](#libraryresult)\>

##### get()

```ts
get(ref): Promise<ArtifactDetail>;
```

###### Parameters

###### ref

[`ArtifactRef`](#artifactref)

###### Returns

`Promise`\<[`ArtifactDetail`](#artifactdetail)\>

##### subscribe()

```ts
subscribe(cb): () => void;
```

Aggregates the adapters' optional subscribe hooks.

###### Parameters

###### cb

() => `void`

###### Returns

() => `void`

***

### ArtifactRef

Stable address of an artifact: which adapter owns it + its id there.

#### Properties

##### adapterId

```ts
adapterId: string;
```

##### artifactId

```ts
artifactId: string;
```

***

### ArtifactAction

Actions are descriptors the host (Studio) resolves (§3.2). The library
renders buttons — it never executes a mutation itself.

#### Properties

##### id

```ts
id: string;
```

##### label

```ts
label: string;
```

##### kind

```ts
kind: "navigate" | "download" | "external";
```

##### href?

```ts
optional href?: string;
```

##### payload?

```ts
optional payload?: unknown;
```

***

### VersionEntry

One row of the version timeline shown in the artifact drawer.

#### Properties

##### version

```ts
version: string;
```

##### status

```ts
status: "draft" | "test" | "candidate" | "active" | "deprecated" | "retired";
```

##### timestamp?

```ts
optional timestamp?: string;
```

ISO timestamp of the entry, when the adapter knows it.

##### note?

```ts
optional note?: string;
```

Free-form note ("supersedeu v1.2.0", "3 execuções presas"…).

***

### ArtifactSummary

#### Extended by

- [`ArtifactDetail`](#artifactdetail)

#### Properties

##### ref

```ts
ref: ArtifactRef;
```

##### name

```ts
name: string;
```

##### typeLabel

```ts
typeLabel: string;
```

Free label from the adapter — "FLUXO", "PERSONA", "DECISÃO"…

##### version

```ts
version: string;
```

Semver of the version relevant to the observer's channel.

##### status

```ts
status: "draft" | "test" | "candidate" | "active" | "deprecated" | "retired";
```

##### channel?

```ts
optional channel?: string;
```

##### boundRuns?

```ts
optional boundRuns?: number;
```

Pinned executions (bindRun) — derived by the adapter, optional.

##### meta?

```ts
optional meta?: string;
```

Free context line.

##### thumbnail?

```ts
optional thumbnail?: ThumbnailSpec;
```

##### updatedAt?

```ts
optional updatedAt?: string;
```

ISO timestamp of the latest relevant change. Extension over Handoff 6
§3: required by the §4 "atualização" sort; entries without it sort
after dated ones.

***

### ArtifactDetail

#### Extends

- [`ArtifactSummary`](#artifactsummary)

#### Properties

##### ref

```ts
ref: ArtifactRef;
```

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`ref`](#ref)

##### name

```ts
name: string;
```

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`name`](#name)

##### typeLabel

```ts
typeLabel: string;
```

Free label from the adapter — "FLUXO", "PERSONA", "DECISÃO"…

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`typeLabel`](#typelabel)

##### version

```ts
version: string;
```

Semver of the version relevant to the observer's channel.

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`version`](#version-1)

##### status

```ts
status: "draft" | "test" | "candidate" | "active" | "deprecated" | "retired";
```

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`status`](#status-1)

##### channel?

```ts
optional channel?: string;
```

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`channel`](#channel)

##### boundRuns?

```ts
optional boundRuns?: number;
```

Pinned executions (bindRun) — derived by the adapter, optional.

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`boundRuns`](#boundruns)

##### meta?

```ts
optional meta?: string;
```

Free context line.

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`meta`](#meta)

##### thumbnail?

```ts
optional thumbnail?: ThumbnailSpec;
```

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`thumbnail`](#thumbnail)

##### updatedAt?

```ts
optional updatedAt?: string;
```

ISO timestamp of the latest relevant change. Extension over Handoff 6
§3: required by the §4 "atualização" sort; entries without it sort
after dated ones.

###### Inherited from

[`ArtifactSummary`](#artifactsummary).[`updatedAt`](#updatedat)

##### effectiveFrom?

```ts
optional effectiveFrom?: string;
```

##### effectiveUntil?

```ts
optional effectiveUntil?: string;
```

##### approvers?

```ts
optional approvers?: string[];
```

##### changeSummary?

```ts
optional changeSummary?: string;
```

##### provenance?

```ts
optional provenance?: object;
```

###### ledgerHash

```ts
ledgerHash: string;
```

###### author

```ts
author: string;
```

###### createdAt

```ts
createdAt: string;
```

##### versions

```ts
versions: VersionEntry[];
```

Full version timeline, newest first by adapter convention.

##### actions

```ts
actions: ArtifactAction[];
```

***

### LibraryQuery

#### Properties

##### text?

```ts
optional text?: string;
```

Case-insensitive match against name, typeLabel and meta.

##### statuses?

```ts
optional statuses?: ("draft" | "test" | "candidate" | "active" | "deprecated" | "retired")[];
```

Fixed vocabulary — the six LifecycleStatus states.

##### adapterIds?

```ts
optional adapterIds?: string[];
```

Dynamic vocabulary — ids of registered adapters (type chips).

##### sort?

```ts
optional sort?: LibrarySort;
```

***

### ArtifactAdapter

#### Properties

##### id

```ts
id: string;
```

Unique id — "bpmn-diagram", "prompt", "dmn-decision"…

##### typeLabel

```ts
typeLabel: string;
```

#### Methods

##### list()

```ts
list(query): Promise<ArtifactSummary[]>;
```

###### Parameters

###### query

[`LibraryQuery`](#libraryquery)

###### Returns

`Promise`\<[`ArtifactSummary`](#artifactsummary)[]\>

##### get()

```ts
get(id): Promise<ArtifactDetail>;
```

###### Parameters

###### id

`string`

###### Returns

`Promise`\<[`ArtifactDetail`](#artifactdetail)\>

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

## Type Aliases

### LifecycleStatus

```ts
type LifecycleStatus = typeof LIFECYCLE_STATUSES[number];
```

***

### ThumbnailSpec

```ts
type ThumbnailSpec = 
  | {
  kind: "svg";
  svg: string;
}
  | {
  kind: "icon";
  icon: string;
}
  | {
  kind: "none";
};
```

Thumbnails arrive as data, never as imported components (§3.1): the
adapter draws (an SVG string or a named icon), the library only places it.

***

### LibrarySort

```ts
type LibrarySort = "name" | "updated" | "status";
```

## Variables

### LIFECYCLE\_STATUSES

```ts
const LIFECYCLE_STATUSES: readonly ["draft", "test", "candidate", "active", "deprecated", "retired"];
```

Canonical lifecycle order — also the sort order for `sort: 'status'`.

## Functions

### registerAdapters()

```ts
function registerAdapters(adapters, options?): ArtifactAdapter[];
```

Validates adapters at registration time (Handoff 6 §3: warning, never
crash). Invalid adapters are dropped; a duplicate id keeps the first
registration and drops the later one.

#### Parameters

##### adapters

readonly [`ArtifactAdapter`](#artifactadapter)[]

##### options?

[`RegisterAdaptersOptions`](#registeradaptersoptions) = `{}`

#### Returns

[`ArtifactAdapter`](#artifactadapter)[]

***

### createLibraryCatalog()

```ts
function createLibraryCatalog(adapters, options?): LibraryCatalog;
```

The headless catalog (Handoff 6 §1/§4): aggregates registered adapters and
implements search, status/type filtering, sorting and chip counts without
any DOM or knowledge of concrete artifact types. Read-only by construction
— there is no mutation path.

#### Parameters

##### adapters

readonly [`ArtifactAdapter`](#artifactadapter)[]

##### options?

[`LibraryCatalogOptions`](#librarycatalogoptions) = `{}`

#### Returns

[`LibraryCatalog`](#librarycatalog)
