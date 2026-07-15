# lint/src

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
