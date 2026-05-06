import { useMemo, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Thermometer, Wind, Droplets, Activity,
  Users, AlertTriangle, Zap, Gauge, Flame, Settings2, LayoutGrid,
} from 'lucide-react';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';
import { useRoomDisplayConfig } from '../hooks/useRoomDisplayConfig';
import { DatapointCategory, CATEGORY_LABELS, RoomDatapointDisplay } from '../types/roomDisplay';
import type { RoomDataPointConfig } from '../types/bms';
import type { Room } from '../types/building';

// ---- Write helper ----

function getApiBase(): string {
  const path = window.location.pathname;
  const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
  return m ? `${m[1]}/api` : '/api';
}

async function writeDp(dpKey: string, value: unknown) {
  try {
    await fetch(`${getApiBase()}/visu/write-value`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpKey, value, mode: 'set' }),
    });
  } catch (e) {
    console.warn('[writeDp] error:', e);
  }
}

// ---- Category icons ----

const CATEGORY_ICONS: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidity: Droplets,
  co2: Wind,
  airflow: Wind,
  pressure: Gauge,
  occupancy: Users,
  alarm: AlertTriangle,
  energy: Zap,
  setpoint: Flame,
  mode: Settings2,
  generic: Activity,
};

const CATEGORY_COLORS: Record<string, string> = {
  temperature: '#ef4444',
  humidity: '#06b6d4',
  co2: '#84cc16',
  airflow: '#0ea5e9',
  pressure: '#8b5cf6',
  occupancy: '#10b981',
  alarm: '#ef4444',
  energy: '#f59e0b',
  setpoint: '#f97316',
  mode: '#6366f1',
  generic: '#64748b',
};

// ---- Helpers ----

function fmt(val: unknown, unit?: string): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'Ein' : 'Aus';
  if (typeof val === 'number') {
    const rounded = Math.abs(val) < 10 ? Math.round(val * 10) / 10 : Math.round(val);
    return unit ? `${rounded} ${unit}` : String(rounded);
  }
  return unit ? `${String(val)} ${unit}` : String(val);
}

function getLiveKey(dp: RoomDataPointConfig): string {
  return dp.sourceDatapoint || dp.datapointId;
}

function resolveLiveValue(dp: RoomDataPointConfig, liveValues: Record<string, unknown>): unknown {
  const key = getLiveKey(dp);
  if (liveValues[key] !== undefined) return liveValues[key];
  // Fall back: strip port suffix (e.g. "node-123:loadvisu" → "node-123")
  const colonIdx = key.indexOf(':');
  if (colonIdx !== -1) {
    const nodeId = key.slice(0, colonIdx);
    if (liveValues[nodeId] !== undefined) return liveValues[nodeId];
  }
  return undefined;
}

function isAlarmValue(val: unknown, cat?: string): boolean {
  if (cat === 'alarm' && (val === true || val === 1 || val === '1')) return true;
  return false;
}

const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e',
  alarm: '#ef4444',
  offline: '#475569',
};

// ---- KPI Card (from monitorConfigs) ----

