import { useState, useMemo, useRef, useCallback } from 'react';
import {
  Check, Thermometer, Wind, Droplets, Activity, Users, AlertTriangle,
  Zap, Settings, Eye, Star, Building2, Gauge, RefreshCw, Plug, Fan,
  Lightbulb, Bell, Snowflake, Flame, Search, Trash2, GripVertical,
  SlidersHorizontal, ToggleLeft, Hash, BarChart2, Tag, CircleDot, ChevronLeft,
  Monitor, Link, Type, X, ChevronRight, Image as ImageIcon, Plus, Upload, FolderOpen,
} from 'lucide-react';
import { RoomMonitorConfig, RoomDataPointConfig, WidgetType } from '../../types/bms';
import { Room, RoomDataPointBinding } from '../../types/building';
import { useBuildingContext } from '../../context/BuildingContext';
import { FileManager } from '../visualization/FileManager';
import type { DatapointGroup } from './RoomBindingsPanel';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? m[1] : '';
}

async function uploadImageFile(file: File): Promise<string> {
  const apiBase = getApiBase();
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${apiBase}/api/images/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload fehlgeschlagen');
  const data = await res.json();
  return data.url as string;
}

function resolveImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const base = getApiBase();
  if (url.startsWith('/api/images/') || url.startsWith('/api/')) return `${base}${url}`;
  return url;
}

// ---- Category helpers ----

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
  { type: 'kpi',         label: 'KPI',        icon: <Hash size={13} />,              description: 'Großer Zahlenwert',    defaultW: 1, defaultH: 1 },
  { type: 'gauge',       label: 'Gauge',       icon: <CircleDot size={13} />,         description: 'Kreisanzeige',          defaultW: 1, defaultH: 1 },
  { type: 'slider',      label: 'Slider',      icon: <SlidersHorizontal size={13} />, description: 'Sollwert-Regler',       defaultW: 2, defaultH: 1 },
  { type: 'incrementer', label: 'Inkrement.',  icon: <ChevronLeft size={13} />,       description: '+/– Schaltflächen',     defaultW: 1, defaultH: 1 },
  { type: 'switch',      label: 'Schalter',    icon: <ToggleLeft size={13} />,        description: 'Ein/Aus',               defaultW: 1, defaultH: 1 },
  { type: 'badge',       label: 'Badge',       icon: <AlertTriangle size={13} />,     description: 'Status-Badge',          defaultW: 1, defaultH: 1 },
  { type: 'row',         label: 'Zeile',       icon: <Tag size={13} />,               description: 'Kompakte Zeile',        defaultW: 2, defaultH: 1 },
  { type: 'chart',       label: 'Verlauf',     icon: <BarChart2 size={13} />,         description: 'Historischer Verlauf',  defaultW: 2, defaultH: 1 },
  { type: 'label',       label: 'Anzeige',     icon: <Eye size={13} />,               description: 'Nur-Lese Anzeige',     defaultW: 1, defaultH: 1 },
  { type: 'title',       label: 'Text',        icon: <Type size={13} />,              description: 'Statischer Text/Titel', defaultW: 2, defaultH: 1 },
  { type: 'image',       label: 'Bild',        icon: <ImageIcon size={13} />,         description: 'Bild-URL',              defaultW: 2, defaultH: 2 },
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

