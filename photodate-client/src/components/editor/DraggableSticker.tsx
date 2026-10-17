import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Maximize2, RotateCw } from 'lucide-react';
import type { PlacedSticker } from '../../state/useSessionStore';

interface DraggableStickerProps {
  sticker: PlacedSticker;
  url: string;
  isSelected: boolean;
  readOnly?: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<PlacedSticker>) => void;
  onRemove: (id: string) => void;
}

export default function DraggableSticker({
  sticker,
  url,
  isSelected,
  readOnly = false,
  onSelect,
  onUpdate,
  onRemove,
}: DraggableStickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupGesture = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupGesture.current?.(), []);
  useEffect(() => { if (readOnly) cleanupGesture.current?.(); }, [readOnly]);
  
  // Basic gesture state for custom resize/rotate
  const [isGesturing, setIsGesturing] = useState(false);

  // We rely on Framer Motion's built-in `drag` for translation.
  // For scale and rotation, we'll use simple click-to-increment or drag handlers.
  // To keep it simple without heavy gesture libs, we'll implement simple pointer drag for scale/rotate.

  const handlePointerDownScale = (e: React.PointerEvent) => {
    e.stopPropagation();
    cleanupGesture.current?.();
    setIsGesturing(true);
    const startY = e.clientY;
    const startScale = sticker.scale;

    const handlePointerMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      // Moving down increases scale, moving up decreases it
      const newScale = Math.min(4, Math.max(0.2, startScale + dy * 0.01));
      onUpdate(sticker.id, { scale: newScale });
    };

    const handlePointerUp = () => {
      setIsGesturing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      cleanupGesture.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    cleanupGesture.current = handlePointerUp;
  };

  const handlePointerDownRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    cleanupGesture.current?.();
    setIsGesturing(true);
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const handlePointerMove = (ev: PointerEvent) => {
      const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
      let degrees = angle * (180 / Math.PI) + 90; // offset so top is 0
      onUpdate(sticker.id, { rotation: degrees });
    };

    const handlePointerUp = () => {
      setIsGesturing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      cleanupGesture.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    cleanupGesture.current = handlePointerUp;
  };

  return (
    <motion.div
      ref={containerRef}
      drag={!readOnly && !isGesturing}
      dragMomentum={false}
      onDragEnd={(_event, info) => {
        if (readOnly) return;
        // Update the final position in store to persist layout
        onUpdate(sticker.id, { 
          x: sticker.x + info.offset.x / ((containerRef.current?.parentElement?.getBoundingClientRect().width || 1000) / 1000),
          y: sticker.y + info.offset.y / ((containerRef.current?.parentElement?.getBoundingClientRect().width || 1000) / 1000) 
        });
      }}
      initial={false}
      animate={{ 
        x: sticker.x, 
        y: sticker.y, 
        scale: sticker.scale, 
        rotate: sticker.rotation 
      }}
      tabIndex={readOnly ? -1 : 0}
      role="group"
      aria-label="Sticker. Arrow keys move; plus and minus resize; R rotates; Delete removes."
      onFocus={() => { if (!readOnly) onSelect(); }}
      onKeyDown={event => {
        if (readOnly || event.target !== event.currentTarget) return;
        const step = event.shiftKey ? 20 : 5;
        const updates: Partial<PlacedSticker> = {};
        if (event.key === 'ArrowLeft') updates.x = sticker.x - step;
        else if (event.key === 'ArrowRight') updates.x = sticker.x + step;
        else if (event.key === 'ArrowUp') updates.y = sticker.y - step;
        else if (event.key === 'ArrowDown') updates.y = sticker.y + step;
        else if (event.key === '+' || event.key === '=') updates.scale = Math.min(4, sticker.scale + 0.1);
        else if (event.key === '-') updates.scale = Math.max(0.2, sticker.scale - 0.1);
        else if (event.key.toLowerCase() === 'r') updates.rotation = sticker.rotation + 15;
        else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onRemove(sticker.id); return; }
        else return;
        event.preventDefault(); onUpdate(sticker.id, updates);
      }}
      onPointerDown={event => { if (!readOnly) { event.stopPropagation(); onSelect(); } }}
      style={{
        position: 'absolute',
        pointerEvents: readOnly ? 'none' : 'auto',
        top: 0,
        left: 0,
        width: 250,
        height: 250,
        originX: 0.5,
        originY: 0.5,
        // center it based on origin
        marginLeft: -125,
        marginTop: -125,
        touchAction: 'none',
        zIndex: isSelected ? 100 : 10,
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        border: isSelected ? '2px dashed rgba(255, 255, 255, 0.8)' : '2px solid transparent',
        boxShadow: isSelected ? '0 0 10px rgba(0,0,0,0.2)' : 'none',
        cursor: readOnly ? 'default' : isGesturing ? 'grabbing' : 'grab',
      }}>
        <img 
          src={url} 
          alt="sticker" 
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }} 
        />
        
        {/* Controls Overlay */}
        {isSelected && !readOnly && (
          <>
            {/* Delete (Top Left) */}
            <button
              aria-label="Remove sticker"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onRemove(sticker.id)}
              style={{
                position: 'absolute', top: -15, left: -15, width: 30, height: 30,
                background: '#ff4b4b', color: '#fff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', zIndex: 2
              }}
            >
              <X size={16} />
            </button>

            {/* Rotate (Top Right) */}
            <button
              aria-label="Rotate sticker"
              onClick={event => { if (event.detail === 0) onUpdate(sticker.id, { rotation: sticker.rotation + 15 }); }}
              onPointerDown={handlePointerDownRotate}
              style={{
                position: 'absolute', top: -15, right: -15, width: 30, height: 30,
                background: '#4b9fff', color: '#fff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'ew-resize', zIndex: 2, touchAction: 'none'
              }}
            >
              <RotateCw size={16} />
            </button>

            {/* Scale (Bottom Right) */}
            <button
              aria-label="Enlarge sticker"
              onClick={event => { if (event.detail === 0) onUpdate(sticker.id, { scale: Math.min(4, sticker.scale + 0.1) }); }}
              onPointerDown={handlePointerDownScale}
              style={{
                position: 'absolute', bottom: -15, right: -15, width: 30, height: 30,
                background: '#4b9fff', color: '#fff', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'ns-resize', zIndex: 2, touchAction: 'none'
              }}
            >
              <Maximize2 size={16} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
