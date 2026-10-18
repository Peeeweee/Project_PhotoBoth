import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LayoutTemplate, X } from "lucide-react";
import { useRoomStore } from "../../state/useRoomStore";
import { useSessionStore } from "../../state/useSessionStore";
import { socket } from "../../lib/socket";

export default function ReturnToSetupDialog({
  request,
  onClose,
  onReturned,
}: {
  request: { code: string; roundId: string | null };
  onClose: () => void;
  onReturned: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const confirm = () => {
    const room = useRoomStore.getState();
    if (
      !room.isHost ||
      room.roomCode !== request.code ||
      room.roundId !== request.roundId ||
      !["reviewing", "editing", "exporting"].includes(room.status)
    ) {
      setError(
        "The session has changed. Close this card and check your current step.",
      );
      return;
    }
    const design = useSessionStore.getState().designPreset;
    setBusy(true);
    setError("");
    socket
      .timeout(8000)
      .emit(
        "update-room-state",
        { code: request.code, status: "waiting" },
        (timeout, ack) => {
          setBusy(false);
          if (timeout)
            setError(
              "Your request wasn’t confirmed. Check your connection and try again.",
            );
          else if (!ack.ok) setError(ack.error.message);
          else {
            if (design) useSessionStore.getState().setDesignPreset(design);
            onReturned();
          }
        },
      );
  };
  return (
    <dialog
      ref={ref}
      className="restart-round-card"
      role="alertdialog"
      aria-labelledby="setup-return-title"
      aria-describedby="setup-return-description"
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        className="restart-card-close"
        aria-label="Keep my photos and close"
        disabled={busy}
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <div className="restart-card-icon">
        <LayoutTemplate size={26} strokeWidth={1.5} />
      </div>
      <span className="studio-eyebrow">A DIFFERENT LITTLE LOOK</span>
      <h2 id="setup-return-title">Back to the drawing board?</h2>
      <p id="setup-return-description">
        Return to setup to choose another strip or frame. This clears the
        current round’s photos and approvals for everyone in your crew.
      </p>
      <div className="restart-card-note">
        <span>Love these shots?</span>Stay here and finish your keepsake first
        to save them.
      </div>
      {error && (
        <p className="restart-card-error" role="alert">
          {error}
        </p>
      )}
      <div className="restart-card-actions">
        <button autoFocus disabled={busy} onClick={onClose}>
          Keep my photos
        </button>
        <button className="action-primary" disabled={busy} onClick={confirm}>
          <ArrowLeft size={15} />
          {busy ? "Returning…" : "Clear photos & return"}
        </button>
      </div>
    </dialog>
  );
}
