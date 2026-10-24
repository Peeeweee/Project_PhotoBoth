/** Pick a full-bleed arrangement that crops the least source area. */
export function participantTiles(
  count: number,
  aspect: number,
  sourceRatios: number[] = [],
) {
  if (count < 1) return [];
  let best: { x: number; y: number; width: number; height: number }[] = [];
  let bestScore = -Infinity;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const cells = Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / columns);
      const rowCount = Math.min(columns, count - row * columns);
      return {
        x: (i % columns) / rowCount,
        y: row / rows,
        width: 1 / rowCount,
        height: 1 / rows,
      };
    });
    const score = cells.reduce((sum, cell, i) => {
      const target = (aspect * cell.width) / cell.height;
      const source = sourceRatios[i] || 4 / 3;
      return sum + Math.min(target / source, source / target);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = cells;
    }
  }
  return best;
}

export function coverCrop(width: number, height: number, aspect: number) {
  const cropWidth = Math.min(width, height * aspect);
  const cropHeight = cropWidth / aspect;
  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}
