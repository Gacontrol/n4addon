import React, { useMemo } from 'react';
import { BarConfig, WidgetStyle } from '../../types/visualization';

interface VisuBarProps {
  value: number;
  config: BarConfig;
  style: WidgetStyle;
  label: string;
  size: { width: number; height: number };
}

export const VisuBar: React.FC<VisuBarProps> = ({
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

  const barColor = config.color || '#3b82f6';
  const bgColor = config.backgroundColor || '#1e293b';
  const isVertical = config.orientation === 'vertical';

  const displayValue = typeof value === 'number'
    ? value.toFixed(config.unit === '%' ? 0 : 1)
    : '0';

  if (isVertical) {
    return (
      <div className="flex flex-col items-center gap-1" style={{ height: size.height }}>
        {style.showLabel && style.labelPosition === 'top' && (
          <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
        )}
        <div className="flex items-end gap-2 flex-1">
          <div
            className="relative rounded-lg overflow-hidden"
            style={{ width: 30, height: '100%', backgroundColor: bgColor }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 transition-all duration-300"
              style={{ height: `${percent}%`, backgroundColor: barColor }}
            />
          </div>
          {config.showValue && (
            <div className="text-sm text-slate-300 font-mono whitespace-nowrap">
              {displayValue}{config.unit}
            </div>
          )}
        </div>
        {style.showLabel && style.labelPosition === 'bottom' && (
          <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" style={{ width: size.width }}>
      {style.showLabel && style.labelPosition === 'top' && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 truncate">{label}</span>
          {config.showValue && (
            <span className="text-xs text-slate-300 font-mono">
              {displayValue}{config.unit}
            </span>
          )}
        </div>
      )}
      <div
        className="relative h-6 rounded-lg overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="absolute top-0 left-0 h-full transition-all duration-300 rounded-lg"
          style={{ width: `${percent}%`, backgroundColor: barColor }}
        />
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 truncate">{label}</span>
          {config.showValue && (
            <span className="text-xs text-slate-300 font-mono">
              {displayValue}{config.unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
