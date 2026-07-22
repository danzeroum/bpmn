import type { BpmnDiagram } from '@buildtovalue/core';

/**
 * Squad Lane SL-12 — the BPMN bridge deep-link contract (§8-08, closes
 * pendências §1.2). The Designer gains an API to open an EXACT artifact version
 * by URL (`?load=<versionId>`) instead of only the demo diagram.
 *
 * The host owns the URL and history (as it already does for the Library's §10.7
 * back-restore): it reads `location.search`, resolves the versionId to a diagram
 * through its registry, and — on "voltar" — restores the viewport/selection it
 * saved. This module is the pure, injected glue: it parses the param and calls
 * the host's resolver, never touching `window`/`history` itself (testable, SSR-
 * safe, and the same degradable-resolver mold as `resolveTool`/`resolveVersion`).
 */

/** The query-string key for the deep-link. */
export const LOAD_PARAM = 'load';

/** Resolves a versionId to its diagram (injected; the host's registry lookup).
 * `undefined` → unresolved, so the caller falls back to the default diagram. */
export type VersionResolver = (versionId: string) => BpmnDiagram | undefined;

/** A resolved deep-link: the requested version and its diagram. */
export interface DeepLinkTarget {
  versionId: string;
  diagram: BpmnDiagram;
}

/**
 * Reads `?load=<versionId>` out of a query string (`location.search`, with or
 * without the leading `?`). Returns the versionId, or `undefined` when the param
 * is absent or empty. Pure.
 */
export function readLoadVersionId(search: string): string | undefined {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const value = params.get(LOAD_PARAM);
  return value !== null && value !== '' ? value : undefined;
}

/**
 * Resolves a deep-link end to end: parse `?load=`, then call the injected
 * resolver. Returns the target, or `undefined` when there is no param OR the
 * version does not resolve (degradable — the host opens its default diagram, and
 * the miss is the host's to surface; this never throws or guesses).
 */
export function resolveDeepLink(search: string, resolve: VersionResolver): DeepLinkTarget | undefined {
  const versionId = readLoadVersionId(search);
  if (versionId === undefined) return undefined;
  const diagram = resolve(versionId);
  return diagram !== undefined ? { versionId, diagram } : undefined;
}

/**
 * Builds a `?load=<versionId>` query string the host can push to history so a
 * double-click on an agentTask deep-links to the exact version. Extra params are
 * preserved/added (e.g. the Library filters the §10.7 back-restore reads).
 */
export function buildLoadSearch(versionId: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  params.set(LOAD_PARAM, versionId);
  return `?${params.toString()}`;
}
