export interface FilterPreset {
  id: string;
  name: string;
  /** CSS filter string to apply to the image element or canvas context */
  cssFilter: string;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'original',
    name: 'Original',
    cssFilter: 'none',
  },
  {
    id: 'mono',
    name: 'Mono',
    cssFilter: 'grayscale(100%)',
  },
  {
    id: 'retro',
    name: 'Retro',
    cssFilter: 'sepia(80%) contrast(110%) brightness(105%)',
  },
  {
    id: 'film',
    name: 'Film',
    cssFilter: 'contrast(90%) saturate(80%) brightness(110%)',
  },
  {
    id: 'cool',
    name: 'Cool',
    // Shifts colors slightly towards blue/cyan, boosts saturation
    cssFilter: 'hue-rotate(15deg) saturate(120%) brightness(105%)',
  },
  {
    id: 'peach',
    name: 'Peach',
    // Warm, saturated, slightly shifted towards pink/orange
    cssFilter: 'sepia(30%) saturate(130%) hue-rotate(-10deg)',
  },
  {
    id: 'automat',
    name: 'Automat',
    // Faded, high contrast, slightly desaturated (like an old photobooth)
    cssFilter: 'grayscale(50%) contrast(120%) sepia(20%) brightness(95%)',
  },
];
