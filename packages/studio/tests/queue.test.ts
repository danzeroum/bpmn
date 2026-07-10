import { describe, expect, it } from 'vitest';
import { LifecycleEngine, type UserContext } from '@buildtovalue/core';
import { approvalsProgress, pendingPromotions } from '../src/index.js';
import { candidateDiagram } from './fixtures.js';

const user: UserContext = { id: 'bruna', role: 'process-owner', name: 'Bruna' };
const NOW = () => '2026-07-08T00:00:00.000Z';

describe('pendingPromotions — fila derivada do engine (§5, §10.3)', () => {
  it('lists candidates the user has not approved, with engine gates attached', async () => {
    const engine = new LifecycleEngine();
    const requests = await pendingPromotions({
      candidates: [candidateDiagram()],
      engine,
      user,
      now: NOW,
    });
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.approvals).toBeDefined();
    expect(request.approvals!.required).toBe(2); // engine config, never a UI constant
    expect(request.approvals!.current).toBe(0);
    expect(approvalsProgress(request)).toBe('0/2 aprovações');
  });

  it('excludes versions the user already approved and non-candidates', async () => {
    const engine = new LifecycleEngine();
    const mine = candidateDiagram({
      id: 'a',
      versionId: 'va',
      approvedBy: [{ userId: 'bruna', role: 'process-owner', approvedAt: NOW(), reason: 'ok' }],
    });
    const draft = candidateDiagram({ id: 'b', versionId: 'vb', status: 'draft' });
    const pending = candidateDiagram({ id: 'c', versionId: 'vc' });
    const requests = await pendingPromotions({ candidates: [mine, draft, pending], engine, user, now: NOW });
    expect(requests.map((r) => r.diagram.id)).toEqual(['c']);
  });

  it('reflects partial approvals from another role (1/2)', async () => {
    const engine = new LifecycleEngine();
    const diagram = candidateDiagram({
      approvedBy: [{ userId: 'carla', role: 'compliance', approvedAt: NOW(), reason: 'ok' }],
    });
    const [request] = await pendingPromotions({ candidates: [diagram], engine, user, now: NOW });
    expect(request.approvals!.current).toBe(1);
    expect(request.approvedRoles).toEqual(['compliance']);
    expect(approvalsProgress(request)).toBe('1/2 aprovações');
  });

  it('computes slaDays from effectiveFrom (amber under 3 days is a UI concern)', async () => {
    const engine = new LifecycleEngine();
    const soon = candidateDiagram({ effectiveFrom: '2026-07-10T00:00:00.000Z' });
    const [request] = await pendingPromotions({ candidates: [soon], engine, user, now: NOW });
    expect(request.slaDays).toBe(2);
    const none = candidateDiagram({ id: 'x', versionId: 'vx' });
    const [noSla] = await pendingPromotions({ candidates: [none], engine, user, now: NOW });
    expect(noSla.slaDays).toBeUndefined();
  });
});
