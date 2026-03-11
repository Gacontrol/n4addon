import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Zap, Power, Thermometer, Droplets, Wind,
  TrendingUp, TrendingDown, Sun, Home,
  Wifi, Battery, Settings, Navigation, Star, AlignLeft
} from 'lucide-react';
import {
  DashStatConfig,
  DashProgressConfig,
  DashValueCardConfig,
  DashToggleCardConfig,
  DashBatteryConfig,
  DashSignalConfig,
  DashSparklineConfig,
  DashMultivalueConfig,
  DashHeatbarConfig,
  DashCompassConfig,
  DashClockConfig,
  DashRatingConfig,
  DashLevelConfig,
  DashWindConfig,
  DashMultistateConfig,
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

  const [localValue, setLocalValue] = useState<boolean | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (localValue !== null && value === localValue) {
      setLocalValue(null);
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    }
  }, [value, localValue]);

  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  const displayValue = localValue !== null ? localValue : value;
  const color = displayValue ? onColor : offColor;
  const isPending = localValue !== null && localValue !== value;

  const handleClick = () => {
    if (disabled) return;
    const newVal = !displayValue;
    setLocalValue(newVal);
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    pendingTimeoutRef.current = setTimeout(() => {
      setLocalValue(null);
      pendingTimeoutRef.current = null;
    }, 5000);
    onChange(newVal);
  };

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden flex flex-col p-3 cursor-pointer transition-all duration-200"
      style={{
        background: displayValue
          ? `linear-gradient(135deg, ${onColor}18 0%, ${onColor}08 100%)`
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}30`,
        opacity: isPending ? 0.85 : 1
      }}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="rounded-lg p-2" style={{ backgroundColor: `${color}20` }}>
          <DashIcon name={config.icon} size={16} color={color} />
        </div>
        <div
          className="relative rounded-full transition-all duration-300 flex-shrink-0"
          style={{ width: 42, height: 24, backgroundColor: displayValue ? onColor : 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="absolute top-1 rounded-full bg-white shadow transition-all duration-300"
            style={{ width: 16, height: 16, left: displayValue ? 22 : 4 }}
          />
        </div>
      </div>
      <div className="mt-auto">
        {showLabel && (
          <div className="text-xs text-slate-400 truncate mb-0.5">{label}</div>
        )}
        <div className="text-sm font-bold" style={{ color }}>
          {displayValue ? (config.onLabel ?? 'Aktiv') : (config.offLabel ?? 'Inaktiv')}
        </div>
      </div>
    </div>
  );
};

/* ─── Dash Battery ─── */
interface DashBatteryProps extends BaseProps {
  value: number | null;
  config: DashBatteryConfig;
}

export const DashBattery: React.FC<DashBatteryProps> = ({ value, config, label, style }) => {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const critical = config.criticalThreshold ?? 10;
  const low = config.lowThreshold ?? 20;
  const color = pct <= critical ? '#ef4444' : pct <= low ? '#f59e0b' : (config.color ?? '#22c55e');
  const showLabel = style.showLabel !== false;

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col justify-between"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        {showLabel && <span className="text-xs text-slate-400">{label}</span>}
        <Battery className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 relative h-5 rounded-sm overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: `1px solid ${color}40` }}>
          <div className="h-full rounded-sm transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
        </div>
        <div className="w-1.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
        {config.showPercent !== false && (
          <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color }}>
            {Math.round(pct)}%
          </span>
        )}
      </div>
    </div>
  );
};

/* ─── Dash Signal ─── */
interface DashSignalProps extends BaseProps {
  value: number | null;
  config: DashSignalConfig;
}

export const DashSignal: React.FC<DashSignalProps> = ({ value, config, label, style }) => {
  const maxBars = config.maxBars ?? 5;
  const numVal = value ?? 0;
  const color = config.color ?? '#3b82f6';
  const showLabel = style.showLabel !== false;

  const activeBars = Math.round((Math.max(0, Math.min(100, numVal)) / 100) * maxBars);

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col justify-between"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        {showLabel && <span className="text-xs text-slate-400 truncate">{label}</span>}
        <Wifi className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex items-end gap-1 mt-auto">
        {Array.from({ length: maxBars }).map((_, i) => {
          const active = i < activeBars;
          const height = 8 + (i / (maxBars - 1)) * 20;
          return (
            <div key={i} className="flex-1 rounded-sm transition-all duration-300"
              style={{ height, backgroundColor: active ? color : 'rgba(255,255,255,0.1)', boxShadow: active ? `0 0 4px ${color}60` : 'none' }} />
          );
        })}
        {config.showValue && (
          <span className="text-xs text-slate-400 ml-2 mb-0.5">{Math.round(numVal)}{config.unit}</span>
        )}
      </div>
    </div>
  );
};

/* ─── Dash Sparkline ─── */
interface DashSparklineProps extends BaseProps {
  value: number | null;
  config: DashSparklineConfig;
}

export const DashSparkline: React.FC<DashSparklineProps> = ({ value, config, label, style }) => {
  const historyRef = useRef<number[]>([]);
  const maxLen = config.historyLength ?? 20;
  const color = config.color ?? '#3b82f6';
  const showLabel = style.showLabel !== false;

  useEffect(() => {
    if (value !== null && value !== undefined) {
      historyRef.current = [...historyRef.current.slice(-(maxLen - 1)), value as number];
    }
  }, [value, maxLen]);

  const history = historyRef.current;
  const numVal = value ?? 0;
  const decimals = config.decimals ?? 1;

  const svgW = 160, svgH = 40;
  let pathD = '', fillD = '';
  if (history.length >= 2) {
    const minV = config.min ?? Math.min(...history);
    const maxV = config.max ?? Math.max(...history);
    const range = maxV - minV || 1;
    const pts = history.map((v, i) => ({
      x: (i / (history.length - 1)) * svgW,
      y: svgH - ((v - minV) / range) * svgH
    }));
    pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    fillD = `${pathD} L${svgW},${svgH} L0,${svgH} Z`;
  }

  const displayVal = value !== null ? numVal.toFixed(decimals) : '—';

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-start justify-between mb-1">
        {showLabel && <span className="text-xs text-slate-400 truncate">{label}</span>}
        {config.showValue && (
          <span className="text-lg font-bold tabular-nums" style={{ color }}>{displayVal}{config.unit ? ` ${config.unit}` : ''}</span>
        )}
      </div>
      <div className="flex-1 flex items-end">
        <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
          {config.fillArea && fillD && (
            <path d={fillD} fill={`${color}18`} />
          )}
          {pathD && (
            <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color}80)` }} />
          )}
        </svg>
      </div>
    </div>
  );
};

