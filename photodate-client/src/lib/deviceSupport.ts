export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Camera access is blocked. Allow Camera in this browser’s site settings, then tap Retry camera.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No camera was found. Connect a camera or try this room on your phone.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "The camera is busy. Close other camera apps or browser tabs, then retry.";
  return error instanceof Error && error.message.includes("HTTPS")
    ? error.message
    : "Could not start the camera. Try your device’s main browser, allow Camera, and retry.";
}
export function exportPixelRatio(
  width: number,
  height: number,
  touch = false,
): number {
  if (!(width > 0 && height > 0))
    throw new Error("Strip preview is not visible. Please retry.");
  const edge = touch ? 2400 : 3200;
  const pixels = touch ? 6000000 : 10000000;
  return Math.min(
    edge / Math.max(width, height),
    Math.sqrt(pixels / (width * height)),
  );
}
export function dataUrlFile(url: string, name: string): File {
  const comma = url.indexOf(",");
  if (comma < 0 || !url.slice(0, comma).includes(";base64"))
    throw new Error("Invalid prepared file");
  const type = /^data:([^;,]+)/.exec(url)?.[1] ?? "application/octet-stream";
  const bytes = atob(url.slice(comma + 1));
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new File([array], name, { type });
}

export function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}
