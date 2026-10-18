import TextLayers from "./TextLayers";
import { DEFAULT_TITLE_STYLE, titleFont } from "../../data/textStyles";
import { stripEdgeStyle } from "../../lib/stripEdges";
import { designBackground } from "../design/designBackground";
import React, { forwardRef, useRef, useState, useEffect } from "react";
import { getLayout } from "../../data/stripLayouts";
import { ALL_DESIGNS } from "../../data/themePacks";
import {
  useSessionStore,
  type LayoutId,
  type DesignPreset,
} from "../../state/useSessionStore";

export interface StripCanvasProps {
  layoutId: LayoutId;
  designId: string;
  design?: DesignPreset;
  onReadyChange?: (ready: boolean) => void;
  photos?: (string | null)[];
  className?: string;
  style?: React.CSSProperties;
  onSlotClick?: (index: number) => void;
  activeSlot?: number;
  renderSlot?: (index: number) => React.ReactNode;
  photoFilterCss?: string;
  title?: string;
  editableText?: boolean;
  selectedTextId?: string | null;
  onTextSelect?: (id: string) => void;
  showWatermark?: boolean;
  children?: React.ReactNode;
}

const FilteredImage = ({
  src,
  filterCss,
  style,
  alt,
}: {
  src: string;
  filterCss: string;
  style: React.CSSProperties;
  alt: string;
}) => {
  const [result, setResult] = useState<{ key: string; url: string } | null>(
    null,
  );
  const key = `${src}|${filterCss}`;
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        if (!filterCss || filterCss === "none") {
          setResult({ key, url: src });
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        setResult({ key, url: canvas.toDataURL("image/png") });
      } catch {
        setResult(null);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, filterCss, key]);
  return (
    <img
      data-image-ready={result?.key === key ? "true" : "false"}
      src={result?.key === key ? result.url : undefined}
      alt={alt}
      style={style}
    />
  );
};