/* ─── Dash Multivalue ─── */
interface DashMultivalueProps extends BaseProps {
  value: number | string | null;
  config: DashMultivalueConfig;
  allValues?: Record<string, unknown>;
  nodeId?: string;
}

export const DashMultivalue: React.FC<DashMultivalueProps> = ({ value, config, label, style }) => {
  const items = config.items ?? [];
  const showLabel = style.showLabel !== false;

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {showLabel && <span className="text-xs text-slate-400 mb-2">{label}</span>}
      <div className="flex-1 grid grid-cols-3 gap-1">
        {items.map((item, i) => {
          const v = i === 0 ? value : null;
          const disp = v !== null ? (typeof v === 'number' ? v.toFixed(item.decimals ?? 1) : String(v)) : '—';
          return (
            <div key={i} className="flex flex-col items-center justify-center rounded-lg p-1"
              style={{ backgroundColor: `${item.color ?? '#3b82f6'}10` }}>
              <span className="text-[9px] text-slate-500 truncate w-full text-center">{item.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: item.color ?? '#3b82f6' }}>{disp}</span>
              {item.unit && <span className="text-[8px] text-slate-500">{item.unit}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Dash Heatbar ─── */
interface DashHeatbarProps extends BaseProps {
  value: number | null;
  config: DashHeatbarConfig;
}

export const DashHeatbar: React.FC<DashHeatbarProps> = ({ value, config, label, style }) => {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const numVal = Math.max(min, Math.min(max, value ?? min));
  const pct = ((numVal - min) / (max - min)) * 100;
  const showLabel = style.showLabel !== false;
  const lowColor = config.lowColor ?? '#3b82f6';
  const midColor = config.midColor ?? '#f59e0b';
  const highColor = config.highColor ?? '#ef4444';

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col justify-between"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        {showLabel && <span className="text-xs text-slate-400 truncate">{label}</span>}
        {config.showValue && (
          <span className="text-sm font-bold tabular-nums" style={{ color: pct < 33 ? lowColor : pct < 66 ? midColor : highColor }}>
            {value !== null ? numVal.toFixed(config.decimals ?? 0) : '—'}{config.unit ? ` ${config.unit}` : ''}
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="h-4 rounded-full overflow-hidden relative" style={{ background: `linear-gradient(to right, ${lowColor}, ${midColor}, ${highColor})`, opacity: 0.3 }}>
          <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, ${lowColor}, ${midColor}, ${highColor})`, clipPath: `inset(0 ${100 - pct}% 0 0 round 999px)`, opacity: 3.33 }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
          <span>{min}{config.unit}</span>
          <span>{max}{config.unit}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Dash Compass ─── */
interface DashCompassProps extends BaseProps {
  value: number | null;
  config: DashCompassConfig;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function getCardinal(deg: number): string {
  return CARDINALS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export const DashCompass: React.FC<DashCompassProps> = ({ value, config, label, style }) => {
  const deg = ((value ?? 0) % 360 + 360) % 360;
  const color = config.color ?? '#3b82f6';
  const showLabel = style.showLabel !== false;
  const r = 42;
  const cx = 50, cy = 50;

  const arrowX = cx + r * 0.6 * Math.sin((deg * Math.PI) / 180);
  const arrowY = cy - r * 0.6 * Math.cos((deg * Math.PI) / 180);
  const tailX = cx - r * 0.3 * Math.sin((deg * Math.PI) / 180);
  const tailY = cy + r * 0.3 * Math.cos((deg * Math.PI) / 180);

  return (
    <div className="w-full h-full rounded-xl p-2 flex flex-col items-center"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {showLabel && <span className="text-xs text-slate-400 mb-1">{label}</span>}
      <svg viewBox="0 0 100 100" className="flex-1" style={{ maxHeight: 90 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />
        {['N', 'E', 'S', 'W'].map((d, i) => {
          const a = i * 90 * Math.PI / 180;
          const tx = cx + (r + 7) * Math.sin(a);
          const ty = cy - (r + 7) * Math.cos(a);
          return <text key={d} x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="rgba(255,255,255,0.4)" fontWeight="bold">{d}</text>;
        })}
        <line x1={tailX} y1={tailY} x2={arrowX} y2={arrowY} stroke={color} strokeWidth={2.5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        <circle cx={arrowX} cy={arrowY} r={2} fill={color} />
        <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.2)" />
      </svg>
      {config.showDegrees && (
        <div className="flex gap-2 items-center text-xs mt-1">
          {config.showCardinal && <span className="font-bold" style={{ color }}>{getCardinal(deg)}</span>}
          <span className="text-slate-400 tabular-nums">{Math.round(deg)}°</span>
        </div>
      )}
    </div>
  );
};

/* ─── Dash Clock ─── */
interface DashClockProps extends BaseProps {
  config: DashClockConfig;
}

export const DashClock: React.FC<DashClockProps> = ({ config, label, style }) => {
  const [now, setNow] = useState(new Date());
  const color = config.color ?? '#3b82f6';
  const showLabel = style.showLabel !== false;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = config.format24h !== false ? now.getHours() : (now.getHours() % 12 || 12);
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  const suffix = !config.format24h ? (now.getHours() >= 12 ? ' PM' : ' AM') : '';
  const timeStr = config.showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col justify-center items-center"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {showLabel && <span className="text-xs text-slate-400 mb-1">{label}</span>}
      <div className="font-mono font-black tabular-nums" style={{ color, fontSize: 28, letterSpacing: 2, textShadow: `0 0 20px ${color}60` }}>
        {timeStr}{suffix}
      </div>
      {config.showDate && (
        <div className="text-xs text-slate-400 mt-1">{dateStr}</div>
      )}
    </div>
  );
};

/* ─── Dash Rating ─── */
interface DashRatingProps extends BaseProps {
  value: number | null;
  config: DashRatingConfig;
}

export const DashRating: React.FC<DashRatingProps> = ({ value, config, label, style }) => {
  const max = config.max ?? 5;
  const color = config.color ?? '#f59e0b';
  const numVal = Math.max(0, Math.min(max, value ?? 0));
  const showLabel = style.showLabel !== false;

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col justify-center"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-2">
        {showLabel && <span className="text-xs text-slate-400">{label}</span>}
        {config.showValue && <span className="text-sm font-bold tabular-nums" style={{ color }}>{numVal.toFixed(1)}</span>}
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => {
          const filled = i < Math.floor(numVal);
          const half = !filled && i < numVal;
          return (
            <Star key={i} className="w-5 h-5 flex-shrink-0 transition-all duration-300"
              style={{ color: filled || half ? color : 'rgba(255,255,255,0.12)', fill: filled ? color : half ? `${color}60` : 'none', filter: filled ? `drop-shadow(0 0 4px ${color}80)` : 'none' }} />
          );
        })}
      </div>
    </div>
  );
};

/* ─── Dash Level ─── */
interface DashLevelProps extends BaseProps {
  value: number | null;
  config: DashLevelConfig;
}

export const DashLevel: React.FC<DashLevelProps> = ({ value, config, label, style }) => {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const numVal = Math.max(min, Math.min(max, value ?? min));
  const pct = ((numVal - min) / (max - min)) * 100;
  const warning = config.warningZone ?? 70;
  const danger = config.dangerZone ?? 90;
  const isVertical = config.orientation === 'vertical';
  const color = pct >= danger ? '#ef4444' : pct >= warning ? '#f59e0b' : (config.color ?? '#3b82f6');
  const showLabel = style.showLabel !== false;

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col justify-between"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        {showLabel && <span className="text-xs text-slate-400 truncate">{label}</span>}
        <AlignLeft className="w-3.5 h-3.5 text-slate-500" />
      </div>
      {config.showValue && (
        <div className="text-xl font-bold tabular-nums my-1" style={{ color }}>
          {value !== null ? numVal.toFixed(config.decimals ?? 0) : '—'}<span className="text-xs font-normal text-slate-400 ml-1">{config.unit}</span>
        </div>
      )}
      {!isVertical ? (
        <div>
          <div className="h-3 rounded-full overflow-hidden relative" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
            {warning < 100 && (
              <div className="absolute top-0 bottom-0 w-px" style={{ left: `${((warning - min) / (max - min)) * 100}%`, backgroundColor: '#f59e0b80' }} />
            )}
            {danger < 100 && (
              <div className="absolute top-0 bottom-0 w-px" style={{ left: `${((danger - min) / (max - min)) * 100}%`, backgroundColor: '#ef444480' }} />
            )}
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
            <span>{min}</span><span>{max}</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-end">
          <div className="w-full flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => {
              const threshold = (i / 10) * 100;
              const segActive = pct >= threshold;
              const segColor = threshold >= danger ? '#ef4444' : threshold >= warning ? '#f59e0b' : (config.color ?? '#3b82f6');
              return <div key={i} className="flex-1 rounded-sm transition-all duration-300" style={{ height: 8, backgroundColor: segActive ? segColor : 'rgba(255,255,255,0.08)' }} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Dash Wind ─── */
interface DashWindProps extends BaseProps {
  value: number | null;
  config: DashWindConfig;
}

export const DashWind: React.FC<DashWindProps> = ({ value, config, label, style }) => {
  const speed = value ?? 0;
  const color = config.color ?? '#06b6d4';
  const showLabel = style.showLabel !== false;
  const maxSpeed = 120;
  const pct = Math.min(100, (speed / maxSpeed) * 100);

  const beaufortScale = speed <= 1 ? 0 : speed <= 5 ? 1 : speed <= 11 ? 2 : speed <= 19 ? 3 : speed <= 28 ? 4 : speed <= 38 ? 5 : speed <= 49 ? 6 : speed <= 61 ? 7 : speed <= 74 ? 8 : speed <= 88 ? 9 : speed <= 102 ? 10 : speed <= 117 ? 11 : 12;
  const beaufortNames = ['Windstille', 'Leiser Zug', 'Leichte Brise', 'Schwacher Wind', 'Maessig', 'Frisch', 'Stark', 'Steif', 'Stuerisch', 'Sturm', 'Schwerer Sturm', 'Orkanartiger', 'Orkan'];

  return (
    <div className="w-full h-full rounded-xl p-3 flex flex-col"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-2">
        {showLabel && <span className="text-xs text-slate-400 truncate">{label}</span>}
        <Wind className="w-4 h-4" style={{ color }} />
      </div>
      {config.showSpeed && (
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-2xl font-black tabular-nums" style={{ color, textShadow: `0 0 15px ${color}60` }}>{speed.toFixed(1)}</span>
          <span className="text-xs text-slate-400">{config.speedUnit ?? 'km/h'}</span>
        </div>
      )}
      <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 truncate">{beaufortNames[beaufortScale]}</span>
        <span className="text-[10px] text-slate-500">Bft {beaufortScale}</span>
      </div>
    </div>
  );
};

/* ─── Dash Multistate ─── */
interface DashMultistateProps extends BaseProps {
  value: number | string | null;
  onChange: (v: number | string) => void;
  config: DashMultistateConfig;
  disabled?: boolean;
}

export const DashMultistate: React.FC<DashMultistateProps> = ({ value, onChange, config, label, style, disabled }) => {
  const options = config.options ?? [];
  const showLabel = style.showLabel !== false;
  const activeColor = config.activeColor ?? '#3b82f6';
  const currentOption = options.find(o => String(o.value) === String(value));

  return (
    <div
      className="w-full h-full rounded-xl p-3 flex flex-col"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        {showLabel && <span className="text-xs font-medium text-slate-400 truncate">{label}</span>}
        {currentOption && (
          <span className="text-xs font-bold truncate ml-2" style={{ color: currentOption.color ?? activeColor }}>
            {currentOption.label}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1 flex-1 content-center">
        {options.map((opt) => {
          const isActive = String(opt.value) === String(value);
          const btnColor = opt.color ?? activeColor;
          return (
            <button
              key={String(opt.value)}
              disabled={disabled}
              onClick={() => !disabled && onChange(opt.value as number | string)}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none"
              style={{
                backgroundColor: isActive ? btnColor : 'rgba(255,255,255,0.05)',
                color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
                border: isActive ? `1px solid ${btnColor}60` : '1px solid rgba(255,255,255,0.07)',
                boxShadow: isActive ? `0 0 10px ${btnColor}40` : 'none',
                opacity: disabled ? 0.5 : 1,
                backdropFilter: 'blur(4px)'
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