function KPICard({ dp, val }: { dp: RoomDataPointConfig; val: unknown }) {
  const Icon = CATEGORY_ICONS[dp.category ?? 'generic'] ?? Activity;
  const catColor = CATEGORY_COLORS[dp.category ?? 'generic'] ?? '#64748b';
  const alarm = isAlarmValue(val, dp.category);

  return (
    <div className={[
      'rounded-xl border p-3 flex flex-col gap-2 transition-colors',
      alarm ? 'border-red-500/40 bg-red-950/10' : 'border-slate-700/60 bg-slate-800/50',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4" style={{ color: catColor }} />
        <span className="text-[9px] uppercase tracking-wider text-slate-500">
          {CATEGORY_LABELS[dp.category as DatapointCategory] ?? dp.category ?? 'Allgemein'}
        </span>
      </div>
      <span className={`text-xl font-bold leading-none ${alarm ? 'text-red-400' : 'text-white'}`}>
        {fmt(val, dp.unit)}
      </span>
      <div className="text-[10px] text-slate-500 truncate">{dp.label}</div>
    </div>
  );
}

// ---- Point Row (from monitorConfigs) ----

function PointRow({ dp, val }: { dp: RoomDataPointConfig; val: unknown }) {
  const Icon = CATEGORY_ICONS[dp.category ?? 'generic'] ?? Activity;
  const catColor = CATEGORY_COLORS[dp.category ?? 'generic'] ?? '#64748b';
  const alarm = isAlarmValue(val, dp.category);
  const offline = val === undefined || val === null;

  return (
    <div className={[
      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
      alarm ? 'border-red-500/30 bg-red-950/10' : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800',
    ].join(' ')}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: catColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium truncate">{dp.label}</p>
        <p className="text-[10px] font-mono text-slate-600 truncate">{getLiveKey(dp)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-sm font-semibold ${alarm ? 'text-red-400' : offline ? 'text-slate-600' : 'text-white'}`}>
          {fmt(val, dp.unit)}
        </span>
        <span className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: alarm ? STATUS_COLORS.alarm : offline ? STATUS_COLORS.offline : STATUS_COLORS.ok }} />
      </div>
    </div>
  );
}

// ---- RoomDetailsPage datapoints (from useRoomDisplayConfig) ----

function KPICardDisplay({ dp, val }: { dp: RoomDatapointDisplay; val: unknown }) {
  const Icon = CATEGORY_ICONS[dp.category] ?? Activity;
  const catColor = CATEGORY_COLORS[dp.category] ?? '#64748b';
  const alarm = dp.category === 'alarm' && (val === true || val === 1);

  return (
    <div className={[
      'rounded-xl border p-3 flex flex-col gap-2 transition-colors',
      alarm ? 'border-red-500/40 bg-red-950/10' : 'border-slate-700/60 bg-slate-800/50',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4" style={{ color: catColor }} />
        <span className="text-[9px] uppercase tracking-wider text-slate-500">{CATEGORY_LABELS[dp.category]}</span>
      </div>
      <span className={`text-xl font-bold leading-none ${alarm ? 'text-red-400' : 'text-white'}`}>
        {fmt(val, dp.unit)}
      </span>
      <div className="text-[10px] text-slate-500 truncate">{dp.label || dp.datapoint}</div>
    </div>
  );
}

function PointRowDisplay({ dp, val }: { dp: RoomDatapointDisplay; val: unknown }) {
  const Icon = CATEGORY_ICONS[dp.category] ?? Activity;
  const catColor = CATEGORY_COLORS[dp.category] ?? '#64748b';
  const alarm = dp.category === 'alarm' && (val === true || val === 1);
  const offline = val === undefined || val === null;

  return (
    <div className={[
      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
      alarm ? 'border-red-500/30 bg-red-950/10' : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800',
    ].join(' ')}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: catColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium truncate">{dp.label || dp.datapoint}</p>
        <p className="text-[10px] font-mono text-slate-600 truncate">{dp.datapoint}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-sm font-semibold ${alarm ? 'text-red-400' : offline ? 'text-slate-600' : 'text-white'}`}>
          {fmt(val, dp.unit)}
        </span>
        <span className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: alarm ? STATUS_COLORS.alarm : offline ? STATUS_COLORS.offline : STATUS_COLORS.ok }} />
      </div>
    </div>
  );
}

// ---- Empty state ----

function EmptyState({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
      <Activity className="w-10 h-10 opacity-20" />
      <p className="text-sm">Keine Datenpunkte konfiguriert.</p>
      <button
        onClick={onConfigure}
        className="px-4 py-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-white text-xs transition-colors"
      >
        Raum konfigurieren
      </button>
    </div>
  );
}

// ---- Panel grid constants ----

const COLS = 4;
const ROWS = 8;
const CW = 144;
const CH = 84;
const GAP = 8;

const WIDGET_CATEGORY_COLORS: Record<string, string> = {
  temperature: '#ef4444', humidity: '#06b6d4', co2: '#84cc16', airflow: '#0ea5e9',
  pressure: '#8b5cf6', occupancy: '#10b981', alarm: '#ef4444', energy: '#f59e0b',
  setpoint: '#f97316', mode: '#6366f1', generic: '#64748b',
};

function fmtWidget(val: unknown, unit?: string): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'Ein' : 'Aus';
  if (typeof val === 'number') {
    const r = Math.abs(val) < 10 ? Math.round(val * 10) / 10 : Math.round(val);
    return unit ? `${r} ${unit}` : String(r);
  }
  return unit ? `${String(val)} ${unit}` : String(val);
}

