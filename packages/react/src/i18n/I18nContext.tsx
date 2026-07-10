import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { EN } from './en.js';
import { translate, type Messages, type TFunction } from './messages.js';

/**
 * i18n context (Handoff 11 N-6). The active `t` function is derived from the
 * dictionary the host injects at the top of the tree (`<BpmnDesigner messages>`
 * / `<StudioShell messages>`). English is always the fallback, so a component
 * rendered without a provider — or with a partial dictionary — still resolves
 * to English rather than crashing or leaking raw keys.
 */
const I18nContext = createContext<TFunction | null>(null);

/** Default `t`: pure English. Used when no `<I18nProvider>` is mounted. */
const DEFAULT_T: TFunction = (key, params) => translate(EN, EN, key, params);

export function I18nProvider({
  messages,
  children,
}: {
  /** Injected dictionary. Omitted → English. Missing keys fall back to English. */
  messages?: Messages;
  children: ReactNode;
}) {
  const t = useMemo<TFunction>(() => {
    const dict = messages ?? EN;
    return (key, params) => translate(dict, EN, key, params);
  }, [messages]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

/** The active translator. Falls back to English outside a provider. */
export function useT(): TFunction {
  return useContext(I18nContext) ?? DEFAULT_T;
}
