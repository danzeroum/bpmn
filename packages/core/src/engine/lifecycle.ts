import type {
  ApprovalRecord,
  BpmnDiagram,
  BpmnVersion,
  UserContext,
  VersionStatus,
} from '../model/types.js';
import { BpmnLifecycleError } from '../model/errors.js';
import { generateId, nowIso } from '../model/factory.js';
import type { RuleVerdict } from '../commands/types.js';
import { canonicalJson, sha256Hex } from '../persistence/hash.js';

/**
 * Default transition table. Note the deliberate absence of
 * `deprecated → active`: direct reactivation is prohibited for audit
 * integrity — restore by cloning into a new draft and promoting it.
 */
export const DEFAULT_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  draft: ['test'],
  test: ['candidate', 'draft'],
  candidate: ['active', 'test', 'in-review'],
  // Handoff 15 §2e — EM REVISÃO ⟲: entered ONLY by request-changes
  // (candidate → in-review) and left ONLY by re-submission (→ candidate).
  'in-review': ['candidate'],
  active: ['deprecated'],
  deprecated: ['retired'],
  retired: [],
};

export interface PromotionInput {
  diagram: BpmnDiagram;
  target: VersionStatus;
  actor: UserContext;
  reason: string;
  /** Structured diff vs. the previous version, when the config requires it. */
  diff?: unknown;
}

export type PromotionRule = (input: PromotionInput) => RuleVerdict | Promise<RuleVerdict>;

/**
 * One requirement of a promotion, in evaluation order. UIs render these as a
 * checklist; {@link LifecycleEngine.promote} throws the `detail` of the first
 * unsatisfied gate — a single source of truth, never duplicated in the UI.
 */
export interface PromotionGate {
  id: 'transition' | 'approvals' | 'change-summary' | 'diff' | `rule:${number}`;
  /** Short human label for checklists. */
  label: string;
  satisfied: boolean;
  /** Requirement/failure text; when unsatisfied, promote() throws exactly this. */
  detail: string;
  /** Approvals gate: distinct roles required. */
  required?: number;
  /** Approvals gate: distinct roles collected so far. */
  current?: number;
}

export interface LifecycleConfig {
  transitions?: Record<VersionStatus, VersionStatus[]>;
  /** Distinct approval roles required to reach 'active'. Default 2. */
  minApprovalRoles?: number;
  /** Minimum changelog length required to reach 'active'. Default 20. */
  minChangeSummaryLength?: number;
  /** Require a diff to be attached when promoting to 'active'. Default false. */
  requireDiff?: boolean;
  /** Extra rules evaluated on every promotion (after the built-ins). */
  promotionRules?: PromotionRule[];
}

export type SemverBump = 'major' | 'minor' | 'patch';

export function bumpSemver(version: string, bump: SemverBump): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((p) => parseInt(p, 10) || 0);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** Content hash of the diagram (nodes + edges + identity, audit excluded). */
export async function computeDiagramHash(diagram: BpmnDiagram): Promise<string> {
  const strippedNodes = Object.fromEntries(
    Object.entries(diagram.nodes).map(([id, n]) => [id, { ...n, audit: undefined }]),
  );
  const strippedEdges = Object.fromEntries(
    Object.entries(diagram.edges).map(([id, e]) => [id, { ...e, audit: undefined }]),
  );
  return sha256Hex(
    canonicalJson({
      id: diagram.id,
      name: diagram.name,
      description: diagram.description,
      nodes: strippedNodes,
      edges: strippedEdges,
      metadata: diagram.metadata,
      // Passthrough fields are content: preserved foreign extensions join the
      // hash. Absent (undefined) keys serialize to nothing, so every
      // pre-passthrough hash is byte-for-byte unchanged.
      processForeignExtensions: diagram.processForeignExtensions,
      foreignNamespaces: diagram.foreignNamespaces,
    }),
  );
}

/**
 * Governs version lifecycle transitions. Every accepted promotion produces a
 * *new* immutable version entity chained to its parent — the previous version
 * object is never mutated.
 */
export class LifecycleEngine {
  private readonly transitions: Record<VersionStatus, VersionStatus[]>;
  private readonly minApprovalRoles: number;
  private readonly minChangeSummaryLength: number;
  private readonly requireDiff: boolean;
  private readonly promotionRules: PromotionRule[];

  constructor(config: LifecycleConfig = {}) {
    this.transitions = config.transitions ?? DEFAULT_TRANSITIONS;
    this.minApprovalRoles = config.minApprovalRoles ?? 2;
    this.minChangeSummaryLength = config.minChangeSummaryLength ?? 20;
    this.requireDiff = config.requireDiff ?? false;
    this.promotionRules = config.promotionRules ?? [];
  }

  /**
   * Distinct approval roles required to reach 'active'. Config echo so UIs
   * (status seal, promotion gates) reflect the engine instead of hardcoding.
   */
  get requiredApprovalRoles(): number {
    return this.minApprovalRoles;
  }

  /** Minimum changelog length required to reach 'active' (config echo for UIs). */
  get requiredChangeSummaryLength(): number {
    return this.minChangeSummaryLength;
  }

  canTransition(from: VersionStatus, to: VersionStatus): boolean {
    return this.transitions[from]?.includes(to) ?? false;
  }

  allowedTargets(from: VersionStatus): VersionStatus[] {
    return this.transitions[from] ?? [];
  }

