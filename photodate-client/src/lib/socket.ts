import { io, type Socket } from "socket.io-client";

import type {
  RoomSnapshot as SharedSnapshot,
  AckResponse as SharedAck,
  ClientToServerEvents as SharedClientEvents,
  ServerToClientEvents as SharedServerEvents,
} from "../../../shared/contracts";
import type { SessionState } from "../state/useSessionStore";
export type {
  RoomStatus,
  ParticipantRecord as SocketParticipant,
} from "../../../shared/contracts";
export type RoomSnapshot = SharedSnapshot<Partial<SessionState>>;
export type AckResponse = SharedAck<Partial<SessionState>>;
type ClientToServerEvents = SharedClientEvents<Partial<SessionState>>;
type ServerToClientEvents = SharedServerEvents<Partial<SessionState>>;

// ── Singleton socket instance (lazy-connected) ────────────────────────────────

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  {
    autoConnect: false, // connect explicitly when entering a room
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    reconnectionAttempts: 20,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    reconnectionDelay: 1000,
  },
);

// Bound every application acknowledgement, including offline buffered emits.
const emitOriginal = socket.emit.bind(socket);
socket.emit = ((event: string, ...args: unknown[]) => {
  // Explicit .timeout() calls use Socket.IO's error-first acknowledgement.
  // Do not wrap them again with an incompatible application-response timer.
  const flags = (socket as unknown as { flags: { timeout?: number } }).flags;
  if (flags.timeout !== undefined)
    return (emitOriginal as (...args: unknown[]) => typeof socket)(
      event,
      ...args,
    );
  const callback = args[args.length - 1];
  if (typeof callback === "function") {
    let settled = false;
    const timeout = window.setTimeout(
      () => {
        if (settled) return;
        settled = true;
        callback({
          ok: false,
          error: {
            code: "ACK_TIMEOUT",
            message:
              "The server did not respond. Check your connection and retry.",
          },
        });
      },
      event === "update-editor" || event === "prepare-retake" ? 30000 : 10000,
    );
    args[args.length - 1] = (...response: unknown[]) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      callback(...response);
    };
  }
  return (emitOriginal as (...args: unknown[]) => typeof socket)(
    event,
    ...args,
  );
}) as typeof socket.emit;

// ── Dev logging (stripped in prod by tree-shaking) ────────────────────────────
if (import.meta.env.DEV) {
  socket.on("connect", () => console.log("[Socket] connected", socket.id));
  socket.on("disconnect", (r) => console.log("[Socket] disconnected", r));
  socket.on("connect_error", (e) =>
    console.error("[Socket] connect error", e.message),
  );
  socket.on("room-state-changed", (p) =>
    console.log("[Socket] room-state-changed", p),
  );
  socket.on("participant-list-updated", (p) =>
    console.log(
      "[Socket] participant-list-updated",
      p.participants.map((x) => x.display_name),
    ),
  );
}
