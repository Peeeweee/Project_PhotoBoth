import { leaveSession } from "../../lib/session";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { socket, type RoomSnapshot } from "../../lib/socket";
import { useSessionStore } from "../../state/useSessionStore";
import { useRoomStore } from "../../state/useRoomStore";
import { useNavigate } from "react-router-dom";
import { THEMES, DEFAULT_THEME } from "../../data/themes";
import { DESIGN_PACKS } from "../../data/themePacks";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const themePack = useSessionStore((s) => s.themePack);
  const activeTheme = themePack
    ? (THEMES.find((t) => t.id === themePack.id) ?? DEFAULT_THEME)
    : DEFAULT_THEME;
  const glowRgba = activeTheme.bgGlowRgba;

  const { roomCode, selfId, setStatus, setParticipants } = useRoomStore();
  const { setLayoutId, setDesignPreset } = useSessionStore();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [connectionError, setConnectionError] = useState("");
  useEffect(() => {
    if (!roomCode || !selfId) {
      setConnectionError("");
      return;
    }
    let applying = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const route = (status: string, stage = "editor") => {
      const path =
        status === "waiting"
          ? "/lobby"
          : status === "ready" && stage === "capture"
            ? "/capture"
            : status === "capturing"
              ? "/capture"
              : status === "reviewing"
                ? ["filter", "decorate", "export", "done"].includes(stage)
                  ? `/${stage}`
                  : "/editor"
                : status === "editing" || status === "exporting"
                  ? `/${stage}`
                  : status === "closed"
                    ? "/done"
                    : null;
      if (path) navigateRef.current(path);
    };
    const apply = (snapshot: RoomSnapshot, restoreEditor = false) => {
      if (snapshot.room.id !== useRoomStore.getState().roomId) return;
      applying = true;
      const previous = useRoomStore.getState();
      if (previous.roundId !== snapshot.roundId)
        useRoomStore.setState({ capturedFrameIndexes: [] });
      if (snapshot.captures)
        useRoomStore.setState({
          capturedFrameIndexes: snapshot.captures
            .filter(
              (c) =>
                c.participant_id === selfId && c.round_id === snapshot.roundId,
            )
            .map((c) => c.frame_index),
          captureResumeVersion: previous.captureResumeVersion + 1,
        });
      if (
        previous.roundId !== snapshot.roundId ||
        (previous.status !== "waiting" && snapshot.room.status === "waiting")
      )
        useSessionStore.setState({
          assignedPhotos: [],
          placedStickers: [],
          drawStrokes: [],
          filterId: "original",
        });
      useRoomStore.setState({
        status: snapshot.room.status as typeof previous.status,
        participants: snapshot.participants,
        roundId: snapshot.roundId,
        shotDeadlines: snapshot.shotDeadlines.map(
          (deadline) =>
            deadline - ((snapshot.serverTime ?? Date.now()) - Date.now()),
        ),
        readyParticipantIds: snapshot.readyParticipantIds,
        stage: snapshot.stage,
      });
      const hasPendingEdit =
        previous.isHost &&
        !restoreEditor &&
        previous.roundId === snapshot.roundId &&
        ["reviewing", "editing", "exporting"].includes(snapshot.room.status);
      if (previous.stage !== snapshot.stage) {
        clearTimeout(debounce);
        debounce = undefined;
      }
      if (!hasPendingEdit) {
        clearTimeout(debounce);
        debounce = undefined;
        useSessionStore.setState({
          ...snapshot.editor,
          timerMode: snapshot.room.timer_seconds,
        });
      }
      if (snapshot.room.layout_id)
        setLayoutId(
          snapshot.room.layout_id as Parameters<typeof setLayoutId>[0],
        );
      const design = DESIGN_PACKS.flatMap((p) => p.designs).find(
        (d) => d.id === snapshot.room.design_id,
      );
      if (design && !snapshot.editor?.designPreset) setDesignPreset(design);
      applying = false;
      if (
        previous.status !== snapshot.room.status ||
        previous.stage !== snapshot.stage ||
        !socket.connected
      )
        route(snapshot.room.status, snapshot.stage);
    };
    const join = () => {
      setIsConnected(true);
      socket.emit(
        "join-room",
        {
          code: roomCode,
          participantId: selfId,
          sessionToken: useRoomStore.getState().sessionToken ?? "",
        },
        (ack) => {
          if (!ack.ok) {
            setConnectionError(ack.error.message);
            return;
          }
          setConnectionError("");
          if (ack.snapshot) {
            apply(ack.snapshot, true);
            route(ack.snapshot.room.status, ack.snapshot.stage);
          }
          if (useRoomStore.getState().cameraReady)
            socket.emit(
              "capture-ready",
              { code: roomCode, ready: true },
              (result) => {
                if (!result.ok) setConnectionError(result.error.message);
              },
            );
        },
      );
    };
    const disconnected = () => setIsConnected(false);
    const unsubscribe = useSessionStore.subscribe((state) => {
      if (
        applying ||
        !useRoomStore.getState().isHost ||
        !["reviewing", "editing", "exporting"].includes(
          useRoomStore.getState().status,
        )
      )
        return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = undefined;
        const {
          assignedPhotos,
          placedStickers,
          drawStrokes,
          stripTitle,
          filterId,
          showWatermark,
          designPreset,
          layoutId,
        } = state;
        socket.emit(
          "update-editor",
          {
            code: roomCode,
            editor: {
              assignedPhotos,
              placedStickers,
              drawStrokes,
              stripTitle,
              filterId,
              showWatermark,
              designPreset,
              layoutId,
            },
            stage:
              useRoomStore.getState().stage === "review"
                ? "editor"
                : useRoomStore.getState().stage,
          },
          (ack) => {
            if (!ack.ok) setConnectionError(ack.error.message);
          },
        );
      }, 250);
    });
    socket.on("connect", join);
    socket.on("disconnect", disconnected);
    socket.on("room-snapshot", apply);
    if (socket.connected) join();
    else socket.connect();
    return () => {
      clearTimeout(debounce);
      unsubscribe();
      socket.off("connect", join);
      socket.off("disconnect", disconnected);
      socket.off("room-snapshot", apply);
    };
  }, [
    roomCode,
    selfId,
    setStatus,
    setParticipants,
    setLayoutId,
    setDesignPreset,
  ]);

  return (
    <div
      className="app-shell"
      style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        style={{
          position: "fixed",
          insetInline: 0,
          top: 0,
          height: "var(--topbar-h)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--sp-6)",
          borderBottom: "1px solid var(--c-border-soft)",
          background: "rgba(10,10,15,0.72)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            color: "var(--c-text-hi)",
            fontWeight: 700,
            fontSize: "var(--text-md)",
            letterSpacing: "-0.3px",
            userSelect: "none",
          }}
        >
          {/* Accent dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "var(--r-full)",
              background: "var(--c-accent)",
              boxShadow: "0 0 8px var(--c-accent)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span>PhotoDate</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--c-text-lo)",
              fontWeight: 400,
              marginLeft: "var(--sp-1)",
              letterSpacing: "0.5px",
            }}
          >
            PHOTOBOOTH
          </span>
        </div>

        {/* Account icon */}
        <button
          id="topbar-account-btn"
          aria-label="Leave session"
          disabled={!roomCode}
          onClick={() => {
            leaveSession();
            navigate("/");
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "var(--r-full)",
            background: "var(--c-surface-2)",
            border: "1px solid var(--c-border)",
            color: "var(--c-text-md)",
            transition: `background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)`,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = "var(--c-surface-3)";
            el.style.color = "var(--c-text-hi)";
            el.style.borderColor = "var(--c-accent)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "var(--c-surface-2)";
            el.style.color = "var(--c-text-md)";
            el.style.borderColor = "var(--c-border)";
          }}
        >
          <LogOut size={18} strokeWidth={1.6} />
        </button>
      </header>

      {/* ── Page content ──────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          marginTop: "var(--topbar-h)",
          position: "relative",
          /* Subtle radial glow near top — colour driven by active theme */
          background: `radial-gradient(ellipse 80% 40% at 50% -10%, ${glowRgba} 0%, transparent 70%), var(--c-bg)`,
          transition: "background var(--dur-slow)",
        }}
      >
        {!isConnected && roomCode && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              background: "var(--c-error)",
              color: "white",
              padding: "var(--sp-2)",
              textAlign: "center",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--sp-2)",
              zIndex: 10,
            }}
          >
            <RefreshCw
              size={14}
              style={{ animation: "spin 2s linear infinite" }}
            />
            Connection lost. Reconnecting...
          </div>
        )}
        {connectionError && (
          <p role="alert" style={{ padding: 16, color: "var(--c-error)" }}>
            {connectionError}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
