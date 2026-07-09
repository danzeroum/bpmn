# @bpmn-react/anchor-rfc3161

RFC 3161 **timestamp anchor adapter** (Handoff 8): anchors the ledger chain head
to a TSA timestamp token, implementing the `AnchorAdapter` contract from
`@bpmn-react/identity`.

## The host owns the TSA transport (no network in the library)

You inject `timestamp`/`verifyToken`; the library never calls the TSA. This keeps
the package network- and dependency-free and lets the host use its own TSA,
credentials and validation policy.

```ts
import { createRfc3161Anchor } from '@bpmn-react/anchor-rfc3161';

const anchor = createRfc3161Anchor({
  async timestamp(digest) {
    return host.requestTsaToken(digest); // { token, genTime }
  },
  async verifyToken(token, digest) {
    return host.validateTsaToken(token, digest); // boolean
  },
});

const receipt = await anchor.anchor({ hash: head.hash, seq: head.seq });
await anchor.verify(receipt, currentHashAtSeq); // 'anchored' | 'mismatch' | 'unavailable'
```

Derive the UI state from the result via `deriveAnchorState` in
`@bpmn-react/identity`. Consumes only `@bpmn-react/identity` — pinned by
`tests/independence.test.ts`. **Zero runtime dependencies.**
