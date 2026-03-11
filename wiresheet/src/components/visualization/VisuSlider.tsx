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

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

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
        className={`relative h-6 bg-slate-700 rounded-full ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all"
          style={{
            width: `${percent}%`,
            backgroundColor: accentColor
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg transition-all"
          style={{ left: `calc(${percent}% - 10px)` }}
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
