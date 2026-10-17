/**
 * stripLayouts.ts
 *
 * Defines all available photo-strip layout configurations.
 *
 * Coordinate model
 * ────────────────
 * Layouts use a CSS-grid-compatible slot model:
 *   - `columns` × `rows` defines the grid template
 *   - Each `SlotDef` uses 0-based `col` / `row` with optional spans
 *   - `gapFraction` and `paddingFraction` are expressed as a fraction of the
 *     strip's total rendered width so a renderer can scale to any pixel size
 *
 * Aspect ratios
 * ─────────────
 * All aspect ratios are expressed as `width / height`:
 *   - > 1  →  landscape
 *   - = 1  →  square
 *   - < 1  →  portrait
 *
 * The `stripAspectRatio` is pre-computed analytically for each layout so the
 * renderer doesn't need to recalculate it. Formula used:
 *
 *   usableW = 1 - 2 × paddingFraction
 *   frameW  = (usableW - (columns - 1) × gapFraction) / columns
 *   frameH  = frameW / frameAspectRatio
 *   totalH  = rows × frameH + (rows - 1) × gapFraction + 2 × paddingFraction
 *   stripAR = 1 / totalH          (strip width is normalised to 1)
 */

import type { LayoutId } from '../state/useSessionStore';

// ── Types ────────────────────────────────────────────────────────────────────

/** A single capture slot within the strip grid */
export interface SlotDef {
  /** 0-based capture order index */
  index: number;
  /** 0-based grid column start */
  col: number;
  /** 0-based grid row start */
  row: number;
  /** Number of columns this slot spans (default 1) */
  colSpan: number;
  /** Number of rows this slot spans (default 1) */
  rowSpan: number;
}

/** Complete layout configuration for a photo strip */
export interface StripLayout {
  /** Must match a valid LayoutId from useSessionStore */
  id: LayoutId;
  /** Human-readable name shown in the layout picker */
  name: string;
  /** Short grid notation label, e.g. "1 × 4" */
  label: string;
  /** One-line description of the layout's mood/use case */
  description: string;
  /** Total number of photo captures needed to fill this layout */
  slotCount: number;
  /** Number of columns in the CSS grid */
  columns: number;
  /** Number of rows in the CSS grid */
  rows: number;
  /**
   * Aspect ratio of the entire output strip (width ÷ height).
   * Pre-computed — see module doc for the formula.
   */
  stripAspectRatio: number;
  /**
   * Aspect ratio of each individual photo frame (width ÷ height).
   * All frames in a layout share the same ratio.
   * 0.75 = 3:4 portrait | 1.0 = square | 1.333 = 4:3 landscape
   */
  frameAspectRatio: number;
  /** Gap between adjacent slots, as a fraction of the strip's total width */
  gapFraction: number;
  /** Uniform inset padding on all four sides, as a fraction of strip width */
  paddingFraction: number;
  /** Custom bottom padding fraction. Defaults to paddingFraction if not specified */
  bottomPaddingFraction?: number;
  /** Ordered slot definitions — index matches capture sequence */
  slots: SlotDef[];
  /**
   * Whether this layout is currently selectable in the picker UI.
   * Set to false for planned layouts that are not yet implemented.
   */
  available: boolean;
}

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Pre-compute the strip aspect ratio from layout geometry.
 * Exported so tests and future layouts can reuse it.
 */
export function computeStripAspectRatio(
  columns: number,
  rows: number,
  frameAspectRatio: number,
  gapFraction: number,
  paddingFraction: number,
  bottomPaddingFraction?: number,
): number {
  const bottomPad = bottomPaddingFraction ?? paddingFraction;
  const usableWidth = 1 - 2 * paddingFraction;
  const frameWidth  = (usableWidth - (columns - 1) * gapFraction) / columns;
  const frameHeight = frameWidth / frameAspectRatio;
  const totalHeight =
    rows * frameHeight +
    (rows - 1) * gapFraction +
    paddingFraction + bottomPad;
  return 1 / totalHeight;
}

/** Build a dense (no spans) rectangular grid of slots in row-major order */
function denseGrid(columns: number, rows: number): SlotDef[] {
  const slots: SlotDef[] = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      slots.push({ index: index++, col, row, colSpan: 1, rowSpan: 1 });
    }
  }
  return slots;
}

// ── Layout catalog ────────────────────────────────────────────────────────────

