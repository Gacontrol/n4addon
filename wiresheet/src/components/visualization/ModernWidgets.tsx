import React, { useState, useRef, useEffect } from 'react';
import {
  ModernSwitchConfig,
  ModernButtonConfig,
  ModernGaugeConfig,
  ModernDisplayConfig,
  ModernBarConfig,
  ModernLedConfig,
  ModernSliderConfig,
  WidgetStyle
} from '../../types/visualization';

interface BaseProps {
  style: WidgetStyle;
  label: string;
}

/* ─── Modern Switch ─── */
interface ModernSwitchProps extends BaseProps {
  value: boolean;
  onChange: (v: boolean) => void;
  config: ModernSwitchConfig;
  disabled?: boolean;
}

export const ModernSwitch: React.FC<ModernSwitchProps> = ({ value, onChange, config, label, style, disabled }) => {
  const onColor = config.onColor ?? '#22c55e';
  const offColor = config.offColor ?? '#475569';
  const showLabel = style.showLabel !== false;

  return (
    <div className="w-full h-full flex flex-col justify-center gap-1 px-3">
      {showLabel && (
        <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: value ? onColor : offColor }}>
          {value ? (config.onLabel ?? 'Ein') : (config.offLabel ?? 'Aus')}
        </span>
        <button
          disabled={disabled}
          onClick={() => !disabled && onChange(!value)}
          className="relative flex-shrink-0 transition-all duration-300 focus:outline-none"
          style={{ width: 52, height: 28 }}
        >
          <div
            className="absolute inset-0 rounded-full transition-all duration-300"
            style={{ backgroundColor: value ? onColor : offColor, opacity: disabled ? 0.5 : 1 }}
          />
          <div
            className="absolute top-1 transition-all duration-300 rounded-full bg-white shadow-md"
            style={{
              width: 20,
              height: 20,
              left: value ? 28 : 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
            }}
          />
        </button>
      </div>
    </div>
  );
};

/* ─── Modern Button ─── */
interface ModernButtonProps extends BaseProps {
  onValueChange: (v: unknown) => void;
  config: ModernButtonConfig;
  disabled?: boolean;
}

export const ModernButton: React.FC<ModernButtonProps> = ({ onValueChange, config, label, style, disabled }) => {
  const [pressed, setPressed] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const color = config.color ?? '#3b82f6';
  const showLabel = style.showLabel !== false;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setPressed(true);
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() });
    }
    onValueChange(config.pressValue ?? true);
  };

  const handlePointerUp = () => {
    if (disabled) return;
    setPressed(false);
    if (!config.holdMode) {
      onValueChange(config.releaseValue ?? false);
    }
    setTimeout(() => setRipple(null), 600);
  };

  return (
    <div className="w-full h-full flex flex-col justify-center gap-1 px-3">
      {showLabel && (
        <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
      )}
      <button
        ref={btnRef}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative w-full overflow-hidden rounded-lg font-semibold text-white text-sm transition-transform duration-100 select-none focus:outline-none"
        style={{
          height: 36,
          backgroundColor: color,
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          opacity: disabled ? 0.5 : 1
        }}
      >
        {config.label ?? label}
        {ripple && (
          <span
            key={ripple.id}
            className="absolute rounded-full pointer-events-none animate-ping"
            style={{
              width: 80,
              height: 80,
              left: ripple.x - 40,
              top: ripple.y - 40,
              backgroundColor: 'rgba(255,255,255,0.3)',
              animation: 'ripple 0.6s linear'
            }}
          />
        )}
      </button>
    </div>
  );
};

/* ─── Modern Gauge ─── */
interface ModernGaugeProps extends BaseProps {
  value: number;
  config: ModernGaugeConfig;
  size: { width: number; height: number };
}

