import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { motionScene } from "../lib/brandMotion";
import MotionScene from "./MotionScene";

/** Local branding study: CSS 3D, with no render loop, assets, or WebGL dependency. */
export default function BrandAtmosphere() {
  const { pathname } = useLocation();
  const scene = useRef<HTMLDivElement>(null);
  const lobby = pathname === "/lobby";
  const hero = pathname === "/" || lobby;
  const clock = useRef(Date.now());
  const name = motionScene(pathname);
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce), (pointer: coarse)",
    );
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (!hero || reduced.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.current?.style.setProperty(
          "--orbit-x",
          `${(event.clientX / window.innerWidth - 0.5) * 12}deg`,
        );
        scene.current?.style.setProperty(
          "--orbit-y",
          `${(event.clientY / window.innerHeight - 0.5) * -8}deg`,
        );
      });
    };
    const visibility = () => {
      if (scene.current) scene.current.dataset.paused = String(document.hidden);
    };
    visibility();
    if (hero) window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [hero]);
  return (
    <div
      ref={scene}
      className={`brand-atmosphere has-page-motion scene-${name} ${hero ? "is-hero" : "is-quiet"}${lobby ? " is-lobby" : ""}`}
      aria-hidden="true"
    >
      <div className="brand-halo" />
      <div className="brand-orbit">
        <div className="brand-ribbon">
          <i />
          <i />
          <i />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div className={`brand-photo brand-photo-${i}`} key={i}>
            <span />
          </div>
        ))}
      </div>
      <div className="brand-grain" />
      <AnimatePresence initial={false}>
        <MotionScene key={name} name={name} start={clock.current} />
      </AnimatePresence>
    </div>
  );
}
