#!/usr/bin/env node
/**
 * i18n cerca (Handoff 11 N-6) — the same grep-based gate pattern as
 * `check-no-key-generation` (cerca §1.1). It fails the build when a MIGRATED
 * react/studio surface carries a hardcoded UI string instead of going through
 * the injected dictionary (`useT()` → `t('key')`). Two independent checks:
 *
 *   1. Anti-literal — no user-facing literal on a migrated surface:
 *      · text-bearing attributes (aria-label / title / placeholder / alt)
 *        assigned a quoted string literal (must be `{t(...)}`);
 *      · plain-prose JSX text (a text node with letters and no code punctuation);
 *      · inline `>…text…<` between tags.
 *      Escape hatch: a line carrying `i18n-exempt` is skipped (for the rare
 *      genuinely-static token — a symbol, a proper noun, an SI unit).
 *
 *   2. Key coverage — every `t('key')` used on a migrated surface must exist in
 *      the English dictionary (`en.ts`), the source of truth for the fallback.
 *      A typo or a forgotten dictionary entry fails here, not at runtime.
 *
 * English (`en.ts`) and Portuguese (`ptBR.ts`) are dictionaries BY DESIGN and
 * are never scanned for literals.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

// The migrated surfaces (§ "TODAS as superfícies react/studio"): Designer
// chrome, panels, Copilot, Review, Explorer, menus, toasts. Add a file here
// the moment its strings move into the dictionary — the gate then guards it.
const MIGRATED = [
  'packages/react/src/ui/Toolbar.tsx',
  'packages/react/src/ui/PropertiesPanel.tsx',
  'packages/react/src/ui/Palette.tsx',
  'packages/react/src/ui/PromotionPanel.tsx',
  'packages/react/src/ui/VersionBanner.tsx',
  'packages/react/src/ui/VersionTimeline.tsx',
  'packages/react/src/ui/LedgerStatus.tsx',
  'packages/react/src/ui/StatusBadge.tsx',
  'packages/react/src/ui/SignatureBadge.tsx',
  'packages/react/src/ui/GovernanceBreadcrumb.tsx',
  'packages/react/src/ui/MiniMap.tsx',
  'packages/react/src/ui/DiffView.tsx',
  'packages/react/src/ui/EdgePedigree.tsx',
  'packages/react/src/ui/CanonicalPayloadCard.tsx',
  'packages/react/src/ui/AnchorSeal.tsx',
  'packages/react/src/ui/ContextMenu.tsx',
  'packages/react/src/canvas/EdgeLabelEditor.tsx',
  'packages/react/src/canvas/NodeLabelEditor.tsx',
  'packages/react/src/canvas/NodeRenderer.tsx',
  'packages/react/src/canvas/EdgeRenderer.tsx',
  'packages/react/src/canvas/ResilienceLayer.tsx',
  'packages/react/src/canvas/ContextPad.tsx',
  'packages/react/src/ui/SearchPanel.tsx',
  'packages/react/src/ui/CommandPalette.tsx',
  'packages/react/src/ui/Cheatsheet.tsx',
  'packages/react/src/ui/EmptyState.tsx',
  'packages/react/src/ui/EventDefinitionSection.tsx',
  'packages/react/src/ui/TimerSection.tsx',
  'packages/react/src/ui/InterruptingToggle.tsx',
  'packages/react/src/ui/LintPanel.tsx',
  'packages/react/src/ui/LayoutProposalCard.tsx',
  'packages/react/src/viewer/BpmnDiffViewer.tsx',
  'packages/react/src/copilot/CopilotPanel.tsx',
  'packages/react/src/agent/AgentStudio.tsx',
  'packages/react/src/squad/SquadStudio.tsx',
  'packages/react/src/squad/squadPlugin.tsx',
  'packages/react/src/squad/SquadTrail.tsx',
  'packages/react/src/agent/ReadinessBadge.tsx',
  'packages/react/src/simulation/SimulationPanel.tsx',
  'packages/react/src/simulation/GatewayChoiceCard.tsx',
  'packages/react/src/simulation/DecisionInputCard.tsx',
  'packages/react/src/replay/ReplayPanel.tsx',
  'packages/studio/src/StudioShell.tsx',
  'packages/studio/src/review/ReviewScreen.tsx',
  'packages/studio/src/ledger/LedgerExplorer.tsx',
  'packages/library-react/src/LibraryView.tsx',
  'packages/library-react/src/ArtifactCard.tsx',
  'packages/library-react/src/ArtifactDrawer.tsx',
];

const TEXT_ATTRS = /\b(aria-label|title|placeholder|alt)\s*=\s*"([^"]*[A-Za-z]{2,}[^"]*)"/;
// A whole line that is plain prose: letters, spaces and light punctuation only
// — the "text on its own line between tags" shape.
const PROSE_LINE = /^[A-Za-z][A-Za-z !?%·–—-]*[A-Za-z%]$/;
// Inline text immediately before a JSX closing tag: `>Save changes</`. The
// mandatory `</` is what distinguishes JSX text from generics (`<T>`),
// comparisons (`a < b`) and arrows (`=> x <`); the prose-only inner class
// (no `.`, `(`, `=`) keeps method chains out.
const INLINE_TEXT = />[ A-Za-z,!?%·–—-]*[A-Za-z]{2,}[ A-Za-z,!?%·–—-]*<\//;
// A prose line is skipped when it is really code on its own line: a trailing
// comma (destructuring / argument / object entry), a leading JS keyword, or a
// lone lowercase/kebab/camel identifier (a boolean JSX attribute like
// `data-open` / `aria-hidden`, or an expression fragment). Real UI copy is
// either multi-word or Capitalized, so this keeps `Cancelar` and `ver no
// canvas` while dropping `open`, `inspectorSections`, `data-minimap-viewport`.
const JS_KEYWORD =
  /^(void|return|const|let|var|await|async|yield|new|typeof|case|else|export|import|default|function|delete|throw|instanceof|in|of|as)\b/;
const CODE_TOKEN = /^[a-z][\w-]*$/;

function isProseText(trimmed) {
  if (/,$/.test(trimmed)) return false;
  if (JS_KEYWORD.test(trimmed)) return false;
  if (CODE_TOKEN.test(trimmed)) return false;
  return PROSE_LINE.test(trimmed);
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// The English fallback is assembled from the per-surface fragment files. Their
// literal `'a.b.c': '...'` entries are the source of truth for valid keys.
const FRAGMENTS_DIR = 'packages/react/src/i18n/fragments';

function dictKeys(dirRel) {
  const dir = join(ROOT, dirRel);
  if (!existsSync(dir)) return new Set();
  const keys = new Set();
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.ts') || entry === 'index.ts') continue;
    for (const line of readFileSync(join(dir, entry), 'utf8').split('\n')) {
      const match = line.match(/^\s*'([^']+)'\s*:/);
      if (match) keys.add(match[1]);
    }
  }
  return keys;
}

const enKeys = dictKeys(FRAGMENTS_DIR);
if (enKeys.size === 0) {
  console.error('i18n: no dictionary keys found under i18n/fragments — the fallback is missing.');
  process.exit(1);
}

const literalFailures = [];
const keyFailures = [];

for (const rel of MIGRATED) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    console.error(`i18n: migrated surface not found: ${rel}`);
    process.exit(1);
  }
  const raw = readFileSync(path, 'utf8');

  // Anti-literal — line by line on comment-stripped source.
  stripComments(raw)
    .split('\n')
    .forEach((line, i) => {
      if (/i18n-exempt/.test(line)) return;
      const trimmed = line.trim();
      if (trimmed === '') return;
      if (TEXT_ATTRS.test(line)) {
        literalFailures.push(`${rel}:${i + 1} — hardcoded text attribute: ${trimmed}`);
      } else if (INLINE_TEXT.test(line)) {
        literalFailures.push(`${rel}:${i + 1} — hardcoded inline text: ${trimmed}`);
      } else if (isProseText(trimmed)) {
        literalFailures.push(`${rel}:${i + 1} — hardcoded JSX text: ${trimmed}`);
      }
    });

  // Key coverage — every t('key') must exist in the English dictionary. A base
  // key resolves if it has `_one` / `_other` plural siblings (the caller passes
  // the base key and the engine selects the sibling by `params.count`).
  for (const match of raw.matchAll(/\bt\(\s*'([^']+)'/g)) {
    const key = match[1];
    const covered = enKeys.has(key) || enKeys.has(`${key}_one`) || enKeys.has(`${key}_other`);
    if (!covered) keyFailures.push(`${rel} — t('${key}') is not defined in en.ts`);
  }
}

if (literalFailures.length > 0 || keyFailures.length > 0) {
  if (literalFailures.length > 0) {
    console.error(
      'i18n cerca: hardcoded UI strings on migrated surfaces (use useT() → t(\'key\')):\n' +
        literalFailures.join('\n'),
    );
  }
  if (keyFailures.length > 0) {
    console.error('\ni18n cerca: t() keys missing from en.ts (add the fallback string):\n' + keyFailures.join('\n'));
  }
  process.exit(1);
}

console.log(
  `OK: ${MIGRATED.length} migrated surfaces carry no hardcoded UI strings; all t() keys resolve in en.ts (${enKeys.size} keys).`,
);
