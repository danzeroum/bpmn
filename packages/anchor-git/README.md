# @buildtovalue/anchor-git

Git **anchor adapter** for BPMN governance (Handoff 8): anchors the ledger chain
head to a commit and verifies it later, implementing the `AnchorAdapter` contract
from `@buildtovalue/identity`.

## The host owns the transport (no network in the library)

Like signing keys, the git transport is **injected by the host** — the library
never shells out to `git` nor does network. You provide `commit`/`read`; the
adapter provides the anchor/verify semantics.

```ts
import { createGitAnchor } from '@buildtovalue/anchor-git';

const anchor = createGitAnchor({
  async commit(payload) {
    // e.g. write payload to a signed commit on an `anchors` ref
    return { ref: await host.commitToAnchorsRef(payload) };
  },
  async read(ref) {
    return host.readAnchorsRef(ref); // undefined when unreachable
  },
});

const receipt = await anchor.anchor({ hash: head.hash, seq: head.seq });
// later, against the current hash of the entry at receipt.head.seq:
await anchor.verify(receipt, currentHashAtSeq); // 'anchored' | 'mismatch' | 'unavailable'
```

## States (cercas §1.3 / §1.4)

- `unavailable` → the store is unreachable; the UI shows **⏳ pendente** (the third
  state) — the promotion does NOT regress, retry is offered.
- `anchored` → the stored head still matches the current chain head.
- `mismatch` → the chain was regenerated after anchoring (**cadeia ≠ âncora**) —
  the case a local hash-chain alone never detects.

Derive the UI state from these via `deriveAnchorState` in `@buildtovalue/identity`.

## Decoupling

Consumes only `@buildtovalue/identity` (the contracts) — pinned by
`tests/independence.test.ts`. **Zero runtime dependencies.**
