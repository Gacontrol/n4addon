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

const R = 6;

function buildOrthogonalPath(x1: number, y1: number, x2: number, y2: number): { path: string; labelX: number; labelY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const isSelfLoop = Math.abs(dx) < 30 && Math.abs(dy) < 80;

  if (isSelfLoop) {
    const loopOut = 44;
    const mx = x1 + loopOut;
    const my = (y1 + y2) / 2;
    const r = Math.min(R, Math.abs(dy) / 4);
    const signY1 = dy >= 0 ? -1 : 1;
    const signY2 = dy >= 0 ? 1 : -1;
    const path = [
      `M ${x1} ${y1}`,
      `H ${mx - r}`,
      `Q ${mx} ${y1} ${mx} ${y1 + r * signY1 * -1}`,
      `V ${y2 + r * signY2 * -1}`,
      `Q ${mx} ${y2} ${mx - r} ${y2}`,
      `H ${x2}`
    ].join(' ');
    return { path, labelX: mx + 8, labelY: my };
  }

  const midX = x1 + dx / 2;

  if (Math.abs(dy) < 2) {
    return {
      path: `M ${x1} ${y1} H ${x2}`,
      labelX: midX,
      labelY: y1 - 10
    };
  }

  if (dx > R * 2) {
    const signY = dy > 0 ? 1 : -1;
    const path = [
      `M ${x1} ${y1}`,
      `H ${midX - R}`,
      `Q ${midX} ${y1} ${midX} ${y1 + R * signY}`,
      `V ${y2 - R * signY}`,
      `Q ${midX} ${y2} ${midX + R} ${y2}`,
      `H ${x2}`
    ].join(' ');
    return { path, labelX: midX, labelY: (y1 + y2) / 2 };
  }

  const backX = x1 + 24;
  const signY = dy > 0 ? 1 : -1;
  const path = [
    `M ${x1} ${y1}`,
    `H ${backX - R}`,
    `Q ${backX} ${y1} ${backX} ${y1 + R * signY}`,
    `V ${y2 - R * signY}`,
    `Q ${backX} ${y2} ${backX - R} ${y2}`,
    `H ${x2}`
  ].join(' ');
  return { path, labelX: backX + 8, labelY: (y1 + y2) / 2 };
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  x1, y1, x2, y2,
  color = '#10b981',
  isActive = false,
  isSelected = false,
  liveValue,
  onClick,
  onContextMenu
}) => {
  const { path, labelX, labelY } = buildOrthogonalPath(x1, y1, x2, y2);

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
      {isSelected && (
        <path
          d={path}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.25}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <path
        d={path}
        stroke={color}
        strokeWidth={isActive || isSelected ? 2.5 : 1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={isActive || isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
        style={{ transition: 'opacity 0.2s', pointerEvents: 'none' }}
      />
      {hasValue && truncated && !isActive && (
        <>
          <rect
            x={labelX - (truncated.length * 3.2)}
            y={labelY - 8}
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
            x={labelX}
            y={labelY + 4}
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