// ---- Widget preview ----
// All widgets use percentage-based sizing so they fill the full cell area.

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
          <div className="w-full h-full flex flex-col justify-between p-[8%]">
            <div className="flex items-center gap-[4%] min-w-0">
              <span style={{ color: cc }} className="shrink-0">{icon}</span>
              <span className="text-slate-400 truncate flex-1 text-[clamp(9px,1.5cqw,13px)]">{cfg.label}</span>
              <span className="font-bold text-white shrink-0 text-[clamp(10px,2cqw,16px)]">
                {m.v}<span className="font-normal text-slate-400 text-[0.7em] ml-0.5">{m.u}</span>
              </span>
            </div>
            <div className="flex items-center gap-[3%]">
              <span className="text-slate-600 shrink-0 text-[clamp(8px,1.2cqw,11px)]">{min}</span>
              <div className="flex-1 rounded-full overflow-hidden bg-slate-700" style={{ height: 'clamp(4px,1%,8px)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
              </div>
              <span className="text-slate-600 shrink-0 text-[clamp(8px,1.2cqw,11px)]">{max}</span>
            </div>
          </div>
        </div>
      );
    case 'incrementer':
      return (
        <div className={base} style={{ border }}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-[4%] p-[6%]">
            <span className="text-slate-400 truncate w-full text-center text-[clamp(9px,1.5cqw,13px)]">{cfg.label}</span>
            <div className="flex items-center gap-[6%] w-full justify-center">
              <div className="rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-[clamp(12px,3cqw,22px)]"
                style={{ width: 'clamp(24px,20%,52px)', height: 'clamp(24px,20%,52px)' }}>−</div>
              <span className="font-bold text-white text-[clamp(16px,4cqw,32px)] min-w-[2ch] text-center">{m.v}</span>
              <div className="rounded-lg flex items-center justify-center text-white font-bold text-[clamp(12px,3cqw,22px)]"
                style={{ background: accent, width: 'clamp(24px,20%,52px)', height: 'clamp(24px,20%,52px)' }}>+</div>
            </div>
            <span className="text-slate-500 text-[clamp(8px,1.2cqw,11px)]">{m.u}</span>
          </div>
        </div>
      );
    case 'gauge':
      return (
        <div className={base} style={{ border }}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-[2%] p-[6%]">
            <span className="text-slate-400 truncate w-full text-center text-[clamp(9px,1.5cqw,13px)]">{cfg.label}</span>
            <div className="relative flex-1 w-full flex items-center justify-center" style={{ minHeight: 0 }}>
              <svg viewBox="0 0 48 48" className="w-full h-full" style={{ maxWidth: '80%', maxHeight: '80%', transform: 'rotate(-90deg)' }}>
                <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(100,116,139,0.25)" strokeWidth="4" />
                <circle cx="24" cy="24" r="18" fill="none" stroke={accent} strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 18 * pct / 100} ${2 * Math.PI * 18}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-white text-[clamp(10px,2.5cqw,20px)]">{m.v}</span>
              </div>
            </div>
            <span className="text-slate-500 text-[clamp(8px,1.2cqw,11px)]">{m.u}</span>
          </div>
        </div>
      );
    case 'badge':
      return (
        <div className={base} style={{ border }}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-[4%] p-[6%]">
            <span style={{ color: cc }}>{icon}</span>
            <span className="px-[8%] py-[2%] rounded-full font-semibold text-[clamp(10px,2cqw,18px)]"
              style={{ background: `${sc}22`, color: sc }}>{m.v}</span>
            <span className="text-slate-500 truncate text-center w-full text-[clamp(9px,1.5cqw,13px)]">{cfg.label}</span>
          </div>
        </div>
      );
    case 'switch':
      return (
        <div className={base} style={{ border }}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-[4%] p-[6%]">
            <span className="text-slate-400 truncate w-full text-center text-[clamp(9px,1.5cqw,13px)]">{cfg.label}</span>
            <div className="flex items-center gap-[5%]">
              <span className="text-slate-500 text-[clamp(8px,1.2cqw,11px)]">AUS</span>
              <div className="rounded-full flex items-center px-[3%]"
                style={{ background: accent, width: 'clamp(36px,30%,72px)', height: 'clamp(20px,16%,36px)' }}>
                <div className="bg-white rounded-full ml-auto shadow"
                  style={{ width: 'clamp(14px,12%,28px)', height: 'clamp(14px,12%,28px)' }} />
              </div>
              <span className="text-slate-300 text-[clamp(8px,1.2cqw,11px)]">EIN</span>
            </div>
          </div>
        </div>
      );
    case 'chart':
      return (
        <div className={base} style={{ border }}>
          <div className="w-full h-full flex flex-col justify-between p-[8%]">
            <div className="flex items-center gap-[4%] min-w-0 shrink-0">
              <span style={{ color: cc }} className="shrink-0">{icon}</span>
              <span className="text-slate-400 truncate flex-1 text-[clamp(9px,1.5cqw,13px)]">{cfg.label}</span>
              <span className="font-bold text-white shrink-0 text-[clamp(10px,2cqw,16px)]">{m.v} {m.u}</span>
            </div>
            <svg viewBox="0 0 80 20" className="w-full flex-1" preserveAspectRatio="none" style={{ minHeight: 0 }}>
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
          <div className="w-full h-full flex items-center gap-[3%] px-[6%]">
            <span style={{ color: cc }} className="shrink-0">{icon}</span>
            <span className="text-slate-300 flex-1 truncate text-[clamp(10px,1.8cqw,15px)]">{cfg.label}</span>
            <span className="font-semibold text-white shrink-0 text-[clamp(11px,2.2cqw,18px)]">{m.v} {m.u}</span>
          </div>
        </div>
      );
    case 'label':
      return (
        <div className={base} style={{ border }}>
          <div className="w-full h-full flex flex-col items-center justify-center gap-[3%] p-[6%]">
            <span style={{ color: cc }}>{icon}</span>
            <span className="font-bold text-white leading-none text-[clamp(18px,5cqw,48px)]">{m.v}</span>
            <span className="text-slate-400 text-[clamp(9px,1.5cqw,14px)]">{m.u}</span>
            <span className="text-slate-500 truncate text-[clamp(8px,1.2cqw,11px)]">{cfg.label}</span>
          </div>
        </div>
      );
    case 'title': {
      const alignMap: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
      const fsMap: Record<string, string> = { xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' };
      return (
        <div className={base} style={{ border, background: cfg.bgColor || undefined }}>
          <div className="w-full h-full flex flex-col justify-center p-[8%]">
            {cfg.staticText ? (
              <p className={`font-semibold leading-snug whitespace-pre-wrap ${fsMap[cfg.fontSize ?? 'base']} ${alignMap[cfg.textAlign ?? 'left']}`}
                style={{ color: cfg.textColor || '#f1f5f9' }}>
                {cfg.staticText}
              </p>
            ) : (
              <p className={`text-slate-600 italic text-xs ${alignMap[cfg.textAlign ?? 'left']}`}>Titel / Text…</p>
            )}
          </div>
        </div>
      );
    }
    case 'image': {
      const imgSrc = cfg.imageUrl ? resolveImageUrl(cfg.imageUrl) : '';
      return (
        <div className={base} style={{ border }}>
          {imgSrc ? (
            <img src={imgSrc} alt={cfg.label} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-[4%] text-slate-600">
              <ImageIcon size={20} className="opacity-30" />
              <span className="text-[10px]">Bild hochladen oder wählen</span>
            </div>
          )}
        </div>
      );
    }
    default: // kpi
      return (
        <div className={base} style={{ border }}>
          <div className="w-full h-full flex flex-col justify-between p-[8%]">
            <div className="flex items-center gap-[4%] min-w-0">
              <span style={{ color: cc }} className="shrink-0">{icon}</span>
              <span className="text-slate-400 truncate text-[clamp(9px,1.5cqw,13px)]">{cfg.label}</span>
            </div>
            <div className="flex items-end gap-[2%]">
              <span className="font-bold leading-none text-[clamp(18px,5cqw,48px)]" style={{ color: sc }}>{m.v}</span>
              {m.u && <span className="text-slate-400 pb-[2%] text-[clamp(9px,1.5cqw,14px)]">{m.u}</span>}
            </div>
          </div>
        </div>
      );
  }
}

