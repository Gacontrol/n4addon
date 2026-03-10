import React from 'react';
import { SwitchConfig, WidgetStyle } from '../../types/visualization';

interface VisuSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  config: SwitchConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
}

export const VisuSwitch: React.FC<VisuSwitchProps> = ({
  value,
  onChange,
  config,
  style,
  label,
  disabled
}) => {
  const onColor = config.onColor || '#22c55e';
  const offColor = config.offColor || '#64748b';
  const currentColor = value ? onColor : offColor;

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative w-16 h-8 rounded-full transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ backgroundColor: currentColor }}
      >
        <div
          className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200"
          style={{ transform: value ? 'translateX(34px)' : 'translateX(2px)' }}
        />
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white"
          style={{ paddingLeft: value ? '0' : '20px', paddingRight: value ? '20px' : '0' }}
        >
          {value ? config.onLabel || 'Ein' : config.offLabel || 'Aus'}
        </span>
      </button>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
    </div>
  );
};
