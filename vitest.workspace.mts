import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'core',
      include: ['packages/core/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'domain-example',
      include: ['packages/domain-example/tests/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
    },
  },
  {
    test: {
      name: 'registry',
      include: ['packages/registry/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'cli',
      include: ['packages/cli/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'conformance',
      include: ['packages/conformance/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'soundness',
      include: ['packages/soundness/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'audit',
      include: ['packages/audit/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'react',
      include: ['packages/react/tests/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['packages/react/tests/setup.ts'],
    },
  },
]);
