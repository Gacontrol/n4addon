import React, { useState } from 'react';
import {
  Activity, Zap, Power, Thermometer, Droplets, Wind,
  TrendingUp, TrendingDown, Minus as MinusIcon, Sun, Home,
  Wifi, Battery, Settings
} from 'lucide-react';
import {
  DashStatConfig,
  DashProgressConfig,
  DashValueCardConfig,
  DashToggleCardConfig,
  WidgetStyle
} from '../../types/visualization';

const iconComponents: Record<string, React.FC<{ className?: string; size?: number; style?: React.CSSProperties }>> = {
  Activity,
  Zap,
  Power,
  Thermometer,
  Droplets,
  Wind,
  TrendingUp,
  Sun,
  Home,
  Wifi,
  Battery,
  Settings
};

function DashIcon({ name, className, size, color }: { name?: string; className?: string; size?: number; color?: string }) {
  const Icon = iconComponents[name ?? 'Activity'] ?? Activity;
  return <Icon className={className} size={size} style={{ color }} />;
}

interface BaseProps {
  style: WidgetStyle;
  label: string;
}

/* ─── Dash Stat Card ─── */
interface DashStatProps extends BaseProps {
  value: number | string | null;
  config: DashStatConfig;
}

export const DashStat: React.FC<DashStatProps> = ({ value, config, label, style }) => {
  const unit = config.unit ?? '';
  const decimals = config.decimals ?? 1;
  const color = config.color ?? '#3b82f6';
  const showLabel = style.showLabel !== false;

  let displayVal = '—';
  if (value !== null && value !== undefined) {
    displayVal = typeof value === 'number' ? value.toFixed(decimals) : String(value);
  }

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden flex flex-col justify-between p-3"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div className="flex items-start justify-between">
        {showLabel && (
          <span className="text-xs font-medium text-slate-400 truncate max-w-[70%]">{label}</span>
        )}
        <div className="rounded-lg p-1.5 flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
          <DashIcon name={config.icon} size={14} color={color} />
        </div>
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="font-bold tabular-nums leading-none" style={{ fontSize: 28, color: 'white' }}>
          {displayVal}
        </span>
        {unit && <span className="text-sm text-slate-400 mb-0.5">{unit}</span>}
      </div>
    </div>
  );
};

/* ─── Dash Progress Card ─── */
interface DashProgressProps extends BaseProps {
  value: number;
  config: DashProgressConfig;
}

export const DashProgress: React.FC<DashProgressProps> = ({ value, config, label, style }) => {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const unit = config.unit ?? '%';
  const showValue = config.showValue !== false;
  const showLabel = style.showLabel !== false;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const thresholds = config.thresholds ?? [];
  let barColor = config.color ?? '#3b82f6';
  for (const t of thresholds) {
    if (value <= t.value) { barColor = t.color; break; }
  }
  if (thresholds.length > 0 && value > thresholds[thresholds.length - 1].value) {
    barColor = thresholds[thresholds.length - 1].color;
  }

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden flex flex-col justify-between p-3"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        {showLabel && <span className="text-xs font-medium text-slate-400 truncate">{label}</span>}
        {showValue && (
          <span className="text-sm font-bold tabular-nums" style={{ color: barColor }}>
            {value.toFixed(1)}{unit}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}60` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Dash Value Card ─── */
interface DashValueCardProps extends BaseProps {
  value: number | string | null;
  config: DashValueCardConfig;
}

export const DashValueCard: React.FC<DashValueCardProps> = ({ value, config, label, style }) => {
  const unit = config.unit ?? '';
  const decimals = config.decimals ?? 1;
  const color = config.color ?? '#0ea5e9';
  const showLabel = style.showLabel !== false;

  let displayVal = '—';
  if (value !== null && value !== undefined) {
    displayVal = typeof value === 'number' ? value.toFixed(decimals) : String(value);
  }

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden flex flex-col p-3"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}30`
      }}
    >
      <div className="flex items-center gap-2 mb-auto">
        <div className="rounded-full p-1.5" style={{ backgroundColor: `${color}20` }}>
          <DashIcon name={config.icon} size={12} color={color} />
        </div>
        {showLabel && <span className="text-xs text-slate-400 truncate">{label}</span>}
      </div>
      <div className="mt-2">
        <div className="flex items-baseline gap-1">
          <span className="font-black tabular-nums" style={{ fontSize: 34, color, lineHeight: 1 }}>
            {displayVal}
          </span>
          {unit && <span className="text-xs font-medium mb-1" style={{ color: `${color}99` }}>{unit}</span>}
        </div>
      </div>
      <div className="mt-1 h-0.5 rounded-full" style={{ backgroundColor: `${color}30` }} />
    </div>
  );
};

/* ─── Dash Toggle Card ─── */
interface DashToggleCardProps extends BaseProps {
  value: boolean;
  onChange: (v: boolean) => void;
  config: DashToggleCardConfig;
  disabled?: boolean;
}

export const DashToggleCard: React.FC<DashToggleCardProps> = ({ value, onChange, config, label, style, disabled }) => {
  const onColor = config.onColor ?? '#22c55e';
  const offColor = config.offColor ?? '#64748b';
  const showLabel = style.showLabel !== false;
  const color = value ? onColor : offColor;

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden flex flex-col p-3 cursor-pointer transition-all duration-200"
      style={{
        background: value
          ? `linear-gradient(135deg, ${onColor}18 0%, ${onColor}08 100%)`
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}30`
      }}
      onClick={() => !disabled && onChange(!value)}
    >
      <div className="flex items-start justify-between">
        <div className="rounded-lg p-2" style={{ backgroundColor: `${color}20` }}>
          <DashIcon name={config.icon} size={16} color={color} />
        </div>
        <div
          className="relative rounded-full transition-all duration-300 flex-shrink-0"
          style={{ width: 42, height: 24, backgroundColor: value ? onColor : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-1 rounded-full bg-white shadow transition-all duration-300"
            style={{ width: 16, height: 16, left: value ? 22 : 4 }}
          />
        </div>
      </div>
      <div className="mt-auto">
        {showLabel && (
          <div className="text-xs text-slate-400 truncate mb-0.5">{label}</div>
        )}
        <div className="text-sm font-bold" style={{ color }}>
          {value ? (config.onLabel ?? 'Aktiv') : (config.offLabel ?? 'Inaktiv')}
        </div>
      </div>
    </div>
  );
};
