import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { socket } from "../../lib/socket";
import { useRoomStore } from "../../state/useRoomStore";
import { editorSnapshot } from "../../lib/session";
export default function RetakeShotDialog({
  frame,
  slotIndexes,
  onClose,
}: {
  frame: number;
  slotIndexes: number[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="restart-round-card"
      aria-labelledby="retake-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        className="restart-card-close"
        aria-label="Cancel retake"
        disabled={busy}
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <div className="restart-card-icon">
        <RotateCcw size={26} />
      </div>
      <span className="studio-eyebrow">ONE MORE TAKE</span>
      <h2 id="retake-title">Retake shot {frame + 1}?</h2>
      <p>
        Your other shots and edits stay. Everyone returns to the camera and
        approves before this one shot is replaced.
      </p>
      <p className="restart-card-note">
        The new shot replaces this photo wherever you used it in your strip. The
        crew will review the result again.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="restart-card-actions">
        <button disabled={busy} onClick={onClose}>
          Keep this shot
        </button>
        <button
          className="action-primary"
          disabled={busy}
          onClick={() => {
            const room = useRoomStore.getState();
            if (!room.roomCode || !room.roundId) return;
            setBusy(true);
            socket.emit(
              "prepare-retake",
              {
                code: room.roomCode,
                roundId: room.roundId,
                frameIndex: frame,
                slotIndexes,
                editor: editorSnapshot(),
              },
              (ack) => {
                if (ack.ok) onClose();
                else {
                  setBusy(false);
                  setError(ack.error.message);
                }
              },
            );
          }}
        >
          {busy ? "Preparing…" : "Prepare retake"}
        </button>
      </div>
    </dialog>
  );
}
