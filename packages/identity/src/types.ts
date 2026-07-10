/**
 * Public contracts for `@buildtovalue/identity` (Handoff 8 §3). These interfaces
 * ARE the public API — pinned by `tests/apiSurface.test.ts`.
 *
 * Cerca §1.1 (nunca PKI): the library never generates, stores or manages keys.
 * A {@link Signer} is always implemented and injected by the HOST (SSO/IdP,
 * YubiKey, git key). The private key never enters this library; the host only
 * exposes a `sign(payload)` handle. This package signs via that handle,
 * verifies signatures and evaluates role requirements — nothing else.
 */

/** Identity the host asserts for a signer. Carried inside every signature. */
export interface SignerIdentity {
  /** Stable subject (e.g. corporate e-mail, SSO subject). */
  subject: string;
  /** Role the subject signs as (e.g. "compliance"). Verified, not enforced. */
  role: string;
  /** Fingerprint of the public key, e.g. "ed25519:SHA256:kX9v…3mQt". */
  publicKeyFingerprint: string;
}

/**
 * Host-implemented signing handle. The private key stays with the host — only
 * `sign` crosses the boundary, and only the payload bytes go in.
 */
export interface Signer {
  identity: SignerIdentity;
  /** Sign the canonical payload bytes; returns a raw Ed25519 signature. */
  sign(payload: Uint8Array): Promise<Uint8Array>;
}

/**
 * What an approval signature covers. Deterministically serialized via
 * `canonicalJson` (same input as the attestation — Handoff 8 §3). Any later
 * change to `xmlHash`, `ledgerHead`, `decision` or `role` invalidates the
 * signature on verification.
 */
export interface CanonicalApprovalPayload {
  diagramId: string;
  /** Semantic version of the approved artifact, e.g. "2.1.0". */
  version: string;
  /** SHA-256 of the canonical BPMN XML at approval time. */
  xmlHash: string;
  /** Ledger head hash the approval is bound to. */
  ledgerHead: string;
  /** The governance decision, e.g. "approve" | "reject". */
  decision: string;
  /** The role asserted for this approval (mirrors the signer identity). */
  role: string;
}

/** A signed approval: the covered payload plus the detached Ed25519 signature. */
export interface SignedApproval {
  payload: CanonicalApprovalPayload;
  /** Ed25519 signature over `encodePayload(payload)`, base64. */
  signature: string;
  /** Identity the host asserted for the signer (no private key material). */
  signer: SignerIdentity;
  /** ISO-8601 timestamp the host stamped at signing time. */
  signedAt: string;
}

/**
 * Verification outcome for an approval's identity claim.
 * - `valid`   — signature verifies against the given public key.
 * - `invalid` — payload altered or wrong key (cerca §1: detectable by any third party).
 * - `legacy`  — no signature present (pre-Handoff-8 history; cerca §1.5 — the
 *   lesser guarantee is declared, never signed retroactively).
 */
export type VerificationState = 'valid' | 'invalid' | 'legacy';

/**
 * Result of {@link evaluateRoleRequirement}. `satisfied` is true when every
 * required role has at least one valid-shaped approval. Cerca §1.2: this is
 * VERIFICATION, not enforcement — it reports what is missing; it does not block.
 */
export interface RoleRequirementResult {
  satisfied: boolean;
  /** Required roles with no matching approval (empty when satisfied). */
  missing: string[];
}

/**
 * Derived state of the external anchor for the chain head (Handoff 8 §3).
 * - `anchored`  — head matches an external anchor receipt.
 * - `pending`   — signed but anchoring failed; retrying, does NOT regress (§1.3).
 * - `none`      — no anchor adapter configured; never simulate external proof (§1.4).
 * - `broken`    — local head ≠ anchored head (chain regenerated after anchoring).
 */
export type AnchorState = 'anchored' | 'pending' | 'none' | 'broken';

/** The chain head an anchor binds: the newest ledger entry's hash + seq. */
export interface AnchorHead {
  hash: string;
  seq: number;
}

/**
 * Proof returned by an {@link AnchorAdapter} after anchoring a chain head. It
 * is host-persisted (e.g. in a ledger entry `details`) and later re-verified.
 */
export interface AnchorReceipt {
  /** Adapter that produced it ("git", "rfc3161", "s3"). */
  adapterId: string;
  /** The head that was anchored. */
  head: AnchorHead;
  /** Opaque proof the adapter can verify later (commit hash, TSA token, object key…). */
  proof: string;
  /** ISO-8601 time the anchor was produced. */
  anchoredAt: string;
}

/**
 * External anchor for the chain head (Handoff 8 §3). Implemented by the adapter
 * packages (anchor-git/rfc3161/s3), each with a host-injected transport —
 * `identity` never does network. `verify` returns the raw comparison; the
 * derived UI state comes from {@link deriveAnchorState}.
 */
export interface AnchorAdapter {
  id: string;
  anchor(head: AnchorHead): Promise<AnchorReceipt>;
  verify(receipt: AnchorReceipt, head: string): Promise<'anchored' | 'mismatch' | 'unavailable'>;
}
