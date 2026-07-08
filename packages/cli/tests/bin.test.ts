import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { AuditLedger, createDiagram, createEdge, createNode, JsonSerializer } from '@bpmn-react/core';

/**
 * Exercises `bin.ts` — the actual script users invoke as `bpmn-react ...` —
 * as a real child process, so the argument parsing / exit-code contract
 * (untested by cli.test.ts, which only calls the library functions
 * bin.ts wires up) is proven end to end.
 *
 * Requires the package to be built first (`pnpm build`), matching the
 * documented workflow order in CONTRIBUTING.md.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_PATH = join(__dirname, '../dist/esm/bin.js');

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN_PATH, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-'));
  const diagram = createDiagram({ name: 'Bin flow', id: 'bin-flow' });
  const start = createNode({ type: 'startEvent', id: 'start' });
  const task = createNode({ type: 'task', id: 'task' });
  diagram.nodes = { start, task };
  diagram.edges = { e1: createEdge({ id: 'e1', sourceId: 'start', targetId: 'task' }) };
  const jsonPath = join(dir, 'flow.json');
  await writeFile(jsonPath, new JsonSerializer().serialize(diagram));
  return { dir, jsonPath };
}

beforeAll(() => {
  if (!existsSync(BIN_PATH)) {
    throw new Error(
      `${BIN_PATH} not found. Run "pnpm --filter @bpmn-react/cli build" (or "pnpm build") before running the CLI test suite.`,
    );
  }
});

describe('bin.ts — argument parsing and exit codes', () => {
  it('prints usage and exits 2 with no arguments', async () => {
    const { code, stderr } = await runCli([]);
    expect(code).toBe(2);
    expect(stderr).toContain('Usage:');
    expect(stderr).toContain('bpmn-react validate');
  });

  it('prints usage and exits 2 for an unknown command', async () => {
    const { code, stderr } = await runCli(['bogus']);
    expect(code).toBe(2);
    expect(stderr).toContain('Usage:');
  });

  it('validate: exits 0 and prints "No issues found" for a clean diagram', async () => {
    const { jsonPath } = await fixture();
    const { code, stdout, stderr } = await runCli(['validate', jsonPath]);
    expect(code).toBe(0);
    expect(stdout).toContain('No issues found');
    expect(stderr).toBe('');
  });

  it('validate: exits 1 and lists issues for a broken diagram', async () => {
    const { dir, jsonPath } = await fixture();
    const raw = JSON.parse(await readFile(jsonPath, 'utf8'));
    raw.edges.bad = { ...createEdge({ id: 'bad', sourceId: 'ghost', targetId: 'task' }) };
    const brokenPath = join(dir, 'broken.json');
    await writeFile(brokenPath, JSON.stringify(raw));

    const { code, stdout } = await runCli(['validate', brokenPath]);
    expect(code).toBe(1);
    expect(stdout).toContain('ORPHAN_EDGE');
  });

  it('validate: exits 2 with usage when no file is given', async () => {
    const { code, stderr } = await runCli(['validate']);
    expect(code).toBe(2);
    expect(stderr).toContain('Usage:');
  });

  it('validate: exits 2 with a readable error for a missing file', async () => {
    const { code, stderr } = await runCli(['validate', '/nonexistent/does-not-exist.json']);
    expect(code).toBe(2);
    expect(stderr).toContain('Error:');
  });

  it('export: converts JSON to BPMN XML on stdout', async () => {
    const { jsonPath } = await fixture();
    const { code, stdout } = await runCli(['export', jsonPath, '--to', 'xml']);
    expect(code).toBe(0);
    expect(stdout).toContain('<bpmn:definitions');
    expect(stdout).toContain('<bpmn:startEvent');
  });

  it('export: writes to disk with -o and reports the path (nothing else on stdout)', async () => {
    const { dir, jsonPath } = await fixture();
    const outPath = join(dir, 'out.bpmn.xml');
    const { code, stdout } = await runCli(['export', jsonPath, '--to', 'xml', '-o', outPath]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(`Written to ${outPath}`);
    expect(existsSync(outPath)).toBe(true);
    const written = await readFile(outPath, 'utf8');
    expect(written).toContain('<bpmn:definitions');
  });

  it('export: accepts --output as an alias for -o', async () => {
    const { dir, jsonPath } = await fixture();
    const outPath = join(dir, 'out2.json');
    const { code } = await runCli(['export', jsonPath, '--to', 'json', '--output', outPath]);
    expect(code).toBe(0);
    expect(existsSync(outPath)).toBe(true);
  });

  it('export: exits 2 usage when --to is missing or invalid', async () => {
    const { jsonPath } = await fixture();
    expect((await runCli(['export', jsonPath])).code).toBe(2);
    expect((await runCli(['export', jsonPath, '--to', 'yaml'])).code).toBe(2);
  });

  it('diff: exits 0 and prints "No changes." for identical files', async () => {
    const { jsonPath } = await fixture();
    const { code, stdout } = await runCli(['diff', jsonPath, jsonPath]);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe('No changes.');
  });

  it('diff: exits 1 and describes the change when files differ', async () => {
    const { dir, jsonPath } = await fixture();
    const raw = JSON.parse(await readFile(jsonPath, 'utf8'));
    raw.nodes.task.label = 'Renamed';
    const otherPath = join(dir, 'other.json');
    await writeFile(otherPath, JSON.stringify(raw));

    const { code, stdout } = await runCli(['diff', jsonPath, otherPath]);
    expect(code).toBe(1);
    expect(stdout).toContain('~ node task: label');
  });

  it('diff: exits 2 with usage when a file argument is missing', async () => {
    const { jsonPath } = await fixture();
    const { code, stderr } = await runCli(['diff', jsonPath]);
    expect(code).toBe(2);
    expect(stderr).toContain('Usage:');
  });
});

describe('bin.ts — registry & governance subcommands', () => {
  async function draft(dir: string, versionId: string, semver: string, status = 'draft') {
    const diagram = createDiagram({ name: 'Gov flow', id: 'gov' });
    diagram.version = {
      id: versionId,
      semanticVersion: semver,
      status: status as 'draft',
      approvedBy: [],
      changeSummary: `Release ${semver} — initial modelling of the flow`,
      createdBy: 'alice',
      createdAt: '2026-01-01T00:00:00.000Z',
      snapshotHash: '',
    };
    diagram.nodes = { n0: createNode({ type: 'task', id: 'n0' }) };
    const path = join(dir, `${versionId}.json`);
    await writeFile(path, new JsonSerializer().serialize(diagram));
    return path;
  }

  it('registry add + history round-trips through a file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-reg-'));
    const reg = join(dir, 'registry.json');
    const d1 = await draft(dir, 'v1', '1.0.0');

    const add = await runCli(['registry', 'add', d1, '--to', reg, '--notes', 'first cut']);
    expect(add.code).toBe(0);
    expect(add.stdout).toContain('Registered v1');
    expect(existsSync(reg)).toBe(true);

    const history = await runCli(['registry', 'history', reg]);
    expect(history.code).toBe(0);
    expect(history.stdout).toContain('1.0.0');
  });

  it('registry publish + active answer the channel timeline', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-pub-'));
    const reg = join(dir, 'registry.json');
    await runCli(['registry', 'add', await draft(dir, 'v1', '1.0.0'), '--to', reg]);

    const pub = await runCli([
      'registry', 'publish', reg,
      '--version', 'v1', '--channel', 'pilot', '--status', 'active',
      '--at', '2026-06-01T00:00:00.000Z',
    ]);
    expect(pub.code).toBe(0);
    expect(pub.stdout).toContain('Published v1 to pilot');

    const active = await runCli(['registry', 'active', reg, '--at', '2026-07-01T00:00:00.000Z', '--channel', 'pilot']);
    expect(active.code).toBe(0);
    expect(active.stdout).toContain('v1');

    const none = await runCli(['registry', 'active', reg, '--at', '2020-01-01T00:00:00.000Z', '--channel', 'pilot']);
    expect(none.code).toBe(1);
    expect(none.stdout).toContain('No version in effect');
  });

  it('registry with no/invalid subcommand exits 2', async () => {
    expect((await runCli(['registry'])).code).toBe(2);
    expect((await runCli(['registry', 'bogus', 'x'])).code).toBe(2);
  });

  it('promote advances the lifecycle and exits 0', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-promote-'));
    const d = await draft(dir, 'v0', '0.1.0');
    const res = await runCli([
      'promote', d, '--to', 'test',
      '--actor-id', 'u1', '--actor-role', 'owner', '--reason', 'Ready for sandbox testing.',
    ]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Promoted to test');
  });

  it('promote to active without approvals fails the governance gate with exit 1', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-gate-'));
    const d = await draft(dir, 'vc', '1.0.0', 'candidate');
    const res = await runCli([
      'promote', d, '--to', 'active',
      '--actor-id', 'ops', '--actor-role', 'operations', '--reason', 'trying to skip the gate here',
    ]);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('Governance gate');
  });

  it('approve then promote to active passes the gate (exit 0)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-approve-'));
    const d = await draft(dir, 'vc', '1.0.0', 'candidate');
    expect((await runCli(['approve', d, '--actor-id', 'o', '--actor-role', 'owner', '--reason', 'ok'])).code).toBe(0);
    expect((await runCli(['approve', d, '--actor-id', 'c', '--actor-role', 'compliance', '--reason', 'ok'])).code).toBe(0);
    const res = await runCli([
      'promote', d, '--to', 'active',
      '--actor-id', 'ops', '--actor-role', 'operations', '--reason', 'Approved by owner and compliance.',
    ]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Promoted to active');
  });
});

describe('bin: certify (Handoff 4 §A2)', () => {
  const corpus = join(__dirname, '../../conformance/corpus');
  const fixtures = join(__dirname, '../../conformance/tests/fixtures');

  it('certifies a descriptive corpus file (exit 0, human output)', async () => {
    const res = await runCli(['certify', join(corpus, '01-linear-approval-v1.bpmn')]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('XML bem-formado · XXE-safe');
    expect(res.stdout).toContain('Round-trip lossless');
    expect(res.stdout).toContain('Classe certificável: DESCRIPTIVE');
  });

  it('fails --require descriptive on an analytic file (exit 1) and passes --require analytic', async () => {
    const file = join(corpus, '16-boundary-events-v1.bpmn');
    expect((await runCli(['certify', file, '--require', 'descriptive'])).code).toBe(1);
    expect((await runCli(['certify', file, '--require', 'analytic'])).code).toBe(0);
  });

  it('returns exit 2 for malformed XML and DOCTYPE, exit 1 for structural violations with --require', async () => {
    expect((await runCli(['certify', join(fixtures, 'invalid-malformed.bpmn')])).code).toBe(2);
    const doctype = await runCli(['certify', join(fixtures, 'invalid-doctype.bpmn'), '--json']);
    expect(doctype.code).toBe(2);
    expect(JSON.parse(doctype.stdout).xxeSafe).toBe(false);
    expect(
      (await runCli(['certify', join(fixtures, 'invalid-structure.bpmn'), '--require', 'descriptive'])).code,
    ).toBe(1);
  });

  it('writes the JSON report with --report', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-certify-'));
    const out = join(dir, 'certify-report.json');
    const res = await runCli(['certify', join(corpus, '01-linear-approval-v1.bpmn'), '--report', out]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('relatório: ' + out);
    const report = JSON.parse(await readFile(out, 'utf8'));
    expect(report.achievedClass).toBe('descriptive');
  });

  it('--assurance-case renders the SACM report from the ledger (F-C3)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bpmnr-bin-sacm-'));
    const out = join(dir, 'assurance.html');
    const ledger = new AuditLedger();
    await ledger.append({ type: 'NODE_ADDED', userId: 'ana', versionId: 'v1', details: {} });
    await ledger.append({ type: 'VERSION_PROMOTED', userId: 'ana', versionId: 'v1', details: {} });
    await ledger.flush();
    const ledgerPath = join(dir, 'ledger.json');
    await writeFile(ledgerPath, JSON.stringify(ledger.export()));

    const res = await runCli([
      'certify',
      join(corpus, '01-linear-approval-v1.bpmn'),
      '--assurance-case',
      out,
      '--ledger',
      ledgerPath,
      '--sacm-version',
      'SACM 2.3',
    ]);
    // Corpus file carries real approvals + the ledger evidences commands:
    // every claim supported → exit 0.
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('cadeia íntegra');
    expect(res.stdout).toContain('todos os claims sustentados');
    const html = await readFile(out, 'utf8');
    expect(html).toContain('BTV CERTIFY · ASSURANCE CASE · SACM 2.3');
    expect(html).not.toContain('não sustentado');
    expect(html).toContain('data-chain-intact="true"');
    expect(html).not.toContain('prefers-color-scheme'); // §11.3

    // Without a ledger there is no command evidence: C2 unsupported →
    // exit 1 and the verdict lands in the report (10.5.8).
    const bare = await runCli([
      'certify',
      join(corpus, '01-linear-approval-v1.bpmn'),
      '--assurance-case',
      out,
    ]);
    expect(bare.code).toBe(1);
    expect(bare.stdout).toContain('NÃO sustentados');
    expect(await readFile(out, 'utf8')).toContain('não sustentado');
  });
});
