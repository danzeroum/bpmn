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
import { useEditorConfig } from '../contexts/EditorConfigContext.js';
import { panViewportTo, reducedMotion } from '../canvas/viewport.js';
import {
  bindingStateOf,
  buildBindCommand,
  buildUnbindCommand,
  eventBindingOf,
  isMirrorDefinition,
} from '../canvas/eventBinding.js';
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
const REF_KINDS = new Set(['message', 'signal', 'error', 'escalation']);

/** Kinds that carry a per-type code field (error → errorCode, escalation → escalationCode). */
const CODE_KINDS = new Set(['error', 'escalation']);

/** The per-type code (`errorCode`/`escalationCode`) of a definition, tolerant of the plain shape. */
function codeOf(definition: NamedEventDefinition | ErrorEventDefinition | undefined): string {
  const coded = definition as { errorCode?: string; escalationCode?: string } | undefined;
  return coded?.errorCode ?? coded?.escalationCode ?? '';
}

/** The patch key for a kind's code field. */
function codePatch(kind: EventDefinitionRefKind, code: string): { errorCode?: string; escalationCode?: string } {
  return kind === 'escalation' ? { escalationCode: code } : { errorCode: code };
}

export function eventKindOf(node: BpmnNode): EventDefinitionRefKind | null {
  const kind = node.properties.eventDefinition;
  return typeof kind === 'string' && REF_KINDS.has(kind) ? (kind as EventDefinitionRefKind) : null;
}

/** Picker option value of a governed catalog entry (`bind:` scheme). */
const BIND_PREFIX = 'bind:';

