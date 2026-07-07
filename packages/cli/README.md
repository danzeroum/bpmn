# @bpmn-react/cli

Headless tooling for bpmn-react diagrams (Node ≥ 20, no DOM required — uses the core's bundled
XML parser).

```bash
bpmn-react validate flow.bpmn.xml          # structural + rule validation, exit 1 on errors
bpmn-react export flow.json --to xml -o flow.bpmn.xml
bpmn-react export flow.bpmn.xml --to json
bpmn-react diff v1.json v2.bpmn.xml        # structured diff, exit 1 when different
```

License: Apache-2.0.
