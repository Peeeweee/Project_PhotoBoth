import { exportPixelRatio } from "../lib/deviceSupport";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Heart, ArrowRight } from "lucide-react";
import { useSessionStore } from "../state/useSessionStore";
import { leaveSession } from "../lib/session";
import { waitForExport } from "../lib/exportReady";
import { StripCanvas, DraggableSticker, DrawOverlay } from "./editor";
import { STICKERS } from "../data/stickerPresets";
import { FILTER_PRESETS } from "../data/filterPresets";
export default function RoomClosed() {
  const state = useSessionStore();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const hasPhotos = state.assignedPhotos.some(Boolean);
  return (
    <section className="closed-session studio-page">
      <div className="closed-session-icon">
        <Heart size={28} />
      </div>
      <span className="studio-eyebrow">UNTIL THE NEXT PHOTO DATE</span>
      <h1>This room has wrapped up.</h1>
      <p>
        The host ended the session.
        {hasPhotos
          ? " Your latest strip is still here. Save a copy before leaving this tab."
          : " Thanks for being part of the moment. Start a fresh room whenever you’re ready."}
      </p>
      {hasPhotos && (
        <div className="closed-preview studio-card">
          <StripCanvas
            ref={ref}
            layoutId={state.layoutId}
            designId={state.designPreset?.id ?? "solid-white"}
            design={state.designPreset ?? undefined}
            photos={state.assignedPhotos}
            title={state.stripTitle}
            showWatermark={state.showWatermark}
            photoFilterCss={
              FILTER_PRESETS.find((f) => f.id === state.filterId)?.cssFilter
            }
          >
            {state.placedStickers.map((sticker) => {
              const preset = STICKERS.find((s) => s.id === sticker.stickerId);
              return preset ? (
                <DraggableSticker
                  key={sticker.id}
                  sticker={sticker}
                  url={preset.url}
                  readOnly
                  isSelected={false}
                  onSelect={() => {}}
                  onUpdate={() => {}}
                  onRemove={() => {}}
                />
              ) : null;
            })}
            <DrawOverlay
              isActive={false}
              currentColor="#fff"
              currentThickness={4}
            />
          </StripCanvas>
        </div>
      )}
      <div className="closed-actions">
        {hasPhotos && (
          <button
            className="action-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const node = ref.current;
                if (!node) throw new Error("Strip unavailable");
                await waitForExport(node);
                const { toPng } = await import("html-to-image");
                const url = await toPng(node, {
                  pixelRatio: exportPixelRatio(
                    node.offsetWidth,
                    node.offsetHeight,
                    window.matchMedia("(pointer: coarse)").matches,
                  ),
                  skipFonts: true,
                });
                const link = document.createElement("a");
                setSavedUrl(url);
                link.href = url;
                link.download = "photodate.png";
                link.click();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not save the strip",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={17} />
            {busy ? "Preparing…" : "Save my strip"}
          </button>
        )}
        <button
          className="action-secondary"
          onClick={() => {
            leaveSession();
            navigate("/");
          }}
        >
          Back to PhotoDate <ArrowRight size={17} />
        </button>
      </div>
      {savedUrl && (
        <a
          className="studio-text-button"
          href={savedUrl}
          download="photodate.png"
        >
          Download your prepared strip
        </a>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
