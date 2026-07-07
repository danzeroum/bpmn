import { useRef, useState, type ReactNode } from 'react';
import {
  BpmnXmlConverter,
  getBoundingBox,
  JsonSerializer,
  type ValidationIssue,
} from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState, useCanvasStore } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { fitViewport, zoomViewportAt } from '../canvas/viewport.js';
import { downloadFile, exportPng, exportSvg } from './exporters.js';

export interface ToolbarProps {
  /** Extra buttons rendered at the end of the toolbar. */
  extra?: ReactNode;
}

/**
 * Default toolbar: undo/redo, zoom, fit, snap toggle, validation and
 * export (BPMN XML / JSON / SVG / PNG).
 */
export function Toolbar({ extra }: ToolbarProps) {
  const { diagram, undo, redo, canUndo, canRedo, lastVeto } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const snapEnabled = useCanvasState((s) => s.snapEnabled);
  const viewportWidth = useCanvasState((s) => s.viewport.width);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const issuesRef = useRef<HTMLDivElement | null>(null);

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
    setIssues(config.validationEngine.validate(applyBeforeSave()).issues);
  };

  const applyBeforeSave = () => {
    let result = diagram;
    for (const plugin of config.plugins) {
      result = plugin.onBeforeSave?.(result) ?? result;
    }
    return result;
  };

  const exportXml = () => {
    const converter = new BpmnXmlConverter({
      registry: config.registry,
      preferredTypes: config.preferredTypes,
    });
    downloadFile(`${slug(diagram.name)}.bpmn.xml`, converter.toXml(applyBeforeSave()), 'application/xml');
  };

  const exportJson = () => {
    downloadFile(
      `${slug(diagram.name)}.json`,
      new JsonSerializer().serialize(applyBeforeSave()),
      'application/json',
    );
  };

  const findSvg = () => document.querySelector<SVGSVGElement>('svg.bpmnr-canvas');

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
          if (svg) exportSvg(svg, `${slug(diagram.name)}.svg`);
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
      {extra}
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
          <button type="button" onClick={() => setIssues(null)} aria-label="Close validation">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
}
