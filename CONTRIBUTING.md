# Contributing to bpmn-react

Thank you for your interest in contributing!

## Originality declaration

This project is a **from-scratch implementation**. To keep it legally clean:

- Do **not** copy or adapt source code from any other diagramming library or its dependencies —
  regardless of its license (MIT included).
- Architectural patterns (layered architecture, event bus, command stack, plugin registry) are
  ideas and may be used freely; specific code expression may not.
- Do not replicate exact public API signatures of other diagramming libraries.
- The BPMN 2.0 specification is public (OMG). Implementing it from the spec text is allowed and
  encouraged: https://www.omg.org/spec/BPMN/2.0/
- By submitting a pull request you certify that your contribution is your original work and that
  you have the right to license it under Apache 2.0.

## Zero runtime dependencies policy

Every **publishable package** (all `@buildtovalue/*` packages except the private apps/demos
`example`, `domain-example` and `healthcare` — about 21 packages today) must declare **no
external runtime `dependencies`** — only workspace-internal `@buildtovalue/*` links are allowed.
`react`/`react-dom` are allowed only as `peerDependencies` of the React packages. Build and test
tooling goes in `devDependencies`. CI enforces this via `pnpm check:no-runtime-deps`.

## Workflow

```bash
pnpm install
pnpm build   # required before `pnpm test`
pnpm test
pnpm typecheck
pnpm lint
```

- **Run `pnpm build` before `pnpm test`.** Cross-package tests (e.g. the conformance
  corpus) import sibling packages by name (`@buildtovalue/core`), which resolves to each
  package's built `dist/`. A bare `vitest run` on a fresh checkout therefore fails on
  module resolution — that is an environment/ordering issue, not a conformance failure.
- Unit tests live next to the code in `tests/` folders per package (Vitest).
- Every package has a **public API contract test** (`tests/apiSurface.test.ts`) that freezes its
  runtime exports. A failing diff there means an export was added, renamed, or removed — update the
  fixture for additions; renames/removals are breaking changes and need a version bump first (see
  [docs/versioning.md](docs/versioning.md)).
- Coverage has an enforced **floor per package** in `vitest.config.mts` (`coverage.thresholds`) —
  `pnpm test:coverage` fails the build if it drops below core 95%, domain-example 90%, cli 85%,
  react 65% (statements/lines; branch/function floors are lower). Raise these opportunistically as
  gaps close; never lower them to make a red build pass. New shapes, commands, or node types need a
  rendering/round-trip test in the same PR, not "coverage happens to still pass."
- Commit messages: imperative, descriptive, one logical change per commit.

## Releasing (changesets)

Version bumps are tracked with [changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset          # describe your change; pick patch/minor/major per package
pnpm version-packages   # (release captain) apply pending bumps + changelogs
```

- Every PR that changes a publishable package's behavior should include a changeset
  (`.changeset/*.md`). Docs-only or test-only changes don't need one.
- Publishing runs through `.github/workflows/release.yml` (manual dispatch, dry-run by
  default) after the version PR lands. The private apps (`example`, `domain-example`,
  `healthcare`) are ignored in `.changeset/config.json`.

## Code style

- TypeScript strict mode; no `any` unless justified with a comment.
- No classes where a plain function suffices; no external state libraries.
- React components are function components; visual state lives in the canvas store, domain state in
  the diagram context.
