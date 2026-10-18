import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/** Shares the existing camera stream; moving frames never opens another camera. */
export default function LiveSlot({
  stream,
  count,
  mirrored,
}: {
  stream: MediaStream;
  count: number | null;
  mirrored?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  const front =
    mirrored ?? stream.getVideoTracks()[0]?.getSettings().facingMode === "user";
  return (
    <motion.div
      layoutId="live-camera-in-strip"
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        aria-label="Live camera in the next frame"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: front ? "scaleX(-1)" : undefined,
        }}
      />
      {count !== null && count > 0 && (
        <span className="live-slot-count">{count}</span>
      )}
    </motion.div>
  );
}
