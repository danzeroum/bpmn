import type { VersionRegistry } from '@buildtovalue/registry';
import { classifyDiagram } from './classify.js';
import {
  createRegistryAdapter,
  type RegistryAdapterOptions,
  type RegistryArtifactAdapter,
} from './registryAdapter.js';

/** Shared knobs for the concrete BuildToValue adapters. */
export type BtvAdapterOptions = Pick<RegistryAdapterOptions, 'target' | 'now' | 'boundRuns'>;

function kindAdapter(
  registry: VersionRegistry,
  id: string,
  typeLabel: string,
  kind: ReturnType<typeof classifyDiagram>,
  options: BtvAdapterOptions = {},
): RegistryArtifactAdapter {
  return createRegistryAdapter({
    ...options,
    id,
    typeLabel,
    registry,
    match: (diagram) => classifyDiagram(diagram) === kind,
  });
}

/** BPMN flows — every registered diagram not claimed by a specific kind. */
export function bpmnDiagramAdapter(
  registry: VersionRegistry,
  options?: BtvAdapterOptions,
): RegistryArtifactAdapter {
  return kindAdapter(registry, 'bpmn-diagram', 'FLUXO', 'flow', options);
}

export function personaAdapter(
  registry: VersionRegistry,
  options?: BtvAdapterOptions,
): RegistryArtifactAdapter {
  return kindAdapter(registry, 'btv-persona', 'PERSONA', 'persona', options);
}

export function promptAdapter(
  registry: VersionRegistry,
  options?: BtvAdapterOptions,
): RegistryArtifactAdapter {
  return kindAdapter(registry, 'btv-prompt', 'PROMPT', 'prompt', options);
}

export function connectorAdapter(
  registry: VersionRegistry,
  options?: BtvAdapterOptions,
): RegistryArtifactAdapter {
  return kindAdapter(registry, 'btv-connector', 'CONNECTOR', 'connector', options);
}

/**
 * "Política" maps to the BuildToValue Approval Gate (`btv:gate`) — the
 * closest existing concept; a dedicated policy node type is an open product
 * decision (pendencias.md, Handoff 6).
 */
export function policyAdapter(
  registry: VersionRegistry,
  options?: BtvAdapterOptions,
): RegistryArtifactAdapter {
  return kindAdapter(registry, 'btv-policy', 'POLÍTICA', 'policy', options);
}
