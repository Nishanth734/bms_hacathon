import React from 'react';

interface BadgeProps {
  typology: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ typology, className = '' }) => {
  const norm = typology.toLowerCase().replace('-', '_');

  let bg = 'var(--color-bg-sand)';
  let text = 'var(--color-ink)';
  let border = '1px solid var(--border-pill-dark)';

  if (norm.includes('cycle')) {
    bg = 'var(--color-teal-deep)';
    text = '#ffffff';
    border = 'none';
  } else if (norm.includes('fan_out') || norm.includes('fan_in') || norm.includes('fan')) {
    bg = 'var(--color-olive)';
    text = '#ffffff';
    border = 'none';
  } else if (norm.includes('pass_through') || norm.includes('chain')) {
    bg = 'var(--color-accent-sage)';
    text = 'var(--color-ink)';
    border = 'none';
  }

  const label = norm.replace('_', ' ').toUpperCase();

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
