import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutTemplate, ArrowRight } from "lucide-react";
import { useSessionStore } from "../state/useSessionStore";
import { LayoutPicker } from "../components/layout";

// ── Animation presets ──────────────────────────────────────────
const fadeUp: any = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function LayoutSelect() {
  const navigate = useNavigate();
  const { layoutId, setLayoutId } = useSessionStore();

  const handleNext = () => {
    if (layoutId) {
      navigate("/design");
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
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        animate="show"
        style={{
          width: "100%",
          maxWidth: 1040,
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
            <LayoutTemplate size={12} color="var(--c-text-md)" />
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
              Step 2 of 3
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
            Choose your strip
          </h1>
          <p
            style={{
              color: "var(--c-text-md)",
              fontSize: "var(--text-sm)",
              margin: 0,
              lineHeight: "var(--lh-relaxed)",
            }}
          >
            Portraits, wide moments, or a little of both. Find a keepsake for
            your crew’s cameras — phones and laptops welcome.
          </p>
        </motion.div>

        {/* ── Picker ────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <LayoutPicker
            selectedId={layoutId}
            onSelect={(layout) => setLayoutId(layout.id)}
          />
        </motion.div>

        {/* ── Actions ───────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "var(--sp-4)",
          }}
        >
          <button
            onClick={handleNext}
            disabled={!layoutId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              padding: "var(--sp-4) var(--sp-8)",
              background: layoutId ? "var(--c-text-hi)" : "var(--c-surface-2)",
              border: "none",
              borderRadius: "var(--r-full)",
              color: layoutId ? "var(--c-bg)" : "var(--c-text-lo)",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              cursor: layoutId ? "pointer" : "not-allowed",
              transition: "all var(--dur-base)",
              boxShadow: layoutId ? "var(--shadow-md)" : "none",
            }}
          >
            Next <ArrowRight size={18} />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
