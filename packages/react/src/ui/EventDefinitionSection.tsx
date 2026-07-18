import { useEffect, useRef, useState } from 'react';
import {
  addEventDefinitionCommand,
  compositeCommand,
  eventDefinitionList,
  eventDefinitionRefOf,
  eventDefinitionUsages,
  findEventDefinition,
  nextEventDefinitionId,
  nodeParentId,
  removeEventDefinitionCommand,
  updateEventDefinitionCommand,
  updateNodeCommand,
  type BpmnNode,
  type ErrorEventDefinition,
  type EventDefinitionRefKind,
  type NamedEventDefinition,
} from '@buildtovalue/core';
import { useCanvasStore } from '../contexts/CanvasContext.js';
import { useDiagram } from '../contexts/DiagramContext.js';
import { panViewportTo, reducedMotion } from '../canvas/viewport.js';
import { useT } from '../i18n/I18nContext.js';

/**
 * "Evento" section of the properties panel (Handoff 16 E-2, §3a UI): the
 * named-definition picker with the «+» flow (ONE composite command — add +
 * reference — so one undo reverts both, régua 1), inline rename whose cascade
 * to every referencing event is by construction (refs are by id — régua 2),
 * the honest usage list with click-to-navigate (U-4 animated pan,
 * reduced-motion respected — régua 3) and deletion whose veto (default core
 * rule) surfaces through the existing `lastVeto` channel. `errorCode` renders
 * ONLY for error definitions (régua 4).
 */
const REF_KINDS = new Set(['message', 'signal', 'error']);

/** `errorCode` of a definition, tolerant of the message/signal shape. */
function codeOf(definition: NamedEventDefinition | ErrorEventDefinition | undefined): string {
  return (definition as ErrorEventDefinition | undefined)?.errorCode ?? '';
}

export function eventKindOf(node: BpmnNode): EventDefinitionRefKind | null {
  const kind = node.properties.eventDefinition;
  return typeof kind === 'string' && REF_KINDS.has(kind) ? (kind as EventDefinitionRefKind) : null;
}

