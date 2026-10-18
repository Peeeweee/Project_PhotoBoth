import { useEffect, useRef, useState } from "react";
import { leaveRoom } from "../../lib/api";
import { leaveSession } from "../../lib/session";
import { useRoomStore } from "../../state/useRoomStore";
import { useNavigate } from "react-router-dom";
const reasons = [
  "Session finished",
  "I need to go",
  "Camera or microphone trouble",
  "Connection problems",
  "Joining another room",
  "Prefer not to say",
];
export default function LeaveDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const room = useRoomStore();
  const navigate = useNavigate();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="leave-dialog"
      aria-labelledby="leave-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <span className="studio-eyebrow">BEFORE YOU GO</span>
      <h2 id="leave-title">
        {room.isHost ? "End this photo date?" : "Leave this photo date?"}
      </h2>
      <p>
        {room.isHost
          ? "You’re the host. Leaving closes the room for everyone."
          : "You’ll leave the crew and stop taking photos in this room."}{" "}
        Save your keepsake first if you want a copy.
      </p>
      <label htmlFor="leave-reason">Let your crew know why</label>
      <select
        id="leave-reason"
        value={reason}
        disabled={busy}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      >
        <option value="" disabled>
          Choose a reason
        </option>
        {reasons.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <small>Your name and selected reason will be shared with the room.</small>
      {error && <p role="alert">{error}</p>}
      <div className="leave-actions">
        <button disabled={busy} onClick={onClose}>
          Stay here
        </button>
        <button
          className="action-primary"
          disabled={!reason || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              if (room.roomCode && room.status !== "closed")
                await leaveRoom(room.roomCode, reason);
              leaveSession(true);
              onClose();
              navigate("/");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Could not leave. Please retry.",
              );
              setBusy(false);
            }
          }}
        >
          {busy ? "Leaving…" : room.isHost ? "End room & leave" : "Leave room"}
        </button>
      </div>
    </dialog>
  );
}
