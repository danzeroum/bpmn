import {
  activeEdges,
  activeNodes,
  computeLayeredLayout,
  getBoundingBox,
  BpmnXmlConverter,
  JsonSerializer,
  type BpmnDiagram,
} from '@buildtovalue/core';
import { fitViewport, zoomViewportAt } from '../canvas/viewport.js';
import { buildLayoutProposal } from '../canvas/arrange.js';
import { downloadFile, exportPng, exportSvg } from '../ui/exporters.js';
import { clearAutosave } from '../state/autosave.js';
import type { MenuBuildContext, RegisteredMenuItem } from './menuRegistry.js';

/**
 * Global (toolbar-level) commands of the registry (Handoff 15 §2f): the
 * actions that need no element target — undo/redo, viewport, arrange
 * proposal, exports, find. Presence rules mirror the Toolbar's own guards
 * (disabled undo → absent here; unarrangeable diagram → absent), which is the
 * palette's `when()` for built-ins. Labels reuse the cmdk.* dictionary keys,
 * `shortcut` is display notation only — dispatch stays in
 * `useKeyboardShortcuts` (its catalog is the cheatsheet's other half).
 */
export interface GlobalCommandContext extends MenuBuildContext {
  diagram: BpmnDiagram;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * 🔒 channel for declined inserts (Handoff 18 §5b reforço 7). Optional:
   * contexts that only ENUMERATE commands (the cheatsheet) never insert, so
   * they may omit it; the ⌘K runner falls back to a no-op when absent.
   */
  announceVeto?: (reason: string) => void;
}

export interface RegisteredGlobalCommand extends RegisteredMenuItem {
  /** Display shortcut (notation), when the command also has a key binding. */
  shortcut?: string;
}

export function builtinGlobalCommands(ctx: GlobalCommandContext): RegisteredGlobalCommand[] {
  const { diagram, store, config, t, undo, redo, canUndo, canRedo } = ctx;
  const commands: RegisteredGlobalCommand[] = [];

  if (canUndo) {
    commands.push({ id: 'global.undo', label: t('cmdk.undo'), shortcut: 'Ctrl/⌘+Z', run: undo });
  }
  if (canRedo) {
    commands.push({
      id: 'global.redo',
      label: t('cmdk.redo'),
      shortcut: 'Ctrl/⌘+Shift+Z',
      run: redo,
    });
  }

  const zoomBy = (factor: number) => {
    const { viewport } = store.getState();
    const center = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 };
    store.setState({ viewport: zoomViewportAt(viewport, center, factor) });
  };
  commands.push({ id: 'global.zoom-in', label: t('cmdk.zoomIn'), run: () => zoomBy(0.8) });
  commands.push({ id: 'global.zoom-out', label: t('cmdk.zoomOut'), run: () => zoomBy(1.25) });

  const nodes = Object.values(diagram.nodes);
  if (nodes.length > 0) {
    commands.push({
      id: 'global.fit',
      label: t('cmdk.fit'),
      run: () => {
        const svg = document.querySelector<SVGSVGElement>('svg.bpmnr-canvas');
        const aspect = svg && svg.clientHeight > 0 ? svg.clientWidth / svg.clientHeight : 1.5;
        store.setState({ viewport: fitViewport(getBoundingBox(nodes), aspect) });
      },
    });
  }

  commands.push({
    id: 'global.snap-toggle',
    label: store.getState().snapEnabled ? t('cmdk.snapOff') : t('cmdk.snapOn'),
    run: () => store.setState({ snapEnabled: !store.getState().snapEnabled }),
  });

  // Arrange PROPOSES (cerca §1.7 do Handoff 14) — the card applies/refuses.
  if (computeLayeredLayout(diagram) !== null) {
    commands.push({
      id: 'global.arrange',
      label: t('cmdk.arrange'),
      run: () => {
        const proposal = buildLayoutProposal(diagram);
        if (proposal) store.setState({ layoutProposal: proposal });
      },
    });
  }

  commands.push({
    id: 'global.select-all',
    label: t('cmdk.selectAll'),
    shortcut: 'Ctrl/⌘+A',
    run: () =>
      store.setState({
        selectedIds: [
          ...activeNodes(diagram).map((n) => n.id),
          ...activeEdges(diagram).map((e) => e.id),
        ],
      }),
  });
  commands.push({
    id: 'global.find',
    label: t('cmdk.find'),
    shortcut: 'Ctrl/⌘+F',
    run: () => store.setState({ searchOpen: true }),
  });
  commands.push({
    id: 'global.cheatsheet',
    label: t('cmdk.cheatsheet'),
    shortcut: '?',
    run: () => store.setState({ cheatsheetOpen: true }),
  });

  // Exports — an explicit export counts as a save (same as the Toolbar).
  const applyBeforeSave = () => {
    let result = diagram;
    for (const plugin of config.plugins) {
      result = plugin.onBeforeSave?.(result) ?? result;
    }
    return result;
  };
  const markSaved = () => {
    clearAutosave(diagram.id);
    store.setState({ dirtySinceExport: false });
  };
  const slug = diagram.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
  commands.push({
    id: 'global.export-xml',
    label: t('cmdk.exportXml'),
    run: () => {
      const converter = new BpmnXmlConverter({
        registry: config.registry,
        preferredTypes: config.preferredTypes,
      });
      downloadFile(`${slug}.bpmn.xml`, converter.toXml(applyBeforeSave()), 'application/xml');
      markSaved();
    },
  });
  commands.push({
    id: 'global.export-json',
    label: t('cmdk.exportJson'),
    run: () => {
      downloadFile(`${slug}.json`, new JsonSerializer().serialize(applyBeforeSave()), 'application/json');
      markSaved();
    },
  });
  commands.push({
    id: 'global.export-svg',
    label: t('cmdk.exportSvg'),
    run: () => {
      const svg = document.querySelector<SVGSVGElement>('svg.bpmnr-canvas');
      if (svg) void exportSvg(svg, `${slug}.svg`);
    },
  });
  commands.push({
    id: 'global.export-png',
    label: t('cmdk.exportPng'),
    run: () => {
      const svg = document.querySelector<SVGSVGElement>('svg.bpmnr-canvas');
      if (svg) void exportPng(svg, `${slug}.png`);
    },
  });

  return commands;
}