export const ModernGauge: React.FC<ModernGaugeProps> = ({ value, config, label, style, size }) => {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const unit = config.unit ?? '';
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const showLabel = style.showLabel !== false;

  const dim = Math.min(size.width, size.height) - (showLabel ? 24 : 4);
  const cx = dim / 2;
  const cy = dim / 2;
  const r = (dim / 2) * 0.78;
  const stroke = dim * 0.08;
  const startAngle = -225;
  const totalAngle = 270;
  const angle = startAngle + pct * totalAngle;

  const polar = (a: number, radius: number) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const describeArc = (a1: number, a2: number, rad: number) => {
    const s = polar(a1, rad);
    const e = polar(a2, rad);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rad} ${rad} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const thresholds = config.thresholds ?? [];
  let arcColor = '#3b82f6';
  for (const t of thresholds) {
    if (value >= min && value <= t.value) { arcColor = t.color; break; }
  }
  if (thresholds.length > 0 && value > thresholds[thresholds.length - 1].value) {
    arcColor = thresholds[thresholds.length - 1].color;
  }

  const decimals = value % 1 === 0 ? 0 : 1;
  const displayVal = value.toFixed(decimals);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="overflow-visible">
        <path d={describeArc(startAngle, startAngle + totalAngle, r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} strokeLinecap="round" />
        {pct > 0.01 && (
          <path d={describeArc(startAngle, angle, r)} fill="none" stroke={arcColor} strokeWidth={stroke} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 ${stroke * 0.6}px ${arcColor}60)` }} />
        )}
        <text x={cx} y={cy - stroke * 0.1} textAnchor="middle" dominantBaseline="middle"
          style={{ fill: 'white', fontSize: dim * 0.18, fontWeight: 700 }}>
          {displayVal}
        </text>
        <text x={cx} y={cy + dim * 0.13} textAnchor="middle"
          style={{ fill: 'rgba(255,255,255,0.5)', fontSize: dim * 0.09 }}>
          {unit}
        </text>
      </svg>
      {showLabel && (
        <span className="text-xs text-slate-400 mt-1 truncate max-w-full px-2 text-center">{label}</span>
      )}
    </div>
  );
};

/* ─── Modern Display ─── */
interface ModernDisplayProps extends BaseProps {
  value: number | string | boolean | null;
  config: ModernDisplayConfig;
}

export const ModernDisplay: React.FC<ModernDisplayProps> = ({ value, config, label, style }) => {
  const decimals = config.decimals ?? 1;
  const unit = config.unit ?? '';
  const prefix = config.prefix ?? '';
  const suffix = config.suffix ?? '';
  const showLabel = style.showLabel !== false;

  let displayVal = '—';
  if (value !== null && value !== undefined) {
    if (typeof value === 'number') {
      displayVal = value.toFixed(decimals);
    } else {
      displayVal = String(value);
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-3">
      {showLabel && (
        <span className="text-xs font-medium text-slate-400 mb-1 truncate max-w-full">{label}</span>
      )}
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-sm text-slate-400">{prefix}</span>}
        <span className="font-bold tabular-nums" style={{ fontSize: 32, color: style.textColor ?? 'white', lineHeight: 1 }}>
          {displayVal}
        </span>
        {(unit || suffix) && (
          <span className="text-sm text-slate-400">{unit}{suffix}</span>
        )}
      </div>
    </div>
  );
};

/* ─── Modern Bar ─── */
interface ModernBarProps extends BaseProps {
  value: number;
  config: ModernBarConfig;
  size: { width: number; height: number };
}

export const ModernBar: React.FC<ModernBarProps> = ({ value, config, label, style }) => {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const unit = config.unit ?? '%';
  const color = config.color ?? '#3b82f6';
  const showValue = config.showValue !== false;
  const showLabel = style.showLabel !== false;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="w-full h-full flex flex-col justify-center px-3 gap-1">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
          {showValue && (
            <span className="text-xs font-semibold text-white tabular-nums">{value.toFixed(1)}{unit}</span>
          )}
        </div>
      )}
      <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
      {!showLabel && showValue && (
        <span className="text-xs text-slate-400 text-right">{pct.toFixed(0)}%</span>
      )}
    </div>
  );
};

/* ─── Modern LED / Status ─── */
interface ModernLedProps extends BaseProps {
  value: boolean;
  config: ModernLedConfig;
}

export const ModernLed: React.FC<ModernLedProps> = ({ value, config, label }) => {
  const onColor = config.onColor ?? '#22c55e';
  const offColor = config.offColor ?? '#475569';
  const dotLabel = config.label ?? label;
  const color = value ? onColor : offColor;

  return (
    <div className="w-full h-full flex items-center gap-3 px-3">
      <div className="flex-shrink-0 relative">
        <div
          className="rounded-full transition-all duration-300"
          style={{
            width: 14,
            height: 14,
            backgroundColor: color,
            boxShadow: value ? `0 0 8px 2px ${onColor}80` : undefined
          }}
        />
        {value && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: onColor, opacity: 0.3 }}
          />
        )}
      </div>
      <span className="text-sm font-medium text-slate-200 truncate">{dotLabel}</span>
      <span className="ml-auto text-xs font-semibold" style={{ color }}>{value ? 'EIN' : 'AUS'}</span>
    </div>
  );
};

/* ─── Modern Slider ─── */
interface ModernSliderProps extends BaseProps {
  value: number;
  onChange: (v: number) => void;
  config: ModernSliderConfig;
  disabled?: boolean;
}

export const ModernSlider: React.FC<ModernSliderProps> = ({ value, onChange, config, label, style, disabled }) => {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const step = config.step ?? 1;
  const unit = config.unit ?? '';
  const color = config.color ?? '#3b82f6';
  const showValue = config.showValue !== false;
  const showLabel = style.showLabel !== false;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full h-full flex flex-col justify-center gap-2 px-3">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
          {showValue && (
            <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}{unit}</span>
          )}
        </div>
      )}
      <div className="relative flex items-center" style={{ height: 20 }}>
        <div className="absolute w-full h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <div className="absolute h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-5"
          style={{ zIndex: 2 }}
        />
        <div
          className="absolute w-4 h-4 rounded-full border-2 bg-white shadow transition-all"
          style={{ left: `calc(${pct}% - 8px)`, borderColor: color, zIndex: 1 }}
        />
      </div>
    </div>
  );
};
