import { leaveSession } from "../lib/session";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Hash, Users, Camera } from "lucide-react";
import { createRoom, joinRoom } from "../lib/api";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import { ThemePicker } from "../components/theme";
import { DEFAULT_THEME } from "../data/themes";
import type { ThemeDefinition } from "../data/themes";

// ── Motion presets ───────────────────────────────────────────
const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

// ── Input style ──────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "var(--sp-3) var(--sp-4)",
  background: "var(--c-surface-2)",
  border: "1px solid var(--c-border)",
  borderRadius: "var(--r-md)",
  color: "var(--c-text-hi)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--text-sm)",
  outline: "none",
  transition: "border-color var(--dur-fast)",
  boxSizing: "border-box",
};

// ── Label ────────────────────────────────────────────────────
function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
        color: "var(--c-text-lo)",
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        marginBottom: "var(--sp-2)",
      }}
    >
      {children}
    </label>
  );
}

// ── Primary button ───────────────────────────────────────────
function PrimaryBtn({
  id,
  disabled,
  loading,
  onClick,
  children,
}: {
  id: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = !disabled && !loading;
  return (
    <motion.button
      id={id}
      onClick={onClick}
      disabled={!active}
      whileHover={active ? { scale: 1.01 } : {}}
      whileTap={active ? { scale: 0.98 } : {}}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--sp-2)",
        padding: "var(--sp-3) var(--sp-4)",
        background: active ? "var(--c-accent)" : "var(--c-surface-3)",
        border: "none",
        borderRadius: "var(--r-md)",
        color: active ? "#fff" : "var(--c-text-lo)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        cursor: active ? "pointer" : "not-allowed",
        transition: "background var(--dur-base), color var(--dur-base)",
        boxShadow: active ? "var(--shadow-accent)" : "none",
        marginTop: "var(--sp-4)",
      }}
    >
      {loading ? "Loading…" : children}
    </motion.button>
  );
}

