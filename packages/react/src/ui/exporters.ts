/**
 * SVG / PNG export.
 *
 * Limitation (browser security): the SVG must be self-contained. Fonts and
 * styles must be inline — external assets (webfonts, CSS URLs, images from
 * other origins) would taint the canvas and block PNG generation. bpmn-react
 * shapes use attribute styling with CSS-variable fallbacks, so the default
 * look exports correctly.
 */

/** Serializes the live canvas SVG, sized to the current viewBox. */
export function svgToString(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0) {
    clone.setAttribute('width', String(viewBox.width));
    clone.setAttribute('height', String(viewBox.height));
  }
  // Strip transient interaction artifacts.
  for (const selector of ['[data-ports]', '[data-resize-handles]', '[data-selection-box]', '[data-connection-preview]', '[data-selection-halo]', '[data-node-issue]', '[data-closed-seal]']) {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  }
  return new XMLSerializer().serializeToString(clone);
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

export function exportSvg(svg: SVGSVGElement, filename = 'diagram.svg'): void {
  downloadFile(filename, svgToString(svg), 'image/svg+xml');
}

/** Renders the SVG onto a canvas and downloads a PNG (scale 2 by default). */
export async function exportPng(
  svg: SVGSVGElement,
  filename = 'diagram.png',
  scale = 2,
): Promise<void> {
  const text = svgToString(svg);
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
