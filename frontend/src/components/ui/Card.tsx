import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  style = {},
  onClick,
  elevated = false,
}) => {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: elevated ? 'var(--color-bg-white)' : 'var(--color-bg-cream)',
        border: 'var(--border-card)',
        borderRadius: 'var(--radius-card)',
        boxShadow: elevated
          ? '0 4px 12px rgba(43, 43, 41, 0.06)'
          : '0 1px 3px rgba(43, 43, 41, 0.04)',
        padding: '16px',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
