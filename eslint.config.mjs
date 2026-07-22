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
  {
    // Pureza do kernel do engine como GATE DE LINT (D2 / F0b.3): além do
    // teste de pureza, o CI quebra AQUI se não-determinismo ou I/O entrar no
    // src. Deterministas permitidos: Date.parse(x) e new Date(ms) — aritmética
    // de instantes sobre valores fornecidos pelo host.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*'], message: 'kernel puro: sem APIs de plataforma (D2)' }] },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'kernel puro: relógio vem em event.now (D2)' },
        { object: 'Math', property: 'random', message: 'kernel puro: sem aleatoriedade (D2)' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'kernel puro: sem ambiente (D2)' },
        { name: 'fetch', message: 'kernel puro: sem I/O (D2)' },
        { name: 'setTimeout', message: 'kernel puro: sem agendamento (D2)' },
        { name: 'setInterval', message: 'kernel puro: sem agendamento (D2)' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'kernel puro: leitura de relógio proibida — new Date(ms) com argumento é permitido (D2)',
        },
        { selector: 'FunctionDeclaration[async=true]', message: 'kernel síncrono (D2)' },
        { selector: 'FunctionExpression[async=true]', message: 'kernel síncrono (D2)' },
        { selector: 'ArrowFunctionExpression[async=true]', message: 'kernel síncrono (D2)' },
      ],
    },
  },
);
