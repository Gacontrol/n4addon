import React, { useState, useEffect, useRef } from 'react';
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

  const [localValue, setLocalValue] = useState<boolean | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const serverValue = hasFeedback ? Boolean(statusValue) : value;

  useEffect(() => {
    if (localValue !== null && serverValue === localValue) {
      setLocalValue(null);
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    }
  }, [serverValue, localValue]);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
      }
    };
  }, []);

  const displayValue = localValue !== null ? localValue : (writeOnly ? (statusValue ?? (config.defaultValue ?? false)) : serverValue);

  const knobValue = displayValue;
  const colorValue = hasFeedback && localValue === null ? Boolean(statusValue) : displayValue;

  const currentColor = colorValue ? onColor : offColor;

  const isPending = localValue !== null && localValue !== serverValue;

  const handleClick = () => {
    if (disabled) return;
    const newVal = !displayValue;
    setLocalValue(newVal);
    onChange(newVal);

    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = setTimeout(() => {
      setLocalValue(null);
      pendingTimeoutRef.current = null;
    }, 5000);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={handleClick}
          disabled={disabled}
          className={`relative w-16 h-8 rounded-full transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          style={{
            backgroundColor: currentColor,
            opacity: isPending ? 0.7 : 1,
            boxShadow: isPending ? `0 0 0 2px ${currentColor}44` : undefined
          }}
        >
          {isPending && (
            <div className="absolute inset-0 rounded-full animate-pulse" style={{ backgroundColor: currentColor, opacity: 0.3 }} />
          )}
          <div
            className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200"
            style={{ transform: knobValue ? 'translateX(34px)' : 'translateX(2px)' }}
          />
          <span
            className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white"
            style={{ paddingLeft: knobValue ? '0' : '20px', paddingRight: knobValue ? '20px' : '0' }}
          >
            {knobValue ? config.onLabel || 'Ein' : config.offLabel || 'Aus'}
          </span>
        </button>
        {hasFeedback && (
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full transition-colors duration-300"
              style={{ backgroundColor: Boolean(statusValue) ? onColor : offColor }}
            />
            <span className="text-[9px] text-slate-500">
              {Boolean(statusValue) ? config.onLabel || 'Ein' : config.offLabel || 'Aus'}
            </span>
          </div>
        )}
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
    </div>
  );
};
