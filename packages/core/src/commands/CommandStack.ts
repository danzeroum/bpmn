import type { BpmnDiagram } from '../model/types.js';
import type { Command, CommandInterceptor, RuleVerdict } from './types.js';
import { EventBus } from '../events/EventBus.js';

export interface CommandStackOptions {
  bus?: EventBus;
  interceptor?: CommandInterceptor;
  /** Maximum number of commands kept for undo. Default 200. */
  limit?: number;
}

export interface CommandStackEvent {
  command: Command;
  diagram: BpmnDiagram;
}

/**
 * Owns the diagram state and the undo/redo history.
 *
 * Git-like cursor semantics: executing a new command after undos discards the
 * "future" (redoable) commands. Fires on the event bus:
 * `command.pre` (cancellable), `command.post`, `command.undone`,
 * `command.redone` and `stack.changed` (for autosave).
 */
export class CommandStack {
  readonly bus: EventBus;
  private readonly interceptor?: CommandInterceptor;
  private readonly limit: number;
  private stack: Command[] = [];
  private cursor = -1;
  private diagram: BpmnDiagram;
  private readonly changeListeners = new Set<(diagram: BpmnDiagram) => void>();

  constructor(initial: BpmnDiagram, options: CommandStackOptions = {}) {
    this.diagram = initial;
    this.bus = options.bus ?? new EventBus();
    this.interceptor = options.interceptor;
    this.limit = options.limit ?? 200;
  }

  get current(): BpmnDiagram {
    return this.diagram;
  }

  get canUndo(): boolean {
    return this.cursor >= 0;
  }

  get canRedo(): boolean {
    return this.cursor < this.stack.length - 1;
  }

  /** Replaces the diagram wholesale (e.g. after import) and clears history. */
  reset(diagram: BpmnDiagram): void {
    this.diagram = diagram;
    this.stack = [];
    this.cursor = -1;
    this.notifyChanged();
  }

  execute(command: Command): RuleVerdict {
    if (this.interceptor) {
      const verdict = this.interceptor.evaluateCommand(command, this.diagram);
      if (!verdict.allowed) return verdict;
    }
    const pre = this.bus.fire('command.pre', { command, diagram: this.diagram });
    if (pre.cancelled) return { allowed: false, reason: 'Cancelled by command.pre listener' };

    this.diagram = command.execute(this.diagram);
    // Discard the future, append, enforce the history limit.
    this.stack = this.stack.slice(0, this.cursor + 1);
    this.stack.push(command);
    if (this.stack.length > this.limit) this.stack.shift();
    this.cursor = this.stack.length - 1;

    this.bus.fire('command.post', { command, diagram: this.diagram });
    this.notifyChanged();
    return { allowed: true };
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const command = this.stack[this.cursor];
    this.diagram = command.undo(this.diagram);
    this.cursor--;
    this.bus.fire('command.undone', { command, diagram: this.diagram });
    this.notifyChanged();
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    const command = this.stack[this.cursor + 1];
    this.diagram = command.execute(this.diagram);
    this.cursor++;
    this.bus.fire('command.redone', { command, diagram: this.diagram });
    this.notifyChanged();
    return true;
  }

  /** Subscribes to every state change (execute/undo/redo/reset). */
  subscribe(listener: (diagram: BpmnDiagram) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChanged(): void {
    this.bus.fire('stack.changed', { diagram: this.diagram });
    for (const listener of this.changeListeners) listener(this.diagram);
  }
}
