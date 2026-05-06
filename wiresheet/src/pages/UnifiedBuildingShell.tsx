import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Building2, Pencil, Eye, ArrowLeft, Layers, AlertTriangle,
  Search, RefreshCw, Settings, LayoutDashboard, ChevronRight,
  Thermometer, Droplets, Wind, Users, Zap, Activity, Box,
  Fan, Lightbulb, Bell, Snowflake, Flame, Plug, Gauge,
  TrendingUp, TrendingDown, Minus, X, Clock, Hexagon,
} from 'lucide-react';

import { BuildingCanvas3D } from '../components/building/BuildingCanvas3D';
import { RoomEditorView } from '../components/building/RoomEditorView';
import { BuildingView } from '../components/building/BuildingView';
import { LayerSelector } from '../components/bms/LayerSelector';
import { LegendPanel } from '../components/bms/LegendPanel';
import { RoomTooltip } from '../components/bms/RoomTooltip';
import { PanelDesigner } from '../components/building/PanelDesigner';
import { useBuildingMonitor } from '../hooks/useBuildingMonitor';
import { useBuildingContext } from '../context/BuildingContext';
import { useCanvas3DSettingsReadOnly } from '../hooks/useCanvas3DSettings';
import { MonitorLayer } from '../types/building';
import { DataPoint, DataPointCategory, RoomMonitorConfig, RoomDataPointConfig, WidgetType } from '../types/bms';
import { WiresheetPage, HaEntity } from '../types/flow';
import type { DatapointGroup } from '../components/building/RoomBindingsPanel';

// ── colour helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function interpolateHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}
function getRoomLayerColor(value: number, layer: MonitorLayer): string {
  const { stops, min, max } = layer.colorScale;
  if (!stops.length) return '';
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      return interpolateHex(stops[i].color, stops[i + 1].color, (t - stops[i].at) / (stops[i + 1].at - stops[i].at));
    }
  }
  return stops[stops.length - 1]?.color ?? '';
}

// ── mock data ─────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = { ok: '#22c55e', warning: '#f59e0b', alarm: '#ef4444', offline: '#64748b', unknown: '#64748b' };
const CAT_COLORS: Record<string, string> = {
  temperature: '#ef4444', setpoint: '#f97316', humidity: '#06b6d4', co2: '#a78bfa',
  airflow: '#0ea5e9', occupancy: '#10b981', alarm: '#ef4444', energy: '#f59e0b',
  valvePosition: '#14b8a6', fanSpeed: '#6366f1', mode: '#8b5cf6', generic: '#64748b',
};
const CAT_ICONS: Record<string, React.ReactNode> = {
  temperature: <Thermometer size={13} />, humidity: <Droplets size={13} />,
  co2: <Wind size={13} />, airflow: <Wind size={13} />, pressure: <Activity size={13} />,
  occupancy: <Users size={13} />, alarm: <AlertTriangle size={13} />, mode: <RefreshCw size={13} />,
  setpoint: <Gauge size={13} />, energy: <Zap size={13} />, valvePosition: <Activity size={13} />,
  fanSpeed: <Fan size={13} />, light: <Lightbulb size={13} />, pump: <Plug size={13} />,
  cold: <Snowflake size={13} />, bell: <Bell size={13} />, fire: <Flame size={13} />,
  generic: <Activity size={13} />,
};
const CATEGORY_ICONS: Record<DataPointCategory, React.ReactNode> = {
  temperature: <Thermometer size={14} />, humidity: <Droplets size={14} />,
  co2: <Activity size={14} />, airflow: <Wind size={14} />, pressure: <Activity size={14} />,
  occupancy: <Users size={14} />, alarm: <AlertTriangle size={14} />, mode: <RefreshCw size={14} />,
  setpoint: <Settings size={14} />, energy: <Zap size={14} />, valvePosition: <Activity size={14} />,
  fanSpeed: <Wind size={14} />, vavFlow: <Wind size={14} />, windowState: <Box size={14} />,
  comfortIndex: <Activity size={14} />, generic: <Activity size={14} />,
};

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
    case 'energy':      return { v: (r * 1200).toFixed(0), u: u || 'W', n: r * 1200, s: 'ok' };
    default:            return { v: (r * 100).toFixed(1), u, n: r * 100, s: 'ok' };
  }
}

