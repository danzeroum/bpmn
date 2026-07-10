import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile, exportSvg, svgToString } from '../src/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** jsdom's Blob predates `Blob.text()`; read via FileReader (which our code
 * also uses) for portability. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
}

/**
 * jsdom does not implement `SVGSVGElement.viewBox` (the property is
 * `undefined`, not an SVGAnimatedRect), unlike every real browser. This
 * mirrors what a browser provides so the width/height-from-viewBox logic in
 * svgToString is actually exercised, without polyfilling jsdom globally.
 */
function makeSvg(viewBox: { x: number; y: number; width: number; height: number } | null = {
  x: 0,
  y: 0,
  width: 800,
  height: 600,
}): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  if (viewBox) {
    Object.defineProperty(svg, 'viewBox', { value: { baseVal: viewBox }, configurable: true });
  }
  return svg;
}

describe('svgToString', () => {
  it('marks the namespace and sizes the output from the viewBox', () => {
    const xml = svgToString(makeSvg());
    expect(xml).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(xml).toContain('width="800"');
    expect(xml).toContain('height="600"');
  });

  it('does not crash and omits width/height when there is no usable viewBox', () => {
    // Exercises the real jsdom default (svg.viewBox is undefined) — the
    // optional-chaining fallback must not throw.
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    const xml = svgToString(svg);
    expect(xml).not.toMatch(/\swidth="\d/);
    expect(xml).not.toMatch(/\sheight="\d/);
  });

  it('strips transient interaction artifacts but keeps permanent content', () => {
    const svg = makeSvg();
    for (const attr of [
      'data-ports',
      'data-resize-handles',
      'data-selection-box',
      'data-connection-preview',
      'data-selection-halo',
    ]) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute(attr, '');
      svg.appendChild(g);
    }
    const permanent = document.createElementNS(SVG_NS, 'rect');
    permanent.setAttribute('data-node-id', 'keep-me');
    svg.appendChild(permanent);

    const xml = svgToString(svg);
    expect(xml).not.toContain('data-ports');
    expect(xml).not.toContain('data-resize-handles');
    expect(xml).not.toContain('data-selection-box');
    expect(xml).not.toContain('data-connection-preview');
    expect(xml).not.toContain('data-selection-halo');
    expect(xml).toContain('data-node-id="keep-me"');
  });

  it('serializes a clone — the live SVG is left untouched', () => {
    const svg = makeSvg();
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-ports', '');
    svg.appendChild(g);

    svgToString(svg);

    expect(svg.querySelectorAll('[data-ports]')).toHaveLength(1);
  });
});

describe('downloadFile', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('wraps string content in a Blob with the given mime type', () => {
    downloadFile('diagram.svg', '<svg/>', 'image/svg+xml');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('image/svg+xml');
  });

  it('passes a Blob straight through unwrapped (PNG export path)', () => {
    const blob = new Blob(['binary'], { type: 'image/png' });
    downloadFile('diagram.png', blob, 'image/png');
    const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blobArg).toBe(blob);
  });

  it('sets the anchor href/download attributes, clicks it once, then revokes the URL', () => {
    downloadFile('report.json', '{}', 'application/json');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('exportSvg', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('downloads the serialized SVG under the requested filename with the svg mime type', async () => {
    let capturedDownload = '';
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedDownload = this.download;
    });

    await exportSvg(makeSvg(), 'my-diagram.svg');

    const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe('image/svg+xml');
    expect(capturedDownload).toBe('my-diagram.svg');
  });

  it('defaults the filename to diagram.svg', async () => {
    let capturedDownload = '';
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedDownload = this.download;
    });
    await exportSvg(makeSvg());
    expect(capturedDownload).toBe('diagram.svg');
  });

  it('embeds a cross-origin <image> as a data URI so the raster cannot be tainted (#27)', async () => {
    const pixel = Uint8Array.from([137, 80, 78, 71]);
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob([pixel], { type: 'image/png' }),
    })) as unknown as typeof fetch;

    const svg = makeSvg();
    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttribute('href', 'https://cdn.example.com/logo.png');
    svg.appendChild(image);

    let captured: Blob | undefined;
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
      captured = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob;
    });
    await exportSvg(svg);
    const xml = await readBlob(captured!);
    expect(xml).toContain('href="data:image/png;base64,');
    expect(xml).not.toContain('https://cdn.example.com/logo.png');
  });

  it('leaves an unreachable <image> in place rather than throwing (#27)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('CORS');
    }) as unknown as typeof fetch;
    const svg = makeSvg();
    const image = document.createElementNS(SVG_NS, 'image');
    image.setAttribute('href', 'https://blocked.example.com/x.png');
    svg.appendChild(image);
    await expect(exportSvg(svg)).resolves.toBeUndefined();
  });
});
