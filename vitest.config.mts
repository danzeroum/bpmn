import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      exclude: [
        'packages/example/**',
        // Pure type-only files (interfaces/type aliases erase to an empty
        // module at compile time) — "0% coverage" on zero statements is a
        // reporting artifact, not a gap. Confirmed dead-code-free by
        // ts-prune; see docs/limitations.md.
        'packages/core/src/commands/types.ts',
        'packages/react/src/plugins/types.ts',
        'packages/registry/src/types.ts',
        'packages/identity/src/types.ts',
        // Exercised end-to-end as a real child process in
        // packages/cli/tests/bin.test.ts — v8 coverage instrumentation
        // only observes code run in-process, so a spawned script always
        // reports 0% here regardless of how well it's tested.
        'packages/cli/src/bin.ts',
      ],
      reporter: ['text', 'lcov'],
      // A release-safety floor (see docs/versioning.md): CI fails if
      // coverage drops below these numbers. Raise them opportunistically
      // as gaps close — never lower them to make a red build pass.
      thresholds: {
        'packages/core/src/**': { statements: 95, branches: 80, functions: 90, lines: 95 },
        'packages/registry/src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/domain-example/src/**': { statements: 90, branches: 75, functions: 90, lines: 90 },
        'packages/cli/src/**': { statements: 85, branches: 65, functions: 95, lines: 85 },
        'packages/conformance/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/soundness/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/simulation/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/replay/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/sfeel/src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/agentflow/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/copilot/src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/audit/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/identity/src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/anchor-git/src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/anchor-rfc3161/src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/anchor-s3/src/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
        'packages/dmn/src/**': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'packages/healthcare/src/**': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'packages/library/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/adapters-bpmn/src/**': { statements: 95, branches: 85, functions: 95, lines: 95 },
        'packages/library-react/src/**': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'packages/studio/src/**': { statements: 90, branches: 80, functions: 90, lines: 90 },
        'packages/react/src/**': { statements: 65, branches: 60, functions: 65, lines: 65 },
      },
    },
  },
});
