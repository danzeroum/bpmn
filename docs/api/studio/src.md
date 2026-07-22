# studio/src

## Interfaces

### StudioShellProps

#### Properties

##### user

```ts
user: UserContext;
```

##### library

```ts
library: LibraryViewProps;
```

Wiring of the Biblioteca screen (LibraryView pass-through).

##### review

```ts
review: Omit<ReviewScreenProps, "actor">;
```

Wiring of the Revisão screen; `actor` comes from `user`.

##### audit?

```ts
optional audit?: LedgerExplorerProps;
```

Wiring of the Auditoria screen (Ledger Explorer, S-5).

##### footer?

```ts
optional footer?: string;
```

##### messages?

```ts
optional messages?: Messages;
```

Injected UI dictionary (Handoff 11 N-6). Omitted → English. Missing keys
fall back to English; the host owns locale choice.

***

### LedgerAction

#### Properties

##### id

```ts
id: "open-designer" | "diff";
```

##### entry

```ts
entry: AuditEntry;
```

***

### LedgerExplorerProps

#### Properties

##### ledger

```ts
ledger: LedgerLike;
```

##### registry?

```ts
optional registry?: VersionRegistry;
```

Enriches the XES export with registered/published events.

##### onAction?

```ts
optional onAction?: (action) => void;
```

"Ver diff desta mudança" / "Abrir versão no Designer (leitura)" — host resolves.

###### Parameters

###### action

