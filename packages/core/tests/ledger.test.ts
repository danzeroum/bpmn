import { describe, expect, it } from 'vitest';
import {
  addNodeCommand,
  AuditLedger,
  BpmnAuditError,
  CommandStack,
  computeEntryHash,
  createDiagram,
  createEdge,
  createNode,
  getEdgeChain,
  type AuditEntry,
} from '../src/index.js';

describe('AuditLedger', () => {
  it('appends hash-chained entries', async () => {
    const ledger = new AuditLedger();
    const e1 = await ledger.append({ type: 'A', userId: 'u', versionId: 'v' });
    const e2 = await ledger.append({ type: 'B', userId: 'u', versionId: 'v', details: { k: 1 } });
    expect(e1.seq).toBe(0);
    expect(e1.previousHash).toBe('');
    expect(e2.previousHash).toBe(e1.hash);
    expect(e1.hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await ledger.verify()).valid).toBe(true);
  });

  it('serializes concurrent appends into a consistent chain', async () => {
    const ledger = new AuditLedger();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ledger.append({ type: `T${i}`, userId: 'u', versionId: 'v' }),
      ),
    );
    const entries = ledger.getEntries();
    expect(entries).toHaveLength(10);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].previousHash).toBe(entries[i - 1].hash);
    }
    expect((await ledger.verify()).valid).toBe(true);
  });

  it('detects tampering with a middle entry', async () => {
    const ledger = new AuditLedger();
    await ledger.append({ type: 'A', userId: 'u', versionId: 'v' });
    await ledger.append({ type: 'B', userId: 'u', versionId: 'v' });
    await ledger.append({ type: 'C', userId: 'u', versionId: 'v' });

    const entries = ledger.getEntries() as AuditEntry[];
    (entries[1] as { userId: string }).userId = 'attacker';

    const verification = await ledger.verify();
    expect(verification.valid).toBe(false);
    expect(verification.brokenAt).toBe(1);
  });

  it('detects a re-hashed but unchained tamper', async () => {
    const ledger = new AuditLedger();
    await ledger.append({ type: 'A', userId: 'u', versionId: 'v' });
    await ledger.append({ type: 'B', userId: 'u', versionId: 'v' });
    const entries = ledger.getEntries() as AuditEntry[];
    // Attacker changes previousHash linkage
    (entries[1] as { previousHash: string }).previousHash = 'f'.repeat(64);
    expect((await ledger.verify()).valid).toBe(false);
  });

  it('export/import round-trips and rejects tampered imports', async () => {
    const ledger = new AuditLedger();
    await ledger.append({ type: 'A', userId: 'u', versionId: 'v' });
    await ledger.append({ type: 'B', userId: 'u', versionId: 'v' });
    const data = ledger.export();

    const restored = await AuditLedger.import(data);
    expect(restored.getEntries()).toHaveLength(2);

    const tampered = structuredClone(data);
    tampered.entries[0].type = 'HACKED';
    await expect(AuditLedger.import(tampered)).rejects.toThrow(BpmnAuditError);
  });

  it('writes to a sink when provided', async () => {
    const written: AuditEntry[] = [];
    const ledger = new AuditLedger({ sink: { write: (e) => void written.push(e) } });
    await ledger.append({ type: 'A', userId: 'u', versionId: 'v' });
    expect(written).toHaveLength(1);
  });

  it('queries by nodeId, edgeId and type', async () => {
    const ledger = new AuditLedger();
    await ledger.append({ type: 'NODE_ADDED', userId: 'u', versionId: 'v', details: { nodeId: 'n1' } });
    await ledger.append({ type: 'EDGE_CREATED', userId: 'u', versionId: 'v', details: { edgeId: 'e1' } });
    await ledger.append({
      type: 'EDGE_SUPERSEDED',
      userId: 'u',
      versionId: 'v',
      details: { oldEdgeId: 'e1', newEdgeId: 'e2' },
    });
    expect(ledger.query({ nodeId: 'n1' })).toHaveLength(1);
    expect(ledger.query({ edgeId: 'e1' })).toHaveLength(2);
    expect(ledger.query({ type: 'EDGE_CREATED' })).toHaveLength(1);
  });

  it('records command stack activity', async () => {
    const diagram = createDiagram({ name: 'T' });
    const stack = new CommandStack(diagram);
    const ledger = new AuditLedger();
    const off = ledger.connectCommandStack(stack, { id: 'alice', role: 'editor' });

    const node = createNode({ type: 'task' });
    stack.execute(addNodeCommand(node));
    stack.undo();
    stack.redo();
    await ledger.flush();

    const types = ledger.getEntries().map((e) => e.type);
    expect(types).toEqual(['NODE_ADDED', 'NODE_ADDED_UNDONE', 'NODE_ADDED_REDONE']);
    expect(ledger.getEntries()[0].userId).toBe('alice');
    expect((await ledger.verify()).valid).toBe(true);

    off();
    stack.undo();
    await ledger.flush();
    expect(ledger.getEntries()).toHaveLength(3);
  });
});

