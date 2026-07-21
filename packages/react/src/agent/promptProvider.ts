/**
 * Squad Lane SL-7 — the host-injected prompt provider. An agent node holds only
 * a `promptRef`; the prompt BODY lives in the Library btv:prompt artifact, never
 * on the `AgentWorkflow` (a body field there would be the "loose string" the
 * model avoids). The coverage validator resolves the text through this provider,
 * runs the headless `promptCoverage` against the workflow inputSchema, and
 * persists edits back to the ARTIFACT via `save` — not the agent node.
 *
 * Injected as an `AgentStudio` prop (the `ToolProvider`/`AIProvider` mold):
 * absent → no coverage validator; present but `resolve` returns undefined →
 * declared warning; no `save` → read-only textarea. Never silent.
 */
export interface PromptProvider {
  /** Resolve a `promptRef` (`prm:research@2.0.0`) to its body text, or undefined. */
  resolve(promptRef: string): string | undefined;
  /** Persist an edited prompt body to the Library artifact. Omit → read-only. */
  save?(promptRef: string, text: string): void;
}

/**
 * Builds a {@link PromptProvider} over an in-memory map of `promptRef → body`.
 * A host wires the real Library artifact behind the same interface; the optional
 * `onSave` receives every edit (and updates the map) so the demo/test round-trips.
 */
export function createPromptProvider(
  bodies: Record<string, string>,
  onSave?: (promptRef: string, text: string) => void,
): PromptProvider {
  const store: Record<string, string> = { ...bodies };
  return {
    resolve: (promptRef: string): string | undefined => store[promptRef],
    ...(onSave
      ? {
          save: (promptRef: string, text: string): void => {
            store[promptRef] = text;
            onSave(promptRef, text);
          },
        }
      : {}),
  };
}
