import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/index.js';

/**
 * Sincronia constante×package.json (triagem phase-1, item 1): ENGINE_VERSION
 * é gravada POR INSTÂNCIA e usada por replay (D6) e StateMigrator (D14) —
 * divergir do pacote publicado corrompe a proveniência. O bump do changesets
 * só toca o package.json; scripts/sync-version.mjs regenera src/version.ts
 * (no build e no version-packages) e ESTE teste trava qualquer deriva.
 */
describe('ENGINE_VERSION', () => {
  it('é exatamente a versão do package.json', () => {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
        'utf8',
      ),
    ) as { version: string };
    expect(ENGINE_VERSION).toBe(pkg.version);
  });
});
