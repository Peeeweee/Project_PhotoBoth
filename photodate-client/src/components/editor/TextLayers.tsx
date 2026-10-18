import { useEffect, useRef, useState } from "react";
import { Scaling, RotateCw } from "lucide-react";
import type { TextLayer } from "../../../../shared/contracts";
import { useSessionStore } from "../../state/useSessionStore";
import { titleFont } from "../../data/textStyles";

export default function TextLayers({
  editable = false,
  selectedId,
  onSelect,
  autoColor,
}: {
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  autoColor: string;
}) {
  const layers = useSessionStore((s) => s.textLayers);
  return (
    <>
      {layers.map((layer) => (
        <TextItem
          key={layer.id}
          layer={layer}
          editable={editable}
          selected={selectedId === layer.id}
          onSelect={() => onSelect?.(layer.id)}
          autoColor={autoColor}
        />
      ))}
    </>
  );
}

function TextItem({
  layer,
  editable,
  selected,
  onSelect,
  autoColor,
}: {
  layer: TextLayer;
  editable: boolean;
  selected: boolean;
  onSelect: () => void;
  autoColor: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    pointer: number;
    startX: number;
    startY: number;
    centerX: number;
    centerY: number;
    w: number;
    h: number;
    mode: string;
    start: TextLayer;
    value: TextLayer;
  } | null>(null);
  const [draft, setDraft] = useState<TextLayer | null>(null);
  const [uiScale, setUiScale] = useState(1);
  useEffect(() => {
    const parent = element.current?.parentElement;
    if (!parent) return;
    const measure = () =>
      setUiScale(
        parent.offsetWidth / Math.max(1, parent.getBoundingClientRect().width),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    measure();
    return () => observer.disconnect();
  }, []);
  const value = draft ?? layer;
  const finish = (cancel = false) => {
    const d = gesture.current;
    gesture.current = null;
    setDraft(null);
    if (d && !cancel)
      useSessionStore.getState().updateTextLayer(layer.id, d.value);
  };
  return (
    <div
      ref={element}
      className="print-text-layer"
      data-selected={editable && selected}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={
        editable ? `Select text: ${layer.text || "Empty text"}` : undefined
      }
      style={{
        position: "absolute",
        left: `${value.x}%`,
        top: `${value.y}%`,
        width: `${value.width}%`,
        transform: `translate(-50%,-50%) rotate(${value.rotation}deg)`,
        fontFamily: titleFont(value.style.font),
        fontSize: value.fontSize * value.style.size,
        fontWeight: value.style.bold ? 700 : 400,
        fontStyle: value.style.italic ? "italic" : "normal",
        color: value.style.color === "auto" ? autoColor : value.style.color,
        textAlign: "center",
        lineHeight: 1.2,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        zIndex: 7,
        pointerEvents: editable ? "auto" : "none",
        touchAction: editable ? "none" : "auto",
        cursor: editable ? "move" : "default",
        outline:
          editable && selected
            ? `${2 * uiScale}px solid var(--c-accent)`
            : undefined,
        outlineOffset: 4 * uiScale,
      }}
      onClick={(e) => {
        if (editable) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onDoubleClick={() => {
        if (editable) document.getElementById("studio-text-input")?.focus();
      }}
      onKeyDown={(e) => {
        if (!editable || e.target !== e.currentTarget) return;
        if (e.key === "Enter") {
          onSelect();
          document.getElementById("studio-text-input")?.focus();
        }
        const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        if (dx || dy) {
          e.preventDefault();
          useSessionStore
            .getState()
            .updateTextLayer(layer.id, {
              x: Math.max(5, Math.min(95, layer.x + dx)),
              y: Math.max(5, Math.min(95, layer.y + dy)),
            });
        }
      }}
      onPointerDown={(e) => {
        if (!editable || e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        onSelect();
        const box = e.currentTarget.parentElement!.getBoundingClientRect();
        gesture.current = {
          pointer: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          centerX: box.left + (layer.x / 100) * box.width,
          centerY: box.top + (layer.y / 100) * box.height,
          w: box.width,
          h: box.height,
          mode:
            (e.target as HTMLElement).closest<HTMLElement>("[data-text-mode]")
              ?.dataset.textMode ?? "move",
          start: layer,
          value: layer,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = gesture.current;
        if (!d || d.pointer !== e.pointerId) return;
        let next = { ...d.start };
        if (d.mode === "resize") {
          const ratio =
            Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY) /
            Math.max(1, Math.hypot(d.startX - d.centerX, d.startY - d.centerY));
          next.fontSize = Math.max(8, Math.min(240, d.start.fontSize * ratio));
          next.width = Math.max(10, Math.min(90, d.start.width * ratio));
        } else if (d.mode === "rotate") {
          const delta =
            Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX) -
            Math.atan2(d.startY - d.centerY, d.startX - d.centerX);
          next.rotation = Math.max(
            -180,
            Math.min(
              180,
              d.start.rotation +
                (Math.atan2(Math.sin(delta), Math.cos(delta)) * 180) / Math.PI,
            ),
          );
        } else {
          next.x = Math.max(
            5,
            Math.min(95, d.start.x + ((e.clientX - d.startX) / d.w) * 100),
          );
          next.y = Math.max(
            5,
            Math.min(95, d.start.y + ((e.clientY - d.startY) / d.h) * 100),
          );
        }
        d.value = next;
        setDraft(next);
      }}
      onPointerUp={(e) => {
        if (gesture.current?.pointer === e.pointerId) finish();
      }}
      onPointerCancel={() => finish(true)}
      onLostPointerCapture={() => {
        if (gesture.current) finish(true);
      }}
    >
      {value.text || (editable ? "Type your text" : "")}
      {editable && selected && (
        <span
          className="text-layer-handles"
          data-export-ignore="true"
          style={{ fontSize: 12 * uiScale }}
        >
          <button
            type="button"
            data-text-mode="rotate"
            aria-label="Rotate text"
            style={{
              top: -32 * uiScale,
              left: `calc(50% - ${14 * uiScale}px)`,
              width: 28 * uiScale,
              height: 28 * uiScale,
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                useSessionStore
                  .getState()
                  .updateTextLayer(layer.id, {
                    rotation: Math.max(
                      -180,
                      Math.min(
                        180,
                        layer.rotation + (e.key === "ArrowRight" ? 5 : -5),
                      ),
                    ),
                  });
              }
            }}
          >
            <RotateCw size={14 * uiScale} />
          </button>
          <button
            type="button"
            data-text-mode="resize"
            aria-label="Resize text"
            style={{
              bottom: -18 * uiScale,
              right: -18 * uiScale,
              width: 28 * uiScale,
              height: 28 * uiScale,
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                useSessionStore
                  .getState()
                  .updateTextLayer(layer.id, {
                    fontSize: Math.max(
                      8,
                      Math.min(
                        240,
                        layer.fontSize + (e.key === "ArrowUp" ? 4 : -4),
                      ),
                    ),
                  });
              }
            }}
          >
            <Scaling size={14 * uiScale} />
          </button>
        </span>
      )}
    </div>
  );
}
