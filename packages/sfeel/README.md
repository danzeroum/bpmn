# @buildtovalue/sfeel

Minimal **S-FEEL subset** parser + evaluator for decision tables (Handoff 9
§5). Serves the token simulator (Handoff 7 — `businessRuleTask` routes through
real decision tables) and the DMN editor (Handoff 5 — ⚠ "não-simulável" cell
markers) without importing either: the package operates on plain string cells
plus a `{variable: value}` context and has **zero dependencies, zero imports
from the ecosystem**.

## The subset (supported)

| Construct | Example |
|---|---|
| Comparisons | `< 5`, `<= 5`, `> 5`, `>= 5`, `= "gold"` |
| Ranges (incl./excl./mixed) | `[1..10]`, `]1..10[`, `[1..10[`, `]1..10]` |
| Value lists (implicit OR) | `"a", "b"` · `1, 2, 3` · `< 3, > 10` |
| List negation | `not("a", "b")` |
| Irrelevant | `-` (or an empty cell) |
| Types | number, string, boolean |
| Hit policies | **U** (Unique), **F** (First) |

Outputs are **literals only** (number, `"string"`, boolean).

## Explicitly excluded (cerca §1.6)

Function invocation (`date()`, `duration()`, …), arithmetic in cells,
`for`/`some`/`every`, nested contexts, date/time/duration types and literals,
non-literal output expressions, identifier references in cells, and evaluation
of the A/P/R/O/C hit policies (they remain editor metadata — registered in
`pendencias.md`).

## Honesty contract

`evaluate(table, context)` returns exactly one of:

- `{ result }` — the matched rule's outputs (or `null` when no rule matches);
- `{ nonSimulable: { cell, reason } }` — a **declared** failure naming the
  offending cell and why: a construct outside the subset, a malformed cell, a
  missing input variable, a type mismatch, or a Unique-hit-policy violation
  (two rules matching).

There is no third, silent state — a cell the package cannot evaluate correctly
is never evaluated at all. `checkTable` / `checkUnaryCell` / `checkOutputCell`
expose the same verdicts statically for editor feedback before simulation.

Input-column `expression`s are used **verbatim as context keys** — they are not
evaluated (an input expression that needs evaluation is outside the subset).
