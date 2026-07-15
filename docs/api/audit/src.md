# audit/src

## Interfaces

### AssuranceEvidence

One SACM evidence element — always a hash-bearing derived record.

#### Properties

##### id

```ts
id: string;
```

##### hash

```ts
hash: string;
```

Content hash: the ledger entry hash, or the canonical approval hash.

##### kind

```ts
kind: string;
```

Derived caption (entry type / approval role) — never free text.

##### at

```ts
at: string;
```

##### actor

```ts
actor: string;
```

***

### AssuranceArgument

One SACM argument (A1, A2, …) grouping the evidence that supports it.

#### Properties

##### id

```ts
id: string;
```

##### statement

```ts
statement: string;
```

##### evidence

```ts
evidence: AssuranceEvidence[];
```

***

### AssuranceClaim

One SACM claim; unsupported claims render "não sustentado" (10.5.8).

#### Properties

##### id

```ts
id: string;
```

##### statement

```ts
statement: string;
```

##### argumentId

```ts
argumentId: string;
```

##### supported

```ts
supported: boolean;
```

***

### AssuranceCase

#### Properties

##### spec

```ts
spec: string;
```

Header spec label — parameterized (§11.4).

##### diagramId

```ts
diagramId: string;
```

##### diagramName

```ts
diagramName: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### status

```ts
status: string;
```

##### claims

```ts
claims: AssuranceClaim[];
```

##### arguments

```ts
arguments: AssuranceArgument[];
```

##### approvers

```ts
approvers: ApprovalRecord[];
```

##### signedApprovers

```ts
signedApprovers: SignedApproverInfo[];
```

Approvers with their signature verification state (Handoff 8 §4.1).

##### anchor?

```ts
optional anchor?: AssuranceAnchor;
```

External-anchor line, when the host passes one (Handoff 8 §4.2).

##### verification

```ts
verification: VerificationReport;
```

SHA-256 chain verification — RUNS at generation time (10.5.8).

##### ledgerHeadHash

```ts
ledgerHeadHash: string;
```

Hash of the chain head ('' when the ledger is empty).

##### generatedAt

```ts
generatedAt: string;
```

***

### AssuranceCaseOptions

#### Properties

##### specVersion?

```ts
optional specVersion?: string;
```

##### generatedAt?

```ts
optional generatedAt?: string;
```

Timestamp override for deterministic output (tests, reproducible CI).

##### resolvePublicKey?

```ts
optional resolvePublicKey?: PublicKeyResolver;
```

Resolves signer public keys so recorded signatures are re-verified in the
report (Handoff 8 §4.1). Omitted → signatures are not verified and approvers
read as "não assinada (legado)".

##### anchor?

```ts
optional anchor?: AssuranceAnchor;
```

External-anchor state to declare in the footer (Handoff 8 §4.2).

***

### Attestation

A signable snapshot of the moment a version was promoted (Handoff 4 §B1):
everything an auditor needs to prove WHAT was active, SINCE WHEN and WHO
approved it — content-addressed (xmlHash), anchored to the audit chain
(ledgerHeadHash) and serialized canonically so the same input always
yields the same bytes/hash. Hash-based attestation only — asymmetric
signatures (PKI) are deliberately out of scope (§3 do handoff).

#### Properties

##### diagramId

```ts
diagramId: string;
```

##### versionId

```ts
versionId: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

##### xmlHash

```ts
xmlHash: string;
```

SHA-256 of the canonical BPMN XML export of the registered snapshot.

##### ledgerHeadHash

```ts
ledgerHeadHash: string;
```

Hash of the ledger's newest entry at attestation time ('' when empty).

##### status

```ts
status: string;
```

##### effectiveFrom?

```ts
optional effectiveFrom?: string;
```

##### approvers

```ts
approvers: ApprovalRecord[];
```

##### attestedAt

```ts
attestedAt: string;
```

***

### AttestOptions

#### Properties

##### ledger?

```ts
optional ledger?: LedgerLike;
```

Ledger whose head anchors the attestation (omit → '').

##### attestedAt?

```ts
optional attestedAt?: string;
```

Timestamp override — pass a fixed value for deterministic output.

***

### SignedApprovalVerification

#### Properties

##### approval

```ts
approval: SignedApproval;
```

##### state

```ts
state: VerificationState;
```

***

### LedgerSignatureReport

#### Properties

##### total

```ts
total: number;
```

##### valid

```ts
valid: number;
```

##### invalid

```ts
invalid: number;
```

##### results

```ts
results: SignedApprovalVerification[];
```

***

### SignatureGateOptions

#### Properties

##### ledger

```ts
ledger: LedgerLike;
```

##### resolvePublicKey

```ts
resolvePublicKey: PublicKeyResolver;
```

