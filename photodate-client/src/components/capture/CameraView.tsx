import { cameraErrorMessage } from "../../lib/deviceSupport";
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
  allowCameraSwitch?: boolean;
  preserveSourceAspect?: boolean;
  isActive?: boolean;
  participants?: { id: string; display_name: string; slot_index: number }[];
  selfId?: string;
  onReady?: (ready: boolean) => void;
  onStream?: (stream: MediaStream | null) => void;
  onCountdownChange?: (count: number | null) => void;
  onError?: (message: string) => void;
}

export default function CameraView({
  isCountingDown,
  timerSeconds,
  shotDeadline,
  frameIndex,
  roundId,
  captureAspectRatio = 16 / 9,
  allowCameraSwitch = true,
  preserveSourceAspect = false,
  onCapture,
  isActive = true,
  participants = [],
  selfId,
  onReady,
  onStream,
  onCountdownChange,
  onError,
}: CameraViewProps) {
  const consumed = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({
    onReady,
    onError,
    onCapture,
    onStream,
    onCountdownChange,
  });
  callbacks.current = {
    onReady,
    onError,
    onCapture,
    onStream,
    onCountdownChange,
  };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [mirrored, setMirrored] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const resume = async () => {
    const video = videoRef.current;
    if (
      !video?.srcObject ||
      !(video.srcObject as MediaStream)
        .getVideoTracks()
        .some((track) => track.readyState === "live")
    ) {
      setRetry((value) => value + 1);
      return;
    }
    try {
      await video.play();
      if (
        document.visibilityState !== "hidden" &&
        video.readyState >= 2 &&
        (video.srcObject as MediaStream)
          .getVideoTracks()
          .some((track) => track.readyState === "live" && !track.muted)
      ) {
        setReady(true);
        callbacks.current.onReady?.(true);
        setError("");
      }
    } catch {
      setError("Tap Enable camera to resume your preview.");
    }
  };
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
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (cause) {
          if (cause instanceof Error && cause.name === "OverconstrainedError")
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          else throw cause;
        }
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setMirrored(
          (stream.getVideoTracks()[0]?.getSettings().facingMode ?? facing) !==
            "environment",
        );
        if (video) {
          video.srcObject = stream;
          callbacks.current.onStream?.(stream);
          await video.play();
        }
        stream.getVideoTracks().forEach((track) => {
          track.onmute = () => {
            if (!cancelled) {
              setReady(false);
              callbacks.current.onReady?.(false);
            }
          };
          track.onunmute = () => {
            if (!cancelled && document.visibilityState !== "hidden")
              void resume();
          };
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
        const message = cameraErrorMessage(cause);
        setError(message);
        callbacks.current.onError?.(message);
      }
    };
    void start();
    return () => {
      cancelled = true;
      callbacks.current.onStream?.(null);
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
      callbacks.current.onReady?.(false);
    };
  }, [isActive, retry, facing]);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        setReady(false);
        callbacks.current.onReady?.(false);
      } else if (isActive) void resume();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [isActive]);

  useEffect(() => {
    const shotKey = `${roundId}:${frameIndex}`;
    if (
      !isCountingDown ||
      !ready ||
      !roundId ||
      consumed.current.has(shotKey)
    ) {
      setCount(null);
      callbacks.current.onCountdownChange?.(null);
      return;
    }
    const target =
      shotDeadline ?? Date.now() + Math.max(1, timerSeconds) * 1000;
    const updateCount = () => {
      const next = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setCount(next);
      callbacks.current.onCountdownChange?.(next);
    };
    updateCount();
    const ticker = window.setInterval(updateCount, 100);
    const timer = window.setTimeout(
      () => {
        window.clearInterval(ticker);
        const video = videoRef.current;
        const track = (
          video?.srcObject as MediaStream | null
        )?.getVideoTracks()[0];
        if (track && (track.readyState !== "live" || track.muted)) {
          callbacks.current.onError?.(
            "Camera paused. Keep this tab open and ask the host to restart this round.",
          );
          return;
        }
        if (!video || video.readyState < 2 || !video.videoWidth) {
          callbacks.current.onError?.(
            "Your camera is not ready. Please retry the shot.",
          );
          return;
        }
        const canvas = document.createElement("canvas");
        if (
          document.visibilityState === "hidden" ||
          Date.now() - target > 2000
        ) {
          callbacks.current.onError?.(
            "This shot was interrupted. Keep this tab open and ask the host to restart this round.",
          );
          setCount(null);
          return;
        }
        const captureRatio = preserveSourceAspect
          ? video.videoWidth / video.videoHeight
          : captureAspectRatio;
        canvas.width =
          captureRatio >= 1 ? 1280 : Math.round(1280 * captureRatio);
        canvas.height =
          captureRatio >= 1 ? Math.round(1280 / captureRatio) : 1280;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const ratio = canvas.width / canvas.height;
        const sourceWidth = Math.min(
          video.videoWidth,
          video.videoHeight * ratio,
        );
        const sourceHeight = sourceWidth / ratio;
        if (mirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
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
    mirrored,
    preserveSourceAspect,
  ]);
  const remote = participants.filter((p) => p.id !== selfId);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
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
          if (document.visibilityState === "hidden") return;
          setReady(true);
          callbacks.current.onReady?.(true);
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: preserveSourceAspect ? "contain" : "cover",
          transform: mirrored ? "scaleX(-1)" : "none",
        }}
      />
      <button
        className="camera-switch"
        type="button"
        disabled={!allowCameraSwitch || !ready}
        onClick={() =>
          setFacing((value) => (value === "user" ? "environment" : "user"))
        }
      >
        Switch camera
      </button>
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
          {error && videoRef.current?.srcObject && (
            <button className="action-secondary" onClick={() => void resume()}>
              Enable camera
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
