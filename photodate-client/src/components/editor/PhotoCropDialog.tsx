import { useEffect, useRef, useState } from "react";
import { Move, RotateCcw, X } from "lucide-react";
import type { PhotoEdit } from "../../../../shared/contracts";
import {
  photoPresentation,
  DEFAULT_PHOTO_EDIT,
  panPhoto,
} from "../../lib/photoEdit";

export default function PhotoCropDialog({
  src,
  index,
  aspect,
  initial,
  onSave,
  onClose,
}: {
  src: string;
  index: number;
  aspect: number;
  initial?: PhotoEdit;
  onSave: (edit: PhotoEdit) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [edit, setEdit] = useState<PhotoEdit>(() => ({
    ...(initial ?? DEFAULT_PHOTO_EDIT),
  }));
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    start: PhotoEdit;
  } | null>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="photo-crop-dialog"
      aria-labelledby="crop-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <button
        className="restart-card-close"
        aria-label="Cancel photo adjustment"
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <span className="studio-eyebrow">MAKE ROOM FOR THE MOMENT</span>
      <h2 id="crop-title">Adjust photo {index + 1}</h2>
      <p>Fill the frame, zoom in, then drag the photo to find its best spot.</p>
      <div
        className="crop-preview"
        style={{
          aspectRatio: aspect,
          width: `min(100%, calc(var(--crop-height, 40dvh) * ${aspect}))`,
          marginInline: "auto",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          drag.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            w: rect.width,
            h: rect.height,
            start: edit,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d?.id === e.pointerId)
            setEdit(
              panPhoto(d.start, e.clientX - d.x, e.clientY - d.y, d.w, d.h),
            );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          if (drag.current) setEdit(drag.current.start);
          drag.current = null;
        }}
      >
        <img
          src={src}
          alt={`Adjust photo ${index + 1}`}
          draggable={false}
          style={photoPresentation(edit)}
        />
        <span>
          <Move size={13} /> Drag to reposition
        </span>
      </div>
      <div className="crop-fit-options" role="group" aria-label="Photo fitting">
        <button
          aria-pressed={edit.fit === "contain"}
          onClick={() => setEdit({ ...edit, fit: "contain" })}
        >
          Keep whole photo
        </button>
        <button
          aria-pressed={edit.fit === "cover"}
          onClick={() => setEdit({ ...edit, fit: "cover" })}
        >
          Fill frame
        </button>
      </div>
      <label>
        Zoom <output>{Math.round(edit.zoom * 100)}%</output>
        <input
          type="range"
          min="100"
          max="300"
          step="5"
          value={edit.zoom * 100}
          onChange={(e) =>
            setEdit({ ...edit, zoom: Number(e.target.value) / 100 })
          }
        />
      </label>
      <div className="crop-pan-controls">
        {(
          [
            ["x", "Horizontal"],
            ["y", "Vertical"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="range"
              min="-50"
              max="50"
              value={edit[key]}
              onChange={(e) =>
                setEdit({ ...edit, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <button
        className="studio-text-button"
        onClick={() => setEdit({ ...DEFAULT_PHOTO_EDIT })}
      >
        <RotateCcw size={13} /> Reset photo
      </button>
      <div className="restart-card-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="action-primary"
          onClick={() => {
            onSave(edit);
            onClose();
          }}
        >
          Apply to this frame
        </button>
      </div>
    </dialog>
  );
}
