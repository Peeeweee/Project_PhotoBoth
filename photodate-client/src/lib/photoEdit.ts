import type { PhotoEdit } from "../../../shared/contracts";
export const DEFAULT_PHOTO_EDIT: PhotoEdit = {
  fit: "contain",
  zoom: 1,
  x: 0,
  y: 0,
};
export function photoPresentation(value?: PhotoEdit) {
  const edit = value ?? DEFAULT_PHOTO_EDIT;
  const position = `${50 + edit.x}% ${50 + edit.y}%`;
  return {
    objectFit: edit.fit,
    objectPosition: position,
    transform: `scale(${edit.zoom})`,
    transformOrigin: position,
  };
}
export function panPhoto(
  start: PhotoEdit,
  dx: number,
  dy: number,
  width: number,
  height: number,
): PhotoEdit {
  return {
    ...start,
    x: Math.max(-50, Math.min(50, start.x - (dx / Math.max(1, width)) * 100)),
    y: Math.max(-50, Math.min(50, start.y - (dy / Math.max(1, height)) * 100)),
  };
}
