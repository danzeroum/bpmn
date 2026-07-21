import { describe, expect, it } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { ContextContract, SquadManifest } from '@buildtovalue/agentflow';
import { SquadStudio, PT_BR } from '../src/index.js';
import { describeViolation, runAxe } from './axeHelper.js';

/**
 * Squad Lane SL-9 — Squad Studio, the a11y-heavy piece (§10.9). It renders a
 * SquadManifest as a STANDARD BPMN diagram (no new canvas) with an
 * Estrutura↔Colaboração toggle that swaps only the renderer (one store key),
 * six edges distinguishable WITHOUT color (marker + glyph + label, a
 * keyboard-navigable legend), and a focus-announces-the-edge live region. The
 * gate: no serious/critical axe regression.
 */
const manifest = (over: Partial<SquadManifest> = {}): SquadManifest => ({
  kind: 'SquadManifest',
  id: 'sqd-doc-review',
  version: '1.0.0',
  dynamic: 'hierarquico',
  orchestratorRef: 'agnt-orch@1.0.0',
  members: [
    { agentRef: 'agnt-rsch@2.1.0', personaRef: 'prs:analista@1.0.0', role: 'pesquisador' },
    { agentRef: 'agnt-qa@0.9.0', personaRef: 'prs:revisor@1.0.0', role: 'revisor' },
  ],
  edges: [
    { from: 'orch', to: 'pesquisador', kind: 'delegar' },
    { from: 'pesquisador', to: 'revisor', kind: 'solicitar-revisao' },
  ],
  contextContractRef: 'ctx-contract:doc-review@1.0.0',
  gates: [{ gateId: 'gate-final', scope: 'por-execucao' }],
  ...over,
});

const contract = (over: Partial<ContextContract> = {}): ContextContract => ({
  kind: 'ContextContract',
  id: 'ctx-contract:doc-review',
  version: '1.0.0',
  keys: [
    { key: 'doc.fontes', owner: 'pesquisador', readers: ['*'], writers: ['pesquisador'], purpose: 'grounding', merge: 'acrescentar' },
    { key: 'veredito', owner: 'revisor', readers: ['orch'], writers: ['revisor'], purpose: 'operational-action', merge: 'exigir-decisao' },
  ],
  ...over,
});

const renderStudio = (over?: Partial<SquadManifest>, staleMembers?: string[]) =>
  render(
    <SquadStudio
      manifest={manifest(over)}
      contextContract={contract()}
      messages={PT_BR}
      staleMembers={staleMembers}
    />,
  );

async function expectNoSerious(container: Element, label: string) {
  const summary = await runAxe(container);
  if (summary.seriousOrWorse.length > 0) {
    console.error(`${label} SERIOUS+:\n${summary.seriousOrWorse.map(describeViolation).join('\n')}`);
  }
  expect(summary.seriousOrWorse, label).toEqual([]);
}

describe('SquadStudio — a standard BPMN diagram over the existing editor (SL-9)', () => {
  it('renders the projected squad as a BPMN canvas (pool + agentTask lanes)', () => {
    const { container } = renderStudio();
    // it is the real editor canvas (application role), not a new fork
    expect(container.querySelector('svg.bpmnr-canvas')?.getAttribute('role')).toBe('application');
    expect(container.querySelector('[data-node-id="pesquisador"]')).not.toBeNull();
    expect(container.querySelector('[data-node-id="revisor"]')).not.toBeNull();
  });

  it('is a READ-ONLY projection — mutation gestures do not select or mutate (no silent loss)', () => {
    const { container } = renderStudio();
    // a drag-start gesture on a node is a no-op: the projection has no write-back,
    // so accepting it would lose the edit on the next projection (doctrine).
    const node = container.querySelector('[data-node-id="pesquisador"]')!;
    fireEvent.pointerDown(node, { button: 0 });
    fireEvent.pointerUp(node, { button: 0 });
    expect(container.querySelector('[data-node-id="pesquisador"]')?.getAttribute('data-selected')).toBeNull();
    // edges carry no roving tabindex either (they are navigated, not edited)
    expect(container.querySelector('[data-edge-id="e0"]')?.getAttribute('tabindex')).toBeNull();
  });

  it('the perspective toggle swaps only the renderer and preserves keyboard-focus state', () => {
    const { container, getByLabelText } = renderStudio();
    // roving keyboard nav reaches a squad edge even read-only (drives the announce)
    const edge = container.querySelector('[data-edge-id="e0"]')!;
    fireEvent.focus(edge);
    expect(container.querySelector('[data-edge-id="e0"]')?.getAttribute('data-focused')).toBe('true');
    // toggle to Colaboração
    const group = getByLabelText('Perspectiva do squad');
    fireEvent.click(within(group).getByRole('button', { name: 'Colaboração' }));
    expect(within(group).getByRole('button', { name: 'Colaboração' }).getAttribute('aria-pressed')).toBe('true');
    // navigation focus survives the toggle (it only touched viewMode)
    expect(container.querySelector('[data-edge-id="e0"]')?.getAttribute('data-focused')).toBe('true');
    expect(container.querySelector('[data-squad-announce]')?.textContent).toMatch(/delegar/);
  });

  it('exposes a keyboard-navigable legend naming all six edge kinds (no color reliance)', () => {
    const { getByRole } = renderStudio();
    const legend = getByRole('group', { name: 'Legenda das arestas' });
    const buttons = within(legend).getAllByRole('button');
    expect(buttons).toHaveLength(6);
    // each is a real focusable control with a localized accessible name
    const names = buttons.map((b) => b.textContent);
    expect(names.some((n) => n?.includes('delegar'))).toBe(true);
    expect(names.some((n) => n?.includes('escalar'))).toBe(true);
  });

  it('announces the focused edge (kind + from → to) in a live region', () => {
    const { container } = renderStudio();
    const announce = container.querySelector('[data-squad-announce]')!;
    expect(announce.getAttribute('aria-live')).toBe('polite');
    expect(announce.textContent).toBe(''); // nothing focused yet
    // focus a squad edge — the projection draws one per relation
    const edge = container.querySelector('[data-edge-id="e0"] [tabindex], [data-edge-id="e0"]')!;
    fireEvent.focus(edge);
    expect(announce.textContent).toMatch(/delegar/);
    expect(announce.textContent).toMatch(/orch/);
    expect(announce.textContent).toMatch(/pesquisador/);
  });

  it('renders the manifest + context-contract summary panel', () => {
    const { getByLabelText } = renderStudio();
    const panel = getByLabelText('Painel do squad');
    expect(within(panel).getByText('Dinâmica')).toBeTruthy();
    expect(within(panel).getByText('hierarquico')).toBeTruthy();
    expect(within(panel).getByText('Membros')).toBeTruthy();
  });

  it('warns on coordinated promotion when a host reports a stale member (degradable)', () => {
    // no stale info → no warning
    const clean = renderStudio();
    expect(clean.container.querySelector('[data-squad-stale]')).toBeNull();
    // host injects staleness → the warning names the affected role
    const { container } = renderStudio(undefined, ['agnt-qa@0.9.0']);
    const warn = container.querySelector('[data-squad-stale]')!;
    expect(warn).toBeTruthy();
    expect(warn.textContent).toContain('revisor');
  });

  it('has no serious/critical axe violations (a11y gate, §10.9)', async () => {
    const { container } = renderStudio();
    await expectNoSerious(container, 'SquadStudio');
  });
});
