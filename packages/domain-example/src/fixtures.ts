import {
  createDefaultRegistry,
  createDiagram,
  createEdge,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';

/**
 * Public compensation fixtures (#152) — the `?compensation=1` demo seeds,
 * promoted from the example app to a consumable entry
 * (`@buildtovalue/domain-example/fixtures`) so hosts reproducing the demo
 * reuse ONE source of truth instead of porting a silently-diverging copy.
 * Pure builders over the core factories — no runtime behavior, no React.
 */

/**
 * `?comp=1` — Handoff 19 §6b: the compensation editor demo. A completed activity
 * with a compensation boundary (⟲) linked by ASSOCIATION to its handler
 * (isForCompensation, ◀◀ marker), plus a compensate THROW targeting the activity
 * (the «⟲ compensa: …» chip). Exercises the visual + picker; the full
 * «pacote de viagem» simulation demo is `buildCompensationPackageDiagram`.
 */
export function buildCompensationEditorDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-compensation', name: 'Compensação', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 120),
    hotel: make('serviceTask', 'hotel', 'Reservar hotel', 180, 98),
    bnd: make('boundaryEvent', 'bnd', 'Compensar hotel', 222, 140, {
      attachedToRef: 'hotel',
      eventDefinition: 'compensate',
      boundarySide: 'bottom',
      boundaryT: 0.5,
    }),
    cancel: make('serviceTask', 'cancel', 'Cancelar reserva', 180, 240, { isForCompensation: true }),
    thr: make('intermediateThrowEvent', 'thr', 'Reverter', 380, 102, {
      eventDefinition: 'compensate',
      compensateActivityRef: 'hotel',
    }),
    end: make('endEvent', 'end', 'Fim', 500, 120),
  };
  diagram.edges = {
    f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'hotel', versionId: v }),
    f2: createEdge({ id: 'f2', sourceId: 'hotel', targetId: 'thr', versionId: v }),
    f3: createEdge({ id: 'f3', sourceId: 'thr', targetId: 'end', versionId: v }),
    a1: createEdge({ id: 'a1', type: 'association', sourceId: 'bnd', targetId: 'cancel', versionId: v }),
  };
  return diagram;
}

/**
 * `?simulate=1&comp=1` — Handoff 19 §6d: the compensation SIMULATION. A travel
 * booking flow (hotel → flight → card) where hotel and flight are compensable
 * (⟲ boundary + handler by association) and the card is NOT. Advance so the
 * first activities complete, then the «Compensar» card reverses them in reverse
 * order (the card completed without a handler is a declared, non-compensated
 * line).
 */
export function buildCompensationSimDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-compensation-sim', name: 'Compensação governada', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 40, 120),
    hotel: make('serviceTask', 'hotel', 'Reservar hotel', 140, 98),
    flight: make('serviceTask', 'flight', 'Comprar passagem', 300, 98),
    card: make('serviceTask', 'card', 'Pagar cartão', 460, 98),
    end: make('endEvent', 'end', 'Fim', 620, 120),
    bHotel: make('boundaryEvent', 'bHotel', 'Compensar hotel', 182, 140, { attachedToRef: 'hotel', eventDefinition: 'compensate', boundarySide: 'bottom', boundaryT: 0.5 }),
    hHotel: make('serviceTask', 'hHotel', 'Cancelar reserva', 140, 250, { isForCompensation: true }),
    bFlight: make('boundaryEvent', 'bFlight', 'Compensar passagem', 342, 140, { attachedToRef: 'flight', eventDefinition: 'compensate', boundarySide: 'bottom', boundaryT: 0.5 }),
    hFlight: make('serviceTask', 'hFlight', 'Estornar passagem', 300, 250, { isForCompensation: true }),
  };
  diagram.edges = {
    f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'hotel', versionId: v }),
    f2: createEdge({ id: 'f2', sourceId: 'hotel', targetId: 'flight', versionId: v }),
    f3: createEdge({ id: 'f3', sourceId: 'flight', targetId: 'card', versionId: v }),
    f4: createEdge({ id: 'f4', sourceId: 'card', targetId: 'end', versionId: v }),
    aHotel: createEdge({ id: 'aHotel', type: 'association', sourceId: 'bHotel', targetId: 'hHotel', versionId: v }),
    aFlight: createEdge({ id: 'aFlight', type: 'association', sourceId: 'bFlight', targetId: 'hFlight', versionId: v }),
  };
  return diagram;
}

/**
 * `?compensation=1` — Handoff 19 §6e: the «pacote de viagem» compensation demo.
 * hotel ⟲ + passagem ⟲ (handlers by association) + cartão WITHOUT a handler (the
 * visible RISK) + an ERROR event subprocess with a compensate THROW (the
 * reference "error → revert" pattern). The throw targets the card (which has no
 * ⟲ boundary), so `COMP_REF_NOT_COMPENSABLE` fires — a DELIBERATE, pedagogical
 * warning that names the risk; the rest is lint-clean. Simulate → advance so the
 * activities complete → «Compensar» reverses hotel + passagem, the card is a
 * declared uncompensated line.
 */
