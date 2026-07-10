import { describe, expect, it } from 'vitest';
import {
  BOUNDARY_SNAP_THRESHOLD,
  BpmnXmlConverter,
  CommandStack,
  attachBoundaryCommand,
  boundaryAnchorOf,
  boundaryNodePosition,
  boundaryPositionOf,
  createDiagram,
  createNode,
  detachBoundaryCommand,
  nearestBoundaryAnchor,
} from '../src/index.js';

/**
 * Handoff 11 N-1 (pendências §6) — parametric boundary anchoring: side + t
 * as EDITOR-ONLY state (derived back from DI geometry on import; the XML
 * profile stays intact) and attach/detach as ONE atomic command each.
 */
const HOST = { x: 100, y: 200, width: 160, height: 80 };

describe('boundary geometry (N-1)', () => {
  it.each([
    ['top', 0.5, { x: 180, y: 200 }],
    ['bottom', 0.25, { x: 140, y: 280 }],
    ['left', 0.5, { x: 100, y: 240 }],
    ['right', 1, { x: 260, y: 280 }],
  ] as const)('boundaryPositionOf %s t=%s', (side, t, expected) => {
    expect(boundaryPositionOf(HOST, side, t)).toEqual(expected);
  });

  it('clamps t to [0,1]', () => {
    expect(boundaryPositionOf(HOST, 'top', -1)).toEqual({ x: 100, y: 200 });
    expect(boundaryPositionOf(HOST, 'top', 2)).toEqual({ x: 260, y: 200 });
  });

  it.each([
    // pointer just below the bottom border, 40% along → bottom, t=0.4
    [{ x: 164, y: 288 }, 'bottom', 0.4, 8],
    // pointer inside near the top border → top
    [{ x: 180, y: 205 }, 'top', 0.5, 5],
    // pointer left of the left border, halfway down → left, t=0.5
    [{ x: 90, y: 240 }, 'left', 0.5, 10],
  ] as const)('nearestBoundaryAnchor picks the closest side (%#)', (point, side, t, distance) => {
    const anchor = nearestBoundaryAnchor(HOST, point);
    expect(anchor.side).toBe(side);
    expect(anchor.t).toBeCloseTo(t, 5);
    expect(anchor.distance).toBeCloseTo(distance, 5);
  });

  it('the snap threshold is the spec value (12px)', () => {
    expect(BOUNDARY_SNAP_THRESHOLD).toBe(12);
  });

  it('boundaryAnchorOf prefers the STORED pair and falls back to geometry', () => {
    const stored = { x: 0, y: 0, width: 36, height: 36, properties: { boundarySide: 'right', boundaryT: 0.75 } };
    expect(boundaryAnchorOf(HOST, stored)).toEqual({ side: 'right', t: 0.75 });
    // No stored pair: derived from the node's center vs the host border.
    const derived = boundaryAnchorOf(HOST, {
      x: 180 - 18,
      y: 280 - 18,
      width: 36,
      height: 36,
      properties: {},
    });
    expect(derived.side).toBe('bottom');
    expect(derived.t).toBeCloseTo(0.5, 5);
  });

  it('boundaryNodePosition centers the event on the border anchor', () => {
    expect(boundaryNodePosition(HOST, 'bottom', 0.5, { width: 36, height: 36 })).toEqual({
      x: 180 - 18,
      y: 280 - 18,
    });
  });
});

function diagramWithHostAndEvent() {
  const diagram = createDiagram({ name: 'B' });
  const v = diagram.version.id;
  diagram.nodes.host = createNode({ id: 'host', type: 'task', label: 'Processar', ...HOST, properties: {}, versionId: v });
  diagram.nodes.ev = createNode({ id: 'ev', type: 'intermediateCatchEvent', label: 'Timer', x: 400, y: 400, width: 36, height: 36, properties: {}, versionId: v });
  return diagram;
}

