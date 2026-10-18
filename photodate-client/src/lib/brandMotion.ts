export const MOTION_SCENES = {
  "/": "welcome",
  "/lobby": "constellation",
  "/theme": "carousel",
  "/layout": "accordion",
  "/design": "palette",
  "/capture": "aperture",
  "/editor": "contact",
  "/filter": "prism",
  "/decorate": "sparkles",
  "/export": "ribbon",
  "/done": "bloom",
} as const;

export function motionScene(path: string) {
  return MOTION_SCENES[path as keyof typeof MOTION_SCENES] ?? "welcome";
}

/** Advance to the shared session clock when a scene enters, rather than restarting it. */
export function motionPhase(start: number, now: number) {
  return -Math.max(0, now - start) / 1000;
}
