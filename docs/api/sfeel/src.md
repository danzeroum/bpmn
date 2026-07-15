# sfeel/src

## Interfaces

### SfeelColumn

#### Properties

##### expression

```ts
expression: string;
```

Input: the context key to read. Output: the result key to write. The
expression is used verbatim as the key — it is NOT evaluated (an input
expression that needs evaluation is outside the subset).

##### typeRef?

```ts
optional typeRef?: string;
```

***

### SfeelRule

#### Properties

##### inputEntries

```ts
inputEntries: string[];
```

S-FEEL unary tests, one per input column ('-'/empty = irrelevant).

##### outputEntries

```ts
outputEntries: string[];
```

Literal expressions, one per output column.

***

### SfeelTable

#### Properties

##### hitPolicy

```ts
hitPolicy: string;
```

Only 'U' (Unique) and 'F' (First) are simulable (§5); the other DMN hit
policies remain editor metadata and evaluate to a declared nonSimulable.

##### inputs

```ts
inputs: SfeelColumn[];
```

##### outputs

```ts
outputs: SfeelColumn[];
```

##### rules

```ts
rules: SfeelRule[];
```

***

### NonSimulable

The honest-failure payload (cerca §1.6): WHAT cell cannot be simulated and
WHY — for the token warning in the simulator and the ⚠ marker in the editor.
Covers both static subset exclusions (e.g. `date(...)` in a cell) and
dynamic honesty failures (missing variable, type mismatch, Unique
violation) — in every case the alternative would be a silently wrong result.

#### Properties

##### cell

```ts
cell: string;
```

The offending cell's raw text (or the hit policy letter / rule label).

##### reason

```ts
reason: string;
```

Human-readable reason, always naming what is outside the subset.

##### ruleIndex?

```ts
optional ruleIndex?: number;
```

0-based rule index, when the failure is cell-scoped.

##### columnIndex?

```ts
optional columnIndex?: number;
```

0-based column index across inputs then outputs, when cell-scoped.

***

### SfeelMatch

A successful match: outputs keyed by output-column expression.

#### Properties

##### outputs

```ts
outputs: Record<string, SfeelValue>;
```

##### ruleIndex

```ts
ruleIndex: number;
```

0-based index of the rule that fired.

## Type Aliases

### UnaryTest

```ts
type UnaryTest = 
  | {
  kind: "any";
}
  | {
  kind: "cmp";
  op: "<" | "<=" | ">" | ">=" | "=";
  value: SfeelValue;
}
  | {
  kind: "range";
  lo: number;
  hi: number;
  loIncl: boolean;
  hiIncl: boolean;
}
  | {
  kind: "not";
  values: SfeelValue[];
};
```

One parsed unary test. A cell is a comma-separated OR of these.

***

### ParsedCell

```ts
type ParsedCell = 
  | {
  ok: true;
  tests: UnaryTest[];
}
  | {
  ok: false;
  reason: string;
};
```

***

### ParsedOutput

```ts
type ParsedOutput = 
  | {
  ok: true;
  value: SfeelValue;
}
  | {
  ok: false;
  reason: string;
};
```

***

### SfeelValue

```ts
type SfeelValue = number | string | boolean;
```

The three value types of the subset (§5). Dates/times/durations are OUT.

***

### SfeelContext

```ts
type SfeelContext = Record<string, SfeelValue | undefined>;
```

Evaluation context: input-column expression → value. A missing variable is
a DECLARED failure, never a silent non-match.

***

### EvaluateResult

```ts
type EvaluateResult = 
  | {
  result: SfeelMatch | null;
}
  | {
  nonSimulable: NonSimulable;
};
```

`evaluate` contract (§5): a result (a match, or `null` when no rule
matches) — or a declared `nonSimulable`. There is no third, silent state.

***

### CellCheck

```ts
type CellCheck = 
  | {
  simulable: true;
}
  | {
  simulable: false;
  reason: string;
};
```

Static per-cell verdict for editor feedback (⚠ before simulating).

## Variables

### SIMULABLE\_HIT\_POLICIES

```ts
const SIMULABLE_HIT_POLICIES: readonly ["U", "F"];
```

The hit policies the simulator can evaluate (§5).

## Functions

### checkTable()

```ts
function checkTable(table): NonSimulable[];
```

Static analysis of a whole table: every cell outside the subset (and an
unsupported hit policy) — the editor's ⚠ markers in one pass. Column index
counts inputs first, then outputs (same convention as the DMN editor).

#### Parameters

##### table

[`SfeelTable`](#sfeeltable)

#### Returns

[`NonSimulable`](#nonsimulable)[]

***

### evaluate()

```ts
function evaluate(table, context): EvaluateResult;
```

Evaluates `table` against `context` (§5): `{result}` — a match or `null`
when no rule fires — or `{nonSimulable: {cell, reason}}`. Static issues are
reported before any matching runs, so the verdict for a given table is
deterministic regardless of the data.

#### Parameters

##### table

[`SfeelTable`](#sfeeltable)

##### context

[`SfeelContext`](#sfeelcontext)

#### Returns

[`EvaluateResult`](#evaluateresult)

***

### isIrrelevant()

```ts
function isIrrelevant(cell): boolean;
```

True when the cell means "irrelevant" — a lone '-' or an empty cell.

#### Parameters

##### cell

`string`

#### Returns

`boolean`

***

### parseUnaryTests()

```ts
function parseUnaryTests(cell): ParsedCell;
```

Parses one input cell into its OR'd unary tests. Never throws: every
failure — subset exclusion or malformed syntax — comes back as
`{ok:false, reason}`.

#### Parameters

##### cell

`string`

#### Returns

[`ParsedCell`](#parsedcell)

***

### parseOutputLiteral()

```ts
function parseOutputLiteral(cell): ParsedOutput;
```

Parses one output cell: a single literal (§5 — non-literal output
expressions are outside the subset).

#### Parameters

##### cell

`string`

#### Returns

[`ParsedOutput`](#parsedoutput)

***

### checkUnaryCell()

```ts
function checkUnaryCell(cell): CellCheck;
```

Editor feedback (⚠ before simulation): is this INPUT cell in the subset?

#### Parameters

##### cell

`string`

#### Returns

[`CellCheck`](#cellcheck)

***

### checkOutputCell()

```ts
function checkOutputCell(cell): CellCheck;
```

Editor feedback: is this OUTPUT cell a subset literal?

#### Parameters

##### cell

`string`

#### Returns

[`CellCheck`](#cellcheck)
