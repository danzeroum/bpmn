import { useEffect, useState } from 'react';
import type { UserContext } from '@buildtovalue/core';
import { useT, I18nProvider, type Messages } from '@buildtovalue/react';
import { LibraryView, type LibraryViewProps } from '@buildtovalue/library-react';
import { ReviewScreen, type ReviewScreenProps } from './review/ReviewScreen.js';
import { LedgerExplorer, type LedgerExplorerProps } from './ledger/LedgerExplorer.js';

export type StudioScreen = 'biblioteca' | 'revisao' | 'auditoria';

const SCREENS: StudioScreen[] = ['biblioteca', 'revisao', 'auditoria'];

export interface StudioShellProps {
  user: UserContext;
  /** Wiring of the Biblioteca screen (LibraryView pass-through). */
  library: LibraryViewProps;
  /** Wiring of the Revisão screen; `actor` comes from `user`. */
  review: Omit<ReviewScreenProps, 'actor'>;
  /** Wiring of the Auditoria screen (Ledger Explorer, S-5). */
  audit?: LedgerExplorerProps;
  footer?: string;
  /**
   * Injected UI dictionary (Handoff 11 N-6). Omitted → English. Missing keys
   * fall back to English; the host owns locale choice.
   */
  messages?: Messages;
}

function screenFromHash(): StudioScreen {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return SCREENS.some((s) => s === hash) ? (hash as StudioScreen) : 'biblioteca';
}

/**
 * The BuildToValue Studio shell (Handoff 6 §1/§2): header with the
 * three-screen nav, hash-based navigation — state + URL hash, no external
 * router (§11) — and the user identity. Studio é leitura + decisões de
 * governança; edição é o Designer. Auditoria chega na S-5.
 */
export function StudioShell({ messages, ...rest }: StudioShellProps) {
  return (
    <I18nProvider messages={messages}>
      <StudioShellBody {...rest} />
    </I18nProvider>
  );
}

function StudioShellBody({ user, library, review, audit, footer }: Omit<StudioShellProps, 'messages'>) {
  const t = useT();
  const [screen, setScreen] = useState<StudioScreen>(() => screenFromHash());

  useEffect(() => {
    const onHashChange = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: StudioScreen) => {
    window.location.hash = `#/${next}`;
    setScreen(next);
  };

  return (
    <div className="btv-studio" data-testid="studio-shell">
      <header className="btv-studio-header">
        <span className="btv-studio-logo" aria-hidden>
          B
        </span>
        <span className="btv-studio-brand">{t('studio.brand')}</span>
        <span className="btv-studio-divider" aria-hidden />
        <nav className="btv-studio-nav" aria-label={t('studio.nav.aria')}>
          {SCREENS.map((s) => (
            <button
              key={s}
              type="button"
              className="btv-studio-nav-item"
              aria-current={screen === s ? 'page' : undefined}
              onClick={() => navigate(s)}
            >
              {t(`studio.nav.${s}`)}
            </button>
          ))}
        </nav>
        <span className="btv-studio-spacer" />
        <span className="btv-studio-user">
          {user.name ?? user.id} · {user.role}
        </span>
      </header>

      <main className="btv-studio-main">
        {screen === 'biblioteca' && <LibraryView {...library} />}
        {screen === 'revisao' && <ReviewScreen {...review} actor={user} />}
        {screen === 'auditoria' &&
          (audit ? (
            <LedgerExplorer {...audit} />
          ) : (
            <section className="btv-studio-block">
              <span className="btv-studio-kicker">{t('studio.audit.kicker')}</span>
              <p className="btv-studio-muted">{t('studio.audit.noLedger')}</p>
            </section>
          ))}
      </main>

      <footer className="btv-studio-footer">{footer ?? t('studio.footer')}</footer>
    </div>
  );
}
