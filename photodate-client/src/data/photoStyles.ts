/** Stable IDs retain compatibility with existing Classic/Vintage/Meme sessions. */
export const PHOTO_STYLES = [
  {
    id: "classic",
    name: "Classic",
    subtitle: "Clean & timeless",
    description:
      "White frames and natural color. A little classic that never gets old.",
    designId: "solid-white",
    filterId: "original",
    previewBg: "linear-gradient(145deg,#f8f3f6,#d7d4e1)",
    accentColor: "#e681b6",
  },
  {
    id: "vintage",
    name: "Vintage",
    subtitle: "Warm film memories",
    description:
      "Oat-colored paper and a warm Retro filter, with a gently unfolding film strip.",
    designId: "solid-oat",
    filterId: "retro",
    previewBg: "linear-gradient(145deg,#e8cea4,#997346)",
    accentColor: "#b78044",
  },
  {
    id: "meme",
    name: "Playful",
    subtitle: "Color outside the lines",
    description:
      "Citrus stripes, natural color and flipping prints. Add your own stickers after capture.",
    designId: "pat-citrus",
    filterId: "original",
    previewBg: "linear-gradient(135deg,#ff9aa8,#ffe36a,#98d9b2)",
    accentColor: "#e04b92",
  },
  {
    id: "daydream",
    name: "Daydream",
    subtitle: "Soft Sunday energy",
    description:
      "Rose gingham and faded Film tones, with slow, dreamy floating prints.",
    designId: "pat-gingham-rose",
    filterId: "film",
    previewBg: "linear-gradient(135deg,#f9d6df,#e6ddff,#c7e4ed)",
    accentColor: "#bb84c4",
  },
  {
    id: "noir",
    name: "Noir",
    subtitle: "A cinematic little secret",
    description:
      "Black frames and the Mono filter. A rotating contact sheet with a silver finish.",
    designId: "solid-black",
    filterId: "mono",
    previewBg: "linear-gradient(135deg,#595565,#17141c)",
    accentColor: "#c3b9d7",
  },
  {
    id: "neon",
    name: "Neon Nights",
    subtitle: "Meet me after midnight",
    description:
      "Neon Haze frames and cool, saturated tones. A holographic photo orbit.",
    designId: "pat-haze",
    filterId: "cool",
    previewBg: "linear-gradient(135deg,#2b1248,#a52ccf,#f14eae)",
    accentColor: "#db64ef",
  },
  {
    id: "sunset",
    name: "Golden Hour",
    subtitle: "Keep a little sunshine",
    description:
      "Peach frames and warm Peach tones, with softly turning sunlit prints.",
    designId: "solid-peach",
    filterId: "peach",
    previewBg: "linear-gradient(145deg,#ffdb9b,#ff9f9f,#c0a0d9)",
    accentColor: "#ee9272",
  },
  {
    id: "scrapbook",
    name: "Scrapbook",
    subtitle: "Little moments, collected",
    description:
      "Daisy frames and natural photos, with a paper fan that opens like a tiny album.",
    designId: "pat-daisy",
    filterId: "original",
    previewBg: "linear-gradient(135deg,#e7e8b6,#bad0aa,#e9d7be)",
    accentColor: "#8caa70",
  },
] as const;
export function getPhotoStyle(id?: string | null) {
  return PHOTO_STYLES.find((style) => style.id === id) ?? PHOTO_STYLES[0];
}
