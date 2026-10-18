export type EdgeStyle = "square" | "rounded" | "arch" | "ticket" | "postage";
export const EDGE_STYLES: {
  id: EdgeStyle;
  name: string;
  description: string;
}[] = [
  { id: "square", name: "Classic", description: "Crisp, clean corners" },
  { id: "rounded", name: "Soft", description: "Cute rounded corners" },
  { id: "arch", name: "Arch", description: "A dreamy curved top" },
  { id: "ticket", name: "Ticket", description: "A little event keepsake" },
  { id: "postage", name: "Postage", description: "A playful stamp edge" },
];
export function stripEdgeStyle(
  edge: EdgeStyle = "square",
  aspectRatio = 1,
  width = 1000,
): { borderRadius?: string; clipPath?: string } {
  if (edge === "rounded") return { borderRadius: `${width * 0.048}px` };
  if (edge === "arch")
    return {
      borderRadius: `${width * 0.18}px ${width * 0.18}px ${width * 0.032}px ${width * 0.032}px`,
    };
  if (edge === "ticket")
    return {
      clipPath:
        "polygon(3% 0,97% 0,100% 3%,100% 42%,97% 45%,97% 55%,100% 58%,100% 97%,97% 100%,3% 100%,0 97%,0 58%,3% 55%,3% 45%,0 42%,0 3%)",
    };
  if (edge === "postage") {
    const points: string[] = [],
      h = 1000 / aspectRatio;
    const horizontal = 40,
      vertical = Math.max(4, Math.ceil(h / 25 / 2) * 2);
    const depthY = 1400 / h;
    for (let i = 0; i <= horizontal; i++)
      points.push(`${(i * 100) / horizontal}% ${i % 2 ? depthY : 0}%`);
    for (let i = 1; i <= vertical; i++)
      points.push(`${i % 2 ? 98.6 : 100}% ${(i * 100) / vertical}%`);
    for (let i = 1; i <= horizontal; i++)
      points.push(
        `${100 - (i * 100) / horizontal}% ${i % 2 ? 100 - depthY : 100}%`,
      );
    for (let i = 1; i < vertical; i++)
      points.push(`${i % 2 ? 1.4 : 0}% ${100 - (i * 100) / vertical}%`);
    return { clipPath: `polygon(${points.join(",")})` };
  }
  return {};
}
