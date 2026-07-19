# lint/src

## Interfaces

### LintFixContext

What a quick-fix receives: the CURRENT diagram and the issue to repair.

#### Properties

##### diagram

```ts
diagram: BpmnDiagram;
```

##### issue

```ts
issue: ValidationIssue;
```

***

### LintRule

A lint rule with an identity and an OPTIONAL mechanical quick-fix
(Handoff 14 §1d). `fix` returns ONE undoable `Command` (composites fold
multi-step repairs into a single undo) — or `null` when the concrete issue
cannot be fixed mechanically after all. Rules without `fix` are the ones
the panel routes to the copilot's C5 pipeline instead.

#### Properties

##### id

```ts
id: string;
```

Stable kebab-case id ("duplicate-flow") — the grouping key for hosts.

##### run

```ts
run: ValidationRule;
```

##### fix?

```ts
optional fix?: (ctx) => Command | null;
```

###### Parameters

###### ctx

[`LintFixContext`](#lintfixcontext)

###### Returns

`Command` \| `null`

***

### LintProfile

A named, versioned rule set — the unit the Biblioteca lists as a promotable
artifact (via `lintProfileAdapter`) and the panel shows as "política:
<id>@<version>". `source` tags every finding so etiquette and
engine-readiness issues share ONE surface without losing provenance.

#### Properties

##### id

```ts
id: string;
```

##### name

```ts
name: string;
```

##### version

```ts
version: string;
```

##### source

```ts
source: "etiquette" | "executability";
```

##### rules

```ts
rules: LintRule[];
```

***

### LintFinding

An issue annotated with the rule and profile that produced it.

#### Extends

- `ValidationIssue`

#### Properties

##### code

```ts
code: string;
```

###### Inherited from

```ts
ValidationIssue.code
```

##### severity

```ts
severity: IssueSeverity;
```

###### Inherited from

```ts
ValidationIssue.severity
```

##### message

```ts
message: string;
```

###### Inherited from

```ts
ValidationIssue.message
```

##### nodeId?

```ts
optional nodeId?: string;
```

###### Inherited from

```ts
ValidationIssue.nodeId
```

##### edgeId?

```ts
optional edgeId?: string;
```

###### Inherited from

```ts
ValidationIssue.edgeId
```

##### ruleId

```ts
ruleId: string;
```

##### profileId

```ts
profileId: string;
```

##### source

```ts
source: "etiquette" | "executability";
```

##### fixable

```ts
fixable: boolean;
```

True when the rule's quick-fix yields a command for THIS issue.

## Variables

### labelRequiredRule

```ts
const labelRequiredRule: ValidationRule;
```

Flow elements that read as prose must be named.

***

### superfluousGatewayRule

```ts
const superfluousGatewayRule: ValidationRule;
```

A gateway with one incoming AND one outgoing flow does nothing.

***

### implicitSplitRule

```ts
const implicitSplitRule: ValidationRule;
```

Branching should be explicit: an activity with 2+ outgoing flows hides a decision.

***

### implicitJoinRule

```ts
const implicitJoinRule: ValidationRule;
```

Joining should be explicit: an activity with 2+ incoming flows hides a merge.

***

### duplicateFlowRule

```ts
const duplicateFlowRule: ValidationRule;
```

Two sequence flows with the same source and target are duplicates.

***

### eventEndpointsRule

```ts
const eventEndpointsRule: ValidationRule;
```

Start events don't take incoming sequence flow; end events don't emit.

***

### evtSubprocFlowRule

```ts
const evtSubprocFlowRule: ValidationRule;
```

EVT_SUBPROC_FLOW (Handoff 17 §4d): sequence flow never touches the SHELL of
an event subprocess — this catches the IMPORT path the editor's gesture
veto cannot. ONE finding per edge, naming both endpoints (a shell↔shell
edge never yields two findings — ES-4 reforço 7); common sub-processes and
children connecting among themselves never trigger it.

***

### evtSubprocStartRule

```ts
const evtSubprocStartRule: ValidationRule;
```

EVT_SUBPROC_START (Handoff 17 §4d): an event subprocess needs EXACTLY ONE
typed start among its DIRECT children (`childrenOf` — a start inside a
nested sub-process never counts, ES-4 reforço 7). Three distinct failures,
each naming the container: zero starts (mechanical fix — the shared
builder), more than one, or a start whose kind is missing/unsupported
(escalation/compensation stay declared-out, naming the accepted kinds —
reforço 8).

***

### evtStartThrowRule

```ts
const evtStartThrowRule: ValidationRule;
```

Start events only CATCH: a throw-only or intermediate-only kind is an error.

***

### evtEndCatchRule

```ts
const evtEndCatchRule: ValidationRule;
```

End events only THROW: a catch-only or intermediate-only kind is an error.

***

### evtErrorStartToplevelRule

```ts
const evtErrorStartToplevelRule: ValidationRule;
```

An error START event only exists inside an EVENT subprocess — TIGHTENED in
Handoff 17 ES-4: the predicate is the core `isEventSubprocess` helper, the
SAME object the editor's Execução matrix consumes (ES-1 reforço 9) — lint
and tab agree by construction, both sides tested. A COMMON subProcess now
flags too.

***

### evtEscalationStartToplevelRule

```ts
const evtEscalationStartToplevelRule: ValidationRule;
```

An escalation START only exists inside an EVENT subprocess — the EXACT mould
of `evtErrorStartToplevelRule` (Handoff 18 §5d), the SAME core
`isEventSubprocess` predicate the editor's Execução matrix consumes, so lint
and matrix agree by construction (both sides tested).

***

### escNoCatchRule

```ts
const escNoCatchRule: ValidationRule;
```

A throw of escalation with NO eligible catch in the diagram — a WARNING, not
an error: an escalation with no destination DISSOLVES (legal in the OMG,
unlike an error, which is a declared STOP). Destination = escalation
boundaries + escalation esub-starts, read from the SHARED core enumeration
`eligibleEscalationCatches` — the SAME source the simulator's
`throwEscalation` resolution (EC-5) consumes, never a forked predicate. A
specific ref matches by ref OR a catch-all; a kind-puro throw (no ref) counts
when a catch-all escalation catch exists.

***

### evtEscalationCatchIllegalRule

```ts
const evtEscalationCatchIllegalRule: ValidationRule;
```

An escalation caught by an intermediateCatchEvent is illegal (reforço 8): the
OMG catches an escalation ONLY on a boundary or an event-subprocess start —
an intermediate catch in normal flow is a destination no matching will ever
reach, so it is flagged, never left silent. (Error has the same restriction;
a general "catch-only kind on the wrong host" rule is a named follow-up in
`pendencias.md`.)

***

### compHandlerFlowRule

```ts
const compHandlerFlowRule: ValidationRule;
```

COMP_HANDLER_FLOW (Handoff 19 §6c): a compensation HANDLER (isForCompensation)
lives OUTSIDE the sequence — it is reached only by the boundary's association,
never by sequence flow. This catches the IMPORT path the editor's core veto
(CO-1) cannot. ONE finding per edge, naming the handler(s) and the edge
(reforço 9 — both roles: handler as source OR as target; a handler↔handler
edge never yields two findings). A normal task flows normally.

***

### compBoundaryNoHandlerRule

```ts
const compBoundaryNoHandlerRule: ValidationRule;
```

COMP_BOUNDARY_NO_HANDLER (Handoff 19 §6c): a compensation boundary (⟲) with no
association to a handler compensates nothing — an ERROR with a MECHANICAL
quick-fix (the shared `compensationHandlerCommands` — the FORM of the palette
composite, one source).

***

### compRefNotCompensableRule

```ts
const compRefNotCompensableRule: ValidationRule;
```

COMP_REF_NOT_COMPENSABLE (Handoff 19 §6c): a compensation THROW whose
`compensateActivityRef` targets an activity that has NO compensation boundary
in the throw's OWN scope — a WARNING (the throw is legal, but nothing will be
compensated). Reads the SHARED `compensableActivitiesOf` (the SAME source the
picker (CO-2) and the simulator (CO-4) consume), scoped by `flowScopeOf`.

