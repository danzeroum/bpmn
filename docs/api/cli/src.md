# cli/src

## Interfaces

### CertifyCommandOptions

#### Properties

##### require?

```ts
optional require?: CertifiableClass;
```

##### report?

```ts
optional report?: string;
```

Write the JSON report to this path (e.g. certify-report.json).

***

### AssuranceCaseCommandOptions

#### Properties

##### ledger?

```ts
optional ledger?: string;
```

Ledger export (ledger.json) evidencing the case; omit → empty chain.

##### sacmVersion?

```ts
optional sacmVersion?: string;
```

"SACM x.y" header label override (§11.4 — parameterized).

***

### LoadResult

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### warnings

```ts
warnings: string[];
```

***

### ActorOptions

#### Extended by

- [`PromoteOptions`](#promoteoptions)

#### Properties

##### actorId

```ts
actorId: string;
```

##### actorRole

```ts
actorRole: string;
```

##### reason

```ts
reason: string;
```

***

### PromoteOptions

#### Extends

- [`ActorOptions`](#actoroptions)

#### Properties

##### actorId

```ts
actorId: string;
```

###### Inherited from

[`ActorOptions`](#actoroptions).[`actorId`](#actorid)

##### actorRole

```ts
actorRole: string;
```

###### Inherited from

[`ActorOptions`](#actoroptions).[`actorRole`](#actorrole)

##### reason

```ts
reason: string;
```

###### Inherited from

[`ActorOptions`](#actoroptions).[`reason`](#reason)

##### to

```ts
to: VersionStatus;
```

##### output?

```ts
optional output?: string;
```

Write the resulting diagram here; overwrites the input when omitted.

##### registryPath?

```ts
optional registryPath?: string;
```

Also register the promoted version into this registry file.

## Functions

### auditCommand()

```ts
function auditCommand(path): Promise<VerificationReport>;
```

`bpmn-react audit <ledger.json>` (Handoff 4 §B1): re-verifies an exported
hash-chained ledger so third parties can prove integrity in CI. The file
is the `AuditLedger.export()` shape: `{ "entries": [...] }`.

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`VerificationReport`\>

***

### formatAudit()

```ts
function formatAudit(report): string;
```

Human report for the audit command (use --json for the raw object).

#### Parameters

##### report

`VerificationReport`

#### Returns

`string`

***

### exportXesCommand()

```ts
function exportXesCommand(ledgerPath, options?): Promise<string>;
```

`bpmn-react export-xes <ledger.json> [--registry <registry.json>] [-o out.xes]`
(Handoff 4 §B2): converts the governance history to IEEE XES 2.0 so the
real design process can be mined in ProM/Celonis/Disco.

#### Parameters

##### ledgerPath

`string`

##### options?

###### registryPath?

`string`

###### output?

`string`

#### Returns

`Promise`\<`string`\>

***

### assuranceCaseCommand()

```ts
function assuranceCaseCommand(
   xmlPath, 
   outPath, 
   options?): Promise<{
  supported: boolean;
  claims: number;
  intact: boolean;
}>;
```

`bpmn-react certify <file.bpmn> --assurance-case <out.html>` (F-C3):
renders the print-ready SACM report 100% from governance records — the
diagram's version identity/approvals plus the ledger entries. Returns
whether every claim is supported (drives the exit code).

#### Parameters

##### xmlPath

`string`

##### outPath

`string`

##### options?

[`AssuranceCaseCommandOptions`](#assurancecasecommandoptions) = `{}`

#### Returns

`Promise`\<\{
  `supported`: `boolean`;
  `claims`: `number`;
  `intact`: `boolean`;
\}\>

***

### certifyCommand()

```ts
function certifyCommand(path, options?): Promise<CertifyReport>;
```

`bpmn-react certify <file>` — conformance certificate for third-party CI.

#### Parameters

##### path

`string`

##### options?

[`CertifyCommandOptions`](#certifycommandoptions) = `{}`

#### Returns

`Promise`\<`CertifyReport`\>

***

### formatCertify()

```ts
function formatCertify(
   report, 
   reportPath?, 
   options?): string;
```

Human-readable certificate (the --json flag prints the raw report instead).

#### Parameters

##### report

`CertifyReport`

##### reportPath?

`string`

##### options?

###### strict?

`boolean`

#### Returns

`string`

***

### validateCommand()

```ts
function validateCommand(path): Promise<{
  result: ValidationResult;
  warnings: string[];
}>;
```

#### Parameters

##### path

`string`

#### Returns

`Promise`\<\{
  `result`: `ValidationResult`;
  `warnings`: `string`[];
\}\>

***

### exportCommand()

```ts
function exportCommand(
   input, 
   format, 
output?): Promise<string>;
```

#### Parameters

##### input

`string`

##### format

`"xml"` \| `"json"`

##### output?

`string`

#### Returns

`Promise`\<`string`\>

***

### diffCommand()

```ts
function diffCommand(pathA, pathB): Promise<BpmnDiff>;
```

#### Parameters

##### pathA

`string`

##### pathB

`string`

#### Returns

`Promise`\<`BpmnDiff`\>

***

### loadDiagram()

```ts
function loadDiagram(path): Promise<LoadResult>;
```

Loads a diagram from a `.json` or `.xml`/`.bpmn` file.

#### Parameters

##### path

`string`

#### Returns

`Promise`\<[`LoadResult`](#loadresult)\>

***

### formatValidation()

```ts
function formatValidation(result): string;
```

#### Parameters

##### result

`ValidationResult`

#### Returns

`string`

***

### formatDiff()

```ts
function formatDiff(diff): string;
```

#### Parameters

##### diff

`BpmnDiff`

#### Returns

`string`

***

### promoteCommand()

```ts
function promoteCommand(diagramPath, options): Promise<BpmnDiagram>;
```

Advances a diagram's lifecycle status through the LifecycleEngine
and writes the promoted diagram. The engine enforces the governance gate —
promotion to `active` requires the approvals/changelog already recorded on
the version — so this is the "process PR" check a pipeline runs.

#### Parameters

##### diagramPath

`string`

##### options

[`PromoteOptions`](#promoteoptions)

#### Returns

`Promise`\<`BpmnDiagram`\>

***

### approveCommand()

```ts
function approveCommand(diagramPath, options): Promise<BpmnDiagram>;
```

Records an approval on a diagram's current version and writes it back.

#### Parameters

##### diagramPath

`string`

##### options

[`ActorOptions`](#actoroptions) & `object`

#### Returns

`Promise`\<`BpmnDiagram`\>

***

### loadRegistry()

```ts
function loadRegistry(path, options?): Promise<VersionRegistry>;
```

Loads a registry from a JSON file (an exported registry). With
`createIfMissing`, a nonexistent file yields a fresh empty registry so
`registry add` can bootstrap one.

#### Parameters

##### path

`string`

##### options?

###### createIfMissing?

`boolean`

#### Returns

`Promise`\<`VersionRegistry`\>

***

### saveRegistry()

```ts
function saveRegistry(path, registry): Promise<void>;
```

#### Parameters

##### path

`string`

##### registry

`VersionRegistry`

#### Returns

`Promise`\<`void`\>

***

### registryAddCommand()

```ts
function registryAddCommand(
   diagramPath, 
   registryPath, 
options?): Promise<RegistryEntry>;
```

Registers a diagram's current version into a registry file (created if absent).

#### Parameters

##### diagramPath

`string`

##### registryPath

`string`

##### options?

###### technicalNotes?

`string`

#### Returns

`Promise`\<`RegistryEntry`\>

***

### registryHistoryCommand()

```ts
function registryHistoryCommand(registryPath): Promise<RegistryEntry[]>;
```

#### Parameters

##### registryPath

`string`

#### Returns

`Promise`\<`RegistryEntry`[]\>

***

### registryPublishCommand()

```ts
function registryPublishCommand(registryPath, options): Promise<Publication>;
```

#### Parameters

##### registryPath

`string`

##### options

###### versionId

`string`

###### channel

`string`

###### environment?

`string`

###### status?

`VersionStatus`

###### effectiveFrom?

`string`

###### publishedBy?

`string`

#### Returns

`Promise`\<`Publication`\>

***

### registryActiveCommand()

```ts
function registryActiveCommand(registryPath, options): Promise<RegistryEntry | undefined>;
```

#### Parameters

##### registryPath

`string`

##### options

###### at

`string`

###### channel?

`string`

###### environment?

`string`

#### Returns

`Promise`\<`RegistryEntry` \| `undefined`\>

***

### registryDiffCommand()

```ts
function registryDiffCommand(
   registryPath, 
   fromVersionId, 
toVersionId): Promise<string>;
```

#### Parameters

##### registryPath

`string`

##### fromVersionId

`string`

##### toVersionId

`string`

#### Returns

`Promise`\<`string`\>

***

### registryBindRunCommand()

```ts
function registryBindRunCommand(registryPath, options): Promise<RunBinding>;
```

Pins a run to a registered version, returning the immutable binding.

#### Parameters

##### registryPath

`string`

##### options

###### versionId

`string`

###### channel?

`string`

###### environment?

`string`

###### runId?

`string`

#### Returns

`Promise`\<`RunBinding`\>

***

### formatHistory()

```ts
function formatHistory(entries): string;
```

#### Parameters

##### entries

`RegistryEntry`[]

#### Returns

`string`

***

### formatEntry()

```ts
function formatEntry(entry): string;
```

#### Parameters

##### entry

`RegistryEntry`

#### Returns

`string`
