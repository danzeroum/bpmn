import type { ThumbnailSpec } from '@buildtovalue/library';

/**
 * Places the thumbnail the adapter provided (§3.1): SVG string, named icon,
 * or nothing. The library never draws domain shapes itself — the SVG comes
 * ready from the adapter (trusted host-registered code, not user input).
 */
export function Thumbnail({ spec }: { spec?: ThumbnailSpec }) {
  if (spec?.kind === 'svg') {
    return (
      <span
        className="btv-lib-thumb-art"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: spec.svg }}
      />
    );
  }
  if (spec?.kind === 'icon') {
    return (
      <span className="btv-lib-thumb-art btv-lib-thumb-icon" aria-hidden>
        {spec.icon}
      </span>
    );
  }
  return <span className="btv-lib-thumb-art btv-lib-thumb-empty" aria-hidden />;
}
