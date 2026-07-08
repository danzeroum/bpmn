# @bpmn-react/audit

Demonstrable integrity for bpmn-react governance. Zero runtime dependencies;
consumes `@bpmn-react/core` and `@bpmn-react/registry` (read-only).

```ts
import { verifyLedger, attestVersion, attestationHash } from '@bpmn-react/audit';

// Re-verify a hash-chained ledger — live object or exported ledger.json:
const report = await verifyLedger(ledger);
// { intact, entries, firstBreak?: { index, expected, actual }, verifiedAt }

// Signable snapshot of a promotion (canonical JSON, hash-addressable):
const attestation = await attestVersion(registry, diagramId, versionId, { ledger });
const id = await attestationHash(attestation);
```

- `verifyLedger` recomputes every hash with the exact recipe the core ledger
  signed (`computeEntryHash`), pointing at the first broken entry — integrity
  stops being assumed and becomes checkable on demand (third-party CI:
  `bpmn-react audit ledger.json`).
- `attestVersion` captures `{ xmlHash, ledgerHeadHash, version, status,
  effectiveFrom, approvers, attestedAt }`. Hash-based only — no asymmetric
  signatures/PKI by design (Handoff 4 §3); if a host needs signing, it signs
  the canonical bytes.
- XES export for process mining lands with PR-B2.
