import { useState, useEffect, useCallback, useRef } from "react";
import { socket } from "../lib/socket";
import { uploadCapture } from "../lib/api";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import {
  Camera,
  Check,
  Clock3,
  Sparkles,
  Users,
  ArrowRight,
} from "lucide-react";
import { getLayout, slotAspectRatio } from "../data/stripLayouts";
import { StripCanvas } from "../components/editor";
import LiveSlot from "../components/capture/LiveSlot";
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
    approvedParticipantIds,
    connectionStatus,
    captureResumeVersion,
  } = useRoomStore();
  const { timerMode, shotCount, layoutId, designPreset, stripTitle } =
    useSessionStore();
  const [localShots, setLocalShots] = useState<string[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const columns = participants.length > 1 ? 2 : 1;
  const rows = Math.ceil(Math.max(1, participants.length) / columns);
  const capturedKeys = useRef(new Set<string>());
  const [flashShot, setFlashShot] = useState(0);
  const [votePending, setVotePending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const layout = getLayout(layoutId);
  const cameraAspect =
    (slotAspectRatio(layout, Math.min(index, layout.slotCount - 1)) * rows) /
    columns;
  const [counting, setCounting] = useState(false);
  const [remaining, setRemaining] = useState(3);
  const [uploaded, setUploaded] = useState(0);
  const pending = useRef<
    { index: number; data: string; roundId: string | null }[]
  >([]);
  const uploadedFrames = useRef(new Set<number>());
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
    if (changed) uploadedFrames.current.clear();
    frames.forEach((frame) => uploadedFrames.current.add(frame));
    setUploaded(uploadedFrames.current.size);
    setCounting(false);
    if (changed) {
      setLocalShots([]);
      pending.current = [];
      capturedKeys.current.clear();
      setError("");
    }
  }, [roundId, captureResumeVersion]);
  useEffect(() => {
    if (status !== "capturing" || !ready || !shotDeadlines[index]) return;
    const delay = Math.max(0, shotDeadlines[index] - Date.now());
    setRemaining(Math.max(1, Math.ceil(delay / 1000)));
    setCounting(true);
  }, [status, ready, index, shotDeadlines]);
  useEffect(() => {
    if (status === "ready" && ready && roomCode && socket.connected)
      socket.emit("capture-ready", { code: roomCode, ready: true }, (ack) => {
        if (!ack.ok) setError(ack.error.message);
      });
  }, [status, roundId, ready, roomCode]);
  const capture = async (
    data: string,
    frame: number,
    capturedRound: string | null,
  ) => {
    const current = useRoomStore.getState();
    const key = `${capturedRound}:${frame}`;
    if (
      !capturedRound ||
      current.roundId !== capturedRound ||
      current.status !== "capturing" ||
      frame < 0 ||
      frame >= current.shotDeadlines.length ||
      capturedKeys.current.has(key)
    )
      return;
    capturedKeys.current.add(key);
    setLiveCount(null);
    setLocalShots((shots) => {
      const next = [...shots];
      next[frame] = data;
      return next;
    });
    setCounting(false);
    setFlashShot((n) => n + 1);
    setIndex((i) => Math.max(i, frame + 1));
    pending.current.push({ index: frame, data, roundId: capturedRound });
    try {
      if (!roomCode || !selfId) throw new Error("Session missing");
      await uploadCapture(roomCode, selfId, frame, data, capturedRound);
      if (roundRef.current === capturedRound) {
        pending.current = pending.current.filter((x) => x.index !== frame);
        uploadedFrames.current.add(frame);
        setUploaded(uploadedFrames.current.size);
        if (!pending.current.length) setError("");
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
        uploadedFrames.current.add(item.index);
        setUploaded(uploadedFrames.current.size);
        if (!pending.current.length) setError("");
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
  const activeCapture = status === "capturing";
  const approved = approvedParticipantIds.includes(selfId ?? "");
  const allApproved =
    participants.length > 0 &&
    participants.every(
      (p) =>
        p.online &&
        readyParticipantIds.includes(p.id) &&
        approvedParticipantIds.includes(p.id),
    );
  const crewProgress = activeCapture
    ? readyParticipantIds.length
    : approvedParticipantIds.length;
  const completedShots = Math.min(index, shotDeadlines.length || shotCount);
  const vote = () => {
    if (!roomCode) return;
    setVotePending(true);
    setError("");
    socket
      .timeout(8000)
      .emit(
        "capture-approval",
        { code: roomCode, approved: !approved },
        (timeout, ack) => {
          setVotePending(false);
          if (timeout) setError("Approval timed out. Please try again.");
          else if (!ack.ok) setError(ack.error.message);
        },
      );
  };
  return (
    <section className="studio-page capture-studio">
      <header className="studio-heading">
        <div>
          <span className="studio-eyebrow">
            <Sparkles size={14} /> YOUR LITTLE PHOTO STUDIO
          </span>
          <h1>
            {activeCapture
              ? index >= shotDeadlines.length
                ? "Beautiful. Saving your moments."
                : "Make a little memory."
              : "A good moment starts here."}
          </h1>
          <p>
            {activeCapture
              ? "Follow the countdown, switch up your pose, and have fun."
              : "Find your light, gather your people, and tell us when you’re ready."}
          </p>
        </div>
        <span className="studio-room-tag">
          ROOM <strong>{roomCode}</strong>
        </span>
      </header>
      <div className="capture-studio-grid">
        <div className="capture-main">
          <div className="camera-card studio-card">
            <div className="studio-card-heading">
              <span>
                <Camera size={17} />
                {activeCapture ? "In the moment" : "Your camera preview"}
              </span>
              <span className={`studio-pill ${ready ? "is-ready" : ""}`}>
                {ready ? "Camera ready" : "Connecting camera"}
              </span>
            </div>
            <div
              className="capture-preview studio-camera-frame"
              style={{
                width: `min(100%, calc(var(--camera-preview-height, 420px) * ${cameraAspect}))`,
                aspectRatio: String(cameraAspect),
                maxHeight: "none",
                minHeight: 0,
                marginInline: "auto",
              }}
            >
              {flashShot > 0 && (
                <div
                  key={flashShot}
                  className="shutter-flash"
                  aria-hidden="true"
                />
              )}
              <CameraView
                isActive
                participants={participants}
                selfId={selfId ?? undefined}
                isCountingDown={counting}
                timerSeconds={remaining}
                shotDeadline={shotDeadlines[index]}
                frameIndex={index}
                roundId={roundId}
                captureAspectRatio={cameraAspect}
                allowCameraSwitch={!activeCapture}
                preserveSourceAspect={layout.mixed}
                onStream={setCameraStream}
                onCountdownChange={setLiveCount}
                onCapture={capture}
                onReady={onReady}
                onError={setError}
              />
            </div>
            <div className="camera-card-caption">
              <span className="live-dot" /> Your camera stays on your device.
              Everyone’s photos come together after capture.
            </div>
          </div>
          <div className="shot-timeline studio-card" aria-label="Shot progress">
            <div>
              <strong>
                {activeCapture
                  ? `${completedShots} of ${shotDeadlines.length} shots taken`
                  : `${shotCount} moments to make`}
              </strong>
              <span>
                {activeCapture
                  ? `${uploaded} uploaded`
                  : `${timerMode}s between shots`}
              </span>
            </div>
            <ol>
              {Array.from(
                { length: activeCapture ? shotDeadlines.length : shotCount },
                (_, i) => (
                  <li
                    key={i}
                    className={
                      i < completedShots
                        ? "is-complete"
                        : activeCapture && i === index
                          ? "is-current"
                          : ""
                    }
                    aria-current={
                      activeCapture && i === index ? "step" : undefined
                    }
                  >
                    {i < completedShots ? <Check size={16} /> : i + 1}
                  </li>
                ),
              )}
            </ol>
          </div>
          <section
            className="capture-keepsake studio-card"
            aria-label="Your strip taking shape"
          >
            <div className="studio-card-heading">
              <span>✦ Your strip, coming to life</span>
              <span className="studio-pill" aria-live="polite">
                {index < shotCount
                  ? `Next: frame ${index + 1}`
                  : "Ready to review"}
              </span>
            </div>
            <div className="capture-strip-preview">
              {flashShot > 0 && (
                <div
                  key={flashShot}
                  className="shutter-flash"
                  aria-hidden="true"
                />
              )}
              <StripCanvas
                layoutId={layoutId}
                design={designPreset ?? undefined}
                designId={designPreset?.id ?? "solid-white"}
                photos={localShots}
                title={stripTitle}
                activeSlot={index < shotCount ? index : undefined}
                renderSlot={(slot) =>
                  cameraStream &&
                  ready &&
                  slot === index &&
                  index < shotCount ? (
                    <LiveSlot stream={cameraStream} count={liveCount} />
                  ) : null
                }
              />
            </div>
            <p className="studio-note">
              Your shots land in the highlighted frame. Everyone’s photos
              combine after upload; choose or reorder them together next.
            </p>
          </section>
          {error && (
            <div className="studio-error" role="alert">
              {error}
              {pending.current.length > 0 && (
                <button className="action-secondary" onClick={retry}>
                  Retry uploads
                </button>
              )}
            </div>
          )}
        </div>
        <aside
          className="capture-sidebar studio-card"
          aria-labelledby="approval-heading"
        >
          <span className="studio-eyebrow">
            <Users size={14} /> THE WHOLE CREW
          </span>
          <h2 id="approval-heading">
            {activeCapture ? "You’re making memories." : "Everyone in?"}
          </h2>
          <p>
            {activeCapture
              ? "Keep this page open while your photos upload. We’ll take you to your camera roll together."
              : "A little check-in before we start. Each person approves from their own device."}
          </p>
          <div className="crew-summary">
            <strong>
              {activeCapture
                ? readyParticipantIds.length
                : approvedParticipantIds.length}
              <small> / {participants.length}</small>
            </strong>
            <span>{activeCapture ? "cameras ready" : "ready to start"}</span>
          </div>
          <div
            className="crew-progress"
            role="progressbar"
            aria-label={activeCapture ? "Cameras ready" : "Member approvals"}
            aria-valuenow={crewProgress}
            aria-valuemin={0}
            aria-valuemax={participants.length || 1}
          >
            <span
              style={{
                width: `${participants.length ? (crewProgress / participants.length) * 100 : 0}%`,
              }}
            />
          </div>
          <ul className="crew-list">
            {participants.map((p) => {
              const memberApproved = approvedParticipantIds.includes(p.id);
              const cameraOn = readyParticipantIds.includes(p.id);
              return (
                <li key={p.id}>
                  <span
                    className={`crew-avatar ${memberApproved || (activeCapture && cameraOn) ? "is-ready" : ""}`}
                  >
                    {p.display_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>
                      {p.display_name}
                      {p.id === selfId && <small> (you)</small>}
                    </strong>
                    <span>
                      {!p.online
                        ? "Reconnecting…"
                        : !cameraOn
                          ? "Setting up camera"
                          : activeCapture
                            ? "Capturing with you"
                            : memberApproved
                              ? "Ready for the moment"
                              : "Waiting for approval"}
                    </span>
                  </div>
                  <span
                    className={`crew-check ${memberApproved || (activeCapture && cameraOn) ? "is-ready" : ""}`}
                  >
                    {memberApproved || (activeCapture && cameraOn) ? (
                      <Check size={16} />
                    ) : (
                      <Clock3 size={16} />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {!activeCapture ? (
            <>
              <button
                className={
                  approved
                    ? "action-secondary studio-wide"
                    : "action-primary studio-wide"
                }
                disabled={
                  !ready || connectionStatus !== "joined" || votePending
                }
                aria-pressed={approved}
                onClick={vote}
              >
                {votePending
                  ? "Sending…"
                  : approved
                    ? "✓ Approved · undo"
                    : "I’m ready!"}
              </button>
              {isHost && (
                <div className="host-launch">
                  <label id="countdown-label">
                    <Clock3 size={15} /> Time to strike a pose
                  </label>
                  <div
                    className="countdown-options"
                    role="group"
                    aria-labelledby="countdown-label"
                  >
                    {[3, 5, 10].map((n) => (
                      <button
                        key={n}
                        aria-pressed={timerMode === n}
                        disabled={connectionStatus !== "joined"}
                        onClick={() => {
                          if (timerMode === n) return;
                          if (roomCode && selfId)
                            socket.emit(
                              "update-timer-mode",
                              {
                                code: roomCode,
                                participantId: selfId,
                                timerSeconds: n,
                              },
                              (ack) => {
                                if (!ack.ok) setError(ack.error.message);
                              },
                            );
                        }}
                      >
                        {n}
                        <small> sec</small>
                      </button>
                    ))}
                  </div>
                  <button
                    className="action-primary studio-wide"
                    disabled={
                      !ready || connectionStatus !== "joined" || !allApproved
                    }
                    onClick={start}
                  >
                    Let’s take photos <ArrowRight size={17} />
                  </button>
                  <small>
                    {allApproved
                      ? "All set. You can start whenever you like."
                      : "Start unlocks when everyone has approved."}
                  </small>
                </div>
              )}
              {!isHost && (
                <p className="studio-note">
                  Once everyone approves, your host starts the countdown.
                </p>
              )}
            </>
          ) : (
            <div className="capture-live-note" role="status">
              <span className="live-dot" />
              {index < shotDeadlines.length
                ? `Shot ${Math.min(index + 1, shotDeadlines.length)} of ${shotDeadlines.length}`
                : "Finishing uploads…"}
            </div>
          )}
          {activeCapture && isHost && (
            <div className="round-recovery">
              <button
                className="action-secondary studio-wide"
                onClick={() => {
                  if (roomCode)
                    socket.emit(
                      "update-room-state",
                      { code: roomCode, status: "ready" },
                      (ack) => {
                        if (!ack.ok) setError(ack.error.message);
                      },
                    );
                }}
              >
                Restart this round
              </button>
              <p className="studio-note">
                If someone misses a shot or switches apps, restart together.
                Current round photos will be cleared.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
