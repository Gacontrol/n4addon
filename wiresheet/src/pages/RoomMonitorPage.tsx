import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Thermometer, Wind, Droplets, Activity,
  Users, AlertTriangle, Zap, TrendingUp, TrendingDown, Minus,
  Clock, RefreshCw, ChevronRight, Box, LayoutDashboard,
  Gauge, Fan, Plug, Lightbulb, Bell, Snowflake, Flame,
  Hash, SlidersHorizontal, ToggleLeft, BarChart2, Tag, CircleDot, Eye,
} from 'lucide-react';
import { DataPoint, DataPointCategory, RoomMonitorConfig, RoomDataPointConfig, WidgetType } from '../types/bms';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';
import type { Room } from '../types/building';

function generateMockDataPoints(room: Room): DataPoint[] {
  const base = room.id.charCodeAt(room.id.length - 1) || 42;
  const rand = (seed: number) => ((seed * 9301 + 49297) % 233280) / 233280;

  const bindings = room.bindings ?? [];
  if (bindings.length > 0) {
    return bindings.map((b, i): DataPoint => ({
      id: b.id,
      name: b.datapoint,
      label: b.label ?? b.datapoint,
      category: b.category as DataPointCategory,
      unit: b.unit ?? '',
      currentValue: rand(base + i) * 30 + 15,
      formattedValue: `${(rand(base + i) * 30 + 15).toFixed(1)} ${b.unit ?? ''}`,
      status: rand(base + i) > 0.85 ? 'alarm' : rand(base + i) > 0.7 ? 'warning' : 'ok',
      trend: rand(base + i) > 0.6 ? 'up' : rand(base + i) > 0.3 ? 'down' : 'stable',
      writable: b.writable ?? false,
      quality: 'good',
      lastUpdate: Date.now() - Math.floor(rand(base + i) * 60000),
      historicValues: Array.from({ length: 20 }, (_, j) => ({
        ts: Date.now() - (20 - j) * 60000,
        value: rand(base + i + j) * 5 + 20,
      })),
    }));
  }

  const defaults: { label: string; category: DataPointCategory; unit: string; value: number; writable: boolean }[] = [
    { label: 'Raumtemperatur', category: 'temperature', unit: '°C', value: 20 + rand(base) * 8, writable: false },
    { label: 'Sollwert Heizung', category: 'setpoint', unit: '°C', value: 21 + rand(base + 1) * 2, writable: true },
    { label: 'Relative Luftfeuchte', category: 'humidity', unit: '%', value: 40 + rand(base + 2) * 25, writable: false },
    { label: 'CO₂-Konzentration', category: 'co2', unit: 'ppm', value: 400 + rand(base + 3) * 800, writable: false },
    { label: 'Zuluft', category: 'airflow', unit: 'm³/h', value: rand(base + 4) * 350, writable: false },
    { label: 'Belegung', category: 'occupancy', unit: '', value: rand(base + 5) > 0.5 ? 1 : 0, writable: false },
    { label: 'Energieverbrauch', category: 'energy', unit: 'W', value: rand(base + 6) * 1200, writable: false },
  ];

  return defaults.map((d, i): DataPoint => ({
    id: `mock-${room.id}-${i}`,
    name: d.label,
    label: d.label,
    category: d.category,
    unit: d.unit,
    currentValue: d.value,
    formattedValue: d.unit ? `${d.value.toFixed(1)} ${d.unit}` : d.value > 0.5 ? 'Belegt' : 'Frei',
    status: d.value > 1200 || d.value > 1100 ? 'alarm' : d.value > 900 || d.value > 40 ? 'warning' : 'ok',
    trend: rand(base + i) > 0.6 ? 'up' : rand(base + i) > 0.3 ? 'down' : 'stable',
    writable: d.writable,
    quality: 'good',
    lastUpdate: Date.now() - Math.floor(rand(base + i) * 120000),
    historicValues: Array.from({ length: 20 }, (_, j) => ({
      ts: Date.now() - (20 - j) * 300000,
      value: d.value + (rand(base + i + j) - 0.5) * 5,
    })),
  }));
}

