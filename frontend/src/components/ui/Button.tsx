import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  style = {},
  ...props
}) => {
  let bg = 'var(--color-ink)';
  let color = 'var(--color-bg-cream)';
  let border = 'none';

  if (variant === 'secondary') {
    bg = 'var(--color-bg-sand)';
    color = 'var(--color-ink)';
    border = '1px solid var(--color-linen)';
  } else if (variant === 'outline') {
    bg = 'transparent';
    color = 'var(--color-ink)';
    border = 'var(--border-btn-light)';
  } else if (variant === 'ghost') {
    bg = 'transparent';
    color = 'var(--color-ink)';
    border = 'none';
  }

  const padding = size === 'sm' ? '6px 14px' : size === 'lg' ? '12px 24px' : '8px 18px';
  const fontSize = size === 'sm' ? '12px' : size === 'lg' ? '15px' : '13px';

  return (
    <button
      {...props}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding,
        fontSize,
        fontWeight: 500,
        borderRadius: 'var(--radius-pill)',
        backgroundColor: bg,
        color,
        border,
        transition: 'all 0.15s ease',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!props.disabled) {
          if (variant === 'primary') {
            e.currentTarget.style.backgroundColor = 'var(--color-ink-secondary)';
          } else if (variant === 'outline' || variant === 'secondary') {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-mint-soft)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.backgroundColor = bg;
        }
      }}
    >
      {children}
    </button>
  );
};
