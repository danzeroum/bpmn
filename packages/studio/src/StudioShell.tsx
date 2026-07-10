import { useEffect, useState } from 'react';
import type { UserContext } from '@buildtovalue/core';
import { LibraryView, type LibraryViewProps } from '@buildtovalue/library-react';
import { ReviewScreen, type ReviewScreenProps } from './review/ReviewScreen.js';
import { LedgerExplorer, type LedgerExplorerProps } from './ledger/LedgerExplorer.js';

export type StudioScreen = 'biblioteca' | 'revisao' | 'auditoria';

const SCREENS: Array<{ id: StudioScreen; label: string }> = [
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'revisao', label: 'Revisão' },
  { id: 'auditoria', label: 'Auditoria' },
];

export interface StudioShellProps {
  user: UserContext;
  /** Wiring of the Biblioteca screen (LibraryView pass-through). */
  library: LibraryViewProps;
  /** Wiring of the Revisão screen; `actor` comes from `user`. */
  review: Omit<ReviewScreenProps, 'actor'>;
  /** Wiring of the Auditoria screen (Ledger Explorer, S-5). */
  audit?: LedgerExplorerProps;
  footer?: string;
}

function screenFromHash(): StudioScreen {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return SCREENS.some((s) => s.id === hash) ? (hash as StudioScreen) : 'biblioteca';
}

/**
 * The BuildToValue Studio shell (Handoff 6 §1/§2): header with the
 * three-screen nav, hash-based navigation — state + URL hash, no external
 * router (§11) — and the user identity. Studio é leitura + decisões de
 * governança; edição é o Designer. Auditoria chega na S-5.
 */
export function StudioShell({ user, library, review, audit, footer }: StudioShellProps) {
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
        <span className="btv-studio-brand">BuildToValue Studio</span>
        <span className="btv-studio-divider" aria-hidden />
        <nav className="btv-studio-nav" aria-label="Telas do Studio">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="btv-studio-nav-item"
              aria-current={screen === s.id ? 'page' : undefined}
              onClick={() => navigate(s.id)}
            >
              {s.label}
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
              <span className="btv-studio-kicker">AUDITORIA</span>
              <p className="btv-studio-muted">Ledger Explorer sem ledger conectado.</p>
            </section>
          ))}
      </main>

      <footer className="btv-studio-footer">
        {footer ?? 'BuildToValue Studio · leitura + decisões de governança — edição é o Designer'}
      </footer>
    </div>
  );
}
