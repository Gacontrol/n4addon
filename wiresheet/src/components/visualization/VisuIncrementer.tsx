import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { IncrementerConfig, WidgetStyle } from '../../types/visualization';

interface VisuIncrementerProps {
  value: number;
  onChange: (value: number) => void;
  config: IncrementerConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
}

export const VisuIncrementer: React.FC<VisuIncrementerProps> = ({
  value,
  onChange,
  config,
  style,
  label,
  disabled
}) => {
  const handleDecrement = () => {
    if (disabled) return;
    const newValue = Math.max(config.min, value - config.step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const newValue = Math.min(config.max, value + config.step);
    onChange(newValue);
  };

  const displayValue = typeof value === 'number'
    ? (config.step < 1 ? value.toFixed(1) : value.toString())
    : '0';

  const textColor = style.textColor || '#e2e8f0';
  const labelColor = style.textColor || '#94a3b8';

  return (
    <div className={`flex flex-col items-center gap-1 ${disabled ? 'opacity-50' : ''}`}>
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs truncate max-w-full" style={{ color: labelColor }}>{label}</span>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          disabled={disabled || value <= config.min}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <Minus className="w-5 h-5" style={{ color: textColor }} />
        </button>
        <div className="min-w-[60px] px-3 py-2 bg-slate-800 rounded-lg text-center">
          <span className="font-mono" style={{ color: textColor, fontSize: 'inherit' }}>
            {displayValue}
          </span>
          {config.unit && (
            <span className="ml-1" style={{ color: textColor, opacity: 0.7, fontSize: '0.75em' }}>{config.unit}</span>
          )}
        </div>
        <button
          onClick={handleIncrement}
          disabled={disabled || value >= config.max}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <Plus className="w-5 h-5" style={{ color: textColor }} />
        </button>
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs truncate max-w-full" style={{ color: labelColor }}>{label}</span>
      )}
    </div>
  );
};
