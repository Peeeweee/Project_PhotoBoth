/** Wire contracts shared by the browser and server. No runtime code or dependencies. */
export type RoomStatus =
  | "waiting"
  | "ready"
  | "capturing"
  | "reviewing"
  | "editing"
  | "exporting"
  | "closed";
export interface RoomRecord {
  id: string;
  code: string;
  host_id: string;
  theme_pack_id: string | null;
  layout_id: string | null;
  design_id: string | null;
  timer_seconds: number;
  status: RoomStatus;
  created_at: string;
}
export interface ParticipantRecord {
  id: string;
  room_id: string;
  display_name: string;
  slot_index: 0 | 1 | 2 | 3;
  joined_at: string;
  online?: boolean;
}
export interface CaptureRecord {
  id: string;
  room_id: string;
  participant_id: string;
  frame_index: number;
  image_url: string;
  round_id: string;
  captured_at: string;
}
export interface RoomSnapshot<Editor extends object = Record<string, unknown>> {
  room: RoomRecord;
  participants: ParticipantRecord[];
  editor: Editor;
  stage: string;
  roundId: string | null;
  frameCount: number;
  shotDeadlines: number[];
  readyParticipantIds: string[];
  expectedParticipantIds: string[];
  version: number;
  serverTime: number;
  captures?: CaptureRecord[];
  customDesign?: unknown;
}
export interface SocketError {
  code: string;
  message: string;
}
export type AckResponse<Editor extends object = Record<string, unknown>> =
  | { ok: true; snapshot?: RoomSnapshot<Editor> }
  | { ok: false; error: SocketError };
export type Ack<Editor extends object = Record<string, unknown>> = (
  response: AckResponse<Editor>,
) => void;
interface Member {
  code: string;
  participantId?: string;
}
export interface ClientToServerEvents<
  Editor extends object = Record<string, unknown>,
> {
  "join-room": (
    payload: Member & { sessionToken: string },
    ack: Ack<Editor>,
  ) => void;
  "leave-room": (payload: Member, ack: Ack<Editor>) => void;
  "capture-ready": (
    payload: Member & { ready: boolean },
    ack: Ack<Editor>,
  ) => void;
  "update-room-state": (
    payload: Member & { status: RoomStatus; frameCount?: number },
    ack: Ack<Editor>,
  ) => void;
  "update-timer-mode": (
    payload: Member & { timerSeconds: number },
    ack: Ack<Editor>,
  ) => void;
  "update-room-selections": (
    payload: Member & {
      layoutId: string | null;
      designId: string | null;
      customDesign?: unknown;
    },
    ack: Ack<Editor>,
  ) => void;
  "update-editor": (
    payload: Member & { editor: Editor; stage?: string },
    ack: Ack<Editor>,
  ) => void;
  "simulate-group": (
    payload: Member & { action: "add" | "remove" },
    ack: Ack<Editor>,
  ) => void;
}
export interface ServerToClientEvents<
  Editor extends object = Record<string, unknown>,
> {
  "room-snapshot": (payload: RoomSnapshot<Editor>) => void;
  "editor-state-changed": (payload: {
    roomId: string;
    editor: Editor;
    stage: string;
    version: number;
  }) => void;
  "participant-list-updated": (payload: {
    roomId: string;
    participants: ParticipantRecord[];
  }) => void;
  "room-state-changed": (payload: {
    roomId: string;
    status: RoomStatus;
    changedAt: string;
  }) => void;
  "timer-mode-changed": (payload: {
    roomId: string;
    timerSeconds: number;
  }) => void;
  "room-selections-changed": (payload: {
    roomId: string;
    layoutId: string | null;
    designId: string | null;
    customDesign?: unknown;
  }) => void;
  "socket-error": (payload: SocketError) => void;
}
export interface CreateRoomResponse {
  status: "ok";
  roomId: string;
  code: string;
  hostId: string;
  sessionToken: string;
  snapshot: RoomSnapshot;
}
export interface JoinRoomResponse {
  status: "ok";
  participantId: string;
  slotIndex: number;
  sessionToken: string;
  room: RoomRecord;
  snapshot: RoomSnapshot;
}
export interface GetRoomResponse extends RoomSnapshot {
  status: "ok";
  snapshot: RoomSnapshot;
}
export interface UploadCaptureResponse {
  status: "ok";
  roundId: string;
}
export interface GetCapturesResponse {
  status: "ok";
  captures: CaptureRecord[];
  roundId: string | null;
}
