# @buildtovalue/lint

bpmnlint-style modelling lint for bpmn-react, as plugin-compatible
`ValidationRule`s over `@buildtovalue/core`:

- **Etiquette profile** (`ETIQUETTE_RULES`): unnamed elements, superfluous
  gateways, implicit splits/joins, duplicate flows, event endpoint misuse.
- **Executability profile** (`EXECUTABILITY_RULES`): missing implementation
  bindings on service-class tasks, conditionless forking gateways.

```ts
import { lintDiagram, ETIQUETTE_RULES } from '@buildtovalue/lint';

const { valid, issues } = lintDiagram(diagram); // both profiles
const style = lintDiagram(diagram, ETIQUETTE_RULES);
```

Every issue carries a stable `LINT_*` / `EXEC_*` code for allowlisting,
severity mapping and quick fixes. Zero runtime dependencies.
