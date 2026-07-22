import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Lint de pureza do kernel (F0b.3, D2): o CÓDIGO-FONTE do engine não pode
 * conter leitura de relógio, aleatoriedade, agendamento, async nem I/O.
 * Permitidos EXPLICITAMENTE (deterministas sobre valores fornecidos):
 * `Date.parse(x)` e `new Date(ms)` — aritmética de instantes do timer.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Date.now()', pattern: /Date\.now\s*\(/ },
  { name: 'new Date() sem argumento', pattern: /new Date\s*\(\s*\)/ },
  { name: 'Math.random', pattern: /Math\.random/ },
  { name: 'setTimeout/setInterval', pattern: /set(Timeout|Interval)\s*\(/ },
  { name: 'async/await', pattern: /\basync\b|\bawait\b/ },
  { name: 'import de node:*', pattern: /from\s+['"]node:/ },
  { name: 'process.*', pattern: /\bprocess\./ },
  { name: 'fetch/XMLHttpRequest', pattern: /\bfetch\s*\(|XMLHttpRequest/ },
];

describe('pureza do kernel (D2)', () => {
  it('nenhuma fonte de não-determinismo ou I/O em src/', async () => {
    const files = (await readdir(SRC)).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = await readFile(join(SRC, file), 'utf8');
      for (const { name, pattern } of FORBIDDEN) {
        expect(pattern.test(content), `${file} contém ${name}`).toBe(false);
      }
    }
  });

  it('dependência runtime única: @buildtovalue/core', async () => {
    const pkg = JSON.parse(
      await readFile(join(SRC, '..', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@buildtovalue/core']);
  });
});
