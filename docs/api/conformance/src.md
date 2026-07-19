# conformance/src

## Interfaces

### CertifyIssue

#### Properties

##### code

```ts
code: "STRUCT_MISSING_ATTR" | "STRUCT_BAD_PARENT";
```

##### element

```ts
element: string;
```

##### message

```ts
message: string;
```

***

### CertifyReport

#### Properties

##### wellFormed

```ts
wellFormed: boolean;
```

##### xxeSafe

```ts
xxeSafe: boolean;
```

False when the document was rejected for DOCTYPE/DTD (XXE protection).

##### parseError?

```ts
optional parseError?: string;
```

Parser error when not well-formed.

##### structuralIssues

```ts
structuralIssues: CertifyIssue[];
```

##### importWarnings

```ts
importWarnings: string[];
```

##### roundTripLossless

```ts
roundTripLossless: boolean;
```

##### elementsUsed

```ts
elementsUsed: string[];
```

Model elements used by the document (local names, deduplicated).

##### unsupportedElements

```ts
unsupportedElements: string[];
```

Used elements outside the supported profile (per the matrix).

##### achievedClass

```ts
achievedClass: "none" | CertifiableClass;
```

Highest class this document certifies at: 'descriptive' when it only
uses Descriptive-class elements; 'analytic' when it also uses (supported)
Analytic-class elements; 'none' when it is broken or uses unsupported
elements or loses content on round-trip.

##### matrixCoverage

```ts
matrixCoverage: object;
```

Tool-level class coverage from the conformance matrix.

###### descriptive

```ts
descriptive: number;
```

###### analytic

```ts
analytic: number;
```

##### requiredClass?

```ts
optional requiredClass?: CertifiableClass;
```

##### requirementMet?

```ts
optional requirementMet?: boolean;
```

Present when `require` was requested.

***

### ElementRule

Structural validation manifest (Handoff 4 §A2).

Chosen option (documented in pendencias.md): instead of a full XSD
validator — prohibitive with zero runtime deps — the rules below are a
hand-derived digest of the official OMG BPMN20.xsd / Semantic.xsd for the
elements in the supported profile: required attributes and legal direct
parents. It catches the structural mistakes that break interchange
(flows without endpoints, detached boundary events, lanes outside
laneSets) without a schema engine.

#### Properties

##### requiredAttrs?

```ts
optional requiredAttrs?: string[];
```

Attributes the XSD marks as required (profile-relevant subset).

##### parents?

```ts
optional parents?: string[];
```

Legal direct parents (local names). Omitted = unconstrained.

***

### ConformanceEntry

#### Properties

##### element

```ts
element: string;
```

BPMN element (or event definition), e.g. 'bpmn:userTask'.

##### status

```ts
status: ConformanceStatus;
```

##### conformanceClass

```ts
conformanceClass: ConformanceClass;
```

##### mappedTo?

```ts
optional mappedTo?: string;
```

Internal node/edge type or event definition key, when applicable.

##### notes?

```ts
optional notes?: string;
```

***

### ThirdPartyDeclaration

Third-party comparative columns (Handoff 14 §1g). HONESTY RULE, binding:
every cell reflects ONLY what the vendor's own documentation declares —
"declarado pela doc deles", linked per column — never our own testing or
claims about a competitor. An element absent from `declaredElements`
renders "—" (no recorded declaration), which is NOT a claim of absence.
Updating a column = re-reading THEIR doc and adjusting this fixture.

#### Properties

##### vendor

```ts
vendor: string;
```

Column header, e.g. 'bpmn-js (bpmn.io)'.

##### sourceUrl

```ts
sourceUrl: string;
```

The vendor documentation page the declarations were read from.

##### claim

```ts
claim: string;
```

Short claim rendered in declared cells, e.g. 'modela' / 'executa'.

##### declaredElements

```ts
declaredElements: string[];
```

Matrix elements THEIR doc declares as covered.

