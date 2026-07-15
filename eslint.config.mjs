import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/*.d.ts'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // CONTRIBUTING: "no `any` unless justified with a comment" — enforced;
      // the few legitimate generic seams carry explicit disable comments.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/react/src/**/*.{ts,tsx}', 'packages/*/src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    // The classic correctness pair. The v6 "recommended" preset additionally
    // ships the React Compiler lints (refs-during-render, set-state-in-
    // effect, immutability), which flag ~50 pre-existing deliberate patterns
    // (render-synced refs, store/context sync effects) — adopting those is a
    // behavioral refactor tracked in docs/melhorias.md, not a lint switch.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
