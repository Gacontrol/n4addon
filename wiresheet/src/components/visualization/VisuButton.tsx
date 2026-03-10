import React, { useState, useCallback } from 'react';
import { ButtonConfig, WidgetStyle } from '../../types/visualization';

interface VisuButtonProps {
  onValueChange: (value: unknown) => void;
  config: ButtonConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
}

export const VisuButton: React.FC<VisuButtonProps> = ({
  onValueChange,
  config,
  style,
  label,
  disabled
}) => {
  const [pressed, setPressed] = useState(false);
  const buttonColor = config.color || '#3b82f6';

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    setPressed(true);
    onValueChange(config.pressValue ?? true);
  }, [disabled, onValueChange, config.pressValue]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    setPressed(false);
    if (!config.holdMode) {
      onValueChange(config.releaseValue ?? false);
    }
  }, [disabled, onValueChange, config.releaseValue, config.holdMode]);

  const handleMouseLeave = useCallback(() => {
    if (pressed && !config.holdMode) {
      setPressed(false);
      onValueChange(config.releaseValue ?? false);
    }
  }, [pressed, config.holdMode, config.releaseValue, onValueChange]);

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={disabled}
        className={`px-4 py-2 rounded-lg font-medium text-white transition-all duration-100 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
        style={{
          backgroundColor: pressed ? `${buttonColor}dd` : buttonColor,
          boxShadow: pressed ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        {config.label || 'Taster'}
      </button>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs text-slate-400 truncate max-w-full">{label}</span>
      )}
    </div>
  );
};
