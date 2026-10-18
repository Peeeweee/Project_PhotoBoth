import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Palette } from "lucide-react";
import { useSessionStore } from "../state/useSessionStore";
import { useRoomStore } from "../state/useRoomStore";
import { socket } from "../lib/socket";
import { EDGE_STYLES, stripEdgeStyle } from "../lib/stripEdges";
import { StripCanvas } from "../components/editor";
import { getLayout } from "../data/stripLayouts";
import { DESIGN_PACKS, ALL_DESIGNS } from "../data/themePacks";
import { DesignPicker } from "../components/design";

// ── Animation presets ──────────────────────────────────────────
const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function DesignSelect() {
  const navigate = useNavigate();
  const { designPreset, setDesignPreset, layoutId } = useSessionStore();
  const customLayout = useSessionStore((s) => s.customLayout);
  const layout = getLayout(layoutId, customLayout);
  const edge = EDGE_STYLES.find(
    (e) => e.id === (designPreset?.edgeStyle ?? "square"),
  )!;
  const selectedPack = DESIGN_PACKS.find((pack) =>
    pack.designs.some((d) => d.id === designPreset?.id),
  );
  const previewDesign = designPreset ?? ALL_DESIGNS[0];
  const { roomCode, selfId } = useRoomStore();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  const handleNext = () => {
    if (designPreset && roomCode && selfId && !isStarting) {
      setIsStarting(true);
      setError("");
      // Sync selections to server and broadcast
      socket.emit(
        "update-room-selections",
        {
          code: roomCode,
          participantId: selfId,
          layoutId: layoutId,
          designId: designPreset.id,
          customDesign: designPreset,
          customLayout: layoutId === "custom" ? customLayout : null,
          keepsakeStyle: {
            stripTitle: useSessionStore.getState().stripTitle,
            titleStyle: useSessionStore.getState().titleStyle,
            titlePosition: useSessionStore.getState().titlePosition,
            filterId: useSessionStore.getState().filterId,
          },
        },
        (ack) => {
          if (ack.ok) {
            setIsStarting(false);
            socket.emit(
              "update-room-state",
              { code: roomCode, participantId: selfId, status: "ready" },
              (ack) => {
                if (ack.ok) navigate("/capture");
                else setError(ack.error.message);
              },
            );
          } else {
            setIsStarting(false);
            setError(ack.error.message);
          }
        },
      );
    }
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--sp-8) var(--sp-4) var(--sp-12)",
      }}
    >
      {error && <p role="alert">{error}</p>}

      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        animate="show"
        style={{
          width: "100%",
          maxWidth: 1180,
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-8)",
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          style={{ textAlign: "center", paddingTop: "var(--sp-6)" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              padding: "var(--sp-1) var(--sp-3)",
              background: "var(--c-surface-2)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--r-full)",
              marginBottom: "var(--sp-4)",
            }}
          >
            <Palette size={12} color="var(--c-text-md)" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--c-text-md)",
                fontWeight: 500,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Step 3 of 3
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(1.75rem, 4vw, var(--text-4xl))",
              fontWeight: 700,
              color: "var(--c-text-hi)",
              margin: "0 0 var(--sp-2)",
              lineHeight: "var(--lh-tight)",
            }}
          >
            Set the mood
          </h1>
          <p
            style={{
              color: "var(--c-text-md)",
              fontSize: "var(--text-sm)",
              margin: 0,
              lineHeight: "var(--lh-relaxed)",
            }}
          >
            Choose the frame design for your prints
          </p>
        </motion.div>

        <div className="design-config-grid">
          <div className="design-config-options">
            {/* ── Picker ────────────────────────────────────────── */}
            <motion.div variants={fadeUp}>
              <DesignPicker
                selectedId={designPreset?.id ?? null}
                onSelect={(preset) =>
                  setDesignPreset({
                    ...preset,
                    edgeStyle: designPreset?.edgeStyle ?? "square",
                  })
                }
              />
            </motion.div>

            <section
              className="edge-picker studio-card"
              aria-labelledby="edge-heading"
            >
              <div>
                <span className="studio-eyebrow">THE FINISHING TOUCH</span>
                <h2 id="edge-heading">Find your edge</h2>
                <p>
                  Classic corners or a playful keepsake? These edges appear on
                  your saved photos too.
                </p>
              </div>
              <div className="edge-options">
                {EDGE_STYLES.map((edge) => (
                  <button
                    key={edge.id}
                    type="button"
                    aria-pressed={
                      (designPreset?.edgeStyle ?? "square") === edge.id
                    }
                    onClick={() =>
                      setDesignPreset({
                        ...(designPreset ?? {
                          id: "solid-white",
                          name: "Clean White",
                          background: "#ffffff",
                        }),
                        edgeStyle: edge.id,
                      })
                    }
                  >
                    <span
                      className="edge-sample"
                      style={stripEdgeStyle(edge.id, 1, 65)}
                    >
                      <span />
                    </span>
                    <strong>{edge.name}</strong>
                    <small>{edge.description}</small>
                  </button>
                ))}
              </div>
            </section>
            {/* ── Actions ───────────────────────────────────────── */}
            <motion.div
              variants={fadeUp}
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "var(--sp-4)",
              }}
            >
              <motion.button
                variants={fadeUp}
                disabled={!designPreset || isStarting}
                onClick={handleNext}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--sp-2)",
                  padding: "var(--sp-3) var(--sp-6)",
                  background: designPreset
                    ? "var(--c-accent)"
                    : "var(--c-surface-3)",
                  color: designPreset ? "var(--c-bg)" : "var(--c-text-lo)",
                  border: "none",
                  borderRadius: "var(--r-md)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  cursor:
                    designPreset && !isStarting ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
                whileHover={
                  designPreset && !isStarting ? { y: -1, scale: 1.02 } : {}
                }
                whileTap={designPreset && !isStarting ? { scale: 0.98 } : {}}
              >
                {isStarting ? (
                  <>
                    <span
                      style={{
                        animation: "spin 1s linear infinite",
                        display: "inline-block",
                      }}
                    >
                      ⟳
                    </span>
                    Starting…
                  </>
                ) : (
                  <>
                    Next step
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </>
                )}
              </motion.button>
            </motion.div>
          </div>
          <aside
            className="design-live-preview studio-card"
            aria-label="Live strip preview"
          >
            <div className="studio-card-heading">
              <span>YOUR STRIP, YOUR STYLE</span>
              <span className="studio-pill">Live preview</span>
            </div>
            <div className="design-preview-canvas">
              <StripCanvas
                layoutId={layoutId}
                designId={previewDesign.id}
                design={previewDesign}
                title="Your memories"
                showWatermark
              />
            </div>
            <div className="design-preview-summary">
              <div role="status" aria-live="polite" aria-atomic="true">
                <span className="studio-eyebrow">
                  {designPreset ? "YOU PICKED" : "MAKE IT YOURS"}
                </span>
                <h2>{designPreset?.name ?? "Choose a color or pattern"}</h2>
                <p>
                  {designPreset
                    ? `${selectedPack?.name ?? "Your custom design"} · ${edge.name} edges`
                    : "Tap a swatch to see it on your strip."}
                </p>
              </div>
              <dl>
                <div>
                  <dt>Layout</dt>
                  <dd>{layout.name}</dd>
                </div>
                <div>
                  <dt>Photos</dt>
                  <dd>{layout.slotCount} frames</dd>
                </div>
                <div>
                  <dt>Edge</dt>
                  <dd>{edge.name}</dd>
                </div>
              </dl>
              <p className="studio-note">
                Your photos will fill these frames after capture.
              </p>
            </div>
          </aside>
        </div>
      </motion.div>
    </div>
  );
}
