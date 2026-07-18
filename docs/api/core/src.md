# core/src

## Classes

### AuditLedger

Append-only audit ledger with SHA-256 hash chaining: each entry's hash
covers the previous entry's hash, so any retroactive tampering breaks the
chain and is detected by [AuditLedger.verify](#verify).

#### Constructors

##### Constructor

```ts
new AuditLedger(options?): AuditLedger;
```

###### Parameters

###### options?

###### sink?

[`AuditSink`](#auditsink)

###### Returns

[`AuditLedger`](#auditledger)

#### Methods

##### append()

```ts
append(input): Promise<AuditEntry>;
```

Appends an entry. Appends are serialized internally so concurrent calls
always produce a consistent chain.

###### Parameters

###### input

[`AuditEntryInput`](#auditentryinput)

###### Returns

`Promise`\<[`AuditEntry`](#auditentry)\>

##### verify()

```ts
verify(): Promise<LedgerVerification>;
```

Recomputes every hash in the chain and reports the first break.

###### Returns

`Promise`\<[`LedgerVerification`](#ledgerverification)\>

##### getEntries()

```ts
getEntries(): readonly AuditEntry[];
```

###### Returns

readonly [`AuditEntry`](#auditentry)[]

##### query()

```ts
query(filter): AuditEntry[];
```

Filters entries by element id (matched inside `details`) and/or type.

###### Parameters

###### filter

###### nodeId?

`string`

###### edgeId?

`string`

###### type?

`string`

###### Returns

[`AuditEntry`](#auditentry)[]

##### export()

```ts
export(): object;
```

###### Returns

`object`

###### entries

```ts
entries: AuditEntry[];
```

##### import()

```ts
static import(data, options?): Promise<AuditLedger>;
```

Restores a ledger from exported data. Throws [BpmnAuditError](#bpmnauditerror) if
the imported chain does not verify.

###### Parameters

###### data

###### entries

[`AuditEntry`](#auditentry)[]

###### options?

###### sink?

[`AuditSink`](#auditsink)

###### Returns

`Promise`\<[`AuditLedger`](#auditledger)\>

##### connectCommandStack()

```ts
connectCommandStack(stack, user): () => void;
```

Records every command executed/undone/redone on a stack. Returns an
unsubscribe function.

###### Parameters

###### stack

[`CommandStack`](#commandstack)

###### user

[`UserContext`](#usercontext)

###### Returns

() => `void`

##### flush()

```ts
flush(): Promise<void>;
```

Waits until every queued append has been written.

###### Returns

`Promise`\<`void`\>

***

### CommandStack

Owns the diagram state and the undo/redo history.

Git-like cursor semantics: executing a new command after undos discards the
"future" (redoable) commands. Fires on the event bus:
`command.pre` (cancellable), `command.post`, `command.undone`,
`command.redone` and `stack.changed` (for autosave).

#### Constructors

##### Constructor

```ts
new CommandStack(initial, options?): CommandStack;
```

###### Parameters

###### initial

[`BpmnDiagram`](#bpmndiagram)

###### options?

[`CommandStackOptions`](#commandstackoptions) = `{}`

###### Returns

[`CommandStack`](#commandstack)

#### Properties

##### bus

```ts
readonly bus: EventBus;
```

#### Accessors

##### current

###### Get Signature

```ts
get current(): BpmnDiagram;
```

###### Returns

[`BpmnDiagram`](#bpmndiagram)

##### canUndo

###### Get Signature

```ts
get canUndo(): boolean;
```

###### Returns

`boolean`

##### canRedo

###### Get Signature

```ts
get canRedo(): boolean;
```

###### Returns

`boolean`

#### Methods

##### reset()

```ts
reset(diagram): void;
```

Replaces the diagram wholesale (e.g. after import) and clears history.

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

`void`

##### execute()

```ts
execute(command): RuleVerdict;
```

###### Parameters

###### command

[`Command`](#command-1)

###### Returns

[`RuleVerdict`](#ruleverdict)

##### undo()

```ts
undo(): boolean;
```

###### Returns

`boolean`

##### redo()

```ts
redo(): boolean;
```

###### Returns

`boolean`

##### subscribe()

```ts
subscribe(listener): () => void;
```

Subscribes to every state change (execute/undo/redo/reset).

###### Parameters

###### listener

(`diagram`) => `void`

###### Returns

() => `void`

***

### LifecycleEngine

Governs version lifecycle transitions. Every accepted promotion produces a
*new* immutable version entity chained to its parent — the previous version
object is never mutated.

#### Constructors

##### Constructor

```ts
new LifecycleEngine(config?): LifecycleEngine;
```

###### Parameters

###### config?

[`LifecycleConfig`](#lifecycleconfig) = `{}`

###### Returns

[`LifecycleEngine`](#lifecycleengine)

#### Accessors

##### requiredApprovalRoles

###### Get Signature

```ts
get requiredApprovalRoles(): number;
```

Distinct approval roles required to reach 'active'. Config echo so UIs
(status seal, promotion gates) reflect the engine instead of hardcoding.

###### Returns

`number`

##### requiredChangeSummaryLength

###### Get Signature

```ts
get requiredChangeSummaryLength(): number;
```

Minimum changelog length required to reach 'active' (config echo for UIs).

###### Returns

`number`

#### Methods

##### canTransition()

```ts
canTransition(from, to): boolean;
```

###### Parameters

###### from

[`VersionStatus`](#versionstatus)

###### to

[`VersionStatus`](#versionstatus)

###### Returns

`boolean`

##### allowedTargets()

```ts
allowedTargets(from): VersionStatus[];
```

###### Parameters

###### from

[`VersionStatus`](#versionstatus)

###### Returns

[`VersionStatus`](#versionstatus)[]

##### approve()

```ts
approve(
   diagram, 
   actor, 
   reason): BpmnDiagram;
```

Records an approval on the current version (returns a new diagram).

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### actor

[`UserContext`](#usercontext)

###### reason

`string`

###### Returns

[`BpmnDiagram`](#bpmndiagram)

##### evaluateGates()

```ts
evaluateGates(input): Promise<PromotionGate[]>;
```

Evaluates every promotion gate for `input`, in the exact order `promote`
enforces them. Introspection API for UIs (checklists, disabled buttons):
the UI reflects the engine's verdicts instead of re-implementing them.

###### Parameters

###### input

[`PromotionInput`](#promotioninput)

###### Returns

`Promise`\<[`PromotionGate`](#promotiongate)[]\>

##### promote()

```ts
promote(input): Promise<BpmnDiagram>;
```

Promotes the diagram's version to `target`. Throws [BpmnLifecycleError](#bpmnlifecycleerror)
with the first unsatisfied gate's detail (see [evaluateGates](#evaluategates) — the
single source of truth for promotion requirements).

###### Parameters

###### input

[`PromotionInput`](#promotioninput)

###### Returns

`Promise`\<[`BpmnDiagram`](#bpmndiagram)\>

##### createDraftFrom()

```ts
createDraftFrom(
   diagram, 
   actor, 
options?): Promise<BpmnDiagram>;
```

Clones a diagram into a fresh editable draft (the only way to change an
active/deprecated/retired diagram). The clone starts a new version chained
to the source and bumps the semantic version.

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### actor

[`UserContext`](#usercontext)

###### options?

###### bump?

[`SemverBump`](#semverbump)

###### changeSummary?

`string`

###### Returns

`Promise`\<[`BpmnDiagram`](#bpmndiagram)\>

***

### RuleEngine

Declarative pre-condition engine. Well-known hook events:
- `command.pre`     — payload: [Command](#command-1); vetoes any command
- `edge.connect.pre` — payload: [ConnectPayload](#connectpayload); vetoes a connection
- `node.remove.pre` — payload: `{ nodeId: string }`

Also implements [CommandInterceptor](#commandinterceptor) so it can be plugged straight
into a `CommandStack`.

#### Implements

- [`CommandInterceptor`](#commandinterceptor)

#### Constructors

##### Constructor

```ts
new RuleEngine(): RuleEngine;
```

###### Returns

[`RuleEngine`](#ruleengine)

#### Methods

##### register()

```ts
register<T>(event, rule): () => void;
```

###### Type Parameters

###### T

`T` = `unknown`

###### Parameters

###### event

`string`

###### rule

[`Rule`](#rule)\<`T`\>

###### Returns

() => `void`

##### evaluate()

```ts
evaluate<T>(
   event, 
   payload, 
   diagram): RuleVerdict;
```

Returns the first negative verdict, or `{ allowed: true }`.

###### Type Parameters

###### T

`T` = `unknown`

###### Parameters

###### event

`string`

###### payload

`T`

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`RuleVerdict`](#ruleverdict)

##### evaluateCommand()

```ts
evaluateCommand(command, diagram): RuleVerdict;
```

###### Parameters

###### command

[`Command`](#command-1)

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`RuleVerdict`](#ruleverdict)

###### Implementation of

[`CommandInterceptor`](#commandinterceptor).[`evaluateCommand`](#evaluatecommand)

***

### ValidationEngine

Runs structural and (plugin-provided) domain validation rules.
`valid` is false only when *errors* are present; warnings don't block.

#### Constructors

##### Constructor

```ts
new ValidationEngine(rules?): ValidationEngine;
```

###### Parameters

###### rules?

[`ValidationRule`](#validationrule)[] = `BUILT_IN_VALIDATION_RULES`

###### Returns

[`ValidationEngine`](#validationengine)

#### Methods

##### addRule()

```ts
addRule(rule): void;
```

###### Parameters

###### rule

[`ValidationRule`](#validationrule)

###### Returns

`void`

##### validate()

```ts
validate(diagram): ValidationResult;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`ValidationResult`](#validationresult)

***

### EventBus

#### Constructors

##### Constructor

```ts
new EventBus(): EventBus;
```

###### Returns

[`EventBus`](#eventbus)

#### Methods

##### on()

```ts
on<T>(
   event, 
   handler, 
   priority?): () => void;
```

Subscribes to an event. Returns an unsubscribe function.

###### Type Parameters

###### T

`T` = `unknown`

###### Parameters

###### event

`string`

###### handler

[`EventHandler`](#eventhandler)\<`T`\>

###### priority?

`number` = `0`

###### Returns

() => `void`

##### once()

```ts
once<T>(
   event, 
   handler, 
   priority?): () => void;
```

###### Type Parameters

###### T

`T` = `unknown`

###### Parameters

###### event

`string`

###### handler

[`EventHandler`](#eventhandler)\<`T`\>

###### priority?

`number` = `0`

###### Returns

() => `void`

##### off()

```ts
off(event, handler): void;
```

###### Parameters

###### event

`string`

###### handler

[`EventHandler`](#eventhandler)\<`any`\>

###### Returns

`void`

##### fire()

```ts
fire<T>(event, payload): FireResult<T>;
```

###### Type Parameters

###### T

`T` = `unknown`

###### Parameters

###### event

`string`

###### payload

`T`

###### Returns

[`FireResult`](#fireresult)\<`T`\>

##### clear()

```ts
clear(): void;
```

###### Returns

`void`

***

### BpmnError

Error hierarchy — lets host applications branch on error kind.

#### Extends

- `Error`

#### Extended by

- [`BpmnValidationError`](#bpmnvalidationerror)
- [`BpmnLifecycleError`](#bpmnlifecycleerror)
- [`BpmnAuditError`](#bpmnauditerror)
- [`BpmnParseError`](#bpmnparseerror)
- [`BpmnRuleError`](#bpmnruleerror)

#### Constructors

##### Constructor

```ts
new BpmnError(code, message): BpmnError;
```

###### Parameters

###### code

`string`

###### message

`string`

###### Returns

[`BpmnError`](#bpmnerror)

###### Overrides

```ts
Error.constructor
```

#### Properties

##### code

```ts
readonly code: string;
```

***

### BpmnValidationError

A diagram or element failed model validation.

#### Extends

- [`BpmnError`](#bpmnerror)

#### Constructors

##### Constructor

```ts
new BpmnValidationError(message): BpmnValidationError;
```

###### Parameters

###### message

`string`

###### Returns

[`BpmnValidationError`](#bpmnvalidationerror)

###### Overrides

[`BpmnError`](#bpmnerror).[`constructor`](#constructor-6)

#### Properties

##### code

```ts
readonly code: string;
```

###### Inherited from

[`BpmnError`](#bpmnerror).[`code`](#code-1)

***

### BpmnLifecycleError

An invalid lifecycle transition or unmet promotion requirement.

#### Extends

- [`BpmnError`](#bpmnerror)

#### Constructors

##### Constructor

```ts
new BpmnLifecycleError(message): BpmnLifecycleError;
```

###### Parameters

###### message

`string`

###### Returns

[`BpmnLifecycleError`](#bpmnlifecycleerror)

###### Overrides

[`BpmnError`](#bpmnerror).[`constructor`](#constructor-6)

#### Properties

##### code

```ts
readonly code: string;
```

###### Inherited from

[`BpmnError`](#bpmnerror).[`code`](#code-1)

***

### BpmnAuditError

Audit ledger integrity or usage failure.

#### Extends

- [`BpmnError`](#bpmnerror)

#### Constructors

##### Constructor

```ts
new BpmnAuditError(message): BpmnAuditError;
```

###### Parameters

###### message

`string`

###### Returns

[`BpmnAuditError`](#bpmnauditerror)

###### Overrides

[`BpmnError`](#bpmnerror).[`constructor`](#constructor-6)

#### Properties

##### code

```ts
readonly code: string;
```

###### Inherited from

[`BpmnError`](#bpmnerror).[`code`](#code-1)

***

### BpmnParseError

XML (or other format) parsing failure.

#### Extends

- [`BpmnError`](#bpmnerror)

#### Constructors

##### Constructor

```ts
new BpmnParseError(message, line?): BpmnParseError;
```

###### Parameters

###### message

`string`

###### line?

`number`

###### Returns

[`BpmnParseError`](#bpmnparseerror)

###### Overrides

[`BpmnError`](#bpmnerror).[`constructor`](#constructor-6)

#### Properties

##### code

```ts
readonly code: string;
```

###### Inherited from

[`BpmnError`](#bpmnerror).[`code`](#code-1)

##### line?

```ts
readonly optional line?: number;
```

1-based line where the problem was detected, when known.

***

### BpmnRuleError

A command was vetoed by a rule.

#### Extends

- [`BpmnError`](#bpmnerror)

#### Constructors

##### Constructor

```ts
new BpmnRuleError(message): BpmnRuleError;
```

###### Parameters

###### message

`string`

###### Returns

[`BpmnRuleError`](#bpmnruleerror)

###### Overrides

[`BpmnError`](#bpmnerror).[`constructor`](#constructor-6)

#### Properties

##### code

```ts
readonly code: string;
```

###### Inherited from

[`BpmnError`](#bpmnerror).[`code`](#code-1)

***

### NodeTypeRegistry

Registry of node types. The core registers the standard BPMN set; plugins
add domain-specific types at runtime.

#### Constructors

##### Constructor

```ts
new NodeTypeRegistry(): NodeTypeRegistry;
```

###### Returns

[`NodeTypeRegistry`](#nodetyperegistry)

#### Methods

##### register()

```ts
register(definition): void;
```

###### Parameters

###### definition

[`NodeTypeDefinition`](#nodetypedefinition)

###### Returns

`void`

##### has()

```ts
has(type): boolean;
```

###### Parameters

###### type

`string`

###### Returns

`boolean`

##### get()

```ts
get(type): NodeTypeDefinition;
```

###### Parameters

###### type

`string`

###### Returns

[`NodeTypeDefinition`](#nodetypedefinition)

##### list()

```ts
list(): NodeTypeDefinition[];
```

###### Returns

[`NodeTypeDefinition`](#nodetypedefinition)[]

##### typeForXmlTag()

```ts
typeForXmlTag(tag, preferred?): NodeTypeDefinition | undefined;
```

Finds the first type whose XML tag matches. When several types share a tag
(e.g. custom types mapped onto `userTask`), the `preferred` list wins.

###### Parameters

###### tag

`string`

###### preferred?

`string`[] = `[]`

###### Returns

[`NodeTypeDefinition`](#nodetypedefinition) \| `undefined`

***

### BpmnXmlConverter

Bidirectional converter between the bpmn-react model and BPMN 2.0 XML.

Scope: the documented MVP profile (see docs/format-spec.md) — process
elements from the standard set, sequence flows, full BPMN DI (shapes,
bounds, edge waypoints) and vendor extensions inside `extensionElements`.
Interoperable with Camunda Modeler / bpmn.io: unknown elements are ignored
with warnings rather than rejected.

This class is a thin orchestrator: it frames the document (definitions,
collaboration, process, DI) and delegates the actual element work to focused
collaborators — ElementSerializer / ElementDeserializer for
the semantic model, DIHandler for geometry, and ExtensionHandler for the `bpmnr:*` extension encoding.

#### Constructors

##### Constructor

```ts
new BpmnXmlConverter(options?): BpmnXmlConverter;
```

###### Parameters

###### options?

[`XmlConverterOptions`](#xmlconverteroptions) = `{}`

###### Returns

[`BpmnXmlConverter`](#bpmnxmlconverter)

#### Methods

##### toXml()

```ts
toXml(diagram): string;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

`string`

##### fromXml()

```ts
fromXml(xmlText): ImportResult;
```

###### Parameters

###### xmlText

`string`

###### Returns

[`ImportResult`](#importresult)

***

### JsonSerializer

Pluggable serialization seam (JSON and XML ship built-in).

#### Implements

- [`Serializer`](#serializer)\<`string`\>

#### Constructors

##### Constructor

```ts
new JsonSerializer(): JsonSerializer;
```

###### Returns

[`JsonSerializer`](#jsonserializer)

#### Methods

##### serialize()

```ts
serialize(diagram): string;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

`string`

###### Implementation of

[`Serializer`](#serializer).[`serialize`](#serialize)

##### deserialize()

```ts
deserialize(data): BpmnDiagram;
```

###### Parameters

###### data

`string`

###### Returns

[`BpmnDiagram`](#bpmndiagram)

###### Implementation of

[`Serializer`](#serializer).[`deserialize`](#deserialize)

***

### MiniXmlParser

Minimal, dependency-free XML parser covering the subset needed for BPMN
documents: elements, attributes (single/double quotes), namespaced names,
character data, CDATA sections, comments, processing instructions and the
five predefined entities plus numeric character references.

Security: any `<!DOCTYPE`/DTD is rejected outright, which makes the parser
immune to XXE and entity-expansion attacks by construction.

#### Constructors

##### Constructor

```ts
new MiniXmlParser(): MiniXmlParser;
```

###### Returns

[`MiniXmlParser`](#minixmlparser)

#### Methods

##### parse()

```ts
parse(xml): XmlElement;
```

###### Parameters

###### xml

`string`

###### Returns

[`XmlElement`](#xmlelement)

***

### XmlBuilder

Incremental XML writer with automatic escaping and indentation.
Undefined attribute values are skipped, so callers can pass optional
fields without pre-filtering.

#### Constructors

##### Constructor

```ts
new XmlBuilder(options?): XmlBuilder;
```

###### Parameters

###### options?

###### indent?

`string`

###### declaration?

`boolean`

###### Returns

[`XmlBuilder`](#xmlbuilder)

#### Methods

##### open()

```ts
open(tag, attributes?): this;
```

Opens a container element; must be balanced with [close](#close).

###### Parameters

###### tag

`string`

###### attributes?

[`XmlAttributes`](#xmlattributes) = `{}`

###### Returns

`this`

##### element()

```ts
element(
   tag, 
   attributes?, 
   text?): this;
```

Writes a self-closing element, or one with escaped text content.

###### Parameters

###### tag

`string`

###### attributes?

[`XmlAttributes`](#xmlattributes) = `{}`

###### text?

`string`

###### Returns

`this`

##### close()

```ts
close(): this;
```

###### Returns

`this`

##### toString()

```ts
toString(): string;
```

###### Returns

`string`

***

### MiniXmlAdapter

Environment-agnostic XML parsing seam. The bundled [MiniXmlAdapter](#minixmladapter)
works everywhere (browser, Node, workers); [DomXmlAdapter](#domxmladapter) delegates
to the browser's native `DOMParser` for hosts that prefer it.

#### Implements

- [`XmlParserAdapter`](#xmlparseradapter)

#### Constructors

##### Constructor

```ts
new MiniXmlAdapter(): MiniXmlAdapter;
```

###### Returns

[`MiniXmlAdapter`](#minixmladapter)

#### Methods

##### parse()

```ts
parse(xml): XmlElement;
```

###### Parameters

###### xml

`string`

###### Returns

[`XmlElement`](#xmlelement)

###### Implementation of

[`XmlParserAdapter`](#xmlparseradapter).[`parse`](#parse-1)

***

### DomXmlAdapter

Environment-agnostic XML parsing seam. The bundled [MiniXmlAdapter](#minixmladapter)
works everywhere (browser, Node, workers); [DomXmlAdapter](#domxmladapter) delegates
to the browser's native `DOMParser` for hosts that prefer it.

#### Implements

- [`XmlParserAdapter`](#xmlparseradapter)

#### Constructors

##### Constructor

```ts
new DomXmlAdapter(): DomXmlAdapter;
```

###### Returns

[`DomXmlAdapter`](#domxmladapter)

#### Methods

##### parse()

```ts
parse(xml): XmlElement;
```

###### Parameters

###### xml

`string`

###### Returns

[`XmlElement`](#xmlelement)

###### Implementation of

[`XmlParserAdapter`](#xmlparseradapter).[`parse`](#parse-1)

## Interfaces

### AuditEntry

#### Properties

##### id

```ts
id: string;
```

##### seq

```ts
seq: number;
```

Position in the chain, starting at 0.

##### type

```ts
type: string;
```

##### timestamp

```ts
timestamp: string;
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

##### previousHash

```ts
previousHash: string;
```

##### hash

```ts
hash: string;
```

##### hashVersion?

```ts
optional hashVersion?: 2;
```

Hash-recipe version. `2` = exact canonical JSON over the whole entry
(no numeric rounding, no delimiter ambiguity). Absent = legacy v1
(`|`-joined fields with rounded `details`), kept verifiable forever.

***

### AuditEntryInput

#### Properties

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

##### details?

```ts
optional details?: Record<string, unknown>;
```

***

### LedgerVerification

#### Properties

##### valid

```ts
valid: boolean;
```

##### brokenAt?

```ts
optional brokenAt?: number;
```

Sequence number of the first broken entry, when invalid.

***

### AuditSink

Optional external persistence for ledger entries (database, API, file…).

#### Methods

##### write()

```ts
write(entry): void | Promise<void>;
```

###### Parameters

###### entry

[`AuditEntry`](#auditentry)

###### Returns

`void` \| `Promise`\<`void`\>

***

### CommandStackOptions

#### Properties

##### bus?

```ts
optional bus?: EventBus;
```

##### interceptor?

```ts
optional interceptor?: CommandInterceptor;
```

##### limit?

```ts
optional limit?: number;
```

Maximum number of commands kept for undo. Default 200.

***

### CommandStackEvent

#### Properties

##### command

```ts
command: Command;
```

##### diagram

```ts
diagram: BpmnDiagram;
```

***

### NodePatch

#### Properties

##### label?

```ts
optional label?: string;
```

##### properties?

```ts
optional properties?: Record<string, unknown>;
```

***

### EdgePatch

#### Properties

##### label?

```ts
optional label?: string;
```

##### purpose?

```ts
optional purpose?: string;
```

##### properties?

```ts
optional properties?: Record<string, unknown>;
```

##### waypoints?

```ts
optional waypoints?: Point[] | null;
```

Routed waypoints (Handoff 10 R-2b). `null` clears them back to auto.

***

### EventDefinitionRemovalCommand

Marker the default rules use to veto a referenced-definition removal with
the honest usage list (id + label per node) — see `registerDefaultRules`.

#### Extends

- [`Command`](#command-1)

#### Properties

##### eventDefinitionRemoval

```ts
eventDefinitionRemoval: object;
```

###### kind

```ts
kind: "error" | "message" | "signal" | "escalation";
```

###### definitionId

```ts
definitionId: string;
```

##### id

```ts
id: string;
```

###### Inherited from

[`Command`](#command-1).[`id`](#id-2)

##### description

```ts
description: string;
```

###### Inherited from

[`Command`](#command-1).[`description`](#description-1)

#### Methods

##### execute()

```ts
execute(diagram): BpmnDiagram;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`BpmnDiagram`](#bpmndiagram)

###### Inherited from

[`Command`](#command-1).[`execute`](#execute-2)

##### undo()

```ts
undo(diagram): BpmnDiagram;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`BpmnDiagram`](#bpmndiagram)

###### Inherited from

[`Command`](#command-1).[`undo`](#undo-2)

##### toAuditEvent()?

```ts
optional toAuditEvent(): object;
```

Optional structured payload for the audit ledger.

###### Returns

`object`

###### type

```ts
type: string;
```

###### details

```ts
details: Record<string, unknown>;
```

###### Inherited from

[`Command`](#command-1).[`toAuditEvent`](#toauditevent-1)

***

### Command

A command is a reversible, pure transformation of the diagram.
`execute`/`undo` must not mutate their input — they return new diagram
objects with structural sharing (spread only what changed).

#### Extended by

- [`EventDefinitionRemovalCommand`](#eventdefinitionremovalcommand)

#### Properties

##### id

```ts
id: string;
```

##### description

```ts
description: string;
```

#### Methods

##### execute()

```ts
execute(diagram): BpmnDiagram;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`BpmnDiagram`](#bpmndiagram)

##### undo()

```ts
undo(diagram): BpmnDiagram;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`BpmnDiagram`](#bpmndiagram)

##### toAuditEvent()?

```ts
optional toAuditEvent(): object;
```

Optional structured payload for the audit ledger.

###### Returns

`object`

###### type

```ts
type: string;
```

###### details

```ts
details: Record<string, unknown>;
```

***

### RuleVerdict

#### Properties

##### allowed

```ts
allowed: boolean;
```

##### reason?

```ts
optional reason?: string;
```

***

### CommandInterceptor

Evaluated before a command executes; a negative verdict vetoes it.
Implemented by the RuleEngine, kept as an interface here so the command
layer has no dependency on the engine layer.

#### Methods

##### evaluateCommand()

```ts
evaluateCommand(command, diagram): RuleVerdict;
```

###### Parameters

###### command

[`Command`](#command-1)

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

[`RuleVerdict`](#ruleverdict)

***

### DiffEntry

#### Properties

##### kind

```ts
kind: DiffKind;
```

##### elementKind

```ts
elementKind: "node" | "edge";
```

##### elementId

```ts
elementId: string;
```

##### label?

```ts
optional label?: string;
```

Label for lists/a11y — target's when present, else the base's.

##### changes?

```ts
optional changes?: Record<string, FieldChange>;
```

ΔN content: field → from/to, excluding x/y/waypoints/removedInVersion.

##### from?

```ts
optional from?: Point;
```

Node position in the BASE version (removed ghost / move origin).

##### to?

```ts
optional to?: Point;
```

Node position in the TARGET version (move destination).

##### moved?

```ts
optional moved?: boolean;
```

`changed` entries that ALSO moved — render draws halo + origin arrow.

***

### FieldChange

#### Properties

##### from

```ts
from: unknown;
```

##### to

```ts
to: unknown;
```

***

### BpmnDiff

#### Properties

##### nodes

```ts
nodes: NodeDiffOp[];
```

##### edges

```ts
edges: EdgeDiffOp[];
```

##### metadata

```ts
metadata: Record<string, FieldChange>;
```

***

### NormalizedDiagramContent

#### Properties

##### nodes

```ts
nodes: unknown[];
```

##### edges

```ts
edges: unknown[];
```

##### definitions?

```ts
optional definitions?: unknown;
```

Named event definitions (§3a) — present only when the diagram has them.

***

### AgentGateRuleOptions

Options for [agentAutonomyGateRule](#agentautonomygaterule).

#### Properties

##### requiresGate

```ts
requiresGate: (autonomyLevel) => boolean;
```

True when an autonomyLevel requires a reachable downstream gate. Inject
`requiresDownstreamGate` from `@buildtovalue/agentflow` (levels 0–3).

###### Parameters

###### autonomyLevel

`number`

###### Returns

`boolean`

##### isGate

```ts
isGate: (node) => boolean;
```

True when a node is a governance gate (e.g. a `btv:gate`). Domain-injected.

###### Parameters

###### node

[`BpmnNode`](#bpmnnode)

###### Returns

`boolean`

##### locale?

```ts
optional locale?: "en" | "pt";
```

Message locale. Default `en`.

***

### AgentGateViolation

An agentTask that violates the autonomy→gate rule.

#### Properties

##### nodeId

```ts
nodeId: string;
```

##### autonomyLevel

```ts
autonomyLevel: number;
```

##### remediation

```ts
remediation: string;
```

Actionable remediation (§4): add a gate, or raise the level.

***

### AgentWorkflowResolution

The outcome of resolving an agentTask's sub-workflow.

#### Properties

##### source

```ts
source: "registry" | "snapshot" | "unresolved";
```

##### workflow?

```ts
optional workflow?: unknown;
```

The resolved sub-workflow JSON (parsed), when resolvable.

##### warning?

```ts
optional warning?: string;
```

Present only when the snapshot was used because the registry did not
resolve — the honest "degraded read" warning (§1.1).

***

### PromotionInput

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### target

```ts
target: VersionStatus;
```

##### actor

```ts
actor: UserContext;
```

##### reason

```ts
reason: string;
```

##### diff?

```ts
optional diff?: unknown;
```

Structured diff vs. the previous version, when the config requires it.

***

### PromotionGate

One requirement of a promotion, in evaluation order. UIs render these as a
checklist; [LifecycleEngine.promote](#promote) throws the `detail` of the first
unsatisfied gate — a single source of truth, never duplicated in the UI.

#### Properties

##### id

```ts
id: 
  | "diff"
  | `rule:${number}`
  | "transition"
  | "approvals"
  | "change-summary";
```

##### label

```ts
label: string;
```

Short human label for checklists.

##### satisfied

```ts
satisfied: boolean;
```

##### detail

```ts
detail: string;
```

Requirement/failure text; when unsatisfied, promote() throws exactly this.

##### required?

```ts
optional required?: number;
```

Approvals gate: distinct roles required.

##### current?

```ts
optional current?: number;
```

Approvals gate: distinct roles collected so far.

***

### LifecycleConfig

#### Properties

##### transitions?

```ts
optional transitions?: Record<VersionStatus, VersionStatus[]>;
```

##### minApprovalRoles?

```ts
optional minApprovalRoles?: number;
```

Distinct approval roles required to reach 'active'. Default 2.

##### minChangeSummaryLength?

```ts
optional minChangeSummaryLength?: number;
```

Minimum changelog length required to reach 'active'. Default 20.

##### requireDiff?

```ts
optional requireDiff?: boolean;
```

Require a diff to be attached when promoting to 'active'. Default false.

##### promotionRules?

```ts
optional promotionRules?: PromotionRule[];
```

Extra rules evaluated on every promotion (after the built-ins).

***

### ConnectPayload

Payload for `edge.connect.pre`.

#### Properties

##### sourceId

```ts
sourceId: string;
```

##### targetId

```ts
targetId: string;
```

##### edgeType?

```ts
optional edgeType?: string;
```

***

### ValidationIssue

#### Properties

##### code

```ts
code: string;
```

##### severity

```ts
severity: IssueSeverity;
```

##### message

```ts
message: string;
```

##### nodeId?

```ts
optional nodeId?: string;
```

##### edgeId?

```ts
optional edgeId?: string;
```

***

### ValidationResult

#### Properties

##### valid

```ts
valid: boolean;
```

##### issues

```ts
issues: ValidationIssue[];
```

***

### FireResult

#### Type Parameters

##### T

`T`

#### Properties

##### cancelled

```ts
cancelled: boolean;
```

##### payload

```ts
payload: T;
```

***

### AStarRouteOptions

#### Properties

##### obstacles?

```ts
optional obstacles?: Rect[];
```

Node bounds to route around (should EXCLUDE the two endpoints).

##### routedEdges?

```ts
optional routedEdges?: Point[][];
```

Waypoints of already-routed edges, for the crossing cost.

##### clearance?

```ts
optional clearance?: number;
```

##### portOffset?

```ts
optional portOffset?: number;
```

##### preferredSourceSide?

```ts
optional preferredSourceSide?: Side;
```

Port hysteresis (§6, R-4): the side pair used by the previous route. When
given with `hysteresis > 0`, the router keeps this pairing unless a
different one is more than `hysteresis` (fraction) cheaper — killing the
flip-flop a small move would otherwise cause.

##### preferredTargetSide?

```ts
optional preferredTargetSide?: Side;
```

##### hysteresis?

```ts
optional hysteresis?: number;
```

Fractional cost improvement required to abandon the preferred pairing.

##### sourcePort?

```ts
optional sourcePort?: object;
```

Forces the source port (parallel corridors, R-4): bypasses source-side
selection so a fan-out can be spread into 8px lanes. The target side is
still chosen by A\*.

###### anchor

```ts
anchor: Point;
```

###### port

```ts
port: Point;
```

###### side

```ts
side: Side;
```

***

### AStarRoute

#### Properties

##### waypoints

```ts
waypoints: Point[];
```

##### routed

```ts
routed: boolean;
```

false when no obstacle-free corridor was found (fallback state).

##### sourceSide?

```ts
optional sourceSide?: Side;
```

Side pair the router settled on — feeds port hysteresis on the next move.

##### targetSide?

```ts
optional targetSide?: Side;
```

***

### BoundaryRect

#### Properties

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

##### width

```ts
width: number;
```

##### height

```ts
height: number;
```

***

### BoundaryAnchor

#### Properties

##### side

```ts
side: BoundarySide;
```

##### t

```ts
t: number;
```

Position along the side: left→right (top/bottom), top→bottom (left/right).

##### point

```ts
point: Point;
```

The anchor point ON the border (the boundary event centers here).

##### distance

```ts
distance: number;
```

Distance from the queried point to the border anchor.

***

### EdgeGeometry

#### Properties

##### path

```ts
path: string;
```

SVG path `d` attribute.

##### start

```ts
start: Point;
```

##### end

```ts
end: Point;
```

##### midpoint

```ts
midpoint: Point;
```

Point suitable for placing a label.

***

### LayoutOptions

Layered auto-layout (referência item 2) — a dependency-free Sugiyama-style
pass: longest-path ranking, barycenter ordering, predecessor-averaged row
placement. Deterministic (stable tie-breaks by id) so the same diagram
always lays out identically.

v1 scope: the TOP process level of a single-process diagram. Diagrams with
pools/lanes keep their manual arrangement (`null` is returned — swimlane
layout is a dedicated post-1.0 effort, pendências §4). Sub-process children
and boundary events follow their host: children keep their offset relative
to the container; boundary events keep their anchor.

#### Properties

##### gapX?

```ts
optional gapX?: number;
```

Horizontal gap between layers. Default 72.

##### gapY?

```ts
optional gapY?: number;
```

Vertical gap between nodes in a layer. Default 40.

##### origin?

```ts
optional origin?: Point;
```

Top-left origin of the arrangement. Default {x: 60, y: 60}.

***

### CreateVersionOptions

#### Properties

##### semanticVersion?

```ts
optional semanticVersion?: string;
```

##### status?

```ts
optional status?: VersionStatus;
```

##### changeSummary?

```ts
optional changeSummary?: string;
```

##### createdBy?

```ts
optional createdBy?: string;
```

##### parentVersionId?

```ts
optional parentVersionId?: string;
```

***

### CreateNodeOptions

#### Properties

##### type

```ts
type: string;
```

##### label?

```ts
optional label?: string;
```

##### x?

```ts
optional x?: number;
```

##### y?

```ts
optional y?: number;
```

##### width?

```ts
optional width?: number;
```

##### height?

```ts
optional height?: number;
```

##### properties?

```ts
optional properties?: Record<string, unknown>;
```

##### createdBy?

```ts
optional createdBy?: string;
```

##### versionId?

```ts
optional versionId?: string;
```

Version the node is created in; defaults to '0' for standalone nodes.

##### id?

```ts
optional id?: string;
```

***

### CreateEdgeOptions

#### Properties

##### sourceId

```ts
sourceId: string;
```

##### targetId

```ts
targetId: string;
```

##### type?

```ts
optional type?: string;
```

##### label?

```ts
optional label?: string;
```

##### purpose?

```ts
optional purpose?: string;
```

##### properties?

```ts
optional properties?: Record<string, unknown>;
```

##### waypoints?

```ts
optional waypoints?: Point[];
```

Fixed routing points (world coordinates).

##### supersedesEdgeId?

```ts
optional supersedesEdgeId?: string;
```

##### createdBy?

```ts
optional createdBy?: string;
```

##### versionId?

```ts
optional versionId?: string;
```

##### id?

```ts
optional id?: string;
```

***

### CreateDiagramOptions

#### Properties

##### name

```ts
name: string;
```

##### description?

```ts
optional description?: string;
```

##### createdBy?

```ts
optional createdBy?: string;
```

##### id?

```ts
optional id?: string;
```

***

### TimerProperty

The canonical timer property of a timer event (E-0 decision 3).

#### Properties

##### kind

```ts
kind: TimerKind;
```

##### expression

```ts
expression: string;
```

***

### DurationParts

Numeric components of a parsed duration (absent units are 0).

#### Properties

##### years

```ts
years: number;
```

##### months

```ts
months: number;
```

##### weeks

```ts
weeks: number;
```

##### days

```ts
days: number;
```

##### hours

```ts
hours: number;
```

##### minutes

```ts
minutes: number;
```

##### seconds

```ts
seconds: number;
```

***

### NodeTypeDefinition

#### Properties

##### type

```ts
type: string;
```

Type key stored on nodes, e.g. 'userTask' or a custom 'myDomain:thing'.

##### label

```ts
label: string;
```

Human-readable label for palettes and inspectors.

##### category

```ts
category: NodeCategory;
```

##### defaultSize

```ts
defaultSize: Size;
```

##### xml

```ts
xml: object;
```

BPMN 2.0 XML mapping. `tag` is the element name inside `<process>` used on
export; on import the same tag maps back to this type. Custom types map to
a standard BPMN tag so exported files stay interoperable — their identity
is preserved via extensionElements.

###### tag

```ts
tag: string;
```

##### visual?

```ts
optional visual?: object;
```

Renderer hints. `shadow` opts a type in/out of the canvas drop shadow;
when omitted, renderers default it to `category === 'activity'` (cards
cast shadows, events/gateways/containers don't).

###### shadow?

```ts
optional shadow?: boolean;
```

***

### Point

#### Extended by

- [`Rect`](#rect)

#### Properties

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

***

### Size

#### Extended by

- [`Rect`](#rect)

#### Properties

##### width

```ts
width: number;
```

##### height

```ts
height: number;
```

***

### Rect

#### Extends

- [`Point`](#point-1).[`Size`](#size)

#### Properties

##### x

```ts
x: number;
```

###### Inherited from

[`Point`](#point-1).[`x`](#x-2)

##### y

```ts
y: number;
```

###### Inherited from

[`Point`](#point-1).[`y`](#y-2)

##### width

```ts
width: number;
```

###### Inherited from

[`Size`](#size).[`width`](#width-2)

##### height

```ts
height: number;
```

###### Inherited from

[`Size`](#size).[`height`](#height-2)

***

### AuditEventRecord

A single recorded change on an element's local audit trail.

#### Properties

##### type

```ts
type: string;
```

##### timestamp

```ts
timestamp: string;
```

ISO-8601 timestamp.

##### userId

```ts
userId: string;
```

##### versionId

```ts
versionId: string;
```

Version in which the change happened.

##### details?

```ts
optional details?: Record<string, unknown>;
```

***

### AuditTrail

#### Properties

##### createdAt

```ts
createdAt: string;
```

##### createdBy

```ts
createdBy: string;
```

##### history

```ts
history: AuditEventRecord[];
```

***

### XmlSubtree

A JSON-serializable XML subtree — the storage shape of FOREIGN extension
elements (`zeebe:*`, `camunda:*`, …) preserved through the round-trip
(passthrough PR). Mirrors the parser's element shape so re-emission is a
pure tree walk. Contract (format-spec §passthrough): text is
whitespace-trimmed at import and CDATA is re-emitted as escaped text —
semantically lossless, byte-stable between OUR exports.

#### Properties

##### tag

```ts
tag: string;
```

Prefixed tag exactly as parsed, e.g. "zeebe:taskDefinition".

##### attributes

```ts
attributes: Record<string, string>;
```

##### children

```ts
children: XmlSubtree[];
```

##### text

```ts
text: string;
```

***

### BpmnNode

#### Properties

##### id

```ts
id: string;
```

##### type

```ts
type: string;
```

Node type key, resolved against the [NodeTypeRegistry](#nodetyperegistry).

##### label

```ts
label: string;
```

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

##### width

```ts
width: number;
```

##### height

```ts
height: number;
```

##### properties

```ts
properties: Record<string, unknown>;
```

Free-form, domain-extensible properties (exported via extensionElements).

##### foreignExtensions?

```ts
optional foreignExtensions?: XmlSubtree[];
```

Foreign `extensionElements` children (non-`bpmnr` namespaces) preserved
verbatim in original order — never interpreted, always re-exported.

##### foreignAttributes?

```ts
optional foreignAttributes?: Record<string, string>;
```

Foreign-prefixed attributes of the source element (e.g. `zeebe:modelerTemplate`).

##### createdInVersion

```ts
createdInVersion: string;
```

Version id in which this node was created. Immutable.

##### removedInVersion?

```ts
optional removedInVersion?: string;
```

Version id in which this node was closed. Present ⇒ node is retired from the flow.

##### audit

```ts
audit: AuditTrail;
```

***

### BpmnEdge

#### Properties

##### id

```ts
id: string;
```

##### type

```ts
type: string;
```

Edge type key: built-ins are 'sequenceFlow', 'messageFlow', 'association'.

##### sourceId

```ts
sourceId: string;
```

##### targetId

```ts
targetId: string;
```

##### label?

```ts
optional label?: string;
```

##### purpose?

```ts
optional purpose?: string;
```

Reason for the handoff this edge represents (auditable metadata).

##### waypoints?

```ts
optional waypoints?: Point[];
```

Optional fixed routing points (world coordinates).

##### properties

```ts
properties: Record<string, unknown>;
```

##### foreignExtensions?

```ts
optional foreignExtensions?: XmlSubtree[];
```

Foreign `extensionElements` children preserved verbatim (passthrough).

##### foreignAttributes?

```ts
optional foreignAttributes?: Record<string, string>;
```

Foreign-prefixed attributes of the source element.

##### createdInVersion

```ts
createdInVersion: string;
```

##### removedInVersion?

```ts
optional removedInVersion?: string;
```

##### supersedesEdgeId?

```ts
optional supersedesEdgeId?: string;
```

Id of the edge this one replaces, forming a substitution chain.

##### audit

```ts
audit: AuditTrail;
```

***

### ApprovalRecord

#### Properties

##### userId

```ts
userId: string;
```

##### role

```ts
role: string;
```

##### approvedAt

```ts
approvedAt: string;
```

##### reason

```ts
reason: string;
```

***

### BpmnVersion

#### Properties

##### id

```ts
id: string;
```

##### semanticVersion

```ts
semanticVersion: string;
```

Semantic version, e.g. "2.3.1".

##### status

```ts
status: VersionStatus;
```

##### effectiveFrom?

```ts
optional effectiveFrom?: string;
```

##### effectiveUntil?

```ts
optional effectiveUntil?: string;
```

##### approvedBy

```ts
approvedBy: ApprovalRecord[];
```

##### changeSummary

```ts
changeSummary: string;
```

Human-readable changelog. Required (min length) for promotion to 'active'.

##### changeSummaryOrigin?

```ts
optional changeSummaryOrigin?: object;
```

Text co-authorship (Handoff 9 C4): set when the summary was PRE-FILLED by
the copilot and then committed by a human interaction with the field —
`edited` says whether the human changed the AI text. Rides into the
VERSION_ACTIVATED ledger entry; absent = fully human text.

###### author

```ts
author: string;
```

###### promptTemplateRef

```ts
promptTemplateRef: object;
```

###### promptTemplateRef.id

```ts
id: string;
```

###### promptTemplateRef.version

```ts
version: string;
```

###### edited

```ts
edited: boolean;
```

##### createdBy

```ts
createdBy: string;
```

##### createdAt

```ts
createdAt: string;
```

##### snapshotHash

```ts
snapshotHash: string;
```

SHA-256 of the normalized diagram content at version creation.

##### parentVersionId?

```ts
optional parentVersionId?: string;
```

***

### NamedEventDefinition

A NAMED event definition of first class (Handoff 16 §3a) — the OMG root
element (`bpmn:message`/`bpmn:signal`) an event references via
`messageRef`/`signalRef`. Events keep their KIND in
`properties.eventDefinition`; the reference to a named definition lives in
`properties.eventDefinitionRef` (the definition's `id` — rename never
touches nodes, E-0 decision 5).

#### Extended by

- [`ErrorEventDefinition`](#erroreventdefinition)
- [`EscalationEventDefinition`](#escalationeventdefinition)

#### Properties

##### id

```ts
id: string;
```

##### name

```ts
name: string;
```

***

### ErrorEventDefinition

`bpmn:error` root element — carries the OMG `errorCode` used by matching.

#### Extends

- [`NamedEventDefinition`](#namedeventdefinition)

#### Properties

##### id

```ts
id: string;
```

###### Inherited from

[`NamedEventDefinition`](#namedeventdefinition).[`id`](#id-10)

##### name

```ts
name: string;
```

###### Inherited from

[`NamedEventDefinition`](#namedeventdefinition).[`name`](#name-1)

##### errorCode?

```ts
optional errorCode?: string;
```

***

### EscalationEventDefinition

`bpmn:escalation` root element (Handoff 18 §5a) — carries the OMG
`escalationCode`, the exact mould of `errorCode` (per-type asymmetry). The
code is optional and OMITTED from the XML when undefined (never an empty
attribute), like `errorCode`. Authority (`escalationAuthority`) is NOT an OMG
concept — it stays a common `bpmnr:property`, never a root attribute.

#### Extends

- [`NamedEventDefinition`](#namedeventdefinition)

#### Properties

##### id

```ts
id: string;
```

###### Inherited from

[`NamedEventDefinition`](#namedeventdefinition).[`id`](#id-10)

##### name

```ts
name: string;
```

###### Inherited from

[`NamedEventDefinition`](#namedeventdefinition).[`name`](#name-1)

##### escalationCode?

```ts
optional escalationCode?: string;
```

***

### EventDefinitions

The named-definition buckets, one per referenceable kind.

#### Properties

##### messages

```ts
messages: NamedEventDefinition[];
```

##### signals

```ts
signals: NamedEventDefinition[];
```

##### errors

```ts
errors: ErrorEventDefinition[];
```

##### escalations?

```ts
optional escalations?: EscalationEventDefinition[];
```

Escalation definitions (Handoff 18 §5a) — the 4th bucket, entering the
SAME single sources as messages/signals/errors (zero fork). OPTIONAL and
additive so pre-existing `definitions` literals stay valid; every read
goes through [eventDefinitionsOf](#eventdefinitionsof), which fills the missing bucket, so
downstream code treats it as always-present. Absent/empty emits nothing —
the pre-existing frozen fixtures stay byte-identical.

***

### BpmnDiagram

#### Properties

##### id

```ts
id: string;
```

##### name

```ts
name: string;
```

##### description

```ts
description: string;
```

##### version

```ts
version: BpmnVersion;
```

##### nodes

```ts
nodes: Record<string, BpmnNode>;
```

##### edges

```ts
edges: Record<string, BpmnEdge>;
```

##### metadata

```ts
metadata: Record<string, unknown>;
```

##### definitions?

```ts
optional definitions?: EventDefinitions;
```

Named event definitions (Handoff 16 §3a): export as OMG root elements,
referenced by events via `properties.eventDefinitionRef`. Optional and
additive — absent keeps every pre-existing hash and export byte-identical.

##### processForeignExtensions?

```ts
optional processForeignExtensions?: XmlSubtree[];
```

Foreign `extensionElements` children of the `<bpmn:process>` element
(e.g. `zeebe:userTaskForm`) preserved verbatim (passthrough).

##### foreignNamespaces?

```ts
optional foreignNamespaces?: Record<string, string>;
```

Foreign `xmlns:*` declarations captured from the imported root
(prefix → uri), re-declared on export in sorted-prefix order.

***

### UserContext

Identifies the acting user for commands, promotions and audit entries.

#### Properties

##### id

```ts
id: string;
```

##### role

```ts
role: string;
```

##### name?

```ts
optional name?: string;
```

***

### XmlConverterOptions

#### Properties

##### registry?

```ts
optional registry?: NodeTypeRegistry;
```

##### adapter?

```ts
optional adapter?: XmlParserAdapter;
```

##### preferredTypes?

```ts
optional preferredTypes?: string[];
```

Custom node types (registered by plugins) that take precedence when an
imported element has no explicit type metadata.

##### extensionNamespace?

```ts
optional extensionNamespace?: object;
```

###### prefix

```ts
prefix: string;
```

###### uri

```ts
uri: string;
```

***

### ImportResult

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### warnings

```ts
warnings: string[];
```

Non-fatal problems found during import (unknown elements, missing refs…).

***

### Serializer

Pluggable serialization seam (JSON and XML ship built-in).

#### Type Parameters

##### T

`T`

#### Methods

##### serialize()

```ts
serialize(diagram): T;
```

###### Parameters

###### diagram

[`BpmnDiagram`](#bpmndiagram)

###### Returns

`T`

##### deserialize()

```ts
deserialize(data): BpmnDiagram;
```

###### Parameters

###### data

`T`

###### Returns

[`BpmnDiagram`](#bpmndiagram)

***

### Snapshot

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### hash

```ts
hash: string;
```

SHA-256 over the canonical diagram content.

##### createdAt

```ts
createdAt: string;
```

##### createdBy

```ts
createdBy: string;
```

***

### XmlElement

Parsed XML element. `tag` keeps the prefix as written (`bpmn:process`);
use [localName](#localname) to compare namespace-agnostically.

#### Properties

##### tag

```ts
tag: string;
```

##### attributes

```ts
attributes: Record<string, string>;
```

##### children

```ts
children: XmlElement[];
```

##### text

```ts
text: string;
```

Concatenated, trimmed character data directly inside this element.

***

### XmlParserAdapter

Environment-agnostic XML parsing seam. The bundled [MiniXmlAdapter](#minixmladapter)
works everywhere (browser, Node, workers); [DomXmlAdapter](#domxmladapter) delegates
to the browser's native `DOMParser` for hosts that prefer it.

#### Methods

##### parse()

```ts
parse(xml): XmlElement;
```

###### Parameters

###### xml

`string`

###### Returns

[`XmlElement`](#xmlelement)

## Type Aliases

### DiffKind

```ts
type DiffKind = "added" | "removed" | "moved" | "changed" | "rerouted";
```

Review-grade semantic diff (Handoff 15 §2a, V-1): classifies the raw
[computeDiff](#computediff) output into the five review categories and returns the
entries in a STABLE graph-reading order — the single list every review
surface consumes (canvas overlay, change-by-change navigation, the Studio
"Mudanças" tab). Headless, deterministic, zero new dependencies;
`computeDiff`/`DiffView` are untouched.

Classification (validated in the V-0 reconciliation):
- node update whose only changes are `x`/`y`            → `moved`
- node update with position AND other fields            → `changed` + `moved: true`
- edge update whose only change is `waypoints`          → `rerouted` (its own
  category — a re-route never pollutes a node's ΔN nor counts as `changed`)
- `removedInVersion` set in the target                  → `removed` (a closed
  element IS removed for review purposes); cleared → `added` (reopened)
- edge supersession                                     → `changed` with a
  `supersededBy` field change
- `changes` NEVER includes `x`/`y`/`waypoints`/`removedInVersion` — its size
  is the ΔN badge.

***

### NodeDiffOp

```ts
type NodeDiffOp = 
  | {
  op: "add";
  node: BpmnNode;
}
  | {
  op: "remove";
  nodeId: string;
}
  | {
  op: "update";
  nodeId: string;
  changes: Record<string, FieldChange>;
};
```

***

### EdgeDiffOp

```ts
type EdgeDiffOp = 
  | {
  op: "add";
  edge: BpmnEdge;
}
  | {
  op: "remove";
  edgeId: string;
}
  | {
  op: "update";
  edgeId: string;
  changes: Record<string, FieldChange>;
}
  | {
  op: "supersede";
  edgeId: string;
  newEdgeId: string;
};
```

***

### PromotionRule

```ts
type PromotionRule = (input) => 
  | RuleVerdict
| Promise<RuleVerdict>;
```

#### Parameters

##### input

[`PromotionInput`](#promotioninput)

#### Returns

  \| [`RuleVerdict`](#ruleverdict)
  \| `Promise`\<[`RuleVerdict`](#ruleverdict)\>

***

### SemverBump

```ts
type SemverBump = "major" | "minor" | "patch";
```

***

### Rule

```ts
type Rule<T> = (payload, diagram) => RuleVerdict;
```

A rule evaluates a payload against the current diagram *before* the
operation happens (`*.pre` hooks) and may veto it with a reason.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### payload

`T`

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`RuleVerdict`](#ruleverdict)

***

### IssueSeverity

```ts
type IssueSeverity = "error" | "warning" | "info";
```

`info` never affects validity — it flags readability/model-hygiene noise.

***

### ValidationRule

```ts
type ValidationRule = (diagram) => ValidationIssue[];
```

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`ValidationIssue`](#validationissue)[]

***

### EventHandler

```ts
type EventHandler<T> = (payload) => unknown;
```

Minimal synchronous event bus with priorities, cancellation and payload
transformation.

Semantics:
- Handlers run in descending priority order (default priority 0).
- A handler returning `false` cancels the event: remaining handlers are
  skipped and `fire()` reports `cancelled: true`.
- A handler returning any other non-undefined value replaces the payload
  for subsequent handlers (payload transformation).
- Audit listeners should subscribe with a low (negative) priority so they
  observe the final payload.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### payload

`T`

#### Returns

`unknown`

***

### BoundarySide

```ts
type BoundarySide = "top" | "right" | "bottom" | "left";
```

Parametric boundary anchoring (Handoff 11 N-1, pendências §6): a boundary
event attaches to a host activity at `side + t ∈ [0,1]` so it can slide
along the border and REFLOW proportionally when the host resizes. The
parametric pair lives in `properties.boundarySide` / `properties.boundaryT`
as EDITOR-ONLY state: the XML profile stays intact (standard absolute DI
coordinates); on import the pair is derived back from the DI geometry.

***

### Side

```ts
type Side = "left" | "right" | "top" | "bottom";
```

***

### AlignMode

```ts
type AlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
```

***

### EventDefinitionRefKind

```ts
type EventDefinitionRefKind = typeof EVENT_DEFINITION_REF_KINDS[number];
```

***

### TimerKind

```ts
type TimerKind = "date" | "duration" | "cycle";
```

ISO 8601 timer expressions — headless parser (Handoff 16 E-5, §3d).
Covers the three OMG timer flavors: `date` (`bpmn:timeDate`, a dateTime),
`duration` (`bpmn:timeDuration`, `PnYnMnDTnHnMnS`) and `cycle`
(`bpmn:timeCycle`, `Rn/…`). The result is STRUCTURED so the editor can
build a human preview without re-parsing — and the P1M (1 month) vs PT1M
(1 minute) trap is decided here, once, with a binding test.
Never throws: any input, however broken, returns `{ valid: false }`.

***

### TimerParseResult

```ts
type TimerParseResult = 
  | {
  valid: true;
  kind: "date";
  date: string;
}
  | {
  valid: true;
  kind: "duration";
  parts: DurationParts;
}
  | {
  valid: true;
  kind: "cycle";
  repetitions: number | null;
  start?: string;
  parts: DurationParts;
}
  | {
  valid: false;
  error: string;
};
```

#### Union Members

##### Type Literal

```ts
{
  valid: true;
  kind: "date";
  date: string;
}
```

***

##### Type Literal

```ts
{
  valid: true;
  kind: "duration";
  parts: DurationParts;
}
```

***

##### Type Literal

```ts
{
  valid: true;
  kind: "cycle";
  repetitions: number | null;
  start?: string;
  parts: DurationParts;
}
```

###### valid

```ts
valid: true;
```

###### kind

```ts
kind: "cycle";
```

###### repetitions

```ts
repetitions: number | null;
```

`null` = unbounded (`R/…`).

###### start?

```ts
optional start?: string;
```

Optional anchor dateTime (`R3/2026-01-01T00:00:00Z/P1D`).

###### parts

```ts
parts: DurationParts;
```

***

##### Type Literal

```ts
{
  valid: false;
  error: string;
}
```

***

### NodeCategory

```ts
type NodeCategory = 
  | "event"
  | "activity"
  | "gateway"
  | "data"
  | "artifact"
  | "container"
  | "custom";
```

***

### VersionStatus

```ts
type VersionStatus = 
  | "draft"
  | "test"
  | "candidate"
  | "in-review"
  | "active"
  | "deprecated"
  | "retired";
```

Lifecycle status of a diagram version. `in-review` (Handoff 15 §2e) is the
EM REVISÃO ⟲ parking state of the request-changes cycle: a candidate whose
approver formally asked for changes; the only way out is re-submission
(back to `candidate`).

***

### EventDefinitionKind

```ts
type EventDefinitionKind = typeof EVENT_DEFINITION_KINDS[number];
```

***

### ActivityMarker

```ts
type ActivityMarker = typeof ACTIVITY_MARKERS[number];
```

***

### XmlAttributes

```ts
type XmlAttributes = Record<string, string | number | boolean | undefined>;
```

## Variables

### DEFAULT\_TRANSITIONS

```ts
const DEFAULT_TRANSITIONS: Record<VersionStatus, VersionStatus[]>;
```

Default transition table. Note the deliberate absence of
`deprecated → active`: direct reactivation is prohibited for audit
integrity — restore by cloning into a new draft and promoting it.

***

### orphanEdgeRule

```ts
const orphanEdgeRule: ValidationRule;
```

Edges must reference nodes that exist in the diagram.

***

### selfConnectionRule

```ts
const selfConnectionRule: ValidationRule;
```

Self-connections are invalid.

***

### missingStartEventRule

```ts
const missingStartEventRule: ValidationRule;
```

A process should have at least one TOP-LEVEL start event — a start event
nested inside a sub-process belongs to that scope and must not satisfy the
outer process.

***

### unreachableNodeRule

```ts
const unreachableNodeRule: ValidationRule;
```

Flow nodes (other than start events) should be reachable. Containers
(pools/lanes) are visual grouping, not flow — never flagged. Boundary events
receive control from their host attachment, not an incoming sequence flow.

***

### eventFlowDirectionRule

```ts
const eventFlowDirectionRule: ValidationRule;
```

End events must not have outgoing flows; start events no incoming.

***

### staleLaneRefRule

```ts
const staleLaneRefRule: ValidationRule;
```

Lane memberships must point at nodes that still exist in the flow.

***

### boundaryEventHostRule

```ts
const boundaryEventHostRule: ValidationRule;
```

Boundary events must attach to a host activity that exists in the flow.

***

### subProcessParentRule

```ts
const subProcessParentRule: ValidationRule;
```

Sub-process containment must be sound: a `parentId` has to point at an
existing, non-removed sub-process, and parent chains must not cycle.

***

### crossScopeEdgeRule

```ts
const crossScopeEdgeRule: ValidationRule;
```

Sequence flows must stay inside one scope: BPMN forbids a flow crossing a
sub-process boundary. A boundary event's scope is its host's scope (it sits
ON the border and its outgoing flows run in the host's container).

***

### BUILT\_IN\_VALIDATION\_RULES

```ts
const BUILT_IN_VALIDATION_RULES: ValidationRule[];
```

***

### DEFAULT\_CLEARANCE

```ts
const DEFAULT_CLEARANCE: 12 = 12;
```

Clearance (px) each obstacle is inflated by before routing.

***

### BOUNDARY\_SNAP\_THRESHOLD

```ts
const BOUNDARY_SNAP_THRESHOLD: 12 = 12;
```

Snap zone for drag-to-attach (px, world units) — spec §2 N-1.

***

### DEFAULT\_PORT\_OFFSET

```ts
const DEFAULT_PORT_OFFSET: 16 = 16;
```

Default length of the perpendicular "port stub" the orthogonal route leaves
on each node before it is allowed to bend. It guarantees the edge — and the
animated token that rides it (Handoff 7) — departs and arrives perpendicular
to the node face, clearing the node body and its rounded corner instead of
grazing across it. This is the cheap variant of `pendencias.md §2`.

***

### EVENT\_DEFINITION\_REF\_KINDS

```ts
const EVENT_DEFINITION_REF_KINDS: readonly ["message", "signal", "error", "escalation"];
```

Named event definitions — headless helpers (Handoff 16 §3a, E-1).
The referenceable kinds map 1:1 to the OMG root elements
(`bpmn:message`/`bpmn:signal`/`bpmn:error`/`bpmn:escalation`) and to the
event KINDS the nodes already carry in `properties.eventDefinition`.
Handoff 18 §5a adds `escalation` as the 4th kind through this SAME single
source (zero fork) — buckets, id prefix, picker and refs follow by
construction.

***

### EVENT\_DEFINITION\_BUCKETS

```ts
const EVENT_DEFINITION_BUCKETS: object;
```

Bucket key of a kind inside [EventDefinitions](#eventdefinitions).

#### Type Declaration

##### message

```ts
readonly message: "messages" = 'messages';
```

##### signal

```ts
readonly signal: "signals" = 'signals';
```

##### error

```ts
readonly error: "errors" = 'errors';
```

##### escalation

```ts
readonly escalation: "escalations" = 'escalations';
```

***

### NON\_FLOW\_TYPES

```ts
const NON_FLOW_TYPES: ReadonlySet<string>;
```

Node types that never take part in the sequence flow.

***

### NON\_FLOW\_EDGE\_TYPES

```ts
const NON_FLOW_EDGE_TYPES: ReadonlySet<string>;
```

Edge types that are not sequence flow (inter-pool / artifact / data links).

***

### BUILT\_IN\_NODE\_TYPES

```ts
const BUILT_IN_NODE_TYPES: NodeTypeDefinition[];
```

***

### BUILT\_IN\_EDGE\_TYPES

```ts
const BUILT_IN_EDGE_TYPES: readonly ["sequenceFlow", "messageFlow", "association"];
```

Built-in edge types. Custom types may be registered by plugins.

***

### EVENT\_DEFINITION\_KINDS

```ts
const EVENT_DEFINITION_KINDS: readonly ["message", "timer", "error", "signal", "escalation", "conditional", "link", "terminate"];
```

BPMN event-definition kinds. An event node (`startEvent`, `endEvent`,
`intermediateCatchEvent`, `intermediateThrowEvent`) carries its kind under
`properties.eventDefinition`; on export it becomes the standard child element
`<bpmn:{kind}EventDefinition/>`, so typed events round-trip with Camunda and
bpmn.io. `undefined`/absent means a plain (none) event.

***

### ACTIVITY\_MARKERS

```ts
const ACTIVITY_MARKERS: readonly ["loop", "parallelMultiInstance", "sequentialMultiInstance"];
```

Activity loop markers (BPMN loopCharacteristics), stored on an activity node
under `properties.marker`. On export they become the standard child element
(`standardLoopCharacteristics` / `multiInstanceLoopCharacteristics`).

***

### EVENT\_NODE\_TYPES

```ts
const EVENT_NODE_TYPES: readonly ["startEvent", "endEvent", "intermediateCatchEvent", "intermediateThrowEvent", "boundaryEvent"];
```

Event node types (built-in). Plugins may register more via `category: 'event'`.

***

### DATA\_ASSOCIATION\_EDGE\_TYPE

```ts
const DATA_ASSOCIATION_EDGE_TYPE: "dataAssociation" = 'dataAssociation';
```

Data associations connect a data element (`dataObject`/`dataStore` or any
plugin type with `category: 'data'`) to an activity. On export they become
the standard `dataInputAssociation`/`dataOutputAssociation` nested in the
activity element, so the direction decides the tag: data → activity is an
input, activity → data an output.

***

### CONTAINER\_NODE\_TYPES

```ts
const CONTAINER_NODE_TYPES: readonly ["pool", "lane"];
```

Node types that act as visual swimlane containers. They are rendered behind
the flow (lower z-order) and map to BPMN `participant` (pool) / `lane`
elements rather than to process flow nodes on export.

***

### BPMN\_NS

```ts
const BPMN_NS: "http://www.omg.org/spec/BPMN/20100524/MODEL" = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
```

***

### BPMNDI\_NS

```ts
const BPMNDI_NS: "http://www.omg.org/spec/BPMN/20100524/DI" = 'http://www.omg.org/spec/BPMN/20100524/DI';
```

***

### DC\_NS

```ts
const DC_NS: "http://www.omg.org/spec/DD/20100524/DC" = 'http://www.omg.org/spec/DD/20100524/DC';
```

***

### DI\_NS

```ts
const DI_NS: "http://www.omg.org/spec/DD/20100524/DI" = 'http://www.omg.org/spec/DD/20100524/DI';
```

***

### DEFAULT\_EXTENSION\_NS

```ts
const DEFAULT_EXTENSION_NS: object;
```

#### Type Declaration

##### prefix

```ts
prefix: string = 'bpmnr';
```

##### uri

```ts
uri: string = 'http://bpmn-react.io/schema/1.0';
```

## Functions

### computeEntryHash()

```ts
function computeEntryHash(entry): Promise<string>;
```

The chain's hash recipe — exported so external verifiers (e.g.
`@buildtovalue/audit`'s `verifyLedger`) recompute entries against the exact
same bytes the ledger signed. The recipe is versioned per entry via
[AuditEntry.hashVersion](#hashversion): new entries use v2 (exact canonical JSON of
the whole entry — no numeric rounding, no delimiter ambiguity); entries
without the field verify against the legacy v1 recipe, so chains written
before v2 remain valid forever.

#### Parameters

##### entry

`Omit`\<[`AuditEntry`](#auditentry), `"hash"`\>

#### Returns

`Promise`\<`string`\>

***

### getEdgeChain()

```ts
function getEdgeChain(diagram, edgeId): BpmnEdge[];
```

Walks the supersession chain containing `edgeId`, oldest first.
Follows `supersedesEdgeId` backwards and scans forward for replacements.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### edgeId

`string`

#### Returns

[`BpmnEdge`](#bpmnedge)[]

***

### addNodeCommand()

```ts
function addNodeCommand(node): Command;
```

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

[`Command`](#command-1)

***

### moveNodeCommand()

```ts
function moveNodeCommand(
   nodeId, 
   from, 
   to): Command;
```

#### Parameters

##### nodeId

`string`

##### from

[`Point`](#point-1)

##### to

[`Point`](#point-1)

#### Returns

[`Command`](#command-1)

***

### resizeNodeCommand()

```ts
function resizeNodeCommand(
   nodeId, 
   from, 
   to): Command;
```

#### Parameters

##### nodeId

`string`

##### from

[`Point`](#point-1) & [`Size`](#size)

##### to

[`Point`](#point-1) & [`Size`](#size)

#### Returns

[`Command`](#command-1)

***

### attachBoundaryCommand()

```ts
function attachBoundaryCommand(
   nodeId, 
   hostId, 
   side, 
   t, 
   position): Command;
```

Attaches an event to a host activity's border as a boundary event
(Handoff 11 N-1, pendências §6): ONE atomic command — type becomes
`boundaryEvent`, `attachedToRef` + the parametric anchor
(`boundarySide`/`boundaryT`, editor-only — never XML) are written and the
node moves onto the border, all in a single undoable step. Re-attaching an
already-attached boundary (new host, or sliding to a new side/t) is the
same command.

#### Parameters

##### nodeId

`string`

##### hostId

`string`

##### side

`"left"` \| `"right"` \| `"top"` \| `"bottom"`

##### t

`number`

##### position

[`Point`](#point-1)

#### Returns

[`Command`](#command-1)

***

### detachBoundaryCommand()

```ts
function detachBoundaryCommand(nodeId, position): Command;
```

Detaches a boundary event from its host (the drag-out gesture): ONE atomic
command — the parametric anchor and `attachedToRef` are cleared, the node
becomes an intermediate catch event at the drop position. Undo restores the
attachment whole.

#### Parameters

##### nodeId

`string`

##### position

[`Point`](#point-1)

#### Returns

[`Command`](#command-1)

***

### updateNodeCommand()

```ts
function updateNodeCommand(nodeId, patch): Command;
```

#### Parameters

##### nodeId

`string`

##### patch

[`NodePatch`](#nodepatch)

#### Returns

[`Command`](#command-1)

***

### updateEdgeCommand()

```ts
function updateEdgeCommand(edgeId, patch): Command;
```

#### Parameters

##### edgeId

`string`

##### patch

[`EdgePatch`](#edgepatch)

#### Returns

[`Command`](#command-1)

***

### addEdgeCommand()

```ts
function addEdgeCommand(edge): Command;
```

#### Parameters

##### edge

[`BpmnEdge`](#bpmnedge)

#### Returns

[`Command`](#command-1)

***

### removeNodeCommand()

```ts
function removeNodeCommand(nodeId, actor?): Command;
```

Removes a node. In a `draft` version the node (and its connected edges) is
hard-deleted; in any other status it is *closed* (`removedInVersion`),
preserving temporal immutability.

#### Parameters

##### nodeId

`string`

##### actor?

[`UserContext`](#usercontext) = `SYSTEM_USER`

#### Returns

[`Command`](#command-1)

***

### removeEdgeCommand()

```ts
function removeEdgeCommand(edgeId, actor?): Command;
```

Removes an edge — hard delete in `draft`, closed otherwise.

#### Parameters

##### edgeId

`string`

##### actor?

[`UserContext`](#usercontext) = `SYSTEM_USER`

#### Returns

[`Command`](#command-1)

***

### supersedeEdgeCommand()

```ts
function supersedeEdgeCommand(
   oldEdgeId, 
   replacement, 
   actor?): Command;
```

Closes `oldEdgeId` and adds `replacement` (which must reference the old edge
via `supersedesEdgeId`) as a single reversible step.

#### Parameters

##### oldEdgeId

`string`

##### replacement

[`BpmnEdge`](#bpmnedge)

##### actor?

[`UserContext`](#usercontext) = `SYSTEM_USER`

#### Returns

[`Command`](#command-1)

***

### compositeCommand()

```ts
function compositeCommand(description, commands): Command;
```

Groups several commands into a single undo/redo step (e.g. a gesture that
adds an edge and updates node properties atomically).

#### Parameters

##### description

`string`

##### commands

[`Command`](#command-1)[]

#### Returns

[`Command`](#command-1)

***

### restoreDiagramCommand()

```ts
function restoreDiagramCommand(snapshot, description?): Command;
```

Replaces the whole diagram with a snapshot — the undoable path for
restoring an autosaved draft (editor resilience). `undo` returns the
diagram as it was at execution time, captured on `execute`.

#### Parameters

##### snapshot

[`BpmnDiagram`](#bpmndiagram)

##### description?

`string` = `'Restore autosaved draft'`

#### Returns

[`Command`](#command-1)

***

### addEventDefinitionCommand()

```ts
function addEventDefinitionCommand(kind, definition): Command;
```

Adds a named definition (the «+» flow builds the auto id via `nextEventDefinitionId`).

#### Parameters

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

##### definition

`EditableDefinition`

#### Returns

[`Command`](#command-1)

***

### updateEventDefinitionCommand()

```ts
function updateEventDefinitionCommand(
   kind, 
   definitionId, 
   patch): Command;
```

Rename / errorCode / escalationCode patch — nodes reference by ID, so nothing else moves.

#### Parameters

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

##### definitionId

`string`

##### patch

###### name?

`string`

###### errorCode?

`string`

###### escalationCode?

`string`

#### Returns

[`Command`](#command-1)

***

### removeEventDefinitionCommand()

```ts
function removeEventDefinitionCommand(kind, definitionId): EventDefinitionRemovalCommand;
```

Removes a definition. When ANY active event still references it, the
default `command.pre` rule vetoes with the usage list — deletion is never
silent and never cascades (§3a: excluir bloqueado listando usos).

#### Parameters

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

##### definitionId

`string`

#### Returns

[`EventDefinitionRemovalCommand`](#eventdefinitionremovalcommand)

***

### isEventDefinitionRemoval()

```ts
function isEventDefinitionRemoval(command): command is EventDefinitionRemovalCommand;
```

Structural type guard for the removal marker (used by the default rule).

#### Parameters

##### command

[`Command`](#command-1)

#### Returns

`command is EventDefinitionRemovalCommand`

***

### diffDiagrams()

```ts
function diffDiagrams(base, target): DiffEntry[];
```

The V-1 entry point: classified, deterministically ordered review diff.
Ordering: topological graph-reading rank (target graph; elements absent
from the target rank by the BASE graph), ties broken by base-version
position (y, then x), then nodes before their edges, then id — a pure
function of content, proven by the shuffle test.

#### Parameters

##### base

[`BpmnDiagram`](#bpmndiagram)

##### target

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`DiffEntry`](#diffentry)[]

***

### isEmptyDiff()

```ts
function isEmptyDiff(diff): boolean;
```

#### Parameters

##### diff

[`BpmnDiff`](#bpmndiff)

#### Returns

`boolean`

***

### computeDiff()

```ts
function computeDiff(before, after): BpmnDiff;
```

Structured diff between two diagram states. Superseded edges are reported
as a single `supersede` operation (old edge id → replacement id) instead of
an unrelated remove+add pair.

#### Parameters

##### before

[`BpmnDiagram`](#bpmndiagram)

##### after

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`BpmnDiff`](#bpmndiff)

***

### edgeVersionDiff()

```ts
function edgeVersionDiff(before, after): BpmnDiff;
```

Diff between two ADJACENT versions of an edge in a supersession chain
(Handoff 5 §5 — the pedigree strip's DiffView plug): the supersede op
plus the field changes between the two edge objects, in the same BpmnDiff
shape the DiffView already renders.

#### Parameters

##### before

[`BpmnEdge`](#bpmnedge)

##### after

[`BpmnEdge`](#bpmnedge)

#### Returns

[`BpmnDiff`](#bpmndiff)

***

### normalizeForDiff()

```ts
function normalizeForDiff(diagram): NormalizedDiagramContent;
```

Canonical, comparison-friendly projection of a diagram's *content* —
elements sorted by id, coordinates rounded, audit trails and version
metadata stripped. Used to verify XML round-trips.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`NormalizedDiagramContent`](#normalizeddiagramcontent)

***

### agentAutonomyLevelOf()

```ts
function agentAutonomyLevelOf(node): number | undefined;
```

The autonomyLevel stored on an agentTask node, if present and numeric.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`number` \| `undefined`

***

### agentTasksOf()

```ts
function agentTasksOf(diagram): BpmnNode[];
```

Every agentTask node in the diagram.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`BpmnNode`](#bpmnnode)[]

***

### reachableGateFrom()

```ts
function reachableGateFrom(
   diagram, 
   startId, 
   isGate): boolean;
```

True when a node satisfying `isGate` is reachable downstream of `startId`
along sequence flows (forward BFS). "A jusante no processo" (§4).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### startId

`string`

##### isGate

(`node`) => `boolean`

#### Returns

`boolean`

***

### agentGateViolations()

```ts
function agentGateViolations(diagram, options): AgentGateViolation[];
```

Finds every agentTask whose autonomyLevel requires a downstream gate (§4)
but has none reachable. Drives both the promotion rule and the react
inspector's error-with-remediation.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### options

[`AgentGateRuleOptions`](#agentgateruleoptions)

#### Returns

[`AgentGateViolation`](#agentgateviolation)[]

***

### agentAutonomyGateRule()

```ts
function agentAutonomyGateRule(options): PromotionRule;
```

Promotion gate (§4, §1.5): an agentTask at autonomyLevel ≤ 3 without a
reachable downstream btv:gate is an ERROR that blocks promotion to `active`
through the existing LifecycleEngine — drop it into
`lifecycleConfig.promotionRules` and `evaluateGates`/`promote` enforce it
like any other gate (same shape as `soundnessPromotionRule`). The error
always carries an exact remediation.

#### Parameters

##### options

[`AgentGateRuleOptions`](#agentgateruleoptions)

#### Returns

[`PromotionRule`](#promotionrule)

***

### resolveAgentWorkflow()

```ts
function resolveAgentWorkflow(
   node, 
   resolveFromRegistry, 
   locale?): AgentWorkflowResolution;
```

Resolves an agentTask's sub-workflow (Handoff 12 §1.1). The Library/registry
is ALWAYS the source of truth — pass a `resolveFromRegistry` that looks up the
`agentWorkflowRef`. The embedded snapshot is used ONLY as a degraded read when
the registry does not resolve, and always with a warning; it is never the
source of truth. Neither available → `unresolved` (the CALL_REF_MISSING-style
broken reference the react layer badges).

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

##### resolveFromRegistry

(`ref`) => `unknown`

##### locale?

`"en"` \| `"pt"`

#### Returns

[`AgentWorkflowResolution`](#agentworkflowresolution)

***

### bumpSemver()

```ts
function bumpSemver(version, bump): string;
```

#### Parameters

##### version

`string`

##### bump

[`SemverBump`](#semverbump)

#### Returns

`string`

***

### computeDiagramHash()

```ts
function computeDiagramHash(diagram): Promise<string>;
```

Content hash of the diagram (nodes + edges + identity, audit excluded).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

`Promise`\<`string`\>

***

### registerDefaultRules()

```ts
function registerDefaultRules(engine): void;
```

Registers the built-in governance rules:
- diagrams in a locked status (active/deprecated/retired) cannot be edited
  directly — clone to a new draft instead;
- a node cannot connect to itself.

#### Parameters

##### engine

[`RuleEngine`](#ruleengine)

#### Returns

`void`

***

### createDefaultRuleEngine()

```ts
function createDefaultRuleEngine(): RuleEngine;
```

Convenience: a RuleEngine with the default rules pre-registered.

#### Returns

[`RuleEngine`](#ruleengine)

***

### unknownTypeRule()

```ts
function unknownTypeRule(registry): ValidationRule;
```

Every node type must exist in the given registry.

#### Parameters

##### registry

[`NodeTypeRegistry`](#nodetyperegistry)

#### Returns

[`ValidationRule`](#validationrule)

***

### routeAStar()

```ts
function routeAStar(
   source, 
   target, 
   options?): AStarRoute;
```

Routes an orthogonal, obstacle-avoiding path from `source` to `target`.
Tries every free port-side pairing and keeps the minimum-cost route, so the
anchor side is the one A\* actually prefers (§6). Deterministic.

#### Parameters

##### source

[`Rect`](#rect)

##### target

[`Rect`](#rect)

##### options?

[`AStarRouteOptions`](#astarrouteoptions) = `{}`

#### Returns

[`AStarRoute`](#astarroute)

***

### boundaryPositionOf()

```ts
function boundaryPositionOf(
   host, 
   side, 
   t): Point;
```

The border point of a host rect for a parametric anchor.

#### Parameters

##### host

[`BoundaryRect`](#boundaryrect)

##### side

[`BoundarySide`](#boundaryside)

##### t

`number`

#### Returns

[`Point`](#point-1)

***

### nearestBoundaryAnchor()

```ts
function nearestBoundaryAnchor(host, point): BoundaryAnchor;
```

The nearest parametric border anchor of `host` for a world point — always
returns the best of the four sides; callers decide the snap by comparing
`distance` against [BOUNDARY\_SNAP\_THRESHOLD](#boundary_snap_threshold).

#### Parameters

##### host

[`BoundaryRect`](#boundaryrect)

##### point

[`Point`](#point-1)

#### Returns

[`BoundaryAnchor`](#boundaryanchor)

***

### boundaryAnchorOf()

```ts
function boundaryAnchorOf(host, node): object;
```

The parametric anchor of an attached boundary node: the STORED pair when
present (attach/slide wrote it), otherwise derived from geometry — which is
exactly how imported diagrams (absolute DI coordinates, no editor state)
regain the parametric model.

#### Parameters

##### host

[`BoundaryRect`](#boundaryrect)

##### node

`Pick`\<[`BpmnNode`](#bpmnnode), `"x"` \| `"y"` \| `"width"` \| `"height"` \| `"properties"`\>

#### Returns

`object`

##### side

```ts
side: BoundarySide;
```

##### t

```ts
t: number;
```

***

### boundaryNodePosition()

```ts
function boundaryNodePosition(
   host, 
   side, 
   t, 
   size): Point;
```

Top-left position that centers a node of `size` on the border anchor.

#### Parameters

##### host

[`BoundaryRect`](#boundaryrect)

##### side

[`BoundarySide`](#boundaryside)

##### t

`number`

##### size

###### width

`number`

###### height

`number`

#### Returns

[`Point`](#point-1)

***

### clamp()

```ts
function clamp(
   value, 
   min, 
   max): number;
```

#### Parameters

##### value

`number`

##### min

`number`

##### max

`number`

#### Returns

`number`

***

### distance()

```ts
function distance(a, b): number;
```

#### Parameters

##### a

[`Point`](#point-1)

##### b

[`Point`](#point-1)

#### Returns

`number`

***

### rectCenter()

```ts
function rectCenter(rect): Point;
```

#### Parameters

##### rect

[`Rect`](#rect)

#### Returns

[`Point`](#point-1)

***

### getAnchorSide()

```ts
function getAnchorSide(rect, towards): Side;
```

Picks the side of `rect` facing `towards` by comparing the normalized
deltas (dx/width vs dy/height), so wide/flat shapes prefer horizontal
anchors and tall shapes prefer vertical ones.

#### Parameters

##### rect

[`Rect`](#rect)

##### towards

[`Point`](#point-1)

#### Returns

[`Side`](#side-1)

***

### getAnchorPoint()

```ts
function getAnchorPoint(rect, towards): object;
```

Midpoint of the rect side that faces `towards`.

#### Parameters

##### rect

[`Rect`](#rect)

##### towards

[`Point`](#point-1)

#### Returns

`object`

##### point

```ts
point: Point;
```

##### side

```ts
side: Side;
```

***

### straightConnection()

```ts
function straightConnection(source, target): EdgeGeometry;
```

Straight-line connection between two rectangles, anchored on their borders
— the DMN DRD routing (requirement edges are straight per spec; Handoff 5
§4.1). No bends, no curvature.

#### Parameters

##### source

[`Rect`](#rect)

##### target

[`Rect`](#rect)

#### Returns

[`EdgeGeometry`](#edgegeometry)

***

### cubicBezierConnection()

```ts
function cubicBezierConnection(source, target): EdgeGeometry;
```

Cubic Bézier connection between two rectangles. Control points extend
outward along each anchor side's normal with adaptive curvature.

#### Parameters

##### source

[`Rect`](#rect)

##### target

[`Rect`](#rect)

#### Returns

[`EdgeGeometry`](#edgegeometry)

***

### cubicBezierPoint()

```ts
function cubicBezierPoint(
   p0, 
   p1, 
   p2, 
   p3, 
   t): Point;
```

#### Parameters

##### p0

[`Point`](#point-1)

##### p1

[`Point`](#point-1)

##### p2

[`Point`](#point-1)

##### p3

[`Point`](#point-1)

##### t

`number`

#### Returns

[`Point`](#point-1)

***

### collapseWaypoints()

```ts
function collapseWaypoints(points): Point[];
```

Removes consecutive duplicate and collinear waypoints.

#### Parameters

##### points

[`Point`](#point-1)[]

#### Returns

[`Point`](#point-1)[]

***

### routeOrthogonal()

```ts
function routeOrthogonal(
   source, 
   target, 
   portOffset?): Point[];
```

Orthogonal (Manhattan) route between two rectangles: an L / Z path routed
through a midpoint, with redundant waypoints collapsed.

A `portOffset` (default [DEFAULT\_PORT\_OFFSET](#default_port_offset)) pushes the source/target
anchors outward along their side normals before the midpoint bends are
computed, so the first and last segments always leave/enter the node
perpendicular for at least that distance. On collinear (straight) routes the
stub collapses away, so straight edges are unchanged. The offset is clamped
to half the anchor-to-anchor distance so it never overshoots the far node on
tightly packed layouts.

#### Parameters

##### source

[`Rect`](#rect)

##### target

[`Rect`](#rect)

##### portOffset?

`number` = `DEFAULT_PORT_OFFSET`

#### Returns

[`Point`](#point-1)[]

***

### waypointsToPath()

```ts
function waypointsToPath(points, cornerRadius?): string;
```

Converts waypoints to an SVG path. With `cornerRadius > 0` each interior
bend is rounded with a quadratic curve; the radius is clamped to half of
the shorter adjacent segment so short segments never overlap. Radius 0
(the default) emits the plain polyline unchanged.

#### Parameters

##### points

[`Point`](#point-1)[]

##### cornerRadius?

`number` = `0`

#### Returns

`string`

***

### orthogonalConnection()

```ts
function orthogonalConnection(
   source, 
   target, 
   options?): EdgeGeometry;
```

#### Parameters

##### source

[`Rect`](#rect)

##### target

[`Rect`](#rect)

##### options?

###### cornerRadius?

`number`

###### portOffset?

`number`

#### Returns

[`EdgeGeometry`](#edgegeometry)

***

### getBoundingBox()

```ts
function getBoundingBox(rects): Rect;
```

#### Parameters

##### rects

[`Rect`](#rect)[]

#### Returns

[`Rect`](#rect)

***

### rectContains()

```ts
function rectContains(rect, point): boolean;
```

#### Parameters

##### rect

[`Rect`](#rect)

##### point

[`Point`](#point-1)

#### Returns

`boolean`

***

### rectsIntersect()

```ts
function rectsIntersect(a, b): boolean;
```

#### Parameters

##### a

[`Rect`](#rect)

##### b

[`Rect`](#rect)

#### Returns

`boolean`

***

### snapToGrid()

```ts
function snapToGrid(value, gridSize): number;
```

Snaps a value to the nearest multiple of `gridSize` (no-op for gridSize ≤ 0).

#### Parameters

##### value

`number`

##### gridSize

`number`

#### Returns

`number`

***

### computeLayeredLayout()

```ts
function computeLayeredLayout(diagram, options?): Map<string, Point> | null;
```

Computes new positions for the layout scope. Returns `null` when the
diagram is outside the v1 scope (has pools/lanes) or has nothing to lay
out; otherwise a map of nodeId → new top-left position covering every
repositioned node (top-level flow nodes, their sub-process children and
attached boundary events).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### options?

[`LayoutOptions`](#layoutoptions) = `{}`

#### Returns

`Map`\<`string`, [`Point`](#point-1)\> \| `null`

***

### alignPositions()

```ts
function alignPositions(nodes, mode): Map<string, Point>;
```

New positions aligning `nodes` on the given edge/axis (2+ nodes).

#### Parameters

##### nodes

[`BpmnNode`](#bpmnnode)[]

##### mode

[`AlignMode`](#alignmode)

#### Returns

`Map`\<`string`, [`Point`](#point-1)\>

***

### distributePositions()

```ts
function distributePositions(nodes, axis): Map<string, Point>;
```

New positions spreading `nodes` evenly along the axis (3+ nodes).

#### Parameters

##### nodes

[`BpmnNode`](#bpmnnode)[]

##### axis

`"horizontal"` \| `"vertical"`

#### Returns

`Map`\<`string`, [`Point`](#point-1)\>

***

### emptyEventDefinitions()

```ts
function emptyEventDefinitions(): EventDefinitions;
```

Empty, frozen-shape buckets — the starting point when `definitions` is absent.

#### Returns

[`EventDefinitions`](#eventdefinitions)

***

### eventDefinitionsOf()

```ts
function eventDefinitionsOf(diagram): Required<EventDefinitions>;
```

The definitions bag of a diagram, tolerant of the absent field AND of the
additive `escalations` bucket being absent from an older literal — every
bucket is filled so callers treat all four as always-present (Handoff 18).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

`Required`\<[`EventDefinitions`](#eventdefinitions)\>

***

### eventDefinitionList()

```ts
function eventDefinitionList(diagram, kind): readonly (
  | NamedEventDefinition
  | ErrorEventDefinition
  | EscalationEventDefinition)[];
```

Definition list of one kind (empty array when absent).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

#### Returns

readonly (
  \| [`NamedEventDefinition`](#namedeventdefinition)
  \| [`ErrorEventDefinition`](#erroreventdefinition)
  \| [`EscalationEventDefinition`](#escalationeventdefinition))[]

***

### findEventDefinition()

```ts
function findEventDefinition(
   diagram, 
   kind, 
   id): 
  | NamedEventDefinition
  | ErrorEventDefinition
  | EscalationEventDefinition
  | undefined;
```

Lookup by id inside a kind's bucket.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

##### id

`string`

#### Returns

  \| [`NamedEventDefinition`](#namedeventdefinition)
  \| [`ErrorEventDefinition`](#erroreventdefinition)
  \| [`EscalationEventDefinition`](#escalationeventdefinition)
  \| `undefined`

***

### nextEventDefinitionId()

```ts
function nextEventDefinitionId(diagram, kind): string;
```

Next collision-safe auto id for the «+» flow: `msg-1`, `msg-2`, … scanning
the existing bucket (imported ids of any shape never collide — the counter
skips taken ids).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

#### Returns

`string`

***

### eventDefinitionRefOf()

```ts
function eventDefinitionRefOf(node): string | undefined;
```

The named-definition reference of an event node, when present.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`string` \| `undefined`

***

### eventDefinitionUsages()

```ts
function eventDefinitionUsages(
   diagram, 
   kind, 
   id): object[];
```

Every ACTIVE node referencing the definition (id + label, for honest veto
messages): the kind must match the bucket, so an id reused across kinds
never cross-matches.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### kind

`"error"` \| `"message"` \| `"signal"` \| `"escalation"`

##### id

`string`

#### Returns

`object`[]

***

### generateId()

```ts
function generateId(): string;
```

#### Returns

`string`

***

### nowIso()

```ts
function nowIso(): string;
```

#### Returns

`string`

***

### createVersion()

```ts
function createVersion(options?): BpmnVersion;
```

#### Parameters

##### options?

[`CreateVersionOptions`](#createversionoptions) = `{}`

#### Returns

[`BpmnVersion`](#bpmnversion)

***

### createNode()

```ts
function createNode(options, registry?): BpmnNode;
```

#### Parameters

##### options

[`CreateNodeOptions`](#createnodeoptions)

##### registry?

[`NodeTypeRegistry`](#nodetyperegistry) = `...`

#### Returns

[`BpmnNode`](#bpmnnode)

***

### createEdge()

```ts
function createEdge(options): BpmnEdge;
```

#### Parameters

##### options

[`CreateEdgeOptions`](#createedgeoptions)

#### Returns

[`BpmnEdge`](#bpmnedge)

***

### createDiagram()

```ts
function createDiagram(options): BpmnDiagram;
```

#### Parameters

##### options

[`CreateDiagramOptions`](#creatediagramoptions)

#### Returns

[`BpmnDiagram`](#bpmndiagram)

***

### isFlowNode()

```ts
function isFlowNode(node): boolean;
```

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`boolean`

***

### isFlowEdge()

```ts
function isFlowEdge(edge): boolean;
```

#### Parameters

##### edge

[`BpmnEdge`](#bpmnedge)

#### Returns

`boolean`

***

### flowScopeOf()

```ts
function flowScopeOf(diagram, node): string | undefined;
```

Scope a node's flow runs in: a boundary event works in its host's scope.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`string` \| `undefined`

***

### parseTimerExpression()

```ts
function parseTimerExpression(kind, expression): TimerParseResult;
```

Parses a timer expression for its declared kind. Total — never throws.

#### Parameters

##### kind

[`TimerKind`](#timerkind)

##### expression

`string`

#### Returns

[`TimerParseResult`](#timerparseresult)

***

### timerPropertyOf()

```ts
function timerPropertyOf(node): TimerProperty | undefined;
```

The canonical `properties.timer` of a node, when well-shaped. Kind-agnostic
on purpose: the CONVERTER additionally requires the node to be a TIMER
event before emitting OMG children (E-5 reforço 10) — on any other node the
property stays in the ordinary `bpmnr:` soup.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

[`TimerProperty`](#timerproperty) \| `undefined`

***

### createDefaultRegistry()

```ts
function createDefaultRegistry(): NodeTypeRegistry;
```

Creates a registry pre-populated with the standard BPMN node types.

#### Returns

[`NodeTypeRegistry`](#nodetyperegistry)

***

### activityMarkerOf()

```ts
function activityMarkerOf(node): 
  | "loop"
  | "parallelMultiInstance"
  | "sequentialMultiInstance"
  | undefined;
```

Returns the activity marker stored on a node, if it is a valid marker.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

  \| `"loop"`
  \| `"parallelMultiInstance"`
  \| `"sequentialMultiInstance"`
  \| `undefined`

***

### isEventType()

```ts
function isEventType(type): boolean;
```

True when `type` is one of the built-in event node types.

#### Parameters

##### type

`string`

#### Returns

`boolean`

***

### boundaryAttachedTo()

```ts
function boundaryAttachedTo(node): string | undefined;
```

A boundary event is attached to a host activity via
`properties.attachedToRef` and survives the host's move (see the editor's
drag handling). Returns the host node id, if any.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`string` \| `undefined`

***

### isNonInterrupting()

```ts
function isNonInterrupting(node): boolean;
```

A boundary event is interrupting (`cancelActivity`) by default; a
`cancelActivity: false` property makes it non-interrupting (dashed border).

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`boolean`

***

### isEventSubprocess()

```ts
function isEventSubprocess(node): boolean;
```

Event subprocess (Handoff 17 §4a): a COMMON subProcess whose
`properties.triggeredByEvent` is true — F7 containment reused whole, zero
new containment model. Serializes as the standard OMG attribute
`triggeredByEvent="true"` (never a custom namespace).

ES-1 reforço 9 — THE single source of the predicate: the E-4 execution
matrix (`eventExecutionModeOf`, ES-3) and the tightened
`EVT_ERROR_START_TOPLEVEL` lint rule (ES-4) must CONSUME this helper, never
reimplement it — lint⇄matrix agreement holds by construction.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`boolean`

***

### startIsInterrupting()

```ts
function startIsInterrupting(node): boolean;
```

A start event is interrupting by OMG default; `isInterrupting: false` makes
it non-interrupting (dashed circle, boundary mold). The OMG default is
OMITTED on export — `isInterrupting="false"` is the only value written.
Same reforço-9 discipline as [isEventSubprocess](#iseventsubprocess): consumers read this
helper, never the raw property.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`boolean`

***

### attachedBoundaryEventIds()

```ts
function attachedBoundaryEventIds(diagram, hostIds): string[];
```

Ids of boundary events attached to any of the given host node ids.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### hostIds

`Iterable`\<`string`\>

#### Returns

`string`[]

***

### nodeParentId()

```ts
function nodeParentId(node): string | undefined;
```

Sub-process containment (F7): a node nested inside a sub-process stores its
container id under `properties.parentId` — the child holds the reference,
same side as boundary `attachedToRef`. The XML converter encodes it
structurally (children nest inside `<bpmn:subProcess>`), so it never
appears as a `bpmnr:property`. Returns the container id, if any.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`string` \| `undefined`

***

### childrenOf()

```ts
function childrenOf(diagram, nodeId): BpmnNode[];
```

Direct children of a sub-process, in diagram insertion order.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### nodeId

`string`

#### Returns

[`BpmnNode`](#bpmnnode)[]

***

### descendantIdsOf()

```ts
function descendantIdsOf(diagram, nodeId): string[];
```

All transitive descendant ids of a node (children, grandchildren, …).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### nodeId

`string`

#### Returns

`string`[]

***

### isSubProcessExpanded()

```ts
function isSubProcessExpanded(node): boolean;
```

Expanded sub-processes render their children on the canvas; collapsed ones
(the default) hide them behind the `[+]` marker. Round-trips as the BPMN DI
`isExpanded` attribute on the sub-process shape.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`boolean`

***

### subProcessContainerAt()

```ts
function subProcessContainerAt(
   diagram, 
   point, 
   exclude?): BpmnNode | undefined;
```

Hierarchical hit-test for reparent-on-drop (F7): the DEEPEST expanded
sub-process whose rect contains `point`, skipping any id in `exclude` — the
dragged nodes and their own descendants, since a node can never reparent
into itself or its subtree. Nested containers resolve to the innermost match
so a drop lands where the cursor visually is (ties on depth break to the
smaller rect). Collapsed sub-processes are ignored — their interior is not
on the canvas to drop into. Returns undefined when the point is over no
eligible container (a plain move, or a drop at the top level).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### point

[`Point`](#point-1)

##### exclude?

`ReadonlySet`\<`string`\> = `...`

#### Returns

[`BpmnNode`](#bpmnnode) \| `undefined`

***

### calledElementOf()

```ts
function calledElementOf(node): string | undefined;
```

A call activity invokes another process by id (`properties.calledElement`,
the standard BPMN attribute). The id is expected to match a registered
diagram — `@buildtovalue/registry` resolves it to the version in effect at a
given date (`resolveCallActivities`). Returns the called process id, if any.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`string` \| `undefined`

***

### eventDefinitionOf()

```ts
function eventDefinitionOf(node): 
  | "error"
  | "message"
  | "signal"
  | "link"
  | "escalation"
  | "timer"
  | "conditional"
  | "terminate"
  | undefined;
```

Returns the event-definition kind stored on a node, if it is a valid kind.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

  \| `"error"`
  \| `"message"`
  \| `"signal"`
  \| `"link"`
  \| `"escalation"`
  \| `"timer"`
  \| `"conditional"`
  \| `"terminate"`
  \| `undefined`

***

### isContainerType()

```ts
function isContainerType(type): boolean;
```

True when `type` is a swimlane container (pool or lane).

#### Parameters

##### type

`string`

#### Returns

`boolean`

***

### laneFlowNodeRefs()

```ts
function laneFlowNodeRefs(node): string[];
```

Lane membership is stored on the lane node under `properties.flowNodeRefs`
(an array of flow-node ids). Returns it defensively as a string array.

#### Parameters

##### node

[`BpmnNode`](#bpmnnode)

#### Returns

`string`[]

***

### activeNodes()

```ts
function activeNodes(diagram): BpmnNode[];
```

Returns nodes that are part of the current flow (not closed).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`BpmnNode`](#bpmnnode)[]

***

### activeEdges()

```ts
function activeEdges(diagram): BpmnEdge[];
```

Returns edges that are part of the current flow (not closed).

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

#### Returns

[`BpmnEdge`](#bpmnedge)[]

***

### sha256Hex()

```ts
function sha256Hex(text): Promise<string>;
```

SHA-256 via Web Crypto (`crypto.subtle`), available in modern browsers and
Node.js ≥ 20 without imports — keeping the zero-dependency policy.

#### Parameters

##### text

`string`

#### Returns

`Promise`\<`string`\>

***

### canonicalJson()

```ts
function canonicalJson(value): string;
```

Deterministic JSON: object keys sorted recursively, numbers rounded to two
decimals so float noise never changes a hash or a diff.

The rounding exists for diagram geometry (coordinates). For integrity
boundaries — audit chains, signed payloads, attestations — use
[canonicalJsonExact](#canonicaljsonexact), which preserves numbers exactly.

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### canonicalJsonExact()

```ts
function canonicalJsonExact(value): string;
```

Deterministic JSON with exact numbers: object keys sorted recursively,
no rounding. Use this wherever the string feeds a hash or a signature over
business data, so `1.005` and `1.006` never collide.

#### Parameters

##### value

`unknown`

#### Returns

`string`

***

### roundCoord()

```ts
function roundCoord(value): number;
```

#### Parameters

##### value

`number`

#### Returns

`number`

***

### createSnapshot()

```ts
function createSnapshot(diagram, createdBy?): Promise<Snapshot>;
```

Captures an immutable snapshot of the diagram with a content hash.

#### Parameters

##### diagram

[`BpmnDiagram`](#bpmndiagram)

##### createdBy?

`string` = `'anonymous'`

#### Returns

`Promise`\<[`Snapshot`](#snapshot)\>

***

### verifySnapshot()

```ts
function verifySnapshot(snapshot): Promise<boolean>;
```

Recomputes the hash and compares — detects any content drift.

#### Parameters

##### snapshot

[`Snapshot`](#snapshot)

#### Returns

`Promise`\<`boolean`\>

***

### localName()

```ts
function localName(tag): string;
```

#### Parameters

##### tag

`string`

#### Returns

`string`

***

### findByLocalName()

```ts
function findByLocalName(root, name): XmlElement[];
```

Depth-first search for descendants matching a local name.

#### Parameters

##### root

[`XmlElement`](#xmlelement)

##### name

`string`

#### Returns

[`XmlElement`](#xmlelement)[]

***

### childrenByLocalName()

```ts
function childrenByLocalName(el, name): XmlElement[];
```

#### Parameters

##### el

[`XmlElement`](#xmlelement)

##### name

`string`

#### Returns

[`XmlElement`](#xmlelement)[]

***

### firstChildByLocalName()

```ts
function firstChildByLocalName(el, name): XmlElement | undefined;
```

#### Parameters

##### el

[`XmlElement`](#xmlelement)

##### name

`string`

#### Returns

[`XmlElement`](#xmlelement) \| `undefined`

***

### escapeXmlText()

```ts
function escapeXmlText(value): string;
```

Escapes character data (text nodes).

#### Parameters

##### value

`string`

#### Returns

`string`

***

### escapeXmlAttribute()

```ts
function escapeXmlAttribute(value): string;
```

Escapes attribute values (double-quoted). TAB/LF/CR are written as
character references — a strict parser normalizes the literal characters
to spaces on re-read, which would break exact round-trips.

#### Parameters

##### value

`string`

#### Returns

`string`

***

### getDefaultXmlAdapter()

```ts
function getDefaultXmlAdapter(): XmlParserAdapter;
```

#### Returns

[`XmlParserAdapter`](#xmlparseradapter)
