import { useRef, useState, useEffect } from 'react';
import type { PointerEvent } from 'react';
import { useSessionStore } from '../../state/useSessionStore';
import { getLayout } from '../../data/stripLayouts';
interface DrawOverlayProps { isActive: boolean; currentColor: string; currentThickness: number; }
export default function DrawOverlay({ isActive, currentColor, currentThickness }: DrawOverlayProps) {
  const { drawStrokes, addDrawStroke, updateCurrentStroke, layoutId } = useSessionStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  useEffect(() => { if (!isActive) { pointer.current = null; setDrawing(false); } }, [isActive]);
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? p.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  };
  const end = (event: PointerEvent<SVGSVGElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null; setDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const height = 1000 / getLayout(layoutId || '4x1').stripAspectRatio;
  return <svg ref={svgRef} viewBox={`0 0 1000 ${height}`} aria-label="Freehand drawing layer" onPointerDown={event => {
    if (!isActive || pointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); pointer.current = event.pointerId; setDrawing(true);
    const p = point(event); addDrawStroke({ id: crypto.randomUUID(), color: currentColor, thickness: currentThickness, points: [{ x: p.x, y: p.y }] });
  }} onPointerMove={event => { if (!isActive || !drawing || pointer.current !== event.pointerId) return; const p = point(event); updateCurrentStroke({ x: p.x, y: p.y }); }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { pointer.current = null; setDrawing(false); }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: isActive ? 'auto' : 'none', touchAction: 'none', zIndex: 50 }}>
    {drawStrokes.map(stroke => <path key={stroke.id} d={stroke.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + (stroke.points.length === 1 ? ' l 0.01 0' : '')} fill="none" stroke={stroke.color} strokeWidth={stroke.thickness} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}
