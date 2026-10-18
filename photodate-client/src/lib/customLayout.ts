import type { CustomFrame, CustomLayout } from "../../../shared/contracts";

export function resizeFrame(
  frame: CustomFrame,
  factor: number,
  aspect: number,
) {
  const scale = Math.min(
    85 / frame.width,
    80 / frame.height,
    Math.max(8 / frame.width, 8 / frame.height, factor),
  );
  const width = frame.width * scale;
  const height = frame.height * scale;
  return fitFrame(
    {
      ...frame,
      x: frame.x + (frame.width - width) / 2,
      y: frame.y + (frame.height - height) / 2,
      width,
      height,
    },
    aspect,
  );
}

export function fitFrame(frame: CustomFrame, aspect: number): CustomFrame {
  const f = { ...frame };
  const angle = (f.rotation * Math.PI) / 180;
  const extent = () => ({
    w:
      Math.abs(Math.cos(angle)) * f.width +
      Math.abs(Math.sin(angle)) * f.height * aspect,
    h:
      (Math.abs(Math.sin(angle)) * f.width) / aspect +
      Math.abs(Math.cos(angle)) * f.height,
  });
  const initial = extent();
  const scale = Math.min(1, 98 / initial.w, 88 / initial.h);
  f.width *= scale;
  f.height *= scale;
  const box = extent();
  const cx = Math.max(
    box.w / 2 + 1,
    Math.min(99 - box.w / 2, f.x + f.width / 2),
  );
  const cy = Math.max(
    box.h / 2 + 1,
    Math.min(89 - box.h / 2, f.y + f.height / 2),
  );
  return { ...f, x: cx - f.width / 2, y: cy - f.height / 2 };
}

export function customGrid(
  count: number,
  aspectRatio = 0.75,
  curved = false,
): CustomLayout {
  const columns = count === 1 ? 1 : count <= 6 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  return {
    aspectRatio,
    frames: Array.from({ length: count }, (_, i) =>
      fitFrame(
        {
          x: 7 + ((i % columns) * 88) / columns,
          y:
            5 +
            (Math.floor(i / columns) * 80) / rows +
            (curved ? Math.pow((i % columns) - (columns - 1) / 2, 2) * 5 : 0),
          width: 80 / columns,
          height: 70 / rows,
          rotation: curved ? ((i % columns) - (columns - 1) / 2) * 18 : 0,
        },
        aspectRatio,
      ),
    ),
  };
}
