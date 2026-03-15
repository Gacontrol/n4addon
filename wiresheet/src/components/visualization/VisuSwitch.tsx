import React from 'react';
import { SwitchConfig, WidgetStyle } from '../../types/visualization';

interface VisuSwitchProps {
  value: boolean;
  statusValue?: boolean | null;
  onChange: (value: boolean) => void;
  config: SwitchConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
  writeOnly?: boolean;
}

export const VisuSwitch: React.FC<VisuSwitchProps> = ({
  value,
  statusValue,
  onChange,
  config,
  style,
  label,
  disabled,
  writeOnly = false
}) => {
  const onColor = config.onColor || '#22c55e';
  const offColor = config.offColor || '#64748b';

  const hasFeedback = statusValue !== null && statusValue !== undefined;
  const displayValue = writeOnly
    ? (hasFeedback ? Boolean(statusValue) : (config.defaultValue ?? false))
    : (hasFeedback ? Boolean(statusValue) : value);

  const handleClick = () => {
    if (disabled) return;
    onChange(!displayValue);
  };

  const textColor = style.textColor || '#94a3b8';
  const fontSize = (config as { fontSize?: number }).fontSize ?? 12;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="font-medium truncate max-w-full tracking-wide uppercase" style={{ color: textColor, fontSize }}>{label}</span>
      )}

      <div className="flex flex-col items-center gap-2">
        <button
          onClick={handleClick}
          disabled={disabled}
          aria-pressed={displayValue}
          className={`relative flex-shrink-0 transition-all duration-300 ease-in-out focus:outline-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          style={{ width: 56, height: 28 }}
        >
          <div
            className="absolute inset-0 rounded-full transition-all duration-300"
            style={{
              backgroundColor: displayValue ? onColor : offColor,
              boxShadow: displayValue
                ? `0 0 0 1px ${onColor}44, inset 0 1px 3px rgba(0,0,0,0.2)`
                : 'inset 0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
          <div
            className="absolute top-[3px] w-[22px] h-[22px] rounded-full transition-all duration-300 ease-in-out"
            style={{
              left: displayValue ? 'calc(100% - 25px)' : '3px',
              background: 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(0,0,0,0.1)',
            }}
          />
          {!disabled && (
            <div
              className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            />
          )}
        </button>

        {hasFeedback && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: Boolean(statusValue) ? onColor : '#475569',
                boxShadow: Boolean(statusValue) ? `0 0 4px ${onColor}` : 'none',
              }}
            />
            <span className="text-[9px] font-medium text-slate-500 tracking-wider uppercase">
              {Boolean(statusValue) ? config.onLabel || 'Ein' : config.offLabel || 'Aus'}
            </span>
          </div>
        )}
      </div>

      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="font-medium truncate max-w-full tracking-wide uppercase" style={{ color: textColor, fontSize }}>{label}</span>
      )}
    </div>
  );
};
