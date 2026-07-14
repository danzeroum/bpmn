# registry/src

## Classes

### VersionRegistry

The queryable governance layer over the core lifecycle: a registry of
diagram versions with content snapshots, temporal validity, publication
channels/environments and a dual changelog. It answers the audit
questions the lifecycle alone can't — "which version was in effect on day
X?", "what changed between v1 and v2?", "what is active on the pilot
channel right now?" — without knowing anything about the host domain.

It builds on, and never replaces, LifecycleEngine: promote/approve
still happen there; the registry records the resulting immutable versions
and their rollout.

#### Constructors

##### Constructor

```ts
new VersionRegistry(options?): VersionRegistry;
```

###### Parameters

###### options?

###### sink?

[`RegistrySink`](#registrysink)

###### Returns

[`VersionRegistry`](#versionregistry)

#### Methods

##### register()

```ts
register(diagram, options?): Promise<RegistryEntry>;
```

Records a diagram's current version with a content snapshot. The version
id must be unique — re-registering the same version id is rejected
(versions are immutable). Returns the stored entry.

###### Parameters

###### diagram

`BpmnDiagram`

###### options?

[`RegisterOptions`](#registeroptions) = `{}`

###### Returns

`Promise`\<[`RegistryEntry`](#registryentry)\>

##### get()

```ts
get(versionId): RegistryEntry | undefined;
```

###### Parameters

###### versionId

`string`

###### Returns

[`RegistryEntry`](#registryentry) \| `undefined`

##### list()

```ts
list(): RegistryEntry[];
```

All entries in registration order.

###### Returns

[`RegistryEntry`](#registryentry)[]

##### history()

```ts
history(): RegistryEntry[];
```

All entries ordered chronologically by version creation time.

###### Returns

[`RegistryEntry`](#registryentry)[]

##### lineageOf()

```ts
lineageOf(versionId): RegistryEntry[];
```

The ancestor chain of `versionId`, oldest first, following
`parentVersionId`. Stops at the first ancestor not in the registry.

###### Parameters

###### versionId

`string`

###### Returns

[`RegistryEntry`](#registryentry)[]

##### publish()

```ts
publish(versionId, options): Promise<Publication>;
```

Publishes a version to a lane (channel + optional environment). Closes
the lane's previously open publication (sets its `effectiveUntil` to this
publication's `effectiveFrom`), so a lane always has one live version.
A version can hold different statuses on different lanes (e.g. `active`
on pilot while `candidate` on general).

###### Parameters

###### versionId

`string`

###### options

[`PublishOptions`](#publishoptions)

###### Returns

`Promise`\<[`Publication`](#publication)\>

##### channelTimeline()

```ts
channelTimeline(channel, environment?): Publication[];
```

Publications on a lane, chronological.

###### Parameters

###### channel

`string`

###### environment?

`string`

###### Returns

[`Publication`](#publication)[]

##### publicationAt()

```ts
publicationAt(at, target): Publication | undefined;
```

The publication covering `at` on the given lane, if any.

###### Parameters

###### at

[`DateInput`](#dateinput)

###### target

[`PublicationTarget`](#publicationtarget)

###### Returns

[`Publication`](#publication) \| `undefined`

##### activeAt()

```ts
activeAt(at, target?): RegistryEntry | undefined;
```

Which version was in effect at `at`?
- With a `target`: the version whose publication covers `at` on that lane.
- Without: the version whose lifecycle validity window
  (`effectiveFrom`/`effectiveUntil`) covers `at` (latest wins on overlap).

###### Parameters

###### at

[`DateInput`](#dateinput)

###### target?

[`PublicationTarget`](#publicationtarget)

###### Returns

[`RegistryEntry`](#registryentry) \| `undefined`

##### diffBetween()

```ts
diffBetween(fromVersionId, toVersionId): BpmnDiff;
```

Structured diff between two registered versions' snapshots.

###### Parameters

###### fromVersionId

`string`

###### toVersionId

`string`

###### Returns

`BpmnDiff`

##### snapshotOf()

```ts
snapshotOf(versionId): BpmnDiagram;
```

The snapshot to run for a given version (deep copy — safe to mutate).

###### Parameters

###### versionId

`string`

###### Returns

`BpmnDiagram`

##### versionOf()

```ts
versionOf(versionId): BpmnVersion;
```

The version metadata for a registered version.

###### Parameters

###### versionId

`string`

###### Returns

`BpmnVersion`

##### export()

```ts
export(): ExportedRegistry;
```

###### Returns

[`ExportedRegistry`](#exportedregistry)

##### import()

```ts
static import(data, options?): Promise<VersionRegistry>;
```

Rebuilds a registry from exported data, verifying every snapshot's hash.
Throws [RegistryError](#registryerror) on the first integrity mismatch.

###### Parameters

###### data

[`ExportedRegistry`](#exportedregistry)

###### options?

###### sink?

[`RegistrySink`](#registrysink)

###### Returns

`Promise`\<[`VersionRegistry`](#versionregistry)\>

##### flush()

```ts
flush(): Promise<void>;
```

Waits until every queued mutation has been persisted.

###### Returns

`Promise`\<`void`\>

***

### RegistryError

A registry operation failed (unknown version, integrity break, bad publish).

#### Extends

- `BpmnError`

#### Constructors

##### Constructor

```ts
new RegistryError(message): RegistryError;
```

###### Parameters

###### message

`string`

###### Returns

[`RegistryError`](#registryerror)

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

### CallActivityResolution

The registry resolution of one callActivity node at a point in time.

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### calledElement?

```ts
optional calledElement?: string;
```

The called process id (`properties.calledElement`), if set.

##### entry?

```ts
optional entry?: RegistryEntry;
```

The called process' registered version in effect at `at`, if any.

***

### BindRunOptions

#### Properties

##### runId?

```ts
optional runId?: string;
```

Caller-supplied run id; a UUID is generated when omitted.

##### channel?

```ts
optional channel?: string;
```

Lane the run executes against (recorded for provenance).

##### environment?

```ts
optional environment?: string;
```

***

### PublicationTarget

A publication lane: a channel, optionally scoped to an environment.

#### Extended by

- [`Publication`](#publication)
- [`PublishOptions`](#publishoptions)

#### Properties

##### channel

```ts
channel: string;
```

Rollout audience, e.g. 'internal' | 'pilot' | 'general' (free-form).

##### environment?

```ts
optional environment?: string;
```

Deployment environment, e.g. 'dev' | 'test' | 'prod' (optional).

***

### Publication

A version's presence on one publication lane over a time window. A new
publication to the same lane closes the previous one (`effectiveUntil`),
so a lane always has at most one open publication.

#### Extends

- [`PublicationTarget`](#publicationtarget)

#### Properties

##### channel

```ts
channel: string;
```

Rollout audience, e.g. 'internal' | 'pilot' | 'general' (free-form).

###### Inherited from

[`PublicationTarget`](#publicationtarget).[`channel`](#channel-1)

##### environment?

```ts
optional environment?: string;
```

Deployment environment, e.g. 'dev' | 'test' | 'prod' (optional).

###### Inherited from

[`PublicationTarget`](#publicationtarget).[`environment`](#environment-1)

##### versionId

```ts
versionId: string;
```

##### status

```ts
status: VersionStatus;
```

Lifecycle status this version holds *on this lane* (may differ per lane).

##### effectiveFrom

```ts
effectiveFrom: string;
```

##### effectiveUntil?

```ts
optional effectiveUntil?: string;
```

##### publishedBy

```ts
publishedBy: string;
```

***

### RegistryEntry

One registered version: its immutable version entity, a content snapshot
with a matching hash, an optional technical changelog, and its
publications across lanes.

#### Properties

##### version

```ts
version: BpmnVersion;
```

##### snapshot

```ts
snapshot: BpmnDiagram;
```

Deep, immutable copy of the diagram content at registration.

##### snapshotHash

```ts
snapshotHash: string;
```

SHA-256 of the snapshot content (verified on import).

##### technicalNotes?

```ts
optional technicalNotes?: string;
```

Technical changelog tied to the diff (complements `version.changeSummary`).

##### registeredAt

```ts
registeredAt: string;
```

##### publications

```ts
publications: Publication[];
```

***

### RegistrySink

Optional external persistence for registry entries (database, API, file…).

#### Methods

##### write()

```ts
write(entry): void | Promise<void>;
```

###### Parameters

###### entry

[`RegistryEntry`](#registryentry)

###### Returns

`void` \| `Promise`\<`void`\>

***

### RegisterOptions

#### Properties

##### changeSummary?

```ts
optional changeSummary?: string;
```

Business-facing summary override; defaults to the version's changeSummary.

##### technicalNotes?

```ts
optional technicalNotes?: string;
```

Technical notes tied to the structural diff.

***

### PublishOptions

A publication lane: a channel, optionally scoped to an environment.

#### Extends

- [`PublicationTarget`](#publicationtarget)

#### Properties

##### channel

```ts
channel: string;
```

Rollout audience, e.g. 'internal' | 'pilot' | 'general' (free-form).

###### Inherited from

[`PublicationTarget`](#publicationtarget).[`channel`](#channel-1)

##### environment?

```ts
optional environment?: string;
```

Deployment environment, e.g. 'dev' | 'test' | 'prod' (optional).

###### Inherited from

[`PublicationTarget`](#publicationtarget).[`environment`](#environment-1)

##### status?

```ts
optional status?: VersionStatus;
```

Status this version takes on the lane. Default 'active'.

##### effectiveFrom?

```ts
optional effectiveFrom?: string;
```

ISO timestamp the publication takes effect. Default: now.

##### publishedBy?

```ts
optional publishedBy?: string;
```

***

### RunBinding

An immutable execution pin: the exact version an execution/delivery was
bound to. A run is born pinned; later version changes never mutate it —
this is a plain record the host stores alongside each run.

#### Properties

##### runId

```ts
runId: string;
```

##### versionId

```ts
versionId: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### snapshotHash

```ts
snapshotHash: string;
```

##### channel?

```ts
optional channel?: string;
```

##### environment?

```ts
optional environment?: string;
```

##### boundAt

```ts
boundAt: string;
```

***

### ExportedRegistry

#### Properties

##### entries

```ts
entries: RegistryEntry[];
```

## Type Aliases

### DateInput

```ts
type DateInput = Date | string;
```

## Functions

### resolveCallActivities()

```ts
function resolveCallActivities(
   diagram, 
   registry, 
   at, 
   target?): CallActivityResolution[];
```

Resolves every callActivity in `diagram` against the registry: entries
whose snapshot IS the called process (`snapshot.id === calledElement`),
narrowed to the version in effect at `at` — by publication window when a
lane `target` is given, otherwise by the version's own validity window
(`effectiveFrom`/`effectiveUntil`, latest wins on overlap). This is the
F7 registry synergy: a call activity binds to whatever version is active
when the caller runs, never to a hardcoded one.

#### Parameters

##### diagram

`BpmnDiagram`

##### registry

[`VersionRegistry`](#versionregistry)

##### at

[`DateInput`](#dateinput)

##### target?

[`PublicationTarget`](#publicationtarget)

#### Returns

[`CallActivityResolution`](#callactivityresolution)[]

***

### callActivityBindingRule()

```ts
function callActivityBindingRule(
   registry, 
   at?, 
   target?): ValidationRule;
```

Validation rule for broken call-activity references (Handoff 5 §3.2):
a callActivity whose `calledElement` is missing, unregistered, or has no
version in effect at `at` gets the stable code `CALL_REF_MISSING`
(error). Plug it into the editor as a plugin `validationRules` entry —
the canvas issue overlay paints the red stroke + badge + code.

#### Parameters

##### registry

[`VersionRegistry`](#versionregistry)

##### at?

[`DateInput`](#dateinput)

##### target?

[`PublicationTarget`](#publicationtarget)

#### Returns

`ValidationRule`

***

### bindRun()

```ts
function bindRun(entry, options?): RunBinding;
```

Pins an execution to an exact version — the "commit hash of the deploy"
applied to a process. Returns an immutable record the host stores against
each run/delivery.

A run is born pinned: the returned binding is a plain value derived from
the version's snapshot hash, so promoting or superseding the version later
never mutates a run already in flight. To move a run to a new version the
host must bind a *new* run.

#### Parameters

##### entry

[`RegistryEntry`](#registryentry)

##### options?

[`BindRunOptions`](#bindrunoptions) = `{}`

#### Returns

[`RunBinding`](#runbinding)

***

### verifyRunBinding()

```ts
function verifyRunBinding(binding, entry): boolean;
```

Confirms a run's binding still matches the version it claims — detects a
snapshot that was tampered with or a hash that drifted. Pure comparison;
does not mutate the run.

#### Parameters

##### binding

[`RunBinding`](#runbinding)

##### entry

[`RegistryEntry`](#registryentry)

#### Returns

`boolean`
