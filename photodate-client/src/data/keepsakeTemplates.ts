import type { LayoutId } from "../state/useSessionStore";
import type { TitleStyle } from "../../../shared/contracts";
import { DEFAULT_TITLE_STYLE } from "./textStyles";
export const KEEPSAKE_TEMPLATES: {
  id: string;
  name: string;
  category: string;
  layoutId: LayoutId;
  designId: string;
  filterId: string;
  title: string;
  titleStyle: TitleStyle;
  description: string;
}[] = [
  {
    id: "birthday-pop",
    name: "Birthday confetti",
    category: "Birthdays",
    layoutId: "4x1",
    designId: "pat-citrus",
    filterId: "original",
    title: "Another year of you!",
    titleStyle: { ...DEFAULT_TITLE_STYLE, font: "rounded", bold: true },
    description: "Four playful moments, wrapped in citrus stripes.",
  },
  {
    id: "birthday-bloom",
    name: "Make a wish",
    category: "Birthdays",
    layoutId: "2x2",
    designId: "pat-petal",
    filterId: "peach",
    title: "Make a wish ♡",
    titleStyle: { ...DEFAULT_TITLE_STYLE, font: "handwritten" },
    description: "A soft floral grid for a birthday crew.",
  },
  {
    id: "graduation",
    name: "Next chapter",
    category: "Graduation",
    layoutId: "portrait-4",
    designId: "solid-denim",
    filterId: "original",
    title: "On to the next chapter",
    titleStyle: { ...DEFAULT_TITLE_STYLE, font: "elegant", italic: true },
    description: "Portraits in deep blue for a milestone worth keeping.",
  },
  {
    id: "couples-note",
    name: "Just us",
    category: "Couples",
    layoutId: "portrait-pair",
    designId: "pat-gingham-rose",
    filterId: "film",
    title: "You, me & a little magic",
    titleStyle: { ...DEFAULT_TITLE_STYLE, font: "handwritten" },
    description: "A little portrait album with rose picnic checks.",
  },
  {
    id: "couples-sunset",
    name: "Golden together",
    category: "Couples",
    layoutId: "landscape-2",
    designId: "pat-sunset",
    filterId: "peach",
    title: "Our kind of golden hour",
    titleStyle: { ...DEFAULT_TITLE_STYLE, font: "elegant", italic: true },
    description: "Two wide frames for a warm little date.",
  },
  {
    id: "friends",
    name: "The whole crew",
    category: "Friends",
    layoutId: "3x2",
    designId: "pat-daisy",
    filterId: "original",
    title: "Good times. Better people.",
    titleStyle: { ...DEFAULT_TITLE_STYLE, font: "rounded", bold: true },
    description: "Six landscape memories for all your favorite people.",
  },
  {
    id: "friends-story",
    name: "Little adventures",
    category: "Friends",
    layoutId: "mixed-story",
    designId: "pat-journal",
    filterId: "film",
    title: "A day for the scrapbook",
    titleStyle: DEFAULT_TITLE_STYLE,
    description: "A mixed photo story on warm journal paper.",
  },
  {
    id: "event",
    name: "After the party",
    category: "Events",
    layoutId: "landscape-film",
    designId: "pat-midnight",
    filterId: "original",
    title: "A night to remember",
    titleStyle: { ...DEFAULT_TITLE_STYLE, font: "modern", bold: true },
    description: "A wide film strip under midnight stars.",
  },
];
