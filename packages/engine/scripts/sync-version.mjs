// Sincroniza src/version.ts com a versão do package.json (triagem phase-1,
// item 1): ENGINE_VERSION é o valor gravado POR INSTÂNCIA que replay e
// StateMigrator usam — não pode divergir do pacote publicado. Roda no build
// e no version-packages; o teste tests/version.test.ts trava qualquer deriva.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const target = join(root, 'src', 'version.ts');
const content = `// GERADO por scripts/sync-version.mjs a partir do package.json — NÃO editar.
// (D6: replay é contrato; a versão gravada em cada estado É a publicada.)
/** Versão semântica do engine gravada em cada estado (D6). */
export const ENGINE_VERSION = '${version}';
`;
let current = '';
try {
  current = readFileSync(target, 'utf8');
} catch {
  // primeira geração
}
if (current !== content) {
  writeFileSync(target, content);
  console.log(`engine: version.ts sincronizado com ${version}`);
}
