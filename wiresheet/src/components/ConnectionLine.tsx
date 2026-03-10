import React from 'react';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  isActive?: boolean;
  liveValue?: unknown;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  color = '#10b981',
  isActive = false,
  liveValue
}) => {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

  const hasValue = liveValue !== undefined && liveValue !== null;
  const displayVal = hasValue ? String(liveValue) : null;
  const truncated = displayVal && displayVal.length > 10 ? displayVal.slice(0, 10) + '…' : displayVal;

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
      {hasValue && truncated && !isActive && (
        <>
          <rect
            x={midX - (truncated.length * 3.2)}
            y={midY - 8}
            width={truncated.length * 6.4 + 4}
            height={16}
            rx={4}
            fill="#0f172a"
            stroke={color}
            strokeWidth="1"
            opacity="0.9"
          />
          <text
            x={midX}
            y={midY + 4}
            textAnchor="middle"
            fill={color}
            fontSize="9"
            fontFamily="monospace"
            opacity="1"
          >
            {truncated}
          </text>
        </>
      )}
    </g>
  );
};