##### requiredRoles?

```ts
optional requiredRoles?: string[];
```

Roles that must carry a valid signature. Defaults to the version's distinct
approver roles — so the gate says "the roles that approved must have signed".

##### locale?

```ts
optional locale?: "en" | "pt";
```

***

### VerificationReport

Full re-verification of a hash-chained audit ledger (Handoff 4 §B1).
`AuditLedger.verify()` answers valid/invalid for the live object; this
report makes integrity DEMONSTRABLE on demand — for exported ledgers,
third-party CI, and the react popover — including the exact break point
with the expected vs. found hash.

#### Properties

##### intact

```ts
intact: boolean;
```

##### entries

```ts
entries: number;
```

Total entries examined.

##### firstBreak?

```ts
optional firstBreak?: object;
```

First broken entry, when the chain does not verify.

###### index

```ts
index: number;
```

###### expected

```ts
expected: string;
```

###### actual

```ts
actual: string;
```

##### verifiedAt

```ts
verifiedAt: string;
```

ISO timestamp of this verification run.

***

### XesOptions

XES 2.0 export (Handoff 4 §B2): the governance history becomes an IEEE
1849-2016 event log so the REAL design process can be mined against the
documented one in any process-mining tool (ProM, Celonis, Disco).

Mapping: each VERSION is a trace (`concept:name` = versionId); ledger
entries — commands, promotions, attestations — are events with
`concept:name` (type), `time:timestamp`, `org:resource` (author) and
`lifecycle:transition` = complete. With a registry, registrations and
publications join the same traces.

#### Properties

##### logName?

```ts
optional logName?: string;
```

`concept:name` of the log. Default 'bpmn-react governance log'.

##### registry?

```ts
optional registry?: VersionRegistry;
```

Merges registry events (registration, publications) into the traces.

## Type Aliases

### PublicKeyResolver

```ts
type PublicKeyResolver = (fingerprint) => Uint8Array | Promise<Uint8Array | undefined> | undefined;
```

Resolves a public key for a signer fingerprint (host-provided).

#### Parameters

##### fingerprint

`string`

#### Returns

`Uint8Array` \| `Promise`\<`Uint8Array` \| `undefined`\> \| `undefined`

***

### LedgerLike

```ts
type LedgerLike = 
  | AuditLedger
  | {
  entries: readonly AuditEntry[];
};
```

## Variables

### ANCHOR\_RECORDED\_TYPE

```ts
const ANCHOR_RECORDED_TYPE: "ANCHOR_RECORDED" = 'ANCHOR_RECORDED';
```

N-4 (Handoff 11): `ANCHOR_RECORDED` — the anchoring act as a FIRST-CLASS
ledger entry. The host appends this right after an AnchorAdapter produces a
receipt, so the trail itself shows when (and by which adapter) the chain
head was externally recorded. The Ledger Explorer categorizes it under
"Verificações" and its payload is enough to re-verify later.

***

### SACM\_SPEC\_VERSION

```ts
const SACM_SPEC_VERSION: "SACM 2.3" = 'SACM 2.3';
```

Spec label shown in the report header (§11.4 — parameterized, NEVER
hardcoded in the renderer). SACM 2.3 is the current formal version at
omg.org/spec/SACM (adopted October 2023), confirmed at implementation
time; hosts override via `AssuranceCaseOptions.specVersion` when OMG
publishes a newer one.

***

### EVIDENCE\_COLLAPSE\_THRESHOLD

```ts
const EVIDENCE_COLLAPSE_THRESHOLD: 20 = 20;
```

Above this many evidence rows per argument the report body collapses the
group into "N evidências · faixa de hashes #x…#y" and moves the full rows
to the annex (§11.2).

## Functions

### anchorRecordedEntry()

```ts
function anchorRecordedEntry(receipt, actor): object;
```

#### Parameters

##### receipt

`AnchorReceipt`

##### actor

###### id

`string`

#### Returns

`object`

##### type

```ts
type: string;
```

##### userId

```ts
userId: string;
```

##### versionId

```ts
versionId: string;
```

##### details

```ts
details: Record<string, unknown>;
```

***

### buildAssuranceCase()

```ts
function buildAssuranceCase(
   diagram, 
   ledger, 
options?): Promise<AssuranceCase>;
```

Builds the assurance case 100% from governance records (aceite 10.5.8):
claims and argument statements are canonical templates instantiated with
version identity; every evidence row is a ledger entry or a promotion
approval — *"Todo conteúdo do assurance case é derivado do ledger, nunca
digitado — e assinada quando a instalação suporta"* (invariante do gerador,
Handoff 5 §11 estendido no Handoff 8 §4.4). The SHA-256 chain verification
runs here; when a public-key resolver is passed, each approver's recorded
signature is re-verified and an invalid one un-sustains the approval claim.

