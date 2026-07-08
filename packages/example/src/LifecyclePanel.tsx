import { useState } from 'react';
import {
  computeDiff,
  type AuditLedger,
  type BpmnDiagram,
  type UserContext,
  type VersionStatus,
} from '@bpmn-react/core';
import { DiffView, PromotionPanel, useDiagram, useEditorConfig } from '@bpmn-react/react';

const ACTORS: UserContext[] = [
  { id: 'u-owner', role: 'owner', name: 'Olivia (owner)' },
  { id: 'u-compliance', role: 'compliance', name: 'Carlos (compliance)' },
  { id: 'u-ops', role: 'operations', name: 'Oscar (operations)' },
];

/**
 * Demo governance panel: approve as different roles, promote through the
 * lifecycle (activation goes through the formal PromotionPanel), clone
 * active diagrams into new drafts, inspect the diff since the baseline.
 */
export function LifecyclePanel({ ledger }: { ledger?: AuditLedger } = {}) {
  const { diagram, replaceDiagram } = useDiagram();
  // The plugin-configured engine — the same one the StatusBadge and the
  // PromotionPanel reflect (never a parallel instance).
  const { lifecycleEngine: engine } = useEditorConfig();
  const [actor, setActor] = useState(ACTORS[0]);
  const [message, setMessage] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<BpmnDiagram>(diagram);
  const [showDiff, setShowDiff] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [lastActive, setLastActive] = useState<{ semanticVersion: string } | null>(null);

  const version = diagram.version;
  const targets = engine.allowedTargets(version.status);

  const run = async (action: () => Promise<BpmnDiagram> | BpmnDiagram) => {
    try {
      const next = await action();
      replaceDiagram(next);
      setMessage(null);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const approve = () => run(() => engine.approve(diagram, actor, `Approved by ${actor.role}`));

  // Non-active hops only — activation goes through the formal PromotionPanel.
  const promote = (target: VersionStatus) =>
    run(() =>
      engine.promote({
        diagram,
        target,
        actor,
        reason: `Promoted to ${target} after review by ${actor.role} in the demo app.`,
        diff: computeDiff(baseline, diagram),
      }),
    );

  const cloneDraft = () =>
    run(async () => {
      const draft = await engine.createDraftFrom(diagram, actor);
      setBaseline(draft);
      return draft;
    });

  return (
    <aside className="demo-lifecycle" aria-label="Lifecycle governance">
      <h3>Governance</h3>

      <label>
        Acting as
        <select
          value={actor.id}
          onChange={(e) => setActor(ACTORS.find((a) => a.id === e.target.value) ?? ACTORS[0])}
        >
          {ACTORS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <div className="demo-approvals">
        <strong>Approvals ({version.approvedBy.length})</strong>
        <ul>
          {version.approvedBy.map((a) => (
            <li key={a.userId}>
              {a.role} · {a.userId}
            </li>
          ))}
          {version.approvedBy.length === 0 && <li className="demo-muted">none yet</li>}
        </ul>
        <button type="button" onClick={approve}>
          Approve as {actor.role}
        </button>
      </div>

      <div className="demo-promote">
        <strong>Promote</strong>
        {targets.length === 0 && <p className="demo-muted">Terminal status.</p>}
        {targets
          .filter((target) => target !== 'active')
          .map((target) => (
            <button key={target} type="button" onClick={() => promote(target)}>
              → {target}
            </button>
          ))}
        {targets.includes('active') && (
          <button type="button" className="demo-promote-formal" onClick={() => setPromoOpen(true)}>
            Promover…
          </button>
        )}
        {(version.status === 'active' ||
          version.status === 'deprecated' ||
          version.status === 'retired') && (
          <button type="button" onClick={cloneDraft}>
            ✎ New draft from this version
          </button>
        )}
      </div>

      <div className="demo-diff">
        <button type="button" onClick={() => setShowDiff((v) => !v)} aria-expanded={showDiff}>
          {showDiff ? 'Hide' : 'Show'} changes since baseline
        </button>
        {showDiff && <DiffView diff={computeDiff(baseline, diagram)} diagram={diagram} />}
        <button type="button" onClick={() => setBaseline(diagram)}>
          Set current as baseline
        </button>
      </div>

      {message && (
        <p className="demo-error" role="alert">
          {message}
        </p>
      )}

      <dl className="demo-version-meta">
        <dt>Version id</dt>
        <dd>{version.id.slice(0, 8)}…</dd>
        {version.parentVersionId && (
          <>
            <dt>Parent</dt>
            <dd>{version.parentVersionId.slice(0, 8)}…</dd>
          </>
        )}
        {version.snapshotHash && (
          <>
            <dt>Snapshot</dt>
            <dd>{version.snapshotHash.slice(0, 12)}…</dd>
          </>
        )}
      </dl>

      <PromotionPanel
        open={promoOpen}
        onClose={() => setPromoOpen(false)}
        actor={actor}
        approvers={[
          { actor: ACTORS[0], label: 'Owner' },
          { actor: ACTORS[1], label: 'Compliance' },
        ]}
        baseline={baseline}
        previousActive={lastActive ?? undefined}
        ledger={ledger}
        onActivated={({ diagram: promoted }) => {
          setBaseline(promoted);
          setLastActive({ semanticVersion: promoted.version.semanticVersion });
        }}
      />
    </aside>
  );
}