***

### compCatchAttrsRule

```ts
const compCatchAttrsRule: ValidationRule;
```

COMP_CATCH_ATTRS (Handoff 19 §6c): a compensation CATCH (boundary or
event-subprocess start) carrying `activityRef`/`waitForCompletion` — the OMG
reserves these to the THROW. A WARNING only: the converter already PRESERVES
them (CO-1 keeps them in the bpmnr: soup and NEVER re-emits them on the OMG
child), so the fence is met — the rule just surfaces the non-OMG input.

***

### compStartToplevelRule

```ts
const compStartToplevelRule: ValidationRule;
```

COMP_START_TOPLEVEL (Handoff 19 §6c): a compensation START only exists inside
an EVENT subprocess (the OMG "compensation event subprocess") — the EXACT
mould of `evtEscalationStartToplevelRule`, the SAME core `isEventSubprocess`
predicate, so lint and the Execução matrix agree by construction.

***

### ETIQUETTE\_RULES

```ts
const ETIQUETTE_RULES: ValidationRule[];
```

***

### serviceTaskImplementationRule

```ts
const serviceTaskImplementationRule: ValidationRule;
```

Service-class tasks need an implementation binding before an engine can
run them. The rule accepts the common property spellings so it works with
plain profiles (`implementation`) and engine namespaces preserved via
extension passthrough (`zeebe:taskDefinitionType`, `camunda:type`...).

