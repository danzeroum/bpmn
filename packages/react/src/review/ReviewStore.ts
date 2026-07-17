import { generateId, nowIso } from '@buildtovalue/core';

/**
 * ReviewStore — the host-injected comment contract (Handoff 15 §2c, V-4).
 * Same mold as `AIProvider`/`AnchorAdapter`/`EngineBridge`: the editor NEVER
 * persists review data — threads live wherever the host decides (its ledger,
 * its backend), reachable only through this contract. Without an injected
 * store the review surface simply does not exist (declared degradation,
 * cerca §1.5). Nothing here ever touches the BPMN model — review stays out
 * of the XML by construction (cerca §1.2).
 *
 * The contract is SYNCHRONOUS with a `subscribe` seam (registered decision):
 * `list()` must return a STABLE array identity until a mutation happens —
 * the UI reads it through `useSyncExternalStore`. Hosts with async backends
 * wrap this with an optimistic in-memory mirror (the reference
 * implementation below is exactly that mirror).
 */
export interface ReviewMessage {
  id: string;
  /** Author id — `ia.copilot@…` authors render the ✦ mixed-authorship seal. */
  author: string;
  text: string;
  /** ISO timestamp. */
  at: string;
  /** AI-drafted then human-committed (C4 discipline) — also renders ✦. */
  aiAssisted?: boolean;
}

export interface ReviewThread {
  id: string;
  /** The ANCHOR: element id, never x/y — pins follow moves/layout for free. */
  elementId: string;
  /** The version under review this thread belongs to. */
  versionRef: string;
  resolved: boolean;
  messages: ReviewMessage[];
}

export interface ReviewStore {
  /** Stable snapshot of every thread (open, resolved AND orphaned). */
  list(): readonly ReviewThread[];
  /** Opens a thread anchored to an element; returns it. */
  open(elementId: string, message: Pick<ReviewMessage, 'author' | 'text' | 'aiAssisted'>): ReviewThread;
  /** Appends a reply to a thread; returns the updated thread. */
  reply(threadId: string, message: Pick<ReviewMessage, 'author' | 'text' | 'aiAssisted'>): ReviewThread;
  /** Marks a thread resolved; returns the updated thread. */
  resolve(threadId: string): ReviewThread;
  /** Change notification (external edits, other reviewers). */
  subscribe?(cb: () => void): () => void;
}

/**
 * Reference in-memory implementation — the optimistic mirror a host wraps
 * around its real persistence, and the store the tests/demos use. Keeps
 * `list()` identity stable between mutations.
 */
export function createInMemoryReviewStore(
  versionRef: string,
  seed: readonly ReviewThread[] = [],
): ReviewStore {
  let threads: ReviewThread[] = [...seed];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((cb) => cb());
  const replace = (thread: ReviewThread) => {
    threads = threads.map((t) => (t.id === thread.id ? thread : t));
    notify();
  };
  return {
    list: () => threads,
    open(elementId, message) {
      const thread: ReviewThread = {
        id: generateId(),
        elementId,
        versionRef,
        resolved: false,
        messages: [{ id: generateId(), at: nowIso(), ...message }],
      };
      threads = [...threads, thread];
      notify();
      return thread;
    },
    reply(threadId, message) {
      const current = threads.find((t) => t.id === threadId);
      if (!current) throw new Error(`review thread "${threadId}" not found`);
      const next: ReviewThread = {
        ...current,
        messages: [...current.messages, { id: generateId(), at: nowIso(), ...message }],
      };
      replace(next);
      return next;
    },
    resolve(threadId) {
      const current = threads.find((t) => t.id === threadId);
      if (!current) throw new Error(`review thread "${threadId}" not found`);
      const next: ReviewThread = { ...current, resolved: true };
      replace(next);
      return next;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
