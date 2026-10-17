export interface StickerPreset {
  id: string;
  name: string;
  /** Inline SVG data URL or image path */
  url: string;
}

// Helper to encode SVG string to a data URL that works nicely as an image source
const createSvgDataUrl = (svgString: string) => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

export const STICKERS: StickerPreset[] = [
  {
    id: 'heart-red',
    name: 'Heart',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M50 88.5C50 88.5 15 62 15 35.5C15 22.5 25.5 12 38.5 12C46 12 50 17 50 17C50 17 54 12 61.5 12C74.5 12 85 22.5 85 35.5C85 62 50 88.5 50 88.5Z" 
              fill="#ff4b4b" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
      </svg>
    `),
  },
  {
    id: 'flower-daisy',
    name: 'Daisy',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="#fff" stroke="#ffcb4b" stroke-width="4" stroke-dasharray="15 5"/>
        <circle cx="50" cy="50" r="15" fill="#ffcb4b" />
      </svg>
    `),
  },
  {
    id: 'star-yellow',
    name: 'Star',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <polygon points="50,10 61,40 93,40 67,58 77,88 50,70 23,88 33,58 7,40 39,40" 
                 fill="#ffe24b" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
      </svg>
    `),
  },
  {
    id: 'bow-pink',
    name: 'Bow',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M20 20 L40 50 L20 80 Z" fill="#ff7eb3" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
        <path d="M80 20 L60 50 L80 80 Z" fill="#ff7eb3" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="50" cy="50" r="12" fill="#ff4b8b" stroke="#fff" stroke-width="4"/>
      </svg>
    `),
  },
  {
    id: 'sparkles',
    name: 'Sparkles',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M50 10 C50 40 40 50 10 50 C40 50 50 60 50 90 C50 60 60 50 90 50 C60 50 50 40 50 10 Z" 
              fill="#fff" stroke="#ffe24b" stroke-width="3" stroke-linejoin="round"/>
      </svg>
    `),
  },
  {
    id: 'cat-face',
    name: 'Cat',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <polygon points="20,20 40,40 20,60" fill="#333" stroke="#fff" stroke-width="3"/>
        <polygon points="80,20 60,40 80,60" fill="#333" stroke="#fff" stroke-width="3"/>
        <ellipse cx="50" cy="65" rx="35" ry="25" fill="#333" stroke="#fff" stroke-width="3"/>
        <circle cx="40" cy="60" r="4" fill="#fff"/>
        <circle cx="60" cy="60" r="4" fill="#fff"/>
        <polygon points="45,70 55,70 50,75" fill="#ff7eb3"/>
      </svg>
    `),
  },
];
