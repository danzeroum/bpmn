# @bpmn-react/anchor-s3

S3 **object-lock anchor adapter** (Handoff 8): anchors the ledger chain head to a
write-once object, implementing the `AnchorAdapter` contract from
`@bpmn-react/identity`.

## The host owns the S3 client (no network in the library)

You inject `put`/`get`; the library never talks to S3. Point `put` at an
object-lock (WORM) bucket so anchors are immutable.

```ts
import { createS3Anchor } from '@bpmn-react/anchor-s3';

const anchor = createS3Anchor({
  async put(key, body) {
    return host.s3PutObject(key, body); // { versionId? }
  },
  async get(key) {
    return host.s3GetObject(key); // undefined when unreachable
  },
});

const receipt = await anchor.anchor({ hash: head.hash, seq: head.seq });
await anchor.verify(receipt, currentHashAtSeq); // 'anchored' | 'mismatch' | 'unavailable'
```

Derive the UI state from the result via `deriveAnchorState` in
`@bpmn-react/identity`. Consumes only `@bpmn-react/identity` — pinned by
`tests/independence.test.ts`. **Zero runtime dependencies.**
