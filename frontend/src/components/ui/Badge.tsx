import React from 'react';

interface BadgeProps {
  typology: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ typology, className = '' }) => {
  const norm = typology.toLowerCase().replace(/-/g, '_');

  let bg = 'var(--color-bg-sand)';
  let text = 'var(--color-ink)';
  let border = '1px solid var(--border-pill-dark)';
  let label = 'Suspicious';

  if (norm.includes('pass_through') || norm.includes('chain')) {
    bg = 'var(--color-accent-sage)';
    text = 'var(--color-ink)';
    border = 'none';
    label = 'Rapid Pass-Through';
  } else if (norm.includes('cycle')) {
    bg = 'var(--color-teal-deep)';
    text = '#ffffff';
    border = 'none';
    label = 'Circular Cycle';
  } else if (norm.includes('fan_out')) {
    bg = 'var(--color-olive)';
    text = '#ffffff';
    border = 'none';
    label = 'Fan-Out Dispersion';
  } else if (norm.includes('fan_in') || norm.includes('fan')) {
    bg = 'var(--color-olive)';
    text = '#ffffff';
    border = 'none';
    label = 'Fan-In Aggregation';
  } else if (norm.includes('wash')) {
    bg = '#fee2e2';
    text = '#991b1b';
    border = '1px solid #fca5a5';
    label = 'Wash Trading';
  } else {
    label = norm.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        backgroundColor: bg,
        color: text,
        border: border,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
};
