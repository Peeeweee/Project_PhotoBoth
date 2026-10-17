import { motion } from 'framer-motion';
import { AVAILABLE_LAYOUTS, type StripLayout } from '../../data/stripLayouts';
import LayoutCard from './LayoutCard';

interface LayoutPickerProps {
  selectedId: string | null;
  onSelect: (layout: StripLayout) => void;
}

export default function LayoutPicker({ selectedId, onSelect }: LayoutPickerProps) {
  return (
    <motion.div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'var(--sp-4)',
      }}
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      initial="hidden"
      animate="show"
    >
      {AVAILABLE_LAYOUTS.map((layout) => (
        <motion.div
          key={layout.id}
          variants={{
            hidden: { opacity: 0, y: 12 },
            show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
          }}
          style={{ display: 'flex' }}
        >
          <LayoutCard
            layout={layout}
            selected={selectedId === layout.id}
            onSelect={onSelect}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