// ── Group toggle ─────────────────────────────────────────────
function GroupToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      variants={fadeUp}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        padding: "var(--sp-4) var(--sp-5)",
        background: "var(--c-surface-1)",
        border: `1.5px solid ${checked ? "var(--c-accent-border)" : "var(--c-border)"}`,
        borderRadius: "var(--r-lg)",
        cursor: "pointer",
        transition: "border-color var(--dur-base), background var(--dur-base)",
        userSelect: "none",
      }}
      onClick={() => onChange(!checked)}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--r-md)",
          background: checked ? "var(--c-accent-soft)" : "var(--c-surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background var(--dur-base)",
        }}
      >
        <Users
          size={20}
          color={checked ? "var(--c-accent)" : "var(--c-text-lo)"}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            color: checked ? "var(--c-text-hi)" : "var(--c-text-md)",
            fontSize: "var(--text-sm)",
            marginBottom: 2,
            transition: "color var(--dur-fast)",
          }}
        >
          Group Photobooth
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--c-text-lo)",
            lineHeight: 1.4,
          }}
        >
          4 people · 2×2 grid layout
        </div>
      </div>

      {/* Toggle pill */}
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: "var(--r-full)",
          background: checked ? "var(--c-accent)" : "var(--c-surface-3)",
          position: "relative",
          flexShrink: 0,
          transition: "background var(--dur-base)",
          border: `1px solid ${checked ? "transparent" : "var(--c-border)"}`,
        }}
      >
        <motion.div
          animate={{ x: checked ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            position: "absolute",
            top: 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </motion.button>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const prefillCode = params.get("join") ?? "";
  const { setRoom } = useRoomStore();
  const { themePack, isGroupMode, setThemePack, setGroupMode } =
    useSessionStore();

  const [hostName, setHostName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [joinCode, setJoinCode] = useState(prefillCode.toUpperCase());
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [errorCreate, setErrorCreate] = useState<string | null>(null);
  const [errorJoin, setErrorJoin] = useState<string | null>(null);

  // Auto-select Classic if nothing chosen
  const selectedTheme = (themePack as ThemeDefinition | null) ?? DEFAULT_THEME;

  const handleSelectTheme = (theme: ThemeDefinition) => {
    setThemePack(theme);
  };

  // ── Create room ────────────────────────────────────────────
  const handleCreate = async () => {
    if (!hostName.trim()) return;
    setLoadingCreate(true);
    setErrorCreate(null);
    try {
      const data = await createRoom(hostName.trim());
      const preferences = {
        themePack: useSessionStore.getState().themePack,
        isGroupMode: useSessionStore.getState().isGroupMode,
      };
      leaveSession();
      if (preferences.themePack)
        useSessionStore.getState().setThemePack(preferences.themePack);
      useSessionStore.getState().setGroupMode(preferences.isGroupMode);
      setRoom({
        sessionToken: data.sessionToken,
        roomId: data.roomId,
        roomCode: data.code,
        hostId: data.hostId,
        selfId: data.hostId,
        status: "waiting",
      });
      navigate("/lobby");
    } catch (e) {
      setErrorCreate((e as Error).message);
    } finally {
      setLoadingCreate(false);
    }
  };

  // ── Join room ──────────────────────────────────────────────
  const handleJoin = async () => {
    if (!guestName.trim() || joinCode.length < 5) return;
    setLoadingJoin(true);
    setErrorJoin(null);
    try {
      const data = await joinRoom(joinCode, guestName.trim());
      const preferences = {
        themePack: useSessionStore.getState().themePack,
        isGroupMode: useSessionStore.getState().isGroupMode,
      };
      leaveSession();
      if (preferences.themePack)
        useSessionStore.getState().setThemePack(preferences.themePack);
      useSessionStore.getState().setGroupMode(preferences.isGroupMode);
      setRoom({
        sessionToken: data.sessionToken,
        roomId: data.room.id,
        roomCode: data.room.code,
        hostId: data.room.host_id,
        selfId: data.participantId,
        status: data.room.status as any,
      });
      navigate("/lobby");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("not found") || msg.includes("404")) {
        setErrorJoin("Room not found. Please double-check the code.");
      } else if (msg.includes("full")) {
        setErrorJoin("This room is already full!");
      } else {
        setErrorJoin(msg);
      }
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "var(--sp-8) var(--sp-4) var(--sp-12)",
      }}
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{
          width: "100%",
          maxWidth: 680,
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-8)",
        }}
      >
        {/* ── Hero ──────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          style={{ textAlign: "center", paddingTop: "var(--sp-4)" }}
        >
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
            <Sparkles size={11} color="var(--c-accent)" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--c-accent)",
                fontWeight: 500,
                letterSpacing: "1px",
              }}
            >
              PHOTOBOOTH FOR TWO
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
            Capture the moment{" "}
            <span style={{ color: "var(--c-accent)" }}>together</span>
          </h1>
          <p
            style={{
              color: "var(--c-text-md)",
              fontSize: "var(--text-sm)",
              margin: 0,
              lineHeight: "var(--lh-relaxed)",
            }}
          >
            Create a room, pick a vibe, and take photos with anyone — anywhere.
          </p>
        </motion.div>

        {/* ── Theme Picker ───────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <ThemePicker
            selectedId={selectedTheme.id}
            onSelect={handleSelectTheme}
          />
        </motion.div>

        {/* ── Action cards ───────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--sp-4)",
          }}
        >
          {/* Create a room */}
          <div
            style={{
              padding: "var(--sp-5)",
              background: "var(--c-surface-1)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--r-xl)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                marginBottom: "var(--sp-5)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--r-md)",
                  background: "var(--c-accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera size={16} color="var(--c-accent)" />
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--c-text-hi)",
                    fontSize: "var(--text-base)",
                  }}
                >
                  Create a room
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--c-text-lo)",
                  }}
                >
                  You become the host
                </div>
              </div>
            </div>

            {/* Form */}
            <div style={{ flex: 1 }}>
              <FieldLabel htmlFor="host-name-input">Your name</FieldLabel>
              <input
                id="host-name-input"
                type="text"
                placeholder="e.g. Alice"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                maxLength={32}
                style={inputBase}
                onFocus={(e) =>
                  ((e.target as HTMLElement).style.borderColor =
                    "var(--c-accent)")
                }
                onBlur={(e) =>
                  ((e.target as HTMLElement).style.borderColor =
                    "var(--c-border)")
                }
              />
            </div>

            <PrimaryBtn
              id="create-room-btn"
              disabled={!hostName.trim()}
              loading={loadingCreate}
              onClick={handleCreate}
            >
              <Sparkles size={14} />
              Create room
              <ArrowRight size={14} />
            </PrimaryBtn>

            <AnimatePresence>
              {errorCreate && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    margin: "var(--sp-3) 0 0",
                    padding: "var(--sp-2) var(--sp-3)",
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: "var(--r-md)",
                    color: "var(--c-error)",
                    fontSize: "var(--text-xs)",
                    textAlign: "center",
                  }}
                >
                  {errorCreate}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Join with a code */}
          <div
            style={{
              padding: "var(--sp-5)",
              background: "var(--c-surface-1)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--r-xl)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                marginBottom: "var(--sp-5)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--r-md)",
                  background: "var(--c-surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Hash size={16} color="var(--c-text-md)" />
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--c-text-hi)",
                    fontSize: "var(--text-base)",
                  }}
                >
                  Join with a code
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--c-text-lo)",
                  }}
                >
                  Enter the 5-letter code
                </div>
              </div>
            </div>

            {/* Form */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--sp-3)",
                flex: 1,
              }}
            >
              <div>
                <FieldLabel htmlFor="join-code-input">Room code</FieldLabel>
                <input
                  aria-label="Room code"
                  id="join-code-input"
                  type="text"
                  placeholder="FUWVJ"
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().slice(0, 5))
                  }
                  maxLength={5}
                  style={{
                    ...inputBase,
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-lg)",
                    letterSpacing: "5px",
                    textAlign: "center",
                  }}
                  onFocus={(e) =>
                    ((e.target as HTMLElement).style.borderColor =
                      "var(--c-accent)")
                  }
                  onBlur={(e) =>
                    ((e.target as HTMLElement).style.borderColor =
                      "var(--c-border)")
                  }
                />
              </div>
              <div>
                <FieldLabel htmlFor="guest-name-input">Your name</FieldLabel>
                <input
                  aria-label="Your name"
                  id="guest-name-input"
                  type="text"
                  placeholder="e.g. Bob"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  maxLength={32}
                  style={inputBase}
                  onFocus={(e) =>
                    ((e.target as HTMLElement).style.borderColor =
                      "var(--c-accent)")
                  }
                  onBlur={(e) =>
                    ((e.target as HTMLElement).style.borderColor =
                      "var(--c-border)")
                  }
                />
              </div>
            </div>

            <PrimaryBtn
              id="join-room-btn"
              disabled={!guestName.trim() || joinCode.length < 5}
              loading={loadingJoin}
              onClick={handleJoin}
            >
              <Hash size={14} />
              Join room
              <ArrowRight size={14} />
            </PrimaryBtn>

            <AnimatePresence>
              {errorJoin && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    margin: "var(--sp-3) 0 0",
                    padding: "var(--sp-2) var(--sp-3)",
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: "var(--r-md)",
                    color: "var(--c-error)",
                    fontSize: "var(--text-xs)",
                    textAlign: "center",
                  }}
                >
                  {errorJoin}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Group photobooth toggle ────────────────────────── */}
        <GroupToggle checked={isGroupMode} onChange={setGroupMode} />
      </motion.div>
    </div>
  );
}
