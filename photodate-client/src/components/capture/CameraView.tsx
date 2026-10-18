import { useRef, useEffect, useState } from "react";

export interface CameraViewProps {
  isCountingDown: boolean;
  timerSeconds: number;
  shotDeadline?: number;
  onCapture: (
    dataUrl: string,
    frameIndex: number,
    roundId: string | null,
  ) => void;
  frameIndex: number;
  roundId: string | null;
  captureAspectRatio?: number;
  isActive?: boolean;
  participants?: { id: string; display_name: string; slot_index: number }[];
  selfId?: string;
  onReady?: (ready: boolean) => void;
  onError?: (message: string) => void;
}

export default function CameraView({
  isCountingDown,
  timerSeconds,
  shotDeadline,
  frameIndex,
  roundId,
  captureAspectRatio = 16 / 9,
  onCapture,
  isActive = true,
  participants = [],
  selfId,
  onReady,
  onError,
}: CameraViewProps) {
  const consumed = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onReady, onError, onCapture });
  callbacks.current = { onReady, onError, onCapture };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    setReady(false);
    callbacks.current.onReady?.(false);
    if (!isActive) return;
    setError("");
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access requires HTTPS or localhost and a supported browser.",
          );
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            if (!cancelled) {
              setReady(false);
              callbacks.current.onReady?.(false);
              setError("Camera disconnected. Reconnect it and retry.");
            }
          };
        });
      } catch (cause) {
        if (cancelled) return;
        const message =
          cause instanceof Error && cause.message.includes("HTTPS")
            ? cause.message
            : "Unable to open your camera. Check browser permissions and close other camera apps, then retry.";
        setError(message);
        callbacks.current.onError?.(message);
      }
    };
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
      callbacks.current.onReady?.(false);
    };
  }, [isActive, retry]);

  useEffect(() => {
    const shotKey = `${roundId}:${frameIndex}`;
    if (
      !isCountingDown ||
      !ready ||
      !roundId ||
      consumed.current.has(shotKey)
    ) {
      setCount(null);
      return;
    }
    const target =
      shotDeadline ?? Date.now() + Math.max(1, timerSeconds) * 1000;
    const updateCount = () =>
      setCount(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    updateCount();
    const ticker = window.setInterval(updateCount, 100);
    const timer = window.setTimeout(
      () => {
        window.clearInterval(ticker);
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth) {
          callbacks.current.onError?.(
            "Your camera is not ready. Please retry the shot.",
          );
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width =
          captureAspectRatio >= 1
            ? 1280
            : Math.round(1280 * captureAspectRatio);
        canvas.height =
          captureAspectRatio >= 1
            ? Math.round(1280 / captureAspectRatio)
            : 1280;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const ratio = canvas.width / canvas.height;
        const sourceWidth = Math.min(
          video.videoWidth,
          video.videoHeight * ratio,
        );
        const sourceHeight = sourceWidth / ratio;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
          video,
          (video.videoWidth - sourceWidth) / 2,
          (video.videoHeight - sourceHeight) / 2,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        if (consumed.current.has(shotKey)) return;
        consumed.current.add(shotKey);
        callbacks.current.onCapture(
          canvas.toDataURL("image/jpeg", 0.85),
          frameIndex,
          roundId,
        );
        setCount(null);
      },
      Math.max(0, target - Date.now()),
    );
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(ticker);
    };
  }, [
    isCountingDown,
    timerSeconds,
    shotDeadline,
    ready,
    frameIndex,
    roundId,
    captureAspectRatio,
  ]);
  const remote = participants.filter((p) => p.id !== selfId);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 220,
        overflow: "hidden",
        borderRadius: "var(--r-lg)",
        background: "#17171c",
        border: "1px solid var(--c-border)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Your live camera preview"
        onLoadedData={() => {
          setReady(true);
          callbacks.current.onReady?.(true);
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          color: "#fff",
          background: "rgba(0,0,0,.65)",
          padding: "8px 12px",
          borderRadius: 12,
          fontSize: 13,
        }}
      >
        Your camera
        {remote.length > 0 &&
          ` · ${remote.length} other participant${remote.length === 1 ? "" : "s"} capture on their own devices. Photos combine after capture.`}
      </div>
      {!ready && (
        <div
          role={error ? "alert" : "status"}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            color: "#fff",
            background: "#17171ce8",
          }}
        >
          {error || "Waiting for camera permission…"}
          {error && (
            <button
              className="btn btn-primary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry camera
            </button>
          )}
        </div>
      )}
      {count !== null && count > 0 && (
        <div
          aria-live="assertive"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontSize: "clamp(80px, 20vw, 200px)",
            fontWeight: 900,
            color: "#fff",
            textShadow: "0 4px 24px #000",
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}
