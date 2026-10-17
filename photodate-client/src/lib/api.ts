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
const BASE = import.meta.env.VITE_SERVER_URL ?? "/api";

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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message ?? `HTTP ${res.status}`,
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
  request<GetRoomResponse>(`/rooms/${code.toUpperCase()}`);

/** Join an existing room as a participant. */
export const joinRoom = (code: string, displayName: string) =>
  request<JoinRoomResponse>(`/rooms/${code.toUpperCase()}/join`, {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });

export const uploadCapture = (
  code: string,
  participantId: string,
  frameIndex: number,
  dataUrl: string,
  roundId = useRoomStore.getState().roundId,
) =>
  request<UploadCaptureResponse>(`/rooms/${code.toUpperCase()}/captures`, {
    method: "POST",
    body: JSON.stringify({ participantId, frameIndex, dataUrl, roundId }),
  });

export const getCaptures = (code: string) =>
  request<GetCapturesResponse>(`/rooms/${code.toUpperCase()}/captures`);

export const leaveRoom = (code: string) =>
  request<{ status: string }>(`/rooms/${code.toUpperCase()}/leave`, {
    method: "POST",
    keepalive: true,
    body: "{}",
  });
