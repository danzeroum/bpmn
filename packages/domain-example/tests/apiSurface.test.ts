import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @bpmn-react/domain-example. See core/tests/apiSurface.test.ts for
 * rationale.
 */
const EXPECTED_EXPORTS = [
  'BTV_PALETTE_ICONS',
  'ConnectorShape',
  'DOMAIN_EDGE_STYLES',
  'DOMAIN_EDGE_TYPES',
  'DOMAIN_NODE_TYPES',
  'DeliverableShape',
  'GateShape',
  'PersonaShape',
  'PromptShape',
  'SquadShape',
  'default',
  'domainExamplePlugin',
  'gateSinglePredecessorRule',
  'handoffNeedsPurposeRule',
  'squadNeedsPersonaRule',
].sort();

describe('@bpmn-react/domain-example public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });

  it('the default export is the same object as the named plugin export', () => {
    expect(api.default).toBe(api.domainExamplePlugin);
  });

  it('all 6 domain node types have a matching shape and palette entry', () => {
    const types = api.DOMAIN_NODE_TYPES.map((t) => t.type).sort();
    expect(types).toEqual(
      ['btv:connector', 'btv:deliverable', 'btv:gate', 'btv:persona', 'btv:prompt', 'btv:squad'].sort(),
    );
    expect(Object.keys(api.domainExamplePlugin.shapes ?? {}).sort()).toEqual(types);
    expect((api.domainExamplePlugin.paletteItems ?? []).map((p) => p.nodeType).sort()).toEqual(types);
  });
});
