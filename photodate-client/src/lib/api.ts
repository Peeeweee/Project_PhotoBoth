import type {
  CreateRoomResponse,
  JoinRoomResponse,
  GetRoomResponse,
  UploadCaptureResponse,
  GetCapturesResponse,
} from "../../../shared/contracts";
export type {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomRecord,
  ParticipantRecord,
  GetRoomResponse,
  UploadCaptureResponse,
  GetCapturesResponse,
} from "../../../shared/contracts";
import { useRoomStore } from "../state/useRoomStore";
import { normalizeRoomCode } from "./roomCode";
const BASE = import.meta.env.VITE_SERVER_URL ?? "/api";

class HttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number;
  constructor(message: string, status: number, retryAfterMs: number) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(useRoomStore.getState().sessionToken
        ? { Authorization: `Bearer ${useRoomStore.getState().sessionToken}` }
        : {}),
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => {
    if (res.ok)
      throw new Error("The server returned an invalid response. Please retry.");
    return { message: `HTTP ${res.status}: unexpected server response` };
  });
  if (!res.ok) {
    throw new HttpError(
      (data as { message?: string }).message ?? `HTTP ${res.status}`,
      res.status,
      Math.min(
        60000,
        Math.max(0, Number(res.headers.get("Retry-After")) || 0) * 1000,
      ),
    );
  }
  return data as T;
}

// ── Room endpoints ────────────────────────────────────────────────────────────

/** Create a new room. The caller becomes the host (slot 0). */
export const createRoom = (hostName: string) =>
  request<CreateRoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify({ hostName }),
  });

/** Fetch room details + current participant list by code. */
export const getRoom = (code: string) =>
  request<GetRoomResponse>(
    `/rooms/${encodeURIComponent(normalizeRoomCode(code))}`,
  );

/** Join an existing room as a participant. */
export const joinRoom = (code: string, displayName: string) =>
  request<JoinRoomResponse>(
    `/rooms/${encodeURIComponent(normalizeRoomCode(code))}/join`,
    {
      method: "POST",
      // A credential for another room must not become the new room's identity.
      headers:
        normalizeRoomCode(code) === useRoomStore.getState().roomCode
          ? {}
          : { Authorization: "" },
      body: JSON.stringify({ displayName }),
    },
  );

async function retryUpload<T>(send: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      const transient =
        error instanceof HttpError
          ? [429, 502, 503, 504].includes(error.status)
          : error instanceof TypeError ||
            (error instanceof DOMException &&
              ["TimeoutError", "NetworkError"].includes(error.name));
      if (!transient || attempt >= 2) throw error;
      const wait =
        error instanceof HttpError && error.retryAfterMs
          ? error.retryAfterMs
          : 750 * 2 ** attempt;
      await new Promise((resolve) =>
        setTimeout(resolve, wait + Math.random() * 500),
      );
    }
  }
}

export const uploadCapture = (
  code: string,
  participantId: string,
  frameIndex: number,
  dataUrl: string,
  roundId = useRoomStore.getState().roundId,
) =>
  retryUpload(() =>
    request<UploadCaptureResponse>(
      `/rooms/${encodeURIComponent(normalizeRoomCode(code))}/captures`,
      {
        method: "POST",
        body: JSON.stringify({ participantId, frameIndex, dataUrl, roundId }),
        signal: AbortSignal.timeout(60000),
      },
    ),
  );

export const getCaptures = (code: string) =>
  request<GetCapturesResponse>(
    `/rooms/${encodeURIComponent(normalizeRoomCode(code))}/captures`,
  );

export const leaveRoom = (code: string, reason?: string) =>
  request<{ status: string }>(
    `/rooms/${encodeURIComponent(normalizeRoomCode(code))}/leave`,
    {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({ reason }),
    },
  );
