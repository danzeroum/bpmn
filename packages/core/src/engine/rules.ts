import type { BpmnDiagram } from '../model/types.js';
import type { Command, CommandInterceptor, RuleVerdict } from '../commands/types.js';
import { isEventDefinitionRemoval } from '../commands/commands.js';
import { eventDefinitionUsages } from '../model/eventDefinitions.js';

/**
 * A rule evaluates a payload against the current diagram *before* the
 * operation happens (`*.pre` hooks) and may veto it with a reason.
 */
export type Rule<T = unknown> = (payload: T, diagram: BpmnDiagram) => RuleVerdict;

/** Payload for `edge.connect.pre`. */
export interface ConnectPayload {
  sourceId: string;
  targetId: string;
  edgeType?: string;
}

/**
 * Declarative pre-condition engine. Well-known hook events:
 * - `command.pre`     — payload: {@link Command}; vetoes any command
 * - `edge.connect.pre` — payload: {@link ConnectPayload}; vetoes a connection
 * - `node.remove.pre` — payload: `{ nodeId: string }`
 *
 * Also implements {@link CommandInterceptor} so it can be plugged straight
 * into a `CommandStack`.
 */
export class RuleEngine implements CommandInterceptor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry seam: payload types vary per event/tag and are narrowed at the call site
  private readonly rules = new Map<string, Rule<any>[]>();

  register<T = unknown>(event: string, rule: Rule<T>): () => void {
    const list = this.rules.get(event) ?? [];
    list.push(rule);
    this.rules.set(event, list);
    return () => {
      const current = this.rules.get(event);
      if (!current) return;
      const index = current.indexOf(rule);
      if (index >= 0) current.splice(index, 1);
    };
  }

  /** Returns the first negative verdict, or `{ allowed: true }`. */
  evaluate<T = unknown>(event: string, payload: T, diagram: BpmnDiagram): RuleVerdict {
    for (const rule of this.rules.get(event) ?? []) {
      const verdict = rule(payload, diagram);
      if (!verdict.allowed) return verdict;
    }
    return { allowed: true };
  }

  evaluateCommand(command: Command, diagram: BpmnDiagram): RuleVerdict {
    return this.evaluate('command.pre', command, diagram);
  }
}

const LOCKED_STATUSES = new Set(['active', 'deprecated', 'retired']);

/**
 * Registers the built-in governance rules:
 * - diagrams in a locked status (active/deprecated/retired) cannot be edited
 *   directly — clone to a new draft instead;
 * - a node cannot connect to itself.
 */
export function registerDefaultRules(engine: RuleEngine): void {
  engine.register('command.pre', (_command, diagram) => {
    if (LOCKED_STATUSES.has(diagram.version.status)) {
      return {
        allowed: false,
        reason: `Diagrams in status "${diagram.version.status}" are immutable — create a new draft to make changes`,
      };
    }
    return { allowed: true };
  });

  engine.register<ConnectPayload>('edge.connect.pre', (payload) => {
    if (payload.sourceId === payload.targetId) {
      return { allowed: false, reason: 'A node cannot connect to itself' };
    }
    return { allowed: true };
  });

  // Handoff 16 §3a: removing a REFERENCED named event definition is vetoed
  // with the honest usage list — deletion never cascades and never silently
  // orphans an event.
  engine.register<Command>('command.pre', (command, diagram) => {
    if (!isEventDefinitionRemoval(command)) return { allowed: true };
    const { kind, definitionId } = command.eventDefinitionRemoval;
    const usages = eventDefinitionUsages(diagram, kind, definitionId);
    if (usages.length === 0) return { allowed: true };
    const listing = usages.map((usage) => `${usage.label} (${usage.nodeId})`).join(', ');
    return {
      allowed: false,
      reason: `Definição em uso por ${usages.length} evento(s): ${listing} — troque a referência antes de excluir`,
    };
  });
}

/** Convenience: a RuleEngine with the default rules pre-registered. */
export function createDefaultRuleEngine(): RuleEngine {
  const engine = new RuleEngine();
  registerDefaultRules(engine);
  return engine;
}
