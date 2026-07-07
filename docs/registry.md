# Version governance — `@bpmn-react/registry`

The core [`LifecycleEngine`](versioning.md) enforces *how* a version transitions and what it takes
to reach `active`. The registry is the **queryable governance layer on top**: it records the
immutable versions the lifecycle produces, tracks their rollout across channels/environments, and
answers temporal audit questions. It never replaces the lifecycle — promote/approve still happen
there.

## Registering versions

```ts
import { VersionRegistry } from '@bpmn-react/registry';

const registry = new VersionRegistry();
await registry.register(diagram, {
  changeSummary: 'Adds the compliance gate',   // business changelog (overrides the version's)
  technicalNotes: 'New inclusiveGateway "gate-2"; edge e7 superseded by e9', // tied to the diff
});
```

`register` captures a **deep, content-hashed snapshot** of the diagram. Re-registering the same
version id is rejected — versions are immutable. If the version already carries a `snapshotHash`, it
must match the content or registration fails (drift detection).

The **dual changelog** is deliberate: `changeSummary` is written for stakeholders; `technicalNotes`
is written for auditors and is meant to accompany the structured diff (`diffBetween`).

## Temporal validity — "which version was in effect on day X?"

Two timelines answer this, depending on whether you ask about a channel:

```ts
// Lifecycle validity window (version.effectiveFrom / effectiveUntil, set on promotion):
registry.activeAt('2026-03-15');

// A specific rollout lane:
registry.activeAt('2026-03-15', { channel: 'pilot' });
registry.activeAt('2026-03-15', { channel: 'general', environment: 'prod' });
```

`effectiveFrom` is inclusive, `effectiveUntil` exclusive. Dates accept ISO strings or `Date`.

## Channels & environments — gradual rollout without a loose flag

A **lane** is a channel, optionally scoped to an environment. Publishing to a lane closes its
previously open publication, so a lane always has exactly one live version:

```ts
await registry.publish('v2', { channel: 'general', status: 'active',    effectiveFrom: '2026-06-01' });
await registry.publish('v3', { channel: 'pilot',   status: 'active',    effectiveFrom: '2026-06-15' });
await registry.publish('v3', { channel: 'general', status: 'candidate', effectiveFrom: '2026-07-01' });
```

Channels are independent, so the same version can hold different statuses on different lanes
(`active` on pilot, `candidate` on general). Inspect a lane's history with
`channelTimeline(channel, environment?)` or the covering publication with
`publicationAt(date, target)`.

## Diff & lineage

```ts
registry.diffBetween('v1', 'v2'); // structured BpmnDiff over the two snapshots (add/remove/update/supersede)
registry.history();               // all entries, chronological by version.createdAt
registry.lineageOf('v3');         // ancestor chain via parentVersionId, oldest → newest
registry.snapshotOf('v2');        // deep copy of the content to run
```

## Execution pinning — `bindRun`

The "commit hash of the deploy" applied to a process. Each execution/delivery is bound to the exact
version that produced it:

```ts
import { bindRun, verifyRunBinding } from '@bpmn-react/registry';

const run = bindRun(registry.get('v2')!, { channel: 'general', environment: 'prod' });
// { runId, versionId, semanticVersion, snapshotHash, channel, environment, boundAt } — frozen

// Later, prove the run still matches the version it claims:
verifyRunBinding(run, registry.get(run.versionId)!); // true unless the snapshot drifted
```

A run is **born pinned**: the binding is a plain frozen value, so promoting or superseding the
version afterwards never mutates a run in flight. To move a run to a new version, the host binds a
*new* run.

## Integrity & persistence

- `export()` → `{ entries }`; `VersionRegistry.import(data)` verifies every snapshot's hash and
  refuses a tampered chain.
- Pass a `RegistrySink` to persist each registered/published entry to a database or API — the
  registry stays in memory and the sink is your durable store, mirroring `AuditLedger`'s sink.

## Where this sits

The registry is **domain-agnostic**: it knows nothing about the host's vocabulary. A product layers
its own node types (via a plugin) and its own UI (a version timeline, approval screens) on top —
the registry just answers the governance questions.
