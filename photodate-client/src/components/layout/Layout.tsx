import { DEFAULT_TITLE_STYLE } from "../../data/textStyles";
import LeaveDialog from "./LeaveDialog";
import RoomClosed from "../RoomClosed";
import BrandAtmosphere from "../BrandAtmosphere";
import AppHeader from "./AppHeader";
import { leaveSession } from "../../lib/session";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { socket, type RoomSnapshot } from "../../lib/socket";
import { useSessionStore } from "../../state/useSessionStore";
import { useRoomStore } from "../../state/useRoomStore";
import { useNavigate } from "react-router-dom";
import { THEMES, DEFAULT_THEME } from "../../data/themes";
import { DESIGN_PACKS } from "../../data/themePacks";
import { getPhotoStyle } from "../../data/photoStyles";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const roomClosed = useRoomStore((s) => s.status === "closed");
  const themePack = useSessionStore((s) => s.themePack);
  const activeTheme = themePack
    ? (THEMES.find((t) => t.id === themePack.id) ?? DEFAULT_THEME)
    : DEFAULT_THEME;
  const glowRgba = activeTheme.bgGlowRgba;

  const { roomCode, selfId, connectionStatus, setStatus, setParticipants } =
    useRoomStore();
  const { setLayoutId, setDesignPreset } = useSessionStore();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const [showLeave, setShowLeave] = useState(false);
  const [dismissedDeparture, setDismissedDeparture] = useState("");
  const messages = useRoomStore((s) => s.messages);
  const departure = [...messages].reverse().find((m) => m.kind === "departure");
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState("");
  useEffect(() => {
    if (!roomCode || !selfId) {
      setConnectionError("");
      return;
    }
    let active = true;
    const isCurrent = () =>
      active &&
      useRoomStore.getState().roomCode === roomCode &&
      useRoomStore.getState().selfId === selfId;
    useRoomStore.setState({
      connectionStatus: socket.connected ? "joining" : "connecting",
    });
    setConnectionError("");
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
      if (!isCurrent() || snapshot.room.id !== useRoomStore.getState().roomId)
        return;
      if (snapshot.room.status === "closed") {
        setConnectionError("");
        route("closed");
      } else if (
        !snapshot.participants.some((person) => person.id === selfId)
      ) {
        useRoomStore.setState({ connectionStatus: "error" });
        setConnectionError(
          "Your membership in this room has ended. Return home and enter its code again if the session is still open.",
        );
      }
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
          textLayers: [],
          drawStrokes: [],
          filterId: getPhotoStyle(useSessionStore.getState().themePack?.id)
            .filterId,
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
        approvedParticipantIds: snapshot.approvedParticipantIds ?? [],
        stage: snapshot.stage,
        messages: snapshot.messages ?? [],
        photoVotes: snapshot.photoVotes ?? [],
        reviewApprovals: snapshot.reviewApprovals ?? [],
        reviewRevision: snapshot.reviewRevision ?? "",
        reviewPhotos: (snapshot.editor.assignedPhotos as string[]) ?? [],
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
          textLayers: [],
          titleStyle: { ...DEFAULT_TITLE_STYLE },
          titlePosition: { x: 50, y: 90, auto: true },
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
      if (!isCurrent()) return;
      useRoomStore.setState({ connectionStatus: "joining" });
      socket.emit(
        "join-room",
        {
          code: roomCode,
          participantId: selfId,
          sessionToken: useRoomStore.getState().sessionToken ?? "",
        },
        (ack) => {
          if (!isCurrent()) return;
          if (!ack.ok) {
            if (ack.error.code === "HTTP_410") {
              useRoomStore.setState({ status: "closed" });
              setConnectionError("");
              route("closed");
              return;
            }
            useRoomStore.setState({ connectionStatus: "error" });
            setConnectionError(ack.error.message);
            return;
          }
          setConnectionError("");
          useRoomStore.setState({ connectionStatus: "joined" });
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
    const disconnected = () => {
      if (isCurrent())
        useRoomStore.setState({ connectionStatus: "disconnected" });
    };
    const connectionFailed = (error: Error) => {
      if (isCurrent()) {
        useRoomStore.setState({ connectionStatus: "error" });
        setConnectionError(error.message || "Could not connect to the server.");
      }
    };
    const retriesExhausted = () =>
      connectionFailed(
        new Error("Reconnection stopped. Retry the connection or return home."),
      );
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
          customLayout,
          assignedPhotos,
          placedStickers,
          drawStrokes,
          stripTitle,
          textLayers,
          titleStyle,
          titlePosition,
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
              customLayout,
              assignedPhotos,
              placedStickers,
              drawStrokes,
              stripTitle,
              textLayers,
              titleStyle,
              titlePosition,
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
    const collaboration = (
      value: import("../../../../shared/contracts").CollaborationState,
    ) => {
      if (isCurrent() && value.roomId === useRoomStore.getState().roomId)
        useRoomStore.setState({
          messages: value.messages,
          ...(value.roundId === useRoomStore.getState().roundId &&
          value.reviewRevision === useRoomStore.getState().reviewRevision
            ? { reviewApprovals: value.reviewApprovals ?? [] }
            : {}),
          photoVotes:
            value.roundId === useRoomStore.getState().roundId
              ? value.photoVotes
              : [],
        });
    };
    socket.on("collaboration-changed", collaboration);
    const offline = () => setNetworkOnline(false);
    window.addEventListener("offline", offline);
    const resumeConnection = () => {
      setNetworkOnline(navigator.onLine);
      if (
        isCurrent() &&
        document.visibilityState !== "hidden" &&
        useRoomStore.getState().status !== "closed" &&
        !socket.connected
      ) {
        useRoomStore.setState({ connectionStatus: "connecting" });
        socket.connect();
      }
    };
    window.addEventListener("online", resumeConnection);
    document.addEventListener("visibilitychange", resumeConnection);
    socket.on("connect", join);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", connectionFailed);
    socket.io.on("reconnect_failed", retriesExhausted);
    socket.on("room-snapshot", apply);
    if (socket.connected) join();
    else socket.connect();
    return () => {
      active = false;
      clearTimeout(debounce);
      unsubscribe();
      socket.off("collaboration-changed", collaboration);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", resumeConnection);
      document.removeEventListener("visibilitychange", resumeConnection);
      socket.off("connect", join);
      socket.off("disconnect", disconnected);
      socket.off("connect_error", connectionFailed);
      socket.io.off("reconnect_failed", retriesExhausted);
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
      <BrandAtmosphere />
      {showLeave && <LeaveDialog onClose={() => setShowLeave(false)} />}
      <AppHeader onLeave={() => setShowLeave(true)} />

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
        {departure && departure.id !== dismissedDeparture && (
          <aside className="departure-notice" role="status">
            <div>
              <strong>
                {departure.wasHost
                  ? `${departure.displayName} ended this room`
                  : `${departure.displayName} left the room`}
              </strong>
              <p>Reason: {departure.reason}</p>
            </div>
            <button
              aria-label="Dismiss departure notice"
              onClick={() => setDismissedDeparture(departure.id)}
            >
              ×
            </button>
          </aside>
        )}
        {!networkOnline && roomCode && !roomClosed && (
          <div className="offline-notice" role="status">
            You’re offline. Keep this tab open, reconnect, and retry any pending
            photo uploads.
          </div>
        )}
        {networkOnline &&
          !roomClosed &&
          connectionStatus !== "joined" &&
          roomCode && (
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
              {connectionStatus === "joining"
                ? "Joining your room…"
                : connectionStatus === "error"
                  ? "Room connection needs attention."
                  : "Connecting to the server…"}
            </div>
          )}
        {!roomClosed && connectionError && (
          <div
            role="alert"
            style={{ padding: 16, marginTop: 40, color: "var(--c-error)" }}
          >
            {connectionError}
            {roomCode && (
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button
                  onClick={() => {
                    setConnectionError("");
                    socket.disconnect();
                    useRoomStore.setState({ connectionStatus: "connecting" });
                    socket.connect();
                  }}
                >
                  Retry connection
                </button>
                <button
                  onClick={() => {
                    leaveSession();
                    navigate("/");
                  }}
                >
                  Return home
                </button>
              </div>
            )}
          </div>
        )}
        {roomClosed ? <RoomClosed /> : children}
      </main>
    </div>
  );
}