export function buildCompensationPackageDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-compensation-pkg', name: 'Pacote de viagem', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 40, 120),
    hotel: make('serviceTask', 'hotel', 'Reservar hotel', 140, 98),
    flight: make('serviceTask', 'flight', 'Comprar passagem', 300, 98),
    card: make('serviceTask', 'card', 'Pagar cartão', 460, 98),
    end: make('endEvent', 'end', 'Fim', 620, 120),
    bHotel: make('boundaryEvent', 'bHotel', 'Compensar hotel', 182, 140, { attachedToRef: 'hotel', eventDefinition: 'compensate', boundarySide: 'bottom', boundaryT: 0.5 }),
    hHotel: make('serviceTask', 'hHotel', 'Cancelar reserva', 140, 250, { isForCompensation: true }),
    bFlight: make('boundaryEvent', 'bFlight', 'Compensar passagem', 342, 140, { attachedToRef: 'flight', eventDefinition: 'compensate', boundarySide: 'bottom', boundaryT: 0.5 }),
    hFlight: make('serviceTask', 'hFlight', 'Estornar passagem', 300, 250, { isForCompensation: true }),
    // Error event subprocess (error → revert): an error start + a compensate
    // throw. The throw TARGETS the card (no ⟲) — the pedagogical COMP_REF warning.
    esub: make('subProcess', 'esub', 'Falha irrecuperável', 40, 360, { triggeredByEvent: true, isExpanded: true }),
    est: make('startEvent', 'est', 'Erro', 70, 420, { parentId: 'esub', eventDefinition: 'error' }),
    ethrow: make('intermediateThrowEvent', 'ethrow', 'Reverter', 180, 420, { parentId: 'esub', eventDefinition: 'compensate', compensateActivityRef: 'card' }),
    eend: make('endEvent', 'eend', 'Cancelada', 300, 420, { parentId: 'esub' }),
  };
  diagram.edges = {
    f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'hotel', versionId: v }),
    f2: createEdge({ id: 'f2', sourceId: 'hotel', targetId: 'flight', versionId: v }),
    f3: createEdge({ id: 'f3', sourceId: 'flight', targetId: 'card', versionId: v }),
    f4: createEdge({ id: 'f4', sourceId: 'card', targetId: 'end', versionId: v }),
    aHotel: createEdge({ id: 'aHotel', type: 'association', sourceId: 'bHotel', targetId: 'hHotel', versionId: v }),
    aFlight: createEdge({ id: 'aFlight', type: 'association', sourceId: 'bFlight', targetId: 'hFlight', versionId: v }),
    ef1: createEdge({ id: 'ef1', sourceId: 'est', targetId: 'ethrow', versionId: v }),
    ef2: createEdge({ id: 'ef2', sourceId: 'ethrow', targetId: 'eend', versionId: v }),
  };
  return diagram;
}

/**
 * `?compno=1` — Handoff 19 §6c: a compensation boundary (⟲) with NO handler, so
 * `COMP_BOUNDARY_NO_HANDLER` shows in the lint dock with its quick-fix. Applying
 * it creates the handler + association (the shared builder = the palette FORM);
 * the finding clears. Drives the lint-dock e2e of the quick-fix.
 */
export function buildCompensationNoHandlerDiagram(): BpmnDiagram {
  const registry = createDefaultRegistry();
  const diagram = createDiagram({ id: 'demo-compno', name: 'Compensação sem handler', createdBy: 'demo' });
  const v = diagram.version.id;
  const make = (type: string, id: string, label: string, x: number, y: number, properties: Record<string, unknown> = {}) =>
    createNode({ type, id, label, x, y, properties, versionId: v }, registry);
  diagram.nodes = {
    start: make('startEvent', 'start', 'Início', 60, 120),
    hotel: make('serviceTask', 'hotel', 'Reservar hotel', 200, 98),
    bnd: make('boundaryEvent', 'bnd', 'Compensar hotel', 242, 140, {
      attachedToRef: 'hotel',
      eventDefinition: 'compensate',
      boundarySide: 'bottom',
      boundaryT: 0.5,
    }),
    end: make('endEvent', 'end', 'Fim', 420, 120),
  };
  diagram.edges = {
    f1: createEdge({ id: 'f1', sourceId: 'start', targetId: 'hotel', versionId: v }),
    f2: createEdge({ id: 'f2', sourceId: 'hotel', targetId: 'end', versionId: v }),
  };
  return diagram;
}
