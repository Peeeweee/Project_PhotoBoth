import { publishStage } from "../lib/session";
import { composeCaptures } from "../lib/composeCaptures";
import { useState, useEffect } from "react";
import { ArrowRight, Check, Images, WandSparkles } from "lucide-react";
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

  const isComplete =
    assignedPhotos.length === layout.slotCount && assignedPhotos.every(Boolean);

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
            setLoadError(res.error.message);
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

  const filled = assignedPhotos.filter(Boolean).length;
  return (
    <section className="studio-page review-studio">
      <header className="studio-heading">
        <div>
          <span className="studio-eyebrow">
            <Images size={14} /> THE CAMERA ROLL
          </span>
          <h1>Keep the good ones.</h1>
          <p>
            Choose the moments that feel like you. A favorite can appear more
            than once.
          </p>
        </div>
        <span className="studio-room-tag">
          {layout.name}
          <strong>
            {filled} / {layout.slotCount} filled
          </strong>
        </span>
      </header>
      <div className="review-studio-grid">
        <aside className="photo-library studio-card">
          <div className="studio-card-heading">
            <span>
              <Images size={17} /> Your shots
            </span>
            <span className="studio-pill">{captures.length} photos</span>
          </div>
          <p className="studio-note">
            {isHost
              ? "Tap a photo to fill the next empty frame. Tap a frame in the preview to clear it."
              : "Your host is arranging the shared strip. Watch it come together here."}
          </p>
          <div className="photo-library-grid">
            {captures.map((capture, idx) => {
              const used = assignedPhotos.filter(
                (p) => p === capture.image_url,
              ).length;
              return (
                <button
                  key={capture.id}
                  className={`shot-choice ${used ? "is-used" : ""}`}
                  disabled={!isHost || isComplete}
                  onClick={() => handleSelectThumbnail(capture.image_url)}
                  aria-label={`Use photo ${idx + 1}${used ? `, used ${used} times` : ""}`}
                >
                  <img
                    src={capture.image_url}
                    alt={`Shot ${idx + 1}`}
                    draggable={false}
                  />
                  <span className="shot-number">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  {used > 0 && (
                    <span className="shot-used">
                      <Check size={12} />
                      {used > 1 ? used : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {isHost && (
            <div className="library-actions">
              <button
                className="action-secondary studio-wide"
                disabled={!captures.length || isComplete}
                onClick={() =>
                  setAssignedPhotos(
                    assignedPhotos.map(
                      (p, i) => p || captures[i % captures.length].image_url,
                    ),
                  )
                }
              >
                <WandSparkles size={16} /> Fill my strip
              </button>
              <button
                className="studio-text-button"
                disabled={!filled}
                onClick={() =>
                  setAssignedPhotos(Array(layout.slotCount).fill(null))
                }
              >
                Clear selection
              </button>
            </div>
          )}
        </aside>
        <div className="review-preview studio-card">
          <div className="studio-card-heading">
            <span>YOUR KEEPSAKE</span>
            {isHost && (
              <button
                className="studio-text-button"
                aria-pressed={showWatermark}
                onClick={() => setShowWatermark(!showWatermark)}
              >
                {showWatermark ? "Hide branding" : "Show branding"}
              </button>
            )}
          </div>
          <div className="review-canvas">
            <StripCanvas
              layoutId={layoutId}
              design={designPreset ?? undefined}
              designId={designId}
              photos={assignedPhotos}
              onSlotClick={isHost ? handleSlotClick : undefined}
              title={stripTitle}
              showWatermark={showWatermark}
            />
          </div>
          <div className="preview-caption">
            <span>{designPreset?.name ?? "Classic frame"}</span>
            <span>
              {filled === layout.slotCount
                ? "Looking good ✨"
                : `${layout.slotCount - filled} frames to fill`}
            </span>
          </div>
        </div>
      </div>
      <footer className="studio-footer">
        <div>
          <strong>
            {isComplete
              ? "Your strip is looking good."
              : "A few more moments to choose."}
          </strong>
          <p>
            {isHost
              ? "Next up: filters, stickers, and all the finishing touches."
              : "Your host will continue when the strip is ready."}
          </p>
        </div>
        <button
          className="action-primary"
          disabled={!isComplete || !isHost}
          onClick={handleNext}
        >
          {isHost ? "Make it yours" : "Waiting for host"}
          <ArrowRight size={17} />
        </button>
      </footer>
    </section>
  );
}
