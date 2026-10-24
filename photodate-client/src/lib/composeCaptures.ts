import { getLayout, slotAspectRatio } from "../data/stripLayouts";
import { useSessionStore } from "../state/useSessionStore";
import { useRoomStore } from "../state/useRoomStore";
import type { GetCapturesResponse } from "./api";
import { participantTiles, coverCrop } from "./photoComposition";
export async function composeCaptures(
  captures: GetCapturesResponse["captures"],
) {
  const participants = useRoomStore.getState().participants;
  const frames = [...new Set(captures.map((c) => c.frame_index))].sort(
    (a, b) => a - b,
  );
  return Promise.all(
    frames.map(async (frame) => {
      const shots = captures
        .filter((c) => c.frame_index === frame)
        .sort(
          (a, b) =>
            (participants.find((p) => p.id === a.participant_id)?.slot_index ??
              0) -
            (participants.find((p) => p.id === b.participant_id)?.slot_index ??
              0),
        );
      if (shots.length === 1)
        return {
          id: shots[0].id,
          image_url: shots[0].image_url,
          frame_index: frame,
        };
      const images = await Promise.all(
        shots.map(
          (shot) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () =>
                reject(new Error("A participant photo could not load"));
              img.src = shot.image_url;
            }),
        ),
      );
      const canvas = document.createElement("canvas");
      const layout = getLayout(
        useSessionStore.getState().layoutId,
        useSessionStore.getState().customLayout,
      );
      const ratio = slotAspectRatio(layout, frame);
      canvas.width = ratio >= 1 ? 1200 : Math.round(1200 * ratio);
      canvas.height = ratio >= 1 ? Math.round(1200 / ratio) : 1200;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const tiles = participantTiles(
        images.length,
        ratio,
        images.map((img) => img.width / img.height),
      );
      images.forEach((img, i) => {
        const tile = tiles[i];
        const x = Math.round(tile.x * canvas.width),
          y = Math.round(tile.y * canvas.height);
        const w = Math.round((tile.x + tile.width) * canvas.width) - x;
        const h = Math.round((tile.y + tile.height) * canvas.height) - y;
        const crop = coverCrop(img.width, img.height, w / h);
        ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, x, y, w, h);
      });
      return {
        id: `frame-${frame}`,
        image_url: canvas.toDataURL("image/jpeg", 0.92),
        frame_index: frame,
      };
    }),
  );
}
