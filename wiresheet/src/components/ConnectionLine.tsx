import React from 'react';
import { FlowNode } from '../types/flow';
import { buildRoutedPath, buildSelfLoopPath } from '../utils/connectionRouting';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  isActive?: boolean;
  isSelected?: boolean;
  liveValue?: unknown;
  isSelfLoop?: boolean;
  sourceNode?: FlowNode;
  nodes?: FlowNode[];
  sourceId?: string;
  targetId?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  hitOnly?: boolean;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  x1, y1, x2, y2,
  color = '#10b981',
  isActive = false,
  isSelected = false,
  liveValue,
  isSelfLoop,
  sourceNode,
  nodes = [],
  sourceId = '',
  targetId = '',
  onClick,
  onContextMenu,
  hitOnly = false,
}) => {
  const { path, labelX, labelY } = isSelfLoop
    ? buildSelfLoopPath(x1, y1, x2, y2, sourceNode)
    : buildRoutedPath(x1, y1, x2, y2, nodes, sourceId, targetId);

  const hasValue = liveValue !== undefined && liveValue !== null;
  const displayVal = hasValue ? String(liveValue) : null;
  const truncated = displayVal && displayVal.length > 10 ? displayVal.slice(0, 10) + '...' : displayVal;

  if (hitOnly) {
    return (
      <path
        d={path}
        stroke="transparent"
        strokeWidth={14}
        fill="none"
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
      />
    );
  }

  return (
    <g style={{ pointerEvents: 'none' }}>
      {isSelected && (
        <path
          d={path}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.25}
        />
      )}
      <path
        d={path}
        stroke={color}
        strokeWidth={isActive || isSelected ? 2.5 : 1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={isActive || isSelected ? 'opacity-100' : 'opacity-60'}
        style={{ transition: 'opacity 0.2s' }}
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
          />
          <text
            x={labelX}
            y={labelY + 4}
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
