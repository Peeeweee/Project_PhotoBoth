import { leaveRoom } from "./api";
import { socket } from "./socket";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
export function leaveSession(skipRemote = false) {
  const { roomCode, selfId } = useRoomStore.getState();
  if (!skipRemote && roomCode && selfId)
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
  } = useSessionStore.getState();
  socket.emit(
    "update-editor",
    {
      code: room.roomCode,
      stage,
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
    },
    (ack) => {
      if (!ack.ok) window.alert(ack.error.message);
      else onSuccess?.();
    },
  );
}
