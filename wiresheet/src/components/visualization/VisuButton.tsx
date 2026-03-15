import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  const [toggleState, setToggleState] = useState(false);
  const [impulseActive, setImpulseActive] = useState(false);
  const buttonColor = config.color || '#3b82f6';
  const pressVal = config.pressValue ?? config.defaultPressValue ?? true;
  const releaseVal = config.releaseValue ?? config.defaultReleaseValue ?? false;
  const isHoldMode = config.holdMode === true;
  const isImpulseMode = config.impulseMode === true;
  const pressedRef = useRef(false);
  const impulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (impulseTimerRef.current) clearTimeout(impulseTimerRef.current);
    };
  }, []);

  const isActive = impulseActive || (statusValue !== undefined && statusValue !== null && statusValue !== false && statusValue !== 0);

  useEffect(() => {
    if (!isHoldMode && !isImpulseMode && statusValue !== undefined) {
      setToggleState(isActive);
    }
  }, [statusValue, isActive, isHoldMode, isImpulseMode]);

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    setPressed(true);
    pressedRef.current = true;

    if (isHoldMode) {
      onValueChange(pressVal);
    }
  }, [disabled, onValueChange, pressVal, isHoldMode]);

  const handleMouseUp = useCallback(() => {
    if (disabled) return;
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setPressed(false);

    if (isImpulseMode) {
      if (impulseTimerRef.current) clearTimeout(impulseTimerRef.current);
      setImpulseActive(true);
      onValueChange(pressVal);
      impulseTimerRef.current = setTimeout(() => {
        setImpulseActive(false);
        onValueChange(releaseVal);
      }, 200);
    } else if (isHoldMode) {
      onValueChange(releaseVal);
    } else {
      const newState = !toggleState;
      setToggleState(newState);
      onValueChange(newState ? pressVal : releaseVal);
    }
  }, [disabled, onValueChange, releaseVal, pressVal, isHoldMode, isImpulseMode, toggleState]);

  const handleMouseLeave = useCallback(() => {
    if (pressed && isHoldMode) {
      setPressed(false);
      pressedRef.current = false;
      onValueChange(releaseVal);
    }
  }, [pressed, isHoldMode, releaseVal, onValueChange]);

  const activeColor = isActive ? `${buttonColor}` : buttonColor;

  const labelColor = style.textColor || '#94a3b8';
  const fontSize = (config as { fontSize?: number }).fontSize ?? 14;

  return (
    <div className="flex flex-col items-center gap-1">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="truncate max-w-full" style={{ color: labelColor, fontSize }}>{label}</span>
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
            outlineOffset: '2px',
            fontSize
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
        <span className="truncate max-w-full" style={{ color: labelColor, fontSize }}>{label}</span>
      )}
    </div>
  );
};
