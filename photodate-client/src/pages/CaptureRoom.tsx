import { useState, useEffect, useCallback, useRef } from "react";
import { socket } from "../lib/socket";
import { uploadCapture } from "../lib/api";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import { CameraView } from "../components/capture";
export default function CaptureRoom() {
  const {
    roomCode,
    selfId,
    isHost,
    status,
    participants,
    roundId,
    shotDeadlines,
    readyParticipantIds,
    captureResumeVersion,
  } = useRoomStore();
  const { timerMode, shotCount } = useSessionStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [counting, setCounting] = useState(false);
  const [remaining, setRemaining] = useState(3);
  const [uploaded, setUploaded] = useState(0);
  const pending = useRef<
    { index: number; data: string; roundId: string | null }[]
  >([]);
  const roundRef = useRef(roundId);
  roundRef.current = roundId;
  const onReady = useCallback((value: boolean) => {
    setReady(value);
    useRoomStore.setState({ cameraReady: value });
    const code = useRoomStore.getState().roomCode;
    if (code && socket.connected)
      socket.emit("capture-ready", { code, ready: value }, (ack) => {
        if (!ack.ok) setError(ack.error.message);
      });
  }, []);
  const lastRound = useRef(roundId);
  useEffect(() => {
    const frames = useRoomStore.getState().capturedFrameIndexes;
    let next = 0;
    while (frames.includes(next)) next++;
    const changed = lastRound.current !== roundId;
    lastRound.current = roundId;
    setIndex((current) => (changed ? next : Math.max(current, next)));
    setUploaded(frames.length);
    setCounting(false);
    if (changed) pending.current = [];
  }, [roundId, captureResumeVersion]);
  useEffect(() => {
    if (status !== "capturing" || !ready || !shotDeadlines[index]) return;
    const delay = Math.max(0, shotDeadlines[index] - Date.now());
    setRemaining(Math.max(1, Math.ceil(delay / 1000)));
    setCounting(true);
  }, [status, ready, index, shotDeadlines]);
  const capture = async (data: string) => {
    setCounting(false);
    const frame = index;
    const capturedRound = roundId;
    setIndex((i) => i + 1);
    pending.current.push({ index: frame, data, roundId: capturedRound });
    try {
      if (!roomCode || !selfId) throw new Error("Session missing");
      await uploadCapture(roomCode, selfId, frame, data, capturedRound);
      if (roundRef.current === capturedRound) {
        pending.current = pending.current.filter((x) => x.index !== frame);
        setUploaded((n) => n + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };
  const retry = async () => {
    setError("");
    for (const item of [...pending.current]) {
      try {
        await uploadCapture(
          roomCode!,
          selfId!,
          item.index,
          item.data,
          item.roundId,
        );
        pending.current = pending.current.filter((x) => x.index !== item.index);
        setUploaded((n) => n + 1);
      } catch (e) {
        setError(String(e));
        break;
      }
    }
  };
  const start = () => {
    if (roomCode && selfId)
      socket.emit(
        "update-room-state",
        {
          code: roomCode,
          participantId: selfId,
          status: "capturing",
          frameCount: shotCount,
        },
        (ack) => {
          if (!ack.ok) setError(ack.error.message);
        },
      );
  };
  return (
    <section
      style={{
        padding: 24,
        maxWidth: 1000,
        margin: "0 auto",
        display: "grid",
        gap: 20,
      }}
    >
      <h1>
        {status === "capturing"
          ? `Shot ${Math.min(index + 1, shotDeadlines.length)} / ${shotDeadlines.length}`
          : "Get ready"}
      </h1>
      <p>
        Each participant uses their own camera. Your photos are combined after
        everyone has uploaded.
      </p>
      <div style={{ height: "min(60vh,600px)", minHeight: 280 }}>
        <CameraView
          isActive
          participants={participants}
          selfId={selfId ?? undefined}
          isCountingDown={counting}
          timerSeconds={remaining}
          shotDeadline={shotDeadlines[index]}
          onCapture={capture}
          onReady={onReady}
          onError={setError}
        />
      </div>
      {error && (
        <div role="alert">
          {error}{" "}
          {pending.current.length > 0 && (
            <button onClick={retry}>Retry uploads</button>
          )}
        </div>
      )}
      <p role="status">
        {status === "capturing"
          ? `${uploaded} photos uploaded. Waiting for every participant before review.`
          : `${readyParticipantIds.length} cameras ready`}
      </p>
      {isHost && status !== "capturing" && (
        <div>
          <label>
            Countdown{" "}
            <select
              value={timerMode}
              onChange={(e) => {
                if (roomCode && selfId)
                  socket.emit(
                    "update-timer-mode",
                    {
                      code: roomCode,
                      participantId: selfId,
                      timerSeconds: Number(e.target.value),
                    },
                    (ack) => {
                      if (!ack.ok) setError(ack.error.message);
                    },
                  );
              }}
            >
              {[3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n}s
                </option>
              ))}
            </select>
          </label>{" "}
          <button
            disabled={
              !ready ||
              participants.some((p) => !readyParticipantIds.includes(p.id))
            }
            onClick={start}
          >
            Start session
          </button>
        </div>
      )}
    </section>
  );
}