## Type Aliases

### CertifiableClass

```ts
type CertifiableClass = "descriptive" | "analytic";
```

***

### ConformanceStatus

```ts
type ConformanceStatus = "supported" | "partial" | "degraded" | "unsupported";
```

- `supported`: imports, renders, exports and round-trips losslessly.
- `partial`: model + render + round-trip work; some interactions pending.
- `degraded`: imported with a warning and downgraded to a supported form.
- `unsupported`: ignored on import with a warning (roadmap candidates).

***

### ConformanceClass

```ts
type ConformanceClass = "descriptive" | "analytic" | "extended";
```

OMG conformance sub-class the element counts toward.

## Variables

### GENERATED\_CORPUS\_FILES

```ts
const GENERATED_CORPUS_FILES: 60 = 60;
```

Corpus policy (Handoff 11 N-2): the single source for the real/generated
corpus proportion documented in CONFORMANCE.md and enforced by the tests.

- The GENERATED corpus is committed (`corpus/*.bpmn`, structural
  equivalents, zero proprietary material); its count is frozen here and
  anti-drift-tested against the directory.
- The REAL corpus is fetched in CI (`pnpm fetch:corpus`) into the
  git-ignored `corpus-external/`; per-file origin + license live in its
  `MANIFEST.json` — NOT as in-file headers, because the round-trip suite
  must exercise byte-exact upstream files (decision recorded in
  pendencias.md §13).

***

### EXTERNAL\_CORPUS\_MIN

```ts
const EXTERNAL_CORPUS_MIN: 20 = 20;
```

The round-trip gate requires at least this many real files when fetched.

***

### EXTERNAL\_CORPUS\_MAX

```ts
const EXTERNAL_CORPUS_MAX: 40 = 40;
```

The fetch script caps the download at this many files.

***

### EXTERNAL\_CORPUS\_SOURCES

```ts
const EXTERNAL_CORPUS_SOURCES: readonly [{
  name: "bpmn-io/bpmn-js-examples";
  license: "MIT";
}, {
  name: "camunda/camunda-get-started-quickstart";
  license: "Apache-2.0";
}];
```

Permissive, redistributable sources only (no CC-BY-SA / share-alike).

***

### STRUCTURAL\_MANIFEST

```ts
const STRUCTURAL_MANIFEST: Record<string, ElementRule>;
```

***

### CONFORMANCE\_MATRIX

```ts
const CONFORMANCE_MATRIX: ConformanceEntry[];
```

***

### THIRD\_PARTY\_DECLARATIONS

```ts
const THIRD_PARTY_DECLARATIONS: ThirdPartyDeclaration[];
```

## Functions

### certifyXml()

```ts
function certifyXml(xml, options?): CertifyReport;
```

Certifies a BPMN document (Handoff 4 §A2): well-formedness + XXE safety,
structural manifest validation, import warnings, round-trip losslessness
and the conformance class the document achieves. Pure — no I/O; the CLI
`certify` command wraps it.

#### Parameters

##### xml

`string`

##### options?

###### require?

[`CertifiableClass`](#certifiableclass)

#### Returns

[`CertifyReport`](#certifyreport)

***

### classCoverage()

```ts
function classCoverage(entries, klass): number;
```

Percentage of a class' elements that are usable (supported or partial).

#### Parameters

##### entries

[`ConformanceEntry`](#conformanceentry)[]

##### klass

[`ConformanceClass`](#conformanceclass)

#### Returns

`number`

***

### renderConformanceMarkdown()

```ts
function renderConformanceMarkdown(entries?): string;
```

Renders CONFORMANCE.md deterministically from the matrix. The committed
file is compared against this output in CI (freshness test): editing the
matrix without regenerating the document fails the build.

#### Parameters

##### entries?

[`ConformanceEntry`](#conformanceentry)[] = `CONFORMANCE_MATRIX`

#### Returns

`string`
