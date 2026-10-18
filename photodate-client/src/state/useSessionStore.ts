import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ── Types ────────────────────────────────────────────────────

export interface PlacedSticker {
  id: string;
  stickerId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface DrawStroke {
  id: string;
  color: string;
  thickness: number;
  points: { x: number; y: number }[];
}

/** A theme pack controls the overall visual mood of the strip */
export interface ThemePack {
  id: string;
  name: string;
  /** CSS gradient or solid color for the strip background */
  backgroundCss: string;
  /** Accent color token for UI highlights within this theme */
  accentColor: string;
  /** Optional overlay image URL (bokeh, grain, etc.) */
  overlayUrl?: string;
}

/** Strip layout: how captured frames are arranged */
export type LayoutId =
  | "2x1" // 2 frames stacked vertically
  | "2x2" // 2 × 2 grid (group mode)
  | "3x1" // 3 frames stacked vertically
  | "4x1" // classic 4-strip
  | "6x1"
  | "3x2"
  | "wide-1" // single wide panoramic
  | "collage"; // free-form collage

/** Design preset applies a frame background and filter to the strip */
export interface DesignPreset {
  id: string;
  name: string;
  /** Background color, gradient, or CSS background string for the strip */
  background: string;
  /** CSS filter string applied to captured frames */
  filterCss?: string;
  /** Border style/color for the strip frame */
  borderStyle?: string;
  edgeStyle?: "square" | "rounded" | "arch" | "ticket" | "postage";
}

/** Timer mode for the capture countdown (seconds) */
export type TimerMode = number;

export interface SessionState {
  /** Selected theme pack, null = not chosen yet */
  themePack: ThemePack | null;
  /** Selected layout, null = not chosen yet */
  layoutId: LayoutId;
  /** Selected design preset, null = not chosen yet */
  designPreset: DesignPreset | null;
  /** Active filter id for the strip */
  filterId: string;
  /** Photos assigned to layout slots by the user */
  assignedPhotos: string[];
  /** Stickers placed by the user on the decorate step */
  placedStickers: PlacedSticker[];
  /** Freehand drawing strokes */
  drawStrokes: DrawStroke[];
  /** The title of the strip, defaults to today's date */
  stripTitle: string;
  titlePosition: { x: number; y: number; auto?: boolean };
  /** Session-specific custom designs uploaded by the user */
  customDesigns: DesignPreset[];
  /** Countdown duration before each capture */
  timerMode: TimerMode;
  /** Total number of shots to take (derived from layoutId) */
  shotCount: number;
  /**
   * Group photobooth mode: 4 participants with a 2×2 layout.
   * When enabled, maxParticipants → 4 and layoutId defaults to '2x2'.
   */
  isGroupMode: boolean;
  /** Whether to show the PhotoDate watermark on the strip */
  showWatermark: boolean;
}

interface SessionActions {
  setTitlePosition: (position: {
    x: number;
    y: number;
    auto?: boolean;
  }) => void;
  setThemePack: (theme: ThemePack) => void;
  setLayoutId: (id: LayoutId) => void;
  setDesignPreset: (preset: DesignPreset) => void;
  setFilterId: (id: string) => void;
  setAssignedPhotos: (photos: string[]) => void;
  addSticker: (sticker: PlacedSticker) => void;
  updateSticker: (id: string, updates: Partial<PlacedSticker>) => void;
  removeSticker: (id: string) => void;
  addDrawStroke: (stroke: DrawStroke) => void;
  updateCurrentStroke: (point: { x: number; y: number }) => void;
  clearDrawStrokes: () => void;
  setStripTitle: (title: string) => void;
  addCustomDesign: (preset: DesignPreset) => void;
  setTimerMode: (mode: TimerMode) => void;
  setGroupMode: (on: boolean) => void;
  setShowWatermark: (show: boolean) => void;
  reset: () => void;
}

export type SessionStore = SessionState & SessionActions;

// ── Initial state ────────────────────────────────────────────

const initialState: SessionState = {
  themePack: null,
  layoutId: "4x1",
  designPreset: null,
  filterId: "original",
  assignedPhotos: [],
  placedStickers: [],
  drawStrokes: [],
  titlePosition: { x: 50, y: 90, auto: true },
  stripTitle: new Date().toLocaleDateString("en-CA").replace(/-/g, "."), // YYYY.MM.DD
  customDesigns: [],
  timerMode: 3,
  shotCount: 4,
  isGroupMode: false,
  showWatermark: true,
};

// ── Helpers ──────────────────────────────────────────────────

function shotCountFromLayout(id: LayoutId): number {
  const map: Record<LayoutId, number> = {
    "2x1": 2,
    "2x2": 4,
    "3x1": 3,
    "4x1": 4,
    "6x1": 6,
    "3x2": 6,
    "wide-1": 1,
    collage: 6,
  };
  return map[id] ?? 4;
}

// ── Store ─────────────────────────────────────────────────────

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      ...initialState,

      setThemePack: (themePack) => set({ themePack }),

      setLayoutId: (layoutId) =>
        set({ layoutId, shotCount: shotCountFromLayout(layoutId) }),

      setDesignPreset: (designPreset) => set({ designPreset }),

      setFilterId: (filterId) => set({ filterId }),

      setAssignedPhotos: (assignedPhotos) => set({ assignedPhotos }),

      addSticker: (sticker) =>
        set((s) => ({ placedStickers: [...s.placedStickers, sticker] })),

      updateSticker: (id, updates) =>
        set((s) => ({
          placedStickers: s.placedStickers.map((st) =>
            st.id === id ? { ...st, ...updates } : st,
          ),
        })),

      removeSticker: (id) =>
        set((s) => ({
          placedStickers: s.placedStickers.filter((st) => st.id !== id),
        })),

      addDrawStroke: (stroke) =>
        set((s) => ({ drawStrokes: [...s.drawStrokes, stroke] })),

      updateCurrentStroke: (point) =>
        set((s) => {
          if (s.drawStrokes.length === 0) return s;
          const strokes = [...s.drawStrokes];
          const current = strokes[strokes.length - 1];
          strokes[strokes.length - 1] = {
            ...current,
            points: [...current.points, point],
          };
          return { drawStrokes: strokes };
        }),

      clearDrawStrokes: () => set({ drawStrokes: [] }),

      setStripTitle: (stripTitle) => set({ stripTitle }),
      setTitlePosition: (titlePosition) => set({ titlePosition }),

      addCustomDesign: (design) =>
        set((s) => ({
          customDesigns: [...s.customDesigns, design],
          // Automatically select it upon upload
          designPreset: design,
        })),

      setTimerMode: (timerMode) => set({ timerMode }),

      setGroupMode: (on) =>
        set((s) => ({
          isGroupMode: on,
          // Auto-switch layout when toggling group mode
          layoutId: on ? "2x2" : s.layoutId === "2x2" ? "4x1" : s.layoutId,
          shotCount: on ? 4 : s.layoutId === "2x2" ? 4 : s.shotCount,
        })),

      setShowWatermark: (show) => set({ showWatermark: show }),

      reset: () => set(initialState),
    }),
    {
      name: "photodate-session-store",
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return sessionStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            sessionStorage.setItem(key, value);
          } catch {
            /* Room snapshot restores transient state. */
          }
        },
        removeItem: (key) => {
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* unavailable */
          }
        },
      })),
      partialize: (s) => ({
        themePack: s.themePack,
        layoutId: s.layoutId,
        timerMode: s.timerMode,
        shotCount: s.shotCount,
        isGroupMode: s.isGroupMode,
      }),
    },
  ),
);