export const STRIP_LAYOUTS: StripLayout[] = [
  // ─── 1 × 4 — Classic single-column strip ─────────────────────────────────
  //
  // The quintessential photo-booth strip: 4 landscape frames stacked vertically.
  //
  // Geometry (width normalised to 1):
  //   usableW = 0.88  frameW = 0.88  frameH = 0.88 / 1.333 = 0.66
  //   totalH  = 4 × 0.66 + 3 × 0.04 + 2 × 0.06 = 2.64 + 0.12 + 0.12 = 2.88 → stripAR ≈ 0.347
  {
    id:               '4x1',
    name:             'Classic Strip',
    label:            '1 × 4',
    description:      '4 landscape frames in a single column — the timeless photo-booth format.',
    slotCount:        4,
    columns:          1,
    rows:             4,
    frameAspectRatio: 1.778,         // 16:9 landscape
    gapFraction:      0.04,
    paddingFraction:  0.06,
    bottomPaddingFraction: 0.16,
    stripAspectRatio: computeStripAspectRatio(1, 4, 1.778, 0.04, 0.06, 0.16),
    slots:            denseGrid(1, 4),
    available:        true,
  },

  // ─── 2 × 2 — Group grid ───────────────────────────────────────────────────
  //
  // Square-ish layout for 4-person groups. Each slot is square.
  //
  // Geometry:
  //   usableW = 0.90  frameW = (0.90 - 0.04) / 2 = 0.43  frameH = 0.43
  //   totalH  = 2 × 0.43 + 1 × 0.04 + 2 × 0.05 = 1.00 → stripAR = 1.0
  {
    id:               '2x2',
    name:             'Group Grid',
    label:            '2 × 2',
    description:      '4 landscape frames in a 2-column grid — perfect for groups of four.',
    slotCount:        4,
    columns:          2,
    rows:             2,
    frameAspectRatio: 1.778,           // 16:9 landscape
    gapFraction:      0.04,
    paddingFraction:  0.05,
    bottomPaddingFraction: 0.15,
    stripAspectRatio: computeStripAspectRatio(2, 2, 1.778, 0.04, 0.05, 0.15),
    slots:            denseGrid(2, 2),
    available:        true,
  },

  // ─── 1 × 3 — Short strip (planned) ───────────────────────────────────────
  {
    id:               '3x1',
    name:             'Short Strip',
    label:            '1 × 3',
    description:      '3 portrait frames in a single column — a quicker session.',
    slotCount:        3,
    columns:          1,
    rows:             3,
    frameAspectRatio: 0.75,
    gapFraction:      0.04,
    paddingFraction:  0.06,
    bottomPaddingFraction: 0.16,
    stripAspectRatio: computeStripAspectRatio(1, 3, 0.75, 0.04, 0.06, 0.16),
    slots:            denseGrid(1, 3),
    available:        false,         // planned
  },

  // ─── 1 × 2 — Duo (planned) ───────────────────────────────────────────────
  {
    id:               '2x1',
    name:             'Duo',
    label:            '1 × 2',
    description:      '2 portrait frames side by side — quick and intimate.',
    slotCount:        2,
    columns:          1,
    rows:             2,
    frameAspectRatio: 0.75,
    gapFraction:      0.05,
    paddingFraction:  0.08,
    bottomPaddingFraction: 0.18,
    stripAspectRatio: computeStripAspectRatio(1, 2, 0.75, 0.05, 0.08, 0.18),
    slots:            denseGrid(1, 2),
    available:        false,         // planned
  },

  // ─── 1 × 6 — Long roll (planned) ─────────────────────────────────────────
  //
  // Will use LayoutId '4x1' once the store enum is extended to include '6x1'.
  // Represented here as a separate entry using the closest existing id.
  // TODO: add '6x1' to LayoutId when this layout ships.
  {
    id:               '4x1',         // placeholder until '6x1' is added to LayoutId
    name:             'Long Roll',
    label:            '1 × 6',
    description:      '6 portrait frames in a single column — the full memory roll.',
    slotCount:        6,
    columns:          1,
    rows:             6,
    frameAspectRatio: 0.75,
    gapFraction:      0.03,
    paddingFraction:  0.05,
    bottomPaddingFraction: 0.15,
    stripAspectRatio: computeStripAspectRatio(1, 6, 0.75, 0.03, 0.05, 0.15),
    slots:            denseGrid(1, 6),
    available:        false,         // planned — requires new LayoutId '6x1'
  },

  // ─── 3 × 2 — Wide grid (planned) ─────────────────────────────────────────
  //
  // TODO: add '3x2' to LayoutId when this layout ships.
  {
    id:               '2x2',         // placeholder until '3x2' is added to LayoutId
    name:             'Wide Grid',
    label:            '3 × 2',
    description:      '6 landscape frames in a 3-column grid — cinematic and wide.',
    slotCount:        6,
    columns:          3,
    rows:             2,
    frameAspectRatio: 1.333,         // 4:3 landscape
    gapFraction:      0.03,
    paddingFraction:  0.05,
    bottomPaddingFraction: 0.15,
    stripAspectRatio: computeStripAspectRatio(3, 2, 1.333, 0.03, 0.05, 0.15),
    slots:            denseGrid(3, 2),
    available:        false,         // planned — requires new LayoutId '3x2'
  },
];

// ── Convenience lookups ───────────────────────────────────────────────────────

/** All layouts currently available in the picker UI */
export const AVAILABLE_LAYOUTS = STRIP_LAYOUTS.filter((l) => l.available);

/**
 * Find the canonical layout for a given LayoutId.
 * When multiple entries share an id (planned stubs), returns the first
 * `available` one, or the first entry as a fallback.
 */
export function getLayout(id: LayoutId): StripLayout {
  return (
    STRIP_LAYOUTS.find((l) => l.id === id && l.available) ??
    STRIP_LAYOUTS.find((l) => l.id === id) ??
    STRIP_LAYOUTS[0]
  );
}

/** Default layout used when none is selected */
export const DEFAULT_LAYOUT = STRIP_LAYOUTS[0]; // Classic Strip 1×4
