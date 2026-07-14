import { readFile, writeFile } from 'node:fs/promises';
import {
  bindRun,
  RegistryError,
  VersionRegistry,
  type ExportedRegistry,
  type Publication,
  type RegistryEntry,
  type RunBinding,
} from '@buildtovalue/registry';
import { formatDiff, loadDiagram } from './io.js';

/**
 * Loads a registry from a JSON file (an exported registry). With
 * `createIfMissing`, a nonexistent file yields a fresh empty registry so
 * `registry add` can bootstrap one.
 */
export async function loadRegistry(
  path: string,
  options: { createIfMissing?: boolean } = {},
): Promise<VersionRegistry> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (options.createIfMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new VersionRegistry();
    }
    throw error;
  }
  const data = JSON.parse(raw) as ExportedRegistry;
  return VersionRegistry.import(data);
}

export async function saveRegistry(path: string, registry: VersionRegistry): Promise<void> {
  await writeFile(path, JSON.stringify(registry.export(), null, 2) + '\n', 'utf8');
}

/** Registers a diagram's current version into a registry file (created if absent). */
export async function registryAddCommand(
  diagramPath: string,
  registryPath: string,
  options: { technicalNotes?: string } = {},
): Promise<RegistryEntry> {
  const registry = await loadRegistry(registryPath, { createIfMissing: true });
  const { diagram } = await loadDiagram(diagramPath);
  const entry = await registry.register(diagram, {
    ...(options.technicalNotes !== undefined ? { technicalNotes: options.technicalNotes } : {}),
  });
  await saveRegistry(registryPath, registry);
  return entry;
}

export async function registryHistoryCommand(registryPath: string): Promise<RegistryEntry[]> {
  return (await loadRegistry(registryPath)).history();
}

export async function registryPublishCommand(
  registryPath: string,
  options: {
    versionId: string;
    channel: string;
    environment?: string;
    status?: RegistryEntry['version']['status'];
    effectiveFrom?: string;
    publishedBy?: string;
  },
): Promise<Publication> {
  const registry = await loadRegistry(registryPath);
  const publication = await registry.publish(options.versionId, {
    channel: options.channel,
    ...(options.environment !== undefined ? { environment: options.environment } : {}),
    ...(options.status !== undefined ? { status: options.status } : {}),
    ...(options.effectiveFrom !== undefined ? { effectiveFrom: options.effectiveFrom } : {}),
    ...(options.publishedBy !== undefined ? { publishedBy: options.publishedBy } : {}),
  });
  await saveRegistry(registryPath, registry);
  return publication;
}

export async function registryActiveCommand(
  registryPath: string,
  options: { at: string; channel?: string; environment?: string },
): Promise<RegistryEntry | undefined> {
  const registry = await loadRegistry(registryPath);
  const target = options.channel
    ? { channel: options.channel, ...(options.environment !== undefined ? { environment: options.environment } : {}) }
    : undefined;
  return registry.activeAt(options.at, target);
}

export async function registryDiffCommand(
  registryPath: string,
  fromVersionId: string,
  toVersionId: string,
): Promise<string> {
  const registry = await loadRegistry(registryPath);
  return formatDiff(registry.diffBetween(fromVersionId, toVersionId));
}

/** Pins a run to a registered version, returning the immutable binding. */
export async function registryBindRunCommand(
  registryPath: string,
  options: { versionId: string; channel?: string; environment?: string; runId?: string },
): Promise<RunBinding> {
  const registry = await loadRegistry(registryPath);
  const entry = registry.get(options.versionId);
  if (!entry) throw new RegistryError(`Unknown version: ${options.versionId}`);
  return bindRun(entry, {
    ...(options.runId !== undefined ? { runId: options.runId } : {}),
    ...(options.channel !== undefined ? { channel: options.channel } : {}),
    ...(options.environment !== undefined ? { environment: options.environment } : {}),
  });
}

export function formatHistory(entries: RegistryEntry[]): string {
  if (entries.length === 0) return 'No versions registered.';
  return entries
    .map((entry) => {
      const v = entry.version;
      const lanes = entry.publications
        .filter((p) => p.effectiveUntil === undefined)
        .map((p) => `${p.channel}${p.environment ? `/${p.environment}` : ''}:${p.status}`)
        .join(', ');
      const head = `${v.semanticVersion.padEnd(8)} ${v.status.padEnd(10)} ${v.id.slice(0, 8)}`;
      const summary = v.changeSummary ? ` — ${v.changeSummary}` : '';
      return head + summary + (lanes ? `  [live: ${lanes}]` : '');
    })
    .join('\n');
}

export function formatEntry(entry: RegistryEntry): string {
  const v = entry.version;
  return `${v.id}  v${v.semanticVersion}  ${v.status}  (snapshot ${entry.snapshotHash.slice(0, 12)}…)`;
}
