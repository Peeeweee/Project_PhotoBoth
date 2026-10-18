/** Continuous native scrolling; selection and manual controls are independent. */
export function beginReelAutoplay(node: HTMLElement, paused: () => boolean) {
  let frame = 0,
    last = -1,
    position = node.scrollLeft,
    direction = 1;
  const tick = (time: number) => {
    const delta = last < 0 ? 0 : Math.min(64, Math.max(0, time - last));
    last = time;
    const max = Math.max(0, node.scrollWidth - node.clientWidth);
    if (paused() || max === 0) position = node.scrollLeft;
    else {
      // Adopt user scrolling without losing fractional progress on rounded scrollLeft implementations.
      if (Math.abs(node.scrollLeft - position) > 3) position = node.scrollLeft;
      if (position >= max - 0.1) direction = -1;
      if (position <= 0.1) direction = 1;
      position = Math.max(
        0,
        Math.min(max, position + direction * delta * 0.038),
      );
      node.scrollLeft = position;
    }
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);
  return () => window.cancelAnimationFrame(frame);
}
