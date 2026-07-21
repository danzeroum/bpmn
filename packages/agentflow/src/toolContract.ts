/**
 * Tool contracts (Handoff 22 "Squad Lane", SL-1).
 *
 * A `ToolContract` is the versioned artifact a `tool` node binds to
 * (`tool:browser-search@1.2.0`). It carries the capability/permission/effect
 * matrix (cerca §2.8): the tool declares its EFFECT (`read` … `external-commitment`)
 * and its own governance field AUTHORIZATION (`automatica`/`gate`/`proibida`),
 * which feeds the gate rule (cerca §2.9). The contract's input/output shapes use
 * the honest JSON-Schema subset that Squad Lane SL-4 promotes to `SchemaNode`.
 *
 * Everything here is pure and imports nothing outside this package (independence
 * test): the react layer resolves a ref to a contract through an INJECTED
 * `ToolProvider` (born in SL-2), so agentflow never depends on the library.
 */

import { parseRef, type AgentRef, type RefInput } from './ref.js';

/**
 * What a tool DOES when invoked (cerca §2.8). Risk classifies, permission
 * decides, effect explains — the effect never grants authorization on its own.
 */
export type ToolEffect =
  | 'read'
  | 'propose'
  | 'notify'
  | 'write-reversible'
  | 'write-irreversible'
  | 'external-commitment';

/**
 * The governance decision for a tool (cerca §2.8) — a field of its OWN, never
 * inferred from the effect. `gate` means a human gate must cover the call
 * before the effect; `proibida` bans the tool outright.
 */
export type ToolAuthorization = 'automatica' | 'gate' | 'proibida';

/**
 * One field of a tool's input/output shape — the honest JSON-Schema subset
 * (`type`, `required`, `enum`, `items`, `properties`; anything else is out of
 * scope until SL-4's `SchemaNode`). Deliberately minimal and self-contained.
 */
export interface ToolSchemaField {
  type: string;
  required?: boolean;
  enum?: unknown[];
  items?: ToolSchemaField;
  properties?: ToolSchema;
}

/** A tool input/output shape: property name → field descriptor. */
export type ToolSchema = Record<string, ToolSchemaField>;

/**
 * The TOOL artifact of the Library (cerca §2.1 — a decorator/artifact, never a
 * fourth node type). Stored by versioned ref; the BPMN keeps the ref + local
 * config, the snapshot is read-only degraded.
 */
export interface ToolContract {
  kind: 'ToolContract';
  /** Bare id, e.g. "tool:browser-search" (the `tool:` prefix is part of the id). */
  id: string;
  /** Full `major.minor.patch`. */
  version: string;
  /** Machine name, e.g. "browser_search" (AgentO `usesTool`). */
  name: string;
  /** One-line capability, in business language, e.g. "buscar na web". */
  capability: string;
  inputSchema: ToolSchema;
  outputSchema: ToolSchema;
  effect: ToolEffect;
  /** Data classification of the payload, e.g. "publico-sem-pii". */
  dataScope: string;
  authorization: ToolAuthorization;
  /** Evidence the tool must attach, e.g. "nenhuma" (free-form; backend-owned). */
  evidenceRequired: string;
  /** Simulation contract, e.g. "fixture-obrigatoria". */
  simulation: string;
  /** Declared error classes, e.g. ["timeout", "validation", "rate-limit"]. */
  errors?: string[];
  /** Deterministic fixture used when no scenario fixture is supplied. */
  defaultFixture?: Record<string, unknown>;
}

/** The effects that require a covering gate (cerca §2.9). */
const GATED_EFFECTS: ReadonlySet<ToolEffect> = new Set<ToolEffect>([
  'write-irreversible',
  'external-commitment',
]);

/**
 * Pure predicate (the `requiresDownstreamGate` mold): true when a tool with this
 * effect may only run behind a human gate — a `write-irreversible` or
 * `external-commitment` effect cannot run `automatica` (cerca §2.9).
 *
 * This is a CLASSIFIER only. Whether a covering gate is actually on the path
 * before the effect (`EFFECT_NEEDS_GATE` / `GATE_NOT_COVERING`) is a decision of
 * the surrounding BPMN process — it lives in `@buildtovalue/core` over
 * `reachableGateFrom` (Squad Lane SL-12), which consumes this predicate the same
 * way the autonomy→gate rule consumes `gateRequirement`. The headless agentflow
 * cannot see the process and must not emit that rule (it would fire always or
 * never — the acidity fence, cerca §2.3).
 */
export function effectRequiresGate(effect: ToolEffect): boolean {
  return GATED_EFFECTS.has(effect);
}

/**
 * True when `input` is a well-formed versioned TOOL reference — a parseable
 * `id@semver` whose id carries the `tool:` prefix (cerca §2.1/§2.2). A bare
 * capability name like "browser_search" is NOT a tool ref.
 */
export function isToolRef(input: RefInput): boolean {
  try {
    return parseRef(input).ref.id.startsWith('tool:');
  } catch {
    return false;
  }
}

/** How a node's params diverge from a tool contract's `inputSchema`. */
export interface ToolParamsMismatch {
  /** Required input keys the node did not supply. */
  missingRequired: string[];
  /** Node param keys the contract does not declare. */
  unknownParams: string[];
}

/**
 * Compares a tool node's call params against a contract `inputSchema` (SL-1).
 * Keys only — values are template references (`{{node.output.x}}`), so a value
 * type-check would be dishonest. Every REQUIRED input must be present, and every
 * supplied param must be declared by the contract.
 */
export function matchToolParams(
  params: Record<string, unknown>,
  inputSchema: ToolSchema,
): ToolParamsMismatch {
  const missingRequired: string[] = [];
  for (const [key, field] of Object.entries(inputSchema)) {
    if (field.required === true && !(key in params)) missingRequired.push(key);
  }
  const unknownParams: string[] = [];
  for (const key of Object.keys(params)) {
    if (!(key in inputSchema)) unknownParams.push(key);
  }
  return { missingRequired, unknownParams };
}

/**
 * Resolves a versioned tool ref to its contract — INJECTED by the host (SL-2's
 * `ToolProvider` implements it). Absent → tool-contract checks degrade to the
 * structural ref check only (never an error); present but returning `undefined`
 * → a declared `TOOL_UNRESOLVED` warning (cerca §2.4, never silent).
 */
export type ResolveTool = (ref: AgentRef) => ToolContract | undefined;
