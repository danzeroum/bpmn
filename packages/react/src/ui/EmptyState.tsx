import { activeNodes, createDiagram, createEdge, createNode, type BpmnDiagram } from '@buildtovalue/core';
import { useCanvasState } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useT } from '../i18n/I18nContext.js';
import type { TFunction } from '../i18n/messages.js';

/**
 * Empty-canvas teaching state (Handoff 15 §2f): shows ONLY while the diagram
 * has zero active elements (it disappears at the first element and comes back
 * if the canvas empties again — pure derivation, no flag), teaches the three
 * entry points (palette drag / Tab chaining / Ctrl+⌘K) and offers a ONE-CLICK
 * governed example — a diagram with a real version block (semver, status,
 * change summary, author), never a loose sample.
 */
export function buildGovernedExample(t: TFunction): BpmnDiagram {
  const diagram = createDiagram({ name: 'Exemplo governado', id: 'exemplo-governado' });
  diagram.version = {
    ...diagram.version,
    semanticVersion: '1.0.0',
    status: 'draft',
    changeSummary: t('emptyState.exampleSummary'),
    createdBy: 'empty-state',
  };
  diagram.nodes = {
    start: createNode({
      id: 'start',
      type: 'startEvent',
      label: t('emptyState.example.start'),
      x: 60,
      y: 120,
    }),
    review: createNode({
      id: 'review',
      type: 'userTask',
      label: t('emptyState.example.review'),
      x: 240,
      y: 110,
    }),
    end: createNode({
      id: 'end',
      type: 'endEvent',
      label: t('emptyState.example.end'),
      x: 460,
      y: 120,
    }),
  };
  diagram.edges = {
    f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'review' }),
    f2: createEdge({ id: 'f2', sourceId: 'review', targetId: 'end' }),
  };
  return diagram;
}

export function EmptyState() {
  const { diagram, replaceDiagram } = useDiagram();
  const readOnly = useCanvasState((s) => s.readOnly);
  const t = useT();
  if (readOnly || activeNodes(diagram).length > 0) return null;
  return (
    <div className="bpmnr-empty-state" data-bpmnr-empty-state data-testid="empty-state">
      <p className="bpmnr-empty-state-title">{t('emptyState.title')}</p>
      <p className="bpmnr-empty-state-teach">{t('emptyState.teach')}</p>
      <button
        type="button"
        data-testid="empty-state-example"
        onClick={() => replaceDiagram(buildGovernedExample(t))}
      >
        {t('emptyState.openExample')}
      </button>
    </div>
  );
}
