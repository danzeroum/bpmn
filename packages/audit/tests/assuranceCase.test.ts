import { describe, expect, it } from 'vitest';
import {
  addNodeCommand,
  AuditLedger,
  CommandStack,
  createDiagram,
  createNode,
  type BpmnDiagram,
} from '@buildtovalue/core';
import {
  buildAssuranceCase,
  EVIDENCE_COLLAPSE_THRESHOLD,
  renderAssuranceCaseHtml,
  SACM_SPEC_VERSION,
  type AssuranceCase,
} from '../src/index.js';

async function governedFixture(commands = 3): Promise<{
  diagram: BpmnDiagram;
  ledger: AuditLedger;
}> {
  const diagram = createDiagram({ name: 'Faturamento', id: 'billing' });
  diagram.version = {
    ...diagram.version,
    semanticVersion: '1.2.0',
    status: 'active',
    approvedBy: [
      { userId: 'ana', role: 'operacao', approvedAt: '2026-07-01T10:00:00Z', reason: 'ok para ativar' },
      { userId: 'bruno', role: 'compliance', approvedAt: '2026-07-01T11:00:00Z', reason: 'auditoria ok' },
    ],
  };
  const ledger = new AuditLedger();
  const stack = new CommandStack(diagram);
  ledger.connectCommandStack(stack, { id: 'ana', role: 'editor' });
  for (let i = 0; i < commands; i++) {
    stack.execute(addNodeCommand(createNode({ type: 'task', id: `t${i}`, label: `Task ${i}` })));
  }
  await ledger.append({
    type: 'VERSION_PROMOTED',
    userId: 'ana',
    versionId: diagram.version.id,
    details: { to: 'active' },
  });
  await ledger.flush();
  return { diagram, ledger };
}