  /** Records an approval on the current version (returns a new diagram). */
  approve(diagram: BpmnDiagram, actor: UserContext, reason: string): BpmnDiagram {
    const record: ApprovalRecord = {
      userId: actor.id,
      role: actor.role,
      approvedAt: nowIso(),
      reason,
    };
    const already = diagram.version.approvedBy.some((a) => a.userId === actor.id);
    if (already) {
      throw new BpmnLifecycleError(`User ${actor.id} already approved this version`);
    }
    return {
      ...diagram,
      version: { ...diagram.version, approvedBy: [...diagram.version.approvedBy, record] },
    };
  }

  /**
   * Evaluates every promotion gate for `input`, in the exact order `promote`
   * enforces them. Introspection API for UIs (checklists, disabled buttons):
   * the UI reflects the engine's verdicts instead of re-implementing them.
   */
  async evaluateGates(input: PromotionInput): Promise<PromotionGate[]> {
    const { diagram, target } = input;
    const version = diagram.version;
    const gates: PromotionGate[] = [];

    const transitionOk = this.canTransition(version.status, target);
    gates.push({
      id: 'transition',
      label: `Transição ${version.status} → ${target}`,
      satisfied: transitionOk,
      detail: transitionOk
        ? `Transition ${version.status} → ${target} is allowed`
        : `Invalid transition: ${version.status} → ${target}. Allowed: ${
            this.allowedTargets(version.status).join(', ') || '(none)'
          }`,
    });

    if (target === 'active') {
      const roles = new Set(version.approvedBy.map((a) => a.role));
      gates.push({
        id: 'approvals',
        label: `Aprovações — mínimo ${this.minApprovalRoles} papéis distintos`,
        satisfied: roles.size >= this.minApprovalRoles,
        detail:
          roles.size >= this.minApprovalRoles
            ? `Approved by ${roles.size} distinct roles`
            : `Promotion to active requires approvals from at least ${this.minApprovalRoles} distinct roles (got ${roles.size})`,
        required: this.minApprovalRoles,
        current: roles.size,
      });
      const summaryOk = version.changeSummary.trim().length >= this.minChangeSummaryLength;
      gates.push({
        id: 'change-summary',
        label: 'change_summary preenchido',
        satisfied: summaryOk,
        detail: summaryOk
          ? 'Change summary present'
          : `Promotion to active requires a change summary of at least ${this.minChangeSummaryLength} characters`,
      });
      if (this.requireDiff) {
        const diffOk = input.diff !== undefined;
        gates.push({
          id: 'diff',
          label: 'Diff vs versão anterior anexado',
          satisfied: diffOk,
          detail: diffOk ? 'Diff attached' : 'Promotion to active requires an attached diff',
        });
      }
    }

    for (const [index, rule] of this.promotionRules.entries()) {
      const verdict = await rule(input);
      gates.push({
        id: `rule:${index}`,
        label: `Regra de promoção ${index + 1}`,
        satisfied: verdict.allowed,
        detail: verdict.allowed ? 'Rule passed' : (verdict.reason ?? 'Promotion vetoed by rule'),
      });
    }

    return gates;
  }

  /**
   * Promotes the diagram's version to `target`. Throws {@link BpmnLifecycleError}
   * with the first unsatisfied gate's detail (see {@link evaluateGates} — the
   * single source of truth for promotion requirements).
   */
  async promote(input: PromotionInput): Promise<BpmnDiagram> {
    const { diagram, target, actor, reason } = input;
    const version = diagram.version;

    const gates = await this.evaluateGates(input);
    const failing = gates.find((gate) => !gate.satisfied);
    if (failing) {
      throw new BpmnLifecycleError(failing.detail);
    }

    const snapshotHash = await computeDiagramHash(diagram);
    const promoted: BpmnVersion = {
      ...version,
      id: generateId(),
      status: target,
      parentVersionId: version.id,
      createdBy: actor.id,
      createdAt: nowIso(),
      snapshotHash,
      changeSummary: reason || version.changeSummary,
      ...(target === 'active' ? { effectiveFrom: nowIso() } : {}),
      ...(target === 'deprecated' || target === 'retired'
        ? { effectiveUntil: nowIso() }
        : {}),
    };
    return { ...diagram, version: promoted };
  }

  /**
   * Clones a diagram into a fresh editable draft (the only way to change an
   * active/deprecated/retired diagram). The clone starts a new version chained
   * to the source and bumps the semantic version.
   */
  async createDraftFrom(
    diagram: BpmnDiagram,
    actor: UserContext,
    options: { bump?: SemverBump; changeSummary?: string } = {},
  ): Promise<BpmnDiagram> {
    const snapshotHash = await computeDiagramHash(diagram);
    const draftVersion: BpmnVersion = {
      id: generateId(),
      semanticVersion: bumpSemver(diagram.version.semanticVersion, options.bump ?? 'minor'),
      status: 'draft',
      approvedBy: [],
      changeSummary: options.changeSummary ?? `Draft from ${diagram.version.semanticVersion}`,
      createdBy: actor.id,
      createdAt: nowIso(),
      snapshotHash,
      parentVersionId: diagram.version.id,
    };
    return {
      ...diagram,
      nodes: { ...diagram.nodes },
      edges: { ...diagram.edges },
      version: draftVersion,
    };
  }
}
