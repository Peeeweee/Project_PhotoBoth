import { leaveRoom } from "./api";
import { socket } from "./socket";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import { editorPayload } from "./editorPayload";
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
    photoEdits,
    photoSources,
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
      patch: true,
      editor: editorPayload(
        {
          customLayout,
          assignedPhotos,
          placedStickers,
          drawStrokes,
          stripTitle,
          photoEdits,
          photoSources,
          textLayers,
          titleStyle,
          titlePosition,
          filterId,
          showWatermark,
          designPreset,
          layoutId,
        },
        room.reviewPhotos,
      ),
    },
    (ack) => {
      if (!ack.ok) window.alert(ack.error.message);
      else onSuccess?.();
    },
  );
}

export function editorSnapshot() {
  const s = useSessionStore.getState();
  return {
    customLayout: s.customLayout,
    assignedPhotos: s.assignedPhotos,
    placedStickers: s.placedStickers,
    drawStrokes: s.drawStrokes,
    stripTitle: s.stripTitle,
    photoEdits: s.photoEdits,
    photoSources: s.photoSources,
    textLayers: s.textLayers,
    titleStyle: s.titleStyle,
    titlePosition: s.titlePosition,
    filterId: s.filterId,
    showWatermark: s.showWatermark,
    designPreset: s.designPreset,
    layoutId: s.layoutId,
  };
}
