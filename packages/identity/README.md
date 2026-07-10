# @buildtovalue/identity

Headless **identity, signature and RBAC-verification** layer for BPMN governance
(Handoff 8): Ed25519 approval signatures over the canonical payload, offline
verification via WebCrypto, and role-requirement evaluation.

## The library never touches your keys (cerca §1.1 — nunca PKI)

**This library does not generate, store or manage keys.** There is no key
generation, no private-key storage, no key export anywhere in this package. A
`Signer` is always **implemented and injected by the host** (corporate SSO/IdP,
YubiKey, git key). Only the payload bytes cross the boundary into `sign()`; the
private key stays with the host. This package does exactly three things: **sign
via the injected handle, verify signatures, and evaluate role requirements.**
Key management — issuance, rotation, revocation, custody — is the host's
responsibility.

## RBAC is verification, not enforcement (cerca §1.2)

`evaluateRoleRequirement` answers *"does approval #y satisfy the roles this
promotion requires?"* — a statement any third party can re-check against the
signatures. It does **not** block actions: whoever controls the client can
ignore local rules. Enforcement belongs to the anchor and whoever hosts it.
(This is line 1 of `docs/limitations.md`.)

```ts
import {
  buildApprovalPayload,
  signApproval,
  verifySignature,
  evaluateRoleRequirement,
} from '@buildtovalue/identity';

// The host implements Signer — the private key never enters the library.
const payload = buildApprovalPayload({
  diagramId: 'onboarding',
  version: '2.1.0',
  xmlHash,        // SHA-256 of the canonical BPMN XML
  ledgerHead,     // the ledger head hash the approval binds to
  decision: 'approve',
  role: 'compliance',
});

const approval = await signApproval(hostSigner, payload, new Date().toISOString());

await verifySignature(approval, publicKey);          // 'valid' | 'invalid' — offline
evaluateRoleRequirement(['compliance', 'architecture'], [approval]); // { satisfied, missing }
```

## What a signature covers

The signature binds `diagramId + version + xmlHash + ledgerHead + decision +
role`, serialized deterministically with `canonicalJson` from `@buildtovalue/core`
(the same input as the attestation). Any later change to those fields makes
verification return `invalid` — with `expected × obtained` surfaced by the host UI.

## Three-state verification

- `valid` — signature verifies against the public key.
- `invalid` — payload altered or wrong key (detectable by any third party).
- `legacy` — no signature present (pre-Handoff-8 history). The lesser guarantee
  is **declared**, never signed retroactively (cerca §1.5).

## Decoupling

Consumes **only** `@buildtovalue/core` (`canonicalJson` + types) — pinned by
`tests/independence.test.ts`. Zero network, zero react, zero anchor code (anchor
adapters live in separate packages, injected by the host). **Zero runtime
dependencies** beyond the workspace core link.

> Runtime note: WebCrypto Ed25519 is stable in Node ≥ 20 and in recent browsers
> (Chrome 137+, Safari 17+). Older browsers need a host-provided verifier — see
> `docs/limitations.md`.
