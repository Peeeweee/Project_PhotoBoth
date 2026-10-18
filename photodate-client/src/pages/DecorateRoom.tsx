import { publishStage } from "../lib/session";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import {
  StripCanvas,
  DraggableSticker,
  DrawOverlay,
} from "../components/editor";
import { STICKERS } from "../data/stickerPresets";
import { FILTER_PRESETS } from "../data/filterPresets";
import { socket } from "../lib/socket";

export default function DecorateRoom() {
  const navigate = useNavigate();
  const { roomCode, selfId, isHost } = useRoomStore();
  const {
    layoutId,
    designPreset,
    filterId,
    assignedPhotos,
    placedStickers,
    addSticker,
    updateSticker,
    removeSticker,
    clearDrawStrokes,
    stripTitle,
    setStripTitle,
    titlePosition,
    setTitlePosition,
    showWatermark,
    setShowWatermark,
  } = useSessionStore();

  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"stickers" | "draw">("stickers");
  const [drawColor, setDrawColor] = useState<string>("#ffffff");
  const [drawThickness, setDrawThickness] = useState<number>(4);

  const designId = designPreset?.id || "classic";
  const selectedFilter =
    FILTER_PRESETS.find((f) => f.id === filterId) || FILTER_PRESETS[0];

  const handleNext = () => {
    if (isHost && roomCode && selfId) {
      socket.emit(
        "update-room-state",
        {
          code: roomCode,
          participantId: selfId,
          status: "exporting",
        },
        (res) => {
          if (res.ok) {
            publishStage("export", () => navigate("/export"));
          } else {
            console.error(res.error);
          }
        },
      );
    }
  };

  const handleAddSticker = (presetId: string) => {
    if (!isHost) return;
    addSticker({
      id: crypto.randomUUID(),
      stickerId: presetId,
      // Default drop position in the middle of the canvas
      // Since StripCanvas scales, these coords represent the internal position
      // relative to its unscaled bounding box? Wait, Framer Motion drag uses the DOM.
      // Dropping at 50, 50 relative to container top-left.
      x: 100,
      y: 100,
      scale: 1,
      rotation: 0,
    });
  };

  return (
    <div
      className="decorate-workspace flex flex-col p-4 gap-4"
      onPointerDown={() => setSelectedStickerId(null)} // Deselect if clicking background
    >
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <h1
          style={{
            fontSize: "clamp(1.5rem, 4vw, var(--text-2xl))",
            fontWeight: 700,
            color: "var(--c-text-hi)",
            margin: "0 0 var(--sp-1)",
          }}
        >
          Deck it out!
        </h1>
        <p
          style={{
            color: "var(--c-text-md)",
            fontSize: "var(--text-sm)",
            margin: 0,
          }}
        >
          Add cute stickers to your strip.
        </p>
      </div>

      <fieldset className="photo-title-controls" disabled={!isHost}>
        <legend>Photo title & placement</legend>
        <label>
          Title{" "}
          <input
            maxLength={200}
            value={stripTitle}
            placeholder="Give your photos a title"
            onChange={(e) => setStripTitle(e.target.value)}
          />
        </label>
        <label>
          Horizontal position{" "}
          <input
            type="range"
            min="5"
            max="99"
            value={titlePosition.x}
            onChange={(e) =>
              setTitlePosition({
                ...titlePosition,
                x: Number(e.target.value),
                auto: false,
              })
            }
          />
        </label>
        <label>
          Vertical position{" "}
          <input
            type="range"
            min="5"
            max="99"
            value={titlePosition.y}
            onChange={(e) =>
              setTitlePosition({
                ...titlePosition,
                y: Number(e.target.value),
                auto: false,
              })
            }
          />
        </label>
        <button
          className="action-secondary"
          onClick={() => setTitlePosition({ x: 50, y: 90, auto: true })}
        >
          Reset placement
        </button>
        {!isHost && <p>The host edits the shared photo title.</p>}
      </fieldset>
      {/* Top: Large Strip Preview */}
      <div className="decorate-preview relative flex-1 flex justify-center items-center min-h-0 bg-[var(--c-surface-1)] rounded-[var(--r-lg)] p-4 md:p-8 overflow-hidden">
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
          >
            {/* Sticker Overlay Area */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none", // Let touches pass through the overlay div...
                overflow: "hidden",
              }}
            >
              {placedStickers.map((sticker) => {
                const preset = STICKERS.find((s) => s.id === sticker.stickerId);
                if (!preset) return null;
                return (
                  <div
                    key={sticker.id}
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                    }}
                  >
                    <DraggableSticker
                      readOnly={!isHost}
                      sticker={sticker}
                      url={preset.url}
                      isSelected={selectedStickerId === sticker.id}
                      onSelect={() => setSelectedStickerId(sticker.id)}
                      onUpdate={updateSticker}
                      onRemove={removeSticker}
                    />
                  </div>
                );
              })}
            </div>
            {/* Draw Overlay */}
            <DrawOverlay
              isActive={isHost && activeTab === "draw"}
              currentColor={drawColor}
              currentThickness={drawThickness}
            />
          </StripCanvas>
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

      {/* Bottom: Tools */}
      <div className="shrink-0 flex flex-col gap-2 max-w-3xl w-full self-center">
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "var(--sp-4)",
          }}
        >
          <button
            className="mode-button"
            aria-pressed={activeTab === "stickers"}
            onClick={() => setActiveTab("stickers")}
            style={{
              background: "none",
              border: "none",
              padding: "var(--sp-2)",
              color:
                activeTab === "stickers"
                  ? "var(--c-text-hi)"
                  : "var(--c-text-md)",
              fontWeight: activeTab === "stickers" ? 700 : 500,
              borderBottom:
                activeTab === "stickers"
                  ? "2px solid var(--c-accent)"
                  : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            Stickers
          </button>
          <button
            className="mode-button"
            aria-pressed={activeTab === "draw"}
            onClick={() => setActiveTab("draw")}
            style={{
              background: "none",
              border: "none",
              padding: "var(--sp-2)",
              color:
                activeTab === "draw" ? "var(--c-text-hi)" : "var(--c-text-md)",
              fontWeight: activeTab === "draw" ? 700 : 500,
              borderBottom:
                activeTab === "draw"
                  ? "2px solid var(--c-accent)"
                  : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            Draw
          </button>
        </div>

        {/* Tools Content */}
        {activeTab === "stickers" ? (
          <div className="w-full">
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "var(--sp-4)",
                overflowX: "auto",
                padding: "var(--sp-2) 1rem",
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none",
                width: "100%",
              }}
            >
              {STICKERS.map((sticker) => (
                <motion.button
                  type="button"
                  aria-label={`Add ${sticker.name} sticker`}
                  disabled={!isHost}
                  key={sticker.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAddSticker(sticker.id)}
                  style={{
                    flexShrink: 0,
                    width: "60px",
                    height: "60px",
                    background: "var(--c-surface-2)",
                    borderRadius: "var(--r-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: "10px",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--c-border)",
                  }}
                >
                  <img
                    src={sticker.url}
                    alt={sticker.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                    }}
                  />
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--sp-4)",
              padding: "var(--sp-2) 0",
            }}
          >
            {/* Colors */}
            <div style={{ display: "flex", gap: "var(--sp-4)" }}>
              {[
                "#ffffff",
                "#000000",
                "#ff4b4b",
                "#ff7eb3",
                "#ffe24b",
                "#4b9fff",
              ].map((color) => (
                <button
                  key={color}
                  disabled={!isHost}
                  aria-pressed={drawColor === color}
                  onClick={() => setDrawColor(color)}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    border:
                      drawColor === color
                        ? "3px solid var(--c-accent)"
                        : "2px solid var(--c-border)",
                    background: color,
                    cursor: "pointer",
                    boxShadow:
                      drawColor === color ? "0 0 0 2px var(--c-bg)" : "none",
                  }}
                  aria-label={`Draw in ${{ "#ffffff": "white", "#000000": "black", "#ff4b4b": "red", "#ff7eb3": "pink", "#ffe24b": "yellow", "#4b9fff": "blue" }[color] ?? color}`}
                />
              ))}
            </div>
            {/* Thickness and Clear */}
            <div
              style={{
                display: "flex",
                gap: "var(--sp-4)",
                alignItems: "center",
              }}
            >
              <button
                disabled={!isHost}
                aria-pressed={drawThickness === 2}
                onClick={() => setDrawThickness(2)}
                style={{
                  background:
                    drawThickness === 2
                      ? "var(--c-text-hi)"
                      : "var(--c-surface-2)",
                  color:
                    drawThickness === 2 ? "var(--c-bg)" : "var(--c-text-hi)",
                  border: "none",
                  borderRadius: "var(--r-md)",
                  padding: "var(--sp-1) var(--sp-4)",
                  cursor: "pointer",
                }}
              >
                Thin
              </button>
              <button
                disabled={!isHost}
                aria-pressed={drawThickness === 6}
                onClick={() => setDrawThickness(6)}
                style={{
                  background:
                    drawThickness === 6
                      ? "var(--c-text-hi)"
                      : "var(--c-surface-2)",
                  color:
                    drawThickness === 6 ? "var(--c-bg)" : "var(--c-text-hi)",
                  border: "none",
                  borderRadius: "var(--r-md)",
                  padding: "var(--sp-1) var(--sp-4)",
                  cursor: "pointer",
                }}
              >
                Thick
              </button>
              <div
                style={{
                  width: "1px",
                  height: "24px",
                  background: "var(--c-border)",
                }}
              />
              <button
                disabled={!isHost}
                onClick={clearDrawStrokes}
                style={{
                  background: "none",
                  color: "#ff4b4b",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Next Button */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          marginTop: "var(--sp-2)",
        }}
      >
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
