import { leaveSession } from "../lib/session";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, ArrowRight, Wifi, WifiOff } from "lucide-react";
import { socket } from "../lib/socket";
import { useRoomStore } from "../state/useRoomStore";
import {
  CodeTiles,
  CopyLinkButton,
  ParticipantList,
} from "../components/lobby";

// ── Fade-in animation preset ─────────────────────────────────
const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function Lobby() {
  const navigate = useNavigate();
  // `connected` and `socketError` are largely handled by Layout now, but we can read from socket.connected
  const connected = socket.connected;
  const [socketError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const { roomCode, selfId, isHost, participants, status } = useRoomStore();

  // ── Guard: no room in store → back to landing ───────────────
  useEffect(() => {
    if (!roomCode || !selfId) {
      navigate("/", { replace: true });
    } else if (
      status === "capturing" ||
      status === "reviewing" ||
      status === "editing" ||
      status === "exporting"
    ) {
      navigate(
        status === "reviewing"
          ? "/editor"
          : status === "capturing"
            ? "/capture"
            : `/${useRoomStore.getState().stage}`,
        { replace: true },
      );
    }
  }, [roomCode, selfId, status, navigate]);

  // ── Start session (host only) ─────────────────────────────────
  const handleStart = useCallback(() => {
    if (!roomCode || !selfId || isStarting) return;
    setIsStarting(true);
    navigate("/layout");
  }, [roomCode, selfId, isStarting, navigate]);

  const handleLeaveRoom = useCallback(() => {
    if (!roomCode || !selfId) return;
    leaveSession();
    navigate("/");
  }, [roomCode, selfId, navigate]);

  // ── Derived ───────────────────────────────────────────────────
  const canStart =
    isHost &&
    participants.length >= 1 &&
    (status === "ready" || status === "waiting");
  const participantCount = participants.length;

  if (!roomCode || !selfId) return null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-8) var(--sp-4)",
      }}
    >
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        initial="hidden"
        animate="show"
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-8)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <motion.div variants={fadeUp} style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              padding: "var(--sp-1) var(--sp-3)",
              background: "var(--c-accent-soft)",
              border: "1px solid var(--c-accent-border)",
              borderRadius: "var(--r-full)",
              marginBottom: "var(--sp-4)",
            }}
          >
            {connected ? (
              <Wifi size={12} color="var(--c-success)" />
            ) : (
              <WifiOff size={12} color="var(--c-error)" />
            )}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: connected ? "var(--c-success)" : "var(--c-error)",
                fontWeight: 500,
                letterSpacing: "0.5px",
              }}
            >
              {connected ? "CONNECTED" : "RECONNECTING…"}
            </span>
          </div>

          <h1
            style={{
              fontSize: "var(--text-3xl)",
              fontWeight: 700,
              color: "var(--c-text-hi)",
              margin: "0 0 var(--sp-2)",
              lineHeight: "var(--lh-tight)",
            }}
          >
            Room Lobby
          </h1>
          <p
            style={{
              color: "var(--c-text-lo)",
              fontSize: "var(--text-sm)",
              margin: 0,
            }}
          >
            Share this code — your partner can join from the home screen
          </p>
        </motion.div>

        {/* ── Code tiles ──────────────────────────────────────── */}
        <motion.div variants={fadeUp} style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--c-text-lo)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "var(--sp-3)",
            }}
          >
            Room Code
          </div>
          <CodeTiles code={roomCode} />
          <div
            style={{
              marginTop: "var(--sp-3)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <CopyLinkButton code={roomCode} />
          </div>
        </motion.div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}
        >
          <div
            style={{ flex: 1, height: 1, background: "var(--c-border-soft)" }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--c-text-lo)",
              letterSpacing: "1px",
            }}
          >
            {participantCount}/{4} JOINED
          </span>
          <div
            style={{ flex: 1, height: 1, background: "var(--c-border-soft)" }}
          />
        </motion.div>

        {/* ── Participant list ─────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <ParticipantList
            participants={participants}
            selfId={selfId}
            maxSlots={4}
          />
        </motion.div>

        {/* ── Socket error ─────────────────────────────────────── */}
        {socketError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "var(--r-md)",
              color: "var(--c-error)",
              fontSize: "var(--text-sm)",
              textAlign: "center",
            }}
          >
            {socketError}
          </motion.div>
        )}

        {/* ── Start button (host only) ─────────────────────────── */}
        {isHost && (
          <motion.div variants={fadeUp}>
            <button
              id="start-session-btn"
              disabled={!canStart || isStarting}
              onClick={handleStart}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--sp-2)",
                padding: "var(--sp-4)",
                background:
                  canStart && !isStarting
                    ? "var(--c-accent)"
                    : "var(--c-surface-2)",
                border: "none",
                borderRadius: "var(--r-md)",
                color: canStart && !isStarting ? "#fff" : "var(--c-text-lo)",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--text-base)",
                fontWeight: 600,
                cursor: canStart && !isStarting ? "pointer" : "not-allowed",
                transition: "all var(--dur-base) var(--ease-out-expo)",
                boxShadow:
                  canStart && !isStarting ? "var(--shadow-accent)" : "none",
              }}
              onMouseEnter={(e) => {
                if (canStart && !isStarting) {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--c-accent-dim)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (canStart && !isStarting) {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--c-accent)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                }
              }}
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
                  <Camera size={18} strokeWidth={2} />
                  {canStart
                    ? participantCount === 1
                      ? "Start Session (Solo Mode)"
                      : "Start Group Session"
                    : `Waiting for partner… (${participantCount}/2)`}
                  {canStart && <ArrowRight size={16} strokeWidth={2} />}
                </>
              )}
            </button>

            {!canStart && (
              <motion.div
                variants={fadeUp}
                style={{ marginTop: "var(--sp-4)", textAlign: "center" }}
              >
                <p
                  style={{
                    color: "var(--c-text-md)",
                    fontSize: "var(--text-sm)",
                    animation:
                      status === "ready"
                        ? "pulse 2s infinite ease-in-out"
                        : "none",
                  }}
                >
                  {status === "ready"
                    ? "Host is setting up the booth..."
                    : `Waiting for partner… (${participantCount}/2)`}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Guest view: waiting for host */}
        {!isHost && (
          <motion.div variants={fadeUp} style={{ textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                color: "var(--c-text-lo)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span
                style={{
                  animation: "pulse 2s ease-in-out infinite",
                  display: "inline-block",
                  fontSize: 18,
                }}
              >
                ⏳
              </span>
              Waiting for the host to start the session…
            </div>
          </motion.div>
        )}

        <motion.div
          variants={fadeUp}
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "var(--sp-4)",
          }}
        >
          <button
            onClick={handleLeaveRoom}
            style={{
              background: "transparent",
              color: "var(--c-text-md)",
              border: "1px solid var(--c-surface-3)",
              borderRadius: "var(--r-full)",
              padding: "var(--sp-3) var(--sp-6)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--c-text-hi)";
              e.currentTarget.style.borderColor = "var(--c-text-lo)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--c-text-md)";
              e.currentTarget.style.borderColor = "var(--c-surface-3)";
            }}
          >
            Leave Room
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
