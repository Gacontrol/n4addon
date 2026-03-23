import React from 'react';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  isActive?: boolean;
  isSelected?: boolean;
  liveValue?: unknown;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  color = '#10b981',
  isActive = false,
  isSelected = false,
  liveValue,
  onClick,
  onContextMenu
}) => {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const isSelfLoop = dx < 30 && dy < 80;

  let path: string;
  let midX: number;
  let midY: number;

  if (isSelfLoop) {
    const loopR = 40;
    const cx1 = x1 + loopR;
    const cy1 = y1 - loopR;
    const cx2 = x2 + loopR;
    const cy2 = y2 + loopR;
    midX = x1 + loopR * 1.4;
    midY = (y1 + y2) / 2;
    path = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  } else {
    midX = (x1 + x2) / 2;
    midY = (y1 + y2) / 2;
    path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }

  const hasValue = liveValue !== undefined && liveValue !== null;
  const displayVal = hasValue ? String(liveValue) : null;
  const truncated = displayVal && displayVal.length > 10 ? displayVal.slice(0, 10) + '...' : displayVal;

  return (
    <g style={{ cursor: onClick ? 'pointer' : 'default', pointerEvents: isActive ? 'none' : 'auto' }}>
      <path
        d={path}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{ pointerEvents: isActive ? 'none' : 'stroke' }}
      />
      <path
        d={path}
        stroke={color}
        strokeWidth={isActive || isSelected ? 3 : 2}
        fill="none"
        strokeLinecap="round"
        className={isActive || isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
        style={{ transition: 'opacity 0.2s', pointerEvents: 'none' }}
      />
      {isSelected && (
        <path
          d={path}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          opacity={0.3}
          style={{ pointerEvents: 'none' }}
        />
      )}
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
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={midX}
            y={midY + 4}
            textAnchor="middle"
            fill={color}
            fontSize="9"
            fontFamily="monospace"
            opacity="1"
            style={{ pointerEvents: 'none' }}
          >
            {truncated}
          </text>
        </>
      )}
    </g>
  );
};
