import { motion } from "framer-motion";
import type { StripLayout } from "../../data/stripLayouts";

interface LayoutCardProps {
  layout: StripLayout;
  selected: boolean;
  onSelect: (layout: StripLayout) => void;
}

export default function LayoutCard({
  layout,
  selected,
  onSelect,
}: LayoutCardProps) {
  // ── SVG Geometry ───────────────────────────────────────────
  // We normalise the SVG width to 100 units.
  const svgW = 100;
  const svgH = svgW / layout.stripAspectRatio;
  const pad = svgW * layout.paddingFraction;
  const gap = svgW * layout.gapFraction;

  const frameW = (svgW - 2 * pad - (layout.columns - 1) * gap) / layout.columns;
  const frameH = frameW / layout.frameAspectRatio;

  return (
    <motion.button
      id={`layout-card-${layout.id}`}
      aria-pressed={selected}
      onClick={() => onSelect(layout)}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: 0,
        background: "var(--c-surface-1)",
        border: `1.5px solid ${selected ? "var(--c-accent)" : "var(--c-border)"}`,
        borderRadius: "var(--r-lg)",
        cursor: "pointer",
        overflow: "hidden",
        boxShadow: selected ? "var(--shadow-accent)" : "var(--shadow-sm)",
        transition: "border-color var(--dur-base), box-shadow var(--dur-base)",
        textAlign: "left",

        opacity: layout.available ? 1 : 0.5,
      }}
      disabled={!layout.available}
    >
      {/* ── Preview Area ───────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          height: 180,
          background: "var(--c-surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--c-border-soft)",
        }}
      >
        {/* The generated photo strip shape */}
        <div
          style={{
            position: "relative",
            background: "var(--c-text-hi)", // Strip base color
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            // Height is bounded by container to keep it looking nice
            height: "80%",
            // We set aspect ratio to ensure it stays exactly to scale
            aspectRatio: `${layout.stripAspectRatio}`,
          }}
        >
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            {layout.slots.map((slot) => {
              const x = pad + slot.col * (frameW + gap);
              const y = pad + slot.row * (frameH + gap);
              const w = slot.colSpan * frameW + (slot.colSpan - 1) * gap;
              const h = slot.rowSpan * frameH + (slot.rowSpan - 1) * gap;

              return (
                <rect
                  key={slot.index}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="var(--c-surface-1)"
                  stroke="var(--c-border)"
                  strokeWidth="0.5"
                />
              );
            })}
          </svg>
        </div>

        {/* Selected check */}
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--c-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            ✓
          </motion.div>
        )}
      </div>

      {/* ── Text area ──────────────────────────────────────── */}
      <div style={{ padding: "var(--sp-4)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "var(--text-base)",
              color: selected ? "var(--c-text-hi)" : "var(--c-text-md)",
              transition: "color var(--dur-fast)",
            }}
          >
            {layout.name}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--c-text-lo)",
            }}
          >
            {layout.label}
          </div>
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--c-text-lo)",
            lineHeight: 1.4,
            marginBottom: "var(--sp-2)",
          }}
        >
          {layout.description}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "2px 8px",
            background: "var(--c-surface-2)",
            borderRadius: "var(--r-full)",
            fontSize: "var(--text-xs)",
            color: "var(--c-text-md)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {layout.slotCount} shots ·{" "}
          {layout.mixed
            ? "Mixed portrait + landscape"
            : layout.frameAspectRatio > 1.05
              ? "Landscape"
              : layout.frameAspectRatio < 0.95
                ? "Portrait"
                : "Square"}{" "}
          ·{" "}
          {layout.frameAspectRatio < 0.95
            ? "Best for 1–2 people"
            : ["2x2", "3x2", "group-wide"].includes(layout.id)
              ? "Best for 2–4 people"
              : "1–4 people"}
        </div>
      </div>
    </motion.button>
  );
}
