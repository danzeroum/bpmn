import type { BpmnDiagram } from '../model/types.js';

/**
 * A command is a reversible, pure transformation of the diagram.
 * `execute`/`undo` must not mutate their input — they return new diagram
 * objects with structural sharing (spread only what changed).
 */
export interface Command {
  id: string;
  description: string;
  execute(diagram: BpmnDiagram): BpmnDiagram;
  undo(diagram: BpmnDiagram): BpmnDiagram;
  /** Optional structured payload for the audit ledger. */
  toAuditEvent?(): { type: string; details: Record<string, unknown> };
}

export interface RuleVerdict {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluated before a command executes; a negative verdict vetoes it.
 * Implemented by the RuleEngine, kept as an interface here so the command
 * layer has no dependency on the engine layer.
 */
export interface CommandInterceptor {
  evaluateCommand(command: Command, diagram: BpmnDiagram): RuleVerdict;
}