***

### conditionalFlowsRule

```ts
const conditionalFlowsRule: ValidationRule;
```

Every outgoing flow of a forking exclusive/inclusive gateway needs a
condition (or must be the default flow) — otherwise the engine picks
arbitrarily or rejects the deploy.

***

### evtRefMissingRule

```ts
const evtRefMissingRule: ValidationRule;
```

An executable message/signal/error event needs its NAMED definition (3a) —
an engine correlates by the definition, not by the node label. Warning:
the model still parses and renders. Distinct from the E-3 `SIG_REF_MISSING`
(a GOVERNED binding that fails to resolve) — this is "no definition at all".

***

### timerMalformedRule

```ts
const timerMalformedRule: ValidationRule;
```

A present-but-malformed timer expression is an error the PARSER decides
(E-5 §1 — the P1M/PT1M trap lives there, once). Absent timer = no issue:
modelling can stay abstract; only a broken CLAIM is flagged.

***

### EXECUTABILITY\_RULES

```ts
const EXECUTABILITY_RULES: ValidationRule[];
```

***

### ALL\_LINT\_RULES

```ts
const ALL_LINT_RULES: ValidationRule[];
```

***

### ETIQUETTE\_PROFILE

```ts
const ETIQUETTE_PROFILE: LintProfile;
```

***

### EXECUTABILITY\_PROFILE

```ts
const EXECUTABILITY_PROFILE: LintProfile;
```

***

### LINT\_PROFILES

```ts
const LINT_PROFILES: LintProfile[];
```

The shipped profiles — both run on the SAME panel surface (§1d).

## Functions

### typedMessageStartCommands()

```ts
function typedMessageStartCommands(diagram, options): object;
```

"Typed message start + referenced named definition" — THE shared builder
(Handoff 17 ES-4, anti-drift): the palette's «Subprocesso de evento»
composite (react, ES-2) and the EVT_SUBPROC_START 0-starts quick-fix both
compose THIS — one FORM, one source (the 4d fix contract / ES-0 decision 4).

#### Parameters

##### diagram

`BpmnDiagram`

##### options

###### parentId?

`string`

###### x

`number`

###### y

`number`

###### definitionName?

`string`

#### Returns

`object`

##### commands

```ts
commands: Command[];
```

##### startId

```ts
startId: string;
```

##### definitionId

```ts
definitionId: string;
```

***

### compensationHandlerCommands()

```ts
function compensationHandlerCommands(diagram, options): object;
```

"Compensation handler + association" — THE shared builder (Handoff 19 §6c,
anti-drift): the palette's «Compensação (par)» composite (react, CO-2) and the
COMP_BOUNDARY_NO_HANDLER quick-fix both compose THIS — one FORM, one source
(the ES-2/ES-4 precedent `typedMessageStartCommands`). Given a compensation
boundary and its host, it creates the handler activity BELOW the host
(declared offset, `isForCompensation`) and the `bpmn:association` linking the
two, seeded with explicit DI waypoints (boundary center → handler center) so
the result re-exports byte-stably.

#### Parameters

##### diagram

`BpmnDiagram`

##### options

###### boundary

`BpmnNode`

###### host

`BpmnNode`

###### handlerName?

`string`

#### Returns

`object`

##### commands

```ts
commands: Command[];
```

##### handlerId

```ts
handlerId: string;
```

##### edgeId

```ts
edgeId: string;
```

***

### lintDiagram()

```ts
function lintDiagram(diagram, rules?): ValidationResult;
```

Runs a rule set (default: all) and folds the issues into one result.

#### Parameters

##### diagram

`BpmnDiagram`

##### rules?

`ValidationRule`[] = `ALL_LINT_RULES`

#### Returns

`ValidationResult`

***

### lintFindings()

```ts
function lintFindings(diagram, profiles?): LintFinding[];
```

Runs the profiles and annotates every issue with rule/profile provenance.

#### Parameters

##### diagram

`BpmnDiagram`

##### profiles?

[`LintProfile`](#lintprofile)[] = `LINT_PROFILES`

#### Returns

[`LintFinding`](#lintfinding)[]

***

### fixCommandFor()

```ts
function fixCommandFor(
   diagram, 
   finding, 
   profiles?): Command | null;
```

A FRESH quick-fix command for a finding, built against the CURRENT diagram
— commands close over undo state at execute time, so never reuse one across
executions. `null` when the finding's rule has no mechanical fix.

#### Parameters

##### diagram

`BpmnDiagram`

##### finding

[`LintFinding`](#lintfinding)

##### profiles?

[`LintProfile`](#lintprofile)[] = `LINT_PROFILES`

#### Returns

`Command` \| `null`
