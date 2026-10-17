import type { DesignPreset } from '../state/useSessionStore';

export interface DesignPack {
  id: string;
  name: string;
  subtitle: string;
  designs: DesignPreset[];
}

export const DESIGN_PACKS: DesignPack[] = [
  {
    id: 'simple',
    name: 'Simple',
    subtitle: 'Classic solid colors',
    designs: [
      { id: 'solid-white', name: 'Clean White', background: '#ffffff' },
      { id: 'solid-black', name: 'Pitch Black', background: '#111111' },
      { id: 'solid-gray',  name: 'Cool Gray',   background: '#e5e7eb' },
      { id: 'solid-pink',  name: 'Pale Pink',   background: '#fce7f3' },
      { id: 'solid-blue',  name: 'Ice Blue',    background: '#e0f2fe' },
      { id: 'solid-yellow',name: 'Butter',      background: '#fef08a' },
      { id: 'solid-sage',  name: 'Sage Green',  background: '#dcfce3' },
    ],
  },
  {
    id: 'patterns',
    name: 'Patterns',
    subtitle: 'Playful prints & textures',
    designs: [
      { 
        id: 'pat-grid', 
        name: 'Graph Paper', 
        background: '#ffffff',
        // Note: in the actual render, we might apply the pattern via a pseudo-element or direct background image.
        // For simplicity, we define the full CSS background here.
        filterCss: 'background-image: linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px); background-size: 20px 20px;'
      },
      {
        id: 'pat-dots',
        name: 'Polka Dots',
        background: 'radial-gradient(#fca5a5 15%, transparent 16%), radial-gradient(#fca5a5 15%, transparent 16%), #fee2e2',
        filterCss: 'background-size: 20px 20px; background-position: 0 0, 10px 10px;'
      },
      {
        id: 'pat-checker',
        name: 'Checkerboard',
        background: 'conic-gradient(at 50% 50%, #111 75%, #fff 75%, #fff 100%)', // simplified CSS checker
        filterCss: 'background-image: conic-gradient(#111 90deg, #fff 90deg 180deg, #111 180deg 270deg, #fff 270deg); background-size: 40px 40px;'
      },
      {
        id: 'pat-stripes',
        name: 'Candy Stripes',
        background: 'repeating-linear-gradient(45deg, #fecaca, #fecaca 10px, #ffffff 10px, #ffffff 20px)',
      },
      {
        id: 'pat-blue-waves',
        name: 'Ocean Waves',
        background: 'repeating-radial-gradient(circle at 0 0, transparent 0, #e0f2fe 10px), repeating-linear-gradient(#bfdbfe, #bfdbfe)',
      },
      {
        id: 'pat-retro',
        name: '70s Retro',
        background: 'linear-gradient(135deg, #fef08a 25%, #fca5a5 25%, #fca5a5 50%, #93c5fd 50%, #93c5fd 75%, #d8b4fe 75%)',
      },
      {
        id: 'pat-stars',
        name: 'Starry Night',
        background: 'radial-gradient(circle, #fff 1px, transparent 1px), radial-gradient(circle, #fff 1px, transparent 1px), #0f172a',
        filterCss: 'background-size: 20px 20px; background-position: 0 0, 10px 10px;'
      },
      {
        id: 'pat-terrazzo',
        name: 'Terrazzo',
        background: '#fdfbf7', // simplified, will just show a beige bg for swatch
        filterCss: 'background-image: radial-gradient(circle, #e5e7eb 20%, transparent 20%), radial-gradient(circle, #fca5a5 20%, transparent 20%); background-size: 30px 30px; background-position: 0 0, 15px 15px;'
      },
      {
        id: 'pat-haze',
        name: 'Neon Haze',
        background: 'linear-gradient(45deg, #ff00cc, #333399)',
      },
      {
        id: 'pat-vintage',
        name: 'Vintage Floral',
        background: '#fef3c7', // placeholder
      },
      {
        id: 'pat-glitch',
        name: 'Cyber Glitch',
        background: 'repeating-linear-gradient(0deg, #000, #000 2px, #0f172a 2px, #0f172a 4px)',
      }
    ],
  }
];

export const ALL_DESIGNS = DESIGN_PACKS.flatMap(p => p.designs);
