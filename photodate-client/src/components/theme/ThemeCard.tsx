import { motion } from "framer-motion";
import type { ThemeDefinition } from "../../data/themes";
import { getPhotoStyle } from "../../data/photoStyles";
import { ALL_DESIGNS } from "../../data/themePacks";
import { FILTER_PRESETS } from "../../data/filterPresets";
import { designBackground } from "../design/designBackground";

export default function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: (theme: ThemeDefinition) => void;
}) {
  const style = getPhotoStyle(theme.id);
  const design = ALL_DESIGNS.find((d) => d.id === style.designId)!;
  const filter = FILTER_PRESETS.find((f) => f.id === style.filterId)!;
  return (
    <motion.button
      id={`theme-card-${theme.id}`}
      className={`photo-style-card photo-style-${theme.id}`}
      aria-pressed={selected}
      aria-label={`${theme.name}: ${style.subtitle}`}
      onClick={() => onSelect(theme)}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className="photo-style-stage"
        style={{ background: style.previewBg }}
        aria-hidden="true"
      >
        <div className="style-print" style={designBackground(design)}>
          {[0, 1, 2].map((pose) => (
            <div
              className="style-sample"
              key={pose}
              style={{ filter: filter.cssFilter }}
            >
              <svg viewBox="0 0 100 62" fill="none">
                <rect width="100" height="62" fill="#c5dce4" />
                <circle cx="79" cy="14" r="10" fill="#ffdc9a" />
                <path d="M0 43L23 19L53 48L72 29L100 55V62H0Z" fill="#8bae9d" />
                <path d="M17 62C17 38 51 38 51 62" fill="#dc82a4" />
                <circle cx="34" cy="31" r="12" fill="#b98367" />
                <path
                  d="M22 29C20 11 50 10 46 31L40 22L25 24Z"
                  fill="#463b4d"
                />
                <path d="M52 62C52 37 88 37 88 62" fill="#8a83b6" />
                <circle cx="70" cy="30" r="12" fill="#e5b894" />
                <path
                  d="M58 29C57 12 84 12 82 30L76 22L61 25Z"
                  fill="#665147"
                />
                {pose === 1 && (
                  <path
                    d="M22 49L12 30M80 49L91 29"
                    stroke="#b98367"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                )}
                {pose === 2 && (
                  <path
                    d="M42 42L50 36L59 42"
                    stroke="#e5b894"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </div>
          ))}
          <span className="style-print-caption">PeeDate ♡</span>
        </div>
        <span className="style-preview-label">Illustrated sample</span>
        {selected && <span className="style-selected-check">✓</span>}
      </div>
      <div className="photo-style-copy">
        <strong>{theme.name}</strong>
        <span>{style.subtitle}</span>
        <small>
          {design.name} · {filter.name}
        </small>
      </div>
    </motion.button>
  );
}
