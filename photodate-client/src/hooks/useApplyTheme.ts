import { useEffect } from 'react';
import { useSessionStore } from '../state/useSessionStore';
import { applyTheme } from '../lib/applyTheme';
import { DEFAULT_THEME } from '../data/themes';

/**
 * Watches the session store's `themePack` and stamps the matching CSS
 * overrides onto :root + the body class for atmospheric effects.
 *
 * Mount this once at the App root level (inside <BrowserRouter> so it
 * has access to the store, but outside any page component).
 */
export function useApplyTheme(): void {
  const themePack = useSessionStore((s) => s.themePack);

  useEffect(() => {
    const id = themePack?.id ?? DEFAULT_THEME.id;
    applyTheme(id);

    // No cleanup: we intentionally keep the theme active as the user
    // navigates between pages. The next applyTheme call will swap it.
    return undefined;
  }, [themePack]);
}
