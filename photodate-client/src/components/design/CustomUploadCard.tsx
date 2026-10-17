import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Upload, Check } from 'lucide-react';
import { useSessionStore, type DesignPreset } from '../../state/useSessionStore';

interface CustomUploadCardProps {
  isExpanded: boolean;
  selectedDesignId: string | null;
  onToggleExpand: () => void;
  onSelectDesign: (design: DesignPreset) => void;
}

export default function CustomUploadCard({
  isExpanded,
  selectedDesignId,
  onToggleExpand,
  onSelectDesign,
}: CustomUploadCardProps) {
  const { customDesigns, addCustomDesign } = useSessionStore();
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (customDesigns.length >= 8) { setError('You can upload up to eight custom designs per session.'); return; }
    if (file.type !== 'image/png' || file.size > 1024 * 1024) { setError('Choose a PNG image smaller than 1 MB.'); return; }
    try {
      const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)) throw new Error('This file is not a valid PNG image.');
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const image = new Image(); image.src = url; await image.decode();
      if (image.width > 4096 || image.height > 4096 || image.width < 32 || image.height < 32) throw new Error('Image dimensions must be between 32 and 4096 pixels.');
      const newDesign: DesignPreset = { id: `custom-${crypto.randomUUID()}`, name: file.name.replace(/\.[^/.]+$/, '').slice(0, 80), background: `url("${url}") center / cover no-repeat, #fff` };
      addCustomDesign(newDesign); onSelectDesign(newDesign);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This PNG could not be read. Please choose another image.'); }
  };

  const hasSelectedDesign = customDesigns.some((d) => d.id === selectedDesignId);
  const previewSwatches = customDesigns.slice(0, 4);
  const remainingCount = Math.max(0, customDesigns.length - 4);

  return (
    <motion.div
      style={{
        background: 'var(--c-surface-1)',
        border: `1px dashed ${hasSelectedDesign && !isExpanded ? 'var(--c-accent)' : 'var(--c-border-soft)'}`,
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        boxShadow: hasSelectedDesign && !isExpanded ? 'var(--shadow-accent)' : 'var(--shadow-sm)',
        transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
      }}
    >
      {error && <p role="alert" style={{ padding: 16, color: "var(--c-error)" }}>{error}</p>}
      <input
        type="file"
        accept="image/png"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* ── Header / Collapsed Preview ───────────────────────────────── */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sp-4)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', flex: 1 }}>
          <div style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 700,
            color: 'var(--c-text-hi)',
          }}>
            Upload your own
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--c-text-md)' }}>
            Use a transparent PNG as your frame overlay
          </div>

          <AnimatePresence>
            {!isExpanded && customDesigns.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 'var(--sp-3)',
                  overflow: 'hidden',
                }}
              >
                {previewSwatches.map((d) => {
                  const isSelected = d.id === selectedDesignId;
                  return (
                    <div
                      key={d.id}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--r-sm)',
                        background: d.background,
                        border: isSelected ? '2px solid var(--c-accent)' : '1px solid var(--c-border-soft)',
                        boxShadow: isSelected ? '0 0 0 2px var(--c-bg) inset' : 'none',
                      }}
                    />
                  );
                })}
                {remainingCount > 0 && (
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--c-text-lo)',
                  }}>
                    +{remainingCount}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {/* Main upload trigger button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--c-surface-2)',
              border: '1px solid var(--c-border)',
              padding: '6px 12px',
              borderRadius: 'var(--r-full)',
              color: 'var(--c-text-hi)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background var(--dur-fast)',
            }}
          >
            <Upload size={14} /> Upload
          </button>

          {customDesigns.length > 0 && (
            <button
              aria-label="Show uploaded designs"
              aria-expanded={isExpanded}
              onClick={onToggleExpand}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--c-text-lo)',
                padding: 'var(--sp-2)',
                cursor: 'pointer',
              }}
            >
              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                <ChevronDown size={20} />
              </motion.div>
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded Grid ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isExpanded && customDesigns.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: 'var(--sp-3)',
              padding: '0 var(--sp-4) var(--sp-4)',
            }}>
              {customDesigns.map((design) => {
                const isSelected = design.id === selectedDesignId;
                return (
                  <button
                    key={design.id}
                    aria-pressed={isSelected}
                    onClick={() => onSelectDesign(design)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,

                    }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: 'var(--r-md)',
                        background: design.background,
                        border: isSelected ? '2px solid var(--c-accent)' : '1px solid var(--c-border)',
                        boxShadow: isSelected ? '0 0 0 3px var(--c-bg) inset, var(--shadow-sm)' : 'var(--shadow-sm)',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'var(--c-accent)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </motion.div>
                    <div style={{
                      fontSize: '11px',
                      color: isSelected ? 'var(--c-text-hi)' : 'var(--c-text-md)',
                      fontWeight: isSelected ? 600 : 400,
                      textAlign: 'center',
                      lineHeight: 1.2,
                      width: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {design.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
