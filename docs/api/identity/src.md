# identity/src

## Interfaces

### SignerIdentity

Identity the host asserts for a signer. Carried inside every signature.

#### Properties

##### subject

```ts
subject: string;
```

Stable subject (e.g. corporate e-mail, SSO subject).

##### role

```ts
role: string;
```

Role the subject signs as (e.g. "compliance"). Verified, not enforced.

##### publicKeyFingerprint

```ts
publicKeyFingerprint: string;
```

Fingerprint of the public key, e.g. "ed25519:SHA256:kX9v…3mQt".

***

### Signer

Host-implemented signing handle. The private key stays with the host — only
`sign` crosses the boundary, and only the payload bytes go in.

#### Properties

##### identity

```ts
identity: SignerIdentity;
```

#### Methods

##### sign()

```ts
sign(payload): Promise<Uint8Array<ArrayBufferLike>>;
```

Sign the canonical payload bytes; returns a raw Ed25519 signature.

###### Parameters

###### payload

`Uint8Array`

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### CanonicalApprovalPayload

What an approval signature covers. Deterministically serialized via
`canonicalJson` (same input as the attestation — Handoff 8 §3). Any later
change to `xmlHash`, `ledgerHead`, `decision` or `role` invalidates the
signature on verification.

#### Properties

##### diagramId

```ts
diagramId: string;
```

##### version

```ts
version: string;
```

Semantic version of the approved artifact, e.g. "2.1.0".

##### xmlHash

```ts
xmlHash: string;
```

SHA-256 of the canonical BPMN XML at approval time.

##### ledgerHead

```ts
ledgerHead: string;
```

Ledger head hash the approval is bound to.

##### decision

```ts
decision: string;
```

The governance decision, e.g. "approve" | "reject".

##### role

```ts
role: string;
```

The role asserted for this approval (mirrors the signer identity).

***

### SignedApproval

A signed approval: the covered payload plus the detached Ed25519 signature.

#### Properties

##### payload

```ts
payload: CanonicalApprovalPayload;
```

##### signature

```ts
signature: string;
```

Ed25519 signature over `encodePayload(payload)`, base64.

##### signer

```ts
signer: SignerIdentity;
```

Identity the host asserted for the signer (no private key material).

##### signedAt

```ts
signedAt: string;
```

ISO-8601 timestamp the host stamped at signing time.

***

### RoleRequirementResult

