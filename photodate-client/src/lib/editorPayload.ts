import type { SessionState } from "../state/useSessionStore";

/** Photos already acknowledged by the room need not be uploaded for every filter click. */
export function editorPayload(
  state: Partial<SessionState>,
  acknowledgedPhotos: string[],
) {
  const { assignedPhotos, ...settings } = state;
  return JSON.stringify(assignedPhotos ?? []) ===
    JSON.stringify(acknowledgedPhotos)
    ? settings
    : { ...settings, assignedPhotos };
}
