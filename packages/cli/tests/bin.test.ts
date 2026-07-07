import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDiagram, createEdge, createNode, JsonSerializer } from '@bpmn-react/core';

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
