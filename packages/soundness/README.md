# @buildtovalue/soundness

Structural soundness analysis for BPMN diagrams: deadlock, livelock and
dead-branch detection over the process graph — **O(V+E) per rule, never
state-space search** — delivered in the plugin `validationRules` format so
the react editor and the CLI consume it with zero new integration code.
Zero runtime dependencies.

```ts
import { soundnessRules, analyzeSoundness } from '@buildtovalue/soundness';

// As an editor plugin (errors surface in Validate and block promotion in C2):
const plugin = { id: 'soundness', validationRules: soundnessRules() };

// Headless:
const issues = analyzeSoundness(diagram, { locale: 'pt' });
```

## Rules

| Code | Severity | Detects |
|---|---|---|
| `SND_DEADLOCK_JOIN` | error | AND-join fed by an XOR-split (never synchronizes) |
| `SND_UNMATCHED_SPLIT` | warning | split without a same-type join downstream |
| `SND_NO_PATH_TO_END` | error | node with no path to any end event |
| `SND_INFINITE_LOOP` | warning | cycle with no exit edge (structural livelock) |
| `SND_DEAD_BRANCH` | warning | gateway branch unreachable from the start |
| `SND_BOUNDARY_NO_OUTFLOW` | error | boundary event without outgoing flow |
| `SND_EVENT_GW_TARGETS` | error | event gateway targeting a non-catch element |
| `SND_LANE_NO_ACTOR` | info | empty swimlane |
| `SND_IMPLICIT_MERGE` | info | 2+ incoming flows without a gateway |

Every rule traverses the sub-process hierarchy (F7): each scope — the top
process level and each `subProcess` — is analyzed as its own subgraph, with
boundary events attached to their host's scope.

Tune without forking: `soundnessRules({ severityOverrides, disabled, locale })`.