const CATEGORY_ICONS: Record<DataPointCategory, React.ReactNode> = {
  temperature: <Thermometer size={16} />,
  humidity: <Droplets size={16} />,
  co2: <Activity size={16} />,
  airflow: <Wind size={16} />,
  pressure: <Activity size={16} />,
  occupancy: <Users size={16} />,
  alarm: <AlertTriangle size={16} />,
  mode: <RefreshCw size={16} />,
  setpoint: <Settings size={16} />,
  energy: <Zap size={16} />,
  valvePosition: <Activity size={16} />,
  fanSpeed: <Wind size={16} />,
  vavFlow: <Wind size={16} />,
  windowState: <Box size={16} />,
  comfortIndex: <Activity size={16} />,
  generic: <Activity size={16} />,
};

const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  alarm: '#ef4444',
  offline: '#64748b',
  unknown: '#64748b',
};

const CAT_COLORS_MONITOR: Record<string, string> = {
  temperature: '#ef4444', setpoint: '#f97316', humidity: '#06b6d4', co2: '#a78bfa',
  airflow: '#0ea5e9', occupancy: '#10b981', alarm: '#ef4444', energy: '#f59e0b',
  valvePosition: '#14b8a6', fanSpeed: '#6366f1', mode: '#8b5cf6', generic: '#64748b',
};

// ---- Custom Panel live rendering ----

function mockLiveVal(cat: string, unit?: string) {
  const r = ((cat.charCodeAt(0) * 9301 + 49297) % 233280) / 233280;
  const u = unit ?? '';
  switch (cat) {
    case 'temperature': return { v: (19 + r * 8).toFixed(1), u: u || '°C', n: 19 + r * 8, s: r > 0.85 ? 'alarm' : r > 0.7 ? 'warning' : 'ok' };
    case 'setpoint':    return { v: (20 + r * 3).toFixed(1), u: u || '°C', n: 20 + r * 3, s: 'ok' };
    case 'humidity':    return { v: (35 + r * 35).toFixed(0), u: u || '%', n: 35 + r * 35, s: r > 0.85 ? 'warning' : 'ok' };
    case 'co2':         return { v: (400 + r * 800).toFixed(0), u: u || 'ppm', n: 400 + r * 800, s: r > 0.7 ? 'warning' : 'ok' };
    case 'airflow':     return { v: (r * 400).toFixed(0), u: u || 'm³/h', n: r * 400, s: 'ok' };
    case 'occupancy':   return { v: r > 0.5 ? 'Belegt' : 'Frei', u: '', n: r > 0.5 ? 1 : 0, s: 'ok' };
    case 'alarm':       return { v: r > 0.8 ? 'Alarm' : 'OK', u: '', n: r > 0.8 ? 1 : 0, s: r > 0.8 ? 'alarm' : 'ok' };
    case 'energy':      return { v: (r * 1200).toFixed(0), u: u || 'W', n: r * 1200, s: 'ok' };
    default:            return { v: (r * 100).toFixed(1), u, n: r * 100, s: 'ok' };
  }
}

const MONITOR_CAT_ICONS: Record<string, React.ReactNode> = {
  temperature: <Thermometer size={13} />, humidity: <Droplets size={13} />,
  co2: <Wind size={13} />, airflow: <Wind size={13} />, pressure: <Activity size={13} />,
  occupancy: <Users size={13} />, alarm: <AlertTriangle size={13} />, mode: <RefreshCw size={13} />,
  setpoint: <Gauge size={13} />, energy: <Zap size={13} />, valvePosition: <Activity size={13} />,
  fanSpeed: <Fan size={13} />, light: <Lightbulb size={13} />, pump: <Plug size={13} />,
  cold: <Snowflake size={13} />, bell: <Bell size={13} />, fire: <Flame size={13} />,
  generic: <Activity size={13} />,
};

