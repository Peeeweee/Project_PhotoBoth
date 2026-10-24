export type RoomEndReason = "expired" | "closed" | "unavailable" | "membership";
export function roomEndReason(
  status: number | string | undefined,
  message: string,
): RoomEndReason | null {
  const text = message.toLowerCase();
  if (text.includes("expired")) return "expired";
  if (text.includes("closed")) return "closed";
  if (status === 404 || status === "HTTP_404") return "unavailable";
  if (status === 410 || status === "HTTP_410") return "closed";
  if (
    status === 401 ||
    status === 403 ||
    status === "HTTP_401" ||
    status === "HTTP_403"
  )
    return "membership";
  return null;
}
export const ROOM_END_COPY = {
  expired: {
    title: "This lobby’s moment has passed.",
    description:
      "This room has expired and its invitation no longer works. Create a new lobby and share its new code with your crew.",
    eyebrow: "TIME FOR A FRESH PHOTO DATE",
  },
  closed: {
    title: "This photo date has wrapped up.",
    description:
      "The host ended this room, so its code can’t be used again. Bring everyone together in a new lobby.",
    eyebrow: "UNTIL THE NEXT PHOTO DATE",
  },
  unavailable: {
    title: "We couldn’t find this lobby.",
    description:
      "The code may be incorrect, or an older room may have expired and been removed. Check with your host or create a new lobby.",
    eyebrow: "LET’S FIND YOUR CREW",
  },
  membership: {
    title: "Your spot in this room has ended.",
    description:
      "Your previous membership is no longer active. Ask your host for a current invitation, or start a new lobby.",
    eyebrow: "A FRESH START",
  },
};
