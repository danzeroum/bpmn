# @buildtovalue/cli

Headless tooling for bpmn-react diagrams (Node ≥ 20, no DOM required — uses the core's bundled
XML parser).

## Diagram commands

```bash
bpmn-react validate flow.bpmn.xml          # structural + rule validation, exit 1 on errors
bpmn-react export flow.json --to xml -o flow.bpmn.xml
bpmn-react export flow.bpmn.xml --to json
bpmn-react diff v1.json v2.bpmn.xml        # structured diff, exit 1 when different
```

## Governance in a pipeline

`approve` and `promote` run the core lifecycle engine, so a CI job can enforce the governance gate
(the "process PR"). `promote` writes the promoted diagram back and can register it in one step.

```bash
# Record approvals (needed before promoting to 'active')
bpmn-react approve flow.json --actor-id o1 --actor-role owner      --reason "looks good"
bpmn-react approve flow.json --actor-id c1 --actor-role compliance --reason "compliant"

# Advance the lifecycle — exits 1 if the gate isn't met (e.g. too few roles, short changelog)
bpmn-react promote flow.json --to active \
  --actor-id ops1 --actor-role operations --reason "Approved for production rollout." \
  --registry registry.json
```

## Version registry

A registry file (`registry.json`) is a persistent, content-hash-verified store of versions and
their rollout. Every read verifies the snapshot hashes; a tampered file is rejected.

```bash
bpmn-react registry add flow.json --to registry.json --notes "reworked the approval gate"
bpmn-react registry history registry.json
bpmn-react registry publish registry.json --version <id> --channel pilot --status active --at 2026-06-01
bpmn-react registry active registry.json --at 2026-07-01 --channel pilot   # exit 1 if none
bpmn-react registry diff registry.json --from <v1> --to <v2>
bpmn-react registry bind-run registry.json --version <id> --channel prod   # emits a run pin (JSON)
```

Exit codes: `0` ok · `1` check failed (validation errors, differences, governance gate, no active
version) · `2` usage/parse error.

License: Apache-2.0.
