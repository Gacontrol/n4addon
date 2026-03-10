import React, { useState, useCallback } from 'react';
import { ButtonConfig, WidgetStyle } from '../../types/visualization';

interface VisuButtonProps {
  onValueChange: (value: unknown) => void;
  config: ButtonConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
  statusValue?: unknown;
}

export const VisuButton: React.FC<VisuButtonProps> = ({
  onValueChange,
  config,
  style,
  label,
  disabled,
  statusValue
}) => {
  const [pressed, setPressed] = useState(false);
  const buttonColor = config.color || '#3b82f6';
  const pressVal = config.pressValue ?? config.defaultPressValue ?? true;
  const releaseVal = config.releaseValue ?? config.defaultReleaseValue ?? false;

  const isActive = statusValue !== undefined && statusValue !== null && statusValue !== false && statusValue !== 0;

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    setPressed(true);
    onValueChange(pressVal);
  }, [disabled, onValueChange, pressVal]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    setPressed(false);
    if (!config.holdMode) {
      onValueChange(releaseVal);
    }
  }, [disabled, onValueChange, releaseVal, config.holdMode]);

  const handleMouseLeave = useCallback(() => {
    if (pressed && !config.holdMode) {
      setPressed(false);
      onValueChange(releaseVal);
    }
  }, [pressed, config.holdMode, releaseVal, onValueChange]);

  const activeColor = isActive ? `${buttonColor}` : buttonColor;

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
      <div className="relative">
        <button
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-all duration-100 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
          style={{
            backgroundColor: pressed ? `${activeColor}dd` : activeColor,
            boxShadow: pressed
              ? 'inset 0 2px 4px rgba(0,0,0,0.3)'
              : isActive
                ? `0 0 8px ${buttonColor}80, 0 2px 4px rgba(0,0,0,0.2)`
                : '0 2px 4px rgba(0,0,0,0.2)',
            outline: isActive ? `2px solid ${buttonColor}` : 'none',
            outlineOffset: '2px'
          }}
        >
          {config.label || 'Taster'}
        </button>
        {statusValue !== undefined && statusValue !== null && (
          <div
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900"
            style={{ backgroundColor: isActive ? '#22c55e' : '#64748b' }}
          />
        )}
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
    </div>
  );
};
