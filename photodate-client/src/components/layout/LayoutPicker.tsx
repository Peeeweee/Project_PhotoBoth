import { useState } from "react";
import { motion } from "framer-motion";
import { AVAILABLE_LAYOUTS, type StripLayout } from "../../data/stripLayouts";
import LayoutCard from "./LayoutCard";

interface LayoutPickerProps {
  selectedId: string | null;
  onSelect: (layout: StripLayout) => void;
}

export default function LayoutPicker({
  selectedId,
  onSelect,
}: LayoutPickerProps) {
  const [orientation, setOrientation] = useState("all");
  const visible = AVAILABLE_LAYOUTS.filter(
    (l) =>
      orientation === "all" ||
      (orientation === "landscape"
        ? l.frameAspectRatio > 1.05
        : orientation === "portrait"
          ? l.frameAspectRatio < 0.95
          : l.frameAspectRatio >= 0.95 && l.frameAspectRatio <= 1.05),
  );
  return (
    <div>
      <div
        className="layout-orientations"
        role="group"
        aria-label="Photo orientation"
      >
        {["all", "landscape", "portrait", "square"].map((value) => (
          <button
            key={value}
            aria-pressed={orientation === value}
            onClick={() => setOrientation(value)}
          >
            {value === "all"
              ? "All layouts"
              : `${value[0].toUpperCase() + value.slice(1)} photos`}
          </button>
        ))}
      </div>
      <motion.div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "var(--sp-4)",
        }}
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        initial="hidden"
        animate="show"
      >
        {visible.map((layout) => (
          <motion.div
            key={layout.id}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
              },
            }}
            style={{ display: "flex" }}
          >
            <LayoutCard
              layout={layout}
              selected={selectedId === layout.id}
              onSelect={onSelect}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
