import RetakeShotDialog from "../components/capture/RetakeShotDialog";
import PhotoCropDialog from "../components/editor/PhotoCropDialog";
import { DEFAULT_PHOTO_EDIT } from "../lib/photoEdit";
import { suggestedPhotoOrder } from "../lib/photoOrder";
import RoomChat from "../components/RoomChat";
import { publishStage } from "../lib/session";
import { composeCaptures } from "../lib/composeCaptures";
import { useState, useEffect } from "react";
import { ArrowRight, Check, Images, WandSparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import { StripCanvas } from "../components/editor";
import { getLayout, slotAspectRatio } from "../data/stripLayouts";
import { socket } from "../lib/socket";
import { getCaptures } from "../lib/api";

export default function EditorRoom() {
  const navigate = useNavigate();
  const {
    roomCode,
    selfId,
    isHost,
    photoVotes,
    roundId,
    connectionStatus,
    participants,
    reviewApprovals,
    reviewRevision,
    reviewPhotos,
    reviewPhotoEdits,
  } = useRoomStore();
  const {
    layoutId,
    designPreset,
    setAssignedPhotos: setGlobalAssignedPhotos,
    stripTitle,
    showWatermark,
    setShowWatermark,
  } = useSessionStore();

  const customLayout = useSessionStore((s) => s.customLayout);
  const layout = getLayout(layoutId, customLayout);
  const designId = designPreset?.id || "classic";

  const [retakeShot, setRetakeShot] = useState<number | null>(null);
  const photoSources = useSessionStore((s) => s.photoSources);
  const [cropSlot, setCropSlot] = useState<number | null>(null);
  const photoEdits = useSessionStore((s) => s.photoEdits);
  const [captures, setCaptures] = useState<
    { id: string; image_url: string; frame_index: number }[]
  >([]);
  const assignedPhotos = useSessionStore((s) => s.assignedPhotos).length
    ? useSessionStore.getState().assignedPhotos
    : Array<string | null>(layout.slotCount).fill(null);
  const setAssignedPhotos = (photos: (string | null)[]) => {
    const current = useSessionStore.getState();
    const next = photos.map((p) => p ?? "");
    useSessionStore.setState({
      assignedPhotos: next,
      photoEdits: next.map((photo, i) => {
        const old =
          photo === current.assignedPhotos[i]
            ? i
            : current.assignedPhotos.indexOf(photo);
        return photo && old >= 0
          ? (current.photoEdits[old] ?? { ...DEFAULT_PHOTO_EDIT })
          : { ...DEFAULT_PHOTO_EDIT };
      }),
      photoSources: next.map(
        (photo) =>
          captures.find((c) => c.image_url === photo)?.frame_index ?? null,
      ),
    });
  };
  const [voteError, setVoteError] = useState("");
  const [approvalPending, setApprovalPending] = useState(false);
  useEffect(() => {
    setVoteError("");
    setApprovalPending(false);
  }, [reviewRevision, reviewApprovals]);
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
        if (useRoomStore.getState().isHost) {
          const current = useSessionStore.getState();
          const restored = current.assignedPhotos.map((photo, i) =>
            current.photoSources[i] !== null &&
            current.photoSources[i] !== undefined
              ? (sorted.find((c) => c.frame_index === current.photoSources[i])
                  ?.image_url ??
                photo ??
                "")
              : (photo ?? ""),
          );
          if (
            JSON.stringify(restored) !== JSON.stringify(current.assignedPhotos)
          )
            useSessionStore.setState({ assignedPhotos: restored });
        }
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
      setCropSlot(index);
    }
  };

  const vote = (
    frameIndex: number,
    selected: boolean,
    position: number | null = null,
  ) => {
    if (!roomCode || !roundId) return;
    setVoteError("");
    socket
      .timeout(8000)
      .emit(
        "vote-photo",
        { code: roomCode, roundId, frameIndex, selected, position },
        (timeout, ack) => {
          if (timeout)
            setVoteError("Your vote was not confirmed. Reload to check it.");
          else if (!ack.ok) setVoteError(ack.error.message);
        },
      );
  };
  const isComplete =
    assignedPhotos.length === layout.slotCount && assignedPhotos.every(Boolean);
  const orderSynced =
    JSON.stringify(assignedPhotos) === JSON.stringify(reviewPhotos) &&
    JSON.stringify(photoEdits) === JSON.stringify(reviewPhotoEdits);
  const allApproved =
    participants.length > 0 &&
    participants.every((p) => reviewApprovals.includes(p.id));
  const movePhoto = (from: number, to: number) => {
    if (!isHost || to < 0 || to >= assignedPhotos.length) return;
    const next = [...assignedPhotos];
    [next[from], next[to]] = [next[to], next[from]];
    const current = useSessionStore.getState();
    const edits = [...current.photoEdits],
      sources = [...current.photoSources];
    [edits[from], edits[to]] = [edits[to], edits[from]];
    [sources[from], sources[to]] = [sources[to], sources[from]];
    useSessionStore.setState({
      assignedPhotos: next.map((p) => p ?? ""),
      photoEdits: edits,
      photoSources: sources,
    });
  };

  const handleNext = () => {
    // Transition the room state to 'editing'.
    if (isHost && roomCode && selfId) {
      setGlobalAssignedPhotos(assignedPhotos as string[]);
      if (["editing", "exporting"].includes(useRoomStore.getState().status)) {
        publishStage("filter", () => navigate("/filter"));
        return;
      }
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
              ? "Tap a photo to fill the next empty frame. Tap a frame in the preview to crop, zoom or reposition it."
              : "Your host is arranging the shared strip. Watch it come together here."}
          </p>
          <div className="photo-library-grid">
            {captures.map((capture, idx) => {
              const used = assignedPhotos.filter(
                (p) => p === capture.image_url,
              ).length;
              const votes = photoVotes.filter(
                (v) => v.frameIndex === capture.frame_index,
              );
              const mine = votes.find((v) => v.participantId === selfId);
              return (
                <div key={capture.id} className="shot-tile">
                  <button
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
                  {isHost && (
                    <button
                      className="shot-retake-button"
                      disabled={connectionStatus !== "joined"}
                      onClick={() => setRetakeShot(capture.frame_index)}
                    >
                      ↻ Retake this shot
                    </button>
                  )}
                  <div className="photo-vote-controls">
                    <button
                      aria-pressed={!!mine}
                      aria-label={`Vote for photo ${idx + 1}`}
                      disabled={connectionStatus !== "joined"}
                      onClick={() => vote(capture.frame_index, !mine)}
                    >
                      ♡ {votes.length}
                    </button>
                    <select
                      aria-label={`Suggest position for photo ${idx + 1}`}
                      disabled={connectionStatus !== "joined"}
                      value={mine?.position ?? ""}
                      onChange={(e) =>
                        vote(
                          capture.frame_index,
                          true,
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Order…</option>
                      {layout.slots.map((_, i) => (
                        <option key={i} value={i}>
                          Position {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          {isHost && (
            <div className="library-actions">
              <button
                className="action-secondary studio-wide"
                disabled={!photoVotes.length}
                onClick={() => {
                  const ordered = suggestedPhotoOrder(
                    captures,
                    photoVotes,
                    layout.slotCount,
                  );
                  setAssignedPhotos(
                    Array.from(
                      { length: layout.slotCount },
                      (_, i) => ordered[i]?.image_url ?? "",
                    ),
                  );
                }}
              >
                Apply crew votes
              </button>
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
          {voteError && (
            <p className="studio-note" role="alert">
              {voteError}
            </p>
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
      <section className="review-together">
        <div className="studio-card review-decision">
          <h2>One last little check ♡</h2>
          <p className="studio-note">
            Favorite photos and suggest positions above, or talk it through
            here. The host arranges the strip; everyone approves the final
            order. Changing the order resets approvals.
          </p>
          <ol className="review-order-list">
            {assignedPhotos.map((photo, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {photo ? (
                  <img src={photo} alt={`Frame ${i + 1}`} />
                ) : (
                  <span>Empty frame</span>
                )}
                {isHost && (
                  <>
                    {photo && (
                      <button
                        className="studio-text-button"
                        onClick={() => setCropSlot(i)}
                      >
                        Adjust
                      </button>
                    )}
                    {photo && (
                      <button
                        className="studio-text-button"
                        onClick={() => {
                          const next = [...assignedPhotos];
                          next[i] = null;
                          setAssignedPhotos(next);
                        }}
                      >
                        Remove
                      </button>
                    )}
                    <button
                      className="studio-text-button"
                      aria-label={`Move frame ${i + 1} earlier`}
                      disabled={i === 0}
                      onClick={() => movePhoto(i, i - 1)}
                    >
                      ←
                    </button>
                    <button
                      className="studio-text-button"
                      aria-label={`Move frame ${i + 1} later`}
                      disabled={i === assignedPhotos.length - 1}
                      onClick={() => movePhoto(i, i + 1)}
                    >
                      →
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
          <div className="review-member-approvals" aria-live="polite">
            {participants.map((p) => (
              <span className="studio-pill" key={p.id}>
                {reviewApprovals.includes(p.id) && orderSynced ? "✓" : "○"}{" "}
                {p.display_name}
              </span>
            ))}
          </div>
          <button
            className="action-primary"
            disabled={
              !isComplete ||
              !orderSynced ||
              !reviewRevision ||
              approvalPending ||
              connectionStatus !== "joined"
            }
            onClick={() => {
              if (!roomCode) return;
              setVoteError("");
              setApprovalPending(true);
              socket.timeout(15000).emit(
                "review-approval",
                {
                  code: roomCode,
                  revision: reviewRevision,
                  approved: !reviewApprovals.includes(selfId ?? ""),
                },
                (timeout, ack) => {
                  setApprovalPending(false);
                  if (useRoomStore.getState().reviewRevision !== reviewRevision)
                    return;
                  if (timeout)
                    setVoteError(
                      "Approval not confirmed. Check your connection and try again.",
                    );
                  else if (!ack.ok) setVoteError(ack.error.message);
                  else setVoteError("");
                },
              );
            }}
          >
            {approvalPending
              ? "Confirming your approval…"
              : reviewApprovals.includes(selfId ?? "") && orderSynced
                ? "Change my approval"
                : "I love this order"}
          </button>
          {!orderSynced && (
            <p className="studio-note" role="status">
              Saving the latest order…
            </p>
          )}
          {voteError && (
            <p role="alert" className="studio-note">
              {voteError}
            </p>
          )}
        </div>
        <div className="studio-card review-chat">
          <RoomChat />
        </div>
      </section>
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
          disabled={!isComplete || !isHost || !orderSynced || !allApproved}
          onClick={handleNext}
        >
          {isHost
            ? allApproved && orderSynced
              ? "Make it yours"
              : "Waiting for crew approval"
            : "Waiting for host"}
          <ArrowRight size={17} />
        </button>
      </footer>
      {retakeShot !== null && (
        <RetakeShotDialog
          frame={retakeShot}
          slotIndexes={assignedPhotos.flatMap((photo, i) =>
            photoSources[i] === retakeShot ||
            photo ===
              captures.find((capture) => capture.frame_index === retakeShot)
                ?.image_url
              ? [i]
              : [],
          )}
          onClose={() => setRetakeShot(null)}
        />
      )}
      {cropSlot !== null && assignedPhotos[cropSlot] && (
        <PhotoCropDialog
          src={assignedPhotos[cropSlot]!}
          index={cropSlot}
          aspect={slotAspectRatio(layout, cropSlot)}
          initial={photoEdits[cropSlot]}
          onClose={() => setCropSlot(null)}
          onSave={(edit) => {
            const edits = Array.from(
              { length: layout.slotCount },
              (_, i) => photoEdits[i] ?? { ...DEFAULT_PHOTO_EDIT },
            );
            edits[cropSlot] = edit;
            useSessionStore.setState({ photoEdits: edits });
          }}
        />
      )}
    </section>
  );
}
