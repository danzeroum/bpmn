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
      name: 'simulation',
      include: ['packages/simulation/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'replay',
      include: ['packages/replay/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'sfeel',
      include: ['packages/sfeel/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'agentflow',
      include: ['packages/agentflow/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'copilot',
      include: ['packages/copilot/tests/**/*.test.ts'],
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
      name: 'identity',
      include: ['packages/identity/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'anchor-git',
      include: ['packages/anchor-git/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'anchor-rfc3161',
      include: ['packages/anchor-rfc3161/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'anchor-s3',
      include: ['packages/anchor-s3/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'dmn',
      include: ['packages/dmn/tests/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
    },
  },
  {
    test: {
      name: 'healthcare',
      include: ['packages/healthcare/tests/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
    },
  },
  {
    test: {
      name: 'library',
      include: ['packages/library/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'adapters-bpmn',
      include: ['packages/adapters-bpmn/tests/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'library-react',
      include: ['packages/library-react/tests/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['packages/library-react/tests/setup.ts'],
    },
  },
  {
    test: {
      name: 'studio',
      include: ['packages/studio/tests/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['packages/studio/tests/setup.ts'],
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
  {
    test: {
      name: 'example',
      include: ['packages/example/tests/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['packages/react/tests/setup.ts'],
    },
  },
]);