function LiveWidget({ cfg, accent }: { cfg: RoomDataPointConfig; accent: string }) {
  const cat = cfg.category ?? 'generic';
  const m = mockLiveVal(cat, cfg.unit);
  const icon = MONITOR_CAT_ICONS[cat] ?? MONITOR_CAT_ICONS.generic;
  const cc = CAT_COLORS_MONITOR[cat] ?? '#64748b';
  const sc = STATUS_COLORS[m.s] ?? '#64748b';
  const min = cfg.minValue ?? 0;
  const max = cfg.maxValue ?? 100;
  const pct = Math.min(100, Math.max(0, ((m.n - min) / (max - min)) * 100));

  const base = 'w-full h-full rounded-xl bg-slate-800/70 border border-slate-700/40';

  switch (cfg.widgetType as WidgetType) {
    case 'slider':
      return (
        <div className={base}>
          <div className="h-full flex flex-col justify-between p-3">
            <div className="flex items-center gap-2">
              <span style={{ color: cc }}>{icon}</span>
              <span className="text-xs text-slate-300 truncate flex-1">{cfg.label}</span>
              <span className="text-sm font-bold text-white shrink-0">{m.v} <span className="text-xs font-normal text-slate-400">{m.u}</span></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500">{min}</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden relative">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
                </div>
                <span className="text-[9px] text-slate-500">{max}</span>
              </div>
              <div className="flex justify-center gap-3 mt-2">
                <button className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-sm flex items-center justify-center transition-colors">−</button>
                <button className="w-7 h-7 rounded-lg text-white font-bold text-sm flex items-center justify-center transition-colors" style={{ background: accent }}>+</button>
              </div>
            </div>
          </div>
        </div>
      );
    case 'incrementer':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-1.5 p-3">
            <span className="text-xs text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <div className="flex items-center gap-3">
              <button className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-lg font-bold flex items-center justify-center transition-colors">−</button>
              <div className="text-center">
                <span className="text-xl font-bold text-white">{m.v}</span>
                <span className="text-xs text-slate-400 ml-1">{m.u}</span>
              </div>
              <button className="w-8 h-8 rounded-xl text-white text-lg font-bold flex items-center justify-center transition-colors" style={{ background: accent }}>+</button>
            </div>
          </div>
        </div>
      );
    case 'gauge':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-1 p-3">
            <span className="text-xs text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <div className="relative w-14 h-14">
              <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth="5" />
                <circle cx="28" cy="28" r="22" fill="none" stroke={accent} strokeWidth="5"
                  strokeDasharray={`${2 * Math.PI * 22 * pct / 100} ${2 * Math.PI * 22}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center rotate-90">
                <span className="text-xs font-bold text-white">{m.v}</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">{m.u}</span>
          </div>
        </div>
      );
    case 'badge':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-1.5 p-3">
            <span style={{ color: cc }}>{icon}</span>
            <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ background: `${sc}22`, color: sc }}>{m.v}</span>
            <span className="text-[10px] text-slate-500 text-center truncate">{cfg.label}</span>
          </div>
        </div>
      );
    case 'switch':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-2 p-3">
            <span className="text-xs text-slate-300">{cfg.label}</span>
            <button className="w-12 h-6 rounded-full flex items-center px-1 transition-colors" style={{ background: accent }}>
              <div className="w-5 h-5 bg-white rounded-full ml-auto shadow-sm" />
            </button>
            <span className="text-[10px] text-slate-400">EIN</span>
          </div>
        </div>
      );
    case 'chart':
      return (
        <div className={base}>
          <div className="h-full flex flex-col justify-between p-3">
            <div className="flex items-center gap-2">
              <span style={{ color: cc }}>{icon}</span>
              <span className="text-xs text-slate-300 flex-1 truncate">{cfg.label}</span>
              <span className="text-sm font-bold text-white shrink-0">{m.v} {m.u}</span>
            </div>
            <svg viewBox="0 0 80 24" className="w-full" preserveAspectRatio="none">
              {[.4,.6,.5,.7,.45,.8,.6,.75,.65,.55].map((v, i, a) =>
                i < a.length - 1 ? (
                  <line key={i}
                    x1={(i / (a.length - 1)) * 80} y1={24 - v * 22}
                    x2={((i + 1) / (a.length - 1)) * 80} y2={24 - (a[i + 1]) * 22}
                    stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
                ) : null
              )}
            </svg>
          </div>
        </div>
      );
    case 'row':
      return (
        <div className={base}>
          <div className="h-full flex items-center gap-3 px-3">
            <span style={{ color: cc }} className="shrink-0">{icon}</span>
            <span className="text-sm text-slate-200 flex-1 truncate">{cfg.label}</span>
            <span className="text-sm font-bold text-white shrink-0">{m.v} {m.u}</span>
          </div>
        </div>
      );
    case 'label':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-0.5 p-3">
            <span style={{ color: cc }}>{icon}</span>
            <span className="text-2xl font-bold text-white leading-none">{m.v}</span>
            <span className="text-xs text-slate-400">{m.u}</span>
            <span className="text-[10px] text-slate-500 truncate">{cfg.label}</span>
          </div>
        </div>
      );
    default: // kpi
      return (
        <div className={base}>
          <div className="h-full flex flex-col justify-between p-3">
            <div className="flex items-center gap-2">
              <span style={{ color: cc }}>{icon}</span>
              <span className="text-xs text-slate-400 truncate">{cfg.label}</span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-2xl font-bold leading-none" style={{ color: sc }}>{m.v}</span>
              {m.u && <span className="text-sm text-slate-400 pb-0.5">{m.u}</span>}
            </div>
          </div>
        </div>
      );
  }
}

const PANEL_CW = 152;
const PANEL_CH = 92;
const PANEL_GAP = 8;
const PANEL_COLS = 4;

function CustomPanel({ config, accent, roomColor, onConfigure }: {
  config: RoomMonitorConfig;
  accent: string;
  roomColor: string;
  onConfigure: () => void;
}) {
  const widgets = config.datapoints.filter(w => w.showInMonitor !== false);
  const title = config.panelTitle;
  const subtitle = config.panelSubtitle;

  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-600 text-sm gap-2">
        <LayoutDashboard size={28} className="opacity-30" />
        <p>Kein Panel konfiguriert.</p>
        <button onClick={onConfigure} className="mt-2 px-4 py-1.5 bg-sky-700 hover:bg-sky-600 rounded-lg text-white text-xs transition-colors">
          Panel konfigurieren
        </button>
      </div>
    );
  }

  const maxCol = Math.max(...widgets.map(w => (w.panelCol ?? 0) + (w.panelW ?? 1)));
  const maxRow = Math.max(...widgets.map(w => (w.panelRow ?? 0) + (w.panelH ?? 1)));
  const cols = Math.max(maxCol, PANEL_COLS);
  const panelW = cols * (PANEL_CW + PANEL_GAP) + PANEL_GAP;
  const panelH = maxRow * (PANEL_CH + PANEL_GAP) + PANEL_GAP;

  return (
    <div className="p-4 flex flex-col items-center">
      {/* Panel header */}
      {(title || subtitle) && (
        <div className="w-full mb-3" style={{ maxWidth: panelW }}>
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2.5 border border-slate-700/40">
            <div className="w-1 h-8 rounded-full shrink-0" style={{ background: accent }} />
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{title}</p>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', width: panelW, height: panelH }}>
        {widgets.map(w => {
          const col = w.panelCol ?? 0, row = w.panelRow ?? 0;
          const ww = w.panelW ?? 1, wh = w.panelH ?? 1;
          return (
            <div
              key={w.datapointId}
              style={{
                position: 'absolute',
                left: PANEL_GAP + col * (PANEL_CW + PANEL_GAP),
                top: PANEL_GAP + row * (PANEL_CH + PANEL_GAP),
                width: ww * PANEL_CW + (ww - 1) * PANEL_GAP,
                height: wh * PANEL_CH + (wh - 1) * PANEL_GAP,
              }}
            >
              <LiveWidget cfg={w} accent={accent} />
            </div>
          );
        })}
      </div>

      <button onClick={onConfigure}
        className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
        <Settings size={10} /> Panel bearbeiten
      </button>
    </div>
  );
}

function TrendIcon({ trend }: { trend?: string }) {
  if (trend === 'up') return <TrendingUp size={12} className="text-red-400" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-sky-400" />;
  return <Minus size={12} className="text-slate-500" />;
}

function MiniChart({ values }: { values: { ts: number; value: number }[] }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values.map(v => v.value));
  const max = Math.max(...values.map(v => v.value));
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v.value - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
    </svg>
  );
}

function KPICard({ dp }: { dp: DataPoint }) {
  return (
    <div className={[
      'bg-slate-800 border rounded-xl p-4 flex flex-col gap-2',
      dp.status === 'alarm' ? 'border-red-500/50' : dp.status === 'warning' ? 'border-amber-500/30' : 'border-slate-700',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: STATUS_COLORS[dp.status] }}>{CATEGORY_ICONS[dp.category]}</span>
          <span className="text-xs text-slate-400">{dp.label}</span>
        </div>
        <TrendIcon trend={dp.trend} />
      </div>
      <div>
        <span className="text-2xl font-bold text-white">
          {typeof dp.currentValue === 'number' ? dp.currentValue.toFixed(1) : dp.formattedValue}
        </span>
        {dp.unit && <span className="text-slate-400 ml-1 text-sm">{dp.unit}</span>}
      </div>
      <div className="flex items-center justify-between">
        {dp.historicValues && <MiniChart values={dp.historicValues} />}
        <div className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: STATUS_COLORS[dp.status] }} />
      </div>
    </div>
  );
}

function PointRow({ dp, onWrite }: { dp: DataPoint; onWrite?: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(
    typeof dp.currentValue === 'number' ? String(dp.currentValue.toFixed(1)) : ''
  );

  return (
    <div className={[
      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
      dp.status === 'alarm' ? 'border-red-500/30 bg-red-950/10' : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800',
    ].join(' ')}>
      <span style={{ color: STATUS_COLORS[dp.status] }} className="shrink-0">
        {CATEGORY_ICONS[dp.category]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium truncate">{dp.label}</p>
        {dp.status === 'alarm' && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle size={10} /> Grenzwert überschritten
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <TrendIcon trend={dp.trend} />
        {dp.writable && !editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-white hover:text-sky-300 transition-colors"
          >
            {dp.formattedValue}
          </button>
        ) : dp.writable && editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="w-16 bg-slate-700 border border-sky-500 rounded px-1.5 py-0.5 text-sm text-white focus:outline-none"
              autoFocus
            />
            <span className="text-xs text-slate-400">{dp.unit}</span>
            <button onClick={() => { onWrite?.(parseFloat(inputVal)); setEditing(false); }}
              className="p-1 rounded hover:bg-sky-600 text-sky-400">
              <ChevronRight size={12} />
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold text-white">{dp.formattedValue}</span>
        )}
        {dp.quality === 'bad' && <span className="w-2 h-2 rounded-full bg-red-500" />}
        {dp.lastUpdate && (
          <span className="text-xs text-slate-500 hidden lg:block">
            {Math.round((Date.now() - dp.lastUpdate) / 1000)}s
          </span>
        )}
      </div>
    </div>
  );
}

interface RoomMonitorPageProps {
  buildingId?: string;
  roomId?: string;
  onBack?: () => void;
  onOpenConfig?: () => void;
  /** When true, renders as a floating side panel instead of a full page */
  asPanel?: boolean;
}

export function RoomMonitorPage({ buildingId: propBuildingId, roomId: propRoomId, onBack, onOpenConfig, asPanel }: RoomMonitorPageProps) {
  const params = useParams<{ buildingId: string; roomId: string }>();
  const navigate = useNavigate();
  const buildingId = propBuildingId ?? params.buildingId;
  const roomId = propRoomId ?? params.roomId;
  const handleBack = onBack ?? (() => navigate(`/building/${buildingId}/monitor`));
  const handleOpenConfig = onOpenConfig ?? (() => navigate(`/building/${buildingId}/room/${roomId}/config`));
  const hasCustomPanel = !!(roomId && monitorConfigs[roomId]?.datapoints?.length);
  const [activeTab, setActiveTab] = useState<'panel' | 'overview' | 'points' | 'alarms' | 'trends'>(hasCustomPanel ? 'panel' : 'overview');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const { buildings, monitorConfigs } = useBuildingContext();

  const building = buildings.find(b => b.id === buildingId);
  const { floor, room } = useMemo(() => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === roomId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, roomId]);
  const roomConfig: RoomMonitorConfig | undefined = roomId ? monitorConfigs[roomId] : undefined;

  const dataPoints = useMemo(() => {
    if (!room) return [];
    const all = generateMockDataPoints(room);
    if (!roomConfig || roomConfig.datapoints.length === 0) return all;
    // Apply config: filter, reorder, override writable
    const visible = roomConfig.datapoints
      .filter(cfg => cfg.showInMonitor)
      .sort((a, b) => a.order - b.order);
    const result: DataPoint[] = [];
    for (const cfg of visible) {
      const dp = all.find(d => d.id === cfg.datapointId || d.name === cfg.label || d.category === cfg.datapointId.split('-').pop());
      if (dp) {
        result.push({ ...dp, label: cfg.label, writable: cfg.writable });
      }
    }
    return result.length > 0 ? result : all;
  }, [room, lastRefresh, roomConfig]);

  const alarms = dataPoints.filter(dp => dp.status === 'alarm');
  const primaryKPIs = dataPoints.slice(0, 6);

  if (!building || !room || !floor) {
    if (asPanel) return null;
    return (
      <div className="flex h-screen bg-slate-950 text-slate-200 items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Raum nicht gefunden</p>
          <button onClick={handleBack} className="px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition-colors">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (asPanel) {
    return (
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-[min(640px,48vw)] h-[min(88vh,900px)] flex flex-col pointer-events-none">
        <div className="relative flex flex-col h-full w-full bg-slate-950/96 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.7)] pointer-events-auto animate-[slideInRight_.22s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
          {/* Panel header */}
          <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-3 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Breadcrumbs items={[
                { label: building.name, onClick: handleBack, icon: 'building' },
                { label: floor.name, onClick: handleBack, icon: 'floor' },
                { label: room.name, icon: 'room' },
              ]} />
              <button
                onClick={handleBack}
                className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors shrink-0"
              >
                <ArrowLeft size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-white leading-tight truncate">{room.name}</h1>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    {room.number && <span>{room.number}</span>}
                    <span>{floor.name}</span>
                    {alarms.length > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <AlertTriangle size={10} />
                        {alarms.length} Alarm{alarms.length > 1 ? 'e' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setLastRefresh(Date.now())}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                  title="Aktualisieren"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  onClick={handleOpenConfig}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors"
                >
                  <Settings size={12} />
                  Konfigurieren
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/60 px-4 shrink-0">
            {([
              ...(hasCustomPanel ? [{ id: 'panel', label: 'Panel' }] : []),
              { id: 'overview', label: 'Übersicht' },
              { id: 'points', label: `Datenpunkte (${dataPoints.length})` },
              { id: 'alarms', label: `Alarme${alarms.length > 0 ? ` (${alarms.length})` : ''}` },
              { id: 'trends', label: 'Trends' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
                  activeTab === tab.id ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'panel' && roomConfig && (
              <CustomPanel
                config={roomConfig}
                accent={roomConfig.accentColor ?? room.color ?? '#0ea5e9'}
                roomColor={room.color}
                onConfigure={handleOpenConfig}
              />
            )}
            {activeTab === 'overview' && (
              <div className="p-4">
                <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Kennwerte</h2>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {primaryKPIs.map(dp => <KPICard key={dp.id} dp={dp} />)}
                </div>
                {alarms.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={10} className="text-red-400" /> Aktive Alarme
                    </h2>
                    <div className="flex flex-col gap-1.5">
                      {alarms.map(a => (
                        <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                          <AlertTriangle size={12} className="text-red-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-red-200 truncate">{a.label}</p>
                            <p className="text-xs text-red-400/70">{a.formattedValue}</p>
                          </div>
                          <button className="px-2 py-1 rounded bg-red-800/50 hover:bg-red-700/60 text-xs text-red-200 transition-colors shrink-0">Quittieren</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Alle Werte</h2>
                <div className="flex flex-col gap-1">
                  {dataPoints.map(dp => <PointRow key={dp.id} dp={dp} />)}
                </div>
              </div>
            )}
            {activeTab === 'points' && (
              <div className="p-4">
                <div className="flex flex-col gap-1">
                  {dataPoints.map(dp => <PointRow key={dp.id} dp={dp} />)}
                </div>
              </div>
            )}
            {activeTab === 'alarms' && (
              <div className="p-4">
                {alarms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                      <AlertTriangle size={18} className="text-slate-600" />
                    </div>
                    <p className="text-sm">Keine aktiven Alarme</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {alarms.map(a => (
                      <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                        <AlertTriangle size={12} className="text-red-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-red-200">{a.label}</p>
                          <p className="text-xs text-red-400/70 mt-0.5">{a.formattedValue} · {a.name}</p>
                        </div>
                        <button className="px-2 py-1 rounded bg-red-800/50 text-xs text-red-200 shrink-0">Quittieren</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'trends' && (
              <div className="p-4">
                <div className="grid grid-cols-1 gap-3">
                  {dataPoints.filter(dp => dp.historicValues && dp.historicValues.length > 2 && dp.category !== 'occupancy' && dp.category !== 'alarm').map(dp => (
                    <div key={dp.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span style={{ color: STATUS_COLORS[dp.status] }}>{CATEGORY_ICONS[dp.category]}</span>
                          <span className="text-xs font-medium text-slate-200">{dp.label}</span>
                        </div>
                        <span className="text-sm font-bold text-white">{dp.formattedValue}</span>
                      </div>
                      {dp.historicValues && <TrendChartFull values={dp.historicValues} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full-page view — styled like the panel but filling the screen
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Breadcrumbs items={[
            { label: building.name, onClick: handleBack, icon: 'building' },
            { label: floor.name, onClick: handleBack, icon: 'floor' },
            { label: room.name, icon: 'room' },
          ]} />
          <button
            onClick={handleBack}
            className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-4 h-4 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white leading-tight truncate">{room.name}</h1>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                {room.number && <span>{room.number}</span>}
                <span>{floor.name}</span>
                {alarms.length > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertTriangle size={10} />
                    {alarms.length} Alarm{alarms.length > 1 ? 'e' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setLastRefresh(Date.now())}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={handleOpenConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors"
            >
              <Settings size={12} />
              Konfigurieren
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 px-6 shrink-0">
        {([
          ...(hasCustomPanel ? [{ id: 'panel', label: 'Panel' }] : []),
          { id: 'overview', label: 'Übersicht' },
          { id: 'points', label: `Datenpunkte (${dataPoints.length})` },
          { id: 'alarms', label: `Alarme${alarms.length > 0 ? ` (${alarms.length})` : ''}` },
          { id: 'trends', label: 'Trends' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'panel' && roomConfig && (
          <div className="flex justify-center">
            <CustomPanel
              config={roomConfig}
              accent={roomConfig.accentColor ?? room.color ?? '#0ea5e9'}
              roomColor={room.color}
              onConfigure={handleOpenConfig}
            />
          </div>
        )}
        {activeTab === 'overview' && (
          <div className="p-6 max-w-5xl mx-auto">
            <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Kennwerte</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mb-8">
              {primaryKPIs.map(dp => <KPICard key={dp.id} dp={dp} />)}
            </div>

            {alarms.length > 0 && (
              <div className="mb-8">
                <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={10} className="text-red-400" /> Aktive Alarme
                </h2>
                <div className="flex flex-col gap-1.5">
                  {alarms.map(a => (
                    <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                      <AlertTriangle size={12} className="text-red-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-red-200 truncate">{a.label}</p>
                        <p className="text-xs text-red-400/70">{a.formattedValue}</p>
                      </div>
                      <button className="px-2 py-1 rounded bg-red-800/50 hover:bg-red-700/60 text-xs text-red-200 transition-colors shrink-0">Quittieren</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Alle Werte</h2>
            <div className="flex flex-col gap-1">
              {dataPoints.map(dp => <PointRow key={dp.id} dp={dp} />)}
            </div>
          </div>
        )}

        {activeTab === 'points' && (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="flex flex-col gap-1">
              {dataPoints.map(dp => <PointRow key={dp.id} dp={dp} />)}
            </div>
          </div>
        )}

        {activeTab === 'alarms' && (
          <div className="p-6 max-w-3xl mx-auto">
            {alarms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                  <AlertTriangle size={20} className="text-slate-600" />
                </div>
                <p className="text-sm">Keine aktiven Alarme</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {alarms.map(a => (
                  <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-red-200">{a.label}</p>
                      <p className="text-xs text-red-400/70 mt-0.5">
                        {a.formattedValue} · <span className="flex items-center gap-1 inline-flex"><Clock size={9} /> {Math.round((Date.now() - (a.lastUpdate ?? Date.now())) / 1000)}s</span>
                      </p>
                    </div>
                    <button className="px-2 py-1 rounded bg-red-800/50 hover:bg-red-700/60 text-xs text-red-200 transition-colors">Quittieren</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="p-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dataPoints.filter(dp => dp.historicValues && dp.historicValues.length > 2 && dp.category !== 'occupancy' && dp.category !== 'alarm').map(dp => (
                <div key={dp.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: STATUS_COLORS[dp.status] }}>{CATEGORY_ICONS[dp.category]}</span>
                      <span className="text-xs font-medium text-slate-200">{dp.label}</span>
                    </div>
                    <span className="text-base font-bold text-white">{dp.formattedValue}</span>
                  </div>
                  {dp.historicValues && <TrendChartFull values={dp.historicValues} />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendChartFull({ values }: { values: { ts: number; value: number }[] }) {
  const w = 400;
  const h = 80;
  const pad = { t: 8, b: 20, l: 40, r: 8 };
  const min = Math.min(...values.map(v => v.value));
  const max = Math.max(...values.map(v => v.value));
  const range = max - min || 1;
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;

  const pts = values.map((v, i) => {
    const x = pad.l + (i / (values.length - 1)) * chartW;
    const y = pad.t + chartH - ((v.value - min) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = [
    `${pad.l},${pad.t + chartH}`,
    ...values.map((v, i) => {
      const x = pad.l + (i / (values.length - 1)) * chartW;
      const y = pad.t + chartH - ((v.value - min) / range) * chartH;
      return `${x},${y}`;
    }),
    `${pad.l + chartW},${pad.t + chartH}`,
  ].join(' ');

  const tMin = values[0]?.ts;
  const tMax = values[values.length - 1]?.ts;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#area-grad)" />
      <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
      <text x={pad.l - 4} y={pad.t + 4} textAnchor="end" fontSize={9} fill="#475569">{max.toFixed(1)}</text>
      <text x={pad.l - 4} y={pad.t + chartH} textAnchor="end" fontSize={9} fill="#475569">{min.toFixed(1)}</text>
      {tMin && <text x={pad.l} y={h - 4} fontSize={9} fill="#475569">{new Date(tMin).toLocaleTimeString()}</text>}
      {tMax && <text x={pad.l + chartW} y={h - 4} textAnchor="end" fontSize={9} fill="#475569">{new Date(tMax).toLocaleTimeString()}</text>}
    </svg>
  );
}
