import { useRef, useEffect } from "react";
import { X, Maximize2, RotateCw } from "lucide-react";
import type { PlacedSticker } from "../../state/useSessionStore";

interface DraggableStickerProps {
  sticker: PlacedSticker;
  url: string;
  isSelected: boolean;
  readOnly?: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<PlacedSticker>) => void;
  onRemove: (id: string) => void;
}

export default function DraggableSticker({
  sticker,
  url,
  isSelected,
  readOnly = false,
  onSelect,
  onUpdate,
  onRemove,
}: DraggableStickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupGesture = useRef<(() => void) | null>(null);
  const gesturing = useRef(false);
  const latest = useRef(sticker);
  latest.current = sticker;

  // Gestures paint only this element; the shared editor is updated once on release.
  const paint = (value: PlacedSticker) => {
    const el = containerRef.current;
    if (!el) return;
    el.style.transform = `translate(${value.x}px, ${value.y}px) rotate(${value.rotation}deg) scale(${value.scale})`;
    const parent = el.parentElement;
    const previewScale = parent
      ? parent.getBoundingClientRect().width / parent.offsetWidth
      : 1;
    el.style.setProperty(
      "--sticker-ui-scale",
      String(1 / Math.max(0.01, previewScale * value.scale)),
    );
  };
  useEffect(() => {
    if (!gesturing.current) paint(sticker);
  }, [sticker]);
  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return;
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!gesturing.current) paint(latest.current);
      });
    });
    observer.observe(parent);
    const viewport = parent.closest("[data-strip-render]")?.parentElement
      ?.parentElement;
    if (viewport) observer.observe(viewport);
    return () => {
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      cleanupGesture.current?.();
    };
  }, []);
  useEffect(() => {
    if (readOnly) cleanupGesture.current?.();
  }, [readOnly]);

  const beginGesture = (
    event: React.PointerEvent,
    mode: "move" | "scale" | "rotate",
  ) => {
    if (readOnly || (event.pointerType === "mouse" && event.button !== 0))
      return;
    event.stopPropagation();
    event.preventDefault();
    cleanupGesture.current?.();
    onSelect();
    const el = containerRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const bounds = parent.getBoundingClientRect();
    const previewScale = bounds.width / parent.offsetWidth || 1;
    const start = { ...sticker };
    let draft = { ...start };
    const startX = event.clientX,
      startY = event.clientY;
    const centerX = bounds.left + start.x * previewScale;
    const centerY = bounds.top + start.y * previewScale;
    const startAngle = Math.atan2(startY - centerY, startX - centerX);
    const startDistance = Math.max(
      10,
      Math.hypot(startX - centerX, startY - centerY),
    );
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    target.setPointerCapture(pointerId);
    gesturing.current = true;
    el.style.willChange = "transform";
    let frame = 0;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (mode === "move") {
        draft = {
          ...start,
          x: Math.max(
            0,
            Math.min(
              parent.offsetWidth,
              start.x + (ev.clientX - startX) / previewScale,
            ),
          ),
          y: Math.max(
            0,
            Math.min(
              parent.offsetHeight,
              start.y + (ev.clientY - startY) / previewScale,
            ),
          ),
        };
      } else if (mode === "scale") {
        draft = {
          ...start,
          scale: Math.max(
            0.2,
            Math.min(
              4,
              (start.scale *
                Math.hypot(ev.clientX - centerX, ev.clientY - centerY)) /
                startDistance,
            ),
          ),
        };
      } else {
        draft = {
          ...start,
          rotation:
            start.rotation +
            ((Math.atan2(ev.clientY - centerY, ev.clientX - centerX) -
              startAngle) *
              180) /
              Math.PI,
        };
      }
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          paint(draft);
        });
    };
    const finish = (ev?: PointerEvent) => {
      if (ev && ev.pointerId !== pointerId) return;
      if (ev?.type === "pointerup") move(ev);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      target.removeEventListener("lostpointercapture", cancel);
      cleanupGesture.current = null;
      gesturing.current = false;
      if (target.hasPointerCapture(pointerId))
        target.releasePointerCapture(pointerId);
      el.style.willChange = "";
      paint(draft);
      if (ev?.type === "pointerup")
        onUpdate(sticker.id, {
          x: draft.x,
          y: draft.y,
          scale: draft.scale,
          rotation: draft.rotation,
        });
      else paint(latest.current);
    };
    const cancel = (ev: Event) =>
      finish("pointerId" in ev ? (ev as PointerEvent) : undefined);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    target.addEventListener("lostpointercapture", cancel);
    cleanupGesture.current = () => finish();
  };
  const handlePointerDownScale = (event: React.PointerEvent) =>
    beginGesture(event, "scale");
  const handlePointerDownRotate = (event: React.PointerEvent) =>
    beginGesture(event, "rotate");

  return (
    <div
      ref={containerRef}
      tabIndex={readOnly ? -1 : 0}
      role="group"
      aria-label="Sticker. Arrow keys move; plus and minus resize; R rotates; Delete removes."
      onFocus={() => {
        if (!readOnly) onSelect();
      }}
      onKeyDown={(event) => {
        if (readOnly || event.target !== event.currentTarget) return;
        const step = event.shiftKey ? 20 : 5;
        const updates: Partial<PlacedSticker> = {};
        if (event.key === "ArrowLeft") updates.x = sticker.x - step;
        else if (event.key === "ArrowRight") updates.x = sticker.x + step;
        else if (event.key === "ArrowUp") updates.y = sticker.y - step;
        else if (event.key === "ArrowDown") updates.y = sticker.y + step;
        else if (event.key === "+" || event.key === "=")
          updates.scale = Math.min(4, sticker.scale + 0.1);
        else if (event.key === "-")
          updates.scale = Math.max(0.2, sticker.scale - 0.1);
        else if (event.key.toLowerCase() === "r")
          updates.rotation = sticker.rotation + 15;
        else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          onRemove(sticker.id);
          return;
        } else return;
        event.preventDefault();
        onUpdate(sticker.id, updates);
      }}
      onPointerDown={(event) => beginGesture(event, "move")}
      style={{
        position: "absolute",
        pointerEvents: readOnly ? "none" : "auto",
        top: 0,
        left: 0,
        width: 250,
        height: 250,
        transformOrigin: "center",
        transform: `translate(${sticker.x}px, ${sticker.y}px) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
        // center it based on origin
        marginLeft: -125,
        marginTop: -125,
        touchAction: "none",
        zIndex: isSelected ? 100 : 10,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          border: isSelected
            ? "2px dashed rgba(255, 255, 255, 0.8)"
            : "2px solid transparent",
          boxShadow: isSelected ? "0 0 10px rgba(0,0,0,0.2)" : "none",
          cursor: readOnly ? "default" : "grab",
        }}
      >
        <img
          src={url}
          alt="sticker"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Controls Overlay */}
        {isSelected && !readOnly && (
          <>
            {/* Delete (Top Left) */}
            <button
              aria-label="Remove sticker"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemove(sticker.id)}
              style={{
                position: "absolute",
                top: -22,
                left: -22,
                width: 44,
                height: 44,
                background: "#ff4b4b",
                color: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: "scale(var(--sticker-ui-scale, 1))",
                border: "none",
                cursor: "pointer",
                zIndex: 2,
              }}
            >
              <X size={16} />
            </button>

            {/* Rotate (Top Right) */}
            <button
              aria-label="Rotate sticker"
              onClick={(event) => {
                if (event.detail === 0)
                  onUpdate(sticker.id, { rotation: sticker.rotation + 15 });
              }}
              onPointerDown={handlePointerDownRotate}
              style={{
                position: "absolute",
                top: -22,
                right: -22,
                width: 44,
                height: 44,
                background: "#4b9fff",
                color: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: "scale(var(--sticker-ui-scale, 1))",
                border: "none",
                cursor: "ew-resize",
                zIndex: 2,
                touchAction: "none",
              }}
            >
              <RotateCw size={16} />
            </button>

            {/* Scale (Bottom Right) */}
            <button
              aria-label="Enlarge sticker"
              onClick={(event) => {
                if (event.detail === 0)
                  onUpdate(sticker.id, {
                    scale: Math.min(4, sticker.scale + 0.1),
                  });
              }}
              onPointerDown={handlePointerDownScale}
              style={{
                position: "absolute",
                bottom: -22,
                right: -22,
                width: 44,
                height: 44,
                background: "#4b9fff",
                color: "#fff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: "scale(var(--sticker-ui-scale, 1))",
                border: "none",
                cursor: "ns-resize",
                zIndex: 2,
                touchAction: "none",
              }}
            >
              <Maximize2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
