import { publishStage } from "../lib/session";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoomStore } from "../state/useRoomStore";
import { useSessionStore } from "../state/useSessionStore";
import {
  StripCanvas,
  DraggableSticker,
  DrawOverlay,
} from "../components/editor";
import { STICKERS } from "../data/stickerPresets";
import { FILTER_PRESETS } from "../data/filterPresets";

async function waitForExport(node: HTMLElement) {
  const started = Date.now();
  while (node.dataset.exportReady !== "true") {
    if (Date.now() - started > 10000)
      throw new Error("Your photos are still rendering. Please retry.");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) => img.decode()),
  );
  if (!node.offsetWidth)
    throw new Error("Strip preview is not visible. Please retry.");
}
export default function ExportRoom() {
  const navigate = useNavigate();
  const { isHost } = useRoomStore();
  const {
    layoutId,
    designPreset,
    filterId,
    assignedPhotos,
    placedStickers,
    stripTitle,
    setStripTitle,
    showWatermark,
    setShowWatermark,
  } = useSessionStore();

  const [exportError, setExportError] = useState("");
  const [lastExport, setLastExport] = useState<{
    url: string;
    name: string;
    format: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const designId = designPreset?.id || "classic";
  const selectedFilter =
    FILTER_PRESETS.find((f) => f.id === filterId) || FILTER_PRESETS[0];

  const handleExportImage = async (format: "png" | "jpeg") => {
    if (!designPreset) return;
    setExportError("");
    setIsExporting(format);
    try {
      const { toPng, toCanvas } = await import("html-to-image");
      const node = document.getElementById(
        `strip-canvas-${layoutId}-${designId.replace(/[^a-zA-Z0-9]/g, "-")}`,
      );
      if (!node) throw new Error("Strip not found");
      await waitForExport(node);

      const pixelRatio = 3200 / Math.max(node.offsetWidth, node.offsetHeight);
      let dataUrl: string;
      if (format === "png")
        dataUrl = await toPng(node, { pixelRatio, skipFonts: true });
      else {
        const canvas = await toCanvas(node, { pixelRatio, skipFonts: true });
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare your image.");
        // JPEG has no transparency: fill behind the clipped edge without recoloring the frame.
        context.globalCompositeOperation = "destination-over";
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL("image/jpeg", 1);
      }

      const link = document.createElement("a");
      link.download = `${stripTitle || "photodate"}.${format}`;
      link.href = dataUrl;
      setLastExport({ url: dataUrl, name: link.download, format });
      link.click();
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Export failed. Please retry.",
      );
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!designPreset) return;
    setExportError("");
    setIsExporting("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      const { toPng } = await import("html-to-image");
      const node = document.getElementById(
        `strip-canvas-${layoutId}-${designId.replace(/[^a-zA-Z0-9]/g, "-")}`,
      );
      if (!node) throw new Error("Strip not found");
      await waitForExport(node);

      const pixelRatio = 3200 / Math.max(node.offsetWidth, node.offsetHeight);
      const dataUrl = await toPng(node, { pixelRatio, skipFonts: true });

      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const pdf = new jsPDF({
        compress: true,
        orientation: img.width > img.height ? "landscape" : "portrait",
        unit: "px",
        format: [img.width, img.height],
      });
      pdf.addImage(
        dataUrl,
        "PNG",
        0,
        0,
        img.width,
        img.height,
        undefined,
        "FAST",
      );
      const filename = `${stripTitle || "photodate"}.pdf`;
      setLastExport({
        url: pdf.output("datauristring"),
        name: filename,
        format: "pdf",
      });
      pdf.save(filename);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Export failed. Please retry.",
      );
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--sp-4)",
        gap: "var(--sp-4)",
        alignItems: "center",
      }}
    >
      {exportError && <p role="alert">{exportError}</p>}
      {lastExport && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {lastExport.format !== "pdf" && (
            <img
              src={lastExport.url}
              alt={`Generated ${lastExport.format.toUpperCase()} export`}
              style={{ width: 48, maxHeight: 96, objectFit: "contain" }}
            />
          )}
          <span>
            Your {lastExport.format.toUpperCase()} is ready.{" "}
            <a href={lastExport.url} download={lastExport.name}>
              Download again
            </a>
          </span>
        </div>
      )}
      <div
        style={{
          textAlign: "center",
          flexShrink: 0,
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(1.5rem, 4vw, var(--text-2xl))",
            fontWeight: 700,
            color: "var(--c-text-hi)",
            margin: "0 0 var(--sp-1)",
          }}
        >
          Your PhotoDate
        </h1>
        <p
          style={{
            color: "var(--c-text-md)",
            fontSize: "var(--text-sm)",
            margin: "0 0 var(--sp-4)",
          }}
        >
          Name your date and save the strip!
        </p>

        {/* Editable Title Field */}
        <input
          type="text"
          aria-label="Photo strip title"
          maxLength={200}
          value={stripTitle}
          onChange={(e) => setStripTitle(e.target.value)}
          disabled={!isHost}
          style={{
            width: "100%",
            padding: "var(--sp-3)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            textAlign: "center",
            background: "var(--c-surface-2)",
            color: "var(--c-text-hi)",
            border: "2px solid transparent",
            borderRadius: "var(--r-md)",
            outline: "none",
            transition: "border 0.2s",
          }}
          onFocus={(e) => {
            if (isHost) e.target.style.border = "2px solid var(--c-accent)";
          }}
          onBlur={(e) => {
            e.target.style.border = "2px solid transparent";
          }}
        />
      </div>

      {/* Final Strip Preview */}
      <div className="flex-1 flex justify-center items-center min-h-0 bg-[var(--c-surface-1)] rounded-[var(--r-lg)] p-4 md:p-8 w-full overflow-hidden">
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <StripCanvas
            layoutId={layoutId}
            design={designPreset ?? undefined}
            designId={designId}
            photos={assignedPhotos}
            photoFilterCss={selectedFilter.cssFilter}
            title={stripTitle}
            showWatermark={showWatermark}
            style={{ width: "100%", height: "100%" }}
          >
            {/* Sticker Overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
              }}
            >
              {placedStickers.map((sticker) => {
                const preset = STICKERS.find((s) => s.id === sticker.stickerId);
                if (!preset) return null;
                return (
                  <div
                    key={sticker.id}
                    style={{ position: "absolute", inset: 0 }}
                  >
                    <DraggableSticker
                      readOnly
                      sticker={sticker}
                      url={preset.url}
                      isSelected={false} // Disable selection outlines on export page
                      onSelect={() => {}}
                      onUpdate={() => {}}
                      onRemove={() => {}}
                    />
                  </div>
                );
              })}
            </div>
            {/* Draw Overlay (Inactive) */}
            <DrawOverlay
              isActive={false}
              currentColor="#ffffff"
              currentThickness={4}
            />
          </StripCanvas>
        </div>

        {/* Toggle Watermark Button */}
        {isHost && (
          <button
            onClick={() => setShowWatermark(!showWatermark)}
            style={{
              position: "absolute",
              top: "var(--sp-2)",
              right: "var(--sp-2)",
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              border: "none",
              padding: "var(--sp-1) var(--sp-2)",
              borderRadius: "var(--r-md)",
              fontSize: "var(--text-xs)",
              cursor: "pointer",
              zIndex: 10,
              backdropFilter: "blur(4px)",
            }}
          >
            {showWatermark ? "Hide Watermark" : "Show Watermark"}
          </button>
        )}
      </div>

      {/* Export Actions */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          gap: "var(--sp-4)",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => handleExportImage("png")}
          disabled={!!isExporting}
          style={{
            background: "var(--c-surface-2)",
            color: "var(--c-text-hi)",
            border: "2px solid var(--c-surface-3)",
            borderRadius: "var(--r-full)",
            padding: "var(--sp-3) var(--sp-6)",
            fontSize: "var(--text-md)",
            fontWeight: 600,
            cursor: isExporting ? "wait" : "pointer",
            transition: "all 0.2s",
            opacity: isExporting ? 0.5 : 1,
          }}
        >
          {isExporting === "png" ? "Saving..." : "Save PNG"}
        </button>
        <button
          onClick={() => handleExportImage("jpeg")}
          disabled={!!isExporting}
          style={{
            background: "var(--c-surface-2)",
            color: "var(--c-text-hi)",
            border: "2px solid var(--c-surface-3)",
            borderRadius: "var(--r-full)",
            padding: "var(--sp-3) var(--sp-6)",
            fontSize: "var(--text-md)",
            fontWeight: 600,
            cursor: isExporting ? "wait" : "pointer",
            transition: "all 0.2s",
            opacity: isExporting ? 0.5 : 1,
          }}
        >
          {isExporting === "jpeg" ? "Saving..." : "Save JPEG"}
        </button>
        <button
          onClick={handleExportPdf}
          disabled={!!isExporting}
          style={{
            background: "var(--c-accent)",
            color: "var(--c-bg)",
            border: "none",
            borderRadius: "var(--r-full)",
            padding: "var(--sp-3) var(--sp-6)",
            fontSize: "var(--text-md)",
            fontWeight: 600,
            cursor: isExporting ? "wait" : "pointer",
            transition: "all 0.2s",
            boxShadow: "var(--shadow-md)",
            opacity: isExporting ? 0.5 : 1,
          }}
        >
          {isExporting === "pdf" ? "Saving..." : "Save PDF"}
        </button>
      </div>

      <div
        style={{ flexShrink: 0, marginTop: "var(--sp-4)", textAlign: "center" }}
      >
        <button
          onClick={() => {
            publishStage("done", () => navigate("/done"));
          }}
          style={{
            background: "none",
            color: "var(--c-text-md)",
            border: "none",
            fontSize: "var(--text-md)",
            fontWeight: 600,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          I'm done exporting
        </button>
      </div>
    </div>
  );
}
