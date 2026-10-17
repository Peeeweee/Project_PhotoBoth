import { useState } from "react";
import { leaveSession } from "../lib/session";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import { socket } from "../lib/socket";
import {
  StripCanvas,
  DraggableSticker,
  DrawOverlay,
} from "../components/editor";
import { STICKERS } from "../data/stickerPresets";
import { FILTER_PRESETS } from "../data/filterPresets";

export default function DoneRoom() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const { roomCode, selfId, isHost } = useRoomStore();
  const {
    layoutId,
    designPreset,
    filterId,
    assignedPhotos,
    placedStickers,
    stripTitle,
    showWatermark,
    reset,
  } = useSessionStore();

  const designId = designPreset?.id || "classic";
  const selectedFilter =
    FILTER_PRESETS.find((f) => f.id === filterId) || FILTER_PRESETS[0];

  const shareLink = `${window.location.origin}/?join=${roomCode}`;

  const handleRestart = () => {
    if (!isHost || !roomCode || !selfId) return;

    // Transition room back to waiting phase
    socket.emit(
      "update-room-state",
      {
        code: roomCode,
        participantId: selfId,
        status: "waiting",
      },
      (res) => {
        if (res.ok) {
          reset(); // Clear session state (photos, layout, stickers)
          navigate("/lobby");
        } else {
          setNotice(res.error.message);
        }
      },
    );
  };

  const handleReshoot = () => {
    if (!isHost || !roomCode || !selfId) return;

    // Go straight back to capturing phase
    socket.emit(
      "update-room-state",
      {
        code: roomCode,
        participantId: selfId,
        status: "ready",
      },
      (res) => {
        if (res.ok) {
          // We do NOT clear layout or stickers, just photos
          navigate("/capture");
        } else {
          setNotice(res.error.message);
        }
      },
    );
  };

  const handleLeave = () => {
    leaveSession();
    navigate("/");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setNotice("Link copied to clipboard.");
    } catch {
      setNotice(`Could not copy automatically. Share this link: ${shareLink}`);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--sp-4)",
        gap: "var(--sp-6)",
        alignItems: "center",
      }}
    >
      {notice && <p role="status">{notice}</p>}
      <div style={{ textAlign: "center", flexShrink: 0, width: "100%" }}>
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, var(--text-3xl))",
            fontWeight: 800,
            color: "var(--c-text-hi)",
            margin: "0 0 var(--sp-2)",
          }}
        >
          You're all set! ✨
        </h1>
        <p
          style={{
            color: "var(--c-text-md)",
            fontSize: "var(--text-md)",
            margin: 0,
          }}
        >
          Your PhotoDate is complete.
        </p>
      </div>

      {/* Mini Strip Preview */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 0,
          background: "var(--c-surface-1)",
          borderRadius: "var(--r-lg)",
          padding: "var(--sp-4)",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <StripCanvas
            layoutId={layoutId}
            design={designPreset ?? undefined}
            designId={designId}
            photos={assignedPhotos}
            photoFilterCss={selectedFilter.cssFilter}
            title={stripTitle}
            showWatermark={showWatermark}
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
              }}
            >
              {placedStickers.map((sticker) => {
                const preset = STICKERS.find((s) => s.id === sticker.stickerId);
                if (!preset) return null;
                return (
                  <div
                    key={sticker.id}
                    style={{ position: "absolute", inset: 0 }}
                  >
                    <DraggableSticker
                      readOnly
                      sticker={sticker}
                      url={preset.url}
                      isSelected={false}
                      onSelect={() => {}}
                      onUpdate={() => {}}
                      onRemove={() => {}}
                    />
                  </div>
                );
              })}
            </div>
            <DrawOverlay
              isActive={false}
              currentColor="#ffffff"
              currentThickness={4}
            />
          </StripCanvas>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-4)",
          width: "100%",
          maxWidth: "400px",
          background: "var(--c-surface-1)",
          padding: "var(--sp-4)",
          borderRadius: "var(--r-md)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--c-text-md)",
              margin: "0 0 var(--sp-2)",
            }}
          >
            Invite friends for the next round:
          </p>
          <button
            type="button"
            aria-label="Copy invitation for next round"
            onClick={copyLink}
            style={{
              background: "var(--c-surface-2)",
              padding: "var(--sp-3)",
              borderRadius: "var(--r-md)",
              fontFamily: "monospace",
              fontSize: "var(--text-sm)",
              color: "var(--c-text-hi)",
              cursor: "pointer",
              border: "1px solid var(--c-surface-3)",
              wordBreak: "break-all",
            }}
          >
            {shareLink}
          </button>
          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--c-text-muted)",
              margin: "var(--sp-1) 0 0",
            }}
          >
            Copy the link, then return to the lobby before new guests join.
          </p>
        </div>

        {isHost ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-2)",
              marginTop: "var(--sp-2)",
            }}
          >
            <button
              onClick={handleReshoot}
              style={{
                background: "var(--c-accent)",
                color: "var(--c-bg)",
                border: "none",
                borderRadius: "var(--r-full)",
                padding: "var(--sp-4)",
                fontSize: "var(--text-lg)",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                width: "100%",
              }}
            >
              Reshoot Photos
            </button>
            <button
              onClick={handleRestart}
              style={{
                background: "var(--c-surface-3)",
                color: "var(--c-text-hi)",
                border: "none",
                borderRadius: "var(--r-full)",
                padding: "var(--sp-4)",
                fontSize: "var(--text-md)",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                width: "100%",
              }}
            >
              Return to Lobby
            </button>
            <button
              onClick={handleLeave}
              style={{
                background: "transparent",
                color: "var(--c-text-md)",
                border: "1px solid var(--c-surface-3)",
                borderRadius: "var(--r-full)",
                padding: "var(--sp-4)",
                fontSize: "var(--text-md)",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                width: "100%",
              }}
            >
              Exit to Menu
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-2)",
              marginTop: "var(--sp-2)",
            }}
          >
            <button
              onClick={handleLeave}
              style={{
                background: "var(--c-surface-3)",
                color: "var(--c-text-hi)",
                border: "none",
                borderRadius: "var(--r-full)",
                padding: "var(--sp-4)",
                fontSize: "var(--text-md)",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                width: "100%",
              }}
            >
              Leave Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