describe('attach/detach commands (N-1) — ONE atomic undoable step each', () => {
  it('attach: type → boundaryEvent + attachedToRef + side/t + move, 1 undo', () => {
    const stack = new CommandStack(diagramWithHostAndEvent());
    const pos = boundaryNodePosition(HOST, 'bottom', 0.5, { width: 36, height: 36 });
    stack.execute(attachBoundaryCommand('ev', 'host', 'bottom', 0.5, pos));

    const attached = stack.current.nodes.ev;
    expect(attached.type).toBe('boundaryEvent');
    expect(attached.properties).toMatchObject({ attachedToRef: 'host', boundarySide: 'bottom', boundaryT: 0.5 });
    expect({ x: attached.x, y: attached.y }).toEqual(pos);

    stack.undo(); // the WHOLE gesture reverts in one step
    const reverted = stack.current.nodes.ev;
    expect(reverted.type).toBe('intermediateCatchEvent');
    expect(reverted.properties.attachedToRef).toBeUndefined();
    expect({ x: reverted.x, y: reverted.y }).toEqual({ x: 400, y: 400 });
    stack.redo();
    expect(stack.current.nodes.ev.type).toBe('boundaryEvent');
  });

  it('re-attach (slide / new host) is the same command; undo restores the prior anchor', () => {
    const stack = new CommandStack(diagramWithHostAndEvent());
    stack.execute(attachBoundaryCommand('ev', 'host', 'bottom', 0.5, boundaryNodePosition(HOST, 'bottom', 0.5, { width: 36, height: 36 })));
    stack.execute(attachBoundaryCommand('ev', 'host', 'right', 0.25, boundaryNodePosition(HOST, 'right', 0.25, { width: 36, height: 36 })));
    expect(stack.current.nodes.ev.properties).toMatchObject({ boundarySide: 'right', boundaryT: 0.25 });
    stack.undo();
    expect(stack.current.nodes.ev.properties).toMatchObject({ boundarySide: 'bottom', boundaryT: 0.5 });
  });

  it('detach: clears the anchor, becomes intermediateCatchEvent at the drop point, 1 undo', () => {
    const stack = new CommandStack(diagramWithHostAndEvent());
    stack.execute(attachBoundaryCommand('ev', 'host', 'top', 0.2, boundaryNodePosition(HOST, 'top', 0.2, { width: 36, height: 36 })));
    stack.execute(detachBoundaryCommand('ev', { x: 500, y: 100 }));

    const detached = stack.current.nodes.ev;
    expect(detached.type).toBe('intermediateCatchEvent');
    expect(detached.properties.attachedToRef).toBeUndefined();
    expect(detached.properties.boundarySide).toBeUndefined();
    expect({ x: detached.x, y: detached.y }).toEqual({ x: 500, y: 100 });

    stack.undo();
    const restored = stack.current.nodes.ev;
    expect(restored.type).toBe('boundaryEvent');
    expect(restored.properties).toMatchObject({ attachedToRef: 'host', boundarySide: 'top', boundaryT: 0.2 });
  });
});

describe('XML round-trip (N-1) — profile intact, side/t derived on import', () => {
  it('side/t never serialize; import derives them back from the DI geometry', () => {
    const converter = new BpmnXmlConverter();
    const diagram = diagramWithHostAndEvent();
    const stack = new CommandStack(diagram);
    stack.execute(attachBoundaryCommand('ev', 'host', 'bottom', 0.25, boundaryNodePosition(HOST, 'bottom', 0.25, { width: 36, height: 36 })));

    const xml = converter.toXml(stack.current);
    // Editor-only state stays out of the XML (the profile is intact).
    expect(xml).not.toContain('boundarySide');
    expect(xml).not.toContain('boundaryT');
    expect(xml).toContain('attachedToRef="host"');

    const { diagram: imported } = converter.fromXml(xml);
    const ev = imported.nodes.ev;
    expect(ev.type).toBe('boundaryEvent');
    // Derived back from the absolute coordinates.
    expect(ev.properties.boundarySide).toBe('bottom');
    expect(ev.properties.boundaryT as number).toBeCloseTo(0.25, 3);
  });
});
