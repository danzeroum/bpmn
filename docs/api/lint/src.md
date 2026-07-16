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
