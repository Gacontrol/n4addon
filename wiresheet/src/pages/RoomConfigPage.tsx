import { useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Thermometer, Wind, Droplets, Activity, Users, AlertTriangle,
  Zap, Settings, Eye, Star, Building2, Gauge, RefreshCw, Plug, Fan,
  Lightbulb, Bell, Snowflake, Flame, Search, Trash2, GripVertical,
  SlidersHorizontal, ToggleLeft, Hash, BarChart2, Tag, CircleDot, ChevronLeft,
  Monitor, Link, Type, X, ChevronRight,
} from 'lucide-react';
import { RoomMonitorConfig, RoomDataPointConfig, WidgetType } from '../types/bms';
import { RoomDataPointBinding } from '../types/building';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';
import type { DatapointGroup } from '../components/building/RoomBindingsPanel';

// ---- Category display helpers ----

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  temperature: <Thermometer size={13} />,
  humidity: <Droplets size={13} />,
  co2: <Wind size={13} />,
  airflow: <Wind size={13} />,
  pressure: <Activity size={13} />,
  occupancy: <Users size={13} />,
  alarm: <AlertTriangle size={13} />,
  mode: <RefreshCw size={13} />,
  setpoint: <Gauge size={13} />,
  energy: <Zap size={13} />,
  valvePosition: <Activity size={13} />,
  valve: <Activity size={13} />,
  fanSpeed: <Fan size={13} />,
  fan: <Fan size={13} />,
  vavFlow: <Wind size={13} />,
  windowState: <Activity size={13} />,
  comfortIndex: <Activity size={13} />,
  light: <Lightbulb size={13} />,
  pump: <Plug size={13} />,
  cold: <Snowflake size={13} />,
  bell: <Bell size={13} />,
  fire: <Flame size={13} />,
  generic: <Activity size={13} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  temperature: '#ef4444',
  setpoint: '#f97316',
  humidity: '#06b6d4',
  co2: '#a78bfa',
  airflow: '#0ea5e9',
  occupancy: '#10b981',
  alarm: '#ef4444',
  energy: '#f59e0b',
  valvePosition: '#14b8a6',
  fanSpeed: '#6366f1',
  mode: '#8b5cf6',
  generic: '#64748b',
  light: '#fbbf24',
  pump: '#22c55e',
  cold: '#67e8f9',
};

const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e', warning: '#f59e0b', alarm: '#ef4444', offline: '#64748b',
};

const CATEGORY_OPTIONS = [
  'temperature','setpoint','humidity','co2','airflow','occupancy',
  'alarm','energy','mode','valvePosition','fanSpeed','generic',
];

// ---- Widget type definitions ----

const WIDGET_TYPES: {
  type: WidgetType;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultW: number;
  defaultH: number;
}[] = [
  { type: 'kpi',         label: 'KPI',        icon: <Hash size={13} />,              description: 'Großer Zahlenwert',   defaultW: 1, defaultH: 1 },
  { type: 'gauge',       label: 'Gauge',       icon: <CircleDot size={13} />,          description: 'Kreisanzeige',         defaultW: 1, defaultH: 1 },
  { type: 'slider',      label: 'Slider',      icon: <SlidersHorizontal size={13} />,  description: 'Sollwert-Regler',      defaultW: 2, defaultH: 1 },
  { type: 'incrementer', label: 'Inkrement.',  icon: <ChevronLeft size={13} />,        description: '+/– Schaltflächen',    defaultW: 1, defaultH: 1 },
  { type: 'switch',      label: 'Schalter',    icon: <ToggleLeft size={13} />,         description: 'Ein/Aus',              defaultW: 1, defaultH: 1 },
  { type: 'badge',       label: 'Badge',       icon: <AlertTriangle size={13} />,      description: 'Status-Badge',         defaultW: 1, defaultH: 1 },
  { type: 'row',         label: 'Zeile',       icon: <Tag size={13} />,               description: 'Kompakte Zeile',       defaultW: 2, defaultH: 1 },
  { type: 'chart',       label: 'Verlauf',     icon: <BarChart2 size={13} />,          description: 'Historischer Verlauf', defaultW: 2, defaultH: 1 },
  { type: 'label',       label: 'Anzeige',     icon: <Eye size={13} />,               description: 'Nur-Lese Anzeige',    defaultW: 1, defaultH: 1 },
];

// ---- Grid constants ----

const COLS = 4;
const ROWS = 8;
const CW = 144;
const CH = 84;
const GAP = 8;

// ---- Mock value for widget previews ----