// ---- Toggle ----

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

function makeWidget(src: PaletteSource, existing: RoomDataPointConfig[], atCol?: number, atRow?: number): RoomDataPointConfig {
  const wt = defaultWidgetType(src.category);
  const def = WIDGET_TYPES.find(x => x.type === wt)!;
  const pos = atCol !== undefined && atRow !== undefined
    ? { col: Math.min(atCol, COLS - def.defaultW), row: Math.min(atRow, ROWS - def.defaultH) }
    : findFreeCell(existing, def.defaultW, def.defaultH);
  // Allow duplicate datapoints — use unique id
  const baseId = src.id;
  const existingCount = existing.filter(w => w.datapointId === baseId || w.datapointId.startsWith(baseId + '#')).length;
  const datapointId = existingCount > 0 ? `${baseId}#${existingCount}` : baseId;
  return {
    datapointId,
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

function makeStaticWidget(type: 'title' | 'image', existing: RoomDataPointConfig[], atCol?: number, atRow?: number): RoomDataPointConfig {
  const def = WIDGET_TYPES.find(x => x.type === type)!;
  const pos = atCol !== undefined && atRow !== undefined
    ? { col: Math.min(atCol, COLS - def.defaultW), row: Math.min(atRow, ROWS - def.defaultH) }
    : findFreeCell(existing, def.defaultW, def.defaultH);
  const id = `static-${type}-${Date.now()}`;
  return {
    datapointId: id,
    label: type === 'title' ? 'Text' : 'Bild',
    displayType: 'kpi',
    widgetType: type,
    order: existing.length,
    panelCol: pos.col,
    panelRow: pos.row,
    panelW: def.defaultW,
    panelH: def.defaultH,
    showInMonitor: true,
    showInService: false,
    showInTooltip: false,
    showInBuilding: false,
    isPrimaryRoomKPI: false,
    isPrimaryBuildingPoint: false,
    writable: false,
    staticText: '',
    textAlign: 'left',
    fontSize: 'base',
  };
}

// ---- Datapoint picker modal ----

interface DpPickerModalProps {
  currentValue: string;
  suggestions: PaletteSource[];
  onSelect: (v: string, wt?: WidgetType) => void;
  onClose: () => void;
  datapointGroups?: DatapointGroup[];
  showWidgetTypes?: boolean;
}

function DpPickerModal({ currentValue, suggestions, onSelect, onClose, datapointGroups = [], showWidgetTypes = false }: DpPickerModalProps) {
  const [q, setQ] = useState('');
  const [pageId, setPageId] = useState<string | null>(null);
  const [pendingDp, setPendingDp] = useState<string | null>(null);
  const [pendingWt, setPendingWt] = useState<WidgetType | null>(null);

  const pick = (dp: string) => {
    if (showWidgetTypes) {
      setPendingDp(dp);
      const src = suggestions.find(s => s.datapoint === dp);
      setPendingWt(defaultWidgetType(src?.category ?? 'generic'));
    } else {
      onSelect(dp);
      onClose();
    }
  };

  const qLow = q.trim().toLowerCase();
  const filteredSuggestions = qLow
    ? suggestions.filter(s => s.datapoint.toLowerCase().includes(qLow) || s.label.toLowerCase().includes(qLow))
    : suggestions;
  const filteredGroups = datapointGroups.filter(g =>
    !qLow || g.pageName.toLowerCase().includes(qLow) || g.datapoints.some(d => d.entityId.toLowerCase().includes(qLow) || d.label.toLowerCase().includes(qLow))
  );

  if (pendingDp && showWidgetTypes) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <button onClick={() => setPendingDp(null)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
              <ChevronRight size={13} className="rotate-180" /> Zurück
            </button>
            <p className="text-xs font-medium text-white">Widget-Typ wählen</p>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X size={14} /></button>
          </div>
          <div className="p-3 grid grid-cols-3 gap-1.5">
            {WIDGET_TYPES.filter(wt => wt.type !== 'title' && wt.type !== 'image').map(wt => (
              <button key={wt.type}
                onClick={() => { onSelect(pendingDp, wt.type); onClose(); }}
                className={['flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-[10px] transition-all',
                  pendingWt === wt.type
                    ? 'border-sky-500 bg-sky-950/50 text-sky-300'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-slate-200'].join(' ')}>
                <span>{wt.icon}</span>
                {wt.label}
              </button>
            ))}
          </div>
          <div className="px-3 pb-3">
            <button onClick={() => { onSelect(pendingDp, pendingWt ?? 'kpi'); onClose(); }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors">
              <Check size={12} /> Übernehmen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
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
              <button onMouseDown={() => pick(q.trim())}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] transition-colors">
                <Check size={10} /> Übernehmen
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {pageId === null ? (
            <>
              {filteredSuggestions.length > 0 && (
                <>
                  <div className="px-4 py-1.5 border-b border-slate-800/50 bg-slate-800/20">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Raum-Datenpunkte</p>
                  </div>
                  {filteredSuggestions.map(s => (
                    <button key={s.id} onClick={() => pick(s.datapoint)}
                      className={['w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/30 transition-colors text-left', currentValue === s.datapoint ? 'bg-sky-950/30' : ''].join(' ')}>
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
              {filteredGroups.length > 0 && (
                <>
                  <div className="px-4 py-1.5 border-b border-slate-800/50 bg-slate-800/20">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Logik-Seiten</p>
                  </div>
                  {filteredGroups.map(g => (
                    <button key={g.pageId} onClick={() => { setPageId(g.pageId); setQ(''); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/30 transition-colors">
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
            const list = g ? (qLow ? g.datapoints.filter(d => d.entityId.toLowerCase().includes(qLow) || d.label.toLowerCase().includes(qLow)) : g.datapoints) : [];
            if (list.length === 0) return (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Search size={24} className="mb-2 opacity-30" />
                <span className="text-xs">Keine Treffer</span>
              </div>
            );
            return list.map(dp => {
              const primary = dp.label && dp.label !== dp.entityId ? dp.label : dp.entityId;
              const showSub = primary !== dp.entityId;
              return (
                <button key={dp.entityId} onClick={() => pick(dp.entityId)}
                  className={['w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800 transition-colors text-left border-b border-slate-800/30', currentValue === dp.entityId ? 'bg-sky-950/30' : ''].join(' ')}>
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

// ---- Empty cell add modal ----

interface AddWidgetModalProps {
  col: number;
  row: number;
  sources: PaletteSource[];
  datapointGroups: DatapointGroup[];
  existing: RoomDataPointConfig[];
  onAdd: (w: RoomDataPointConfig) => void;
  onClose: () => void;
  accent: string;
}

function AddWidgetModal({ col, row, sources, datapointGroups, existing, onAdd, onClose, accent }: AddWidgetModalProps) {
  const [step, setStep] = useState<'type' | 'dp' | 'done'>('type');
  const [chosenType, setChosenType] = useState<WidgetType | null>(null);

  const handleTypeSelect = (type: WidgetType) => {
    if (type === 'title' || type === 'image') {
      onAdd(makeStaticWidget(type, existing, col, row));
      onClose();
      return;
    }
    setChosenType(type);
    setStep('dp');
  };

  const handleDpSelect = (dp: string) => {
    const src = sources.find(s => s.datapoint === dp) ?? {
      id: `ext-${dp}`, label: dp, datapoint: dp, category: 'generic', isBinding: false,
    };
    const w = makeWidget(src, existing, col, row);
    if (chosenType) w.widgetType = chosenType;
    onAdd(w);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {step === 'dp' && (
              <button onClick={() => setStep('type')} className="p-1 rounded hover:bg-slate-800 text-slate-400">
                <ChevronRight size={13} className="rotate-180" />
              </button>
            )}
            <p className="text-sm font-semibold text-white">
              {step === 'type' ? 'Widget-Typ wählen' : 'Datenpunkt wählen'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><X size={14} /></button>
        </div>

        {step === 'type' && (
          <div className="p-3 grid grid-cols-3 gap-1.5 max-h-[60vh] overflow-y-auto">
            {WIDGET_TYPES.map(wt => (
              <button key={wt.type} onClick={() => handleTypeSelect(wt.type)}
                className="flex flex-col items-center gap-1 py-3 px-1 rounded-lg border border-slate-700 bg-slate-800/40 text-slate-300 hover:border-sky-500 hover:bg-sky-950/40 hover:text-sky-300 transition-all text-[11px]">
                <span className="text-slate-400">{wt.icon}</span>
                <span>{wt.label}</span>
                <span className="text-[9px] text-slate-600 text-center">{wt.description}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'dp' && (
          <DpPickerModal
            currentValue=""
            suggestions={sources}
            datapointGroups={datapointGroups}
            onSelect={handleDpSelect}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ---- Image widget editor (upload + file manager) ----

function ImageWidgetEditor({ imageUrl, onChange }: { imageUrl: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImageFile(file);
      onChange(url);
    } catch {
      // fallback: base64
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handlePickerSelect = async (url: string) => {
    const apiBase = getApiBase();
    try {
      const res = await fetch(`${apiBase}${url}`);
      if (res.ok) {
        const blob = await res.blob();
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        onChange(b64);
      } else {
        onChange(url);
      }
    } catch {
      onChange(url);
    }
    setShowPicker(false);
  };

  const displayUrl = imageUrl ? resolveImageUrl(imageUrl) : '';

  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">Bild</p>

      {displayUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-slate-700" style={{ height: 100 }}>
          <img src={displayUrl} alt="" className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 hover:opacity-100 transition-opacity bg-black/60">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white text-[10px] rounded transition-colors">
              <Upload size={9} /> Upload
            </button>
            <button onClick={() => setShowPicker(true)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-[10px] rounded transition-colors">
              <FolderOpen size={9} /> Bibliothek
            </button>
            <button onClick={() => onChange('')}
              className="flex items-center gap-1 px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-[10px] rounded transition-colors">
              <X size={9} /> Entfernen
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-slate-700 h-20 flex flex-col items-center justify-center gap-1.5">
          {uploading ? (
            <div className="flex flex-col items-center gap-1">
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[9px] text-slate-500">Hochladen…</span>
            </div>
          ) : (
            <>
              <ImageIcon size={16} className="text-slate-600" />
              <div className="flex gap-1.5">
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 bg-sky-900/50 hover:bg-sky-900 border border-sky-700/40 text-sky-400 text-[10px] rounded transition-colors">
                  <Upload size={9} /> Upload
                </button>
                <button onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-[10px] rounded transition-colors">
                  <FolderOpen size={9} /> Bibliothek
                </button>
              </div>
            </>
          )}
          {error && <span className="text-[9px] text-red-400">{error}</span>}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {showPicker && (
        <FileManager
          apiBase={getApiBase()}
          pickerMode
          onSelectImage={handlePickerSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ---- PanelDesigner ----

interface PanelDesignerProps {
  room: Room;
  floorName: string;
  buildingId: string;
  datapointGroups?: DatapointGroup[];
  onOpenMonitor?: () => void;
}

export function PanelDesigner({ room, floorName, buildingId, datapointGroups = [], onOpenMonitor }: PanelDesignerProps) {
  const { monitorConfigs, saveRoomMonitorConfig, datapointGroups: ctxGroups } = useBuildingContext();
  const groups = datapointGroups.length > 0 ? datapointGroups : ctxGroups;

  const bindings: RoomDataPointBinding[] = room.bindings ?? [];
  const savedCfg = monitorConfigs[room.id];

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
    for (const grp of groups) {
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
  }, [bindings, groups]);

  const initialWidgets = useMemo<RoomDataPointConfig[]>(() => {
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
  }, [room.id, savedCfg, bindings]);

  const [widgets, setWidgets] = useState<RoomDataPointConfig[]>(initialWidgets);
  const [accent, setAccent] = useState(savedCfg?.accentColor ?? room.color ?? '#0ea5e9');
  const [panelTitle, setPanelTitle] = useState(savedCfg?.panelTitle ?? '');
  const [panelSubtitle, setPanelSubtitle] = useState(savedCfg?.panelSubtitle ?? '');
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(new Set(savedCfg?.hiddenTabs ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerWidgetId, setPickerWidgetId] = useState<string | null>(null);
  const [addCell, setAddCell] = useState<{ col: number; row: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [dropOver, setDropOver] = useState<{ col: number; row: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const paletteDragSrc = useRef<PaletteSource | null>(null);
  const widgetDragId = useRef<string | null>(null);

  const selected = widgets.find(w => w.datapointId === selectedId) ?? null;
  // Show all sources in palette — duplicates allowed
  const filtered = search.trim()
    ? allSources.filter(s => s.label.toLowerCase().includes(search.toLowerCase()) || s.datapoint.toLowerCase().includes(search.toLowerCase()))
    : allSources;

  const getCell = useCallback((cx: number, cy: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const col = Math.floor((cx - rect.left - GAP) / (CW + GAP));
    const row = Math.floor((cy - rect.top - GAP) / (CH + GAP));
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }, []);

  const getCellAtPoint = useCallback((cx: number, cy: number): { col: number; row: number } | null => {
    return getCell(cx, cy);
  }, [getCell]);

  const isCellOccupied = useCallback((col: number, row: number) => {
    return widgets.some(w => {
      const wc = w.panelCol ?? 0, wr = w.panelRow ?? 0;
      const ww = w.panelW ?? 1, wh = w.panelH ?? 1;
      return col >= wc && col < wc + ww && row >= wr && row < wr + wh;
    });
  }, [widgets]);

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
      const newW = makeWidget(src, widgets, cell.col, cell.row);
      setWidgets(p => [...p, newW]);
      setSelectedId(newW.datapointId);
    }
  }, [getCell, widgets, updateWidget]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const cell = getCellAtPoint(e.clientX, e.clientY);
    if (!cell) return;
    if (!isCellOccupied(cell.col, cell.row)) {
      setAddCell(cell);
    }
  }, [getCellAtPoint, isCellOccupied]);

  const handleSave = () => {
    saveRoomMonitorConfig({
      roomId: room.id, datapoints: widgets, accentColor: accent, layout: 'grid',
      panelTitle, panelSubtitle,
      hiddenTabs: Array.from(hiddenTabs) as ('overview' | 'points' | 'alarms' | 'trends')[],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const canvasW = COLS * (CW + GAP) + GAP;
  const canvasH = ROWS * (CH + GAP) + GAP;

  return (
    <div className="flex h-full overflow-hidden bg-slate-950 text-slate-200">

      {/* ---- LEFT: Palette ---- */}
      <div className="w-52 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden">
        <div className="px-3 pt-2.5 pb-2 border-b border-slate-800 shrink-0 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">Datenpunkte</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-500">Farbe</span>
            <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" />
          </div>
        </div>
        <div className="px-2 py-1.5 border-b border-slate-800 shrink-0">
          <div className="relative">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…"
              className="w-full bg-slate-800 border border-slate-700 rounded-md pl-6 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {/* Static element buttons */}
          <div className="pb-1.5 mb-1 border-b border-slate-800">
            <p className="text-[9px] text-slate-600 uppercase tracking-wider px-1 mb-1">Statische Elemente</p>
            <div className="flex gap-1">
              <button
                onClick={() => { const w = makeStaticWidget('title', widgets); setWidgets(p => [...p, w]); setSelectedId(w.datapointId); }}
                className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:border-sky-600 hover:bg-slate-800 transition-colors text-xs text-slate-300">
                <Type size={11} className="shrink-0 text-slate-400" />
                <span>Text</span>
              </button>
              <button
                onClick={() => { const w = makeStaticWidget('image', widgets); setWidgets(p => [...p, w]); setSelectedId(w.datapointId); }}
                className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:border-sky-600 hover:bg-slate-800 transition-colors text-xs text-slate-300">
                <ImageIcon size={11} className="shrink-0 text-slate-400" />
                <span>Bild</span>
              </button>
            </div>
          </div>

          {allSources.length === 0 && (
            <div className="py-6 text-center text-slate-600 text-xs px-2">
              <Settings size={16} className="mx-auto mb-1.5 opacity-30" />
              <p>Keine Datenpunkte.</p>
              <p className="mt-0.5 text-slate-700 text-[10px]">Zuerst Bindings zuweisen.</p>
            </div>
          )}
          {filtered.map((src, idx) => {
            const cc = CATEGORY_COLORS[src.category] ?? '#64748b';
            const icon = CATEGORY_ICONS[src.category] ?? CATEGORY_ICONS.generic;
            return (
              <div key={`${src.id}-${idx}`} draggable
                onDragStart={e => { paletteDragSrc.current = src; widgetDragId.current = null; e.dataTransfer.effectAllowed = 'copy'; }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:border-slate-600 hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors group select-none">
                <span style={{ color: cc }} className="shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate group-hover:text-white transition-colors">{src.label}</p>
                  <p className="text-[9px] text-slate-600 font-mono truncate">{src.datapoint}</p>
                </div>
                {src.isBinding && <span className="text-[9px] text-sky-700 shrink-0">●</span>}
              </div>
            );
          })}

          {widgets.length > 0 && (
            <div className="pt-1.5 border-t border-slate-800 mt-0.5">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider px-1 mb-1">Im Panel ({widgets.length})</p>
              {widgets.map(w => {
                const cc = CATEGORY_COLORS[w.category ?? 'generic'] ?? '#64748b';
                const icon = w.widgetType === 'title' ? <Type size={9} /> : w.widgetType === 'image' ? <ImageIcon size={9} /> : (CATEGORY_ICONS[w.category ?? 'generic'] ?? CATEGORY_ICONS.generic);
                return (
                  <div key={w.datapointId}
                    onClick={e => { e.stopPropagation(); setSelectedId(w.datapointId === selectedId ? null : w.datapointId); }}
                    className={['flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition-colors',
                      selectedId === w.datapointId ? 'bg-sky-900/40 border border-sky-700/50' : 'hover:bg-slate-800/50 border border-transparent'].join(' ')}>
                    <span style={{ color: cc }} className="shrink-0">{icon}</span>
                    <span className="text-xs text-slate-400 flex-1 truncate">{w.label}</span>
                    <button onClick={e => { e.stopPropagation(); removeWidget(w.datapointId); }}
                      className="p-0.5 text-slate-600 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={9} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- CENTER: Canvas ---- */}
      <div className="flex-1 overflow-auto flex flex-col items-center py-4 px-3 bg-slate-950"
        onClick={() => setSelectedId(null)}
        onMouseDown={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>

        {/* Panel header preview */}
        <div className="mb-2 w-full" style={{ maxWidth: canvasW }}>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2.5">
            <div className="w-1 h-8 rounded-full shrink-0" style={{ background: accent }} />
            <div className="flex-1 min-w-0">
              <input value={panelTitle || room.name} onChange={e => setPanelTitle(e.target.value)} placeholder={room.name}
                className="w-full bg-transparent text-sm font-bold text-white focus:outline-none placeholder-slate-600"
                onClick={e => e.stopPropagation()} />
              <input value={panelSubtitle} onChange={e => setPanelSubtitle(e.target.value)} placeholder={`${floorName} · Untertitel…`}
                className="w-full bg-transparent text-[10px] text-slate-400 focus:outline-none placeholder-slate-600 mt-0.5"
                onClick={e => e.stopPropagation()} />
            </div>
            <span className="text-[9px] text-slate-600 flex items-center gap-1 shrink-0"><Type size={9} /> Kopfzeile</span>
          </div>
        </div>

        {/* Drop canvas */}
        <div ref={canvasRef}
          style={{ width: canvasW, minWidth: canvasW, height: canvasH, minHeight: canvasH }}
          className="relative rounded-2xl border border-slate-800 bg-slate-900/60"
          onDragOver={e => { e.preventDefault(); setDropOver(getCell(e.clientX, e.clientY)); }}
          onDrop={handleDrop}
          onDragLeave={() => setDropOver(null)}
          onClick={handleCanvasClick}>

          {/* Grid cells — clickable empty cells */}
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: COLS }, (_, col) => {
              const occupied = isCellOccupied(col, row);
              return (
                <div key={`g-${col}-${row}`} style={{
                  position: 'absolute',
                  left: GAP + col * (CW + GAP), top: GAP + row * (CH + GAP),
                  width: CW, height: CH,
                }}
                  className={`rounded-xl border transition-colors ${occupied ? 'border-slate-800/50 bg-slate-800/10' : 'border-slate-800/50 bg-slate-800/10 hover:border-sky-700/50 hover:bg-sky-900/10 cursor-pointer group'}`}>
                  {!occupied && (
                    <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={16} className="text-sky-700" />
                    </div>
                  )}
                </div>
              );
            })
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
              <div key={w.datapointId} draggable
                onDragStart={e => { e.stopPropagation(); widgetDragId.current = w.datapointId; paletteDragSrc.current = null; e.dataTransfer.effectAllowed = 'move'; }}
                onClick={e => { e.stopPropagation(); setSelectedId(w.datapointId === selectedId ? null : w.datapointId); }}
                style={{
                  position: 'absolute',
                  left: GAP + col * (CW + GAP), top: GAP + row * (CH + GAP),
                  width: ww * CW + (ww - 1) * GAP, height: wh * CH + (wh - 1) * GAP,
                  zIndex: selectedId === w.datapointId ? 10 : 2,
                  containerType: 'size',
                }}
                className="cursor-grab active:cursor-grabbing select-none">
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
        <p className="mt-1.5 text-[9px] text-slate-700">{COLS} Sp. × {ROWS} Z. · Ziehen zum Verschieben · Leere Kachel klicken zum Hinzufügen</p>
      </div>

      {/* ---- RIGHT: Properties ---- */}
      <div className="shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden" style={{ width: 252 }}>

        {/* Save bar */}
        <div className="px-3 py-2 border-b border-slate-800 shrink-0 flex items-center gap-2">
          {onOpenMonitor && (
            <button onClick={onOpenMonitor} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors">
              <Monitor size={11} /> Monitor
            </button>
          )}
          <div className="flex-1" />
          <button onClick={handleSave}
            className={['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
              saved ? 'bg-emerald-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'].join(' ')}>
            <Check size={12} />
            {saved ? 'Gespeichert' : 'Speichern'}
          </button>
        </div>

        {selected ? (
          <>
            <div className="px-3 pt-2.5 pb-2 border-b border-slate-800 shrink-0">
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Bezeichnung</p>
              <input value={selected.label} onChange={e => updateWidget(selected.datapointId, { label: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                placeholder="Bezeichnung" />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">

              {/* Title widget properties */}
              {selected.widgetType === 'title' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Text</p>
                    <textarea
                      value={selected.staticText ?? ''}
                      onChange={e => updateWidget(selected.datapointId, { staticText: e.target.value })}
                      placeholder="Text eingeben…"
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] text-slate-600 mb-1">Ausrichtung</p>
                      <select value={selected.textAlign ?? 'left'}
                        onChange={e => updateWidget(selected.datapointId, { textAlign: e.target.value as 'left' | 'center' | 'right' })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                        <option value="left">Links</option>
                        <option value="center">Mitte</option>
                        <option value="right">Rechts</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-600 mb-1">Schriftgröße</p>
                      <select value={selected.fontSize ?? 'base'}
                        onChange={e => updateWidget(selected.datapointId, { fontSize: e.target.value as 'xs' | 'sm' | 'base' | 'lg' | 'xl' })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                        <option value="xs">Klein</option>
                        <option value="sm">Normal</option>
                        <option value="base">Mittel</option>
                        <option value="lg">Groß</option>
                        <option value="xl">Sehr groß</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] text-slate-600 mb-1">Textfarbe</p>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={selected.textColor ?? '#f1f5f9'}
                          onChange={e => updateWidget(selected.datapointId, { textColor: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0" />
                        <span className="text-[10px] text-slate-500 font-mono">{selected.textColor ?? '#f1f5f9'}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-600 mb-1">Hintergrund</p>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={selected.bgColor || '#1e293b'}
                          onChange={e => updateWidget(selected.datapointId, { bgColor: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0" />
                        <button onClick={() => updateWidget(selected.datapointId, { bgColor: '' })}
                          className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors">
                          Transparent
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Image widget properties */}
              {selected.widgetType === 'image' && (
                <ImageWidgetEditor
                  imageUrl={selected.imageUrl ?? ''}
                  onChange={url => updateWidget(selected.datapointId, { imageUrl: url })}
                />
              )}

              {/* Datenpunkt — only for non-static widgets */}
              {selected.widgetType !== 'title' && selected.widgetType !== 'image' && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Datenpunkt</p>
                  <button onClick={() => setPickerWidgetId(selected.datapointId)}
                    className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs hover:border-sky-600 transition-colors group">
                    <Link size={10} className="text-slate-500 shrink-0 group-hover:text-sky-500 transition-colors" />
                    <span className={['flex-1 text-left truncate font-mono text-[10px]', selected.sourceDatapoint ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
                      {selected.sourceDatapoint || 'Datenpunkt wählen…'}
                    </span>
                    <ChevronRight size={10} className="text-slate-600 shrink-0" />
                  </button>
                  {pickerWidgetId === selected.datapointId && (
                    <DpPickerModal
                      currentValue={selected.sourceDatapoint ?? ''}
                      suggestions={allSources}
                      datapointGroups={groups}
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
                  <div className="mt-1.5">
                    <select value={selected.category ?? 'generic'}
                      onChange={e => updateWidget(selected.datapointId, { category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                      {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Widget type */}
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Darstellungstyp</p>
                <div className="grid grid-cols-3 gap-1">
                  {WIDGET_TYPES.map(wt => (
                    <button key={wt.type} onClick={() => changeWidgetType(selected.datapointId, wt.type)} title={wt.description}
                      className={['flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border text-[10px] transition-all',
                        selected.widgetType === wt.type
                          ? 'border-sky-500 bg-sky-950/50 text-sky-300'
                          : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-500 hover:text-slate-200'].join(' ')}>
                      <span>{wt.icon}</span>
                      {wt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div onClick={e => e.stopPropagation()}>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Größe</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] text-slate-600 mb-1">Breite (Spalten)</p>
                    <select value={selected.panelW ?? 1} onChange={e => updateWidget(selected.datapointId, { panelW: +e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-600 mb-1">Höhe (Zeilen)</p>
                    <select value={selected.panelH ?? 1} onChange={e => updateWidget(selected.datapointId, { panelH: +e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Value range */}
              {(selected.widgetType === 'slider' || selected.widgetType === 'gauge' || selected.widgetType === 'incrementer') && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Wertebereich</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <p className="text-[9px] text-slate-600 mb-1">Min</p>
                      <input type="number" value={selected.minValue ?? 0}
                        onChange={e => updateWidget(selected.datapointId, { minValue: +e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-600 mb-1">Max</p>
                      <input type="number" value={selected.maxValue ?? 100}
                        onChange={e => updateWidget(selected.datapointId, { maxValue: +e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-600 mb-1">Einheit</p>
                      <input type="text" value={selected.unit ?? ''} placeholder="°C"
                        onChange={e => updateWidget(selected.datapointId, { unit: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Visibility */}
              {selected.widgetType !== 'title' && selected.widgetType !== 'image' && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Sichtbarkeit</p>
                  <div className="space-y-1.5">
                    {([
                      ['showInMonitor',  'Monitor',       <Monitor size={9} />],
                      ['showInBuilding', 'Gebäude-Layer', <Building2 size={9} />],
                      ['showInTooltip',  'Tooltip',       <Tag size={9} />],
                      ['showInService',  'Service',       <Settings size={9} />],
                    ] as [keyof RoomDataPointConfig, string, React.ReactNode][]).map(([key, lbl, icon]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Toggle value={!!selected[key]} onChange={v => updateWidget(selected.datapointId, { [key]: v })} />
                        <span className="text-slate-500 shrink-0">{icon}</span>
                        <span className="text-[11px] text-slate-400">{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority */}
              {selected.widgetType !== 'title' && selected.widgetType !== 'image' && (
                <div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Priorität</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle value={!!selected.isPrimaryRoomKPI} onChange={v => updateWidget(selected.datapointId, { isPrimaryRoomKPI: v })} color="bg-yellow-500" />
                      <Star size={9} className="text-slate-500 shrink-0" />
                      <span className="text-[11px] text-slate-400">Primärer Raum-KPI</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle value={!!selected.isPrimaryBuildingPoint} onChange={v => updateWidget(selected.datapointId, { isPrimaryBuildingPoint: v })} color="bg-amber-500" />
                      <Building2 size={9} className="text-slate-500 shrink-0" />
                      <span className="text-[11px] text-slate-400">Gebäude-Hauptwert</span>
                    </label>
                  </div>
                </div>
              )}

              <button onClick={() => removeWidget(selected.datapointId)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 hover:bg-red-950/60 text-xs transition-colors">
                <Trash2 size={10} /> Widget entfernen
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="px-3 pt-2.5 pb-2 border-b border-slate-800 shrink-0">
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Panel-Einstellungen</p>
            </div>
            <div className="p-3 space-y-4 flex-1 overflow-y-auto">
              <div>
                <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Sichtbare Tabs</p>
                <div className="space-y-1.5">
                  {([
                    { id: 'panel',    label: 'Panel',       note: 'Nur wenn Widgets vorhanden', forced: true },
                    { id: 'overview', label: 'Übersicht',   note: 'KPIs + Alarmübersicht' },
                    { id: 'points',   label: 'Datenpunkte', note: 'Alle Datenpunkte' },
                    { id: 'alarms',   label: 'Alarme',      note: 'Aktive Alarme' },
                    { id: 'trends',   label: 'Trends',      note: 'Historische Verläufe' },
                  ] as { id: string; label: string; note: string; forced?: boolean }[]).map(tab => {
                    const isHidden = hiddenTabs.has(tab.id);
                    return (
                      <div key={tab.id} className="flex items-center gap-2">
                        <Toggle value={!isHidden}
                          onChange={v => {
                            if (tab.forced) return;
                            setHiddenTabs(prev => { const n = new Set(prev); v ? n.delete(tab.id) : n.add(tab.id); return n; });
                          }}
                          color={tab.forced ? 'bg-slate-600' : 'bg-sky-600'} />
                        <div className="flex-1 min-w-0">
                          <p className={['text-[11px]', tab.forced || !isHidden ? 'text-slate-300' : 'text-slate-600'].join(' ')}>{tab.label}</p>
                          <p className="text-[9px] text-slate-600">{tab.note}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-slate-800/50 border border-slate-800">
                  <GripVertical size={11} className="text-slate-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-slate-600 leading-relaxed">Datenpunkt aus der linken Palette auf das Raster ziehen. Leere Kachel anklicken um ein Widget hinzuzufügen.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add widget modal (empty cell click) */}
      {addCell && (
        <AddWidgetModal
          col={addCell.col}
          row={addCell.row}
          sources={allSources}
          datapointGroups={groups}
          existing={widgets}
          accent={accent}
          onAdd={w => { setWidgets(p => [...p, w]); setSelectedId(w.datapointId); }}
          onClose={() => setAddCell(null)}
        />
      )}
    </div>
  );
}
