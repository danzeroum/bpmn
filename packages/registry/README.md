# @bpmn-react/registry

Headless **version governance** for bpmn-react — the queryable layer over the core lifecycle.
Zero runtime dependencies (depends only on `@bpmn-react/core`).

The core `LifecycleEngine` governs *how* a version moves through
`draft → test → candidate → active → deprecated → retired`. This package records the resulting
immutable versions and answers the audit questions the lifecycle alone can't:

- **"Which version was in effect on day X?"** — temporal validity via `activeAt(date)`.
- **"What changed between v1 and v2?"** — `diffBetween(v1, v2)` over stored snapshots.
- **"What's live on the pilot channel right now?"** — publication channels/environments.
- **"Which exact version produced this delivery?"** — execution pinning (`bindRun`).

```ts
import { VersionRegistry, bindRun } from '@bpmn-react/registry';

const registry = new VersionRegistry({ sink: myDatabaseSink }); // sink optional

// Record a promoted version (snapshot + content hash captured automatically)
await registry.register(diagram, { technicalNotes: 'Reworked the approval gate' });

// Roll out gradually — a version can be active on pilot while another is on general
await registry.publish(diagram.version.id, { channel: 'pilot', status: 'active' });

// Query
registry.activeAt('2026-06-01', { channel: 'pilot' }); // entry in effect then
registry.diffBetween('v1', 'v2');                       // structured diff
registry.lineageOf('v3');                               // ancestor chain, oldest → newest

// Pin an execution to the exact version that produced it
const run = bindRun(registry.get(diagram.version.id)!, { channel: 'pilot' });
// run = { runId, versionId, semanticVersion, snapshotHash, channel, boundAt } — frozen
```

## Guarantees

- **Snapshots are content-hashed.** `register` stores a deep copy plus its SHA-256; `export`/
  `import` round-trip through external storage and `import` refuses a tampered snapshot.
- **Lanes have one live version.** Publishing to a lane (channel + optional environment) closes the
  previous open publication, so `activeAt` is unambiguous.
- **Runs are born pinned.** A `RunBinding` is a frozen value derived from the snapshot hash —
  promoting or superseding the version later never mutates a run already in flight.

See [docs/registry.md](../../docs/registry.md) for the full guide. License: Apache-2.0.
