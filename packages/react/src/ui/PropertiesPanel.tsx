import { useEffect, useState } from 'react';
import {
  updateEdgeCommand,
  updateNodeCommand,
  type BpmnEdge,
  type BpmnNode,
} from '@buildtovalue/core';
import { useDiagram } from '../contexts/DiagramContext.js';
import { useCanvasState } from '../contexts/CanvasContext.js';
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { backToAutoPatch, isManualEdge } from '../canvas/routeEdge.js';
import { useT } from '../i18n/I18nContext.js';
import type { EngineBridge } from '../plugins/types.js';

/**
 * Inspector for the selected element: label, purpose (edges) and free-form
 * properties. Property values are JSON — strings can be typed directly.
 *
 * Handoff 14 §1f: with an engine plugin registered (`plugin.engine`), an
 * executable activity ALSO gets an "Execução" tab — progressive disclosure
 * (job type + retries visible, the rest foldable) and the GATED deploy
 * (VIGENTE + assinada, or the "⚑ Deploy bloqueado" card). Without an engine
 * plugin the panel is byte-identical to before.
 */
export function PropertiesPanel() {
  const { diagram } = useDiagram();
  const { inspectorSections, engine } = useEditorConfig();
  const selectedIds = useCanvasState((s) => s.selectedIds);
  const readOnly = useCanvasState((s) => s.readOnly);
  const t = useT();
  const [tab, setTab] = useState<'general' | 'execution'>('general');
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  // Selecting another element always lands on the general tab.
  useEffect(() => setTab('general'), [selectedId]);

  if (selectedIds.length !== 1) {
    return (
      <aside className="bpmnr-inspector" aria-label={t('properties.title')}>
        <p className="bpmnr-inspector-empty">
          {selectedIds.length === 0
            ? t('properties.nothingSelected')
            : t('properties.elementsSelected', { count: selectedIds.length })}
        </p>
      </aside>
    );
  }

  const id = selectedIds[0];
  const node = diagram.nodes[id];
  const edge = diagram.edges[id];
  const executable = node !== undefined && isExecutableActivity(node);
  const showTabs = engine !== null && executable;
  const activeTab = showTabs ? tab : 'general';
  return (
    <aside className="bpmnr-inspector" aria-label={t('properties.title')}>
      {showTabs && (
        <div className="bpmnr-inspector-tabs" role="tablist" aria-label={t('properties.tabsAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            data-inspector-tab="general"
            onClick={() => setTab('general')}
          >
            {t('properties.tab.general')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'execution'}
            data-inspector-tab="execution"
            onClick={() => setTab('execution')}
          >
            {t('properties.tab.execution')}
          </button>
        </div>
      )}
      {activeTab === 'execution' && showTabs && engine && node ? (
        <ExecutionInspector node={node} engine={engine} readOnly={readOnly} />
      ) : (
        <>
          {node && <NodeInspector node={node} readOnly={readOnly} />}
          {/* Plugin sections (Handoff 5, wireframe 2d) — e.g. DMN "Decisão". */}
          {node &&
            inspectorSections
              .filter((section) => section.appliesTo(node))
              .map((section) => <section.component key={section.id} node={node} />)}
          {edge && <EdgeInspector edge={edge} readOnly={readOnly} />}
          {!node && !edge && (
            <p className="bpmnr-inspector-empty">{t('properties.elementNotFound')}</p>
          )}
        </>
      )}
    </aside>
  );
}

/** Activities an engine can execute — tasks, call activities, sub-processes. */
function isExecutableActivity(node: BpmnNode): boolean {
  return (
    node.type.toLowerCase().includes('task') ||
    node.type === 'callActivity' ||
    node.type === 'subProcess'
  );
}

/**
 * The "Execução" tab (Handoff 14 §1f): ESSENTIAL fields visible (job type,
 * retries), everything else foldable, and the GATED deploy — only an ACTIVE
 * (VIGENTE) **and signed** version deploys; otherwise the blocked card with
 * "Ir para promoção →".
 */
function ExecutionInspector({
  node,
  engine,
  readOnly,
}: {
  node: BpmnNode;
  engine: EngineBridge;
  readOnly: boolean;
}) {
  const { diagram, execute } = useDiagram();
  const t = useT();
  const jobTypeKey = engine.jobTypeKey ?? `${engine.id}:taskDefinitionType`;
  const retriesKey = engine.retriesKey ?? `${engine.id}:retries`;
  const commitProperty = (key: string) => (value: string) =>
    execute(updateNodeCommand(node.id, { properties: { [key]: value } }));
  const advanced = Object.entries(node.properties).filter(
    ([key]) => key.startsWith(`${engine.id}:`) && key !== jobTypeKey && key !== retriesKey,
  );
  const status = diagram.version.status;
  const signed = engine.isSigned?.(diagram) ?? false;
  const canDeploy = status === 'active' && signed;

  return (
    <div data-inspector-execution={node.id}>
      <h3 className="bpmnr-inspector-title">
        {t('execution.title')}
        {engine.name ? <span className="bpmnr-inspector-engine"> · {engine.name}</span> : null}
      </h3>
      <p className="bpmnr-inspector-kicker">{t('execution.essential')}</p>
      <Field
        label={t('execution.jobType')}
        value={stringProperty(node, jobTypeKey)}
        readOnly={readOnly}
        onCommit={commitProperty(jobTypeKey)}
      />
      <Field
        label={t('execution.retries')}
        value={stringProperty(node, retriesKey)}
        readOnly={readOnly}
        onCommit={commitProperty(retriesKey)}
      />
      <details className="bpmnr-inspector-advanced" data-testid="execution-advanced">
        <summary>{t('execution.advanced')}</summary>
        {advanced.length === 0 && (
          <p className="bpmnr-inspector-empty">{t('execution.noAdvanced')}</p>
        )}
        {advanced.map(([key, value]) => (
          <Field
            key={key}
            label={key}
            value={typeof value === 'string' ? value : JSON.stringify(value)}
            readOnly={readOnly}
            onCommit={commitProperty(key)}
          />
        ))}
      </details>
      <div className="bpmnr-inspector-deploy">
        {canDeploy ? (
          <button
            type="button"
            className="bpmnr-inspector-deploy-button"
            data-testid="engine-deploy"
            disabled={readOnly}
            onClick={() => void engine.deploy?.(diagram)}
          >
            {t('execution.deploy')}
          </button>
        ) : (
          <div className="bpmnr-inspector-deploy-blocked" data-testid="engine-blocked">
            <strong>
              {/* i18n-exempt — blocked flag glyph */}⚑ {t('execution.blockedTitle')}
            </strong>
            <p>
              {t('execution.blockedBody', {
                status: t(`status.${status}`),
              })}
            </p>
            <button
              type="button"
              data-testid="engine-go-promote"
              onClick={() => engine.onRequestPromotion?.()}
            >
              {t('execution.goToPromotion')} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function stringProperty(node: BpmnNode, key: string): string {
  const value = node.properties[key];
  return typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);
}

function NodeInspector({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { execute } = useDiagram();
  const t = useT();
  return (
    <div data-inspector-node={node.id}>
      <h3 className="bpmnr-inspector-title">{node.type}</h3>
      <Field
        label={t('properties.label')}
        value={node.label}
        readOnly={readOnly}
        onCommit={(label) => execute(updateNodeCommand(node.id, { label }))}
      />
      <PropertiesEditor
        properties={node.properties}
        readOnly={readOnly}
        onCommit={(properties) => execute(updateNodeCommand(node.id, { properties }))}
      />
      <dl className="bpmnr-inspector-meta">
        <dt>{t('properties.createdInVersion')}</dt>
        <dd>{node.createdInVersion}</dd>
        {node.removedInVersion && (
          <>
            <dt>{t('properties.closedInVersion')}</dt>
            <dd>{node.removedInVersion}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function EdgeInspector({ edge, readOnly }: { edge: BpmnEdge; readOnly: boolean }) {
  const { diagram, execute } = useDiagram();
  const { edgeRouter } = useEditorConfig();
  const manual = isManualEdge(edge);
  const t = useT();
  return (
    <div data-inspector-edge={edge.id}>
      <h3 className="bpmnr-inspector-title">{edge.type}</h3>
      <Field
        label={t('properties.label')}
        value={edge.label ?? ''}
        readOnly={readOnly}
        onCommit={(label) => execute(updateEdgeCommand(edge.id, { label }))}
      />
      <Field
        label={t('properties.purpose')}
        value={edge.purpose ?? ''}
        readOnly={readOnly}
        placeholder={t('properties.purposePlaceholder')}
        onCommit={(purpose) => execute(updateEdgeCommand(edge.id, { purpose }))}
      />
      {/* Manual routes (Handoff 10 R-3): reset to automatic in one undoable
          command — recompute + cache the A* route (or clear to the diagram
          router). */}
      {manual && !readOnly && (
        <button
          type="button"
          className="bpmnr-inspector-action"
          data-action="route-back-to-auto"
          onClick={() =>
            execute(updateEdgeCommand(edge.id, backToAutoPatch(diagram, edge, edgeRouter)))
          }
        >
          {t('properties.backToAuto')}
        </button>
      )}
      <dl className="bpmnr-inspector-meta">
        <dt>{t('properties.createdInVersion')}</dt>
        <dd>{edge.createdInVersion}</dd>
        {edge.removedInVersion && (
          <>
            <dt>{t('properties.closedInVersion')}</dt>
            <dd>{edge.removedInVersion}</dd>
          </>
        )}
        {edge.supersedesEdgeId && (
          <>
            <dt>{t('properties.supersedes')}</dt>
            <dd>{edge.supersedesEdgeId}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function Field({
  label,
  value,
  onCommit,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  readOnly: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="bpmnr-field">
      <span>{label}</span>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        disabled={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(value);
        }}
      />
    </label>
  );
}

function PropertiesEditor({
  properties,
  onCommit,
  readOnly,
}: {
  properties: Record<string, unknown>;
  onCommit: (properties: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const [newKey, setNewKey] = useState('');
  const t = useT();
  const entries = Object.entries(properties);
  return (
    <div className="bpmnr-props">
      <h4>{t('properties.properties')}</h4>
      {entries.length === 0 && <p className="bpmnr-inspector-empty">{t('properties.noProperties')}</p>}
      {entries.map(([key, value]) => (
        <Field
          key={key}
          label={key}
          value={typeof value === 'string' ? value : JSON.stringify(value)}
          readOnly={readOnly}
          onCommit={(raw) => onCommit({ [key]: parseValue(raw) })}
        />
      ))}
      {!readOnly && (
        <form
          className="bpmnr-props-add"
          onSubmit={(e) => {
            e.preventDefault();
            const key = newKey.trim();
            if (!key) return;
            onCommit({ [key]: '' });
            setNewKey('');
          }}
        >
          <input
            type="text"
            value={newKey}
            placeholder={t('properties.addProperty')}
            aria-label={t('properties.newPropertyName')}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <button type="submit">+</button>
        </form>
      )}
    </div>
  );
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
