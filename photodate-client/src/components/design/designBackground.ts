import type { CSSProperties } from "react";
import { ALL_DESIGNS } from "../../data/themePacks";
import type { DesignPreset } from "../../state/useSessionStore";

/** Only built-in pattern declarations are converted to React style properties. */
export function designBackground(design: DesignPreset): CSSProperties {
  const style: CSSProperties = { background: design.background };
  const declarations = ALL_DESIGNS.find(
    (preset) => preset.id === design.id,
  )?.filterCss;
  for (const declaration of declarations?.split(";") ?? []) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (property === "background-image") style.backgroundImage = value;
    if (property === "background-size") style.backgroundSize = value;
    if (property === "background-position") style.backgroundPosition = value;
  }
  return style;
}
