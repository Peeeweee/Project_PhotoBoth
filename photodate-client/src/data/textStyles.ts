import type { TitleStyle } from "../../../shared/contracts";

export const TITLE_FONTS = [
  {
    id: "typewriter",
    name: "Typewriter",
    family: '"Courier New", Courier, monospace',
  },
  { id: "modern", name: "Modern", family: "Inter, Arial, sans-serif" },
  {
    id: "elegant",
    name: "Elegant",
    family: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "handwritten",
    name: "Handwritten",
    family: '"Segoe Print", "Bradley Hand", "Apple Chancery", cursive',
  },
  {
    id: "rounded",
    name: "Rounded",
    family: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
  },
] as const;
export const DEFAULT_TITLE_STYLE: TitleStyle = {
  font: "typewriter",
  size: 1,
  color: "auto",
  bold: false,
  italic: false,
};
export const TEXT_STYLE_PRESETS: {
  name: string;
  sample: string;
  style: TitleStyle;
}[] = [
  { name: "Classic", sample: "Our photo date", style: DEFAULT_TITLE_STYLE },
  {
    name: "Editorial",
    sample: "The good days",
    style: {
      font: "elegant",
      size: 1.15,
      color: "auto",
      bold: false,
      italic: true,
    },
  },
  {
    name: "Love note",
    sample: "Made with love",
    style: {
      font: "handwritten",
      size: 1.05,
      color: "#9a446f",
      bold: false,
      italic: false,
    },
  },
  {
    name: "Bold & happy",
    sample: "GOOD TIMES",
    style: {
      font: "rounded",
      size: 1.1,
      color: "auto",
      bold: true,
      italic: false,
    },
  },
];
export function titleFont(id: string) {
  return TITLE_FONTS.find((f) => f.id === id)?.family ?? TITLE_FONTS[0].family;
}
