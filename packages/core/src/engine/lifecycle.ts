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
  candidate: ['active', 'test'],
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
   * Promotes the diagram's version to `target`. Throws {@link BpmnLifecycleError}
   * on invalid transitions or unmet requirements.
   */
  async promote(input: PromotionInput): Promise<BpmnDiagram> {
    const { diagram, target, actor, reason } = input;
    const version = diagram.version;

    if (!this.canTransition(version.status, target)) {
      throw new BpmnLifecycleError(
        `Invalid transition: ${version.status} → ${target}. Allowed: ${
          this.allowedTargets(version.status).join(', ') || '(none)'
        }`,
      );
    }

    if (target === 'active') {
      const roles = new Set(version.approvedBy.map((a) => a.role));
      if (roles.size < this.minApprovalRoles) {
        throw new BpmnLifecycleError(
          `Promotion to active requires approvals from at least ${this.minApprovalRoles} distinct roles (got ${roles.size})`,
        );
      }
      if (version.changeSummary.trim().length < this.minChangeSummaryLength) {
        throw new BpmnLifecycleError(
          `Promotion to active requires a change summary of at least ${this.minChangeSummaryLength} characters`,
        );
      }
      if (this.requireDiff && input.diff === undefined) {
        throw new BpmnLifecycleError('Promotion to active requires an attached diff');
      }
    }

    for (const rule of this.promotionRules) {
      const verdict = await rule(input);
      if (!verdict.allowed) {
        throw new BpmnLifecycleError(verdict.reason ?? 'Promotion vetoed by rule');
      }
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