function generateMockDataPoints(room: { id: string; bindings?: { id: string; datapoint: string; label?: string; category: string; unit?: string; writable?: boolean }[] }): DataPoint[] {
  const base = room.id.charCodeAt(room.id.length - 1) || 42;
  const rand = (seed: number) => ((seed * 9301 + 49297) % 233280) / 233280;
  if (room.bindings?.length) {
    return room.bindings.map((b, i): DataPoint => ({
      id: b.id, name: b.datapoint, label: b.label ?? b.datapoint,
      category: b.category as DataPointCategory, unit: b.unit ?? '',
      currentValue: rand(base + i) * 30 + 15,
      formattedValue: `${(rand(base + i) * 30 + 15).toFixed(1)} ${b.unit ?? ''}`,
      status: rand(base + i) > 0.85 ? 'alarm' : rand(base + i) > 0.7 ? 'warning' : 'ok',
      trend: rand(base + i) > 0.6 ? 'up' : rand(base + i) > 0.3 ? 'down' : 'stable',
      writable: b.writable ?? false, quality: 'good',
      lastUpdate: Date.now() - Math.floor(rand(base + i) * 60000),
      historicValues: Array.from({ length: 20 }, (_, j) => ({ ts: Date.now() - (20 - j) * 60000, value: rand(base + i + j) * 5 + 20 })),
    }));
  }
  const defaults = [
    { label: 'Raumtemperatur', category: 'temperature', unit: '°C', value: 20 + rand(base) * 8, writable: false },
    { label: 'Sollwert Heizung', category: 'setpoint', unit: '°C', value: 21 + rand(base + 1) * 2, writable: true },
    { label: 'Relative Luftfeuchte', category: 'humidity', unit: '%', value: 40 + rand(base + 2) * 25, writable: false },
    { label: 'CO₂-Konzentration', category: 'co2', unit: 'ppm', value: 400 + rand(base + 3) * 800, writable: false },
    { label: 'Zuluft', category: 'airflow', unit: 'm³/h', value: rand(base + 4) * 350, writable: false },
    { label: 'Belegung', category: 'occupancy', unit: '', value: rand(base + 5) > 0.5 ? 1 : 0, writable: false },
    { label: 'Energieverbrauch', category: 'energy', unit: 'W', value: rand(base + 6) * 1200, writable: false },
  ] as const;
  return defaults.map((d, i): DataPoint => ({
    id: `mock-${room.id}-${i}`, name: d.label, label: d.label,
    category: d.category as DataPointCategory, unit: d.unit,
    currentValue: d.value,
    formattedValue: d.unit ? `${d.value.toFixed(1)} ${d.unit}` : d.value > 0.5 ? 'Belegt' : 'Frei',
    status: d.value > 1100 ? 'alarm' : d.value > 900 ? 'warning' : 'ok',
    trend: rand(base + i) > 0.6 ? 'up' : rand(base + i) > 0.3 ? 'down' : 'stable',
    writable: d.writable, quality: 'good',
    lastUpdate: Date.now() - Math.floor(rand(base + i) * 120000),
    historicValues: Array.from({ length: 20 }, (_, j) => ({ ts: Date.now() - (20 - j) * 300000, value: d.value + (rand(base + i + j) - 0.5) * 5 })),
  }));
}

// ── small room-panel widgets ──────────────────────────────────────────────────
const PANEL_CW = 152, PANEL_CH = 92, PANEL_GAP = 8, PANEL_COLS = 4;

