import { useRoomStore } from "../state/useRoomStore";
import type { GetCapturesResponse } from "./api";
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
      canvas.width = 1200;
      canvas.height = 900;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, 1200, 900);
      const columns = images.length > 2 ? 2 : images.length;
      const rows = Math.ceil(images.length / columns);
      images.forEach((img, i) => {
        const w = 1200 / columns,
          h = 900 / rows,
          scale = Math.max(w / img.width, h / img.height),
          sw = w / scale,
          sh = h / scale;
        ctx.drawImage(
          img,
          (img.width - sw) / 2,
          (img.height - sh) / 2,
          sw,
          sh,
          (i % columns) * w,
          Math.floor(i / columns) * h,
          w,
          h,
        );
      });
      return {
        id: `frame-${frame}`,
        image_url: canvas.toDataURL("image/jpeg", 0.9),
        frame_index: frame,
      };
    }),
  );
}
