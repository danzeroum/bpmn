import type { ArtifactSummary } from '@buildtovalue/library';
import { StatusBadge } from '@buildtovalue/react';
import { Thumbnail } from './Thumbnail.js';

export interface ArtifactCardProps {
  item: ArtifactSummary;
  selected: boolean;
  onSelect: () => void;
}

/**
 * Gallery card (Handoff 3 §5): 108px thumb with dot-grid + type chip, name,
 * seal row (the SAME StatusBadge as everywhere — §10.6) + channel + pinned
 * runs, free meta line. A button, so the grid is keyboard-navigable as-is.
 */
export function ArtifactCard({ item, selected, onSelect }: ArtifactCardProps) {
  return (
    <button
      type="button"
      className="btv-lib-card"
      data-selected={selected || undefined}
      data-artifact={`${item.ref.adapterId}:${item.ref.artifactId}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="btv-lib-thumb">
        <span className="btv-lib-type-chip">{item.typeLabel}</span>
        <Thumbnail spec={item.thumbnail} />
      </span>
      <span className="btv-lib-card-body">
        <span className="btv-lib-card-name">{item.name}</span>
        <span className="btv-lib-card-seals">
          <StatusBadge seal={{ status: item.status, semanticVersion: item.version }} />
          {item.channel && <span className="btv-lib-channel-chip">{item.channel}</span>}
          {item.boundRuns !== undefined && item.boundRuns > 0 && (
            <span className="btv-lib-runs-chip">
              {item.boundRuns} {item.boundRuns === 1 ? 'execução presa' : 'execuções presas'}
            </span>
          )}
        </span>
        {item.meta && <span className="btv-lib-card-meta">{item.meta}</span>}
      </span>
    </button>
  );
}
