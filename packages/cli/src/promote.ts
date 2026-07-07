import { writeFile } from 'node:fs/promises';
import {
  computeDiff,
  JsonSerializer,
  LifecycleEngine,
  type BpmnDiagram,
  type VersionStatus,
} from '@bpmn-react/core';
import { loadDiagram } from './io.js';
import { loadRegistry, saveRegistry } from './registry.js';

export interface ActorOptions {
  actorId: string;
  actorRole: string;
  reason: string;
}

export interface PromoteOptions extends ActorOptions {
  to: VersionStatus;
  /** Write the resulting diagram here; overwrites the input when omitted. */
  output?: string;
  /** Also register the promoted version into this registry file. */
  registryPath?: string;
}

/**
 * Advances a diagram's lifecycle status through the {@link LifecycleEngine}
 * and writes the promoted diagram. The engine enforces the governance gate —
 * promotion to `active` requires the approvals/changelog already recorded on
 * the version — so this is the "process PR" check a pipeline runs.
 */
export async function promoteCommand(
  diagramPath: string,
  options: PromoteOptions,
): Promise<BpmnDiagram> {
  const { diagram } = await loadDiagram(diagramPath);
  const engine = new LifecycleEngine();
  const promoted = await engine.promote({
    diagram,
    target: options.to,
    actor: { id: options.actorId, role: options.actorRole },
    reason: options.reason,
    diff: computeDiff(diagram, diagram),
  });

  const serialized = new JsonSerializer().serialize(promoted);
  await writeFile(options.output ?? diagramPath, serialized + '\n', 'utf8');

  if (options.registryPath) {
    const registry = await loadRegistry(options.registryPath, { createIfMissing: true });
    await registry.register(promoted, { changeSummary: options.reason });
    await saveRegistry(options.registryPath, registry);
  }
  return promoted;
}

/** Records an approval on a diagram's current version and writes it back. */
export async function approveCommand(
  diagramPath: string,
  options: ActorOptions & { output?: string },
): Promise<BpmnDiagram> {
  const { diagram } = await loadDiagram(diagramPath);
  const engine = new LifecycleEngine();
  const approved = engine.approve(
    diagram,
    { id: options.actorId, role: options.actorRole },
    options.reason,
  );
  await writeFile(options.output ?? diagramPath, new JsonSerializer().serialize(approved) + '\n', 'utf8');
  return approved;
}
