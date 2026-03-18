import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check } from 'lucide-react';
import { InputConfig, WidgetStyle } from '../../types/visualization';

interface VisuInputProps {
  value: number | string;
  onChange: (value: number | string) => void;
  config: InputConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
}

export const VisuInput: React.FC<VisuInputProps> = ({
  value,
  onChange,
  config,
  style,
  label,
  disabled
}) => {
  const effectiveDefault = config.defaultValue !== undefined ? String(config.defaultValue) : '';
  const [localValue, setLocalValue] = useState<string>(value !== null && value !== undefined && value !== '' ? String(value) : effectiveDefault);
  const [hasChanges, setHasChanges] = useState(false);
  const suppressServerUpdateRef = useRef(false);
  const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hasChanges && !suppressServerUpdateRef.current) {
      const incoming = value !== null && value !== undefined && value !== '' ? String(value) : effectiveDefault;
      setLocalValue(incoming);
    }
  }, [value, hasChanges, effectiveDefault]);

  const handleFocus = useCallback(() => {
    setHasChanges(true);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setHasChanges(true);
  }, []);

  const handleSubmit = useCallback(() => {
    suppressServerUpdateRef.current = true;
    if (suppressTimeoutRef.current) clearTimeout(suppressTimeoutRef.current);
    suppressTimeoutRef.current = setTimeout(() => {
      suppressServerUpdateRef.current = false;
    }, 2000);

    if (config.inputType === 'number') {
      let numValue = parseFloat(localValue);
      if (isNaN(numValue)) numValue = 0;
      if (config.min !== undefined) numValue = Math.max(config.min, numValue);
      if (config.max !== undefined) numValue = Math.min(config.max, numValue);
      onChange(numValue);
      setLocalValue(String(numValue));
    } else {
      onChange(localValue);
    }
    setHasChanges(false);
  }, [localValue, config.inputType, config.min, config.max, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [handleSubmit]);

  const bgColor = style.backgroundColor ?? 'transparent';
  const txtColor = style.textColor ?? '#e2e8f0';
  const borderStyle = bgColor === 'transparent' ? 'transparent' : '#475569';
  const fontSize = (config as { fontSize?: number }).fontSize ?? 14;

  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-50' : ''}`}>
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="truncate" style={{ color: txtColor, opacity: 0.7, fontSize }}>{label}</span>
      )}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            type={config.inputType}
            value={localValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            onBlur={handleSubmit}
            disabled={disabled}
            placeholder={config.placeholder}
            min={config.min}
            max={config.max}
            className="w-full px-3 py-2 rounded-lg placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:cursor-not-allowed"
            style={{ backgroundColor: bgColor, color: txtColor, border: `1px solid ${borderStyle}`, fontSize }}
          />
          {config.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: txtColor, opacity: 0.6 }}>
              {config.unit}
            </span>
          )}
        </div>
        {hasChanges && (
          <button
            onClick={handleSubmit}
            className="w-9 h-9 rounded-lg bg-green-600 hover:bg-green-500 flex items-center justify-center transition-colors"
          >
            <Check className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="truncate" style={{ color: txtColor, opacity: 0.7, fontSize }}>{label}</span>
      )}
    </div>
  );
};
