import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

/**
 * Contract test: freezes the runtime public API surface of
 * @bpmn-react/cli's programmatic entry point (`index.ts`; `bin.ts` is
 * exercised directly as a process in bin.test.ts). See
 * core/tests/apiSurface.test.ts for rationale.
 */
const EXPECTED_EXPORTS = [
  'approveCommand',
  'assuranceCaseCommand',
  'auditCommand',
  'certifyCommand',
  'diffCommand',
  'exportCommand',
  'exportXesCommand',
  'formatAudit',
  'formatCertify',
  'formatDiff',
  'formatEntry',
  'formatHistory',
  'formatValidation',
  'loadDiagram',
  'loadRegistry',
  'promoteCommand',
  'registryActiveCommand',
  'registryAddCommand',
  'registryBindRunCommand',
  'registryDiffCommand',
  'registryHistoryCommand',
  'registryPublishCommand',
  'saveRegistry',
  'validateCommand',
].sort();

describe('@bpmn-react/cli public API surface', () => {
  it('exports exactly the expected runtime members', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED_EXPORTS);
  });
});