[`LedgerAction`](#ledgeraction)

###### Returns

`void`

##### onDownload?

```ts
optional onDownload?: (filename, content, mime) => void;
```

Download seam (VerificationReport.json / attestation.json / .xes); default: browser download.

###### Parameters

###### filename

`string`

###### content

`string`

###### mime

`string`

###### Returns

`void`

##### initialFilter?

```ts
optional initialFilter?: LedgerFilter;
```

##### query?

```ts
optional query?: (question) => Promise<string>;
```

C6 (Handoff 9): host-injected copilot transport for the ledger query box.
Read-only like C3 — neither the question nor the answer touches the
chain. The raw completion goes through `parseLedgerAnswer`: EVERY
citation must resolve to a real entry hash (clickable, opens the entry)
or the panel says "não encontrei registro" — never an invented answer.

###### Parameters

###### question

`string`

###### Returns

`Promise`\<`string`\>

##### anchor?

```ts
optional anchor?: object;
```

N-4 (Handoff 11): the EXTERNAL anchor dimension of "Verificar cadeia".
`verifyLedger` (is the local chain self-consistent?) and the anchor
verification (does the head match the externally recorded one?) are
INDEPENDENT results — the banners render them as separate statements
and never fuse them. Absent → explorer unchanged.

###### adapter

```ts
adapter: AnchorAdapter;
```

###### receipt?

```ts
optional receipt?: AnchorReceipt;
```

The host-persisted receipt to re-verify; absent → "pendente".

###### onAnchored?

```ts
optional onAnchored?: (receipt) => void;
```

Fires after "Retentar âncora" produces a fresh receipt (host persists).

###### Parameters

###### receipt

`AnchorReceipt`

###### Returns

`void`

***

### LedgerFilter

#### Properties

##### categories?

```ts
optional categories?: LedgerCategory[];
```

##### artifactId?

```ts
optional artifactId?: string;
```

Matches entry.versionId OR details.artifactId.

##### from?

```ts
optional from?: string;
```

ISO timestamps, inclusive start / exclusive end.

##### until?

```ts
optional until?: string;
```

***

### FilteredLedger

#### Properties

##### entries

```ts
entries: AuditEntry[];
```

##### counts

```ts
counts: Record<LedgerCategory, number> & object;
```

Chip counts over the context-filtered set (before category narrowing).

###### Type Declaration

###### total

```ts
total: number;
```

***

### ReviewScreenProps

#### Properties

##### candidates

```ts
candidates: readonly BpmnDiagram[];
```

Live candidate diagrams — the solicitante's working set, host-owned.

##### engine

```ts
engine: LifecycleEngine;
```

##### ledger

```ts
ledger: AuditLedger;
```

##### actor

```ts
actor: UserContext;
```

##### registry?

```ts
optional registry?: VersionRegistry;
```

Resolves call-activity references for the Dependências card.

##### converter?

```ts
optional converter?: object;
```

Host-configured XML exporter for the Conformidade card.

###### toXml()

```ts
toXml(diagram): string;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`string`

##### baselineOf?

```ts
optional baselineOf?: (diagram) => BpmnDiagram | undefined;
```

Baseline for the diff block (e.g. the active version); absent → first version.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`BpmnDiagram` \| `undefined`

##### reviewStore?

```ts
optional reviewStore?: ReviewStore;
```

Review threads (Handoff 15 §2d, host injection): with a store AND a
baseline, the diff block becomes the SPLIT CANVAS — the embedded
BpmnDiffViewer with pins and the Threads/Mudanças tabs; dismissals are
appended to the ledger (justified, never silent). Absent → this screen
is IDENTICAL to before (declared degradation, §1.5).

##### onDecided?

```ts
optional onDecided?: (result) => void;
```

Notifies the host so it persists the approval / reacts to the rejection.

###### Parameters

###### result

[`DecisionResult`](#decisionresult)

###### Returns

`void`

##### onReviewEvent?

```ts
optional onReviewEvent?: (name, payload) => void;
```

N-3 bridge (Handoff 15 §2e): the Studio has no editor plugin bus, so the
host receives the catalog event here and re-emits it on its own bus. The
payload type IS the catalog's (`EditorEventPayloads`) — no drift.

###### Parameters

###### name

`"review.changes.requested"`

###### payload

###### versionId

`string`

###### threadRefs

`string`[]

###### Returns

`void`

##### onOpenInDesigner?

```ts
optional onOpenInDesigner?: (diagram) => void;
```

Renders the "abrir no canvas →" link when provided (read-only Designer).

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`void`

##### replayAnalysisFor?

```ts
optional replayAnalysisFor?: (diagram) => ReviewReplayAnalysis | undefined;
```

Replay analysis attached to a candidate's promotion (Handoff 7B-3, host
injection — usually `latestReplayAnalysis` over the ledger). When it returns
a value, the review shows an "ANÁLISE DE REPLAY" block; absent → no block.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

[`ReviewReplayAnalysis`](#reviewreplayanalysis) \| `undefined`

##### explain?

```ts
optional explain?: (diagram) => Promise<string>;
```

C3 (Handoff 9): natural-language explanation of the candidate — READ-ONLY
ABSOLUTO: generates no commands and touches no ledger (not even as a
recorded query). The only capability without a trail, by design.

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`Promise`\<`string`\>

##### now?

```ts
optional now?: () => string;
```

###### Returns

`string`

##### signer?

```ts
optional signer?: Signer;
```

Identity signing (Handoff 8 I-2, host injection — cerca §1.1: the host owns
the key). When present, "Aprovar como {papel}" becomes the 🔏 signing flow:
the canonical payload is shown before signing, the signature is recorded in
the ledger entry, and the confirmation shows the fingerprint + verified
badge. Absent → current behavior + "não assinada" badge.

##### anchor?

```ts
optional anchor?: AnchorAdapter;
```

External anchor adapter (Handoff 8 I-3, host injection). When present, a
signed approval's chain head is anchored after the decision: the seal shows
the pending→ancorada cycle with retry (cerca §1.3 — never regresses). Absent
→ "sem âncora configurada" for signed approvals (§1.4).

***

### ReviewReplayAnalysis

The attached replay analysis the Approver Review renders (structural).

#### Properties

##### headline

```ts
headline: string;
```

##### fitness

```ts
fitness: number;
```

##### totalCases

```ts
totalCases: number;
```

##### analyzedVersion

```ts
analyzedVersion: string;
```

##### bottleneck?

```ts
optional bottleneck?: string;
```

##### deviation?

```ts
optional deviation?: string;
```

##### deviationCases?

```ts
optional deviationCases?: number;
```

##### author

```ts
author: string;
```

##### timestamp

```ts
timestamp: string;
```

***

### ReviewCheck

The 2×2 "verificações automáticas" grid of the Revisão (Handoff 6 §5).
Every card is the result of a REAL call — evaluate/verify/certify/resolve —
never local state (criterion §10.4). Mocks exist only in tests.

#### Properties

##### id

```ts
id: "ledger" | "soundness" | "conformance" | "dependencies";
```

##### label

```ts
label: string;
```

##### ok

```ts
ok: boolean;
```

##### detail

```ts
detail: string;
```

***

### ReviewChecksInput

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### ledger

```ts
ledger: LedgerLike;
```

##### registry?

```ts
optional registry?: VersionRegistry;
```

Resolves call-activity references; omitted, the card reports "sem referências".

##### converter?

```ts
optional converter?: object;
```

XML exporter — inject the host's configured converter for custom node types.

###### toXml()

```ts
toXml(diagram): string;
```

###### Parameters

###### diagram

`BpmnDiagram`

###### Returns

`string`

##### now?

```ts
optional now?: () => string;
```

ISO clock for the dependency resolution window.

###### Returns

`string`

***

### ApprovePromotionInput

#### Properties

##### engine

```ts
engine: LifecycleEngine;
```

##### ledger

```ts
ledger: AuditLedger;
```

##### diagram

```ts
diagram: BpmnDiagram;
```

##### actor

```ts
actor: UserContext;
```

##### signedApproval?

```ts
optional signedApproval?: SignedApproval;
```

Ed25519 signature over the approval payload (Handoff 8 I-2). When present it
is persisted in the `APPROVAL_RECORDED` entry `details` — so it joins the
hash-chain (tamper-evident) and travels through `onDecided`. Absent → the
approval is recorded unsigned (legacy), exactly as before.

***

### DecisionResult

#### Properties

##### kind

```ts
kind: "approved" | "rejected" | "changes-requested";
```

##### diagram

```ts
diagram: BpmnDiagram;
```

approve → the diagram carrying the new ApprovalRecord;
changes-requested → the NEW `in-review` version the state machine minted
(chained to the candidate via `parentVersionId`); reject → unchanged.

##### ledgerEntry

```ts
ledgerEntry: AuditEntry;
```

***

### RejectPromotionInput

#### Properties

##### ledger

```ts
ledger: AuditLedger;
```

##### diagram

```ts
diagram: BpmnDiagram;
```

##### actor

```ts
actor: UserContext;
```

##### reason

```ts
reason: string;
```

***

### RequestChangesInput

#### Properties

##### engine

```ts
engine: LifecycleEngine;
```

##### ledger

```ts
ledger: AuditLedger;
```

##### diagram

```ts
diagram: BpmnDiagram;
```

##### actor

```ts
actor: UserContext;
```

##### justification

```ts
justification: string;
```

Mandatory reviewer comment (min 10 chars — same floor as rejection).

##### threadRefs?

```ts
optional threadRefs?: readonly string[];
```

Ids of the OPEN threads attached as context (may be empty — §2e régua 6).

##### signedRequest?

```ts
optional signedRequest?: SignedChangeRequestRef;
```

The signed request (Handoff 8 I-2 discipline); absent → legacy unsigned.

***

### PromotionRequest

One pending promotion request in the approver's queue (Handoff 6 §5).
Derived, never stored: candidates come from the host's working set and the
approval rule comes exclusively from the lifecycle engine's gates — the UI
never re-implements "who can approve / how many are missing" (lição da
PR16; criterion §10.3/§10.4).

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### gates

```ts
gates: PromotionGate[];
```

Engine truth for candidate → active, in gate order.

##### approvals?

```ts
optional approvals?: PromotionGate;
```

The approvals gate (id 'approvals'), when the engine emits it.

##### approvedRoles

```ts
approvedRoles: string[];
```

Distinct roles that already approved.

##### slaDays?

```ts
optional slaDays?: number;
```

Days until effectiveFrom, when the version declares a target date.

***

### PendingPromotionsInput

#### Properties

##### candidates

```ts
candidates: readonly BpmnDiagram[];
```

Live candidate diagrams, owned by the host (solicitante's store).

##### engine

```ts
engine: LifecycleEngine;
```

##### user

```ts
user: UserContext;
```

##### now?

```ts
optional now?: () => string;
```

ISO clock — injectable for tests.

###### Returns

`string`

## Type Aliases

### StudioScreen

```ts
type StudioScreen = "biblioteca" | "revisao" | "auditoria";
```

***

### LedgerCategory

```ts
type LedgerCategory = 
  | "promotion"
  | "approval"
  | "command"
  | "verification"
  | "simulation"
  | "replay"
  | "evidence";
```

Event categorization for the Ledger Explorer filter chips (Handoff 6 §6/§8
— "categorização de eventos p/ filtros (função pura no studio)"). The
ledger's `type` is a free string; there is no central enum in core, so the
studio owns this mapping.

## Variables

### LEDGER\_CATEGORIES

```ts
const LEDGER_CATEGORIES: ReadonlyArray<{
  id: LedgerCategory;
  label: string;
}>;
```

***

### APPROVAL\_RECORDED

```ts
const APPROVAL_RECORDED: "APPROVAL_RECORDED" = 'APPROVAL_RECORDED';
```

Decision commands of the Revisão (Handoff 6 §5). Both write a ledger entry
— the decision is immutable (no undo; corrigir = novo ciclo). Approving
NEVER activates: a separação solicitante/aprovador é intencional (§11) —
a ativação final é um ato da solicitante, fora desta tela.

***

### PROMOTION\_REJECTED

```ts
const PROMOTION_REJECTED: "PROMOTION_REJECTED" = 'PROMOTION_REJECTED';
```

***

### MIN\_REJECTION\_REASON\_LENGTH

```ts
const MIN_REJECTION_REASON_LENGTH: 10 = 10;
```

## Functions

### StudioShell()

```ts
function StudioShell(__namedParameters): Element;
```

The BuildToValue Studio shell (Handoff 6 §1/§2): header with the
three-screen nav, hash-based navigation — state + URL hash, no external
router (§11) — and the user identity. Studio é leitura + decisões de
governança; edição é o Designer. Auditoria chega na S-5.

#### Parameters

##### \_\_namedParameters

[`StudioShellProps`](#studioshellprops)

#### Returns

`Element`

***

### LedgerExplorer()

```ts
function LedgerExplorer(__namedParameters): Element;
```

TELA 3 — Ledger Explorer (Handoff 6 §6): filter bar + vertical trail
(max 720px) + detail column (340px). Read-only: verification, export and
navigation only — the chain is never mutated here.

#### Parameters

##### \_\_namedParameters

[`LedgerExplorerProps`](#ledgerexplorerprops)

#### Returns

`Element`

***

### categorizeEntry()

```ts
function categorizeEntry(entry): LedgerCategory;
```

#### Parameters

##### entry

`Pick`\<`AuditEntry`, `"type"`\>

#### Returns

[`LedgerCategory`](#ledgercategory)

***

### filterEntries()

```ts
function filterEntries(entries, filter?): FilteredLedger;
```

Pure filter used by the trail AND by the XES export (§6/§10.5).

#### Parameters

##### entries

readonly `AuditEntry`[]

##### filter?

[`LedgerFilter`](#ledgerfilter) = `{}`

#### Returns

[`FilteredLedger`](#filteredledger)

***

### aiAuthorOf()

```ts
function aiAuthorOf(entry): string | undefined;
```

AI authorship of an entry (Handoff 9 §8.2 — "selo próprio" no Explorer):
the immutable `ia.copilot@<modelo>` recorded either as the entry's author
(COPILOT_PROPOSAL_APPLIED, cerca §1.2) or as the change-summary
co-authorship (VERSION_ACTIVATED carrying `changeSummaryOrigin`, C4).
Pure and data-driven: the seal renders from THIS field, never from
heuristics over free text.

#### Parameters

##### entry

`AuditEntry`

#### Returns

`string` \| `undefined`

***

### describeEntry()

```ts
function describeEntry(entry): string[];
```

Human line for the PAYLOAD block — generic, data-driven.

#### Parameters

##### entry

`AuditEntry`

#### Returns

`string`[]

***

### ReviewScreen()

```ts
function ReviewScreen(props): Element;
```

TELA 2 — Revisão do Aprovador (Handoff 6 §5): queue on the left (296px),
review area in the middle (max 820px). Read-only absoluto — the only
commands are the two governance decisions, both immutable ledger entries.
Approving NEVER activates (§11): a solicitante executa a promoção final.

#### Parameters

##### props

[`ReviewScreenProps`](#reviewscreenprops)

#### Returns

`Element`

***

### runReviewChecks()

```ts
function runReviewChecks(input): Promise<ReviewCheck[]>;
```

#### Parameters

##### input

[`ReviewChecksInput`](#reviewchecksinput)

#### Returns

`Promise`\<[`ReviewCheck`](#reviewcheck)[]\>

***

### approvePromotion()

```ts
function approvePromotion(input): Promise<DecisionResult>;
```

Records a formal approval: the engine mutates `approvedBy` (immutable copy)
and the act is written to the ledger with role + hash. The rule of who may
approve stays in the engine — `approve` throws on double-approval.

#### Parameters

##### input

[`ApprovePromotionInput`](#approvepromotioninput)

#### Returns

`Promise`\<[`DecisionResult`](#decisionresult)\>

***

### requestChanges()

```ts
function requestChanges(input): Promise<DecisionResult>;
```

"Pedir mudanças" (Handoff 15 §2e) — the Studio's DEFAULT soft path (V-0
decision 3; `rejectPromotion` remains the documented HARD reject). The
transition candidate → `in-review` runs through the core state machine
(cerca §1.4 — the UI never sets status directly), then the act becomes its
own `REVIEW_CHANGES_REQUESTED` ledger entry carrying the justification,
the attached open threads and (when signed) the verifiable signature.
Threads are CONTEXT, not a prerequisite: the request works without a
ReviewStore (§1.5).

#### Parameters

##### input

[`RequestChangesInput`](#requestchangesinput)

#### Returns

`Promise`\<[`DecisionResult`](#decisionresult)\>

***

### rejectPromotion()

```ts
function rejectPromotion(input): Promise<DecisionResult>;
```

Rejection requires a justification (min 10 chars) and becomes a ledger entry.

#### Parameters

##### input

[`RejectPromotionInput`](#rejectpromotioninput)

#### Returns

`Promise`\<[`DecisionResult`](#decisionresult)\>

***

### pendingPromotions()

```ts
function pendingPromotions(input): Promise<PromotionRequest[]>;
```

The approver's queue: candidate versions the user has NOT yet approved.
Progress (current/required) comes from the engine's approvals gate.

#### Parameters

##### input

[`PendingPromotionsInput`](#pendingpromotionsinput)

#### Returns

`Promise`\<[`PromotionRequest`](#promotionrequest)[]\>

***

### approvalsProgress()

```ts
function approvalsProgress(request): string;
```

"1/2 aprovações" — display helper over the engine's gate numbers.

#### Parameters

##### request

[`PromotionRequest`](#promotionrequest)

#### Returns

`string`
