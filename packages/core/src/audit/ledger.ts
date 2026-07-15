import type { BpmnDiagram, BpmnEdge } from '../model/types.js';
import type { UserContext } from '../model/types.js';
import { BpmnAuditError } from '../model/errors.js';
import { generateId, nowIso } from '../model/factory.js';
import { canonicalJson, canonicalJsonExact, sha256Hex } from '../persistence/hash.js';
import type { CommandStack } from '../commands/CommandStack.js';
import type { Command } from '../commands/types.js';

export interface AuditEntry {
  id: string;
  /** Position in the chain, starting at 0. */
  seq: number;
  type: string;
  timestamp: string;
  userId: string;
  versionId: string;
  details: Record<string, unknown>;
  previousHash: string;
  hash: string;
  /**
   * Hash-recipe version. `2` = exact canonical JSON over the whole entry
   * (no numeric rounding, no delimiter ambiguity). Absent = legacy v1
   * (`|`-joined fields with rounded `details`), kept verifiable forever.
   */
  hashVersion?: 2;
}

export interface AuditEntryInput {
  type: string;
  userId: string;
  versionId: string;
  details?: Record<string, unknown>;
}

export interface LedgerVerification {
  valid: boolean;
  /** Sequence number of the first broken entry, when invalid. */
  brokenAt?: number;
}

/** Optional external persistence for ledger entries (database, API, file…). */
export interface AuditSink {
  write(entry: AuditEntry): void | Promise<void>;
}

/**
 * The chain's hash recipe — exported so external verifiers (e.g.
 * `@buildtovalue/audit`'s `verifyLedger`) recompute entries against the exact
 * same bytes the ledger signed. The recipe is versioned per entry via
 * {@link AuditEntry.hashVersion}: new entries use v2 (exact canonical JSON of
 * the whole entry — no numeric rounding, no delimiter ambiguity); entries
 * without the field verify against the legacy v1 recipe, so chains written
 * before v2 remain valid forever.
 */
export async function computeEntryHash(entry: Omit<AuditEntry, 'hash'>): Promise<string> {
  if (entry.hashVersion === 2) {
    return sha256Hex(
      canonicalJsonExact({
        hashVersion: 2,
        previousHash: entry.previousHash,
        id: entry.id,
        seq: entry.seq,
        type: entry.type,
        timestamp: entry.timestamp,
        userId: entry.userId,
        versionId: entry.versionId,
        details: entry.details,
      }),
    );
  }
  return sha256Hex(
    [
      entry.previousHash,
      entry.id,
      String(entry.seq),
      entry.type,
      entry.timestamp,
      entry.userId,
      entry.versionId,
      canonicalJson(entry.details),
    ].join('|'),
  );
}

const entryHash = computeEntryHash;

/**
 * Append-only audit ledger with SHA-256 hash chaining: each entry's hash
 * covers the previous entry's hash, so any retroactive tampering breaks the
 * chain and is detected by {@link AuditLedger.verify}.
 */
export class AuditLedger {
  private entries: AuditEntry[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private readonly sink?: AuditSink;

  constructor(options: { sink?: AuditSink } = {}) {
    this.sink = options.sink;
  }

  /**
   * Appends an entry. Appends are serialized internally so concurrent calls
   * always produce a consistent chain.
   */
  append(input: AuditEntryInput): Promise<AuditEntry> {
    const result = this.queue.then(async () => {
      const previous = this.entries[this.entries.length - 1];
      const base = {
        id: generateId(),
        seq: this.entries.length,
        type: input.type,
        timestamp: nowIso(),
        userId: input.userId,
        versionId: input.versionId,
        details: input.details ?? {},
        previousHash: previous?.hash ?? '',
        hashVersion: 2 as const,
      };
      const entry: AuditEntry = { ...base, hash: await entryHash(base) };
      this.entries.push(entry);
      if (this.sink) await this.sink.write(entry);
      return entry;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Recomputes every hash in the chain and reports the first break. */
  async verify(): Promise<LedgerVerification> {
    let previousHash = '';
    for (const entry of this.entries) {
      if (entry.previousHash !== previousHash) {
        return { valid: false, brokenAt: entry.seq };
      }
      const expected = await entryHash({ ...entry });
      if (expected !== entry.hash) {
        return { valid: false, brokenAt: entry.seq };
      }
      previousHash = entry.hash;
    }
    return { valid: true };
  }

  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  /** Filters entries by element id (matched inside `details`) and/or type. */
  query(filter: { nodeId?: string; edgeId?: string; type?: string }): AuditEntry[] {
    return this.entries.filter((entry) => {
      if (filter.type && entry.type !== filter.type) return false;
      if (filter.nodeId && entry.details.nodeId !== filter.nodeId) return false;
      if (filter.edgeId) {
        const d = entry.details;
        if (
          d.edgeId !== filter.edgeId &&
          d.oldEdgeId !== filter.edgeId &&
          d.newEdgeId !== filter.edgeId
        ) {
          return false;
        }
      }
      return true;
    });
  }

  export(): { entries: AuditEntry[] } {
    return { entries: [...this.entries] };
  }

  /**
   * Restores a ledger from exported data. Throws {@link BpmnAuditError} if
   * the imported chain does not verify.
   */
  static async import(data: { entries: AuditEntry[] }, options: { sink?: AuditSink } = {}) {
    const ledger = new AuditLedger(options);
    ledger.entries = [...data.entries];
    const verification = await ledger.verify();
    if (!verification.valid) {
      throw new BpmnAuditError(
        `Imported ledger failed verification at entry ${verification.brokenAt}`,
      );
    }
    return ledger;
  }

  /**
   * Records every command executed/undone/redone on a stack. Returns an
   * unsubscribe function.
   */
  connectCommandStack(stack: CommandStack, user: UserContext): () => void {
    const record = (suffix: string) => (payload: unknown) => {
      const { command, diagram } = payload as { command: Command; diagram: BpmnDiagram };
      const audit = command.toAuditEvent?.() ?? { type: 'COMMAND', details: {} };
      void this.append({
        type: suffix ? `${audit.type}_${suffix}` : audit.type,
        userId: user.id,
        versionId: diagram.version.id,
        details: { ...audit.details, description: command.description },
      });
    };
    // Low priority so transforming listeners have settled first.
    const offs = [
      stack.bus.on('command.post', record(''), -100),
      stack.bus.on('command.undone', record('UNDONE'), -100),
      stack.bus.on('command.redone', record('REDONE'), -100),
    ];
    return () => offs.forEach((off) => off());
  }

  /** Waits until every queued append has been written. */
  async flush(): Promise<void> {
    await this.queue;
  }
}

/**
 * Walks the supersession chain containing `edgeId`, oldest first.
 * Follows `supersedesEdgeId` backwards and scans forward for replacements.
 */
export function getEdgeChain(diagram: BpmnDiagram, edgeId: string): BpmnEdge[] {
  const chain: BpmnEdge[] = [];
  let current = diagram.edges[edgeId];
  if (!current) return chain;

  // Walk back to the chain root.
  const visited = new Set<string>();
  while (current.supersedesEdgeId && diagram.edges[current.supersedesEdgeId]) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    current = diagram.edges[current.supersedesEdgeId];
  }

  // Walk forward collecting replacements.
  const byPredecessor = new Map<string, BpmnEdge>();
  for (const edge of Object.values(diagram.edges)) {
    if (edge.supersedesEdgeId) byPredecessor.set(edge.supersedesEdgeId, edge);
  }
  let cursor: BpmnEdge | undefined = current;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.push(cursor);
    cursor = byPredecessor.get(cursor.id);
  }
  return chain;
}
