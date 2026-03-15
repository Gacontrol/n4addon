import React from 'react';
import { DisplayConfig, WidgetStyle } from '../../types/visualization';

interface VisuDisplayProps {
  value: number | string | boolean | null;
  config: DisplayConfig;
  style: WidgetStyle;
  label: string;
}

export const VisuDisplay: React.FC<VisuDisplayProps> = ({
  value,
  config,
  style,
  label
}) => {
  const formatValue = () => {
    if (value === null || value === undefined) return '---';
    if (typeof value === 'boolean') {
      const trueText = config.trueText || 'Ein';
      const falseText = config.falseText || 'Aus';
      return value ? trueText : falseText;
    }
    if (typeof value === 'number') {
      const decimals = config.decimals ?? 1;
      return value.toFixed(decimals);
    }
    return String(value);
  };

  const bgColor = style.backgroundColor ?? 'transparent';
  const textColor = style.textColor ?? '#22c55e';
  const fontSize = config.fontSize || 24;

  return (
    <div className="flex flex-col gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs truncate" style={{ color: textColor, opacity: 0.7 }}>{label}</span>
      )}
      <div
        className="px-4 py-3 rounded-lg font-mono text-center"
        style={{ backgroundColor: bgColor, border: bgColor === 'transparent' ? 'none' : undefined }}
      >
        <span style={{ color: textColor, fontSize }}>
          {formatValue()}
        </span>
        {config.unit && (
          <span className="text-slate-400 ml-2" style={{ fontSize: fontSize * 0.6 }}>
            {config.unit}
          </span>
        )}
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs truncate" style={{ color: textColor, opacity: 0.7 }}>{label}</span>
      )}
    </div>
  );
};
