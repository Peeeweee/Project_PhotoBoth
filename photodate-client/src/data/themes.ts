import type { ThemePack } from '../state/useSessionStore';

// ── Extended theme definition (includes UI display props) ─────────────────────

export interface ThemeDefinition extends ThemePack {
  subtitle: string;
  description: string;
  /** CSS for the mini preview swatch */
  previewBg: string;
  /** Emoji / symbol icon representing the theme */
  icon: string;
  /** Foreground color used in the preview strip */
  previewFg: string;
  /**
   * CSS custom property overrides applied to :root when this theme is active.
   * All keys must be existing design tokens defined in index.css.
   * An empty object means "use the default values".
   */
  cssOverrides: Record<string, string>;
  /**
   * CSS class added to <body> for atmospheric effects (grain, glow, etc.)
   * Matching rules live in index.css under "Theme skins".
   */
  bodyClass: string;
  /**
   * Radial glow color used in the Layout background gradient.
   * Falls back to var(--c-accent-glow) if not provided.
   */
  bgGlowRgba: string;
}

// ── Theme catalog ─────────────────────────────────────────────────────────────

export const THEMES: ThemeDefinition[] = [
  // ── Classic ──────────────────────────────────────────────────────────────────
  {
    id: 'classic',
    name: 'Classic',
    subtitle: 'Clean & timeless',
    description: 'Crisp black-and-white frames with a minimal white border — the original photo booth experience.',
    backgroundCss: '#ffffff',
    accentColor: '#111111',
    icon: '◻',
    previewBg: 'linear-gradient(160deg, #f8f8f8 0%, #e2e2e2 100%)',
    previewFg: '#111111',
    bodyClass: 'theme-classic',
    bgGlowRgba: 'rgba(224, 66, 124, 0.08)',
    // Classic = the design system defaults, nothing to override
    cssOverrides: {},
  },

  // ── Vintage ───────────────────────────────────────────────────────────────────
  {
    id: 'vintage',
    name: 'Vintage',
    subtitle: '1930s photo automat',
    description: 'Sepia-toned frames with a warm grain overlay, inspired by the golden age of coin-operated photo booths.',
    backgroundCss: 'linear-gradient(180deg, #f5deb3 0%, #d2a679 100%)',
    accentColor: '#7c4f2a',
    icon: '◈',
    previewBg: 'linear-gradient(160deg, #c9a86c 0%, #7c4f2a 100%)',
    previewFg: '#fff8e7',
    bodyClass: 'theme-vintage',
    bgGlowRgba: 'rgba(196, 131, 42, 0.10)',
    cssOverrides: {
      // Surfaces — warm dark sepia
      '--c-bg':          '#0d0900',
      '--c-surface-1':   '#1a1208',
      '--c-surface-2':   '#22180a',
      '--c-surface-3':   '#2e2010',
      '--c-border':      '#3e2e14',
      '--c-border-soft': '#261d0b',

      // Text — warm ivory to amber
      '--c-text-hi':  '#f5e6c0',
      '--c-text-md':  '#c0a070',
      '--c-text-lo':  '#7a5c35',

      // Accent — burnished amber gold
      '--c-accent':        '#c88a30',
      '--c-accent-dim':    '#a06920',
      '--c-accent-glow':   'rgba(200, 138, 48, 0.22)',
      '--c-accent-soft':   'rgba(200, 138, 48, 0.10)',
      '--c-accent-border': 'rgba(200, 138, 48, 0.35)',

      // Status
      '--c-success': '#7ab87a',
      '--c-warning': '#e0a030',
      '--c-error':   '#d06060',

      // Typography — serif UI font for that printed-paper feel
      '--font-ui': "'Playfair Display', Georgia, 'Times New Roman', serif",
    },
  },

  // ── Meme ─────────────────────────────────────────────────────────────────────
  {
    id: 'meme',
    name: 'Meme',
    subtitle: 'Recreate the classics',
    description: 'Bold colours, sticker overlays, and over-the-top captions. Because why not.',
    backgroundCss: 'linear-gradient(135deg, #ff6b6b 0%, #ffd93d 50%, #6bcb77 100%)',
    accentColor: '#ff3b30',
    icon: '★',
    previewBg: 'linear-gradient(160deg, #ff6b6b 0%, #ffd93d 60%, #6bcb77 100%)',
    previewFg: '#1a1a1a',
    bodyClass: 'theme-meme',
    bgGlowRgba: 'rgba(255, 48, 96, 0.08)',
    cssOverrides: {
      // Surfaces — deep electric indigo-black
      '--c-bg':          '#060409',
      '--c-surface-1':   '#0e0a16',
      '--c-surface-2':   '#160f22',
      '--c-surface-3':   '#201630',
      '--c-border':      '#2e2248',
      '--c-border-soft': '#1a1330',

      // Text — cool violet-white
      '--c-text-hi':  '#f5f0ff',
      '--c-text-md':  '#b098d8',
      '--c-text-lo':  '#60507a',

      // Accent — electric hot-pink (slightly more saturated than classic rose)
      '--c-accent':        '#ff2060',
      '--c-accent-dim':    '#cc1850',
      '--c-accent-glow':   'rgba(255, 32, 96, 0.24)',
      '--c-accent-soft':   'rgba(255, 32, 96, 0.11)',
      '--c-accent-border': 'rgba(255, 32, 96, 0.36)',

      // Status
      '--c-success': '#30e0a0',
      '--c-warning': '#ffd040',
      '--c-error':   '#ff5555',

      // Typography — Inter stays, the colors do the heavy lifting
      '--font-ui': "'Inter', system-ui, -apple-system, sans-serif",
    },
  },
];

export const DEFAULT_THEME = THEMES[0];
