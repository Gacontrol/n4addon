import React, { useMemo } from 'react';
import { ThermometerConfig, WidgetStyle } from '../../types/visualization';

interface VisuThermometerProps {
  value: number;
  config: ThermometerConfig;
  style: WidgetStyle;
  label: string;
  size: { width: number; height: number };
}

export const VisuThermometer: React.FC<VisuThermometerProps> = ({
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
    const coldColor = config.coldColor || '#3b82f6';
    const hotColor = config.hotColor || '#ef4444';
    const ratio = percent / 100;
    const cold = parseInt(coldColor.slice(1), 16);
    const hot = parseInt(hotColor.slice(1), 16);
    const r = Math.round(((cold >> 16) & 0xff) + ratio * (((hot >> 16) & 0xff) - ((cold >> 16) & 0xff)));
    const g = Math.round(((cold >> 8) & 0xff) + ratio * (((hot >> 8) & 0xff) - ((cold >> 8) & 0xff)));
    const b = Math.round((cold & 0xff) + ratio * ((hot & 0xff) - (cold & 0xff)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }, [percent, config.coldColor, config.hotColor]);

  const displayValue = typeof value === 'number' ? value.toFixed(1) : '0';
  const fontSize = (config as { fontSize?: number }).fontSize ?? 14;
  const thermWidth = Math.min(size.width - 10, 40);
  const thermHeight = size.height - 50;
  const bulbRadius = thermWidth / 2;
  const tubeWidth = thermWidth * 0.4;
  const tubeHeight = thermHeight - bulbRadius;

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="truncate max-w-full" style={{ color: style.textColor || '#94a3b8', fontSize }}>{label}</span>
      )}
      <div className="relative" style={{ width: thermWidth, height: thermHeight }}>
        <svg width={thermWidth} height={thermHeight} viewBox={`0 0 ${thermWidth} ${thermHeight}`}>
          <rect
            x={(thermWidth - tubeWidth) / 2}
            y="2"
            width={tubeWidth}
            height={tubeHeight}
            rx={tubeWidth / 2}
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="2"
          />
          <circle
            cx={thermWidth / 2}
            cy={thermHeight - bulbRadius}
            r={bulbRadius - 2}
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="2"
          />
          <circle
            cx={thermWidth / 2}
            cy={thermHeight - bulbRadius}
            r={bulbRadius - 6}
            fill={fillColor}
          />
          <rect
            x={(thermWidth - tubeWidth) / 2 + 4}
            y={2 + tubeHeight - 4 - (percent / 100) * (tubeHeight - 10)}
            width={tubeWidth - 8}
            height={(percent / 100) * (tubeHeight - 10) + bulbRadius - 4}
            fill={fillColor}
            style={{ transition: 'y 0.3s ease, height 0.3s ease, fill 0.3s ease' }}
          />
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={(thermWidth + tubeWidth) / 2 + 2}
                y1={2 + tubeHeight - 4 - tick * (tubeHeight - 10)}
                x2={(thermWidth + tubeWidth) / 2 + 8}
                y2={2 + tubeHeight - 4 - tick * (tubeHeight - 10)}
                stroke="#64748b"
                strokeWidth="1"
              />
              <text
                x={(thermWidth + tubeWidth) / 2 + 10}
                y={2 + tubeHeight - 4 - tick * (tubeHeight - 10) + 3}
                fontSize="8"
                fill="#64748b"
              >
                {Math.round(config.min + tick * (config.max - config.min))}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {config.showValue && (
        <div className="text-center">
          <span className="font-mono" style={{ color: style.textColor || '#e2e8f0', fontSize: (config as { fontSize?: number }).fontSize || style.fontSize || '1.125rem' }}>{displayValue}</span>
          <span className="ml-1" style={{ color: style.textColor || '#94a3b8', fontSize }}>{config.unit || '°C'}</span>
        </div>
      )}
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="truncate max-w-full" style={{ color: style.textColor || '#94a3b8', fontSize }}>{label}</span>
      )}
    </div>
  );
};
