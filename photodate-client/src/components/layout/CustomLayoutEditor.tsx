import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Grid2X2,
  Image,
  Minus,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Scaling,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { CustomFrame, CustomLayout } from "../../../../shared/contracts";
import { useSessionStore } from "../../state/useSessionStore";
import { customGrid, fitFrame, resizeFrame } from "../../lib/customLayout";

type Gesture = {
  pointer: number;
  mode: string;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
  canvasW: number;
  canvasH: number;
  frame: CustomFrame;
  layout: CustomLayout;
  index: number;
};
export default function CustomLayoutEditor() {
  const custom = useSessionStore((s) => s.customLayout);
  const layoutId = useSessionStore((s) => s.layoutId);
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState(() => custom ?? customGrid(4));
  const current = useRef(draft);
  const [history, setHistory] = useState<CustomLayout[]>([]);
  const [arrangement, setArrangement] = useState("grid");
  const drag = useRef<Gesture | null>(null);
  const active = Math.min(selected, draft.frames.length - 1);
  const frame = draft.frames[active];
  const remember = (value: CustomLayout) =>
    setHistory((h) => [...h.slice(-19), value]);
  const save = (next: CustomLayout, record = true) => {
    if (record) remember(current.current);
    current.current = next;
    setDraft(next);
    useSessionStore.setState({
      customLayout: next,
      layoutId: "custom",
      shotCount: next.frames.length,
    });
  };
  const replace = (next: CustomFrame) =>
    save({
      ...draft,
      frames: draft.frames.map((f, i) => (i === active ? next : f)),
    });
  const update = (patch: Partial<CustomFrame>) =>
    replace(fitFrame({ ...frame, ...patch }, draft.aspectRatio));
  const arrange = (
    name: string,
    count = draft.frames.length,
    aspect = draft.aspectRatio,
  ) => {
    setArrangement(name);
    const next = customGrid(count, aspect, name === "arc");
    if (name === "scattered")
      next.frames = next.frames.map((f, i) =>
        fitFrame({ ...f, rotation: i % 2 ? 8 : -8 }, aspect),
      );
    setSelected(0);
    save(next);
  };
  const stop = (cancel = false) => {
    const d = drag.current;
    if (!d) return;
    if (cancel) save(d.layout, false);
    else if (JSON.stringify(d.layout) !== JSON.stringify(current.current))
      remember(d.layout);
    drag.current = null;
  };
  return (
    <details className="layout-maker" open={layoutId === "custom" || undefined}>
      <summary>
        <span className="maker-heading-icon">
          <Sparkles size={22} />
        </span>
        <span>
          <strong>A layout, made by you.</strong>
          <small>Start with a look. Make it your own.</small>
        </span>
        <span className="maker-open-label">
          Create a layout <ChevronDown size={16} />
        </span>
      </summary>
      <div className="maker-content">
        <div className="maker-setup">
          <div>
            <span className="maker-label">HOW MANY MOMENTS?</span>
            <div className="maker-stepper">
              <button
                aria-label="Fewer photos"
                disabled={draft.frames.length <= 1}
                onClick={() => arrange(arrangement, draft.frames.length - 1)}
              >
                <Minus size={16} />
              </button>
              <strong>
                {draft.frames.length} <span>photos</span>
              </strong>
              <button
                aria-label="More photos"
                disabled={draft.frames.length >= 12}
                onClick={() => arrange(arrangement, draft.frames.length + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div>
            <span className="maker-label">PRINT SHAPE</span>
            <div className="maker-segments">
              {(
                [
                  [0.75, "Portrait"],
                  [1, "Square"],
                  [1.5, "Wide"],
                ] as const
              ).map(([ratio, label]) => (
                <button
                  key={label}
                  aria-pressed={draft.aspectRatio === ratio}
                  onClick={() =>
                    arrange(arrangement, draft.frames.length, ratio)
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="maker-workspace">
          <div className="maker-stage">
            <div className="maker-stage-label">
              <span>
                <Move size={14} /> Drag to move
              </span>
              <span>
                {layoutId === "custom" ? "Changes saved" : "Your preview"}
              </span>
            </div>
            <div
              className="maker-paper"
              style={{ aspectRatio: draft.aspectRatio }}
            >
              {draft.frames.map((f, i) => (
                <div
                  key={i}
                  className="maker-photo"
                  data-active={active === i}
                  style={{
                    left: `${f.x}%`,
                    top: `${f.y}%`,
                    width: `${f.width}%`,
                    height: `${f.height}%`,
                    transform: `rotate(${f.rotation}deg)`,
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const box =
                      e.currentTarget.parentElement!.getBoundingClientRect();
                    const mode =
                      (e.target as HTMLElement).closest<HTMLElement>(
                        "[data-mode]",
                      )?.dataset.mode ?? "move";
                    setSelected(i);
                    drag.current = {
                      pointer: e.pointerId,
                      mode,
                      startX: e.clientX,
                      startY: e.clientY,
                      centerX:
                        box.left + ((f.x + f.width / 2) / 100) * box.width,
                      centerY:
                        box.top + ((f.y + f.height / 2) / 100) * box.height,
                      canvasW: box.width,
                      canvasH: box.height,
                      frame: f,
                      layout: current.current,
                      index: i,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || d.pointer !== e.pointerId) return;
                    let next = d.frame;
                    if (d.mode === "resize") {
                      const initial = Math.hypot(
                        d.startX - d.centerX,
                        d.startY - d.centerY,
                      );
                      const distance = Math.hypot(
                        e.clientX - d.centerX,
                        e.clientY - d.centerY,
                      );
                      next = resizeFrame(
                        d.frame,
                        distance / Math.max(1, initial),
                        draft.aspectRatio,
                      );
                    } else if (d.mode === "rotate") {
                      const start = Math.atan2(
                        d.startY - d.centerY,
                        d.startX - d.centerX,
                      );
                      const angle = Math.atan2(
                        e.clientY - d.centerY,
                        e.clientX - d.centerX,
                      );
                      const degrees = ((angle - start) * 180) / Math.PI;
                      next = fitFrame(
                        {
                          ...d.frame,
                          rotation: Math.max(
                            -90,
                            Math.min(
                              90,
                              Math.round((d.frame.rotation + degrees) / 2) * 2,
                            ),
                          ),
                        },
                        draft.aspectRatio,
                      );
                    } else
                      next = fitFrame(
                        {
                          ...d.frame,
                          x:
                            d.frame.x +
                            ((e.clientX - d.startX) / d.canvasW) * 100,
                          y:
                            d.frame.y +
                            ((e.clientY - d.startY) / d.canvasH) * 100,
                        },
                        draft.aspectRatio,
                      );
                    save(
                      {
                        ...d.layout,
                        frames: d.layout.frames.map((old, n) =>
                          n === d.index ? next : old,
                        ),
                      },
                      false,
                    );
                  }}
                  onPointerUp={() => stop()}
                  onPointerCancel={() => stop(true)}
                  onLostPointerCapture={() => stop()}
                >
                  <button
                    className="maker-photo-select"
                    aria-label={`Select and move photo ${i + 1}`}
                    aria-pressed={active === i}
                    onClick={() => setSelected(i)}
                    onKeyDown={(e) => {
                      if (
                        ![
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                        ].includes(e.key)
                      )
                        return;
                      e.preventDefault();
                      setSelected(i);
                      const step = e.shiftKey ? 5 : 1;
                      const patch = {
                        ...f,
                        x:
                          f.x +
                          (e.key === "ArrowRight"
                            ? step
                            : e.key === "ArrowLeft"
                              ? -step
                              : 0),
                        y:
                          f.y +
                          (e.key === "ArrowDown"
                            ? step
                            : e.key === "ArrowUp"
                              ? -step
                              : 0),
                      };
                      save({
                        ...draft,
                        frames: draft.frames.map((old, n) =>
                          n === i ? fitFrame(patch, draft.aspectRatio) : old,
                        ),
                      });
                    }}
                  >
                    <Image size={24} strokeWidth={1.3} />
                    <span>Photo {String(i + 1).padStart(2, "0")}</span>
                  </button>
                  {active === i && (
                    <>
                      <button
                        className="maker-handle maker-rotate"
                        data-mode="rotate"
                        aria-label={`Rotate photo ${i + 1}`}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                            e.preventDefault();
                            update({
                              rotation: Math.max(
                                -90,
                                Math.min(
                                  90,
                                  frame.rotation +
                                    (e.key === "ArrowRight" ? 5 : -5),
                                ),
                              ),
                            });
                          }
                        }}
                      >
                        <RotateCw size={13} />
                      </button>
                      <button
                        className="maker-handle maker-resize"
                        data-mode="resize"
                        aria-label={`Resize photo ${i + 1}`}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                            replace(
                              resizeFrame(
                                frame,
                                e.key === "ArrowUp" ? 1.05 : 0.95,
                                draft.aspectRatio,
                              ),
                            );
                          }
                        }}
                      >
                        <Scaling size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              <span className="maker-paper-caption">
                PhotoDate <small>A LITTLE MOMENT, FOREVER.</small>
              </span>
            </div>
            <p className="maker-canvas-hint">
              Pick a photo. Pull its corner to resize, or turn the top handle.
            </p>
          </div>
          <aside className="maker-panel">
            <div>
              <span className="maker-label">1. PICK A STARTING LOOK</span>
              <div className="maker-presets">
                {(
                  [
                    ["grid", "Neat", Grid2X2],
                    ["scattered", "Playful", Sparkles],
                    ["arc", "Curved", RotateCw],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    aria-pressed={arrangement === id}
                    onClick={() => arrange(id)}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="maker-fine-tune">
              <span className="maker-label">2. MAKE A LITTLE ADJUSTMENT</span>
              <div className="maker-photo-tabs" aria-label="Select a photo">
                {draft.frames.map((_, i) => (
                  <button
                    key={i}
                    aria-pressed={active === i}
                    onClick={() => setSelected(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="maker-adjustment-heading">
                <strong>Photo {active + 1}</strong>
                <span>{Math.round(frame.rotation)}° tilt</span>
              </div>
              <div className="maker-quick-actions">
                <button
                  aria-label="Tilt left"
                  onClick={() =>
                    update({ rotation: Math.max(-90, frame.rotation - 5) })
                  }
                >
                  <RotateCcw size={17} />
                </button>
                <button onClick={() => update({ rotation: 0 })}>
                  Straighten
                </button>
                <button
                  aria-label="Tilt right"
                  onClick={() =>
                    update({ rotation: Math.min(90, frame.rotation + 5) })
                  }
                >
                  <RotateCw size={17} />
                </button>
              </div>
              <div className="maker-size-control">
                <span>Size</span>
                <button
                  aria-label="Make photo smaller"
                  onClick={() =>
                    replace(resizeFrame(frame, 0.9, draft.aspectRatio))
                  }
                >
                  <Minus size={16} />
                </button>
                <button
                  aria-label="Make photo larger"
                  onClick={() =>
                    replace(resizeFrame(frame, 1.1, draft.aspectRatio))
                  }
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <details className="maker-advanced">
              <summary>
                Fine adjustments <ChevronDown size={14} />
              </summary>
              {(
                [
                  ["x", "Horizontal position", 0, 90],
                  ["y", "Vertical position", 0, 85],
                  ["width", "Width", 8, 85],
                  ["height", "Height", 8, 80],
                  ["rotation", "Rotation", -90, 90],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key}>
                  {label}
                  <output>
                    {Math.round(frame[key])}
                    {key === "rotation" ? "°" : "%"}
                  </output>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={frame[key]}
                    onChange={(e) => update({ [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </details>
            <button
              className="maker-undo"
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1);
                if (previous) {
                  setHistory(history.slice(0, -1));
                  save(previous, false);
                }
              }}
            >
              <Undo2 size={15} /> Undo last change
            </button>
            <div className="maker-next">
              <span>
                <Check size={14} />{" "}
                {layoutId === "custom"
                  ? "Your layout is saved"
                  : "Ready when you are"}
              </span>
              <button
                className="action-primary"
                onClick={() => {
                  save(current.current, false);
                  navigate("/design");
                }}
              >
                Choose a frame <ArrowRight size={17} />
              </button>
              <small>Colors, borders & finishing touches come next.</small>
            </div>
          </aside>
        </div>
      </div>
    </details>
  );
}
