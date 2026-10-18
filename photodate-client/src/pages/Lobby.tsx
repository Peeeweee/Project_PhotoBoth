import RoomChat from "../components/RoomChat";
import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ArrowRight, Wifi, WifiOff } from "lucide-react";
import { leaveSession } from "../lib/session";
import { useRoomStore } from "../state/useRoomStore";
import {
  CodeTiles,
  CopyLinkButton,
  ParticipantList,
} from "../components/lobby";

export default function Lobby() {
  const navigate = useNavigate();
  const {
    roomCode,
    selfId,
    isHost,
    participants,
    status,
    stage,
    connectionStatus,
  } = useRoomStore();
  const connected = connectionStatus === "joined";
  const onlineCount = participants.filter((person) => person.online).length;
  const canStart =
    connected &&
    isHost &&
    participants.some((person) => person.id === selfId && person.online) &&
    ["waiting", "ready"].includes(status);

  useEffect(() => {
    if (!roomCode || !selfId) navigate("/", { replace: true });
    else if (
      status === "capturing" ||
      (status === "ready" && stage === "capture")
    )
      navigate("/capture", { replace: true });
    else if (["reviewing", "editing", "exporting"].includes(status))
      navigate(
        status === "reviewing" && stage === "editor" ? "/editor" : `/${stage}`,
        { replace: true },
      );
  }, [roomCode, selfId, status, stage, navigate]);

  const start = useCallback(() => {
    if (canStart) navigate("/layout");
  }, [canStart, navigate]);
  const leave = useCallback(() => {
    leaveSession();
    navigate("/");
  }, [navigate]);
  if (!roomCode || !selfId) return null;
  const connectionLabel = connected
    ? "CONNECTED"
    : connectionStatus === "joining"
      ? "JOINING ROOM…"
      : connectionStatus === "error"
        ? "CONNECTION FAILED"
        : "CONNECTING…";

  return (
    <section
      style={{
        maxWidth: 460,
        margin: "0 auto",
        padding: "var(--sp-8) var(--sp-4)",
        display: "grid",
        gap: 28,
      }}
    >
      <header style={{ textAlign: "center" }}>
        <p
          role="status"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            color: connected ? "var(--c-success)" : "var(--c-text-md)",
            fontSize: 12,
          }}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
          {connectionLabel}
        </p>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            color: "var(--c-text-hi)",
            margin: "12px 0",
          }}
        >
          Room Lobby
        </h1>
        <p>Share the invitation or five-letter code with up to three guests.</p>
      </header>
      <div
        style={{
          textAlign: "center",
          display: "grid",
          gap: 16,
          justifyItems: "center",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          ROOM CODE
        </span>
        <CodeTiles code={roomCode} />
        <CopyLinkButton code={roomCode} />
      </div>
      <p role="status" style={{ textAlign: "center", margin: 0 }}>
        {participants.length}/4 joined · {onlineCount} online
      </p>
      <ParticipantList
        participants={participants}
        selfId={selfId}
        maxSlots={4}
      />
      {isHost ? (
        <>
          <button
            id="start-session-btn"
            disabled={!canStart}
            onClick={start}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 18,
              border: 0,
              borderRadius: "var(--r-md)",
              fontWeight: 700,
              background: canStart ? "var(--c-accent)" : "var(--c-surface-2)",
              color: canStart ? "#fff" : "var(--c-text-md)",
            }}
          >
            <Camera size={18} />
            {canStart
              ? participants.length === 1
                ? "Start Session (Solo Mode)"
                : "Set up group session"
              : "Waiting for room connection…"}
            <ArrowRight size={16} />
          </button>
          <p style={{ fontSize: 13, textAlign: "center", margin: 0 }}>
            Choose a layout and design next. Capture waits for every participant
            to enable their camera.
          </p>
        </>
      ) : (
        <p role="status" style={{ textAlign: "center" }}>
          {connected
            ? "Waiting for the host to set up the session…"
            : "Your place is reserved while the room connects."}
        </p>
      )}
      <RoomChat />
      <button
        onClick={leave}
        style={{
          padding: 12,
          borderRadius: "var(--r-full)",
          border: "1px solid var(--c-border)",
          color: "var(--c-text-md)",
          background: "transparent",
        }}
      >
        Leave Room
      </button>
    </section>
  );
}
