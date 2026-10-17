import { THEMES } from "../data/themes";

/**
 * Complete list of CSS custom properties that themes are allowed to override.
 * Used to cleanly reset overrides when switching to a theme with fewer vars.
 */
const THEME_VARS = [
  "--c-bg",
  "--c-surface-1",
  "--c-surface-2",
  "--c-surface-3",
  "--c-border",
  "--c-border-soft",
  "--c-text-hi",
  "--c-text-md",
  "--c-text-lo",
  "--c-accent",
  "--c-accent-dim",
  "--c-accent-glow",
  "--c-accent-soft",
  "--c-accent-border",
  "--c-success",
  "--c-warning",
  "--c-error",
  "--font-ui",
  "--font-mono",
] as const;

/** All known body theme classes — cleared before applying a new one */
const BODY_CLASSES = THEMES.map((t) => t.bodyClass).filter(Boolean);

/**
 * Apply a theme's CSS overrides to :root and its body class to <body>.
 * Existing overrides not present in the new theme are removed so the CSS
 * default values (from index.css) take effect again.
 */
export function applyTheme(themeId: string): void {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const root = document.documentElement;

  // 1. Reset every overrideable var (removes previous theme's inline values)
  THEME_VARS.forEach((v) => root.style.removeProperty(v));

  // 2. Stamp new overrides
  Object.entries(theme.cssOverrides).forEach(([k, v]) => {
    root.style.setProperty(k, v);
  });

  // 3. Swap body class for atmospheric effects (grain, glow, etc.)
  document.body.classList.remove(...BODY_CLASSES);
  if (theme.bodyClass) {
    document.body.classList.add(theme.bodyClass);
  }
}

/** Remove all theme overrides and revert to CSS defaults */
export function resetTheme(): void {
  const root = document.documentElement;
  THEME_VARS.forEach((v) => root.style.removeProperty(v));
  document.body.classList.remove(...BODY_CLASSES);
}
