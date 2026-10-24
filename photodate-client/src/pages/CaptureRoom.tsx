import RestartRoundDialog from "../components/capture/RestartRoundDialog";
import { participantTiles } from "../lib/photoComposition";
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
    retakeFrameIndex,
    shotDeadlines,
    readyParticipantIds,
    approvedParticipantIds,
    connectionStatus,
    captureResumeVersion,
  } = useRoomStore();
  const { timerMode, shotCount, layoutId, designPreset, stripTitle } =
    useSessionStore();
  const [restartRound, setRestartRound] = useState<string | null>(null);
  const [localShots, setLocalShots] = useState<string[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [cameraMirrored, setCameraMirrored] = useState(true);
  const [orientation, setOrientation] = useState<
    "auto" | "landscape" | "portrait"
  >("auto");
  const capturedKeys = useRef(new Set<string>());
  const [flashShot, setFlashShot] = useState(0);
  const [votePending, setVotePending] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  useEffect(() => {
    setApprovalError("");
    setVotePending(false);
  }, [approvedParticipantIds, roundId]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const customLayout = useSessionStore((s) => s.customLayout);
  const layout = getLayout(layoutId, customLayout);
  const slotAspect = slotAspectRatio(
    layout,
    Math.min(index, layout.slotCount - 1),
  );
  const tiles = participantTiles(Math.max(1, participants.length), slotAspect);
  const selfIndex = Math.max(
    0,
    [...participants]
      .sort((a, b) => a.slot_index - b.slot_index)
      .findIndex((p) => p.id === selfId),
  );
  const tile = tiles[selfIndex] ?? tiles[0];
  const automaticAspect = (slotAspect * tile.width) / tile.height;
  const cameraAspect =
    orientation === "landscape"
      ? 16 / 9
      : orientation === "portrait"
        ? 3 / 4
        : automaticAspect;
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
    if (value && pending.current.length === 0) setError("");
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
    setIndex((i) =>
      current.retakeFrameIndex != null
        ? current.shotDeadlines.length
        : Math.max(i, frame + 1),
    );
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
  const completedShots =
    retakeFrameIndex !== null && retakeFrameIndex !== undefined
      ? Math.max(0, shotDeadlines.length - 1) +
        (index >= shotDeadlines.length ? 1 : 0)
      : Math.min(index, shotDeadlines.length || shotCount);
  const shotTaken = (i: number) =>
    retakeFrameIndex !== null && retakeFrameIndex !== undefined
      ? i !== retakeFrameIndex || index >= shotDeadlines.length
      : i < completedShots;
  const vote = () => {
    if (!roomCode) return;
    setVotePending(true);
    setApprovalError("");
    const desired = !approved;
    socket
      .timeout(15000)
      .emit(
        "capture-approval",
        { code: roomCode, approved: desired },
        (timeout, ack) => {
          setVotePending(false);
          if (
            timeout &&
            useRoomStore
              .getState()
              .approvedParticipantIds.includes(selfId ?? "") !== desired
          )
            setApprovalError(
              "Approval wasn’t confirmed. Check your connection and try again.",
            );
          else if (!timeout && !ack.ok) setApprovalError(ack.error.message);
          else setApprovalError("");
        },
      );
  };
  return (
    <section
      className={`studio-page capture-studio${layout.stripAspectRatio >= 1 ? " has-wide-keepsake" : ""}${activeCapture ? " is-shooting" : ""}`}
    >
      {retakeFrameIndex !== null && retakeFrameIndex !== undefined && (
        <div className="retake-session-note" role="status">
          Retaking shot {retakeFrameIndex + 1} only. Your other photos are kept.{" "}
          {!activeCapture && "Everyone approves before the new countdown."}
        </div>
      )}
      {activeCapture && (
        <div className="shoot-session-heading">
          <div className="shoot-session-title">
            <span className="shoot-recording">
              <i />{" "}
              {index >= shotDeadlines.length
                ? "SAVING YOUR MOMENTS"
                : "PHOTO DATE · LIVE"}
            </span>
            <h1>
              {index >= shotDeadlines.length
                ? "That’s a wrap."
                : "This is your moment."}
            </h1>
          </div>
          <div className="shoot-take-counter">
            <span>TAKE</span>
            <strong>
              {String(Math.min(index + 1, shotDeadlines.length)).padStart(
                2,
                "0",
              )}
              <small> / {String(shotDeadlines.length).padStart(2, "0")}</small>
            </strong>
          </div>
        </div>
      )}
      <header className="studio-heading">
        <div>
          <span className="studio-eyebrow">
            <Sparkles size={14} /> YOUR LITTLE PHOTO STUDIO
          </span>
          <h1>
            {activeCapture
              ? index >= shotDeadlines.length
                ? "Beautiful. Saving your moments."
                : "A little pose. A little magic."
              : "Your moment. Your crew."}
          </h1>
          <p>
            {activeCapture
              ? "Follow the countdown, switch up your pose, and have fun."
              : "Find your light. Get comfortable. We’ll capture the rest."}
          </p>
        </div>
        <span className="studio-room-tag">
          ROOM <strong>{roomCode}</strong>
        </span>
      </header>
      <nav className="capture-steps" aria-label="Session progress">
        <span className={!activeCapture ? "is-active" : "is-done"}>
          <b>{activeCapture ? "✓" : "01"}</b> Get ready
        </span>
        <span className={activeCapture ? "is-active" : ""}>
          <b>02</b> Strike a pose
        </span>
        <span>
          <b>03</b> Make it yours
        </span>
        <small>
          {layout.name} · {shotCount} shots
        </small>
      </nav>
      <div className="capture-studio-grid">
        <div className="capture-main">
          <div className="camera-card studio-card">
            <div className="studio-card-heading">
              <span>
                <Camera size={17} />
                {activeCapture
                  ? "You’re in the spotlight"
                  : "Find your best angle"}
              </span>
              <span className={`studio-pill ${ready ? "is-ready" : ""}`}>
                {ready ? "Camera ready" : "Connecting camera"}
              </span>
            </div>
            <div className="camera-settings">
              <label>
                Camera
                <select
                  value={deviceId}
                  disabled={activeCapture}
                  onChange={(e) => setDeviceId(e.target.value)}
                  aria-label="Choose built-in or external camera"
                >
                  <option value="">Automatic / front or rear</option>
                  {deviceId &&
                    !devices.some((d) => d.deviceId === deviceId) && (
                      <option value={deviceId}>
                        Camera disconnected — choose another
                      </option>
                    )}
                  {devices
                    .filter((d) => d.deviceId)
                    .map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                </select>
              </label>
              <fieldset disabled={activeCapture}>
                <legend>Framing</legend>
                <div className="camera-orientations">
                  {(["auto", "landscape", "portrait"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={orientation === mode}
                      onClick={() => {
                        if (orientation === mode) return;
                        onReady(false);
                        setOrientation(mode);
                        onReady(ready);
                      }}
                    >
                      {mode === "auto"
                        ? "Auto"
                        : mode === "landscape"
                          ? "Landscape"
                          : "Portrait"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p>
                Connect a USB camera or capture card, then select it here.
                Camera names appear after permission. Framing changes your
                photo; the chosen strip stays the same and fits the result.
              </p>
            </div>
            {activeCapture && (
              <div className="shoot-viewfinder-bar">
                <span>
                  <i /> YOUR VIEWFINDER
                </span>
                <span>
                  {orientation === "auto"
                    ? "Auto framing"
                    : orientation === "portrait"
                      ? "Portrait"
                      : "Landscape"}
                </span>
              </div>
            )}
            <div className="camera-stage">
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
                {activeCapture && (
                  <div className="shoot-viewfinder-guides" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                )}
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
                  preserveSourceAspect={orientation === "auto" && layout.mixed}
                  deviceId={deviceId}
                  onDevices={setDevices}
                  onMirroredChange={setCameraMirrored}
                  onStream={setCameraStream}
                  onCountdownChange={setLiveCount}
                  onCapture={capture}
                  onReady={onReady}
                  onError={setError}
                />
              </div>
            </div>
            {activeCapture && (
              <div className="shoot-pose-cue" role="status">
                <strong>
                  {index >= shotDeadlines.length
                    ? "Lovely. Bringing everyone’s photos together…"
                    : [
                        "Find your light. Give us a little smile.",
                        "A new pose. A little more you.",
                        "Keep the good energy going.",
                        "One more memory to keep.",
                      ][index % 4]}
                </strong>
                <span>
                  {index >= shotDeadlines.length
                    ? "Keep this tab open while uploads finish."
                    : "Follow the countdown. We’ll take care of the rest."}
                </span>
              </div>
            )}
            <div className="camera-card-caption">
              <span className="live-dot" />
              {participants.length > 1
                ? "Your view · your crew’s photos join after capture"
                : "Just you, your camera, and a little creativity"}
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
            {activeCapture && (
              <div
                className="shoot-contact-roll"
                aria-label="Photos from this round"
              >
                {Array.from({ length: shotDeadlines.length }, (_, i) => (
                  <div
                    key={i}
                    className={`shoot-contact-frame${shotTaken(i) ? " is-taken" : i === index ? " is-next" : ""}`}
                    aria-label={`Photo ${i + 1}: ${shotTaken(i) ? "taken" : i === index ? "up next" : "waiting"}`}
                  >
                    {localShots[i] ? (
                      <img src={localShots[i]} alt={`Your shot ${i + 1}`} />
                    ) : (
                      <span>{String(i + 1).padStart(2, "0")}</span>
                    )}
                    {shotTaken(i) && <Check size={11} />}
                  </div>
                ))}
              </div>
            )}
            <ol>
              {Array.from(
                { length: activeCapture ? shotDeadlines.length : shotCount },
                (_, i) => (
                  <li
                    key={i}
                    className={
                      shotTaken(i)
                        ? "is-complete"
                        : activeCapture && i === index
                          ? "is-current"
                          : ""
                    }
                    aria-current={
                      activeCapture && i === index ? "step" : undefined
                    }
                  >
                    {shotTaken(i) ? <Check size={16} /> : i + 1}
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
              <span>{activeCapture ? "YOUR PRINT" : "✦ The keepsake"}</span>
              <span className="studio-pill" aria-live="polite">
                {index < shotCount
                  ? `${index + 1} / ${shotCount}`
                  : "All captured"}
              </span>
            </div>
            <div
              className="capture-strip-preview"
              style={
                layout.stripAspectRatio >= 1
                  ? { aspectRatio: String(layout.stripAspectRatio) }
                  : undefined
              }
            >
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
                    <LiveSlot
                      stream={cameraStream}
                      count={activeCapture ? null : liveCount}
                      mirrored={cameraMirrored}
                    />
                  ) : null
                }
              />
            </div>
            <div className="keepsake-caption">
              <strong>{designPreset?.name ?? "Your chosen frame"}</strong>
              <span>Pick your favorite order after the shots.</span>
            </div>
          </section>
          {(error || approvalError) && (
            <div className="studio-error" role="alert">
              {error || approvalError}
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
            <Users size={14} /> YOUR CREW
          </span>
          <h2 id="approval-heading">
            {activeCapture ? "Making memories." : "Ready together?"}
          </h2>
          <p>
            {activeCapture
              ? "Stay here until everyone’s photos finish uploading."
              : "Each person taps ready on their own device."}
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
                    <Clock3 size={15} /> Time between shots
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
                onClick={() => setRestartRound(roundId)}
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
      {restartRound && restartRound === roundId && activeCapture && (
        <RestartRoundDialog
          roundId={restartRound}
          onClose={() => setRestartRound(null)}
        />
      )}
    </section>
  );
}
