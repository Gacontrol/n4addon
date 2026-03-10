import React, { useState, useEffect, useCallback } from 'react';
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
  const [localValue, setLocalValue] = useState<string>(String(value ?? ''));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!hasChanges) {
      setLocalValue(String(value ?? ''));
    }
  }, [value, hasChanges]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setHasChanges(true);
  }, []);

  const handleSubmit = useCallback(() => {
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

  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-50' : ''}`}>
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs text-slate-400 truncate">{label}</span>
      )}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <input
            type={config.inputType}
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleSubmit}
            disabled={disabled}
            placeholder={config.placeholder}
            min={config.min}
            max={config.max}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:cursor-not-allowed"
          />
          {config.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
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
        <span className="text-xs text-slate-400 truncate">{label}</span>
      )}
    </div>
  );
};
