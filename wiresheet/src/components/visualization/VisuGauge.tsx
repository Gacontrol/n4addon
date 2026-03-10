import React, { useMemo } from 'react';
import { GaugeConfig, WidgetStyle } from '../../types/visualization';

interface VisuGaugeProps {
  value: number;
  config: GaugeConfig;
  style: WidgetStyle;
  label: string;
  size: { width: number; height: number };
}

export const VisuGauge: React.FC<VisuGaugeProps> = ({
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

  const currentColor = useMemo(() => {
    if (!config.thresholds || config.thresholds.length === 0) {
      return style.accentColor || '#3b82f6';
    }
    const sortedThresholds = [...config.thresholds].sort((a, b) => a.value - b.value);
    for (let i = sortedThresholds.length - 1; i >= 0; i--) {
      if (value <= sortedThresholds[i].value) {
        return sortedThresholds[i].color;
      }
    }
    return sortedThresholds[sortedThresholds.length - 1].color;
  }, [value, config.thresholds, style.accentColor]);

  const gaugeSize = Math.min(size.width, size.height) - 20;
  const strokeWidth = gaugeSize * 0.12;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = radius * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const displayValue = typeof value === 'number'
    ? value.toFixed(config.unit === '°C' || config.unit === '%' ? 1 : 0)
    : '0';

  return (
    <div className="flex flex-col items-center">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs text-slate-400 truncate max-w-full mb-1">{label}</span>
      )}
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize / 2 + 20 }}>
        <svg
          width={gaugeSize}
          height={gaugeSize / 2 + strokeWidth}
          viewBox={`0 0 ${gaugeSize} ${gaugeSize / 2 + strokeWidth}`}
          className="overflow-visible"
        >
          <path
            d={`M ${strokeWidth / 2} ${gaugeSize / 2} A ${radius} ${radius} 0 0 1 ${gaugeSize - strokeWidth / 2} ${gaugeSize / 2}`}
            fill="none"
            stroke="#334155"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={`M ${strokeWidth / 2} ${gaugeSize / 2} A ${radius} ${radius} 0 0 1 ${gaugeSize - strokeWidth / 2} ${gaugeSize / 2}`}
            fill="none"
            stroke={currentColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>
        {config.showValue && (
          <div
            className="absolute left-1/2 -translate-x-1/2 text-center"
            style={{ bottom: 0 }}
          >
            <span className="text-xl font-mono text-slate-200" style={{ fontSize: gaugeSize * 0.18 }}>
              {displayValue}
            </span>
            {config.unit && (
              <span className="text-sm text-slate-400 ml-1">{config.unit}</span>
            )}
          </div>
        )}
        <div className="absolute left-0 right-0 flex justify-between text-[10px] text-slate-500" style={{ bottom: -12 }}>
          <span>{config.min}</span>
          <span>{config.max}</span>
        </div>
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs text-slate-400 truncate max-w-full mt-2">{label}</span>
      )}
    </div>
  );
};
