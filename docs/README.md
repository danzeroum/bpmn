# Documentation index

> **Language convention:** public-facing docs (this repo's README, getting
> started, architecture overview, format spec, CONTRIBUTING, CHANGELOG) are in
> **English**; internal working docs (data catalog, UML analysis, pendências,
> design handoffs, melhorias) are in **Portuguese (pt-BR)**.

## Getting started & guides (EN)

| Doc | What it covers |
|---|---|
| [getting-started.md](getting-started.md) | Install, first diagram, editor + viewer basics |
| [architecture.md](architecture.md) | 3-layer overview: headless core, react layer, governance |
| [plugins.md](plugins.md) | Plugin contract: node types, rules, context-menu items, panels |
| [versioning.md](versioning.md) | Version lifecycle, promotion gates, semantic versioning |
| [registry.md](registry.md) | Version registry: channels, validity windows, run pinning |
| [format-spec.md](format-spec.md) | BPMN 2.0 XML profile (what round-trips, `bpmnr:` extensions) |
| [limitations.md](limitations.md) | Known limitations of the v1 profile |
| [assurance-case.md](assurance-case.md) | The SACM assurance case exported by `@buildtovalue/audit` |
| [../CONFORMANCE.md](../CONFORMANCE.md) | OMG conformance matrix (generated — do not edit by hand) |

## Reference

| Doc | What it covers |
|---|---|
| [api/](api/) | **Generated API reference** (TypeDoc) for every published package — regenerate with `pnpm docs:api`; CI gates drift via `check:docs-fresh` |
| [uml/arquitetura.md](uml/arquitetura.md) | C4 + 4+1 architecture views (PT-BR) |
| [uml/analise-uml.md](uml/analise-uml.md) | Full UML analysis of the monorepo (PT-BR) |
| [documentação/](documenta%C3%A7%C3%A3o/) | **Data catalog**: inputs, intermediate processing and outputs, file by file, for all packages (PT-BR) |

## Engineering process (PT-BR)

| Doc | What it covers |
|---|---|
| [melhorias.md](melhorias.md) | Structured technical-improvement analysis + implementation status |
| [../pendencias.md](../pendencias.md) | Open product/architecture decisions (only what is actually open) |
| [../DECISIONS.md](../DECISIONS.md) | Historical record of closed decisions |
| [../CHANGELOG.md](../CHANGELOG.md) | Release history (versioned via changesets) |

## Design handoffs (PT-BR, historical)

The `design_handoff_btv_*` folders are the design-to-engineering handoff
documents that drove each delivery wave (specs, wireframe screenshots, design
refs). They are **historical records** — kept verbatim, not updated. Note:
`design_handoff_btv_trust/` (Handoff 4, trust layer) is text-only by design;
`design_handoff_btv_trust_anchor/` (anchoring) is a different, later handoff.