function LiveWidget({ cfg, accent }: { cfg: RoomDataPointConfig; accent: string }) {
  const cat = cfg.category ?? 'generic';
  const m = mockLiveVal(cat, cfg.unit);
  const icon = CAT_ICONS[cat] ?? CAT_ICONS.generic;
  const cc = CAT_COLORS[cat] ?? '#64748b';
  const sc = STATUS_COLORS[m.s] ?? '#64748b';
  const min = cfg.minValue ?? 0, max = cfg.maxValue ?? 100;
  const pct = Math.min(100, Math.max(0, ((m.n - min) / (max - min)) * 100));
  const base = 'w-full h-full rounded-xl bg-slate-800/70 border border-slate-700/40';
  switch (cfg.widgetType as WidgetType) {
    case 'gauge': return (
      <div className={base}><div className="h-full flex flex-col items-center justify-center gap-1 p-3">
        <span className="text-xs text-slate-400 truncate w-full text-center">{cfg.label}</span>
        <div className="relative w-12 h-12"><svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth="5" />
          <circle cx="28" cy="28" r="22" fill="none" stroke={accent} strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22 * pct / 100} ${2 * Math.PI * 22}`} strokeLinecap="round" />
        </svg><div className="absolute inset-0 flex items-center justify-center rotate-90"><span className="text-xs font-bold text-white">{m.v}</span></div></div>
        <span className="text-[10px] text-slate-400">{m.u}</span>
      </div></div>
    );
    case 'badge': return (
      <div className={base}><div className="h-full flex flex-col items-center justify-center gap-1.5 p-3">
        <span style={{ color: cc }}>{icon}</span>
        <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ background: `${sc}22`, color: sc }}>{m.v}</span>
        <span className="text-[10px] text-slate-500 text-center truncate">{cfg.label}</span>
      </div></div>
    );
    case 'switch': return (
      <div className={base}><div className="h-full flex flex-col items-center justify-center gap-2 p-3">
        <span className="text-xs text-slate-300">{cfg.label}</span>
        <button className="w-12 h-6 rounded-full flex items-center px-1" style={{ background: accent }}>
          <div className="w-5 h-5 bg-white rounded-full ml-auto shadow-sm" />
        </button>
        <span className="text-[10px] text-slate-400">EIN</span>
      </div></div>
    );
    case 'row': return (
      <div className={base}><div className="h-full flex items-center gap-3 px-3">
        <span style={{ color: cc }} className="shrink-0">{icon}</span>
        <span className="text-sm text-slate-200 flex-1 truncate">{cfg.label}</span>
        <span className="text-sm font-bold text-white shrink-0">{m.v} {m.u}</span>
      </div></div>
    );
    default: return (
      <div className={base}><div className="h-full flex flex-col justify-between p-3">
        <div className="flex items-center gap-2"><span style={{ color: cc }}>{icon}</span><span className="text-xs text-slate-400 truncate">{cfg.label}</span></div>
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold leading-none" style={{ color: sc }}>{m.v}</span>
          {m.u && <span className="text-sm text-slate-400 pb-0.5">{m.u}</span>}
        </div>
      </div></div>
    );
  }
}

function CustomPanel({ config, accent, onConfigure }: { config: RoomMonitorConfig; accent: string; onConfigure: () => void }) {
  const widgets = config.datapoints.filter(w => w.showInMonitor !== false);
  if (!widgets.length) return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-sm gap-2">
      <LayoutDashboard size={24} className="opacity-30" />
      <p className="text-xs">Kein Panel konfiguriert.</p>
      <button onClick={onConfigure} className="mt-1 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 rounded-lg text-white text-xs">Panel konfigurieren</button>
    </div>
  );
  const maxCol = Math.max(...widgets.map(w => (w.panelCol ?? 0) + (w.panelW ?? 1)));
  const maxRow = Math.max(...widgets.map(w => (w.panelRow ?? 0) + (w.panelH ?? 1)));
  const cols = Math.max(maxCol, PANEL_COLS);
  const panelW = cols * (PANEL_CW + PANEL_GAP) + PANEL_GAP;
  const panelH = maxRow * (PANEL_CH + PANEL_GAP) + PANEL_GAP;
  return (
    <div className="p-3 overflow-auto">
      {(config.panelTitle || config.panelSubtitle) && (
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2 border border-slate-700/40 mb-3" style={{ maxWidth: panelW }}>
          <div className="w-1 h-7 rounded-full shrink-0" style={{ background: accent }} />
          <div>
            <p className="text-sm font-semibold text-white">{config.panelTitle}</p>
            {config.panelSubtitle && <p className="text-xs text-slate-400">{config.panelSubtitle}</p>}
          </div>
        </div>
      )}
      <div style={{ position: 'relative', width: panelW, height: panelH }}>
        {widgets.map(w => (
          <div key={w.datapointId} style={{
            position: 'absolute',
            left: PANEL_GAP + (w.panelCol ?? 0) * (PANEL_CW + PANEL_GAP),
            top: PANEL_GAP + (w.panelRow ?? 0) * (PANEL_CH + PANEL_GAP),
            width: (w.panelW ?? 1) * PANEL_CW + ((w.panelW ?? 1) - 1) * PANEL_GAP,
            height: (w.panelH ?? 1) * PANEL_CH + ((w.panelH ?? 1) - 1) * PANEL_GAP,
          }}>
            <LiveWidget cfg={w} accent={accent} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── small helpers ─────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend?: string }) {
  if (trend === 'up') return <TrendingUp size={11} className="text-red-400" />;
  if (trend === 'down') return <TrendingDown size={11} className="text-sky-400" />;
  return <Minus size={11} className="text-slate-500" />;
}

function PointRow({ dp }: { dp: DataPoint }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(typeof dp.currentValue === 'number' ? String(dp.currentValue.toFixed(1)) : '');
  return (
    <div className={['flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-xs',
      dp.status === 'alarm' ? 'border-red-500/30 bg-red-950/10' : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800'].join(' ')}>
      <span style={{ color: STATUS_COLORS[dp.status] }} className="shrink-0">{CATEGORY_ICONS[dp.category]}</span>
      <span className="flex-1 text-slate-300 truncate">{dp.label}</span>
      <TrendIcon trend={dp.trend} />
      {dp.writable && !editing
        ? <button onClick={() => setEditing(true)} className="font-semibold text-white hover:text-sky-300">{dp.formattedValue}</button>
        : dp.writable && editing
        ? <div className="flex items-center gap-1">
            <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
              className="w-14 bg-slate-700 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none" autoFocus />
            <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-sky-600 text-sky-400"><ChevronRight size={11} /></button>
          </div>
        : <span className="font-semibold text-white">{dp.formattedValue}</span>
      }
    </div>
  );
}

function KPICard({ dp }: { dp: DataPoint }) {
  return (
    <div className={['bg-slate-800 border rounded-xl p-3 flex flex-col gap-1.5',
      dp.status === 'alarm' ? 'border-red-500/50' : dp.status === 'warning' ? 'border-amber-500/30' : 'border-slate-700'].join(' ')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: STATUS_COLORS[dp.status] }}>{CATEGORY_ICONS[dp.category]}</span>
          <span className="text-xs text-slate-400 truncate max-w-[80px]">{dp.label}</span>
        </div>
        <TrendIcon trend={dp.trend} />
      </div>
      <div>
        <span className="text-xl font-bold text-white">{typeof dp.currentValue === 'number' ? dp.currentValue.toFixed(1) : dp.formattedValue}</span>
        {dp.unit && <span className="text-slate-400 ml-1 text-xs">{dp.unit}</span>}
      </div>
    </div>
  );
}

// ── Room side panel ───────────────────────────────────────────────────────────
type RoomPanelTab = 'panel' | 'overview' | 'points' | 'alarms' | 'trends' | 'edit';

interface RoomSidePanelProps {
  buildingId: string;
  roomId: string;
  appMode: AppShellMode;
  onClose: () => void;
  onSwitchToEdit: () => void;
  datapointGroups?: DatapointGroup[];
}

function RoomSidePanel({ buildingId, roomId, appMode, onClose, onSwitchToEdit, datapointGroups = [] }: RoomSidePanelProps) {
  const { buildings, monitorConfigs } = useBuildingContext();
  const building = buildings.find(b => b.id === buildingId);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const { floor, room } = useMemo(() => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === roomId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, roomId]);

  const roomConfig: RoomMonitorConfig | undefined = monitorConfigs[roomId];
  const hasCustomPanel = !!(roomConfig?.datapoints?.length);
  const hiddenTabs = new Set(roomConfig?.hiddenTabs ?? []);

  const defaultTab: RoomPanelTab = appMode === 'edit'
    ? 'edit'
    : hasCustomPanel ? 'panel' : 'overview';
  const [activeTab, setActiveTab] = useState<RoomPanelTab>(defaultTab);

  useEffect(() => {
    if (appMode === 'edit') setActiveTab('edit');
  }, [roomId, appMode]);

  const dataPoints = useMemo(() => {
    if (!room) return [];
    return generateMockDataPoints(room as Parameters<typeof generateMockDataPoints>[0]);
  }, [room, lastRefresh]);

  const alarms = dataPoints.filter(dp => dp.status === 'alarm');
  const accent = roomConfig?.accentColor ?? room?.color ?? '#0ea5e9';

  if (!building || !room || !floor) return null;

  const tabs = [
    ...(appMode === 'edit' ? [{ id: 'edit' as const, label: 'Panel-Editor' }] : []),
    ...(hasCustomPanel ? [{ id: 'panel' as const, label: 'Panel' }] : []),
    { id: 'overview' as const, label: 'Übersicht' },
    { id: 'points' as const, label: `Punkte (${dataPoints.length})` },
    ...(alarms.length > 0 ? [{ id: 'alarms' as const, label: `Alarme (${alarms.length})` }] : []),
    { id: 'trends' as const, label: 'Trends' },
  ].filter(t => !hiddenTabs.has(t.id));

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-slate-700/60 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white leading-tight truncate">{room.name}</h2>
            <p className="text-[10px] text-slate-500">{floor.name}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {appMode === 'live' && (
              <button onClick={() => setLastRefresh(Date.now())}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors" title="Aktualisieren">
                <RefreshCw size={12} />
              </button>
            )}
            {appMode === 'live' && (
              <button onClick={onSwitchToEdit}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors" title="Zum Editor">
                <Pencil size={12} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
              <X size={12} />
            </button>
          </div>
        </div>
        {alarms.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-950/40 border border-red-800/40 text-xs text-red-300">
            <AlertTriangle size={10} />
            {alarms.length} aktive{alarms.length > 1 ? ' Alarme' : 'r Alarm'}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700/60 bg-slate-900/40 shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={['flex-shrink-0 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'].join(' ')}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'edit' && (
          <PanelDesigner
            key={room.id}
            room={room}
            floorName={floor.name}
            buildingId={buildingId}
            datapointGroups={datapointGroups}
            onOpenMonitor={() => setActiveTab('panel')}
          />
        )}
        {activeTab === 'panel' && roomConfig && (
          <CustomPanel config={roomConfig} accent={accent} onConfigure={() => setActiveTab('edit')} />
        )}
        {activeTab === 'overview' && (
          <div className="p-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Kennwerte</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {dataPoints.slice(0, 6).map(dp => <KPICard key={dp.id} dp={dp} />)}
            </div>
            {alarms.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle size={9} className="text-red-400" /> Alarme
                </p>
                <div className="flex flex-col gap-1.5">
                  {alarms.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-red-950/20 border border-red-800/40 rounded-lg">
                      <AlertTriangle size={11} className="text-red-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-red-200 truncate">{a.label}</p>
                        <p className="text-[10px] text-red-400/70">{a.formattedValue}</p>
                      </div>
                      <button className="px-2 py-1 rounded bg-red-800/50 text-xs text-red-200">Quit.</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Alle Werte</p>
            <div className="flex flex-col gap-1">
              {dataPoints.map(dp => <PointRow key={dp.id} dp={dp} />)}
            </div>
          </div>
        )}
        {activeTab === 'points' && (
          <div className="p-3 flex flex-col gap-1">
            {dataPoints.map(dp => <PointRow key={dp.id} dp={dp} />)}
          </div>
        )}
        {activeTab === 'alarms' && (
          <div className="p-3">
            {alarms.length === 0
              ? <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-xs gap-2"><AlertTriangle size={20} className="opacity-30" /><p>Keine Alarme</p></div>
              : <div className="flex flex-col gap-2">{alarms.map(a => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-red-950/20 border border-red-800/40 rounded-lg">
                    <AlertTriangle size={11} className="text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-red-200">{a.label}</p>
                      <p className="text-[10px] text-red-400/70">{a.formattedValue}</p>
                    </div>
                    <button className="px-2 py-1 rounded bg-red-800/50 text-xs text-red-200">Quittieren</button>
                  </div>
                ))}</div>
            }
          </div>
        )}
        {activeTab === 'trends' && (
          <div className="p-3 flex flex-col gap-3">
            {dataPoints.filter(dp => dp.historicValues && dp.historicValues.length > 2 && dp.category !== 'occupancy' && dp.category !== 'alarm').map(dp => (
              <div key={dp.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: STATUS_COLORS[dp.status] }}>{CATEGORY_ICONS[dp.category]}</span>
                    <span className="text-xs text-slate-200">{dp.label}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{dp.formattedValue}</span>
                </div>
                {dp.historicValues && <MiniTrendChart values={dp.historicValues} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTrendChart({ values }: { values: { ts: number; value: number }[] }) {
  const w = 300, h = 60, pad = { t: 6, b: 16, l: 32, r: 6 };
  const min = Math.min(...values.map(v => v.value)), max = Math.max(...values.map(v => v.value));
  const range = max - min || 1;
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const pts = values.map((v, i) => `${pad.l + (i / (values.length - 1)) * cw},${pad.t + ch - ((v.value - min) / range) * ch}`).join(' ');
  const area = [`${pad.l},${pad.t + ch}`, ...values.map((v, i) => `${pad.l + (i / (values.length - 1)) * cw},${pad.t + ch - ((v.value - min) / range) * ch}`), `${pad.l + cw},${pad.t + ch}`].join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none" className="overflow-visible">
      <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" /><stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" /></linearGradient></defs>
      <polygon points={area} fill="url(#tg)" />
      <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
      <text x={pad.l - 3} y={pad.t + 4} textAnchor="end" fontSize={8} fill="#475569">{max.toFixed(1)}</text>
      <text x={pad.l - 3} y={pad.t + ch} textAnchor="end" fontSize={8} fill="#475569">{min.toFixed(1)}</text>
    </svg>
  );
}

// ── main shell ────────────────────────────────────────────────────────────────
type AppShellMode = 'live' | 'edit';
type EditSubMode = '3d' | 'floorplan';

export interface UnifiedBuildingShellProps {
  buildingId?: string;
  onBack?: () => void;
  pages?: WiresheetPage[];
  haEntities?: HaEntity[];
  haLoading?: boolean;
  onLoadHaEntities?: () => void;
  liveValues?: Record<string, unknown>;
}

export function UnifiedBuildingShell({
  buildingId: propBuildingId,
  onBack,
  pages = [],
  haEntities = [],
  haLoading = false,
  onLoadHaEntities,
  liveValues = {},
}: UnifiedBuildingShellProps) {
  const { buildings, replaceBuilding, isLoaded, activeBuildingId, monitorConfigs } = useBuildingContext();
  const buildingId = propBuildingId ?? activeBuildingId;
  const building = buildings.find(b => b.id === buildingId);

  const [appMode, setAppMode] = useState<AppShellMode>('live');
  const [editSub, setEditSub] = useState<EditSubMode>('floorplan');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const monitorLayers: MonitorLayer[] = building?.monitorLayers ?? [];
  const allRoomIds = useMemo(() => building?.floors.flatMap(f => f.rooms.map(r => r.id)) ?? [], [building]);

  const { activeLayerId, hoveredRoomId, roomValues, setActiveLayer, setHoveredRoom, getRoomLayerValue } = useBuildingMonitor(allRoomIds, monitorLayers);
  const activeMonitorLayer = useMemo(() => monitorLayers.find(l => l.id === activeLayerId) ?? null, [monitorLayers, activeLayerId]);
  const canvas3D = useCanvas3DSettingsReadOnly();

  const logicPageGroups: DatapointGroup[] = useMemo(() => {
    return pages.map(page => ({
      pageId: page.id,
      pageName: page.name,
      datapoints: page.nodes
        .filter(n => ['datapoint', 'dp-read', 'dp-write', 'ha-entity', 'dp-boolean', 'dp-numeric', 'dp-enum'].includes(n.type))
        .map(n => {
          const cfg = n.data.config as Record<string, unknown> | undefined;
          const entityId = n.id;
          const facet = (cfg?.['dpFacet'] as string) || '';
          const label = facet || (n.data.label as string) || (cfg?.['label'] as string) || n.id;
          return { entityId, label };
        })
        .filter(d => d.entityId),
    })).filter(g => g.datapoints.length > 0);
  }, [pages]);

  const datapointLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const grp of logicPageGroups) for (const dp of grp.datapoints) if (dp.label && dp.label !== dp.entityId && !map[dp.entityId]) map[dp.entityId] = dp.label;
    for (const e of haEntities) {
      const friendly = (e.attributes as Record<string, unknown> | undefined)?.['friendly_name'];
      if (typeof friendly === 'string' && friendly.trim()) map[e.entity_id] = friendly;
    }
    return map;
  }, [logicPageGroups, haEntities]);

  const buildingsWithLayerColors = useMemo(() => {
    if (!building || activeLayerId === 'normal' || !activeMonitorLayer) return buildings;
    const coloredBuilding = {
      ...building,
      floors: building.floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(room => {
          const lv = getRoomLayerValue(room.id);
          const layerColor = lv?.value !== null && lv?.value !== undefined ? getRoomLayerColor(lv.value as number, activeMonitorLayer) : '';
          return layerColor ? { ...room, color: layerColor } : room;
        }),
      })),
    };
    return buildings.map(b => b.id === buildingId ? coloredBuilding : b);
  }, [buildings, building, activeLayerId, activeMonitorLayer, buildingId, getRoomLayerValue]);

  const hoveredRoom = useMemo(() => {
    if (!hoveredRoomId || !building) return null;
    for (const f of building.floors) { const r = f.rooms.find(r => r.id === hoveredRoomId); if (r) return r; }
    return null;
  }, [hoveredRoomId, building]);

  const filteredRooms = useMemo(() => {
    if (!building) return [];
    return building.floors
      .filter(f => selectedFloorFilter === 'all' || f.id === selectedFloorFilter)
      .flatMap(f => f.rooms.map(r => ({ room: r, floor: f })))
      .filter(({ room }) => !searchQuery || room.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [building, selectedFloorFilter, searchQuery]);

  const alarmRooms = useMemo(() => roomValues.filter(v => v.status === 'alarm').map(v => v.roomId), [roomValues]);

  const handleRoomHover = useCallback((roomId: string | null, clientX?: number, clientY?: number) => {
    setHoveredRoom(roomId);
    if (clientX !== undefined && clientY !== undefined) setTooltipPos({ x: clientX, y: clientY });
  }, [setHoveredRoom]);

  const handleRoomClick = useCallback((roomId: string | null) => {
    setSelectedRoomId(roomId);
  }, []);

  const handleSwitchToEdit = useCallback(() => {
    setAppMode('edit');
    setEditSub('floorplan');
  }, []);

  if (!isLoaded) return (
    <div className="flex h-screen bg-slate-950 items-center justify-center text-slate-400">
      <p className="text-sm">Gebäude wird geladen...</p>
    </div>
  );
  if (!building) return (
    <div className="flex h-screen bg-slate-950 items-center justify-center text-slate-400">
      <div className="text-center">
        <p className="mb-4">Gebäude nicht gefunden</p>
        <button onClick={onBack} className="px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition-colors">Zurück</button>
      </div>
    </div>
  );

  const selectedRoom = selectedRoomId
    ? building.floors.flatMap(f => f.rooms).find(r => r.id === selectedRoomId) ?? null
    : null;
  const selectedFloorObj = selectedRoom
    ? building.floors.find(f => f.rooms.some(r => r.id === selectedRoomId)) ?? null
    : null;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* ── Top header bar ─────────────────────────────────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center gap-3 shrink-0 z-10">
        <button onClick={onBack} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={14} />
        </button>
        <Building2 size={14} className="text-slate-500 shrink-0" />
        <span className="text-sm font-semibold text-white truncate">{building.name}</span>

        {alarmRooms.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-950/60 border border-red-800/50 text-xs text-red-300">
            <AlertTriangle size={10} />
            {alarmRooms.length} Alarm{alarmRooms.length > 1 ? 'e' : ''}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setAppMode('live')}
              className={['flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                appMode === 'live' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'].join(' ')}>
              <Eye size={12} />
              Live
            </button>
            <button
              onClick={() => setAppMode('edit')}
              className={['flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                appMode === 'edit' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'].join(' ')}>
              <Pencil size={12} />
              Editor
            </button>
          </div>

          {/* Editor sub-mode (only in edit) */}
          {appMode === 'edit' && (
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setEditSub('floorplan')}
                className={['flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  editSub === 'floorplan' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'].join(' ')}>
                <Hexagon size={12} /> Grundriss
              </button>
              <button
                onClick={() => setEditSub('3d')}
                className={['flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  editSub === '3d' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'].join(' ')}>
                <Building2 size={12} /> 3D
              </button>
            </div>
          )}

          {/* Layer toggle (live only) */}
          {appMode === 'live' && (
            <button onClick={() => setSidebarOpen(v => !v)}
              className={['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                sidebarOpen ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'].join(' ')}>
              <Layers size={12} /> Ebenen
            </button>
          )}
        </div>
      </header>

      {/* ── Main body ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left sidebar: layer / floor selector (live mode) */}
        {appMode === 'live' && sidebarOpen && (
          <div className="w-48 border-r border-slate-800 flex flex-col bg-slate-900 overflow-y-auto shrink-0">
            <LayerSelector active={activeLayerId} onChange={setActiveLayer} monitorLayers={monitorLayers} />
            <div className="border-t border-slate-800 p-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">Etagen</p>
              <button onClick={() => setSelectedFloorFilter('all')}
                className={['w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors mb-1',
                  selectedFloorFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'].join(' ')}>
                Alle Etagen
              </button>
              {building.floors.slice().sort((a, b) => b.level - a.level).map(floor => (
                <button key={floor.id} onClick={() => setSelectedFloorFilter(floor.id)}
                  className={['w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors mb-0.5',
                    selectedFloorFilter === floor.id ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'].join(' ')}>
                  {floor.name}
                  <span className="ml-1 text-slate-600">({floor.rooms.length})</span>
                </button>
              ))}
            </div>

            {/* Room list */}
            {filteredRooms.length > 0 && (
              <div className="border-t border-slate-800 flex flex-col overflow-hidden flex-1 min-h-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2">
                  Räume ({filteredRooms.length})
                </p>
                <div className="flex-1 overflow-y-auto px-1.5 pb-2">
                  {filteredRooms.map(({ room, floor }) => {
                    const lv = getRoomLayerValue(room.id);
                    const hasAlarm = lv?.status === 'alarm';
                    const displayColor = lv && activeLayerId !== 'normal' && activeMonitorLayer
                      ? (getRoomLayerColor(lv.value as number, activeMonitorLayer) || room.color)
                      : room.color || '#94a3b8';
                    return (
                      <button key={room.id} onClick={() => setSelectedRoomId(room.id)}
                        className={['w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left group text-xs',
                          selectedRoomId === room.id ? 'bg-slate-700' : 'hover:bg-slate-800'].join(' ')}>
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: displayColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300 truncate group-hover:text-white">{room.name}</p>
                          {lv && activeLayerId !== 'normal' && <p className={hasAlarm ? 'text-red-400' : 'text-slate-500'}>{lv.formattedValue}</p>}
                        </div>
                        {hasAlarm && <AlertTriangle size={9} className="text-red-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Center: 3D canvas (live) or editor (edit) */}
        <div className="flex-1 relative overflow-hidden min-w-0">
          {appMode === 'live' ? (
            <>
              <BuildingCanvas3D
                buildings={buildingsWithLayerColors}
                activeFloorId={selectedFloorFilter === 'all' ? null : selectedFloorFilter}
                selectedRoomId={selectedRoomId}
                selectedWallId={null}
                onSelectRoom={handleRoomClick}
                onSelectWall={() => {}}
                highlightFloor={false}
                bgColor={canvas3D.bgColor}
                bgTransparent={canvas3D.bgTransparent}
                buildingMode={canvas3D.buildingMode}
                lighting={canvas3D.lighting}
                explosion={canvas3D.explosion}
                wallsTransparent={canvas3D.wallsTransparent}
                xrayOpacity={canvas3D.xrayOpacity}
                floorTransparent={canvas3D.floorTransparent}
                showGrid={canvas3D.showGrid}
                autoRotate={canvas3D.autoRotate}
                onRoomHover={handleRoomHover}
              />

              {/* search overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Raum suchen..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-600 w-40"
                  />
                </div>
              </div>
              {searchQuery && filteredRooms.length > 0 && (
                <div className="absolute top-11 left-3 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl overflow-hidden w-48 max-h-48 overflow-y-auto z-20">
                  {filteredRooms.slice(0, 8).map(({ room, floor }) => (
                    <button key={room.id} onClick={() => { setSelectedRoomId(room.id); setSearchQuery(''); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 transition-colors text-left">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 truncate">{room.name}</p>
                        <p className="text-[10px] text-slate-500">{floor.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* legend */}
              <div className="absolute bottom-4 left-4 pointer-events-none">
                <LegendPanel activeLayerId={activeLayerId} monitorLayers={monitorLayers} />
              </div>

              {/* building info */}
              <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400">
                <p className="font-medium text-slate-300">{building.name}</p>
                <p>{building.floors.length} Etagen · {allRoomIds.length} Räume</p>
                {alarmRooms.length > 0 && <p className="text-red-400 mt-0.5 flex items-center gap-1"><AlertTriangle size={9} />{alarmRooms.length} Alarme</p>}
              </div>

              {/* live indicator */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-full text-xs text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            </>
          ) : editSub === '3d' ? (
            <BuildingView
              liveValues={liveValues}
              pages={pages}
              haEntities={haEntities}
              haLoading={haLoading}
              onLoadHaEntities={onLoadHaEntities}
            />
          ) : (
            <RoomEditorView
              building={building}
              onUpdateBuilding={replaceBuilding}
              onOpenRoom={(roomId) => { setSelectedRoomId(roomId); setAppMode('live'); }}
              datapointGroups={logicPageGroups}
              datapointLabels={datapointLabels}
              liveValues={liveValues}
            />
          )}
        </div>

        {/* Right: Room side panel */}
        {selectedRoomId && (
          <div
            className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col overflow-hidden shrink-0 animate-[slideInRight_.18s_ease-out]"
            style={{ animation: 'slideInFromRight .18s ease-out' }}
          >
            <RoomSidePanel
              buildingId={buildingId!}
              roomId={selectedRoomId}
              appMode={appMode}
              onClose={() => setSelectedRoomId(null)}
              onSwitchToEdit={handleSwitchToEdit}
              datapointGroups={logicPageGroups}
            />
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hoveredRoom && !selectedRoomId && appMode === 'live' && (
        <RoomTooltip
          room={hoveredRoom}
          liveValue={hoveredRoomId ? getRoomLayerValue(hoveredRoomId) : null}
          activeLayerId={activeLayerId}
          activeLayer={activeMonitorLayer}
          x={tooltipPos.x}
          y={tooltipPos.y}
        />
      )}
    </div>
  );
}
