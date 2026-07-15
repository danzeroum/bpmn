import { describe, expect, it } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Handoff 11 N-7 — the viewer must be genuinely lightweight, proven by MEASURED
 * numbers, not estimates. We statically walk the ESM import graph of the built
 * `dist/esm` output from each entry (`viewer.js` vs `index.js`) and:
 *
 *  1. dep-graph — the `@buildtovalue/react/viewer` entry must NOT reach any
 *     editor-machinery module (interactions, keyboard, toolbar, palette,
 *     inspector, minimap, resilience, context menu, edge-label editor,
 *     exporters, autosave, the editor canvas, or the Designer/Editor shells).
 *  2. size — the total bytes of the files the viewer entry pulls must be ≤ 50%
 *     of what the editor entry pulls.
 *
 * `import type` is erased by tsc, so the dist graph reflects RUNTIME imports
 * only — exactly what a tree-shaking bundler (sideEffects:false) would keep.
 * The test requires a fresh build (CI builds before testing).
 */
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/esm');

// Editor-machinery modules the viewer entry must never pull in.
const FORBIDDEN = [
  'canvas/useInteractions.js',
  'gestures/useKeyboardShortcuts.js',
  'canvas/Canvas.js',
  'canvas/ResilienceLayer.js',
  'canvas/EdgeLabelEditor.js',
  'ui/Toolbar.js',
  'ui/Palette.js',
  'ui/PropertiesPanel.js',
  'ui/MiniMap.js',
  'ui/ContextMenu.js',
  'ui/exporters.js',
  'state/autosave.js',
  'BpmnDesigner.js',
  'BpmnEditor.js',
];

const IMPORT_RE = /(?:import|export)\b[^'"]*?\bfrom\s*['"](\.[^'"]+)['"]/g;
const BARE_IMPORT_RE = /\bimport\s*['"](\.[^'"]+)['"]/g;

/** Files reachable from an entry via relative static imports/re-exports. */
function reachedFiles(entryRel: string): Set<string> {
  const entry = resolve(DIST, entryRel);
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    const here = dirname(file);
    for (const re of [IMPORT_RE, BARE_IMPORT_RE]) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(src)) !== null) {
        queue.push(resolve(here, match[1]));
      }
    }
  }
  return seen;
}

function totalBytes(files: Set<string>): number {
  let bytes = 0;
  for (const file of files) bytes += statSync(file).size;
  return bytes;
}

function rel(file: string): string {
  return file.slice(DIST.length + 1);
}

describe('BpmnViewer bundle (N-7)', () => {
  const built = existsSync(resolve(DIST, 'viewer.js')) && existsSync(resolve(DIST, 'index.js'));

  it.runIf(built)('the viewer entry does not pull the editor graph', () => {
    const viewer = reachedFiles('viewer.js');
    const reachedRel = new Set([...viewer].map(rel));
    const leaked = FORBIDDEN.filter((mod) => reachedRel.has(mod));
    expect(leaked, `viewer entry reached editor modules: ${leaked.join(', ')}`).toEqual([]);
  });

  it.runIf(built)('the viewer bundle is ≤ 50% of the editor bundle (measured)', () => {
    const viewerBytes = totalBytes(reachedFiles('viewer.js'));
    const editorBytes = totalBytes(reachedFiles('index.js'));
    const ratio = viewerBytes / editorBytes;
    // Surface the real numbers so a regression reads at a glance.
     
    console.log(
      `viewer=${viewerBytes}B editor=${editorBytes}B ratio=${(ratio * 100).toFixed(1)}%`,
    );
    expect(ratio).toBeLessThanOrEqual(0.5);
  });
});
