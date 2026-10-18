import { getLayout } from "../data/stripLayouts";
import { useSessionStore } from "../state/useSessionStore";
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
      const ratio = getLayout(
        useSessionStore.getState().layoutId,
      ).frameAspectRatio;
      canvas.width = ratio >= 1 ? 1200 : Math.round(1200 * ratio);
      canvas.height = ratio >= 1 ? Math.round(1200 / ratio) : 1200;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, 1200, 900);
      const columns = images.length > 2 ? 2 : images.length;
      const rows = Math.ceil(images.length / columns);
      images.forEach((img, i) => {
        const w = canvas.width / columns,
          h = canvas.height / rows;
        const scale = Math.min(w / img.width, h / img.height);
        const dw = img.width * scale,
          dh = img.height * scale;
        ctx.drawImage(
          img,
          (i % columns) * w + (w - dw) / 2,
          Math.floor(i / columns) * h + (h - dh) / 2,
          dw,
          dh,
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