describe('buildAssuranceCase (aceite 10.5.8 — 100% derivado do ledger)', () => {
  it('derives claims, arguments and hashed evidence from governance records only', async () => {
    const { diagram, ledger } = await governedFixture();
    const assurance = await buildAssuranceCase(diagram, ledger, {
      generatedAt: '2026-07-08T12:00:00Z',
    });

    expect(assurance.spec).toBe(SACM_SPEC_VERSION);
    expect(assurance.diagramName).toBe('Faturamento');
    expect(assurance.semanticVersion).toBe('1.2.0');
    expect(assurance.claims.map((claim) => claim.id)).toEqual(['C1', 'C2']);
    expect(assurance.claims.every((claim) => claim.supported)).toBe(true);

    // A1 = approvals (hashed canonically) + promotion entries.
    const a1 = assurance.arguments.find((argument) => argument.id === 'A1')!;
    expect(a1.evidence.length).toBe(3); // 2 approvals + VERSION_PROMOTED
    for (const item of a1.evidence) expect(item.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a1.evidence[0].kind).toBe('aprovação · operacao');
    expect(a1.evidence[2].kind).toBe('VERSION_PROMOTED');

    // A2 = command entries with their own chain hashes.
    const a2 = assurance.arguments.find((argument) => argument.id === 'A2')!;
    expect(a2.evidence.length).toBe(3);
    expect(a2.evidence.map((item) => item.kind)).toEqual([
      'NODE_ADDED',
      'NODE_ADDED',
      'NODE_ADDED',
    ]);

    // SHA-256 verification ran at generation and the head is anchored.
    expect(assurance.verification.intact).toBe(true);
    expect(assurance.verification.entries).toBe(4);
    expect(assurance.ledgerHeadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(assurance.generatedAt).toBe('2026-07-08T12:00:00Z');
  });

  it('adds argument A3 / claim C3 for a registered simulation session (7A-3)', async () => {
    const { diagram, ledger } = await governedFixture();
    await ledger.append({
      type: 'SIMULATION_SESSION',
      userId: 'ana',
      versionId: diagram.version.id,
      details: { artifactId: 'billing', covered: 2, total: 3, roteiroHash: 'abcd1234ef01' },
    });
    await ledger.flush();

    const assurance = await buildAssuranceCase(diagram, ledger, { generatedAt: '2026-07-08T12:00:00Z' });

    expect(assurance.claims.map((c) => c.id)).toEqual(['C1', 'C2', 'C3']);
    const a3 = assurance.arguments.find((a) => a.id === 'A3')!;
    expect(a3.evidence).toHaveLength(1);
    // Caption is DERIVED from the entry details, never typed.
    expect(a3.evidence[0].kind).toBe('comportamento validado · 2/3 caminhos · roteiro #abcd1234ef01');
    expect(a3.evidence[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(assurance.claims.find((c) => c.id === 'C3')!.supported).toBe(true);

    // The session must NOT leak into A2 (commands) — it has its own argument.
    const a2 = assurance.arguments.find((a) => a.id === 'A2')!;
    expect(a2.evidence.some((e) => e.kind.includes('validado'))).toBe(false);
    expect(a2.evidence.some((e) => e.kind === 'SIMULATION_SESSION')).toBe(false);
  });

  it('marks claims without evidence as unsupported (never invents support)', async () => {
    const diagram = createDiagram({ name: 'Sem governança' });
    const assurance = await buildAssuranceCase(diagram, { entries: [] });
    expect(assurance.claims.map((claim) => claim.supported)).toEqual([false, false]);
    expect(assurance.ledgerHeadHash).toBe('');
    expect(assurance.verification.entries).toBe(0);
  });

  it('parameterizes the spec label (§11.4) instead of hardcoding it', async () => {
    const diagram = createDiagram({ name: 'X' });
    const assurance = await buildAssuranceCase(diagram, { entries: [] }, { specVersion: 'SACM 9.9' });
    expect(assurance.spec).toBe('SACM 9.9');
  });

  it('accepts the plain { entries } shape of an exported ledger file', async () => {
    const { diagram, ledger } = await governedFixture(1);
    const assurance = await buildAssuranceCase(diagram, ledger.export());
    expect(assurance.verification.intact).toBe(true);
    expect(assurance.claims.every((claim) => claim.supported)).toBe(true);
  });
});

describe('renderAssuranceCaseHtml (print-ready, §11.2/§11.3/§11.4)', () => {
  async function render(mutate?: (assurance: AssuranceCase) => void): Promise<string> {
    const { diagram, ledger } = await governedFixture();
    const assurance = await buildAssuranceCase(diagram, ledger, {
      generatedAt: '2026-07-08T12:00:00Z',
    });
    mutate?.(assurance);
    return renderAssuranceCaseHtml(assurance);
  }

  it('renders the certify sub-brand: gold rule, kicker and parameterized spec label', async () => {
    const html = await render();
    expect(html).toContain('class="gold-rule"');
    expect(html).toContain(`BTV CERTIFY · ASSURANCE CASE · ${SACM_SPEC_VERSION}`);
    // §11.4: the label flows from the case, never from the renderer.
    const custom = await render((assurance) => {
      assurance.spec = 'SACM 9.9';
    });
    expect(custom).toContain('BTV CERTIFY · ASSURANCE CASE · SACM 9.9');
    expect(custom).not.toContain(`ASSURANCE CASE · ${SACM_SPEC_VERSION}`);
  });

  it('uses the canonical SACM notation with the family tokens', async () => {
    const html = await render();
    expect(html).toContain('--btv-sacm-claim');
    expect(html).toContain('--btv-sacm-argument');
    expect(html).toContain('--btv-sacm-evidence');
    expect(html).toContain('skewX(-12deg)'); // parallelogram argument
    expect(html).toContain('border-radius: 50%'); // evidence circle
    expect(html).toContain('dashed'); // inferred relations
    expect(html).toMatch(/class="sacm-evidence"[^>]*>#[0-9a-f]{7}</); // hash inside the circle
  });

  it('keeps the paper base with NO dark mode (§11.3 — declared exception)', async () => {
    const html = await render();
    expect(html).toContain('color-scheme: only light');
    expect(html).toContain('#faf9f6');
    expect(html).not.toContain('prefers-color-scheme');
  });

  it('renders "não sustentado" in --btv-error for unsupported claims (10.5.8)', async () => {
    const html = await render((assurance) => {
      assurance.claims[0] = { ...assurance.claims[0], supported: false };
    });
    expect(html).toContain('não sustentado');
    expect(html).toMatch(/class="verdict"/);
    expect(html).toContain('--btv-error');
    const supported = await render();
    expect(supported).not.toContain('não sustentado');
  });

  it('groups evidence by argument with subtotals and a repeating table header (§11.2)', async () => {
    const html = await render();
    expect(html).toContain('data-argument="A1"');
    expect(html).toContain('data-argument="A2"');
    expect(html).toContain('subtotal A1: 3 evidências');
    expect(html).toContain('subtotal A2: 3 evidências');
    // Native <thead> per group table = header repeats on print page breaks.
    expect((html.match(/<thead>/g) ?? []).length).toBe(2);
  });

  it('collapses >20 evidence rows into a hash range and moves them to the annex (§11.2)', async () => {
    const { diagram, ledger } = await governedFixture(EVIDENCE_COLLAPSE_THRESHOLD + 5);
    const assurance = await buildAssuranceCase(diagram, ledger);
    const html = renderAssuranceCaseHtml(assurance);
    expect(html).toContain('data-collapsed="true"');
    expect(html).toMatch(/25 evidências · faixa de hashes #[0-9a-f]{7}…#[0-9a-f]{7}/);
    expect(html).toContain('data-annex');
    expect(html).toContain('Anexo · evidências completas');
    // The annex carries the full table (its own repeating header).
    expect((html.match(/<thead>/g) ?? []).length).toBe(2); // A1 inline + annex A2
  });

  it('prints the audit footer on every page: chain result, dates, approvers, page n/N', async () => {
    const html = await render();
    expect(html).toContain('data-audit-footer');
    expect(html).toContain('data-chain-intact="true"');
    expect(html).toMatch(/cadeia SHA-256 íntegra · 4 entradas · head #[0-9a-f]{7}/);
    expect(html).toContain('gerado 2026-07-08T12:00:00Z');
    // Approvers now carry a signature-state glyph (◌ legacy without a resolver).
    expect(html).toContain('◌ ana (operacao) · ◌ bruno (compliance)');
    expect(html).toContain('position: fixed'); // prints on every page
    expect(html).toContain("counter(page) '/' counter(pages)"); // página n/N
  });

  it('reports a broken chain in the footer instead of hiding it', async () => {
    const { diagram, ledger } = await governedFixture(1);
    const tampered = ledger.export();
    tampered.entries[0] = { ...tampered.entries[0], details: { forged: true } };
    const assurance = await buildAssuranceCase(diagram, tampered);
    expect(assurance.verification.intact).toBe(false);
    const html = renderAssuranceCaseHtml(assurance);
    expect(html).toContain('data-chain-intact="false"');
    expect(html).toContain('cadeia SHA-256 QUEBRADA');
  });

  it('escapes derived strings so records cannot inject markup', async () => {
    const html = await render((assurance) => {
      assurance.diagramName = 'Fatura <script>alert(1)</script>';
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('Fatura &lt;script&gt;');
  });
});