function SliderWidget({ cfg, val, accent, onWrite }: {
  cfg: RoomDataPointConfig; val: unknown; accent: string; onWrite?: (v: unknown) => void;
}) {
  const min = cfg.minValue ?? 0;
  const max = cfg.maxValue ?? 100;
  const numVal = typeof val === 'number' ? val : (typeof val === 'string' ? parseFloat(val) : NaN);
  const pct = isNaN(numVal) ? 0 : Math.min(100, Math.max(0, ((numVal - min) / (max - min)) * 100));
  const offline = val === undefined || val === null;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const computeValue = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return min;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const step = cfg.maxValue !== undefined && cfg.minValue !== undefined ? (max - min) / 20 : 1;
    return Math.round(raw / step) * step;
  }, [min, max, cfg]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onWrite) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    onWrite(computeValue(e.clientX));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !onWrite) return;
    onWrite(computeValue(e.clientX));
  };
  const handlePointerUp = () => { dragging.current = false; };

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-slate-800/80 border border-slate-700/40">
      <div className="h-full flex flex-col justify-between p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 truncate flex-1">{cfg.label}</span>
          <span className="text-xs font-bold text-white shrink-0">{fmtWidget(val, cfg.unit)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-600 shrink-0">{min}</span>
          <div
            ref={trackRef}
            className={`flex-1 h-3 bg-slate-700 rounded-full relative ${onWrite ? 'cursor-pointer' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="h-full rounded-full transition-none" style={{ width: `${pct}%`, background: offline ? '#475569' : accent }} />
            {onWrite && !offline && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 transition-none"
                style={{ left: `calc(${pct}% - 7px)`, borderColor: accent }}
              />
            )}
          </div>
          <span className="text-[9px] text-slate-600 shrink-0">{max}</span>
        </div>
      </div>
    </div>
  );
}

function WidgetLive({
  cfg, val, accent, onWrite,
}: {
  cfg: RoomDataPointConfig;
  val: unknown;
  accent: string;
  onWrite?: (v: unknown) => void;
}) {
  const cc = WIDGET_CATEGORY_COLORS[cfg.category ?? 'generic'] ?? '#64748b';
  const min = cfg.minValue ?? 0;
  const max = cfg.maxValue ?? 100;
  const numVal = typeof val === 'number' ? val : (typeof val === 'string' ? parseFloat(val) : NaN);
  const pct = isNaN(numVal) ? 0 : Math.min(100, Math.max(0, ((numVal - min) / (max - min)) * 100));
  const offline = val === undefined || val === null;
  const base = 'w-full h-full rounded-xl overflow-hidden bg-slate-800/80 border border-slate-700/40';

  switch (cfg.widgetType) {
    case 'kpi':
    default:
      return (
        <div className={base}>
          <div className="h-full flex flex-col justify-center p-2.5 gap-1">
            <span className="text-[10px] text-slate-400 truncate">{cfg.label}</span>
            <span className={`text-lg font-bold leading-none ${offline ? 'text-slate-600' : 'text-white'}`}>
              {fmtWidget(val, cfg.unit)}
            </span>
          </div>
        </div>
      );
    case 'gauge':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-0.5 p-2">
            <span className="text-[10px] text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 48 48" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth="4" />
                <circle cx="24" cy="24" r="18" fill="none" stroke={offline ? '#475569' : accent} strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 18 * pct / 100} ${2 * Math.PI * 18}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{isNaN(numVal) ? '—' : Math.round(numVal)}</span>
              </div>
            </div>
            <span className="text-[9px] text-slate-500">{cfg.unit ?? ''}</span>
          </div>
        </div>
      );
    case 'slider':
      return <SliderWidget cfg={cfg} val={val} accent={accent} onWrite={onWrite} />;
    case 'switch':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-1.5 p-2">
            <span className="text-[10px] text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <button
              onClick={() => onWrite && onWrite(!val)}
              className="relative rounded-full transition-colors"
              style={{ background: val ? accent : '#334155', height: '22px', width: '40px' }}
            >
              <span className="absolute w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: val ? '20px' : '2px', top: '3px' }} />
            </button>
          </div>
        </div>
      );
    case 'badge':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-1 p-2">
            <span style={{ color: cc }}>
              {cfg.category === 'alarm' ? <AlertTriangle size={16} /> : <Activity size={16} />}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${offline ? '#475569' : cc}22`, color: offline ? '#475569' : cc }}>
              {fmtWidget(val, cfg.unit)}
            </span>
            <span className="text-[9px] text-slate-500 truncate text-center">{cfg.label}</span>
          </div>
        </div>
      );
    case 'row':
      return (
        <div className={base}>
          <div className="h-full flex items-center justify-between px-3 gap-2">
            <span className="text-[10px] text-slate-400 truncate flex-1">{cfg.label}</span>
            <span className={`text-sm font-semibold shrink-0 ${offline ? 'text-slate-600' : 'text-white'}`}>
              {fmtWidget(val, cfg.unit)}
            </span>
          </div>
        </div>
      );
    case 'label':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center p-2 gap-1">
            <span className="text-[10px] text-slate-500 truncate w-full text-center">{cfg.label}</span>
            <span className={`text-base font-bold ${offline ? 'text-slate-600' : 'text-white'}`}>
              {fmtWidget(val, cfg.unit)}
            </span>
          </div>
        </div>
      );
    case 'incrementer':
      return (
        <div className={base}>
          <div className="h-full flex flex-col items-center justify-center gap-1 p-2">
            <span className="text-[10px] text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => onWrite && !isNaN(numVal) && onWrite(numVal - (cfg.minValue !== undefined ? (max - min) / 20 : 1))}
                className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold hover:bg-slate-600">−</button>
              <span className="text-sm font-bold text-white min-w-8 text-center">{fmtWidget(val, cfg.unit)}</span>
              <button onClick={() => onWrite && !isNaN(numVal) && onWrite(numVal + (cfg.minValue !== undefined ? (max - min) / 20 : 1))}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-sm font-bold hover:opacity-80" style={{ background: accent }}>+</button>
            </div>
          </div>
        </div>
      );
  }
}