function mockVal(cat: string, unit?: string) {
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

// ---- Widget preview (design-time rendering) ----

function WidgetPreview({ cfg, accent, selected }: { cfg: RoomDataPointConfig; accent: string; selected: boolean }) {
  const cat = cfg.category ?? 'generic';
  const m = mockVal(cat, cfg.unit);
  const icon = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.generic;
  const cc = CATEGORY_COLORS[cat] ?? '#64748b';
  const sc = STATUS_COLORS[m.s] ?? '#64748b';
  const min = cfg.minValue ?? 0;
  const max = cfg.maxValue ?? 100;
  const pct = Math.min(100, Math.max(0, ((m.n - min) / (max - min)) * 100));
  const border = selected ? `2px solid ${accent}` : '1px solid rgba(100,116,139,0.25)';
  const base = 'w-full h-full rounded-xl overflow-hidden bg-slate-800/80';

  switch (cfg.widgetType) {
    case 'slider':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col justify-between p-2.5">
            <div className="flex items-center gap-1.5">
              <span style={{ color: cc }}>{icon}</span>
              <span className="text-[10px] text-slate-400 truncate flex-1">{cfg.label}</span>
              <span className="text-xs font-bold text-white shrink-0">{m.v}<span className="text-[9px] font-normal text-slate-400 ml-0.5">{m.u}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-600 shrink-0">{min}</span>
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
              </div>
              <span className="text-[9px] text-slate-600 shrink-0">{max}</span>
            </div>
          </div>
        </div>
      );
    case 'incrementer':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col items-center justify-center gap-1 p-2">
            <span className="text-[10px] text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold">−</div>
              <span className="text-sm font-bold text-white min-w-8 text-center">{m.v}</span>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: accent }}>+</div>
            </div>
            <span className="text-[9px] text-slate-500">{m.u}</span>
          </div>
        </div>
      );
    case 'gauge':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col items-center justify-center gap-0.5 p-2">
            <span className="text-[10px] text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 48 48" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth="4" />
                <circle cx="24" cy="24" r="18" fill="none" stroke={accent} strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 18 * pct / 100} ${2 * Math.PI * 18}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{m.v}</span>
              </div>
            </div>
            <span className="text-[9px] text-slate-500">{m.u}</span>
          </div>
        </div>
      );
    case 'badge':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col items-center justify-center gap-1 p-2">
            <span style={{ color: cc }}>{icon}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${sc}22`, color: sc }}>{m.v}</span>
            <span className="text-[9px] text-slate-500 truncate text-center">{cfg.label}</span>
          </div>
        </div>
      );
    case 'switch':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col items-center justify-center gap-1.5 p-2">
            <span className="text-[10px] text-slate-400 truncate w-full text-center">{cfg.label}</span>
            <div className="w-9 h-5 rounded-full flex items-center px-0.5" style={{ background: accent }}>
              <div className="w-4 h-4 bg-white rounded-full ml-auto shadow" />
            </div>
            <span className="text-[9px] text-slate-400">EIN</span>
          </div>
        </div>
      );
    case 'chart':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col justify-between p-2.5">
            <div className="flex items-center gap-1.5">
              <span style={{ color: cc }}>{icon}</span>
              <span className="text-[10px] text-slate-400 truncate flex-1">{cfg.label}</span>
              <span className="text-xs font-bold text-white shrink-0">{m.v} {m.u}</span>
            </div>
            <svg viewBox="0 0 80 20" className="w-full" preserveAspectRatio="none">
              {[.4,.6,.5,.7,.45,.8,.6,.75,.65,.55].map((v, i, a) =>
                i < a.length - 1 ? (
                  <line key={i}
                    x1={(i / (a.length - 1)) * 80} y1={20 - v * 18}
                    x2={((i + 1) / (a.length - 1)) * 80} y2={20 - (a[i + 1]) * 18}
                    stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
                ) : null
              )}
            </svg>
          </div>
        </div>
      );
    case 'row':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex items-center gap-2.5 px-3">
            <span style={{ color: cc }} className="shrink-0">{icon}</span>
            <span className="text-xs text-slate-300 flex-1 truncate">{cfg.label}</span>
            <span className="text-xs font-semibold text-white shrink-0">{m.v} {m.u}</span>
          </div>
        </div>
      );
    case 'label':
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col items-center justify-center gap-0.5 p-2">
            <span style={{ color: cc }}>{icon}</span>
            <span className="text-lg font-bold text-white leading-none">{m.v}</span>
            <span className="text-[10px] text-slate-400">{m.u}</span>
            <span className="text-[9px] text-slate-500 truncate">{cfg.label}</span>
          </div>
        </div>
      );
    default: // kpi
      return (
        <div className={base} style={{ border }}>
          <div className="h-full flex flex-col justify-between p-2.5">
            <div className="flex items-center gap-1.5">
              <span style={{ color: cc }}>{icon}</span>
              <span className="text-[10px] text-slate-400 truncate">{cfg.label}</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-xl font-bold leading-none" style={{ color: sc }}>{m.v}</span>
              {m.u && <span className="text-xs text-slate-400 pb-0.5">{m.u}</span>}
            </div>
          </div>
        </div>
      );
  }
}

// ---- Toggle switch ----

function Toggle({ value, onChange, color = 'bg-sky-600' }: { value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <div onClick={() => onChange(!value)}
      className={['w-8 h-4 rounded-full flex items-center px-0.5 transition-colors cursor-pointer shrink-0', value ? color : 'bg-slate-700'].join(' ')}>
      <div className={['w-3 h-3 bg-white rounded-full shadow transition-transform', value ? 'translate-x-4' : ''].join(' ')} />
    </div>
  );
}

// ---- Types ----

interface PaletteSource {
  id: string;
  label: string;
  datapoint: string;
  category: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  isBinding: boolean;
}

// ---- Helpers ----

function defaultWidgetType(cat: string): WidgetType {
  if (cat === 'setpoint') return 'slider';
  if (cat === 'alarm') return 'badge';
  if (cat === 'occupancy') return 'badge';
  if (cat === 'mode') return 'switch';
  return 'kpi';
}

function findFreeCell(widgets: RoomDataPointConfig[], w: number, h: number): { col: number; row: number } {
  for (let row = 0; row <= ROWS - h; row++) {
    for (let col = 0; col <= COLS - w; col++) {
      const blocked = widgets.some(wg => {
        const wc = wg.panelCol ?? 0, wr = wg.panelRow ?? 0;
        const ww = wg.panelW ?? 1, wh = wg.panelH ?? 1;
        return col < wc + ww && col + w > wc && row < wr + wh && row + h > wr;
      });
      if (!blocked) return { col, row };
    }
  }
  return { col: 0, row: widgets.length % ROWS };
}

function makeWidget(src: PaletteSource, existing: RoomDataPointConfig[]): RoomDataPointConfig {
  const wt = defaultWidgetType(src.category);
  const def = WIDGET_TYPES.find(x => x.type === wt)!;
  const pos = findFreeCell(existing, def.defaultW, def.defaultH);
  return {
    datapointId: src.id,
    label: src.label,
    displayType: 'kpi',
    widgetType: wt,
    order: existing.length,
    panelCol: pos.col,
    panelRow: pos.row,
    panelW: def.defaultW,
    panelH: def.defaultH,
    showInMonitor: true,
    showInService: true,
    showInTooltip: existing.length < 3,
    showInBuilding: true,
    isPrimaryRoomKPI: existing.length === 0,
    isPrimaryBuildingPoint: existing.length === 0,
    writable: wt === 'slider' || wt === 'incrementer' || wt === 'switch',
    unit: src.unit,
    minValue: src.minValue,
    maxValue: src.maxValue,
    category: src.category,
    sourceDatapoint: src.datapoint,
  };
}

// ---- Datapoint picker modal ----

interface DpPickerModalProps {
  currentValue: string;
  suggestions: PaletteSource[];
  onSelect: (v: string) => void;
  onClose: () => void;
  datapointGroups?: DatapointGroup[];
}

function DpPickerModal({ currentValue, suggestions, onSelect, onClose, datapointGroups = [] }: DpPickerModalProps) {
  const [q, setQ] = useState('');
  const [pageId, setPageId] = useState<string | null>(null);

  const pick = (dp: string) => { onSelect(dp); onClose(); };

  const qLow = q.trim().toLowerCase();

  const filteredSuggestions = qLow
    ? suggestions.filter(s => s.datapoint.toLowerCase().includes(qLow) || s.label.toLowerCase().includes(qLow))
    : suggestions;

  const filteredGroups = datapointGroups.filter(g =>
    !qLow || g.pageName.toLowerCase().includes(qLow) || g.datapoints.some(d => d.entityId.toLowerCase().includes(qLow) || d.label.toLowerCase().includes(qLow))
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Datenpunkt wählen</div>
            {currentValue && <div className="text-xs text-sky-300 font-mono truncate mt-0.5">{currentValue}</div>}
          </div>
          <div className="flex items-center gap-2">
            {currentValue && (
              <button onClick={() => { onSelect(''); onClose(); }} className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-rose-300 hover:bg-rose-900/30 transition-colors">
                Zurücksetzen
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Back breadcrumb when inside a page */}
        {pageId !== null && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/60">
            <button onClick={() => { setPageId(null); setQ(''); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              <ChevronRight size={13} className="rotate-180" /> Zurück
            </button>
            <span className="text-slate-600 text-xs">/</span>
            <span className="text-xs text-slate-200 font-medium truncate">
              {datapointGroups.find(g => g.pageId === pageId)?.pageName ?? pageId}
            </span>
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-2 border-b border-slate-800">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5">
            <Search size={13} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Suchen oder Pfad direkt eingeben…"
              className="flex-1 bg-transparent text-slate-200 text-xs outline-none placeholder-slate-500"
              onKeyDown={e => { if (e.key === 'Enter' && q.trim()) pick(q.trim()); }}
            />
            {q.trim() && (
              <button
                onMouseDown={() => pick(q.trim())}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] transition-colors"
              >
                <Check size={10} /> Übernehmen
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {pageId === null ? (
            <>
              {/* Room bindings */}
              {filteredSuggestions.length > 0 && (
                <>
                  <div className="px-4 py-1.5 border-b border-slate-800/50 bg-slate-800/20">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Raum-Datenpunkte</p>
                  </div>
                  {filteredSuggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => pick(s.datapoint)}
                      className={['w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/30 transition-colors text-left', currentValue === s.datapoint ? 'bg-sky-950/30' : ''].join(' ')}
                    >
                      <span style={{ color: CATEGORY_COLORS[s.category] ?? '#64748b' }} className="shrink-0">
                        {CATEGORY_ICONS[s.category] ?? CATEGORY_ICONS.generic}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">{s.label}</p>
                        {s.label !== s.datapoint && <p className="text-[10px] text-slate-500 font-mono truncate">{s.datapoint}</p>}
                      </div>
                      {currentValue === s.datapoint && <Check size={11} className="text-sky-400 shrink-0" />}
                    </button>
                  ))}
                </>
              )}

              {/* Logic page groups */}
              {filteredGroups.length > 0 && (
                <>
                  <div className="px-4 py-1.5 border-b border-slate-800/50 bg-slate-800/20">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Logik-Seiten</p>
                  </div>
                  {filteredGroups.map(g => (
                    <button
                      key={g.pageId}
                      onClick={() => { setPageId(g.pageId); setQ(''); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                          <Zap size={12} className="text-emerald-400" />
                        </div>
                        <span className="text-xs text-slate-200 font-medium">{g.pageName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{g.datapoints.length}</span>
                        <ChevronRight size={13} className="text-slate-500" />
                      </div>
                    </button>
                  ))}
                </>
              )}

              {filteredSuggestions.length === 0 && filteredGroups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-600">
                  <Activity size={24} className="mb-2 opacity-30" />
                  <p className="text-xs text-center">Keine Datenpunkte gefunden.</p>
                  <p className="text-[10px] text-center mt-1 text-slate-700">Pfad oben eingeben + Enter drücken.</p>
                </div>
              )}
            </>
          ) : (() => {
            const g = datapointGroups.find(x => x.pageId === pageId);
            const list = g
              ? (qLow ? g.datapoints.filter(d => d.entityId.toLowerCase().includes(qLow) || d.label.toLowerCase().includes(qLow)) : g.datapoints)
              : [];
            if (list.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Search size={24} className="mb-2 opacity-30" />
                  <span className="text-xs">Keine Treffer</span>
                </div>
              );
            }
            return list.map(dp => {
              const primary = dp.label && dp.label !== dp.entityId ? dp.label : dp.entityId;
              const showSub = primary !== dp.entityId;
              return (
                <button
                  key={dp.entityId}
                  onClick={() => pick(dp.entityId)}
                  className={['w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800 transition-colors text-left border-b border-slate-800/30', currentValue === dp.entityId ? 'bg-sky-950/30' : ''].join(' ')}
                >
                  <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center shrink-0">
                    <Zap size={11} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-200 truncate">{primary}</p>
                    {showSub && <p className="text-[10px] text-slate-500 font-mono truncate">{dp.entityId}</p>}
                  </div>
                  {currentValue === dp.entityId && <Check size={11} className="text-sky-400 shrink-0" />}
                </button>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

// ---- Page ----

interface RoomConfigPageProps {
  buildingId?: string;
  roomId?: string;
  onBack?: () => void;
  onOpenMonitor?: () => void;
  datapointGroups?: DatapointGroup[];
}

export function RoomConfigPage({
  buildingId: propBuildingId,
  roomId: propRoomId,
  onBack,
  onOpenMonitor,
  datapointGroups: propDatapointGroups,
}: RoomConfigPageProps) {
  const params = useParams<{ buildingId: string; roomId: string }>();
  const navigate = useNavigate();
  const bId = propBuildingId ?? params.buildingId;
  const rId = propRoomId ?? params.roomId;
  const goBack = onBack ?? (() => navigate(-1));
  const goMonitor = onOpenMonitor ?? (() => navigate(`/building/${bId}/room/${rId}/monitor`));
  const { buildings, monitorConfigs, saveRoomMonitorConfig, datapointGroups: ctxGroups } = useBuildingContext();
  const datapointGroups = propDatapointGroups ?? ctxGroups;

  const building = buildings.find(b => b.id === bId);
  const { floor, room } = useMemo(() => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === rId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, rId]);

  const bindings: RoomDataPointBinding[] = room?.bindings ?? [];

  // All palette sources: room bindings + external datapoints from logic
  const allSources = useMemo<PaletteSource[]>(() => {
    const list: PaletteSource[] = bindings.map(b => ({
      id: b.id,
      label: b.label ?? b.datapoint,
      datapoint: b.datapoint,
      category: b.category,
      unit: b.unit,
      minValue: b.minValue,
      maxValue: b.maxValue,
      isBinding: true,
    }));
    for (const grp of datapointGroups) {
      for (const dp of grp.datapoints) {
        if (!list.find(s => s.datapoint === dp.entityId)) {
          list.push({
            id: `ext-${dp.entityId}`,
            label: dp.label || dp.entityId,
            datapoint: dp.entityId,
            category: 'generic',
            isBinding: false,
          });
        }
      }
    }
    return list;
  }, [bindings, datapointGroups]);

  const savedCfg = monitorConfigs[rId ?? ''];

  const initialWidgets = useMemo<RoomDataPointConfig[]>(() => {
    if (!rId) return [];
    if (savedCfg && savedCfg.datapoints.length > 0) {
      return savedCfg.datapoints.map(dp => ({
        ...dp,
        widgetType: dp.widgetType ?? defaultWidgetType(dp.category ?? 'generic'),
        panelW: dp.panelW ?? 1,
        panelH: dp.panelH ?? 1,
      }));
    }
    if (bindings.length > 0) {
      const result: RoomDataPointConfig[] = [];
      for (const b of [...bindings].sort((a, x) => (a.order ?? 0) - (x.order ?? 0))) {
        result.push(makeWidget({
          id: b.id, label: b.label ?? b.datapoint, datapoint: b.datapoint,
          category: b.category, unit: b.unit, minValue: b.minValue, maxValue: b.maxValue,
          isBinding: true,
        }, result));
      }
      return result;
    }
    return [];
  }, [rId, savedCfg, bindings]);

  const [widgets, setWidgets] = useState<RoomDataPointConfig[]>(initialWidgets);
  const [accent, setAccent] = useState(savedCfg?.accentColor ?? room?.color ?? '#0ea5e9');
  const [panelTitle, setPanelTitle] = useState(savedCfg?.panelTitle ?? '');
  const [panelSubtitle, setPanelSubtitle] = useState(savedCfg?.panelSubtitle ?? '');
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(new Set(savedCfg?.hiddenTabs ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerWidgetId, setPickerWidgetId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [dropOver, setDropOver] = useState<{ col: number; row: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const paletteDragSrc = useRef<PaletteSource | null>(null);
  const widgetDragId = useRef<string | null>(null);

  const selected = widgets.find(w => w.datapointId === selectedId) ?? null;
  const usedIds = new Set(widgets.map(w => w.datapointId));
  const available = allSources.filter(s => !usedIds.has(s.id));
  const filtered = search.trim()
    ? available.filter(s => s.label.toLowerCase().includes(search.toLowerCase()) || s.datapoint.toLowerCase().includes(search.toLowerCase()))
    : available;

  const getCell = useCallback((cx: number, cy: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const col = Math.floor((cx - rect.left - GAP) / (CW + GAP));
    const row = Math.floor((cy - rect.top - GAP) / (CH + GAP));
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets(p => p.filter(w => w.datapointId !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const updateWidget = useCallback((id: string, patch: Partial<RoomDataPointConfig>) => {
    setWidgets(p => p.map(w => w.datapointId === id ? { ...w, ...patch } : w));
  }, []);

  const changeWidgetType = useCallback((id: string, type: WidgetType) => {
    const def = WIDGET_TYPES.find(x => x.type === type)!;
    updateWidget(id, { widgetType: type, panelW: def.defaultW, panelH: def.defaultH });
  }, [updateWidget]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropOver(null);
    const cell = getCell(e.clientX, e.clientY);
    if (!cell) return;

    if (widgetDragId.current) {
      const id = widgetDragId.current;
      widgetDragId.current = null;
      const wg = widgets.find(w => w.datapointId === id);
      if (wg) updateWidget(id, {
        panelCol: Math.min(cell.col, COLS - (wg.panelW ?? 1)),
        panelRow: Math.min(cell.row, ROWS - (wg.panelH ?? 1)),
      });
      return;
    }

    if (paletteDragSrc.current) {
      const src = paletteDragSrc.current;
      paletteDragSrc.current = null;
      const newW = makeWidget(src, widgets);
      newW.panelCol = Math.min(cell.col, COLS - (newW.panelW ?? 1));
      newW.panelRow = Math.min(cell.row, ROWS - (newW.panelH ?? 1));
      setWidgets(p => [...p, newW]);
      setSelectedId(newW.datapointId);
    }
  }, [getCell, widgets, updateWidget]);

  const handleSave = () => {
    if (!rId) return;
    saveRoomMonitorConfig({
      roomId: rId, datapoints: widgets, accentColor: accent, layout: 'grid',
      panelTitle, panelSubtitle,
      hiddenTabs: Array.from(hiddenTabs) as ('overview' | 'points' | 'alarms' | 'trends')[],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!building || !room || !floor) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-200 items-center justify-center">
        <p className="text-slate-400 mr-4">Raum nicht gefunden</p>
        <button onClick={goBack} className="px-4 py-2 bg-slate-700 rounded-lg text-sm">Zurück</button>
      </div>
    );
  }

  const canvasW = COLS * (CW + GAP) + GAP;
  const canvasH = ROWS * (CH + GAP) + GAP;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-2.5 shrink-0 flex items-center gap-3">
        <button onClick={goBack} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={15} />
        </button>
        <Breadcrumbs items={[
          { label: building.name, onClick: goBack, icon: 'building' },
          { label: room.name, onClick: goMonitor, icon: 'room' },
          { label: 'Panel-Designer' },
        ]} />
        <div className="flex-1" />
        <div className="flex items-center gap-2 mr-2">
          <span className="text-[10px] text-slate-500">Akzentfarbe</span>
          <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
        </div>
        <button onClick={goMonitor} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors flex items-center gap-1.5">
          <Monitor size={12} /> Monitor
        </button>
        <button
          onClick={handleSave}
          className={['flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
            saved ? 'bg-emerald-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'].join(' ')}
        >
          <Check size={14} />
          {saved ? 'Gespeichert' : 'Speichern'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ---- LEFT: Palette ---- */}
        <div className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 border-b border-slate-800 shrink-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Datenpunkte</p>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {allSources.length === 0 && (
              <div className="py-8 text-center text-slate-600 text-xs px-2">
                <Settings size={18} className="mx-auto mb-2 opacity-30" />
                <p>Keine Datenpunkte verfügbar.</p>
                <p className="mt-1 text-slate-700">Weise dem Raum im Editor zuerst Bindings zu.</p>
              </div>
            )}
            {filtered.length === 0 && allSources.length > 0 && (
              <p className="text-xs text-slate-600 text-center py-4">Keine Treffer</p>
            )}
            {filtered.map(src => {
              const cc = CATEGORY_COLORS[src.category] ?? '#64748b';
              const icon = CATEGORY_ICONS[src.category] ?? CATEGORY_ICONS.generic;
              return (
                <div
                  key={src.id}
                  draggable
                  onDragStart={e => {
                    paletteDragSrc.current = src;
                    widgetDragId.current = null;
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:border-slate-600 hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors group select-none"
                >
                  <span style={{ color: cc }} className="shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{src.label}</p>
                    <p className="text-[10px] text-slate-600 font-mono truncate">{src.datapoint}</p>
                  </div>
                  {src.isBinding && <span className="text-[9px] text-sky-700 shrink-0">●</span>}
                </div>
              );
            })}

            {widgets.length > 0 && (
              <div className="pt-2 border-t border-slate-800 mt-1">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 mb-1.5">Im Panel ({widgets.length})</p>
                {widgets.map(w => {
                  const cc = CATEGORY_COLORS[w.category ?? 'generic'] ?? '#64748b';
                  const icon = CATEGORY_ICONS[w.category ?? 'generic'] ?? CATEGORY_ICONS.generic;
                  return (
                    <div
                      key={w.datapointId}
                      onClick={() => setSelectedId(w.datapointId === selectedId ? null : w.datapointId)}
                      className={['flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors',
                        selectedId === w.datapointId ? 'bg-sky-900/40 border border-sky-700/50' : 'hover:bg-slate-800/50 border border-transparent'].join(' ')}
                    >
                      <span style={{ color: cc }} className="shrink-0">{icon}</span>
                      <span className="text-xs text-slate-400 flex-1 truncate">{w.label}</span>
                      <button onClick={e => { e.stopPropagation(); removeWidget(w.datapointId); }}
                        className="p-0.5 text-slate-600 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---- CENTER: Canvas ---- */}
        <div className="flex-1 overflow-auto bg-slate-950 flex flex-col items-center py-5 px-4"
          onClick={() => setSelectedId(null)}>

          {/* Panel header preview + config */}
          <div className="mb-3 w-full" style={{ maxWidth: canvasW }}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
              <div className="w-1 h-10 rounded-full shrink-0" style={{ background: accent }} />
              <div className="flex-1 min-w-0">
                <input
                  value={panelTitle || room.name}
                  onChange={e => setPanelTitle(e.target.value)}
                  placeholder={room.name}
                  className="w-full bg-transparent text-base font-bold text-white focus:outline-none placeholder-slate-600"
                  onClick={e => e.stopPropagation()}
                />
                <input
                  value={panelSubtitle}
                  onChange={e => setPanelSubtitle(e.target.value)}
                  placeholder={`${floor.name} · Untertitel…`}
                  className="w-full bg-transparent text-xs text-slate-400 focus:outline-none placeholder-slate-600 mt-0.5"
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <Type size={10} />
                Panel-Kopfzeile
              </div>
            </div>
          </div>

          {/* Drop canvas */}
          <div
            ref={canvasRef}
            style={{ width: canvasW, minWidth: canvasW, height: canvasH, minHeight: canvasH }}
            className="relative rounded-2xl border border-slate-800 bg-slate-900/60"
            onDragOver={e => { e.preventDefault(); setDropOver(getCell(e.clientX, e.clientY)); }}
            onDrop={handleDrop}
            onDragLeave={() => setDropOver(null)}
            onClick={e => e.stopPropagation()}
          >
            {/* Grid cells */}
            {Array.from({ length: ROWS }, (_, row) =>
              Array.from({ length: COLS }, (_, col) => (
                <div key={`g-${col}-${row}`} style={{
                  position: 'absolute',
                  left: GAP + col * (CW + GAP), top: GAP + row * (CH + GAP),
                  width: CW, height: CH,
                }} className="rounded-xl border border-slate-800/50 bg-slate-800/10" />
              ))
            )}

            {/* Drop preview */}
            {dropOver && paletteDragSrc.current && (() => {
              const wt = defaultWidgetType(paletteDragSrc.current!.category);
              const def = WIDGET_TYPES.find(x => x.type === wt)!;
              const w = def.defaultW, h = def.defaultH;
              const col = Math.min(dropOver.col, COLS - w);
              const row = Math.min(dropOver.row, ROWS - h);
              return (
                <div style={{
                  position: 'absolute',
                  left: GAP + col * (CW + GAP), top: GAP + row * (CH + GAP),
                  width: w * CW + (w - 1) * GAP, height: h * CH + (h - 1) * GAP,
                  border: `2px dashed ${accent}`, borderRadius: 12,
                  background: `${accent}18`, pointerEvents: 'none', zIndex: 5,
                }} />
              );
            })()}

            {/* Widgets */}
            {widgets.map(w => {
              const col = w.panelCol ?? 0, row = w.panelRow ?? 0;
              const ww = w.panelW ?? 1, wh = w.panelH ?? 1;
              return (
                <div key={w.datapointId}
                  draggable
                  onDragStart={e => {
                    e.stopPropagation();
                    widgetDragId.current = w.datapointId;
                    paletteDragSrc.current = null;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={e => { e.stopPropagation(); setSelectedId(w.datapointId === selectedId ? null : w.datapointId); }}
                  style={{
                    position: 'absolute',
                    left: GAP + col * (CW + GAP), top: GAP + row * (CH + GAP),
                    width: ww * CW + (ww - 1) * GAP, height: wh * CH + (wh - 1) * GAP,
                    zIndex: selectedId === w.datapointId ? 10 : 2,
                  }}
                  className="cursor-grab active:cursor-grabbing select-none"
                >
                  <WidgetPreview cfg={w} accent={accent} selected={selectedId === w.datapointId} />
                  {selectedId === w.datapointId && (
                    <button onClick={e => { e.stopPropagation(); removeWidget(w.datapointId); }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg z-20">
                      <Trash2 size={9} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[10px] text-slate-700">{COLS} Spalten × {ROWS} Zeilen · Widgets ziehen zum Verschieben</p>
        </div>

        {/* ---- RIGHT: Properties ---- */}
        <div className="shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden" style={{ width: 272 }}>
          {selected ? (
            <>
              <div className="px-4 pt-3 pb-2.5 border-b border-slate-800 shrink-0">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Widget-Eigenschaften</p>
                <input
                  value={selected.label}
                  onChange={e => updateWidget(selected.datapointId, { label: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                  placeholder="Bezeichnung"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* Datenpunkt-Binding */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Datenpunkt</p>
                  <button
                    onClick={() => setPickerWidgetId(selected.datapointId)}
                    className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs hover:border-sky-600 transition-colors group"
                  >
                    <Link size={10} className="text-slate-500 shrink-0 group-hover:text-sky-500 transition-colors" />
                    <span className={['flex-1 text-left truncate font-mono', selected.sourceDatapoint ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                      {selected.sourceDatapoint || 'Datenpunkt wählen…'}
                    </span>
                    <ChevronRight size={10} className="text-slate-600 shrink-0" />
                  </button>
                  {pickerWidgetId === selected.datapointId && (
                    <DpPickerModal
                      currentValue={selected.sourceDatapoint ?? ''}
                      suggestions={allSources}
                      datapointGroups={datapointGroups}
                      onSelect={v => {
                        const src = allSources.find(s => s.datapoint === v);
                        updateWidget(selected.datapointId, {
                          sourceDatapoint: v,
                          ...(src ? { category: src.category, unit: src.unit, minValue: src.minValue, maxValue: src.maxValue } : {}),
                        });
                        setPickerWidgetId(null);
                      }}
                      onClose={() => setPickerWidgetId(null)}
                    />
                  )}

                  {/* Category override */}
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-600 mb-1">Kategorie</p>
                    <select
                      value={selected.category ?? 'generic'}
                      onChange={e => updateWidget(selected.datapointId, { category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {CATEGORY_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Widget type selector */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Darstellungstyp</p>
                  <div className="grid grid-cols-3 gap-1">
                    {WIDGET_TYPES.map(wt => (
                      <button
                        key={wt.type}
                        onClick={() => changeWidgetType(selected.datapointId, wt.type)}
                        title={wt.description}
                        className={['flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-[10px] transition-all',
                          selected.widgetType === wt.type
                            ? 'border-sky-500 bg-sky-950/50 text-sky-300'
                            : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-slate-200'].join(' ')}
                      >
                        <span>{wt.icon}</span>
                        {wt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Größe</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-slate-600 mb-1">Breite (Spalten)</p>
                      <select value={selected.panelW ?? 1} onChange={e => updateWidget(selected.datapointId, { panelW: +e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 mb-1">Höhe (Zeilen)</p>
                      <select value={selected.panelH ?? 1} onChange={e => updateWidget(selected.datapointId, { panelH: +e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                        {[1, 2].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Value range */}
                {(selected.widgetType === 'slider' || selected.widgetType === 'gauge' || selected.widgetType === 'incrementer') && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Wertebereich</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-slate-600 mb-1">Min</p>
                        <input type="number" value={selected.minValue ?? 0}
                          onChange={e => updateWidget(selected.datapointId, { minValue: +e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-600 mb-1">Max</p>
                        <input type="number" value={selected.maxValue ?? 100}
                          onChange={e => updateWidget(selected.datapointId, { maxValue: +e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-600 mb-1">Einheit</p>
                        <input type="text" value={selected.unit ?? ''} placeholder="°C"
                          onChange={e => updateWidget(selected.datapointId, { unit: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Visibility */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Sichtbarkeit</p>
                  <div className="space-y-2">
                    {([
                      ['showInMonitor',  'Im Monitor anzeigen',  <Monitor size={10} />],
                      ['showInBuilding', 'Im Gebäude-Layer',     <Building2 size={10} />],
                      ['showInTooltip',  'Im Tooltip',           <Tag size={10} />],
                      ['showInService',  'Im Service-Modus',     <Settings size={10} />],
                    ] as [keyof RoomDataPointConfig, string, React.ReactNode][]).map(([key, lbl, icon]) => (
                      <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                        <Toggle value={!!selected[key]} onChange={v => updateWidget(selected.datapointId, { [key]: v })} />
                        <span className="text-slate-500 shrink-0">{icon}</span>
                        <span className="text-xs text-slate-400">{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Priorität</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <Toggle value={!!selected.isPrimaryRoomKPI} onChange={v => updateWidget(selected.datapointId, { isPrimaryRoomKPI: v })} color="bg-yellow-500" />
                      <Star size={10} className="text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400">Primärer Raum-KPI</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <Toggle value={!!selected.isPrimaryBuildingPoint} onChange={v => updateWidget(selected.datapointId, { isPrimaryBuildingPoint: v })} color="bg-amber-500" />
                      <Building2 size={10} className="text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-400">Gebäude-Hauptwert</span>
                    </label>
                  </div>
                </div>

                <button onClick={() => removeWidget(selected.datapointId)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 hover:bg-red-950/60 text-xs transition-colors">
                  <Trash2 size={11} /> Widget entfernen
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full overflow-y-auto">
              <div className="px-4 pt-3 pb-2 border-b border-slate-800 shrink-0">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Panel-Einstellungen</p>
              </div>
              <div className="p-4 space-y-5 flex-1 overflow-y-auto">
                {/* Tab visibility */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Sichtbare Tabs</p>
                  <p className="text-[10px] text-slate-600 mb-2">Tabs die im Monitor angezeigt werden:</p>
                  <div className="space-y-2">
                    {([
                      { id: 'panel',    label: 'Panel',       note: 'Nur wenn Widgets vorhanden', forced: true },
                      { id: 'overview', label: 'Übersicht',   note: 'KPIs + Alarmübersicht' },
                      { id: 'points',   label: 'Datenpunkte', note: 'Alle Datenpunkte als Liste' },
                      { id: 'alarms',   label: 'Alarme',      note: 'Aktive Alarme' },
                      { id: 'trends',   label: 'Trends',      note: 'Historische Verläufe' },
                    ] as { id: string; label: string; note: string; forced?: boolean }[]).map(tab => {
                      const isHidden = hiddenTabs.has(tab.id);
                      const isForced = tab.forced;
                      return (
                        <div key={tab.id} className="flex items-center gap-2.5">
                          <Toggle
                            value={!isHidden}
                            onChange={v => {
                              if (isForced) return;
                              setHiddenTabs(prev => {
                                const next = new Set(prev);
                                if (v) next.delete(tab.id); else next.add(tab.id);
                                return next;
                              });
                            }}
                            color={isForced ? 'bg-slate-600' : 'bg-sky-600'}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={['text-xs', isForced || !isHidden ? 'text-slate-300' : 'text-slate-600'].join(' ')}>{tab.label}</p>
                            <p className="text-[9px] text-slate-600">{tab.note}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Hinweis</p>
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                    <GripVertical size={12} className="text-slate-600 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-slate-600 leading-relaxed">Datenpunkt aus der linken Palette auf das Raster ziehen oder vorhandenes Widget anklicken.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