describe('getEdgeChain', () => {
  it('walks the supersession chain from any member', () => {
    const diagram = createDiagram({ name: 'T' });
    const e1 = createEdge({ id: 'e1', sourceId: 'a', targetId: 'b' });
    const e2 = createEdge({ id: 'e2', sourceId: 'a', targetId: 'c', supersedesEdgeId: 'e1' });
    const e3 = createEdge({ id: 'e3', sourceId: 'a', targetId: 'd', supersedesEdgeId: 'e2' });
    diagram.edges = { e1, e2, e3 };

    for (const startId of ['e1', 'e2', 'e3']) {
      const chain = getEdgeChain(diagram, startId);
      expect(chain.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    }
  });

  it('returns empty for unknown edges and single chains for standalone edges', () => {
    const diagram = createDiagram({ name: 'T' });
    expect(getEdgeChain(diagram, 'ghost')).toEqual([]);
    const e1 = createEdge({ id: 'e1', sourceId: 'a', targetId: 'b' });
    diagram.edges = { e1 };
    expect(getEdgeChain(diagram, 'e1').map((e) => e.id)).toEqual(['e1']);
  });
});

describe('hash recipe versioning (v1 legacy / v2 exact)', () => {
  it('new entries carry hashVersion 2 and verify', async () => {
    const ledger = new AuditLedger();
    const entry = await ledger.append({
      type: 'A',
      userId: 'u',
      versionId: 'v',
      details: { amount: 1.005 },
    });
    expect(entry.hashVersion).toBe(2);
    expect((await ledger.verify()).valid).toBe(true);
  });

  it('v2 hashes preserve full numeric precision', async () => {
    const base = {
      id: 'fixed',
      seq: 0,
      type: 'A',
      timestamp: '2026-01-01T00:00:00.000Z',
      userId: 'u',
      versionId: 'v',
      previousHash: '',
      hashVersion: 2 as const,
    };
    const a = await computeEntryHash({ ...base, details: { amount: 1.005 } });
    const b = await computeEntryHash({ ...base, details: { amount: 1.006 } });
    expect(a).not.toBe(b);
  });

  it('v2 hashes are not ambiguous across field boundaries', async () => {
    const base = {
      id: 'fixed',
      seq: 0,
      timestamp: '2026-01-01T00:00:00.000Z',
      versionId: 'v',
      previousHash: '',
      details: {},
      hashVersion: 2 as const,
    };
    const a = await computeEntryHash({ ...base, type: 'A|B', userId: 'C' });
    const b = await computeEntryHash({ ...base, type: 'A', userId: 'B|C' });
    expect(a).not.toBe(b);
  });

  it('imports and verifies a legacy v1 chain (no hashVersion field)', async () => {
    // A v1 chain captured with the legacy `|`-joined recipe: rebuild one here
    // by hashing without hashVersion, exactly as pre-v2 ledgers did.
    const first = {
      id: 'legacy-1',
      seq: 0,
      type: 'A',
      timestamp: '2025-01-01T00:00:00.000Z',
      userId: 'u',
      versionId: 'v',
      details: { k: 1 },
      previousHash: '',
    };
    const firstHash = await computeEntryHash(first);
    const second = {
      id: 'legacy-2',
      seq: 1,
      type: 'B',
      timestamp: '2025-01-01T00:00:01.000Z',
      userId: 'u',
      versionId: 'v',
      details: {},
      previousHash: firstHash,
    };
    const entries: AuditEntry[] = [
      { ...first, hash: firstHash },
      { ...second, hash: await computeEntryHash(second) },
    ];
    const ledger = await AuditLedger.import({ entries });
    expect((await ledger.verify()).valid).toBe(true);

    // Appending to an imported legacy chain produces v2 entries on top.
    const appended = await ledger.append({ type: 'C', userId: 'u', versionId: 'v' });
    expect(appended.hashVersion).toBe(2);
    expect((await ledger.verify()).valid).toBe(true);
  });

  it('rejects a tampered v2 entry', async () => {
    const ledger = new AuditLedger();
    await ledger.append({ type: 'A', userId: 'u', versionId: 'v', details: { amount: 1.005 } });
    const entries = ledger.export().entries;
    entries[0].details.amount = 1.006;
    await expect(AuditLedger.import({ entries })).rejects.toThrow(BpmnAuditError);
  });
});
