# Versioning & governance

Every diagram carries a `BpmnVersion` with a semantic version and a lifecycle status:

```
draft → test → candidate → active → deprecated → retired
          ↘ draft   ↘ test
```

- **draft** — freely editable; removals are hard deletes.
- **test / candidate** — editable, but removals *close* elements (`removedInVersion`) instead of
  deleting them; candidates can be demoted back to test, tests back to draft.
- **active** — immutable. The built-in rule vetoes every command. Any change requires
  `createDraftFrom()` (clone → new draft → promote again).
- **deprecated → retired** — terminal wind-down. **Direct `deprecated → active` reactivation is
  deliberately not allowed**: reactivating without a new version would create ambiguity in the
  audit trail. Restore by cloning to a draft and promoting it.

## Promotion requirements (defaults)

Promotion to `active` requires:

1. approvals from at least **2 distinct roles** (`minApprovalRoles`),
2. a change summary of at least **20 characters**,
3. optionally an attached diff (`requireDiff: true`).

```ts
import { LifecycleEngine } from '@buildtovalue/core';

const engine = new LifecycleEngine(); // or new LifecycleEngine({ minApprovalRoles: 3, ... })

let d = engine.approve(diagram, { id: 'u1', role: 'owner' }, 'lgtm');
d = engine.approve(d, { id: 'u2', role: 'compliance' }, 'compliant');
d = await engine.promote({
  diagram: d,
  target: 'active',
  actor: { id: 'u3', role: 'operations' },
  reason: 'Approved for production rollout.',
});
```

Each accepted promotion creates a **new immutable version entity** chained via `parentVersionId`,
with a fresh SHA-256 `snapshotHash` of the content. The library is agnostic about authentication —
you supply `UserContext` records; it validates and records them.

### Recipe: require a mandatory notice before a change goes active

A common governance rule is "a major change must be announced before it takes effect." There's no
special API for this — a `promotionRule` gates it, and the same hook is where you'd trigger the
notification (email, webhook, Slack). Rules run before the transition is accepted, so a missing
acknowledgement blocks the promotion:

```ts
const engine = new LifecycleEngine({
  promotionRules: [
    async ({ diagram, target }) => {
      if (target !== 'active') return { allowed: true };
      const isMajor = diagram.version.semanticVersion.endsWith('.0.0');
      if (isMajor && !diagram.metadata.changeAnnouncedAt) {
        return { allowed: false, reason: 'Major version requires a change announcement before activation' };
      }
      await notifyStakeholders(diagram); // side effect: send the notice
      return { allowed: true };
    },
  ],
});
```

Rules are plain functions and may be `async`, so they compose validation and side effects without
the core needing to know what "notify" means for your organization.

## Temporal immutability of elements

Outside `draft`, removing a node/edge sets `removedInVersion` (rendering it dashed/faded) instead
of deleting it. Replacing an edge uses `supersedeEdgeCommand(oldId, replacement)`, which closes the
old edge and links the new one via `supersedesEdgeId` in a single undo step.
`getEdgeChain(diagram, edgeId)` returns the full substitution chain, oldest first.

## Audit ledger

```ts
import { AuditLedger } from '@buildtovalue/core';

const ledger = new AuditLedger({ sink: myDatabaseSink }); // sink optional
const off = ledger.connectCommandStack(stack, { id: 'alice', role: 'editor' });

await ledger.flush();
const { valid, brokenAt } = await ledger.verify(); // recomputes the whole hash chain
```

Every entry hashes the previous entry's hash — retroactive tampering breaks the chain at the exact
entry. `export()`/`AuditLedger.import()` round-trip the ledger through external storage and refuse
to import a chain that does not verify.

## Querying versions over time

The lifecycle governs *transitions*; to ask temporal and rollout questions — "which version was in
effect on day X?", "what's live on the pilot channel?", "which version produced this delivery?" —
use [`@buildtovalue/registry`](registry.md), the queryable governance layer built on top of the
lifecycle.