// ---- Props ----

interface RoomMonitorPageProps {
  buildingId?: string;
  roomId?: string;
  onBack?: () => void;
  onOpenConfig?: () => void;
  asPanel?: boolean;
  liveValues?: Record<string, unknown>;
}

export function RoomMonitorPage({
  buildingId: propBuildingId,
  roomId: propRoomId,
  onBack,
  onOpenConfig,
  asPanel,
  liveValues = {},
}: RoomMonitorPageProps) {
  const params = useParams<{ buildingId: string; roomId: string }>();
  const navigate = useNavigate();
  const buildingId = propBuildingId ?? params.buildingId ?? null;
  const roomId = propRoomId ?? params.roomId;
  const handleBack = onBack ?? (() => navigate(`/building/${buildingId}/monitor`));
  const handleOpenConfig = onOpenConfig ?? (() => navigate(`/building/${buildingId}/room/${roomId}/config`));

  const { buildings, monitorConfigs } = useBuildingContext();
  const { getConfig } = useRoomDisplayConfig(buildingId);

  // Primary source: PanelDesigner config (monitorConfigs)
  const monitorCfg = roomId ? monitorConfigs[roomId] : undefined;

  const hasPanelWidgets = (monitorCfg?.datapoints ?? []).length > 0;
  const [activeTab, setActiveTab] = useState<'panel' | 'overview' | 'points' | 'alarms'>(
    hasPanelWidgets ? 'panel' : 'overview'
  );

  const building = buildings.find(b => b.id === buildingId);

  const { floor, room } = useMemo((): { floor: { id: string; name: string; level: number; rooms: Room[] } | null; room: Room | null } => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === roomId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, roomId]);
  const monitorDps = useMemo(
    () => (monitorCfg?.datapoints ?? []).filter(dp => dp.showInMonitor !== false),
    [monitorCfg],
  );

  // Secondary source: RoomDetailsPage config (useRoomDisplayConfig)
  const displayCfg = roomId ? getConfig(roomId) : undefined;
  const displayDps = displayCfg?.visibleDatapoints ?? [];

  // Use monitorConfigs if they have data, otherwise fall back to displayConfig
  const useMonitorSource = monitorDps.length > 0;
  const hasAnyConfig = monitorDps.length > 0 || displayDps.length > 0;

  const alarmDps = useMemo(() => {
    if (useMonitorSource) {
      return monitorDps.filter(dp => isAlarmValue(resolveLiveValue(dp, liveValues), dp.category));
    }
    return displayDps.filter(dp => dp.category === 'alarm' && (liveValues[dp.datapoint] === true || liveValues[dp.datapoint] === 1));
  }, [monitorDps, displayDps, liveValues, useMonitorSource]);

  const kpiDps = useMemo(() => {
    if (useMonitorSource) {
      return monitorDps.filter(dp => dp.isPrimaryRoomKPI || dp.isPrimaryBuildingPoint).slice(0, 6);
    }
    const seen = new Set<string>();
    const preferred = ['temperature', 'co2', 'humidity', 'occupancy', 'alarm', 'energy'];
    return displayDps.filter(dp => {
      if (seen.has(dp.category) || !preferred.includes(dp.category)) return false;
      seen.add(dp.category);
      return true;
    });
  }, [monitorDps, displayDps, useMonitorSource]);

  if (!building || !room || !floor) {
    if (asPanel) return null;
    return (
      <div className="flex h-full bg-slate-950 text-slate-200 items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Raum nicht gefunden</p>
          <button onClick={handleBack} className="px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition-colors">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  const px = asPanel ? 'px-4' : 'px-6';

  const headerContent = (
    <div className={`${asPanel ? 'bg-slate-900/80 border-b border-slate-800 px-4 py-3 rounded-t-2xl' : 'bg-slate-900/80 border-b border-slate-800 px-6 py-4'} shrink-0`}>
      <div className="flex items-center gap-2 mb-2">
        <Breadcrumbs items={[
          { label: building.name, onClick: handleBack, icon: 'building' },
          { label: floor.name, onClick: handleBack, icon: 'floor' },
          { label: room.name, icon: 'room' },
        ]} />
        <button onClick={handleBack} className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors shrink-0">
          <ArrowLeft size={14} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
          <div className="min-w-0">
            <h1 className={`${asPanel ? 'text-base' : 'text-xl'} font-bold text-white leading-tight truncate`}>{room.name}</h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{floor.name}</span>
              {alarmDps.length > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle size={10} />
                  {alarmDps.length} Alarm{alarmDps.length > 1 ? 'e' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={handleOpenConfig} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors shrink-0">
          <Settings size={12} />
          {!asPanel && 'Konfigurieren'}
        </button>
      </div>
    </div>
  );

  const tabBar = (
    <div className={`flex border-b border-slate-800 bg-slate-900/60 ${px} shrink-0`}>
      {([
        ...(hasPanelWidgets ? [{ id: 'panel' as const, label: 'Panel' }] : []),
        { id: 'overview' as const, label: 'Übersicht' },
        { id: 'points' as const, label: `Datenpunkte (${useMonitorSource ? monitorDps.length : displayDps.length})` },
        { id: 'alarms' as const, label: `Alarme${alarmDps.length > 0 ? ` (${alarmDps.length})` : ''}` },
      ]).map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as 'panel' | 'overview' | 'points' | 'alarms')}
          className={[
            'px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
            activeTab === tab.id ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const accent = monitorCfg?.accentColor ?? room?.color ?? '#0ea5e9';
  const panelWidgets = monitorCfg?.datapoints ?? [];
  const canvasW = COLS * (CW + GAP) + GAP;
  const canvasH = ROWS * (CH + GAP) + GAP;

  const tabContent = (
    <div className="flex-1 overflow-y-auto">
      {activeTab === 'panel' && (
        <div className={asPanel ? 'p-2 flex justify-center' : 'p-4 flex justify-center'}>
          <div
            className="relative shrink-0 rounded-xl bg-slate-900/50"
            style={{ width: canvasW, height: canvasH }}
          >
            {/* Grid background cells */}
            {Array.from({ length: ROWS }).map((_, row) =>
              Array.from({ length: COLS }).map((_, col) => (
                <div
                  key={`${col}-${row}`}
                  className="absolute rounded-lg border border-slate-800/40"
                  style={{
                    left: GAP + col * (CW + GAP),
                    top: GAP + row * (CH + GAP),
                    width: CW,
                    height: CH,
                  }}
                />
              ))
            )}
            {/* Live widgets */}
            {panelWidgets.map(w => {
              const col = w.panelCol ?? 0;
              const row = w.panelRow ?? 0;
              const wCols = w.panelW ?? 1;
              const hRows = w.panelH ?? 1;
              const liveVal = resolveLiveValue(w, liveValues);
              return (
                <div
                  key={w.datapointId}
                  className="absolute"
                  style={{
                    left: GAP + col * (CW + GAP),
                    top: GAP + row * (CH + GAP),
                    width: wCols * CW + (wCols - 1) * GAP,
                    height: hRows * CH + (hRows - 1) * GAP,
                  }}
                >
                  <WidgetLive
                    cfg={w}
                    val={liveVal}
                    accent={accent}
                    onWrite={w.writable ? (v) => writeDp(w.sourceDatapoint ?? w.datapointId, v) : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
      {activeTab === 'overview' && (
        <div className={asPanel ? 'p-4' : 'p-6 max-w-5xl mx-auto'}>
          {!hasAnyConfig ? (
            <EmptyState onConfigure={handleOpenConfig} />
          ) : (
            <>
              {/* Primary KPIs */}
              {kpiDps.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Kennwerte</div>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {useMonitorSource
                      ? (kpiDps as RoomDataPointConfig[]).map(dp => (
                          <KPICard key={dp.datapointId} dp={dp} val={resolveLiveValue(dp, liveValues)} />
                        ))
                      : (kpiDps as RoomDatapointDisplay[]).map(dp => (
                          <KPICardDisplay key={dp.datapoint} dp={dp} val={liveValues[dp.datapoint]} />
                        ))
                    }
                  </div>
                </>
              )}

              {/* Alarms */}
              {alarmDps.length > 0 && (
                <div className="mb-5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={10} className="text-red-400" /> Aktive Alarme
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {useMonitorSource
                      ? (alarmDps as RoomDataPointConfig[]).map(dp => (
                          <div key={dp.datapointId} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                            <AlertTriangle size={12} className="text-red-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-red-200 truncate">{dp.label}</p>
                              <p className="text-xs text-red-400/70">{fmt(resolveLiveValue(dp, liveValues), dp.unit)}</p>
                            </div>
                          </div>
                        ))
                      : (alarmDps as RoomDatapointDisplay[]).map(dp => (
                          <div key={dp.datapoint} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                            <AlertTriangle size={12} className="text-red-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-red-200 truncate">{dp.label}</p>
                              <p className="text-xs text-red-400/70">{fmt(liveValues[dp.datapoint], dp.unit)}</p>
                            </div>
                          </div>
                        ))
                    }
                  </div>
                </div>
              )}

              {/* All points */}
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Alle Werte</div>
              <div className="flex flex-col gap-1">
                {useMonitorSource
                  ? monitorDps.map(dp => <PointRow key={dp.datapointId} dp={dp} val={resolveLiveValue(dp, liveValues)} />)
                  : displayDps.map(dp => <PointRowDisplay key={dp.datapoint} dp={dp} val={liveValues[dp.datapoint]} />)
                }
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'points' && (
        <div className={asPanel ? 'p-4' : 'p-6 max-w-3xl mx-auto'}>
          {!hasAnyConfig ? (
            <EmptyState onConfigure={handleOpenConfig} />
          ) : (
            <div className="flex flex-col gap-1">
              {useMonitorSource
                ? monitorDps.map(dp => <PointRow key={dp.datapointId} dp={dp} val={resolveLiveValue(dp, liveValues)} />)
                : displayDps.map(dp => <PointRowDisplay key={dp.datapoint} dp={dp} val={liveValues[dp.datapoint]} />)
              }
            </div>
          )}
        </div>
      )}

      {activeTab === 'alarms' && (
        <div className={asPanel ? 'p-4' : 'p-6 max-w-3xl mx-auto'}>
          {alarmDps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                <AlertTriangle size={18} className="text-slate-600" />
              </div>
              <p className="text-sm">Keine aktiven Alarme</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {useMonitorSource
                ? (alarmDps as RoomDataPointConfig[]).map(dp => (
                    <div key={dp.datapointId} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                      <AlertTriangle size={12} className="text-red-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-red-200">{dp.label}</p>
                        <p className="text-xs text-red-400/70 mt-0.5">{fmt(resolveLiveValue(dp, liveValues), dp.unit)}</p>
                      </div>
                    </div>
                  ))
                : (alarmDps as RoomDatapointDisplay[]).map(dp => (
                    <div key={dp.datapoint} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                      <AlertTriangle size={12} className="text-red-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-red-200">{dp.label}</p>
                        <p className="text-xs text-red-400/70 mt-0.5">{fmt(liveValues[dp.datapoint], dp.unit)}</p>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (asPanel) {
    return (
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-[min(640px,48vw)] h-[min(88vh,900px)] flex flex-col pointer-events-none">
        <div className="relative flex flex-col h-full w-full bg-slate-950/96 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.7)] pointer-events-auto animate-[slideInRight_.22s_cubic-bezier(0.16,1,0.3,1)] overflow-hidden">
          {headerContent}
          {tabBar}
          {tabContent}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {headerContent}
      {tabBar}
      {tabContent}
    </div>
  );
}
