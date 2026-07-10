import {
  activeEdges,
  activeNodes,
  waypointsToPath,
  type BpmnDiagram,
  type BpmnNode,
} from '@buildtovalue/core';
import type { ThumbnailSpec } from '@buildtovalue/library';

/**
 * Headless mini-flow renderer: the adapter draws (Handoff 6 §3.1), the
 * library only places the string. No DOM, no React — plain SVG markup over
 * the diagram geometry. Colors come from the --btv-* tokens with the same
 * fallbacks used by the react layer, so thumbnails theme with the product.
 */

const INK = 'var(--btv-ink, #44403a)';
const GOLD = 'var(--btv-gold, #9a7b1e)';
const PAPER = 'var(--btv-palette-item-bg, #fdfaf1)';
const PADDING = 12;

function nodeShape(node: BpmnNode): string {
  const { x, y, width: w, height: h, type } = node;
  const common = `fill="${PAPER}" stroke="${INK}" stroke-width="1.5"`;
  if (type === 'btv:persona') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ${common}/>`;
  }
  if (type === 'btv:gate') {
    const points = hexagon(x, y, w, h);
    return `<polygon points="${points}" fill="${PAPER}" stroke="${GOLD}" stroke-width="1.5"/>`;
  }
  if (type === 'btv:deliverable') {
    return `<polygon points="${pennant(x, y, w, h)}" ${common}/>`;
  }
  if (type.toLowerCase().includes('gateway')) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    return `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" ${common}/>`;
  }
  if (type.toLowerCase().includes('event')) {
    const r = Math.min(w, h) / 2;
    return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${r}" ${common}/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" ${common}/>`;
}

function hexagon(x: number, y: number, w: number, h: number): string {
  const inset = Math.min(w / 4, h / 2);
  return [
    `${x + inset},${y}`,
    `${x + w - inset},${y}`,
    `${x + w},${y + h / 2}`,
    `${x + w - inset},${y + h}`,
    `${x + inset},${y + h}`,
    `${x},${y + h / 2}`,
  ].join(' ');
}

function pennant(x: number, y: number, w: number, h: number): string {
  return [`${x},${y}`, `${x + w},${y + h / 2}`, `${x},${y + h}`].join(' ');
}

function edgePath(diagram: BpmnDiagram, sourceId: string, targetId: string): string | undefined {
  const source = diagram.nodes[sourceId];
  const target = diagram.nodes[targetId];
  if (!source || !target) return undefined;
  return waypointsToPath([
    { x: source.x + source.width / 2, y: source.y + source.height / 2 },
    { x: target.x + target.width / 2, y: target.y + target.height / 2 },
  ]);
}

/** Draws the active flow of a diagram as a self-contained SVG string. */
export function diagramThumbnail(diagram: BpmnDiagram): ThumbnailSpec {
  const nodes = activeNodes(diagram);
  if (nodes.length === 0) return { kind: 'none' };

  const minX = Math.min(...nodes.map((n) => n.x)) - PADDING;
  const minY = Math.min(...nodes.map((n) => n.y)) - PADDING;
  const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + PADDING;
  const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + PADDING;

  const edges = activeEdges(diagram)
    .map((edge) => {
      const d = edge.waypoints?.length
        ? waypointsToPath(edge.waypoints)
        : edgePath(diagram, edge.sourceId, edge.targetId);
      return d ? `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0.6"/>` : '';
    })
    .join('');
  const shapes = nodes.map(nodeShape).join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" ` +
    `role="img" aria-hidden="true">${edges}${shapes}</svg>`;
  return { kind: 'svg', svg };
}

/** Tiny decision-table glyph for DMN decision artifacts. */
export function decisionThumbnail(rules: number): ThumbnailSpec {
  const rows = Math.max(1, Math.min(rules, 4));
  const lines = Array.from({ length: rows }, (_, i) => {
    const y = 26 + i * 12;
    return `<line x1="12" y1="${y}" x2="84" y2="${y}" stroke="${INK}" stroke-width="1" opacity="0.5"/>`;
  }).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 ${34 + rows * 12}" role="img" aria-hidden="true">` +
    `<rect x="6" y="6" width="84" height="${22 + rows * 12}" rx="4" fill="${PAPER}" stroke="${GOLD}" stroke-width="1.5"/>` +
    `<line x1="12" y1="18" x2="84" y2="18" stroke="${GOLD}" stroke-width="1.5"/>${lines}</svg>`;
  return { kind: 'svg', svg };
}
