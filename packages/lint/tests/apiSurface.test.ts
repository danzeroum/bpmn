import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/** Contract test — see core/tests/apiSurface.test.ts for the rationale. */
const EXPECTED_EXPORTS = [
  'ALL_LINT_RULES',
  'ETIQUETTE_RULES',
  'EXECUTABILITY_RULES',
  'conditionalFlowsRule',
  'duplicateFlowRule',
  'eventEndpointsRule',
  'implicitJoinRule',
  'implicitSplitRule',
  'labelRequiredRule',
  'lintDiagram',
  'serviceTaskImplementationRule',
  'superfluousGatewayRule',
  // Handoff 14 §1d — quick-fix contract + versioned profiles.
  'ETIQUETTE_PROFILE',
  'EXECUTABILITY_PROFILE',
  'LINT_PROFILES',
  'lintFindings',
  'fixCommandFor',
].sort();

describe('@buildtovalue/lint public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });
});
