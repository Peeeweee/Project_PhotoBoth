import { designBackground } from "./designBackground";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import type { DesignPack } from "../../data/themePacks";
import type { DesignPreset } from "../../state/useSessionStore";

interface DesignPackCardProps {
  pack: DesignPack;
  isExpanded: boolean;
  selectedDesignId: string | null;
  onToggleExpand: () => void;
  onSelectDesign: (design: DesignPreset) => void;
}

export default function DesignPackCard({
  pack,
  isExpanded,
  selectedDesignId,
  onToggleExpand,
  onSelectDesign,
}: DesignPackCardProps) {
  // Show up to 4 swatches in the collapsed preview
  const selectedDesign = pack.designs.find((d) => d.id === selectedDesignId);
  const previewSwatches = selectedDesign
    ? [
        selectedDesign,
        ...pack.designs.filter((d) => d.id !== selectedDesignId).slice(0, 3),
      ]
    : pack.designs.slice(0, 4);
  const remainingCount = Math.max(0, pack.designs.length - 4);

  // If any design in this pack is selected, the pack itself is considered "active"
  const hasSelectedDesign = pack.designs.some((d) => d.id === selectedDesignId);

  return (
    <motion.div
      style={{
        background: "var(--c-surface-1)",
        border: `1px solid ${hasSelectedDesign && !isExpanded ? "var(--c-accent)" : "var(--c-border)"}`,
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        boxShadow:
          hasSelectedDesign && !isExpanded
            ? "var(--shadow-accent)"
            : "var(--shadow-sm)",
        transition: "border-color var(--dur-base), box-shadow var(--dur-base)",
      }}
    >
      {/* ── Header / Collapsed Preview ───────────────────────────────── */}
      <button
        aria-expanded={isExpanded}
        onClick={onToggleExpand}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--sp-4)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: "var(--c-text-hi)",
            }}
          >
            {pack.name}
          </div>
          <div
            style={{ fontSize: "var(--text-sm)", color: "var(--c-text-md)" }}
          >
            {pack.subtitle}
          </div>

          {selectedDesign && (
            <span className="selected-design-label">
              <span
                style={designBackground(selectedDesign)}
                aria-hidden="true"
              />
              <Check size={13} /> Selected: {selectedDesign.name}
            </span>
          )}
          {/* Mini swatch row (only visible when collapsed) */}
          <AnimatePresence>
            {!isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: "var(--sp-3)",
                  overflow: "hidden",
                }}
              >
                {previewSwatches.map((d) => {
                  const isSelected = d.id === selectedDesignId;
                  return (
                    <div
                      key={d.id}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--r-sm)",
                        ...designBackground(d),
                        border: isSelected
                          ? "2px solid var(--c-accent)"
                          : "1px solid var(--c-border-soft)",
                        boxShadow: isSelected
                          ? "0 0 0 2px var(--c-bg) inset"
                          : "none",
                      }}
                    />
                  );
                })}
                {remainingCount > 0 && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--r-sm)",
                      background: "var(--c-surface-2)",
                      border: "1px solid var(--c-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--c-text-lo)",
                    }}
                  >
                    +{remainingCount}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ color: "var(--c-text-lo)", paddingLeft: "var(--sp-4)" }}>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
            <ChevronDown size={20} />
          </motion.div>
        </div>
      </button>

      {/* ── Expanded Grid ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
                gap: "var(--sp-3)",
                padding: "0 var(--sp-4) var(--sp-4)",
              }}
            >
              {pack.designs.map((design) => {
                const isSelected = design.id === selectedDesignId;
                return (
                  <button
                    key={design.id}
                    aria-pressed={isSelected}
                    onClick={() => onSelectDesign(design)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: "var(--r-md)",
                        ...designBackground(design),
                        border: isSelected
                          ? "2px solid var(--c-accent)"
                          : "1px solid var(--c-border)",
                        boxShadow: isSelected
                          ? "0 0 0 3px var(--c-bg) inset, var(--shadow-sm)"
                          : "var(--shadow-sm)",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "var(--c-accent)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </motion.div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: isSelected
                          ? "var(--c-text-hi)"
                          : "var(--c-text-md)",
                        fontWeight: isSelected ? 600 : 400,
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {design.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
