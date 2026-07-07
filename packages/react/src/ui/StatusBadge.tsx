import type { VersionStatus } from '@bpmn-react/core';
import { useDiagram } from '../contexts/DiagramContext.js';

const STATUS_STYLES: Record<VersionStatus, { background: string; color: string; label: string }> = {
  draft: { background: 'var(--bpmnr-status-draft, #ece9e2)', color: '#5b544a', label: 'Draft' },
  test: { background: 'var(--bpmnr-status-test, #e3ecf7)', color: '#33567e', label: 'Test' },
  candidate: {
    background: 'var(--bpmnr-status-candidate, #f7f0dc)',
    color: '#7a611e',
    label: 'Candidate',
  },
  active: { background: 'var(--bpmnr-status-active, #dff0e6)', color: '#1a6a54', label: 'Active' },
  deprecated: {
    background: 'var(--bpmnr-status-deprecated, #f7e6e0)',
    color: '#9a4a2e',
    label: 'Deprecated',
  },
  retired: { background: 'var(--bpmnr-status-retired, #e8e6e4)', color: '#75706b', label: 'Retired' },
};

/** Lifecycle seal: status + semantic version of the current diagram. */
export function StatusBadge() {
  const { diagram } = useDiagram();
  const { status, semanticVersion } = diagram.version;
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className="bpmnr-status-badge"
      data-status={status}
      role="status"
      aria-label={`Version ${semanticVersion}, status ${style.label}`}
      style={{ background: style.background, color: style.color }}
    >
      <strong>{style.label}</strong> v{semanticVersion}
    </span>
  );
}
