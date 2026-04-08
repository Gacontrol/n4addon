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
  const fontSize = style.fontSize || config.fontSize || 24;

  return (
    <div className="w-full h-full flex flex-col">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs truncate px-1" style={{ color: textColor, opacity: 0.7, flexShrink: 0 }}>{label}</span>
      )}
      <div
        className="flex-1 flex items-center justify-center font-mono"
        style={{ backgroundColor: bgColor, borderRadius: bgColor !== 'transparent' ? 6 : 0, overflow: 'hidden' }}
      >
        <span style={{ color: textColor, fontSize, whiteSpace: 'nowrap' }}>
          {formatValue()}
        </span>
        {config.unit && (
          <span className="text-slate-400 ml-2" style={{ fontSize: fontSize * 0.6, flexShrink: 0 }}>
            {config.unit}
          </span>
        )}
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs truncate px-1" style={{ color: textColor, opacity: 0.7, flexShrink: 0 }}>{label}</span>
      )}
    </div>
  );
};
