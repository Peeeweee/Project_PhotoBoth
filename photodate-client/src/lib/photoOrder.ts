import type { PhotoVote } from "../../../shared/contracts";
export function suggestedPhotoOrder<T extends { frame_index: number }>(
  photos: T[],
  votes: PhotoVote[],
  count: number,
): T[] {
  const remaining = [...photos];
  const result: T[] = [];
  for (let position = 0; position < count && remaining.length; position++) {
    const score = (photo: T) =>
      votes.filter(
        (v) => v.frameIndex === photo.frame_index && v.position === position,
      ).length *
        100 +
      votes.filter((v) => v.frameIndex === photo.frame_index).length;
    remaining.sort(
      (a, b) => score(b) - score(a) || a.frame_index - b.frame_index,
    );
    result.push(remaining.shift()!);
  }
  return result;
}
