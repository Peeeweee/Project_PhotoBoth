import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { beginReelAutoplay } from "../../lib/reelAutoplay";
import { THEMES, type ThemeDefinition } from "../../data/themes";
import { getPhotoStyle } from "../../data/photoStyles";
import ThemeCard from "./ThemeCard";

export default function ThemePicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (theme: ThemeDefinition) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const chosen = getPhotoStyle(selectedId);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const resumeAfter = useRef(0);
  const lastPointerDown = useRef(-Infinity);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(media.matches);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const node = track.current;
    if (!node || focused || reduced || touching) return;
    return beginReelAutoplay(node, () => {
      const rect = node.getBoundingClientRect();
      return (
        document.hidden ||
        Date.now() < resumeAfter.current ||
        rect.bottom <= 0 ||
        rect.top >= window.innerHeight
      );
    });
  }, [focused, reduced, touching]);
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const measure = () => {
      const next = {
        start: node.scrollLeft <= 2,
        end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2,
      };
      setEdges((current) =>
        current.start === next.start && current.end === next.end
          ? current
          : next,
      );
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const visible =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                (entry.target as HTMLElement).dataset.inView = String(
                  entry.isIntersecting,
                );
              });
            },
            { root: node, threshold: 0.2 },
          );
    [...node.children].forEach((card) => {
      if (visible) visible.observe(card);
      else (card as HTMLElement).dataset.inView = "true";
    });
    const pause = () => {
      node.dataset.paused = String(document.hidden);
    };
    pause();
    document.addEventListener("visibilitychange", pause);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
      visible?.disconnect();
      document.removeEventListener("visibilitychange", pause);
    };
  }, []);
  useEffect(() => {
    const node = track.current;
    const card = node?.querySelector<HTMLElement>(`#theme-card-${chosen.id}`);
    if (node && card)
      node.scrollTo({
        left: Math.max(
          0,
          card.offsetLeft - (node.clientWidth - card.offsetWidth) / 2,
        ),
        behavior: "instant",
      });
  }, [chosen.id]);
  const browse = (direction: number) => {
    resumeAfter.current = Date.now() + 1200;
    const node = track.current;
    if (!node) return;
    node.scrollBy({
      left:
        direction *
        ((node.firstElementChild as HTMLElement)?.offsetWidth + 16 || 240),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <section
      className="photo-style-picker"
      aria-label="Choose your photostudio style and theme"
      aria-roledescription="carousel"
      onPointerDown={() => {
        lastPointerDown.current = Date.now();
        setFocused(false);
      }}
      onKeyDownCapture={(event) => {
        if (
          ["Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        )
          setFocused(true);
      }}
      onFocusCapture={(event) =>
        setFocused(
          Date.now() - lastPointerDown.current > 500 &&
            event.target.matches(":focus-visible"),
        )
      }
      onBlurCapture={(event) => {
        const next = event.relatedTarget as HTMLElement | null;
        setFocused(
          !!next &&
            event.currentTarget.contains(next) &&
            next.matches(":focus-visible"),
        );
      }}
      onTouchStart={() => {
        setTouching(true);
        resumeAfter.current = Date.now() + 1500;
      }}
      onTouchEnd={() => {
        setTouching(false);
        resumeAfter.current = Date.now() + 1500;
      }}
      onTouchCancel={() => {
        setTouching(false);
        resumeAfter.current = Date.now() + 1500;
      }}
    >
      <div className="style-picker-heading">
        <div>
          <span className="studio-eyebrow">THE PHOTOSTUDIO REEL</span>
          <h2>Photostudio style &amp; theme</h2>
        </div>
        <div className="style-reel-controls">
          <button
            type="button"
            aria-label="Previous photostudio themes"
            disabled={edges.start}
            onClick={() => browse(-1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            type="button"
            aria-label="Next photostudio themes"
            disabled={edges.end}
            onClick={() => browse(1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <p className="style-picker-hint">
        Eight studios, eight atmospheres. Choose one to change the app’s colors,
        mood, frame and filter. The reel flows automatically; click any studio
        to choose it.
      </p>
      <p className="reel-motion-status">
        {reduced
          ? "Auto-scroll off · reduced motion"
          : focused
            ? "Paused for keyboard navigation"
            : touching
              ? "Paused while swiping"
              : "Continuous automatic reel · browse and choose anytime"}
      </p>
      <div className="style-filmstrip">
        <div
          className="style-reel-track"
          data-auto-motion={!reduced}
          ref={track}
          onKeyDown={(event) => {
            const node = track.current;
            if (!node) return;
            const cards = [
              ...node.querySelectorAll<HTMLButtonElement>("button"),
            ];
            const index = cards.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "ArrowRight"
                ? Math.min(cards.length - 1, index + 1)
                : event.key === "ArrowLeft"
                  ? Math.max(0, index - 1)
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? cards.length - 1
                      : null;
            if (next !== null) {
              event.preventDefault();
              cards[next]?.focus({ preventScroll: true });
              node.scrollTo({
                left: Math.max(
                  0,
                  cards[next].offsetLeft -
                    (node.clientWidth - cards[next].offsetWidth) / 2,
                ),
                behavior: "instant",
              });
            }
          }}
        >
          {THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={chosen.id === theme.id}
              onSelect={(theme) => {
                resumeAfter.current = Date.now() + 1200;
                onSelect(theme);
              }}
            />
          ))}
        </div>
      </div>
      <div className="style-reel-selection" role="status" aria-live="polite">
        <span className="style-selection-number">
          {String(THEMES.findIndex((t) => t.id === chosen.id) + 1).padStart(
            2,
            "0",
          )}{" "}
          / {String(THEMES.length).padStart(2, "0")}
        </span>
        <div>
          <strong>{chosen.name} selected</strong>
          <p>{chosen.description}</p>
          <small>
            Your studio theme follows you across the app. Controls stay in the
            same places, and you can customize the frame and filter later.
          </small>
        </div>
      </div>
    </section>
  );
}
