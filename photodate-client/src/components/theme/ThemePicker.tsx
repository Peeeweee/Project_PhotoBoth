import { motion } from 'framer-motion';
import { THEMES, type ThemeDefinition } from '../../data/themes';
import ThemeCard from './ThemeCard';

interface ThemePickerProps {
  selectedId: string | null;
  onSelect: (theme: ThemeDefinition) => void;
}

export default function ThemePicker({ selectedId, onSelect }: ThemePickerProps) {
  return (
    <div>
      {/* Section label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        marginBottom: 'var(--sp-4)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--c-text-lo)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          Choose your vibe
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--c-border-soft)' }} />
      </div>

      {/* Cards row */}
      <motion.div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
        }}
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        initial="hidden"
        animate="show"
      >
        {THEMES.map((theme) => (
          <motion.div
            key={theme.id}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
            }}
            style={{ flex: 1, minWidth: 0, display: 'flex' }}
          >
            <ThemeCard
              theme={theme}
              selected={selectedId === theme.id}
              onSelect={onSelect}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
