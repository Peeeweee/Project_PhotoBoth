import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Palette } from "lucide-react";
import { useSessionStore } from "../state/useSessionStore";
import { useRoomStore } from "../state/useRoomStore";
import { socket } from "../lib/socket";
import { DesignPicker } from "../components/design";

// ── Animation presets ──────────────────────────────────────────
const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function DesignSelect() {
  const navigate = useNavigate();
  const { designPreset, setDesignPreset, layoutId } = useSessionStore();
  const { roomCode, selfId } = useRoomStore();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const handleNext = () => {
    if (designPreset && roomCode && selfId && !isStarting) {
      setIsStarting(true);
      setError("");
      // Sync selections to server and broadcast
      socket.emit(
        "update-room-selections",
        {
          code: roomCode,
          participantId: selfId,
          layoutId: layoutId,
          designId: designPreset.id,
          customDesign: designPreset,
        },
        (ack) => {
          if (ack.ok) {
            setIsStarting(false);
            socket.emit(
              "update-room-state",
              { code: roomCode, participantId: selfId, status: "ready" },
              (ack) => {
                if (ack.ok) navigate("/capture");
                else setError(ack.error.message);
              },
            );
          } else {
            setIsStarting(false);
            setError(ack.error.message);
          }
        },
      );
    }
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--sp-8) var(--sp-4) var(--sp-12)",
      }}
    >
      {error && <p role="alert">{error}</p>}
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        animate="show"
        style={{
          width: "100%",
          maxWidth: 640,
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-8)",
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          style={{ textAlign: "center", paddingTop: "var(--sp-6)" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              padding: "var(--sp-1) var(--sp-3)",
              background: "var(--c-surface-2)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--r-full)",
              marginBottom: "var(--sp-4)",
            }}
          >
            <Palette size={12} color="var(--c-text-md)" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--c-text-md)",
                fontWeight: 500,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Step 3 of 3
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(1.75rem, 4vw, var(--text-4xl))",
              fontWeight: 700,
              color: "var(--c-text-hi)",
              margin: "0 0 var(--sp-2)",
              lineHeight: "var(--lh-tight)",
            }}
          >
            Pick a theme pack
          </h1>
          <p
            style={{
              color: "var(--c-text-md)",
              fontSize: "var(--text-sm)",
              margin: 0,
              lineHeight: "var(--lh-relaxed)",
            }}
          >
            Choose the frame design for your prints
          </p>
        </motion.div>

        {/* ── Picker ────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <DesignPicker
            selectedId={designPreset?.id ?? null}
            onSelect={setDesignPreset}
          />
        </motion.div>

        {/* ── Actions ───────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "var(--sp-4)",
          }}
        >
          <motion.button
            variants={fadeUp}
            disabled={!designPreset || isStarting}
            onClick={handleNext}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              padding: "var(--sp-3) var(--sp-6)",
              background: designPreset
                ? "var(--c-accent)"
                : "var(--c-surface-3)",
              color: designPreset ? "var(--c-bg)" : "var(--c-text-lo)",
              border: "none",
              borderRadius: "var(--r-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: designPreset && !isStarting ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
            }}
            whileHover={
              designPreset && !isStarting ? { y: -1, scale: 1.02 } : {}
            }
            whileTap={designPreset && !isStarting ? { scale: 0.98 } : {}}
          >
            {isStarting ? (
              <>
                <span
                  style={{
                    animation: "spin 1s linear infinite",
                    display: "inline-block",
                  }}
                >
                  ⟳
                </span>
                Starting…
              </>
            ) : (
              <>
                Next step
                <ArrowRight size={18} strokeWidth={2.5} />
              </>
            )}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
