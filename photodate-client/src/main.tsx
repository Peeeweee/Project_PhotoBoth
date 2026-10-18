import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./branding.css";
import "./motion.css";
import "./photoStyles.css";
import "./studioThemes.css";
import "./roomExperience.css";
import App from "./App.tsx";
import { MotionConfig } from "framer-motion";

document.documentElement.classList.add("brand-experiment");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
