import { useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionPhase } from "../lib/brandMotion";

export default function MotionScene({
  name,
  start,
}: {
  name: string;
  start: number;
}) {
  const [phase] = useState(() => motionPhase(start, Date.now()));
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`motion-scene motion-${name}`}
      style={{ "--scene-phase": `${phase}s` } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.85, ease: "easeInOut" }}
    >
      {Array.from({ length: name === "welcome" ? 0 : 4 }, (_, i) => (
        <div
          className={`motion-actor actor-${i}`}
          key={i}
          style={
            { "--actor": i, "--actor-angle": `${i * 72}deg` } as CSSProperties
          }
        >
          <div className="motion-object">
            {Array.from({ length: 5 }, (_, j) => (
              <i
                key={j}
                style={
                  {
                    "--piece": j,
                    "--piece-angle": `${(j - 2) * 22}deg`,
                  } as CSSProperties
                }
              >
                <span />
              </i>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
