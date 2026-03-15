import React, { useMemo } from 'react';
import { TankConfig, WidgetStyle } from '../../types/visualization';

interface VisuTankProps {
  value: number;
  config: TankConfig;
  style: WidgetStyle;
  label: string;
  size: { width: number; height: number };
}

export const VisuTank: React.FC<VisuTankProps> = ({
  value,
  config,
  style,
  label,
  size
}) => {
  const percent = useMemo(() => {
    const clampedValue = Math.max(config.min, Math.min(config.max, value || 0));
    return ((clampedValue - config.min) / (config.max - config.min)) * 100;
  }, [value, config.min, config.max]);

  const fillColor = useMemo(() => {
    if (!config.levels || config.levels.length === 0) {
      return config.fillColor || '#3b82f6';
    }
    const sortedLevels = [...config.levels].sort((a, b) => a.value - b.value);
    for (const level of sortedLevels) {
      if (percent <= (level.value / config.max) * 100) {
        return level.color;
      }
    }
    return sortedLevels[sortedLevels.length - 1].color;
  }, [percent, config.levels, config.fillColor, config.max]);

  const displayValue = typeof value === 'number'
    ? value.toFixed(0)
    : '0';

  const tankWidth = Math.min(size.width - 20, 60);
  const tankHeight = size.height - 40;
  const fontSize = (config as { fontSize?: number }).fontSize ?? 14;

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="truncate max-w-full" style={{ color: style.textColor || '#94a3b8', fontSize }}>{label}</span>
      )}
      <div className="relative" style={{ width: tankWidth, height: tankHeight }}>
        <svg width={tankWidth} height={tankHeight} viewBox={`0 0 ${tankWidth} ${tankHeight}`}>
          <defs>
            <clipPath id={`tank-clip-${label}`}>
              <rect x="2" y="2" width={tankWidth - 4} height={tankHeight - 4} rx="4" />
            </clipPath>
          </defs>
          <rect
            x="2"
            y="2"
            width={tankWidth - 4}
            height={tankHeight - 4}
            rx="4"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="2"
          />
          <rect
            x="2"
            y={tankHeight - 2 - (percent / 100) * (tankHeight - 4)}
            width={tankWidth - 4}
            height={(percent / 100) * (tankHeight - 4)}
            fill={fillColor}
            clipPath={`url(#tank-clip-${label})`}
            style={{ transition: 'y 0.3s ease, height 0.3s ease, fill 0.3s ease' }}
          />
          {[0.25, 0.5, 0.75].map((tick) => (
            <line
              key={tick}
              x1={tankWidth - 8}
              y1={tankHeight - 2 - tick * (tankHeight - 4)}
              x2={tankWidth - 2}
              y2={tankHeight - 2 - tick * (tankHeight - 4)}
              stroke="#64748b"
              strokeWidth="1"
            />
          ))}
        </svg>
        {config.showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-white drop-shadow-lg" style={{ fontSize: style.fontSize || '0.875rem' }}>
              {displayValue}{config.unit}
            </span>
          </div>
        )}
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="truncate max-w-full" style={{ color: style.textColor || '#94a3b8', fontSize }}>{label}</span>
      )}
    </div>
  );
};
