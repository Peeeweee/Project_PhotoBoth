import { useState } from 'react';
import { motion } from 'framer-motion';
import { DESIGN_PACKS } from '../../data/themePacks';
import { useSessionStore, type DesignPreset } from '../../state/useSessionStore';
import DesignPackCard from './DesignPackCard';
import CustomUploadCard from './CustomUploadCard';

interface DesignPickerProps {
  selectedId: string | null;
  onSelect: (design: DesignPreset) => void;
}

export default function DesignPicker({ selectedId, onSelect }: DesignPickerProps) {
  const { customDesigns } = useSessionStore();
  
  // Determine if a pack should be expanded by default because it contains the selected design
  const initialExpandedPack = DESIGN_PACKS.find(p => p.designs.some(d => d.id === selectedId))?.id;
  const initialExpandedCustom = customDesigns.some(d => d.id === selectedId) ? 'custom' : null;
  const [expandedPackId, setExpandedPackId] = useState<string | null>(initialExpandedPack ?? initialExpandedCustom);

  const handleToggle = (packId: string) => {
    setExpandedPackId(prev => prev === packId ? null : packId);
  };

  return (
    <motion.div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4)',
      }}
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      initial="hidden"
      animate="show"
    >
      {DESIGN_PACKS.map((pack) => (
        <motion.div
          key={pack.id}
          variants={{
            hidden: { opacity: 0, y: 12 },
            show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
          }}
        >
          <DesignPackCard
            pack={pack}
            isExpanded={expandedPackId === pack.id}
            selectedDesignId={selectedId}
            onToggleExpand={() => handleToggle(pack.id)}
            onSelectDesign={onSelect}
          />
        </motion.div>
      ))}

      {/* ── Custom Upload ── */}
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 12 },
          show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
        }}
      >
        <CustomUploadCard
          isExpanded={expandedPackId === 'custom'}
          selectedDesignId={selectedId}
          onToggleExpand={() => handleToggle('custom')}
          onSelectDesign={onSelect}
        />
      </motion.div>
    </motion.div>
  );
}