export function EventDefinitionSection({ node, readOnly }: { node: BpmnNode; readOnly: boolean }) {
  const { diagram, execute } = useDiagram();
  const store = useCanvasStore();
  const config = useEditorConfig();
  const t = useT();
  const panRaf = useRef<number | null>(null);
  const kind = eventKindOf(node);
  const ref = eventDefinitionRefOf(node);
  const resolver = config.eventDefinitionResolver;
  const binding = eventBindingOf(node);
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
  // Escalation authority (Handoff 18 §5b) — a NODE property (free text →
  // bpmnr:), committed on blur so the transient chip reads the SETTLED value,
  // never a keystroke. Empty commits as undefined (property removed → no chip).
  const committedAuthority =
    typeof node.properties.escalationAuthority === 'string'
      ? node.properties.escalationAuthority
      : '';
  const [authority, setAuthority] = useState(committedAuthority);
  useEffect(() => {
    setAuthority(committedAuthority);
  }, [committedAuthority]);
  if (!kind) return null;

  const list = eventDefinitionList(diagram, kind);
  const usages = definition ? eventDefinitionUsages(diagram, kind, definition.id) : [];
  // §3b — governed refs: catalog entries from the INJECTED resolver (react
  // never consults a registry), the pinned binding's resolution state for the
  // seal, and the reforço-10 read-only mirror flag.
  const catalog = resolver ? resolver.list(kind) : [];
  const bindingState = binding && resolver ? bindingStateOf(resolver, binding, kind) : null;
  const mirror = definition ? isMirrorDefinition(definition.id) : false;
  const fieldsLocked = readOnly || mirror;

  // Picker dispatch: `bind:{nome@semver}` values bind through the Biblioteca
  // (ONE composite: mirror upsert + ref + pin); leaving a binding for a local
  // definition (or none) unbinds in ONE composite that garbage-collects the
  // orphaned mirror.
  const setRef = (value: string) => {
    if (value.startsWith(BIND_PREFIX)) {
      const target = value.slice(BIND_PREFIX.length);
      if (target === binding || !resolver) return;
      const resolved = resolver.resolve(target, kind);
      if (!resolved) return;
      void execute(buildBindCommand(diagram, node, kind, target, resolved, t('eventDefs.compose.bind')));
      return;
    }
    if (binding) {
      void execute(buildUnbindCommand(diagram, node, kind, t('eventDefs.compose.unbind'), value));
      return;
    }
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
          value={binding ? `${BIND_PREFIX}${binding}` : (ref ?? '')}
          disabled={readOnly}
          aria-label={t('eventDefs.picker.label')}
          data-testid="eventdefs-picker"
          onChange={(event) => setRef(event.target.value)}
        >
          <option value="">{t('eventDefs.picker.none')}</option>
          <optgroup label={t('eventDefs.local.group')}>
            {/* Mirrors are Biblioteca-managed: they never appear as free local
                choices (that would break the pin), except to keep an imported
                un-pinned ref visible instead of a blank select. */}
            {list
              .filter((entry) => !isMirrorDefinition(entry.id) || (!binding && entry.id === ref))
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.id})
                </option>
              ))}
          </optgroup>
          {catalog.length > 0 && (
            <optgroup label={t('eventDefs.library.group')}>
              {catalog.map((entry) => {
                const value = `${entry.name}@${entry.semanticVersion}`;
                return (
                  <option key={value} value={`${BIND_PREFIX}${value}`}>
                    {value}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>
      </label>
      {binding && bindingState && (
        <span
          className="bpmnr-eventdefs-seal"
          data-testid="eventdefs-seal"
          data-binding-state={bindingState.state}
        >
          {/* i18n-exempt — state glyphs; the text is the translation */}
          {bindingState.state === 'active' && `✓ ${t('eventDefs.binding.active')}`}
          {bindingState.state === 'stale' && `⚠ ${t('eventDefs.binding.stale')}`}
          {bindingState.state === 'missing' && `✕ ${t('eventDefs.binding.missing')}`}
        </span>
      )}
      {binding && !resolver && (
        <p className="bpmnr-eventdefs-degraded" data-testid="eventdefs-degraded">
          {t('eventDefs.binding.degraded')} <code>{binding}</code>
        </p>
      )}
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
      {/* §5b — escalation authority: a free-text NODE property (bpmnr:),
          committed on blur; empty removes it (chip degrades to absent). */}
      {kind === 'escalation' && (
        <label className="bpmnr-eventdefs-field">
          <span>{t('eventDefs.authority.label')}</span>
          <input
            type="text"
            value={authority}
            disabled={readOnly}
            aria-label={t('eventDefs.authority.label')}
            data-testid="eventdefs-authority"
            onChange={(event) => setAuthority(event.target.value)}
            onBlur={() => {
              const settled = authority.trim();
              if (settled !== committedAuthority) {
                void execute(
                  updateNodeCommand(node.id, {
                    properties: { escalationAuthority: settled === '' ? undefined : settled },
                  }),
                );
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
            }}
          />
        </label>
      )}
      {definition && (
        <>
          {/* E-3 reforço 10 — the gov-* mirror is Biblioteca-managed: rename
              and errorCode are LOCKED here; editing happens by promoting a new
              artifact version and explicitly re-binding (audited). */}
          {mirror && (
            <p className="bpmnr-eventdefs-mirror-notice" data-testid="eventdefs-mirror-notice">
              {t('eventDefs.mirror.notice')}
            </p>
          )}
          <label className="bpmnr-eventdefs-field">
            <span>{t('eventDefs.name.label')}</span>
            <input
              type="text"
              value={name}
              disabled={fieldsLocked}
              aria-label={t('eventDefs.name.label')}
              data-testid="eventdefs-name"
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                if (!mirror && name !== definition.name && kind) {
                  void execute(updateEventDefinitionCommand(kind, definition.id, { name }));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              }}
            />
          </label>
          {/* Régua 4: código por tipo — errorCode (erro) / escalationCode
              (escalação, Handoff 18 §5b); assimetria por tipo. */}
          {kind && CODE_KINDS.has(kind) && (
            <label className="bpmnr-eventdefs-field">
              <span>
                {kind === 'escalation'
                  ? t('eventDefs.escalationCode.label')
                  : t('eventDefs.errorCode.label')}
              </span>
              <input
                type="text"
                value={errorCode}
                disabled={fieldsLocked}
                aria-label={
                  kind === 'escalation'
                    ? t('eventDefs.escalationCode.label')
                    : t('eventDefs.errorCode.label')
                }
                data-testid="eventdefs-errorcode"
                onChange={(event) => setErrorCode(event.target.value)}
                onBlur={() => {
                  if (!mirror && errorCode !== codeOf(definition) && kind) {
                    void execute(updateEventDefinitionCommand(kind, definition.id, codePatch(kind, errorCode)));
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
