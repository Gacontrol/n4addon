import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { MultistateConfig, WidgetStyle } from '../../types/visualization';

interface VisuMultistateProps {
  value: number | string | null;
  onChange: (value: number | string) => void;
  config: MultistateConfig;
  style: WidgetStyle;
  label: string;
  disabled?: boolean;
}

export const VisuMultistate: React.FC<VisuMultistateProps> = ({
  value,
  onChange,
  config,
  style,
  label,
  disabled
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options = config.options || [];
  const currentOption = options.find(o => o.value === value) || options.find(o => o.value === config.defaultValue) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const accentColor = style.accentColor || '#3b82f6';

  return (
    <div className="flex flex-col items-center gap-1 w-full h-full">
      {style.showLabel && style.labelPosition === 'top' && (
        <span className="text-xs truncate max-w-full" style={{ color: style.textColor || '#94a3b8' }}>{label}</span>
      )}
      <div ref={ref} className="relative w-full">
        <button
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'
          }`}
          style={{
            backgroundColor: currentOption?.color || style.backgroundColor || '#1e293b',
            borderColor: open ? accentColor : (style.borderColor || '#374151'),
            color: style.textColor || '#e2e8f0'
          }}
        >
          <span className="text-sm font-medium truncate">
            {currentOption?.label || '-- Auswahl --'}
          </span>
          <ChevronDown
            className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {open && !disabled && (
          <div
            className="absolute z-50 w-full mt-1 rounded-lg border border-slate-600 shadow-xl overflow-hidden"
            style={{ backgroundColor: style.backgroundColor || '#1e293b' }}
          >
            {options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:brightness-125 ${
                  option.value === value ? 'font-semibold' : ''
                }`}
                style={{
                  backgroundColor: option.value === value
                    ? (option.color || accentColor) + '33'
                    : 'transparent',
                  color: style.textColor || '#e2e8f0',
                  borderLeft: option.value === value ? `3px solid ${option.color || accentColor}` : '3px solid transparent'
                }}
              >
                {option.color && (
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {style.showLabel && style.labelPosition === 'bottom' && (
        <span className="text-xs truncate max-w-full" style={{ color: style.textColor || '#94a3b8' }}>{label}</span>
      )}
    </div>
  );
};
