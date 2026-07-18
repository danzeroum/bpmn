import {
  addEventDefinitionCommand,
  compositeCommand,
  eventDefinitionUsages,
  findEventDefinition,
  removeEventDefinitionCommand,
  updateEventDefinitionCommand,
  updateNodeCommand,
  type BpmnDiagram,
  type BpmnNode,
  type Command,
  type EventDefinitionRefKind,
  type ValidationRule,
} from '@buildtovalue/core';
import type { EventDefinitionResolver, ResolvedEventDefinition } from '../plugins/types.js';

/**
 * Governed event-definition bindings (Handoff 16 §3b). The binding is the
 * PINNED `nome@semver` string stored in `properties.eventDefinitionBinding` —
 * which serializes as a `bpmnr:property` (never `camunda:modelRefCode`) and
 * round-trips byte-stable by construction. Binding keeps a LOCAL MIRROR
 * definition (`gov-{nome}`) so the OMG export stays valid (`messageRef`
 * present); the mirror is read-only in the UI (E-3 reforço 10) and counts as
 * a normal usage for the deletion veto (E-0/E-3 ponto 6).
 */
export const SIG_REF_MISSING = 'SIG_REF_MISSING';
export const SIG_REF_STALE = 'SIG_REF_STALE';

/** The pinned `nome@semver` binding of an event node, when present. */
export function eventBindingOf(node: BpmnNode): string | undefined {
  const binding = node.properties.eventDefinitionBinding;
  return typeof binding === 'string' && binding !== '' ? binding : undefined;
}

/** Stable mirror-definition id of a binding (`gov-{nome}`). */
export function mirrorIdOf(binding: string): string {
  const at = binding.lastIndexOf('@');
  return `gov-${at > 0 ? binding.slice(0, at) : binding}`;
}

/** True when the definition is a Biblioteca mirror (read-only in the UI). */
export function isMirrorDefinition(definitionId: string): boolean {
  return definitionId.startsWith('gov-');
}

export type BindingState = 'active' | 'stale' | 'missing';

/** Resolution state of a binding: vigente / candidata (warning) / não resolvida (erro). */
export function bindingStateOf(
  resolver: EventDefinitionResolver,
  binding: string,
  kind: EventDefinitionRefKind,
): { state: BindingState; resolved?: ResolvedEventDefinition } {
  const resolved = resolver.resolve(binding, kind);
  if (!resolved) return { state: 'missing' };
  return { state: resolved.status === 'active' ? 'active' : 'stale', resolved };
}

/**
 * ONE composite (1 undo): upsert the local mirror from the resolved artifact,
 * point the node's `eventDefinitionRef` at it and pin the binding.
 */
export function buildBindCommand(
  diagram: BpmnDiagram,
  node: BpmnNode,
  kind: EventDefinitionRefKind,
  binding: string,
  resolved: ResolvedEventDefinition,
  description: string,
): Command {
  const mirrorId = mirrorIdOf(binding);
  const existing = findEventDefinition(diagram, kind, mirrorId);
  const code =
    resolved.definition.errorCode !== undefined
      ? { errorCode: resolved.definition.errorCode }
      : resolved.definition.escalationCode !== undefined
        ? { escalationCode: resolved.definition.escalationCode }
        : {};
  const upsert = existing
    ? updateEventDefinitionCommand(kind, mirrorId, { name: resolved.definition.name, ...code })
    : addEventDefinitionCommand(kind, { id: mirrorId, name: resolved.definition.name, ...code });
  return compositeCommand(description, [
    upsert,
    updateNodeCommand(node.id, {
      properties: { eventDefinitionRef: mirrorId, eventDefinitionBinding: binding },
    }),
  ]);
}

/**
 * ONE composite (1 undo): clear the binding (+ ref) and garbage-collect the
 * mirror when this node was its LAST usage — intentional composite: the
 * unlink inside the same atomic step is what makes the removal safe, so the
 * marker-based veto (which sees only top-level commands) is deliberately
 * bypassed here and only here.
 */
export function buildUnbindCommand(
  diagram: BpmnDiagram,
  node: BpmnNode,
  kind: EventDefinitionRefKind,
  description: string,
  nextRef?: string,
): Command {
  const binding = eventBindingOf(node);
  const commands: Command[] = [
    updateNodeCommand(node.id, {
      properties: {
        eventDefinitionRef: nextRef || undefined,
        eventDefinitionBinding: undefined,
      },
    }),
  ];
  if (binding) {
    const mirrorId = mirrorIdOf(binding);
    const others = eventDefinitionUsages(diagram, kind, mirrorId).filter(
      (usage) => usage.nodeId !== node.id,
    );
    if (others.length === 0 && findEventDefinition(diagram, kind, mirrorId)) {
      commands.push(removeEventDefinitionCommand(kind, mirrorId));
    }
  }
  return compositeCommand(description, commands);
}

/**
 * Validation rule factory (§3b — the callActivityBindingRule mold): the host
 * wires it as a plugin `validationRules` entry with the SAME resolver it
 * injects. Unresolvable binding → ERROR `SIG_REF_MISSING`; resolvable but not
 * VIGENTE → WARNING `SIG_REF_STALE`. Badges paint through the existing
 * issueBadges overlay — glyph+text, never color alone.
 */
export function eventBindingRule(resolver: EventDefinitionResolver): ValidationRule {
  return (diagram) => {
    const issues = [];
    for (const node of Object.values(diagram.nodes)) {
      if (node.removedInVersion) continue;
      const binding = eventBindingOf(node);
      const kind = node.properties.eventDefinition;
      if (
        !binding ||
        (kind !== 'message' && kind !== 'signal' && kind !== 'error' && kind !== 'escalation')
      )
        continue;
      const { state } = bindingStateOf(resolver, binding, kind);
      if (state === 'missing') {
        issues.push({
          code: SIG_REF_MISSING,
          severity: 'error' as const,
          message: `Referência governada "${binding}" não resolve na Biblioteca`,
          nodeId: node.id,
        });
      } else if (state === 'stale') {
        issues.push({
          code: SIG_REF_STALE,
          severity: 'warning' as const,
          message: `Referência governada "${binding}" aponta para versão não vigente`,
          nodeId: node.id,
        });
      }
    }
    return issues;
  };
}
