/** Canonical room codes preserve invalid characters so validation can report them. */
export const normalizeRoomCode = (value: string) => value.trim().toUpperCase();
export const isRoomCode = (value: string) =>
  /^[A-Z]{5}$/.test(normalizeRoomCode(value));
