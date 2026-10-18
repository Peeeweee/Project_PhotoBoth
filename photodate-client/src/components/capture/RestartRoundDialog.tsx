import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { socket } from "../../lib/socket";
import { useRoomStore } from "../../state/useRoomStore";

export default function RestartRoundDialog({
  roundId,
  onClose,
}: {
  roundId: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="restart-round-card"
      role="alertdialog"
      aria-labelledby="restart-title"
      aria-describedby="restart-description"
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        className="restart-card-close"
        aria-label="Keep shooting and close"
        disabled={busy}
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <div className="restart-card-icon">
        <RotateCcw size={26} strokeWidth={1.5} />
      </div>
      <span className="studio-eyebrow">A FRESH TAKE</span>
      <h2 id="restart-title">Another round?</h2>
      <p id="restart-description">
        Restart the shots for your whole crew. This round’s photos will be
        cleared, and everyone will need to get ready again.
      </p>
      <div className="restart-card-note">
        <span>Worth keeping?</span>Finish this round first if you want to save
        these photos.
      </div>
      <p className="restart-card-live">
        Your camera keeps shooting while you decide.
      </p>
      {error && (
        <p className="restart-card-error" role="alert">
          {error}
        </p>
      )}
      <div className="restart-card-actions">
        <button autoFocus disabled={busy} onClick={onClose}>
          Keep shooting
        </button>
        <button
          className="action-primary"
          disabled={busy}
          onClick={() => {
            const room = useRoomStore.getState();
            if (
              !room.isHost ||
              !room.roomCode ||
              room.roundId !== roundId ||
              room.status !== "capturing"
            ) {
              onClose();
              return;
            }
            setBusy(true);
            setError("");
            socket.emit(
              "update-room-state",
              { code: room.roomCode, status: "ready" },
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
          <RotateCcw size={15} />
          {busy ? "Restarting…" : "Restart round"}
        </button>
      </div>
    </dialog>
  );
}