export function EventDefinitionSection({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { diagram, execute } = useDiagram();
  const store = useCanvasStore();
  const t = useT();
  const panRaf = useRef<number | null>(null);
  const kind = eventKindOf(node);
  const ref = eventDefinitionRefOf(node);
  // The MANAGED definition survives unlinking: picking "" clears the node's
  // ref but keeps the definition block visible, so the Axelor flow "trocar
  // ref → excluir" is reachable — the delete veto stays honest (any active
  // usage, including this node, blocks).
  const [managedId, setManagedId] = useState<string | undefined>(ref);
  useEffect(() => {
    if (ref) setManagedId(ref);
  }, [ref]);
  const definition =
    kind && managedId ? findEventDefinition(diagram, kind, managedId) : undefined;
  const [name, setName] = useState(definition?.name ?? '');
  const [errorCode, setErrorCode] = useState(codeOf(definition));
  useEffect(() => {
    setName(definition?.name ?? '');
    setErrorCode(codeOf(definition));
  }, [definition]);
  if (!kind) return null;

  const list = eventDefinitionList(diagram, kind);
  const usages = definition ? eventDefinitionUsages(diagram, kind, definition.id) : [];

  const setRef = (value: string) => {
    void execute(
      updateNodeCommand(node.id, { properties: { eventDefinitionRef: value || undefined } }),
    );
  };

  // Régua 1: «+» = ONE composite (add definition + reference this node) = 1 undo.
  const createAndReference = () => {
    const id = nextEventDefinitionId(diagram, kind);
    void execute(
      compositeCommand(t('eventDefs.compose.create'), [
        addEventDefinitionCommand(kind, { id, name: t(`eventDefs.defaultName.${kind}`) }),
        updateNodeCommand(node.id, { properties: { eventDefinitionRef: id } }),
      ]),
    );
  };

  // Régua 3: click navigates — U-4 animated pan + selection; reduced-motion
  // pans instantly (panViewportTo already honors it) and skips the pulse.
  const goTo = (nodeId: string) => {
    const target = diagram.nodes[nodeId];
    if (!target) return;
    const scope = nodeParentId(target) ?? null;
    const state = store.getState();
    store.setState({
      selectedIds: [nodeId],
      focusedElementId: nodeId,
      ...(state.drillId !== scope ? { drillId: scope } : {}),
      searchPulse: reducedMotion() ? null : { elementId: nodeId, token: Date.now() },
    });
    const { viewport } = store.getState();
    panViewportTo(
      store,
      target.x + target.width / 2 - viewport.width / 2,
      target.y + target.height / 2 - viewport.height / 2,
      panRaf,
    );
  };

  return (
    <section className="bpmnr-eventdefs" data-testid="eventdefs-section">
      <span className="bpmnr-inspector-kicker">{t(`eventDefs.kicker.${kind}`)}</span>
      <label className="bpmnr-eventdefs-picker">
        <span>{t('eventDefs.picker.label')}</span>
        <select
          value={ref ?? ''}
          disabled={readOnly}
          aria-label={t('eventDefs.picker.label')}
          data-testid="eventdefs-picker"
          onChange={(event) => setRef(event.target.value)}
        >
          <option value="">{t('eventDefs.picker.none')}</option>
          {list.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} ({entry.id})
            </option>
          ))}
        </select>
      </label>
      {!readOnly && (
        <button
          type="button"
          className="bpmnr-eventdefs-add"
          data-testid="eventdefs-add"
          aria-label={t('eventDefs.add.aria')}
          onClick={createAndReference}
        >
          {/* i18n-exempt — plus glyph */}+ {t('eventDefs.add')}
        </button>
      )}
      {definition && (
        <>
          <label className="bpmnr-eventdefs-field">
            <span>{t('eventDefs.name.label')}</span>
            <input
              type="text"
              value={name}
              disabled={readOnly}
              aria-label={t('eventDefs.name.label')}
              data-testid="eventdefs-name"
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                if (name !== definition.name && kind) {
                  void execute(updateEventDefinitionCommand(kind, definition.id, { name }));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              }}
            />
          </label>
          {/* Régua 4: errorCode SÓ para definições de erro. */}
          {kind === 'error' && (
            <label className="bpmnr-eventdefs-field">
              <span>{t('eventDefs.errorCode.label')}</span>
              <input
                type="text"
                value={errorCode}
                disabled={readOnly}
                aria-label={t('eventDefs.errorCode.label')}
                data-testid="eventdefs-errorcode"
                onChange={(event) => setErrorCode(event.target.value)}
                onBlur={() => {
                  if (errorCode !== codeOf(definition) && kind) {
                    void execute(updateEventDefinitionCommand(kind, definition.id, { errorCode }));
                  }
                }}
              />
            </label>
          )}
          <div className="bpmnr-eventdefs-usages" data-testid="eventdefs-usages">
            <span className="bpmnr-inspector-kicker">
              {usages.length === 0
                ? t('eventDefs.usages.none')
                : t('eventDefs.usages.kicker', { count: usages.length })}
            </span>
            <ul>
              {usages.map((usage) => (
                <li key={usage.nodeId}>
                  <button
                    type="button"
                    data-eventdefs-usage={usage.nodeId}
                    aria-label={t('eventDefs.usages.goto', { label: usage.label })}
                    onClick={() => goTo(usage.nodeId)}
                  >
                    {usage.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {!readOnly && (
            <button
              type="button"
              className="bpmnr-eventdefs-delete"
              data-testid="eventdefs-delete"
              aria-label={t('eventDefs.delete.aria')}
              onClick={() => {
                if (!kind) return;
                const removal = removeEventDefinitionCommand(kind, definition.id);
                const verdict = execute(removal);
                if (verdict.allowed) setManagedId(undefined);
              }}
            >
              {t('eventDefs.delete')}
            </button>
          )}
        </>
      )}
    </section>
  );
}
