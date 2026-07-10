import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BpmnXmlConverter,
  childrenOf,
  compositeCommand,
  getBoundingBox,
  JsonSerializer,
  nodeParentId,
  type BpmnDiagram,
  type BpmnNode,
  type ValidationIssue,
} from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { fitViewport, zoomViewportAt } from '../canvas/viewport.js';
import { clearRoutingCommands } from '../canvas/routeEdge.js';
import { downloadFile, exportPng, exportSvg } from './exporters.js';
import { clearAutosave } from '../state/autosave.js';
import { GovernanceBreadcrumb, type GovernanceBreadcrumbLevel } from './GovernanceBreadcrumb.js';

export interface ToolbarProps {
  /** Extra buttons rendered at the end of the toolbar. */
  extra?: ReactNode;
}

/**
 * Default toolbar: undo/redo, zoom, fit, snap toggle, validation and
 * export (BPMN XML / JSON / SVG / PNG).
 */
export function Toolbar({ extra }: ToolbarProps) {
  const { diagram, execute, undo, redo, canUndo, canRedo, lastVeto } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const snapEnabled = useCanvasState((s) => s.snapEnabled);
  const viewportWidth = useCanvasState((s) => s.viewport.width);
  const drillId = useCanvasState((s) => s.drillId);
  const readOnly = useCanvasState((s) => s.readOnly);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const issuesRef = useRef<HTMLDivElement | null>(null);
  // Transient status line (Handoff 10 §1.4 "Limpar roteamento" toast).
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // "Limpar roteamento" (§1.4): re-optimize every automatic A* route as ONE
  // undoable command; manual routes are preserved unless `includeManual` (the
  // confirmed total reset). The toast reports the real counts.
  const clearRouting = (includeManual: boolean) => {
    const { commands, reoptimized, preserved } = clearRoutingCommands(diagram, config.edgeRouter, {
      includeManual,
    });
    if (commands.length === 0) {
      setToast('Nenhuma rota automática para re-otimizar');
      return;
    }
    execute(compositeCommand('Clear routing', commands));
    const parts = [`${reoptimized} ${reoptimized === 1 ? 'aresta re-otimizada' : 'arestas re-otimizadas'}`];
    if (!includeManual && preserved > 0) {
      parts.push(`${preserved} ${preserved === 1 ? 'rota manual preservada' : 'rotas manuais preservadas'}`);
    }
    parts.push('desfazível');
    setToast(parts.join(' · '));
  };

  const zoomBy = (factor: number) => {
    const { viewport } = store.getState();
    const center = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
    store.setState({ viewport: zoomViewportAt(viewport, center, factor) });
  };

  const fit = () => {
    const nodes = Object.values(diagram.nodes);
    if (nodes.length === 0) return;
    const svg = document.querySelector<SVGSVGElement>('svg.bpmnr-canvas');
    const aspect = svg && svg.clientHeight > 0 ? svg.clientWidth / svg.clientHeight : 1.5;
    store.setState({ viewport: fitViewport(getBoundingBox(nodes), aspect) });
  };

  const validate = () => {
    const found = config.validationEngine.validate(applyBeforeSave()).issues;
    setIssues(found);
    // N-3 `validation.changed`: counts + stable codes for the host's sink.
    config.emitEditorEvent('validation.changed', {
      errors: found.filter((issue) => issue.severity === 'error').length,
      warnings: found.filter((issue) => issue.severity === 'warning').length,
      codes: [...new Set(found.map((issue) => issue.code))].sort(),
    });
    // Shape-state badges (pendência §5): mark offending nodes on the canvas
    // while the issues panel is open; errors win over warnings, info stays
    // panel-only. The issue code rides along (Handoff 5 §3.2).
    const badges: Record<string, { severity: 'error' | 'warning'; code?: string }> = {};
    for (const issue of found) {
      if (!issue.nodeId || issue.severity === 'info') continue;
      if (issue.severity === 'error' || badges[issue.nodeId] === undefined) {
        badges[issue.nodeId] = { severity: issue.severity, code: issue.code };
      }
    }
    store.setState({ issueBadges: badges });
  };

  const closeIssues = () => {
    setIssues(null);
    store.setState({ issueBadges: {} });
  };

  const applyBeforeSave = () => {
    let result = diagram;
    for (const plugin of config.plugins) {
      result = plugin.onBeforeSave?.(result) ?? result;
    }
    return result;
  };

  // An explicit export counts as a save: drop the autosave and the dirty flag.
  const markSaved = () => {
    clearAutosave(diagram.id);
    store.setState({ dirtySinceExport: false });
  };

  const exportXml = () => {
    const converter = new BpmnXmlConverter({
      registry: config.registry,
      preferredTypes: config.preferredTypes,
    });
    downloadFile(`${slug(diagram.name)}.bpmn.xml`, converter.toXml(applyBeforeSave()), 'application/xml');
    markSaved();
  };

  const exportJson = () => {
    downloadFile(
      `${slug(diagram.name)}.json`,
      new JsonSerializer().serialize(applyBeforeSave()),
      'application/json',
    );
    markSaved();
  };

  const findSvg = () => document.querySelector<SVGSVGElement>('svg.bpmnr-canvas');

  // Governance breadcrumb (F7-2 → Handoff 5 §10.3): the chain of
  // sub-processes from the root to the current view, each level carrying the
  // diagram's semver + vigência seal. Empty when looking at the whole
  // process. Navigating UP preserves the selection (aceite 10.5.3).
  const trail = drillId !== null ? breadcrumbTrail(diagram, drillId) : [];
  const breadcrumbLevels: GovernanceBreadcrumbLevel[] = [
    {
      id: null,
      label: diagram.name,
      semanticVersion: diagram.version.semanticVersion,
      status: diagram.version.status,
    },
    ...trail.map((node) => ({
      id: node.id,
      label: node.label,
      semanticVersion: diagram.version.semanticVersion,
      status: diagram.version.status,
    })),
  ];

  const drillTo = (targetId: string | null) => {
    const scope =
      targetId === null
        ? Object.values(diagram.nodes).filter((node) => nodeParentId(node) === undefined)
        : childrenOf(diagram, targetId);
    const svg = findSvg();
    const aspect = svg && svg.clientHeight > 0 ? svg.clientWidth / svg.clientHeight : 1.5;
    store.setState({
      drillId: targetId,
      ...(scope.length > 0 ? { viewport: fitViewport(getBoundingBox(scope), aspect) } : {}),
    });
  };

  return (
    <div className="bpmnr-toolbar" role="toolbar" aria-label="Editor toolbar">
      <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
        ↩
      </button>
      <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
        ↪
      </button>
      <span className="bpmnr-toolbar-sep" />
      <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom in" title="Zoom in">
        +
      </button>
      <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom out" title="Zoom out">
        −
      </button>
      <button type="button" onClick={fit} aria-label="Fit diagram" title="Fit diagram">
        ⛶
      </button>
      <span className="bpmnr-toolbar-zoom" aria-live="polite">
        {Math.round((1200 / viewportWidth) * 100)}%
      </span>
      <button
        type="button"
        aria-pressed={snapEnabled}
        onClick={() => store.setState({ snapEnabled: !snapEnabled })}
        title="Snap to grid"
      >
        ⌗
      </button>
      {trail.length > 0 && (
        <>
          <span className="bpmnr-toolbar-sep" />
          <GovernanceBreadcrumb
            levels={breadcrumbLevels}
            onNavigate={(id) => drillTo(id)}
            ariaLabel="Sub-process navigation"
          />
        </>
      )}
      <span className="bpmnr-toolbar-sep" />
      <button type="button" onClick={validate} aria-label="Validate diagram">
        ✓ Validate
      </button>
      <span className="bpmnr-toolbar-sep" />
      <button type="button" onClick={exportXml} aria-label="Export BPMN XML">
        XML
      </button>
      <button type="button" onClick={exportJson} aria-label="Export JSON">
        JSON
      </button>
      <button
        type="button"
        onClick={() => {
          const svg = findSvg();
          if (svg) void exportSvg(svg, `${slug(diagram.name)}.svg`);
        }}
        aria-label="Export SVG"
      >
        SVG
      </button>
      <button
        type="button"
        onClick={() => {
          const svg = findSvg();
          if (svg) void exportPng(svg, `${slug(diagram.name)}.png`);
        }}
        aria-label="Export PNG"
      >
        PNG
      </button>
      {!readOnly && (
        <>
          <span className="bpmnr-toolbar-sep" />
          <button
            type="button"
            data-action="clear-routing"
            onClick={() => clearRouting(false)}
            aria-label="Limpar roteamento"
            title="Re-otimiza as rotas automáticas (preserva rotas manuais)"
          >
            ⟲ Rotas
          </button>
          <button
            type="button"
            data-action="clear-routing-all"
            onClick={() => {
              const ok =
                typeof window === 'undefined' ||
                typeof window.confirm !== 'function' ||
                window.confirm(
                  'Resetar TODAS as rotas ao automático, incluindo as manuais? Esta ação é desfazível.',
                );
              if (ok) clearRouting(true);
            }}
            aria-label="Resetar todas as rotas"
            title="Reseta todas as rotas ao automático, incluindo as manuais (pede confirmação)"
          >
            ⟲⟲
          </button>
        </>
      )}
      {extra}
      {toast && (
        <span className="bpmnr-toolbar-toast" role="status" data-testid="routing-toast">
          {toast}
        </span>
      )}
      {lastVeto && (
        <span className="bpmnr-toolbar-veto" role="status">
          🔒 {lastVeto}
        </span>
      )}
      {issues !== null && (
        <div ref={issuesRef} className="bpmnr-issues" role="status" aria-label="Validation result">
          {issues.length === 0 ? (
            <span className="bpmnr-issues-ok">No issues found</span>
          ) : (
            <ul>
              {issues.map((issue, index) => (
                <li key={index} data-severity={issue.severity}>
                  <strong>{issue.severity}</strong> {issue.message}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={closeIssues} aria-label="Close validation">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

/** Chain of sub-processes from the outermost ancestor down to `drillId`. */
function breadcrumbTrail(diagram: BpmnDiagram, drillId: string): BpmnNode[] {
  const trail: BpmnNode[] = [];
  const seen = new Set<string>();
  let current: BpmnNode | undefined = diagram.nodes[drillId];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    const parentId = nodeParentId(current);
    current = parentId !== undefined ? diagram.nodes[parentId] : undefined;
  }
  return trail;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
}