#### Parameters

##### diagram

`BpmnDiagram`

##### ledger

[`LedgerLike`](#ledgerlike)

##### options?

[`AssuranceCaseOptions`](#assurancecaseoptions) = `{}`

#### Returns

`Promise`\<[`AssuranceCase`](#assurancecase)\>

***

### attestVersion()

```ts
function attestVersion(
   registry, 
   diagramId, 
   versionId, 
options?): Promise<Attestation>;
```

Builds the attestation for a registered version. Reads only — the
registry is never mutated. Throws when the version is not registered or
belongs to a different diagram.

#### Parameters

##### registry

`VersionRegistry`

##### diagramId

`string`

##### versionId

`string`

##### options?

[`AttestOptions`](#attestoptions) = `{}`

#### Returns

`Promise`\<[`Attestation`](#attestation)\>

***

### canonicalAttestation()

```ts
function canonicalAttestation(attestation): string;
```

The attestation's canonical JSON form — byte-stable for equal input.

#### Parameters

##### attestation

[`Attestation`](#attestation)

#### Returns

`string`

***

### attestationHash()

```ts
function attestationHash(attestation): Promise<string>;
```

SHA-256 over the canonical form — the id a host stores/publishes.

#### Parameters

##### attestation

[`Attestation`](#attestation)

#### Returns

`Promise`\<`string`\>

***

### renderAssuranceCaseHtml()

```ts
function renderAssuranceCaseHtml(assurance): string;
```

Print-ready SACM assurance-case report (Handoff 5 §5, F-C3) as a single
self-contained HTML document under the certify sub-brand: 4px gold rule,
`BTV CERTIFY · ASSURANCE CASE · <spec>` kicker (spec label parameterized —
§11.4), canonical SACM notation (claim rectangle / argument parallelogram
/ evidence circles carrying ledger-entry hashes), dashed inferred
relations, and the audit footer (chain hash, verification result, date,
approvers, page n/N) fixed on every page.

§11.3 — DECLARED EXCEPTION: no dark mode. The document keeps the paper
base (#FAF9F6/ink) even under `prefers-color-scheme: dark` — an audit
document has ONE canonical appearance. `color-scheme: only light` plus
the absence of any dark block is intentional, not a bug.

#### Parameters

##### assurance

[`AssuranceCase`](#assurancecase)

#### Returns

`string`

***

### collectSignedApprovals()

```ts
function collectSignedApprovals(ledger, versionId?): SignedApproval[];
```

Collect every `SignedApproval` recorded in the ledger (optionally scoped to a
version). Reads `details.signedApproval` — the same slot `approvePromotion`
writes (I-2), so it never depends on a specific entry-type constant.

#### Parameters

##### ledger

[`LedgerLike`](#ledgerlike)

##### versionId?

`string`

#### Returns

`SignedApproval`[]

***

### verifyLedgerSignatures()

```ts
function verifyLedgerSignatures(ledger, resolvePublicKey): Promise<LedgerSignatureReport>;
```

Re-verify every recorded signature against host-resolved public keys.

#### Parameters

##### ledger

[`LedgerLike`](#ledgerlike)

##### resolvePublicKey

[`PublicKeyResolver`](#publickeyresolver)

#### Returns

`Promise`\<[`LedgerSignatureReport`](#ledgersignaturereport)\>

***

### signaturePromotionRule()

```ts
function signaturePromotionRule(options): PromotionRule;
```

Optional promotion gate (Handoff 8 §4.4): "aprovações exigem assinatura
válida". Drop it into `lifecycleConfig.promotionRules` — ON by default when
the host wires identity (i.e. when it injects this rule). Only gates
promotion to `active`; a role with no VALID signature blocks activation.

#### Parameters

##### options

[`SignatureGateOptions`](#signaturegateoptions)

#### Returns

`PromotionRule`

***

### verifyLedger()

```ts
function verifyLedger(ledger): Promise<VerificationReport>;
```

Recomputes every hash in the chain — the previous-hash linkage AND each
entry's own hash over the exported recipe (`computeEntryHash`) — and
reports the first break. Accepts a live `AuditLedger` or the plain
`{ entries }` shape of `ledger.export()` / a `ledger.json` file.

#### Parameters

##### ledger

[`LedgerLike`](#ledgerlike)

#### Returns

`Promise`\<[`VerificationReport`](#verificationreport)\>

***

### toXES()

```ts
function toXES(ledger, options?): string;
```

Serializes the ledger (+ registry events) as XES 2.0 XML.

#### Parameters

##### ledger

[`LedgerLike`](#ledgerlike)

##### options?

[`XesOptions`](#xesoptions) = `{}`

#### Returns

`string`
