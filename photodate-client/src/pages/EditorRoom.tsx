import { publishStage } from "../lib/session";
import { composeCaptures } from "../lib/composeCaptures";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import { StripCanvas } from "../components/editor";
import { getLayout } from "../data/stripLayouts";
import { socket } from "../lib/socket";
import { getCaptures } from "../lib/api";

export default function EditorRoom() {
  const navigate = useNavigate();
  const { roomCode, selfId, isHost } = useRoomStore();
  const {
    layoutId,
    designPreset,
    setAssignedPhotos: setGlobalAssignedPhotos,
    stripTitle,
    showWatermark,
    setShowWatermark,
  } = useSessionStore();

  const layout = getLayout(layoutId);
  const designId = designPreset?.id || "classic";

  const [captures, setCaptures] = useState<
    { id: string; image_url: string; frame_index: number }[]
  >([]);
  const assignedPhotos = useSessionStore((s) => s.assignedPhotos).length
    ? useSessionStore.getState().assignedPhotos
    : Array<string | null>(layout.slotCount).fill(null);
  const setAssignedPhotos = (photos: (string | null)[]) =>
    setGlobalAssignedPhotos(photos.map((p) => p ?? ""));
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch captures on mount
  useEffect(() => {
    async function fetchCaptures() {
      if (!roomCode) return;
      try {
        const data = await getCaptures(roomCode);
        const sorted = await composeCaptures(data.captures);
        setCaptures(sorted);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Could not load photos",
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchCaptures();
  }, [roomCode]);

  // Handle assigning a raw capture to the strip
  const handleSelectThumbnail = (imageUrl: string) => {
    if (!isHost) return;
    const nextEmptyIndex = assignedPhotos.findIndex((p) => !p);
    if (nextEmptyIndex !== -1) {
      const newAssigned = [...assignedPhotos];
      newAssigned[nextEmptyIndex] = imageUrl;
      setAssignedPhotos(newAssigned);
    }
  };

  // Handle removing a photo from the strip
  const handleSlotClick = (index: number) => {
    if (isHost && assignedPhotos[index]) {
      const newAssigned = [...assignedPhotos];
      newAssigned[index] = null;
      setAssignedPhotos(newAssigned);
    }
  };

  const isComplete = assignedPhotos.every(Boolean);

  const handleNext = () => {
    // Transition the room state to 'editing'.
    if (isHost && roomCode && selfId) {
      setGlobalAssignedPhotos(assignedPhotos as string[]);
      socket.emit(
        "update-room-state",
        {
          code: roomCode,
          participantId: selfId,
          status: "editing",
        },
        (res) => {
          if (res.ok) {
            publishStage("filter", () => navigate("/filter"));
          } else {
            console.error(res.error);
          }
        },
      );
    }
  };

  if (loadError)
    return (
      <p role="alert">
        {loadError}{" "}
        <button onClick={() => window.location.reload()}>Retry</button>
      </p>
    );
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--c-text-md)",
        }}
      >
        Loading captures...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--sp-4)",
        gap: "var(--sp-4)",
      }}
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
          Pick your shots
        </h1>
        <p
          style={{
            color: "var(--c-text-md)",
            fontSize: "var(--text-sm)",
            margin: 0,
          }}
        >
          Tap a photo to add it to your strip. Photos can be reused. Tap a slot
          to remove it.
        </p>
      </div>

      <div className="flex flex-col-reverse md:flex-row flex-1 gap-4 min-h-0 overflow-hidden w-full">
        {/* Left Side: Thumbnail Pool */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 auto-rows-max gap-2 overflow-y-auto content-start md:pr-2 pb-4 md:pb-0">
          {captures.map((capture, idx) => {
            const isUsed = assignedPhotos.includes(capture.image_url);
            return (
              <motion.div
                key={capture.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                role="button"
                tabIndex={isHost ? 0 : -1}
                aria-disabled={!isHost}
                aria-label={`Use photo ${idx + 1}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectThumbnail(capture.image_url);
                  }
                }}
                onClick={() => handleSelectThumbnail(capture.image_url)}
                style={{
                  aspectRatio: `${layout.frameAspectRatio}`,
                  borderRadius: "var(--r-md)",
                  overflow: "hidden",
                  cursor: isHost ? "pointer" : "default",
                  position: "relative",
                  border: `2px solid ${isUsed ? "transparent" : "var(--c-accent)"}`,
                  opacity: isUsed ? 0.3 : 1,
                  filter: isUsed ? "grayscale(100%)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <img
                  src={capture.image_url}
                  alt={`Capture ${idx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Right Side: Strip Canvas */}
        <div
          className="shrink-0 flex justify-center items-center bg-[var(--c-surface-1)] rounded-[var(--r-lg)] p-4 border border-[var(--c-border)] w-full md:w-auto md:flex-1 overflow-hidden"
          style={{ minHeight: "300px", maxHeight: "80vh" }}
        >
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <StripCanvas
              layoutId={layoutId}
              design={designPreset ?? undefined}
              designId={designId}
              photos={assignedPhotos}
              onSlotClick={handleSlotClick}
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
      </div>

      {/* Next Button */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <button
          disabled={!isComplete || !isHost}
          onClick={handleNext}
          style={{
            background: isComplete ? "var(--c-text-hi)" : "var(--c-surface-2)",
            color: isComplete ? "var(--c-bg)" : "var(--c-text-md)",
            border: "none",
            borderRadius: "var(--r-full)",
            padding: "var(--sp-4) var(--sp-8)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            cursor: isComplete && isHost ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            opacity: !isHost && isComplete ? 0.5 : 1,
          }}
        >
          {isHost ? "Next" : "Waiting for Host..."}
        </button>
      </div>
    </div>
  );
}
