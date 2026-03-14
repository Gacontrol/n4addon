import React, { useCallback, useRef, useState, useEffect } from 'react';
import { SliderConfig, WidgetStyle } from '../../types/visualization';

interface VisuSliderProps {
  value: number;
  onChange: (value: number) => void;
  config: SliderConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
  width: number;
}

export const VisuSlider: React.FC<VisuSliderProps> = ({
  value,
  onChange,
  config,
  style,
  label,
  disabled,
  width
}) => {
  const effectiveDefault = config.defaultValue !== undefined ? config.defaultValue : config.min;
  const [localValue, setLocalValue] = useState(value !== null && value !== undefined ? value : effectiveDefault);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const accentColor = style.accentColor || '#3b82f6';

  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value !== null && value !== undefined ? value : effectiveDefault);
    }
  }, [value, isDragging, effectiveDefault]);

  const calculateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return localValue;
    const rect = sliderRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const range = config.max - config.min;
    const rawValue = config.min + percent * range;
    const steppedValue = Math.round(rawValue / config.step) * config.step;
    return Math.max(config.min, Math.min(config.max, steppedValue));
  }, [config.min, config.max, config.step, localValue]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const newValue = calculateValue(e.clientX);
    setLocalValue(newValue);
  }, [disabled, calculateValue]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;
    const newValue = calculateValue(e.clientX);
    setLocalValue(newValue);
  }, [isDragging, disabled, calculateValue]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onChange(localValue);
    }
  }, [isDragging, localValue, onChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const touch = e.touches[0];
    const newValue = calculateValue(touch.clientX);
    setLocalValue(newValue);
  }, [disabled, calculateValue]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || disabled) return;
    e.preventDefault();
    const touch = e.touches[0];
    const newValue = calculateValue(touch.clientX);
    setLocalValue(newValue);
  }, [isDragging, disabled, calculateValue]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onChange(localValue);
    }
  }, [isDragging, localValue, onChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const percent = ((localValue - config.min) / (config.max - config.min)) * 100;

  return (
    <div className="flex flex-col gap-1" style={{ width }}>
      {style.showLabel && style.labelPosition === 'top' && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 truncate">{label}</span>
          {config.showValue && (
            <span className="text-xs text-slate-300 font-mono">
              {localValue.toFixed(config.step < 1 ? 1 : 0)}{config.unit}
            </span>
          )}
        </div>
      )}
      <div
        ref={sliderRef}
        className={`relative h-8 bg-slate-700 rounded-full select-none ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ touchAction: 'none' }}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: accentColor
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-7 h-7 bg-white rounded-full shadow-lg"
          style={{ left: `calc(${percent}% - 14px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{config.min}</span>
        <span>{config.max}</span>
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 truncate">{label}</span>
          {config.showValue && (
            <span className="text-xs text-slate-300 font-mono">
              {localValue.toFixed(config.step < 1 ? 1 : 0)}{config.unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
