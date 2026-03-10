import React from 'react';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  isActive?: boolean;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  color = '#10b981',
  isActive = false
}) => {
  const midX = (x1 + x2) / 2;

  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

  return (
    <g>
      <path
        d={path}
        stroke={color}
        strokeWidth={isActive ? 3 : 2}
        fill="none"
        strokeLinecap="round"
        className={isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
        style={{ transition: 'opacity 0.2s' }}
      />
    </g>
  );
};
