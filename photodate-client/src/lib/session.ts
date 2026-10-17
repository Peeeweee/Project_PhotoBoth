import { leaveRoom } from "./api";
import { socket } from "./socket";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
export function leaveSession() {
  const { roomCode, selfId } = useRoomStore.getState();
  if (roomCode && selfId)
    void leaveRoom(roomCode).catch(() => {
      /* Server disconnect grace policy revokes abandoned membership. */
    });
  socket.disconnect();
  useRoomStore.getState().reset();
  useSessionStore.getState().reset();
}
export function publishStage(stage: string, onSuccess?: () => void) {
  const room = useRoomStore.getState();
  if (!room.isHost || !room.roomCode) return;
  const {
    assignedPhotos,
    placedStickers,
    drawStrokes,
    stripTitle,
    filterId,
    showWatermark,
    designPreset,
    layoutId,
  } = useSessionStore.getState();
  socket.emit(
    "update-editor",
    {
      code: room.roomCode,
      stage,
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
    },
    (ack) => {
      if (!ack.ok) window.alert(ack.error.message);
      else onSuccess?.();
    },
  );
}