export const StripCanvas = forwardRef<HTMLDivElement, StripCanvasProps>(
  (
    {
      layoutId,
      designId,
      design: explicitDesign,
      onReadyChange,
      photos = [],
      className = "",
      style = {},
      onSlotClick,
      activeSlot,
      renderSlot,
      photoFilterCss = "none",
      title: explicitTitle,
      editableText = false,
      selectedTextId,
      onTextSelect,
      showWatermark = true,
      children,
    },
    ref,
  ) => {
    const storedTitle = useSessionStore((state) => state.stripTitle);
    const title = explicitTitle ?? storedTitle;
    const titleStyle =
      useSessionStore((state) => state.titleStyle) ?? DEFAULT_TITLE_STYLE;
    const titlePosition = useSessionStore((state) => state.titlePosition);
    const customLayout = useSessionStore((s) => s.customLayout);
    const layout = getLayout(layoutId, customLayout);
    const customDesigns = useSessionStore((state) => state.customDesigns);
    const selectedDesign = useSessionStore((state) => state.designPreset);
    const candidate =
      explicitDesign ||
      customDesigns.find((d) => d.id === designId) ||
      (selectedDesign?.id === designId ? selectedDesign : null);
    const design =
      candidate &&
      typeof candidate.id === "string" &&
      typeof candidate.background === "string"
        ? candidate
        : ALL_DESIGNS.find((d) => d.id === designId) || ALL_DESIGNS[0];

    // Parse custom filter CSS if available, else use standard background

    const hex = /^#([0-9a-f]{6})$/i.exec(design.background)?.[1];
    const darkBackground = hex
      ? parseInt(hex.slice(0, 2), 16) * 0.299 +
          parseInt(hex.slice(2, 4), 16) * 0.587 +
          parseInt(hex.slice(4, 6), 16) * 0.114 <
        140
      : [
          "pat-stars",
          "pat-midnight",
          "pat-disco",
          "pat-aurora",
          "pat-glitch",
          "pat-haze",
        ].includes(design.id);
    const backgroundStyle: React.CSSProperties = {
      ...designBackground(design),
      ...(design.id.startsWith("custom-") ? { background: "#ffffff" } : {}),
    };

    const containerId = `strip-canvas-${layoutId}-${designId.replace(/[^a-zA-Z0-9]/g, "-")}`;

    const INTERNAL_WIDTH = 1000;
    const wrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const check = () => {
        const images = [...wrapper.querySelectorAll("img")];
        const ready = images.every(
          (image) =>
            image.complete &&
            image.naturalWidth > 0 &&
            image.dataset.imageReady !== "false",
        );
        wrapper.dataset.exportReady = String(ready);
        const strip = wrapper.querySelector<HTMLElement>("[data-strip-render]");
        if (strip) strip.dataset.exportReady = String(ready);
        onReadyChange?.(ready);
      };
      const observer = new MutationObserver(check);
      observer.observe(wrapper, {
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "data-image-ready"],
        childList: true,
      });
      wrapper.addEventListener("load", check, true);
      wrapper.addEventListener("error", check, true);
      check();
      return () => {
        observer.disconnect();
        wrapper.removeEventListener("load", check, true);
        wrapper.removeEventListener("error", check, true);
      };
    }, [photos, photoFilterCss, designId, onReadyChange]);
    const [scale, setScale] = useState(1);

    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        const internalHeight = INTERNAL_WIDTH / layout.stripAspectRatio;

        const scaleX = width / INTERNAL_WIDTH;
        const scaleY = height / internalHeight;
        setScale(Math.min(scaleX, scaleY));
      });

      observer.observe(el);
      return () => observer.disconnect();
    }, [layout.stripAspectRatio]);

    return (
      <div
        ref={wrapperRef}
        className={className}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          ...style,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: `${INTERNAL_WIDTH}px`,
            height: `${INTERNAL_WIDTH / layout.stripAspectRatio}px`,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div
            ref={ref}
            id={containerId}
            data-strip-render="true"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: layout.id === "custom" ? "block" : "grid",
              gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
              gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
              justifyContent: "center",
              alignContent: "center",
              gap: `${layout.gapFraction * INTERNAL_WIDTH}px`,
              padding: `${layout.paddingFraction * INTERNAL_WIDTH}px ${layout.paddingFraction * INTERNAL_WIDTH}px ${(showWatermark || title ? (layout.bottomPaddingFraction ?? layout.paddingFraction) : layout.paddingFraction) * INTERNAL_WIDTH}px ${layout.paddingFraction * INTERNAL_WIDTH}px`,
              boxSizing: "border-box",
              overflow: "hidden",
              boxShadow: "var(--shadow-lg)",
              containerType: "inline-size",
              flexShrink: 0,
              ...backgroundStyle,
              ...stripEdgeStyle(design.edgeStyle, layout.stripAspectRatio),
            }}
          >
            {layout.slots.map((slot) => {
              const photoUrl = photos[slot.index];
              const isClickable = !!onSlotClick;

              return (
                <div
                  key={slot.index}
                  className={
                    activeSlot === slot.index
                      ? "capture-slot-active"
                      : undefined
                  }
                  data-slot-index={slot.index}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-label={
                    isClickable
                      ? `Assign photo to slot ${slot.index + 1}`
                      : undefined
                  }
                  onKeyDown={(event) => {
                    if (
                      isClickable &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onSlotClick?.(slot.index);
                    }
                  }}
                  onClick={() => onSlotClick?.(slot.index)}
                  style={{
                    gridColumn: `${slot.col + 1} / span ${slot.colSpan}`,
                    gridRow: `${slot.row + 1} / span ${slot.rowSpan}`,
                    borderRadius:
                      design.edgeStyle === "rounded"
                        ? 28
                        : design.edgeStyle === "arch"
                          ? "80px 80px 16px 16px"
                          : 0,
                    backgroundColor: "rgba(0, 0, 0, 0.1)", // Subtle placeholder background
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)",
                    ...(slot.free
                      ? {
                          position: "absolute",
                          left: `${slot.free.x}%`,
                          top: `${slot.free.y}%`,
                          width: `${slot.free.width}%`,
                          height: `${slot.free.height}%`,
                          transform: `rotate(${slot.free.rotation}deg)`,
                          transformOrigin: "center",
                          border: "6px solid rgba(255,255,255,.85)",
                          boxSizing: "border-box",
                          boxShadow: "0 6px 18px #0003",
                        }
                      : {}),
                    cursor: isClickable ? "pointer" : "default",
                  }}
                >
                  {renderSlot?.(slot.index) ??
                    (photoUrl ? (
                      <FilteredImage
                        src={photoUrl}
                        alt={`Slot ${slot.index + 1}`}
                        filterCss={photoFilterCss}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                          transition: "opacity 0.2s",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          color: "rgba(0, 0, 0, 0.15)",
                          fontSize: "2rem",
                          fontWeight: 300,
                        }}
                      >
                        +
                      </div>
                    ))}
                  {/* Hover overlay if clickable */}
                  {isClickable && photoUrl && (
                    <div
                      className="slot-overlay"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(255,255,255,0.2)",
                        opacity: 0,
                        transition: "opacity 0.2s",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              );
            })}

            {design.id.startsWith("custom-") && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: design.background.match(/url\([^)]*\)/)?.[0],
                  backgroundSize: "100% 100%",
                  backgroundRepeat: "no-repeat",
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              />
            )}
            <TextLayers
              editable={editableText}
              selectedId={selectedTextId}
              onSelect={onTextSelect}
              autoColor={darkBackground ? "#fffaf4" : "#333333"}
            />
            {/* Footer Branding Area */}
            {title && (
              <div
                style={{
                  position: "absolute",
                  top: `${titlePosition.auto ? (layout.id === "custom" ? 95 : 100 - (layout.bottomPaddingFraction ?? layout.paddingFraction) * layout.stripAspectRatio * 50) : titlePosition.y}%`,
                  left: `${titlePosition.x}%`,
                  width: "80%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 8%",
                  color: darkBackground ? "#fffaf4" : "#333",
                  fontSize:
                    layout.id === "custom"
                      ? `${Math.min(40, 30 / layout.stripAspectRatio)}px`
                      : "60px",
                  lineHeight: 1.2,
                  fontFamily: "monospace",
                  zIndex: 5,
                  opacity: 0.8,
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                  overflowWrap: "anywhere",
                }}
              >
                {showWatermark && (
                  <span style={{ fontWeight: 700, letterSpacing: "0.05em" }}>
                    PhotoDate
                  </span>
                )}
                <span
                  data-caption-text="true"
                  style={{
                    fontSize: `${0.8 * titleStyle.size}em`,
                    opacity: 1,
                    fontFamily: titleFont(titleStyle.font),
                    fontWeight: titleStyle.bold ? 700 : 400,
                    fontStyle: titleStyle.italic ? "italic" : "normal",
                    color:
                      titleStyle.color === "auto"
                        ? undefined
                        : titleStyle.color,
                  }}
                >
                  {title}
                </span>
              </div>
            )}

            {children}
          </div>
        </div>
      </div>
    );
  },
);

export default StripCanvas;
