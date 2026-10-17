import { motion } from 'framer-motion';
import type { ThemeDefinition } from '../../data/themes';

interface ThemeCardProps {
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: (theme: ThemeDefinition) => void;
}

export default function ThemeCard({ theme, selected, onSelect }: ThemeCardProps) {
  return (
    <motion.button
      id={`theme-card-${theme.id}`}
      aria-pressed={selected}
      onClick={() => onSelect(theme)}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        background: 'var(--c-surface-1)',
        border: `1.5px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: selected ? 'var(--shadow-accent)' : 'var(--shadow-sm)',
        transition: 'border-color var(--dur-base), box-shadow var(--dur-base)',
        textAlign: 'left',

      }}
    >
      {/* ── Preview swatch ─────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          background: theme.previewBg,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Mini photo-strip preview */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: 8,
          background: 'rgba(0,0,0,0.18)',
          borderRadius: 6,
          backdropFilter: 'blur(2px)',
        }}>
          {[1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 44,
                height: 32,
                borderRadius: 3,
                background: `rgba(255,255,255,${i === 1 ? 0.22 : 0.12})`,
                border: `1px solid rgba(255,255,255,0.15)`,
              }}
            />
          ))}
        </div>

        {/* Large icon overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 10,
            fontSize: 22,
            color: theme.previewFg,
            opacity: 0.55,
            fontWeight: 900,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {theme.icon}
        </div>

        {/* Selected check */}
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--c-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            ✓
          </motion.div>
        )}
      </div>

      {/* ── Text area ──────────────────────────────────────── */}
      <div style={{ padding: 'var(--sp-3) var(--sp-4) var(--sp-4)' }}>
        <div style={{
          fontWeight: 700,
          fontSize: 'var(--text-base)',
          color: selected ? 'var(--c-text-hi)' : 'var(--c-text-md)',
          marginBottom: 2,
          transition: 'color var(--dur-fast)',
        }}>
          {theme.name}
        </div>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--c-text-lo)',
          lineHeight: 1.4,
        }}>
          {theme.subtitle}
        </div>
      </div>
    </motion.button>
  );
}
