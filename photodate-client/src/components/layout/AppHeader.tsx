import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Camera, Check, Copy, LogOut } from "lucide-react";
import BackButton from "./BackButton";
import { useRoomStore } from "../../state/useRoomStore";

const pages: Record<string, string> = {
  "/": "Your little photo studio",
  "/lobby": "Gather your crew",
  "/theme": "Studio atmosphere",
  "/layout": "Choose your layout",
  "/design": "Choose your frame",
  "/capture": "Strike a pose",
  "/editor": "Pick your favorites",
  "/filter": "Find your look",
  "/decorate": "Finishing touches",
  "/export": "Save your keepsake",
  "/done": "Made together",
};

export default function AppHeader({ onLeave }: { onLeave: () => void }) {
  const { pathname } = useLocation();
  const { roomCode, connectionStatus } = useRoomStore();
  const [copied, setCopied] = useState(false);
  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <div className="app-topbar-start">
          <div className="app-wordmark" aria-label="PhotoDate studio">
            <span className="app-brand-symbol">
              <Camera size={20} strokeWidth={1.7} />
            </span>
            <span>
              PhotoDate<span className="app-brand-studio">STUDIO</span>
            </span>
          </div>
          <span className="app-header-divider" />
          <BackButton />
        </div>
        <div className="app-page-context">
          <span>YOUR PHOTO DATE</span>
          <strong>{pages[pathname] ?? "Your studio"}</strong>
        </div>
        <div className="app-topbar-end">
          {roomCode && (
            <button
              className="app-room-pill"
              title="Copy room code"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(roomCode);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1800);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <span
                className="app-connection-dot"
                data-connected={connectionStatus === "joined"}
              />
              <span className="app-room-label">ROOM</span>
              <strong>{roomCode}</strong>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span className="sr-only" role="status">
                {copied ? "Room code copied" : "Copy room code"}
              </span>
            </button>
          )}
          {roomCode && (
            <button
              id="topbar-account-btn"
              className="app-leave-button"
              aria-label="Leave session"
              onClick={onLeave}
            >
              <LogOut size={17} />
              <span>Leave</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
