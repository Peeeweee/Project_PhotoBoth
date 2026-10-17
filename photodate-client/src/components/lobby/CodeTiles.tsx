interface CodeTilesProps {
  code: string;
}

export default function CodeTiles({ code }: CodeTilesProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-2)',
        justifyContent: 'center',
      }}
    >
      {code.split('').map((letter, i) => (
        <div
          key={i}
          style={{
            width: 56,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--c-surface-2)',
            border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--c-text-hi)',
            letterSpacing: 0,
            boxShadow: 'var(--shadow-sm)',
            userSelect: 'none',
            /* subtle top highlight */
            backgroundImage:
              'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 60%)',
          }}
        >
          {letter}
        </div>
      ))}
    </div>
  );
}
