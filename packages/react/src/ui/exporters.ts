/**
 * SVG / PNG export.
 *
 * The export is made **self-contained** (pendência #27, §8.7 "export fiel"):
 * the live CSS custom properties the shapes reference are inlined so `var(--x)`
 * resolves to the on-screen (themed) value rather than the hardcoded fallback;
 * `<image>` hrefs are embedded as data URIs so a cross-origin asset can't taint
 * the canvas and null the PNG; and same-origin `@font-face` fonts are embedded
 * so custom type renders in the raster. Anything that can't be inlined (a
 * genuinely cross-origin, CORS-blocked asset) is left as-is — the export still
 * produces output rather than throwing.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Transient interaction artifacts never belong in an export. */
const TRANSIENT_SELECTORS = [
  '[data-ports]',
  '[data-resize-handles]',
  '[data-selection-box]',
  '[data-connection-preview]',
  '[data-selection-halo]',
  '[data-node-issue]',
  '[data-closed-seal]',
  '[data-layer="settling"]',
  '[data-alignment-guides]',
  '[data-context-pad]',
  '[data-search-pulse]',
];

/** Clones the live canvas SVG, sizes it to the viewBox, strips transient
 * artifacts, and inlines the live CSS custom properties so themed colors export
 * faithfully. Synchronous — asset embedding (images/fonts) is the async step. */
function cloneForExport(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('xmlns:xlink', XLINK_NS);
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0) {
    clone.setAttribute('width', String(viewBox.width));
    clone.setAttribute('height', String(viewBox.height));
  }
  for (const selector of TRANSIENT_SELECTORS) {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  }
  const vars = collectCustomProperties(svg);
  for (const [name, value] of Object.entries(vars)) clone.style.setProperty(name, value);
  return clone;
}

/** Serializes the live canvas SVG (self-contained for styles; images/fonts are
 * embedded by {@link exportSvg}/{@link exportPng}). */
export function svgToString(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(cloneForExport(svg));
}

/** Resolves every `--bpmnr-*` / `--btv-*` custom property the document defines
 * to its live value on `el`, so the export doesn't depend on the fallbacks. */
function collectCustomProperties(el: Element): Record<string, string> {
  const names = new Set<string>();
  for (const sheet of styleSheets()) {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin stylesheet — cssRules access throws
    }
    collectVarNames(rules, names);
  }
  if (names.size === 0) return {};
  const computed = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim();
    if (value) out[name] = value;
  }
  return out;
}

/** Recursively harvests custom-property names (`--x`) declared anywhere in the
 * rule list (including inside `@media`/`@supports` groups). */
function collectVarNames(rules: CSSRuleList, into: Set<string>): void {
  for (const rule of Array.from(rules)) {
    const style = (rule as CSSStyleRule).style;
    if (style) {
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (prop.startsWith('--')) into.add(prop);
      }
    }
    const nested = (rule as CSSGroupingRule).cssRules;
    if (nested) collectVarNames(nested, into);
  }
}

/** Serialize with images and fonts embedded — fully portable output. */
async function serializeWithAssets(svg: SVGSVGElement): Promise<string> {
  const clone = cloneForExport(svg);
  await inlineImages(clone);
  await embedFonts(clone);
  return new XMLSerializer().serializeToString(clone);
}

/** Rewrites `<image>` hrefs to `data:` URIs so no cross-origin fetch happens at
 * raster time (the taint that nulls `toBlob`). Unreachable assets are left. */
async function inlineImages(root: Element): Promise<void> {
  const images = Array.from(root.querySelectorAll('image'));
  await Promise.all(
    images.map(async (img) => {
      const href = img.getAttribute('href') ?? img.getAttributeNS(XLINK_NS, 'href');
      if (!href || href.startsWith('data:')) return;
      const dataUri = await fetchAsDataUri(href);
      if (!dataUri) return;
      img.setAttribute('href', dataUri);
      img.removeAttributeNS(XLINK_NS, 'href');
    }),
  );
}

/** Embeds same-origin `@font-face` fonts as a `<style>` of data-URI faces, so
 * custom type rasterizes. Cross-origin/unreachable faces are skipped. */
async function embedFonts(root: SVGSVGElement): Promise<void> {
  const faces: string[] = [];
  for (const sheet of styleSheets()) {
    let rules: CSSRuleList | undefined;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (typeof CSSFontFaceRule !== 'undefined' && rule instanceof CSSFontFaceRule) {
        const embedded = await embedFontFace(rule);
        if (embedded) faces.push(embedded);
      }
    }
  }
  if (faces.length === 0) return;
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = faces.join('\n');
  root.insertBefore(style, root.firstChild);
}

/** Rebuilds one `@font-face` rule with its first URL src inlined as a data URI. */
async function embedFontFace(rule: CSSFontFaceRule): Promise<string | null> {
  const src = rule.style.getPropertyValue('src');
  const match = src.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
  if (!match) return null;
  const url = match[1];
  if (url.startsWith('data:')) return rule.cssText;
  const dataUri = await fetchAsDataUri(url);
  if (!dataUri) return null;
  const family = rule.style.getPropertyValue('font-family');
  const weight = rule.style.getPropertyValue('font-weight') || 'normal';
  const fontStyle = rule.style.getPropertyValue('font-style') || 'normal';
  return `@font-face{font-family:${family};font-weight:${weight};font-style:${fontStyle};src:url(${dataUri});}`;
}

/** Fetches a URL and returns it as a `data:` URI, or `null` if unreachable. */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUri(blob);
  } catch {
    return null;
  }
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read asset'));
    reader.readAsDataURL(blob);
  });
}

function styleSheets(): CSSStyleSheet[] {
  return typeof document !== 'undefined' ? Array.from(document.styleSheets) : [];
}

export function downloadFile(filename: string, content: string | Blob, mime: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Downloads a self-contained SVG (styles, images and fonts embedded). */
export async function exportSvg(svg: SVGSVGElement, filename = 'diagram.svg'): Promise<void> {
  downloadFile(filename, await serializeWithAssets(svg), 'image/svg+xml');
}

/** Renders the SVG onto a canvas and downloads a PNG (scale 2 by default).
 * Assets are embedded first so a cross-origin image never taints the canvas. */
export async function exportPng(
  svg: SVGSVGElement,
  filename = 'diagram.png',
  scale = 2,
): Promise<void> {
  const text = await serializeWithAssets(svg);
  const viewBox = svg.viewBox.baseVal;
  const width = (viewBox?.width || svg.clientWidth || 800) * scale;
  const height = (viewBox?.height || svg.clientHeight || 600) * scale;

  const blob = await new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context unavailable'));
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('PNG export failed — ensure the SVG has no external assets'));
      }, 'image/png');
    };
    image.onerror = () => reject(new Error('Could not rasterize SVG'));
    image.src = url;
  });
  downloadFile(filename, blob, 'image/png');
}
