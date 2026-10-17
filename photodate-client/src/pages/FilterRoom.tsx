import { publishStage } from "../lib/session";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import { StripCanvas } from "../components/editor";
import { FILTER_PRESETS } from "../data/filterPresets";

export default function FilterRoom() {
  const navigate = useNavigate();
  const { isHost } = useRoomStore();
  const {
    layoutId,
    designPreset,
    filterId,
    setFilterId,
    assignedPhotos,
    stripTitle,
    showWatermark,
    setShowWatermark,
  } = useSessionStore();

  const designId = designPreset?.id || "classic";

  // State to manage scrolling / dot pagination visually (simplified for horizontal scroll)
  // We can just rely on native horizontal scrolling and snap for the row.

  const handleNext = () => {
    if (isHost) {
      publishStage("decorate", () => navigate("/decorate"));
    }
  };

  const selectedFilter =
    FILTER_PRESETS.find((f) => f.id === filterId) || FILTER_PRESETS[0];

  // Pick the first photo as the thumbnail representative
  const thumbPhoto = assignedPhotos[0] || "";

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <h1
          style={{
            fontSize: "clamp(1.5rem, 4vw, var(--text-2xl))",
            fontWeight: 700,
            color: "var(--c-text-hi)",
            margin: "0 0 var(--sp-1)",
          }}
        >
          Pick a Filter
        </h1>
        <p
          style={{
            color: "var(--c-text-md)",
            fontSize: "var(--text-sm)",
            margin: 0,
          }}
        >
          Give your strip that perfect final touch.
        </p>
      </div>

      {/* Top: Large Strip Preview */}
      <div className="flex-1 flex justify-center items-center min-h-0 bg-[var(--c-surface-1)] rounded-[var(--r-lg)] p-4 md:p-8 overflow-hidden">
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <StripCanvas
            layoutId={layoutId}
            design={designPreset ?? undefined}
            designId={designId}
            photos={assignedPhotos}
            photoFilterCss={selectedFilter.cssFilter}
            title={stripTitle}
            showWatermark={showWatermark}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Toggle Watermark Button */}
        {isHost && (
          <button
            onClick={() => setShowWatermark(!showWatermark)}
            style={{
              position: "absolute",
              top: "var(--sp-2)",
              right: "var(--sp-2)",
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              border: "none",
              padding: "var(--sp-1) var(--sp-2)",
              borderRadius: "var(--r-md)",
              fontSize: "var(--text-xs)",
              cursor: "pointer",
              zIndex: 10,
              backdropFilter: "blur(4px)",
            }}
          >
            {showWatermark ? "Hide Watermark" : "Show Watermark"}
          </button>
        )}
      </div>

      {/* Bottom: Filter Thumbnails Row */}
      <div className="shrink-0 pb-2 w-full">
        <div className="flex justify-center gap-4 overflow-x-auto py-2 snap-x snap-mandatory scrollbar-none w-full px-4">
          {FILTER_PRESETS.map((filter) => {
            const isSelected = filterId === filter.id;
            return (
              <motion.button
                type="button"
                key={filter.id}
                disabled={!isHost}
                onClick={() => isHost && setFilterId(filter.id)}
                whileTap={{ scale: 0.95 }}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--sp-2)",
                  cursor: "pointer",
                  scrollSnapAlign: "start",
                }}
              >
                <div
                  style={{
                    width: "80px",
                    height: "100px",
                    borderRadius: "var(--r-md)",
                    overflow: "hidden",
                    border: `3px solid ${isSelected ? "var(--c-accent)" : "transparent"}`,
                    boxShadow: isSelected ? "0 0 10px var(--c-accent)" : "none",
                    transition: "all 0.2s",
                    background: "var(--c-surface-2)",
                  }}
                >
                  {thumbPhoto && (
                    <img
                      src={thumbPhoto}
                      alt={filter.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: filter.cssFilter,
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "var(--c-text-hi)" : "var(--c-text-md)",
                  }}
                >
                  {filter.name}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Simple dot pagination indicator underneath (optional detail) */}
        <div
          style={{
            flexShrink: 0,
            padding: "var(--sp-4) 0",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--sp-4)",
              width: "max-content",
              margin: "0 auto",
              padding: "0 var(--sp-4)",
            }}
          >
            {FILTER_PRESETS.map((filter) => (
              <div
                key={`dot-${filter.id}`}
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background:
                    filterId === filter.id
                      ? "var(--c-text-hi)"
                      : "var(--c-surface-3)",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Next Button */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <button
          disabled={!isHost}
          onClick={handleNext}
          style={{
            background: "var(--c-text-hi)",
            color: "var(--c-bg)",
            border: "none",
            borderRadius: "var(--r-full)",
            padding: "var(--sp-4) var(--sp-8)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            cursor: isHost ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            opacity: isHost ? 1 : 0.5,
          }}
        >
          {isHost ? "Finish" : "Waiting for Host..."}
        </button>
      </div>
    </div>
  );
}
