import type { DesignPreset } from "../state/useSessionStore";

export interface DesignPack {
  id: string;
  name: string;
  subtitle: string;
  designs: DesignPreset[];
}

export const DESIGN_PACKS: DesignPack[] = [
  {
    id: "simple",
    name: "Simple",
    subtitle: "Classic solid colors",
    designs: [
      { id: "solid-white", name: "Clean White", background: "#ffffff" },
      { id: "solid-black", name: "Pitch Black", background: "#111111" },
      { id: "solid-gray", name: "Cool Gray", background: "#e5e7eb" },
      { id: "solid-pink", name: "Pale Pink", background: "#fce7f3" },
      { id: "solid-blue", name: "Ice Blue", background: "#e0f2fe" },
      { id: "solid-yellow", name: "Butter", background: "#fef08a" },
      { id: "solid-sage", name: "Sage Green", background: "#dcfce3" },
    ],
  },
  {
    id: "patterns",
    name: "Patterns",
    subtitle: "Playful prints & textures",
    designs: [
      {
        id: "pat-grid",
        name: "Graph Paper",
        background: "#ffffff",
        // Note: in the actual render, we might apply the pattern via a pseudo-element or direct background image.
        // For simplicity, we define the full CSS background here.
        filterCss:
          "background-image: linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px); background-size: 20px 20px;",
      },
      {
        id: "pat-dots",
        name: "Polka Dots",
        background:
          "radial-gradient(#fca5a5 15%, transparent 16%), radial-gradient(#fca5a5 15%, transparent 16%), #fee2e2",
        filterCss:
          "background-size: 20px 20px; background-position: 0 0, 10px 10px;",
      },
      {
        id: "pat-checker",
        name: "Checkerboard",
        background: "conic-gradient(at 50% 50%, #111 75%, #fff 75%, #fff 100%)", // simplified CSS checker
        filterCss:
          "background-image: conic-gradient(#111 90deg, #fff 90deg 180deg, #111 180deg 270deg, #fff 270deg); background-size: 40px 40px;",
      },
      {
        id: "pat-stripes",
        name: "Candy Stripes",
        background:
          "repeating-linear-gradient(45deg, #fecaca, #fecaca 10px, #ffffff 10px, #ffffff 20px)",
      },
      {
        id: "pat-blue-waves",
        name: "Ocean Waves",
        background:
          "repeating-radial-gradient(circle at 0 0, transparent 0, #e0f2fe 10px), repeating-linear-gradient(#bfdbfe, #bfdbfe)",
      },
      {
        id: "pat-retro",
        name: "70s Retro",
        background:
          "linear-gradient(135deg, #fef08a 25%, #fca5a5 25%, #fca5a5 50%, #93c5fd 50%, #93c5fd 75%, #d8b4fe 75%)",
      },
      {
        id: "pat-stars",
        name: "Starry Night",
        background:
          "radial-gradient(circle, #fff 1px, transparent 1px), radial-gradient(circle, #fff 1px, transparent 1px), #0f172a",
        filterCss:
          "background-size: 20px 20px; background-position: 0 0, 10px 10px;",
      },
      {
        id: "pat-terrazzo",
        name: "Terrazzo",
        background: "#fdfbf7", // simplified, will just show a beige bg for swatch
        filterCss:
          "background-image: radial-gradient(circle, #e5e7eb 20%, transparent 20%), radial-gradient(circle, #fca5a5 20%, transparent 20%); background-size: 30px 30px; background-position: 0 0, 15px 15px;",
      },
      {
        id: "pat-haze",
        name: "Neon Haze",
        background: "linear-gradient(45deg, #ff00cc, #333399)",
      },
      {
        id: "pat-vintage",
        name: "Vintage Floral",
        background: "#fef3c7", // placeholder
      },
      {
        id: "pat-glitch",
        name: "Cyber Glitch",
        background:
          "repeating-linear-gradient(0deg, #000, #000 2px, #0f172a 2px, #0f172a 4px)",
      },
    ],
  },
];

