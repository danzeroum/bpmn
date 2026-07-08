import { calledElementOf, type BpmnDiagram, type ValidationRule } from '@bpmn-react/core';
import type { VersionRegistry } from './VersionRegistry.js';
import type { DateInput, PublicationTarget, RegistryEntry } from './types.js';

/** The registry resolution of one callActivity node at a point in time. */
export interface CallActivityResolution {
  nodeId: string;
  /** The called process id (`properties.calledElement`), if set. */
  calledElement?: string;
  /** The called process' registered version in effect at `at`, if any. */
  entry?: RegistryEntry;
}

function toMillis(input: DateInput): number {
  return typeof input === 'string' ? new Date(input).getTime() : input.getTime();
}

/**
 * Resolves every callActivity in `diagram` against the registry: entries
 * whose snapshot IS the called process (`snapshot.id === calledElement`),
 * narrowed to the version in effect at `at` — by publication window when a
 * lane `target` is given, otherwise by the version's own validity window
 * (`effectiveFrom`/`effectiveUntil`, latest wins on overlap). This is the
 * F7 registry synergy: a call activity binds to whatever version is active
 * when the caller runs, never to a hardcoded one.
 */
export function resolveCallActivities(
  diagram: BpmnDiagram,
  registry: VersionRegistry,
  at: DateInput,
  target?: PublicationTarget,
): CallActivityResolution[] {
  const atMs = toMillis(at);
  const resolutions: CallActivityResolution[] = [];
  for (const node of Object.values(diagram.nodes)) {
    if (node.type !== 'callActivity') continue;
    const calledElement = calledElementOf(node);
    if (calledElement === undefined) {
      resolutions.push({ nodeId: node.id });
      continue;
    }
    const candidates = registry.list().filter((entry) => entry.snapshot.id === calledElement);
    resolutions.push({
      nodeId: node.id,
      calledElement,
      ...(pickActive(candidates, atMs, target) !== undefined
        ? { entry: pickActive(candidates, atMs, target) }
        : {}),
    });
  }
  return resolutions;
}

function pickActive(
  candidates: RegistryEntry[],
  atMs: number,
  target?: PublicationTarget,
): RegistryEntry | undefined {
  let best: RegistryEntry | undefined;
  let bestFrom = -Infinity;
  for (const entry of candidates) {
    const window = target
      ? entry.publications.find(
          (pub) =>
            pub.channel === target.channel &&
            pub.environment === target.environment &&
            coversWindow(pub.effectiveFrom, pub.effectiveUntil, atMs),
        )
      : coversWindow(entry.version.effectiveFrom, entry.version.effectiveUntil, atMs)
        ? { effectiveFrom: entry.version.effectiveFrom! }
        : undefined;
    if (!window) continue;
    const from = toMillis(window.effectiveFrom);
    if (from >= bestFrom) {
      bestFrom = from;
      best = entry;
    }
  }
  return best;
}

function coversWindow(
  effectiveFrom: string | undefined,
  effectiveUntil: string | undefined,
  atMs: number,
): boolean {
  if (!effectiveFrom) return false;
  if (atMs < toMillis(effectiveFrom)) return false;
  return effectiveUntil === undefined || atMs < toMillis(effectiveUntil);
}

/**
 * Validation rule for broken call-activity references (Handoff 5 §3.2):
 * a callActivity whose `calledElement` is missing, unregistered, or has no
 * version in effect at `at` gets the stable code `CALL_REF_MISSING`
 * (error). Plug it into the editor as a plugin `validationRules` entry —
 * the canvas issue overlay paints the red stroke + badge + code.
 */
export function callActivityBindingRule(
  registry: VersionRegistry,
  at?: DateInput,
  target?: PublicationTarget,
): ValidationRule {
  return (diagram) => {
    const when = at ?? new Date().toISOString();
    return resolveCallActivities(diagram, registry, when, target)
      .filter((resolution) => resolution.entry === undefined)
      .map((resolution) => ({
        code: 'CALL_REF_MISSING',
        severity: 'error' as const,
        message: resolution.calledElement
          ? `Call activity ${resolution.nodeId} references "${resolution.calledElement}", which has no version in effect`
          : `Call activity ${resolution.nodeId} has no calledElement`,
        nodeId: resolution.nodeId,
      }));
  };
}