Result of [evaluateRoleRequirement](#evaluaterolerequirement). `satisfied` is true when every
required role has at least one valid-shaped approval. Cerca §1.2: this is
VERIFICATION, not enforcement — it reports what is missing; it does not block.

#### Properties

##### satisfied

```ts
satisfied: boolean;
```

##### missing

```ts
missing: string[];
```

Required roles with no matching approval (empty when satisfied).

***

### AnchorHead

The chain head an anchor binds: the newest ledger entry's hash + seq.

#### Properties

##### hash

```ts
hash: string;
```

##### seq

```ts
seq: number;
```

***

### AnchorReceipt

Proof returned by an [AnchorAdapter](#anchoradapter) after anchoring a chain head. It
is host-persisted (e.g. in a ledger entry `details`) and later re-verified.

#### Properties

##### adapterId

```ts
adapterId: string;
```

Adapter that produced it ("git", "rfc3161", "s3").

##### head

```ts
head: AnchorHead;
```

The head that was anchored.

##### proof

```ts
proof: string;
```

Opaque proof the adapter can verify later (commit hash, TSA token, object key…).

##### anchoredAt

```ts
anchoredAt: string;
```

ISO-8601 time the anchor was produced.

***

### AnchorAdapter

External anchor for the chain head (Handoff 8 §3). Implemented by the adapter
packages (anchor-git/rfc3161/s3), each with a host-injected transport —
`identity` never does network. `verify` returns the raw comparison; the
derived UI state comes from [deriveAnchorState](#deriveanchorstate).

#### Properties

##### id

```ts
id: string;
```

#### Methods

##### anchor()

```ts
anchor(head): Promise<AnchorReceipt>;
```

###### Parameters

###### head

[`AnchorHead`](#anchorhead)

###### Returns

`Promise`\<[`AnchorReceipt`](#anchorreceipt)\>

##### verify()

```ts
verify(receipt, head): Promise<"anchored" | "mismatch" | "unavailable">;
```

###### Parameters

###### receipt

[`AnchorReceipt`](#anchorreceipt)

###### head

`string`

###### Returns

`Promise`\<`"anchored"` \| `"mismatch"` \| `"unavailable"`\>

## Type Aliases

### VerificationState

```ts
type VerificationState = "valid" | "invalid" | "legacy";
```

Verification outcome for an approval's identity claim.
- `valid`   — signature verifies against the given public key.
- `invalid` — payload altered or wrong key (cerca §1: detectable by any third party).
- `legacy`  — no signature present (pre-Handoff-8 history; cerca §1.5 — the
  lesser guarantee is declared, never signed retroactively).

***

### AnchorState

```ts
type AnchorState = "anchored" | "pending" | "none" | "broken";
```

Derived state of the external anchor for the chain head (Handoff 8 §3).
- `anchored`  — head matches an external anchor receipt.
- `pending`   — signed but anchoring failed; retrying, does NOT regress (§1.3).
- `none`      — no anchor adapter configured; never simulate external proof (§1.4).
- `broken`    — local head ≠ anchored head (chain regenerated after anchoring).

## Functions

### deriveAnchorState()

```ts
function deriveAnchorState(input): AnchorState;
```

Derive the UI anchor state (Handoff 8 §3, cercas §1.3/§1.4) from whether an
adapter is configured and the raw `verify` outcome. Pure and deterministic.

- no adapter → `none` (never simulate external proof — §1.4).
- `anchored` → `anchored`.
- `mismatch` → `broken` (local head ≠ anchored head — the case hash-chain
  alone never detects).
- `unavailable` / not yet anchored → `pending`, the third state: the promotion
  does NOT regress; the seal declares the guarantee in force (§1.3).

#### Parameters

##### input

###### hasAdapter

`boolean`

###### verification?

`"anchored"` \| `"mismatch"` \| `"unavailable"`

#### Returns

[`AnchorState`](#anchorstate)

***

### toBase64()

```ts
function toBase64(bytes): string;
```

Encode raw bytes as a standard base64 string.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`string`

***

### fromBase64()

```ts
function fromBase64(base64): Uint8Array;
```

Decode a standard base64 string back to raw bytes.

#### Parameters

##### base64

`string`

#### Returns

`Uint8Array`

***

### buildApprovalPayload()

```ts
function buildApprovalPayload(input): CanonicalApprovalPayload;
```

Build the canonical payload an approval signature covers (Handoff 8 §3). The
signature binds `xmlHash + ledgerHead + decision + role` (plus the artifact
identity), so any later mutation of those is detectable on verification.

#### Parameters

##### input

[`CanonicalApprovalPayload`](#canonicalapprovalpayload)

#### Returns

[`CanonicalApprovalPayload`](#canonicalapprovalpayload)

***

### encodePayload()

```ts
function encodePayload(payload): Uint8Array;
```

Deterministic bytes for signing/verification. Uses `canonicalJsonExact`
(key ordering never changes the bytes; numbers are never rounded), then
UTF-8 encodes. Signer.sign and verifySignature both operate on exactly
these bytes. All payload fields are strings, so the bytes are identical to
the ones the previous `canonicalJson` produced — existing signatures keep
verifying.

#### Parameters

##### payload

[`CanonicalApprovalPayload`](#canonicalapprovalpayload)

#### Returns

`Uint8Array`

***

### evaluateRoleRequirement()

```ts
function evaluateRoleRequirement(requiredRoles, approvals): RoleRequirementResult;
```

Evaluate a role requirement against a set of approvals (Handoff 8 §3).

Cerca §1.2 — this is VERIFICATION, not enforcement. It reports whether every
required role has a matching approval and which roles are still missing; it
does NOT block any action. Enforcement is the anchor's and the host's
responsibility (documented as line 1 of `limitations.md`).

Pure and deterministic: matches on the role asserted inside each signed
payload (`approval.payload.role`), which is the field the signature covers.
`missing` preserves the order of `requiredRoles` and is de-duplicated.

#### Parameters

##### requiredRoles

readonly `string`[]

##### approvals

readonly [`SignedApproval`](#signedapproval)[]

#### Returns

[`RoleRequirementResult`](#rolerequirementresult)

***

### signApproval()

```ts
function signApproval(
   signer, 
   payload, 
signedAt): Promise<SignedApproval>;
```

Sign an approval payload using a host-injected [Signer](#signer) (cerca §1.1 —
the private key never enters this library; only the payload bytes cross the
`sign` boundary). `signedAt` is passed in rather than read from the clock so
signing is deterministic and testable.

#### Parameters

##### signer

[`Signer`](#signer)

##### payload

[`CanonicalApprovalPayload`](#canonicalapprovalpayload)

##### signedAt

`string`

#### Returns

`Promise`\<[`SignedApproval`](#signedapproval)\>

***

### verifySignature()

```ts
function verifySignature(approval, publicKey): Promise<"valid" | "invalid">;
```

Verify an approval's Ed25519 signature against a raw 32-byte public key, via
WebCrypto (`crypto.subtle`). Runs entirely OFFLINE — no network — so a third
party can verify with only the public key (Handoff 8 §6.1).

Returns `invalid` (never throws) when the payload was altered, the wrong key
was supplied, or the key/signature is malformed — the negative path is a
first-class result, not an exception.

#### Parameters

##### approval

[`SignedApproval`](#signedapproval)

##### publicKey

`Uint8Array`

#### Returns

`Promise`\<`"valid"` \| `"invalid"`\>

***

### isLegacyApproval()

```ts
function isLegacyApproval(approval): boolean;
```

True when an approval carries no signature — pre-Handoff-8 history. Cerca
§1.5: legacy entries declare the lesser guarantee ("não assinada · legado");
they are never signed retroactively.

#### Parameters

##### approval

[`SignedApproval`](#signedapproval) \| `null` \| `undefined`

#### Returns

`boolean`

***

### verificationState()

```ts
function verificationState(approval, publicKey): Promise<VerificationState>;
```

Resolve the three-state verification outcome (Handoff 8 §4.1). Returns
`legacy` for unsigned/absent approvals (cerca §1.5); otherwise delegates to
[verifySignature](#verifysignature). A signed approval with no public key available
cannot be proven and reads as `invalid`, never silently trusted.

#### Parameters

##### approval

[`SignedApproval`](#signedapproval) \| `null` \| `undefined`

##### publicKey

`Uint8Array`\<`ArrayBufferLike`\> \| `null` \| `undefined`

#### Returns

`Promise`\<[`VerificationState`](#verificationstate)\>
