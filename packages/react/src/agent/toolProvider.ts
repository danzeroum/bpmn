import type { AgentRef, ResolveTool, ToolContract } from '@buildtovalue/agentflow';

/**
 * Squad Lane SL-2 (Handoff 22) — the host-injected tool provider. It IMPLEMENTS
 * the headless `ResolveTool` seam defined in `@buildtovalue/agentflow` (types
 * flow down react → agentflow) and adds an optional `list()` that powers the
 * inspector's selector/autocomplete. Injected as a prop on `AgentStudio`
 * (the `AIProvider`/H9 mold): absent → the binding degrades to a typed text
 * field, present-but-unresolvable → a declared `TOOL_UNRESOLVED` warning, never
 * silence (cerca §2.4).
 */
export interface ToolProvider {
  /** Resolve a `tool:*@semver` ref to its contract (or `undefined`). */
  resolve: ResolveTool;
  /** The bindable catalog, for the inspector selector. Omit → free-text only. */
  list?(): readonly ToolContract[];
}

/**
 * Builds a {@link ToolProvider} over a contract list (exact `id@version` match).
 * The host wires the SAME list into the Biblioteca via `toolAdapter` so the
 * catalog and the binding never disagree (one registry, not two).
 */
export function createToolProvider(contracts: readonly ToolContract[]): ToolProvider {
  return {
    resolve: (ref: AgentRef): ToolContract | undefined =>
      contracts.find((c) => c.id === ref.id && c.version === ref.version),
    list: () => contracts,
  };
}
