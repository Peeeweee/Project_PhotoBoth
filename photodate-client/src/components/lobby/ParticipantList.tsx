import { motion, AnimatePresence } from 'framer-motion';
import type { SocketParticipant } from '../../lib/socket';
import { SLOT_COLORS } from './CopyLinkButton';

interface ParticipantListProps {
  participants: SocketParticipant[];
  selfId: string | null;
  maxSlots?: number;
}

export default function ParticipantList({
  participants,
  selfId,
  maxSlots = 4,
}: ParticipantListProps) {
  // Build a fixed-size slot array so empty slots render as placeholders
  const slots = Array.from({ length: maxSlots }, (_, i) => ({
    slot: i,
    participant: participants.find((p) => p.slot_index === i) ?? null,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', width: '100%' }}>
      <AnimatePresence>
        {slots.map(({ slot, participant }) =>
          participant ? (
            <motion.div
              key={participant.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'var(--c-surface-1)',
                border: `1px solid ${selfId === participant.id ? 'var(--c-accent)' : 'var(--c-border)'}`,
                borderRadius: 'var(--r-md)',
                boxShadow: selfId === participant.id ? 'var(--shadow-accent)' : 'none',
                transition: 'border-color var(--dur-base)',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--r-full)',
                  background: SLOT_COLORS[slot % SLOT_COLORS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}
              >
                {participant.display_name.charAt(0)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--c-text-hi)',
                      fontWeight: 600,
                      fontSize: 'var(--text-base)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {participant.display_name}
                  </span>
                  {selfId === participant.id && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--c-accent)',
                        fontWeight: 500,
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                      }}
                    >
                      YOU
                    </span>
                  )}
                  {slot === 0 && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--c-text-lo)',
                        fontWeight: 400,
                        flexShrink: 0,
                      }}
                    >
                      HOST
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--c-text-lo)',
                    marginTop: 2,
                  }}
                >
                  Slot {slot + 1} · Joined {new Date(participant.joined_at).toLocaleTimeString()}
                </div>
              </div>

              {/* Online pulse indicator */}
              <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--c-success)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: -3,
                    borderRadius: '50%',
                    background: 'var(--c-success)',
                    opacity: 0.3,
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                />
              </div>
            </motion.div>
          ) : (
            /* Empty slot placeholder */
            <motion.div
              key={`empty-${slot}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'transparent',
                border: '1px dashed var(--c-border-soft)',
                borderRadius: 'var(--r-md)',
              }}
            >
              {/* Ghost avatar */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--r-full)',
                  background: 'var(--c-surface-2)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: 'var(--c-text-lo)',
                  fontSize: 'var(--text-sm)',
                  fontStyle: 'italic',
                }}
              >
                Waiting for partner…
              </span>
            </motion.div>
          ),
        )}
      </AnimatePresence>
    </div>
  );
}
