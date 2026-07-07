import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
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
          include: ['packages/domain-example/tests/**/*.test.ts'],
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
          name: 'react',
          include: ['packages/react/tests/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['packages/react/tests/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      exclude: ['packages/example/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
