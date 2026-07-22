import { describe, expect, it } from 'vitest';
import type { ToolContract } from '@buildtovalue/agentflow';
import { toRef } from '@buildtovalue/agentflow';
import { resolveToolContract, toolAdapter } from '../src/index.js';

const browser: ToolContract = {
  kind: 'ToolContract',
  id: 'tool:browser-search',
  version: '1.2.0',
  name: 'browser_search',
  capability: 'buscar na web',
  inputSchema: { query: { type: 'string', required: true } },
  outputSchema: { results: { type: 'array', items: { type: 'string' } } },
  effect: 'read',
  dataScope: 'publico-sem-pii',
  authorization: 'automatica',
  evidenceRequired: 'nenhuma',
  simulation: 'fixture-obrigatoria',
};
const browserOld: ToolContract = { ...browser, version: '1.0.0' };
const payments: ToolContract = {
  ...browser,
  id: 'tool:charge-card',
  version: '2.0.0',
  name: 'charge_card',
  capability: 'cobrar um cartão',
  effect: 'external-commitment',
  authorization: 'gate',
};

describe('toolAdapter (Squad Lane SL-2)', () => {
  const adapter = toolAdapter([browserOld, browser, payments]);

  it('lists one artifact per tool id with the newest version + governance meta', async () => {
    const items = await adapter.list({});
    expect(items).toHaveLength(2); // browser (grouped) + charge-card
    const browserItem = items.find((i) => i.ref.artifactId === 'tool:browser-search')!;
    expect(browserItem.version).toBe('1.2.0'); // newest of 1.0.0 / 1.2.0
    expect(browserItem.typeLabel).toBe('FERRAMENTA');
    expect(browserItem.status).toBe('active');
    expect(browserItem.meta).toMatch(/efeito read/);
    const chargeItem = items.find((i) => i.ref.artifactId === 'tool:charge-card')!;
    expect(chargeItem.meta).toMatch(/external-commitment · gate/);
  });

  it('get() returns a read-only detail with the full version timeline', async () => {
    const detail = await adapter.get('tool:browser-search');
    expect(detail.versions.map((v) => v.version)).toEqual(['1.2.0', '1.0.0']);
    expect(detail.actions).toEqual([]);
    expect(detail.changeSummary).toMatch(/capacidade "buscar na web"/);
  });

  it('get() rejects an unknown tool by name', async () => {
    await expect(adapter.get('tool:ghost')).rejects.toThrow(/unknown tool "tool:ghost"/);
  });
});

describe('resolveToolContract (Squad Lane SL-2)', () => {
  const resolve = resolveToolContract([browserOld, browser, payments]);

  it('resolves an exact id@version ref', () => {
    expect(resolve(toRef('tool:browser-search@1.2.0'))?.version).toBe('1.2.0');
    expect(resolve(toRef('tool:browser-search@1.0.0'))?.version).toBe('1.0.0');
    expect(resolve(toRef('tool:charge-card@2.0.0'))?.name).toBe('charge_card');
  });

  it('returns undefined for an unknown ref or unknown version (never throws)', () => {
    expect(resolve(toRef('tool:browser-search@9.9.9'))).toBeUndefined();
    expect(resolve(toRef('tool:ghost@1.0.0'))).toBeUndefined();
  });
});