// Curated color stories and CSS-only prints; no extra image downloads.
DESIGN_PACKS.push(
  {
    id: "color-studio",
    name: "Color studio",
    subtitle: "Soft pastels, earthy neutrals & deep jewel tones",
    designs: [
      { id: "solid-lavender", name: "Lavender Milk", background: "#e9ddff" },
      { id: "solid-matcha", name: "Matcha Latte", background: "#d5dfb0" },
      { id: "solid-peach", name: "Peach Fizz", background: "#ffcfb4" },
      { id: "solid-cherry", name: "Cherry Cola", background: "#782d44" },
      { id: "solid-oat", name: "Oat Milk", background: "#eee4d2" },
      { id: "solid-denim", name: "Blue Hour", background: "#344e72" },
      { id: "solid-mocha", name: "Cocoa", background: "#6b5146" },
      { id: "solid-lilac", name: "Lilac Mist", background: "#c3b5df" },
      { id: "solid-forest", name: "Deep Forest", background: "#214c3d" },
      { id: "solid-tangerine", name: "Tangerine", background: "#ffac64" },
    ],
  },
  {
    id: "daydream",
    name: "Daydream club",
    subtitle: "Picnic dates, flower markets & soft Sunday mornings",
    designs: [
      {
        id: "pat-gingham-rose",
        name: "Rose Picnic",
        background: "#fff0f1",
        filterCss:
          "background-image: repeating-linear-gradient(0deg, #f6a6b855 0px 24px, transparent 24px 48px), repeating-linear-gradient(90deg, #f6a6b855 0px 24px, transparent 24px 48px);",
      },
      {
        id: "pat-gingham-matcha",
        name: "Matcha Picnic",
        background: "#f4f3da",
        filterCss:
          "background-image: repeating-linear-gradient(0deg, #82a47755 0px 24px, transparent 24px 48px), repeating-linear-gradient(90deg, #82a47755 0px 24px, transparent 24px 48px);",
      },
      {
        id: "pat-daisy",
        name: "Daisy Field",
        background: "#e4edbf",
        filterCss:
          "background-image: radial-gradient(circle, #e8b34c 3px, #fffdf4 4px 9px, transparent 10px); background-size: 46px 46px;",
      },
      {
        id: "pat-cloud",
        name: "Cloud Nine",
        background:
          "radial-gradient(ellipse at 20% 30%, #ffffff 0%, transparent 38%), radial-gradient(ellipse at 80% 65%, #ffffff 0%, transparent 34%), linear-gradient(150deg, #badbfa, #e5d9fb)",
      },
      {
        id: "pat-petal",
        name: "Petal Confetti",
        background: "#fff4ef",
        filterCss:
          "background-image: radial-gradient(ellipse, #eeb8cb 0px 4px, transparent 5px), radial-gradient(ellipse, #a9bfa2 0px 3px, transparent 4px); background-size: 35px 48px; background-position: 0 0, 17px 24px;",
      },
      {
        id: "pat-journal",
        name: "Sunday Journal",
        background: "#f8edd8",
        filterCss:
          "background-image: repeating-linear-gradient(0deg, transparent 0px 29px, #b6c4bf 30px 31px);",
      },
    ],
  },
  {
    id: "after-hours",
    name: "After hours",
    subtitle: "Neon nights, cosmic skies & a little disco energy",
    designs: [
      {
        id: "pat-aurora",
        name: "Aurora",
        background:
          "radial-gradient(ellipse at 10% 10%, #64ecc1, transparent 60%), radial-gradient(ellipse at 80% 80%, #a38aff, transparent 65%), #18243d",
      },
      {
        id: "pat-sunset",
        name: "Desert Sunset",
        background: "linear-gradient(160deg, #ffd9a0, #f59ea5 45%, #8b72b9)",
      },
      {
        id: "pat-disco",
        name: "Disco Tiles",
        background: "#342645",
        filterCss:
          "background-image: conic-gradient(#dbc8ee 90deg, #6a548b 90deg 180deg, #dbc8ee 180deg 270deg, #6a548b 270deg); background-size: 50px 50px;",
      },
      {
        id: "pat-midnight",
        name: "Midnight Orbit",
        background: "#17243c",
        filterCss:
          "background-image: radial-gradient(circle, #e8d2a3 1px, transparent 2px); background-size: 27px 33px;",
      },
      {
        id: "pat-chrome",
        name: "Liquid Chrome",
        background:
          "linear-gradient(120deg, #d8e1ec, #fafcff 20%, #a5b5cb 42%, #f3dafa 65%, #c4dbe6)",
      },
      {
        id: "pat-citrus",
        name: "Citrus Pop",
        background:
          "repeating-linear-gradient(135deg, #fbdd67 0px 32px, #f5a0bd 32px 64px, #a2d7bc 64px 96px)",
      },
    ],
  },
);
export const ALL_DESIGNS = DESIGN_PACKS.flatMap((p) => p.designs);
