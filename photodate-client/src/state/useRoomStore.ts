import type {
  RoomMessage,
  PhotoVote,
  PhotoEdit,
} from "../../../shared/contracts";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RoomStatus, SocketParticipant } from "../lib/socket";

// ── Types ────────────────────────────────────────────────────

export type { RoomStatus };

export interface RoomState {
  /** UUID of the current room */
  roomId: string | null;
  sessionToken: string | null;
  roundId: string | null;
  retakeFrameIndex: number | null;
  roomEndReason: import("../lib/roomAvailability").RoomEndReason | null;
  cameraReady: boolean;
  connectionStatus:
    "disconnected" | "connecting" | "joining" | "joined" | "error";
  captureResumeVersion: number;
  capturedFrameIndexes: number[];
  shotDeadlines: number[];
  readyParticipantIds: string[];
  approvedParticipantIds: string[];
  stage: string;
  messages: RoomMessage[];
  photoVotes: PhotoVote[];
  reviewApprovals: string[];
  reviewRevision: string;
  reviewPhotos: string[];
  reviewPhotoEdits: PhotoEdit[];
  /** 5-char human join code */
  roomCode: string | null;
  /** host_id stored in the room row */
  hostId: string | null;
  /** Current user's participantId */
  selfId: string | null;
  /** All participants currently in this room */
  participants: SocketParticipant[];
  /** Room lifecycle status */
  status: RoomStatus;
  /** Whether the current user is the room host */
  isHost: boolean;
}

interface RoomActions {
  /** Set room metadata after creation or joining */
  setRoom: (opts: {
    roomId: string;
    sessionToken: string;
    roomCode: string;
    hostId: string;
    selfId: string;
    status: RoomStatus;
  }) => void;
  /** Replace the participant list (from socket broadcast) */
  setParticipants: (participants: SocketParticipant[]) => void;
  /** Update room lifecycle status */
  setStatus: (status: RoomStatus) => void;
  /** Reset to initial state (on leave / error) */
  reset: () => void;
}

export type RoomStore = RoomState & RoomActions;

// ── Initial state ────────────────────────────────────────────

const initialState: RoomState = {
  roomId: null,
  sessionToken: null,
  roundId: null,
  retakeFrameIndex: null,
  roomEndReason: null,
  cameraReady: false,
  connectionStatus: "disconnected",
  captureResumeVersion: 0,
  capturedFrameIndexes: [],
  shotDeadlines: [],
  readyParticipantIds: [],
  approvedParticipantIds: [],
  stage: "editor",
  messages: [],
  photoVotes: [],
  reviewApprovals: [],
  reviewRevision: "",
  reviewPhotos: [],
  reviewPhotoEdits: [],
  roomCode: null,
  hostId: null,
  selfId: null,
  participants: [],
  status: "waiting",
  isHost: false,
};

// ── Store ─────────────────────────────────────────────────────

export const useRoomStore = create<RoomStore>()(
  persist(
    (set) => ({
      ...initialState,

      setRoom: ({ roomId, roomCode, hostId, selfId, status, sessionToken }) =>
        set({
          ...initialState,
          roomId,
          sessionToken,
          roomCode,
          hostId,
          selfId,
          status,
          isHost: selfId === hostId,
          participants: [],
        }),

      setParticipants: (participants) => set({ participants }),

      setStatus: (status) => set({ status }),

      reset: () => set(initialState),
    }),
    {
      name: "photodate-room-store",
      storage: createJSONStorage(() => ({
        getItem: (key) => {
          try {
            return sessionStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            sessionStorage.setItem(key, value);
          } catch {
            /* unavailable */
          }
        },
        removeItem: (key) => {
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* unavailable */
          }
        },
      })),
      partialize: (s) => ({
        roomId: s.roomId,
        roomCode: s.roomCode,
        selfId: s.selfId,
        hostId: s.hostId,
        isHost: s.isHost,
        sessionToken: s.sessionToken,
      }),
    },
  ),
);
