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
  // Handoff 16 E-5 (§3d) — EVT_* / TIMER_* rules.
  'evtStartThrowRule',
  'evtEndCatchRule',
  'evtErrorStartToplevelRule',
  'evtRefMissingRule',
  'timerMalformedRule',
  // Handoff 17 ES-4 (§4d) — event-subprocess rules + the shared builder.
  'evtSubprocFlowRule',
  'evtSubprocStartRule',
  'typedMessageStartCommands',
  // Handoff 18 §5d — escalation rules (perfis 1.3.0).
  'evtEscalationStartToplevelRule',
  'evtEscalationCatchIllegalRule',
  'escNoCatchRule',
].sort();

describe('@buildtovalue/lint public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });
});
