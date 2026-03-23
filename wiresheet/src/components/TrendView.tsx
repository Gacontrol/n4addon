import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  TrendingUp, Settings, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Plus, Minus, Download, Eye, EyeOff, Clock, BarChart2, Image,
  Layers, Calendar, X, Check, ChevronRight as ChevronRightIcon, Maximize2,
  LayoutGrid, Grid3x3, List, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { WiresheetPage, FlowNode, CustomBlockDefinition } from '../types/flow';

function getApiBase(): string {
  const path = window.location.pathname;
  const match = path.match(/^(\/api\/hassio_ingress\/[^/]+)/);
  if (match) return `${match[1]}/api`;
  const appMatch = path.match(/^(\/app\/[^/]+)/);
  if (appMatch) return `${appMatch[1]}/api`;
  return '/api';
}

const API_BASE = getApiBase();

interface TrackedNode {
  nodeId: string;
  label: string;
  pageId: string;
  pageName: string;
  enabled: boolean;
  color: string;
  unit?: string;
  sampleIntervalMs?: number;
  retentionDays?: number;
  deleted?: boolean;
}

interface TrendPoint {
  ts: number;
  v: number | boolean;
}

interface TrendSeries {
  nodeId: string;
  label: string;
  color: string;
  unit?: string;
  data: TrendPoint[];
  visible: boolean;
  min?: number;
  max?: number;
  avg?: number;
  last?: number | boolean;
}

interface ChartGroup {
  id: string;
  name: string;
  nodeIds: string[];
  visible: boolean;
}

interface Props {
  pages: WiresheetPage[];
  liveValues: Record<string, unknown>;
  customBlockDefs?: CustomBlockDefinition[];
}

const TREND_COLORS = [
  '#38bdf8', '#34d399', '#fb923c', '#f472b6',
  '#facc15', '#f87171', '#4ade80', '#60a5fa',
  '#c084fc', '#fb7185', '#86efac', '#fbbf24',
];

const TIME_RANGES = [
  { label: '30 Min', ms: 1800000 },
  { label: '1 Std', ms: 3600000 },
  { label: '6 Std', ms: 21600000 },
  { label: '12 Std', ms: 43200000 },
  { label: '24 Std', ms: 86400000 },
  { label: '7 Tage', ms: 604800000 },
  { label: '30 Tage', ms: 2592000000 },
];

function formatTs(ts: number, rangeMs: number): string {
  const d = new Date(ts);
  if (rangeMs <= 3600000) {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }
  if (rangeMs <= 86400000) {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatValue(v: number | boolean | undefined | null, decimals?: number): string {
  if (v === undefined || v === null) return '-';
  if (typeof v === 'boolean') return v ? 'EIN' : 'AUS';
  if (typeof v === 'number') {
    if (decimals !== undefined) return v.toFixed(decimals);
    if (Math.abs(v) >= 10000) return v.toFixed(0);
    if (Math.abs(v) >= 1000) return v.toFixed(1);
    if (Math.abs(v) >= 10) return v.toFixed(2);
    return v.toFixed(3);
  }
  return String(v);
}

function drawChart(
  canvas: HTMLCanvasElement,
  seriesList: TrendSeries[],
  rangeMs: number,
  fromTs: number,
  height: number,
  separateAxes: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const visibleSeries = seriesList.filter(s => s.visible && s.data.length > 0);

  const padLeft = separateAxes && visibleSeries.length > 1 ? 65 : 60;
  const padRight = separateAxes && visibleSeries.length > 1 ? 60 : 16;
  const padTop = 14;
  const padBottom = 38;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, h);

  if (visibleSeries.length === 0) {
    ctx.fillStyle = '#475569';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Keine Daten im ausgewaehlten Zeitraum', w / 2, h / 2);
    return;
  }

  const allValues: number[] = [];
  for (const s of visibleSeries) {
    for (const p of s.data) {
      if (typeof p.v === 'number') allValues.push(p.v);
    }
  }

  const globalMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const globalMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const valuePad = (globalMax - globalMin) * 0.08 || 0.5;
  const yMin = globalMin - valuePad;
  const yMax = globalMax + valuePad;
  const valueRange = yMax - yMin || 1;

  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padTop + (chartH / gridLines) * i;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();

    const val = yMax - (valueRange / gridLines) * i;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatValue(val), padLeft - 6, y + 4);
  }

  if (separateAxes && visibleSeries.length > 1) {
    const secondSeries = visibleSeries[visibleSeries.length - 1];
    const sVals: number[] = secondSeries.data.filter(p => typeof p.v === 'number').map(p => p.v as number);
    if (sVals.length > 0) {
      const sMin = Math.min(...sVals);
      const sMax = Math.max(...sVals);
      const sPad = (sMax - sMin) * 0.08 || 0.5;
      const sRange = (sMax + sPad) - (sMin - sPad) || 1;
      for (let i = 0; i <= gridLines; i++) {
        const y = padTop + (chartH / gridLines) * i;
        const val = (sMax + sPad) - (sRange / gridLines) * i;
        ctx.fillStyle = secondSeries.color + 'aa';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(formatValue(val), padLeft + chartW + 6, y + 4);
      }
    }
  }

  const timeSteps = 6;
  for (let i = 0; i <= timeSteps; i++) {
    const x = padLeft + (chartW / timeSteps) * i;
    const ts = fromTs + (rangeMs / timeSteps) * i;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + chartH);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatTs(ts, rangeMs), x, padTop + chartH + 20);
  }

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(padLeft, padTop, chartW, chartH);

  visibleSeries.forEach((s, seriesIdx) => {
    if (s.data.length === 0) return;

    let sMin = yMin, sMax = yMax, sRange = valueRange;
    if (separateAxes && seriesIdx === visibleSeries.length - 1 && visibleSeries.length > 1) {
      const sVals = s.data.filter(p => typeof p.v === 'number').map(p => p.v as number);
      if (sVals.length > 0) {
        const mn = Math.min(...sVals);
        const mx = Math.max(...sVals);
        const p = (mx - mn) * 0.08 || 0.5;
        sMin = mn - p; sMax = mx + p; sRange = sMax - sMin || 1;
      }
    }

    const isBool = s.data.some(p => typeof p.v === 'boolean');

    if (isBool) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let lastX: number | null = null;
      let lastY: number | null = null;
      for (const point of s.data) {
        const x = padLeft + ((point.ts - fromTs) / rangeMs) * chartW;
        const v = point.v ? 1 : 0;
        const y = padTop + chartH - v * chartH * 0.8 - chartH * 0.1;
        if (lastX !== null && lastY !== null) {
          ctx.lineTo(x, lastY);
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
        }
        lastX = x; lastY = y;
      }
      ctx.stroke();
    } else {
      const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      gradient.addColorStop(0, s.color + '28');
      gradient.addColorStop(1, s.color + '00');

      const points: [number, number][] = [];
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let first = true;
      for (const point of s.data) {
        const x = padLeft + ((point.ts - fromTs) / rangeMs) * chartW;
        const v = typeof point.v === 'number' ? point.v : 0;
        const y = padTop + chartH - ((v - sMin) / sRange) * chartH;
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
        points.push([x, y]);
      }
      ctx.stroke();

      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], padTop + chartH);
        for (const [px, py] of points) ctx.lineTo(px, py);
        ctx.lineTo(points[points.length - 1][0], padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
  });

  if (visibleSeries.length > 0) {
    const legendY = padTop + chartH + 30;
    let legendX = padLeft;
    ctx.font = '10px sans-serif';
    for (const s of visibleSeries) {
      const lw = ctx.measureText(s.label).width + 18;
      if (legendX + lw > w - 8) break;
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX, legendY - 7, 10, 7);
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, legendX + 14, legendY);
      legendX += lw + 10;
    }
  }
}

function drawTileChart(
  canvas: HTMLCanvasElement,
  seriesList: TrendSeries[],
  rangeMs: number,
  fromTs: number,
  height: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  const visibleSeries = seriesList.filter(s => s.visible && s.data.length > 0);
  if (visibleSeries.length === 0) return;

  const allVals: number[] = [];
  for (const s of visibleSeries) {
    for (const p of s.data) {
      if (typeof p.v === 'number') allVals.push(p.v);
    }
  }
  if (allVals.length === 0) return;

  const globalMin = Math.min(...allVals);
  const globalMax = Math.max(...allVals);
  const valuePad = (globalMax - globalMin) * 0.12 || 0.5;
  const yMin = globalMin - valuePad;
  const yMax = globalMax + valuePad;
  const valueRange = yMax - yMin || 1;

  visibleSeries.forEach(s => {
    if (s.data.length < 2) return;
    const isBool = s.data.some(p => typeof p.v === 'boolean');
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, s.color + '40');
    gradient.addColorStop(1, s.color + '00');

    if (isBool) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let lastY: number | null = null;
      for (const point of s.data) {
        const x = ((point.ts - fromTs) / rangeMs) * w;
        const v = point.v ? 1 : 0;
        const y = h - v * h * 0.7 - h * 0.15;
        if (lastY !== null) {
          ctx.lineTo(x, lastY);
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
        }
        lastY = y;
      }
      ctx.stroke();
    } else {
      const points: [number, number][] = s.data.map(p => [
        ((p.ts - fromTs) / rangeMs) * w,
        h - ((((typeof p.v === 'number' ? p.v : 0) - yMin) / valueRange) * h * 0.85) - h * 0.05
      ]);

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i][0], points[i][1]);
        else ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();

      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], h);
        for (const [px, py] of points) ctx.lineTo(px, py);
        ctx.lineTo(points[points.length - 1][0], h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
  });
}

function TrendChart({
  series,
  rangeMs,
  fromTs,
  height = 300,
  title,
  onExportImage,
  separateAxes,
  canvasRef: externalCanvasRef,
  onWheel,
}: {
  series: TrendSeries[];
  rangeMs: number;
  fromTs: number;
  height?: number;
  title?: string;
  onExportImage?: (canvas: HTMLCanvasElement) => void;
  separateAxes: boolean;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
}) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    items: { label: string; color: string; value: string; unit?: string }[];
    time: string;
  } | null>(null);

  const visibleSeries = series.filter(s => s.visible && s.data.length > 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawChart(canvas, series, rangeMs, fromTs, height, separateAxes);
  }, [series, rangeMs, fromTs, height, separateAxes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      drawChart(canvas, series, rangeMs, fromTs, height, separateAxes);
    });
    observer.observe(canvas.parentElement || canvas);
    return () => observer.disconnect();
  }, [series, rangeMs, fromTs, height, separateAxes]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || visibleSeries.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const w = canvas.offsetWidth;
    const padLeft = 60;
    const padRight = 16;
    const chartW = w - padLeft - padRight;

    if (mx < padLeft || mx > padLeft + chartW) { setTooltip(null); return; }

    const ratio = (mx - padLeft) / chartW;
    const hoverTs = fromTs + ratio * rangeMs;

    const items = visibleSeries.map(s => {
      let closest: TrendPoint | null = null;
      let minDiff = Infinity;
      for (const p of s.data) {
        const diff = Math.abs(p.ts - hoverTs);
        if (diff < minDiff) { minDiff = diff; closest = p; }
      }
      return {
        label: s.label,
        color: s.color,
        value: closest ? formatValue(closest.v as number) : '-',
        unit: s.unit,
      };
    });

    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, items, time: formatTs(hoverTs, rangeMs) });
  }, [visibleSeries, fromTs, rangeMs]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
          <span className="text-sm font-medium text-slate-300">{title}</span>
          {onExportImage && canvasRef.current && (
            <button
              onClick={() => onExportImage(canvasRef.current!)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Image className="w-3.5 h-3.5" />
              PNG
            </button>
          )}
        </div>
      )}
      <div className="relative w-full" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ height }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          onWheel={onWheel}
        />
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-800 border border-slate-600 rounded-lg p-2.5 shadow-xl text-xs min-w-[150px]"
            style={{
              left: Math.min(tooltip.x + 14, (canvasRef.current?.offsetWidth || 400) - 170),
              top: Math.max(tooltip.y - 80, 8)
            }}
          >
            <div className="text-slate-400 mb-1.5 font-mono text-[11px]">{tooltip.time}</div>
            {tooltip.items.map(item => (
              <div key={item.label} className="flex items-center gap-2 py-0.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-300 truncate max-w-[90px]">{item.label}</span>
                <span className="font-mono ml-auto" style={{ color: item.color }}>
                  {item.value}{item.unit ? ` ${item.unit}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type TileSize = 'xs' | 'sm' | 'md' | 'lg';
type TileMode = 'simple' | 'detailed';

function TrendTile({
  s,
  liveValues,
  onClick,
  tileSize = 'sm',
  tileMode = 'simple',
}: {
  s: TrendSeries;
  liveValues: Record<string, unknown>;
  onClick: () => void;
  tileSize?: TileSize;
  tileMode?: TileMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = liveValues[s.nodeId];

  const chartH = tileSize === 'xs' ? 40 : tileSize === 'sm' ? 60 : tileSize === 'md' ? 90 : 130;
  const valueFontClass = tileSize === 'xs' ? 'text-base' : tileSize === 'sm' ? 'text-xl' : tileSize === 'md' ? 'text-2xl' : 'text-3xl';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || s.data.length === 0) return;
    const rMs = s.data.length > 1 ? s.data[s.data.length - 1].ts - s.data[0].ts || 3600000 : 3600000;
    const fTs = s.data.length > 0 ? s.data[0].ts : Date.now() - 3600000;
    drawTileChart(canvas, [{ ...s, visible: true }], rMs, fTs, chartH);
  }, [s, chartH]);

  const displayVal = live !== undefined ? formatValue(live as number) : (s.last !== undefined ? formatValue(s.last as number) : '-');

  if (tileSize === 'xs') {
    return (
      <div
        onClick={onClick}
        className={`bg-slate-900 border rounded-lg overflow-hidden cursor-pointer transition-all hover:border-slate-500 hover:shadow-md group flex items-center gap-0 ${s.visible ? 'border-slate-700' : 'border-slate-800 opacity-50'}`}
        style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
      >
        <div className="px-2.5 py-2 flex-shrink-0 min-w-[90px]">
          <div className="text-[10px] text-slate-400 truncate leading-tight mb-0.5">{s.label}</div>
          <div className="flex items-baseline gap-1">
            <span className={`${valueFontClass} font-mono font-bold leading-none`} style={{ color: s.color }}>{displayVal}</span>
            {s.unit && <span className="text-[10px] text-slate-500">{s.unit}</span>}
          </div>
        </div>
        <div className="flex-1 relative" style={{ height: chartH }}>
          <canvas ref={canvasRef} className="w-full h-full" style={{ height: chartH }} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-slate-500 hover:shadow-lg hover:shadow-black/30 group ${s.visible ? 'border-slate-700' : 'border-slate-800 opacity-50'}`}
      style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
    >
      <div className={`px-3 ${tileSize === 'lg' ? 'pt-4 pb-2' : 'pt-3 pb-1'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`${tileSize === 'lg' ? 'text-sm' : 'text-xs'} font-semibold text-slate-200 truncate flex-1`}>{s.label}</span>
          <Maximize2 className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 ml-1" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`${valueFontClass} font-mono font-bold leading-none`} style={{ color: s.color }}>
            {displayVal}
          </span>
          {s.unit && <span className="text-xs text-slate-500">{s.unit}</span>}
        </div>
      </div>
      <div className="relative w-full" style={{ height: chartH }}>
        <canvas ref={canvasRef} className="w-full h-full" style={{ height: chartH }} />
      </div>
      {tileMode === 'detailed' && (
        <div className={`px-3 ${tileSize === 'lg' ? 'pb-3 pt-2' : 'pb-2 pt-1'} flex gap-3 text-[10px] font-mono border-t border-slate-800/60`}>
          {s.min !== undefined && <span className="text-blue-400">↓{formatValue(s.min)}</span>}
          {s.max !== undefined && <span className="text-orange-400">↑{formatValue(s.max)}</span>}
          {s.avg !== undefined && <span className="text-slate-500">∅{formatValue(s.avg)}</span>}
          <span className="text-slate-700 ml-auto">{s.data.length}pt</span>
        </div>
      )}
    </div>
  );
}

function TrendPopup({
  s,
  allSeries,
  initialRangeMs,
  liveValues,
  onClose,
  onExportImage,
}: {
  s: TrendSeries;
  allSeries: TrendSeries[];
  initialRangeMs: number;
  liveValues: Record<string, unknown>;
  onClose: () => void;
  onExportImage: (canvas: HTMLCanvasElement, name?: string) => void;
}) {
  const live = liveValues[s.nodeId];
  const [popupRangeIdx, setPopupRangeIdx] = useState(() => {
    const idx = TIME_RANGES.findIndex(r => r.ms === initialRangeMs);
    return idx >= 0 ? idx : 1;
  });
  const [popupCustomFrom, setPopupCustomFrom] = useState('');
  const [popupCustomTo, setPopupCustomTo] = useState('');
  const [usePopupCustom, setUsePopupCustom] = useState(false);
  const [popupSeries, setPopupSeries] = useState<TrendSeries[]>([s]);
  const [visibleInPopup, setVisibleInPopup] = useState<Set<string>>(new Set([s.nodeId]));
  const [zoomRange, setZoomRange] = useState<{ from: number; to: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [popupLoading, setPopupLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const popupRangeMs = usePopupCustom && popupCustomFrom && popupCustomTo
    ? new Date(popupCustomTo).getTime() - new Date(popupCustomFrom).getTime()
    : TIME_RANGES[popupRangeIdx].ms;

  const baseFromTs = usePopupCustom && popupCustomFrom
    ? new Date(popupCustomFrom).getTime()
    : Date.now() - popupRangeMs;

  const effectiveFromTs = zoomRange ? zoomRange.from : baseFromTs;
  const effectiveRangeMs = zoomRange ? zoomRange.to - zoomRange.from : popupRangeMs;

  const loadPopupData = useCallback(async (extraNodeIds: string[] = []) => {
    const from = zoomRange ? zoomRange.from : baseFromTs;
    const to = zoomRange ? zoomRange.to : baseFromTs + popupRangeMs;
    const nodeIds = [s.nodeId, ...extraNodeIds];
    setPopupLoading(true);
    try {
      const params = new URLSearchParams({ nodeIds: nodeIds.join(','), from: String(from), to: String(to) });
      const res = await fetch(`${API_BASE}/trend?${params}`);
      if (res.ok) {
        const json = await res.json();
        const newSeries: TrendSeries[] = nodeIds.map(nodeId => {
          const existing = allSeries.find(x => x.nodeId === nodeId) || (nodeId === s.nodeId ? s : null);
          if (!existing) return null!;
          const raw: TrendPoint[] = json[nodeId] || [];
          const numVals = raw.filter(p => typeof p.v === 'number').map(p => p.v as number);
          return {
            ...existing,
            data: raw,
            min: numVals.length > 0 ? Math.min(...numVals) : undefined,
            max: numVals.length > 0 ? Math.max(...numVals) : undefined,
            avg: numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) / numVals.length : undefined,
            last: raw.length > 0 ? raw[raw.length - 1].v : undefined,
            visible: visibleInPopup.has(nodeId),
          };
        }).filter(Boolean);
        setPopupSeries(newSeries);
      }
    } catch {} finally {
      setPopupLoading(false);
    }
  }, [s, allSeries, baseFromTs, popupRangeMs, zoomRange, visibleInPopup]);

  useEffect(() => {
    loadPopupData(Array.from(visibleInPopup).filter(id => id !== s.nodeId));
  }, [popupRangeIdx, usePopupCustom, popupCustomFrom, popupCustomTo, zoomRange]);

  const togglePopupSeries = (nodeId: string) => {
    setVisibleInPopup(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    setPopupSeries(prev => prev.map(ps => ps.nodeId === nodeId ? { ...ps, visible: !ps.visible } : ps));
    if (!visibleInPopup.has(nodeId) && !popupSeries.find(ps => ps.nodeId === nodeId)) {
      loadPopupData(Array.from(visibleInPopup).concat(nodeId).filter(id => id !== s.nodeId));
    }
  };

  const addSeriesIfMissing = (nodeId: string) => {
    if (popupSeries.find(ps => ps.nodeId === nodeId)) {
      togglePopupSeries(nodeId);
      return;
    }
    setVisibleInPopup(prev => new Set([...prev, nodeId]));
    loadPopupData(Array.from(visibleInPopup).concat(nodeId).filter(id => id !== s.nodeId));
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const padLeft = 60;
    const chartW = canvas.offsetWidth - padLeft - 16;
    if (mx < padLeft || mx > padLeft + chartW) return;

    const factor = e.deltaY < 0 ? 0.7 : 1.3;
    const fraction = (mx - padLeft) / chartW;
    const pivotTs = effectiveFromTs + fraction * effectiveRangeMs;
    const newRange = effectiveRangeMs * factor;
    const newFrom = pivotTs - fraction * newRange;
    setZoomRange({ from: newFrom, to: newFrom + newRange });
  }, [effectiveFromTs, effectiveRangeMs]);

  const exportCsvPopup = () => {
    const visible = popupSeries.filter(ps => ps.visible);
    if (visible.length === 0) return;
    const allTs = [...new Set(visible.flatMap(ps => ps.data.map(p => p.ts)))].sort((a, b) => a - b);
    const header = ['Zeitstempel', 'Zeit', ...visible.map(ps => `${ps.label}${ps.unit ? ` (${ps.unit})` : ''}`)].join(';');
    const rows = allTs.map(ts => {
      const d = new Date(ts);
      const time = `${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE')}`;
      const vals = visible.map(ps => {
        const p = ps.data.find(x => x.ts === ts);
        return p !== undefined ? String(p.v) : '';
      });
      return [ts, time, ...vals].join(';');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend_${s.label}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedSeries = popupSeries.map(ps => ({
    ...ps,
    visible: visibleInPopup.has(ps.nodeId),
  }));

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[99998] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: '92vw', maxWidth: 1100, maxHeight: '92vh' }}>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700 flex-shrink-0" style={{ borderLeftColor: s.color, borderLeftWidth: 4 }}>
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{s.label}</h3>
            {s.unit && <span className="text-[11px] text-slate-400">{s.unit}</span>}
          </div>
          <div className="flex items-center gap-3">
            {popupSeries.find(ps => ps.nodeId === s.nodeId && ps.min !== undefined) && (() => {
              const ps = popupSeries.find(x => x.nodeId === s.nodeId)!;
              return (
                <div className="flex items-center gap-3 text-center border-r border-slate-700 pr-3">
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase">Aktuell</div>
                    <div className="text-xs font-mono font-bold" style={{ color: s.color }}>
                      {live !== undefined ? formatValue(live as number) : (ps.last !== undefined ? formatValue(ps.last as number) : '-')}{s.unit ? ` ${s.unit}` : ''}
                    </div>
                  </div>
                  {ps.min !== undefined && <div><div className="text-[9px] text-slate-600 uppercase">Min</div><div className="text-xs font-mono text-blue-400">{formatValue(ps.min)}</div></div>}
                  {ps.max !== undefined && <div><div className="text-[9px] text-slate-600 uppercase">Max</div><div className="text-xs font-mono text-orange-400">{formatValue(ps.max)}</div></div>}
                  {ps.avg !== undefined && <div><div className="text-[9px] text-slate-600 uppercase">Avg</div><div className="text-xs font-mono text-slate-300">{formatValue(ps.avg)}</div></div>}
                </div>
              );
            })()}
            <button
              onClick={exportCsvPopup}
              title="CSV exportieren"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) onExportImage(canvas, `trend_${s.label}`);
              }}
              title="PNG exportieren"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Image className="w-3.5 h-3.5" />
              PNG
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0 ml-1">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/60 flex-shrink-0 flex-wrap gap-y-1.5">
          {!usePopupCustom && (
            <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
              {TIME_RANGES.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => { setPopupRangeIdx(i); setZoomRange(null); }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${popupRangeIdx === i && !zoomRange ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              if (!usePopupCustom) {
                const now = new Date();
                const from = new Date(now.getTime() - popupRangeMs);
                setPopupCustomFrom(from.toISOString().slice(0, 16));
                setPopupCustomTo(now.toISOString().slice(0, 16));
              }
              setUsePopupCustom(v => !v);
              setZoomRange(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${usePopupCustom ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'text-slate-400 hover:text-white bg-slate-800'}`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Custom
          </button>

          {usePopupCustom && (
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={popupCustomFrom} onChange={e => setPopupCustomFrom(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500" />
              <ChevronRightIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <input type="datetime-local" value={popupCustomTo} onChange={e => setPopupCustomTo(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500" />
              <button onClick={() => loadPopupData(Array.from(visibleInPopup).filter(id => id !== s.nodeId))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors">
                <Check className="w-3.5 h-3.5" />
                Laden
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {zoomRange && (
              <button
                onClick={() => setZoomRange(null)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-orange-600/20 text-orange-400 border border-orange-600/30 hover:bg-orange-600/30 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Zoom zurücksetzen
              </button>
            )}
            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
              <button onClick={() => { const newRange = effectiveRangeMs * 0.6; const center = effectiveFromTs + effectiveRangeMs / 2; setZoomRange({ from: center - newRange / 2, to: center + newRange / 2 }); }} className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors" title="Hineinzoomen"><ZoomIn className="w-3.5 h-3.5" /></button>
              <button onClick={() => { const newRange = effectiveRangeMs * 1.6; const center = effectiveFromTs + effectiveRangeMs / 2; setZoomRange({ from: center - newRange / 2, to: center + newRange / 2 }); }} className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors" title="Herauszoomen"><ZoomOut className="w-3.5 h-3.5" /></button>
            </div>
            {popupLoading && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-slate-800/60 flex-shrink-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Serien:</span>
          {allSeries.map(as => {
            const isVisible = visibleInPopup.has(as.nodeId);
            return (
              <button
                key={as.nodeId}
                onClick={() => addSeriesIfMissing(as.nodeId)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
                style={isVisible
                  ? { backgroundColor: as.color + '25', borderColor: as.color + '60', color: as.color }
                  : { backgroundColor: 'transparent', borderColor: '#334155', color: '#475569' }}
              >
                {isVisible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                {as.label}
              </button>
            );
          })}
        </div>

        <div
          className="flex-1 overflow-hidden p-4 select-none"
          onMouseDown={e => { setIsDragging(true); setDragStartX(e.clientX); }}
          onMouseMove={e => {
            if (!isDragging) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const chartW = canvas.offsetWidth - 76;
            const dx = e.clientX - dragStartX;
            const dTs = -(dx / chartW) * effectiveRangeMs;
            setZoomRange({ from: effectiveFromTs + dTs, to: effectiveFromTs + dTs + effectiveRangeMs });
            setDragStartX(e.clientX);
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <TrendChart
            series={displayedSeries}
            rangeMs={effectiveRangeMs}
            fromTs={effectiveFromTs}
            height={380}
            separateAxes={false}
            onExportImage={(c) => { onExportImage(c, `trend_${s.label}`); }}
            canvasRef={canvasRef}
            onWheel={handleWheel}
          />
        </div>
      </div>
    </div>
  );
}

export function TrendView({ pages, liveValues, customBlockDefs = [] }: Props) {
  const [view, setView] = useState<'chart' | 'config' | 'groups'>('chart');
  const [trackedNodes, setTrackedNodes] = useState<TrackedNode[]>([]);
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(1);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [chartMode, setChartMode] = useState<'tiles' | 'combined' | 'separate'>('tiles');
  const [separateAxes, setSeparateAxes] = useState(false);
  const [chartGroups, setChartGroups] = useState<ChartGroup[]>([]);
  const [visibleSeriesIds, setVisibleSeriesIds] = useState<Set<string>>(new Set());
  const [popupSeries, setPopupSeries] = useState<TrendSeries | null>(null);
  const [expandedCustomBlocks, setExpandedCustomBlocks] = useState<Set<string>>(new Set());
  const [tileSize, setTileSize] = useState<TileSize>('sm');
  const [tileMode, setTileMode] = useState<TileMode>('simple');
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rangeMs = TIME_RANGES[selectedRangeIdx].ms;

  const computedFromTs = useMemo(() => {
    if (useCustomRange && customFrom) return new Date(customFrom).getTime();
    return Date.now() - rangeMs;
  }, [useCustomRange, customFrom, rangeMs]);

  const computedToTs = useMemo(() => {
    if (useCustomRange && customTo) return new Date(customTo).getTime();
    return Date.now();
  }, [useCustomRange, customTo]);

  const allNodes = useMemo(() => {
    const result: { node: FlowNode; page: WiresheetPage }[] = [];
    for (const page of pages) {
      for (const node of page.nodes) {
        if (node.type === 'datapoint') continue;
        result.push({ node, page });
      }
    }
    return result;
  }, [pages]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/trend-config`);
      if (res.ok) {
        const data = await res.json();
        const nodes: TrackedNode[] = data.trackedNodes || [];
        setTrackedNodes(nodes);
        setVisibleSeriesIds(new Set(nodes.filter(n => n.enabled).map(n => n.nodeId)));
        if (data.chartGroups) setChartGroups(data.chartGroups);
      }
    } catch {}
  }, []);

  const saveConfig = useCallback(async (nodes: TrackedNode[], groups?: ChartGroup[]) => {
    try {
      await fetch(`${API_BASE}/trend-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedNodes: nodes, chartGroups: groups ?? chartGroups }),
      });
    } catch {}
  }, [chartGroups]);

  const loadTrendData = useCallback(async () => {
    const enabled = trackedNodes.filter(n => n.enabled);
    if (enabled.length === 0) { setSeries([]); return; }

    setLoading(true);
    const from = computedFromTs;
    const to = computedToTs;

    const results: TrendSeries[] = [];
    for (const tn of enabled) {
      try {
        const res = await fetch(`${API_BASE}/trend-data?nodeId=${encodeURIComponent(tn.nodeId)}&from=${from}&to=${to}`);
        if (res.ok) {
          const { data } = await res.json();
          const vals = (data as TrendPoint[]).map(p => ({ ts: p.ts, v: p.v }));
          const numVals = vals.filter(p => typeof p.v === 'number').map(p => p.v as number);
          results.push({
            nodeId: tn.nodeId,
            label: tn.label,
            color: tn.color,
            unit: tn.unit,
            data: vals,
            visible: visibleSeriesIds.size === 0 || visibleSeriesIds.has(tn.nodeId),
            min: numVals.length > 0 ? Math.min(...numVals) : undefined,
            max: numVals.length > 0 ? Math.max(...numVals) : undefined,
            avg: numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) / numVals.length : undefined,
            last: vals.length > 0 ? vals[vals.length - 1].v : undefined,
          });
        }
      } catch {}
    }

    setSeries(prev => results.map(r => {
      const existing = prev.find(p => p.nodeId === r.nodeId);
      return { ...r, visible: existing !== undefined ? existing.visible : true };
    }));
    setLoading(false);
  }, [trackedNodes, computedFromTs, computedToTs, visibleSeriesIds]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    if (view === 'chart') loadTrendData();
  }, [view, loadTrendData]);

  useEffect(() => {
    if (!autoRefresh || view !== 'chart' || useCustomRange) return;
    refreshRef.current = setInterval(loadTrendData, 15000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh, view, loadTrendData, useCustomRange]);

  const toggleTracked = useCallback((nodeId: string, label: string, page: WiresheetPage, unit?: string) => {
    setTrackedNodes(prev => {
      const exists = prev.find(n => n.nodeId === nodeId);
      let next: TrackedNode[];
      if (exists) {
        next = prev.map(n => n.nodeId === nodeId ? { ...n, enabled: !n.enabled } : n);
      } else {
        const colorIdx = prev.length % TREND_COLORS.length;
        next = [...prev, {
          nodeId,
          label,
          pageId: page.id,
          pageName: page.name,
          enabled: true,
          color: TREND_COLORS[colorIdx],
          unit,
        }];
      }
      saveConfig(next);
      return next;
    });
  }, [saveConfig]);

  const removeTracked = useCallback((nodeId: string) => {
    setTrackedNodes(prev => {
      const next = prev.filter(n => n.nodeId !== nodeId);
      saveConfig(next);
      return next;
    });
  }, [saveConfig]);

  const toggleSeriesVisible = useCallback((nodeId: string) => {
    setSeries(prev => prev.map(s => s.nodeId === nodeId ? { ...s, visible: !s.visible } : s));
  }, []);

  const exportCsv = useCallback(() => {
    if (series.length === 0) return;
    const allTs = [...new Set(series.flatMap(s => s.data.map(p => p.ts)))].sort((a, b) => a - b);
    const header = ['Zeitstempel', 'Zeit', ...series.map(s => `${s.label}${s.unit ? ` (${s.unit})` : ''}`)].join(';');
    const rows = allTs.map(ts => {
      const d = new Date(ts);
      const time = `${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE')}`;
      const vals = series.map(s => {
        const p = s.data.find(x => x.ts === ts);
        return p !== undefined ? String(p.v) : '';
      });
      return [ts, time, ...vals].join(';');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [series]);

  const exportPng = useCallback((canvas: HTMLCanvasElement, filename?: string) => {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `trend_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    a.click();
  }, []);

  const nodesByPage = useMemo(() => {
    const map = new Map<string, { page: WiresheetPage; nodes: FlowNode[] }>();
    for (const { node, page } of allNodes) {
      if (!map.has(page.id)) map.set(page.id, { page, nodes: [] });
      map.get(page.id)!.nodes.push(node);
    }
    return map;
  }, [allNodes]);

  const groupedCharts = useMemo(() => {
    if (chartMode !== 'separate') return [];
    if (chartGroups.length === 0) {
      return series.filter(s => s.visible).map(s => ({
        id: s.nodeId,
        name: s.label,
        seriesList: [s],
      }));
    }
    return chartGroups
      .filter(g => g.visible)
      .map(g => ({
        id: g.id,
        name: g.name,
        seriesList: series.filter(s => g.nodeIds.includes(s.nodeId) && s.visible),
      }))
      .filter(g => g.seriesList.length > 0);
  }, [chartMode, chartGroups, series]);

  const seriesByPage = useMemo(() => {
    const map = new Map<string, { pageName: string; series: TrendSeries[] }>();
    for (const s of series) {
      const tn = trackedNodes.find(n => n.nodeId === s.nodeId);
      const key = tn?.pageId || 'unknown';
      const name = tn?.pageName || 'Unbekannt';
      if (!map.has(key)) map.set(key, { pageName: name, series: [] });
      map.get(key)!.series.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].pageName.localeCompare(b[1].pageName));
  }, [series, trackedNodes]);

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Trends</span>
          <span className="text-xs text-slate-500">{trackedNodes.filter(n => n.enabled).length} aufgezeichnet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            {([['chart', TrendingUp, 'Diagramm'], ['config', Settings, 'Konfiguration'], ['groups', Layers, 'Gruppen']] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => setView(v as typeof view)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === v ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'chart' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex-shrink-0 flex-wrap gap-y-1.5">
            {!useCustomRange && (
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                {TIME_RANGES.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => setSelectedRangeIdx(i)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${selectedRangeIdx === i ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                if (!useCustomRange) {
                  const now = new Date();
                  const from = new Date(now.getTime() - rangeMs);
                  setCustomFrom(from.toISOString().slice(0, 16));
                  setCustomTo(now.toISOString().slice(0, 16));
                }
                setUseCustomRange(v => !v);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${useCustomRange ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'text-slate-400 hover:text-white bg-slate-800'}`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Benutzerdefiniert
            </button>

            {useCustomRange && (
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                />
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={loadTrendData}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Laden
                </button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <div className="flex bg-slate-800 rounded-lg p-0.5">
                {([
                  ['tiles', BarChart2, 'Kacheln'],
                  ['combined', TrendingUp, 'Kombiniert'],
                  ['separate', Layers, 'Separat'],
                ] as const).map(([v, Icon, label]) => (
                  <button
                    key={v}
                    onClick={() => setChartMode(v)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === v ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              {!useCustomRange && (
                <button
                  onClick={() => setAutoRefresh(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${autoRefresh ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'text-slate-400 hover:text-white bg-slate-800'}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Auto
                </button>
              )}

              <button
                onClick={loadTrendData}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Neu laden
              </button>

              {series.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {series.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <TrendingUp className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">Keine Trenddaten vorhanden.</p>
                <p className="text-slate-500 text-xs mt-1">Aktiviere Datenpunkte unter "Konfiguration".</p>
              </div>
            )}

            {loading && series.length === 0 && (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
              </div>
            )}

            {series.length > 0 && chartMode === 'tiles' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">Kachelgrösse:</span>
                  <div className="flex bg-slate-800 rounded-lg p-0.5">
                    {([['xs', List, 'Kompakt'], ['sm', Grid3x3, 'Klein'], ['md', LayoutGrid, 'Mittel'], ['lg', BarChart2, 'Gross']] as const).map(([v, Icon, label]) => (
                      <button key={v} onClick={() => setTileSize(v)} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${tileSize === v ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <Icon className="w-3 h-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex bg-slate-800 rounded-lg p-0.5">
                    {([['simple', 'Einfach'], ['detailed', 'Detailliert']] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setTileMode(v)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${tileMode === v ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {seriesByPage.map(([pageId, { pageName, series: pageSeries }]) => (
                  <div key={pageId}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{pageName}</span>
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-xs text-slate-600">{pageSeries.length}</span>
                    </div>
                    <div className={`grid gap-2.5 ${
                      tileSize === 'xs' ? 'grid-cols-1 sm:grid-cols-2' :
                      tileSize === 'sm' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' :
                      tileSize === 'md' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
                      'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    }`}>
                      {pageSeries.map(s => (
                        <TrendTile
                          key={s.nodeId}
                          s={s}
                          liveValues={liveValues}
                          onClick={() => setPopupSeries(s)}
                          tileSize={tileSize}
                          tileMode={tileMode}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {series.length > 0 && chartMode === 'combined' && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
                  <span className="text-sm font-medium text-slate-300">Alle Datenpunkte</span>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {series.map(s => (
                        <button
                          key={s.nodeId}
                          onClick={() => toggleSeriesVisible(s.nodeId)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
                          style={s.visible ? { backgroundColor: s.color + '25', borderColor: s.color + '50', color: s.color } : { backgroundColor: 'transparent', borderColor: '#334155', color: '#475569' }}
                        >
                          {s.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setSeparateAxes(v => !v)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${separateAxes ? 'bg-cyan-600/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Dual-Achse
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <TrendChart
                    series={series}
                    rangeMs={useCustomRange ? (computedToTs - computedFromTs) : rangeMs}
                    fromTs={computedFromTs}
                    height={340}
                    separateAxes={separateAxes}
                    onExportImage={exportPng}
                  />
                </div>
              </div>
            )}

            {series.length > 0 && chartMode === 'separate' && (
              <div className="space-y-4">
                {groupedCharts.map(group => (
                  <TrendChart
                    key={group.id}
                    series={group.seriesList}
                    rangeMs={useCustomRange ? (computedToTs - computedFromTs) : rangeMs}
                    fromTs={computedFromTs}
                    height={260}
                    title={group.name}
                    separateAxes={false}
                    onExportImage={(canvas) => exportPng(canvas, `trend_${group.name}_${new Date().toISOString().slice(0, 10)}.png`)}
                  />
                ))}
                {groupedCharts.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Keine sichtbaren Datenpunkte ausgewaehlt.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'config' && (
        <ConfigView
          pages={pages}
          trackedNodes={trackedNodes}
          setTrackedNodes={setTrackedNodes}
          liveValues={liveValues}
          nodesByPage={nodesByPage}
          expandedPages={expandedPages}
          setExpandedPages={setExpandedPages}
          expandedCustomBlocks={expandedCustomBlocks}
          setExpandedCustomBlocks={setExpandedCustomBlocks}
          toggleTracked={toggleTracked}
          removeTracked={removeTracked}
          saveConfig={saveConfig}
          customBlockDefs={customBlockDefs}
        />
      )}

      {view === 'groups' && (
        <GroupsView
          trackedNodes={trackedNodes}
          chartGroups={chartGroups}
          setChartGroups={(groups) => {
            setChartGroups(groups);
            saveConfig(trackedNodes, groups);
          }}
        />
      )}

      {popupSeries && (
        <TrendPopup
          s={popupSeries}
          allSeries={series}
          initialRangeMs={useCustomRange ? (computedToTs - computedFromTs) : rangeMs}
          liveValues={liveValues}
          onClose={() => setPopupSeries(null)}
          onExportImage={exportPng}
        />
      )}
    </div>
  );
}

const SAMPLE_INTERVALS = [
  { label: '1 Sek', ms: 1000 },
  { label: '5 Sek', ms: 5000 },
  { label: '10 Sek', ms: 10000 },
  { label: '30 Sek', ms: 30000 },
  { label: '1 Min', ms: 60000 },
  { label: '5 Min', ms: 300000 },
  { label: '15 Min', ms: 900000 },
  { label: '1 Std', ms: 3600000 },
];

const RETENTION_OPTIONS = [
  { label: '1 Tag', days: 1 },
  { label: '3 Tage', days: 3 },
  { label: '7 Tage', days: 7 },
  { label: '14 Tage', days: 14 },
  { label: '30 Tage', days: 30 },
  { label: '60 Tage', days: 60 },
  { label: '90 Tage', days: 90 },
  { label: '6 Monate', days: 180 },
  { label: '1 Jahr', days: 365 },
  { label: '2 Jahre', days: 730 },
  { label: '3 Jahre', days: 1095 },
  { label: '5 Jahre', days: 1825 },
  { label: '10 Jahre', days: 3650 },
];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function estimateDailyBytes(sampleIntervalMs: number): number {
  const pointsPerDay = Math.floor(86400000 / sampleIntervalMs);
  return pointsPerDay * 30;
}

function ConfigView({
  pages,
  trackedNodes,
  setTrackedNodes,
  liveValues,
  nodesByPage,
  expandedPages,
  setExpandedPages,
  expandedCustomBlocks,
  setExpandedCustomBlocks,
  toggleTracked,
  removeTracked,
  saveConfig,
  customBlockDefs,
}: {
  pages: WiresheetPage[];
  trackedNodes: TrackedNode[];
  setTrackedNodes: (nodes: TrackedNode[]) => void;
  liveValues: Record<string, unknown>;
  nodesByPage: Map<string, { page: WiresheetPage; nodes: FlowNode[] }>;
  expandedPages: Set<string>;
  setExpandedPages: (s: Set<string>) => void;
  expandedCustomBlocks: Set<string>;
  setExpandedCustomBlocks: (s: Set<string>) => void;
  toggleTracked: (nodeId: string, label: string, page: WiresheetPage, unit?: string) => void;
  removeTracked: (nodeId: string) => void;
  saveConfig: (nodes: TrackedNode[]) => void;
  customBlockDefs: CustomBlockDefinition[];
}) {
  const [diskUsage, setDiskUsage] = useState<Record<string, { bytes: number; files: number }>>({});
  const [totalBytes, setTotalBytes] = useState(0);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/trend-disk-usage`);
        if (res.ok) {
          const data = await res.json();
          setDiskUsage(data.usage || {});
          setTotalBytes(data.totalBytes || 0);
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const updateNode = (nodeId: string, updates: Partial<TrackedNode>) => {
    const next = trackedNodes.map(n => n.nodeId === nodeId ? { ...n, ...updates } : n);
    setTrackedNodes(next);
    saveConfig(next);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl space-y-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-1">Aufzeichnung konfigurieren</h3>
            <p className="text-xs text-slate-400">
              Waehle Datenpunkte aus, die aufgezeichnet werden sollen. Bei komplexen Bausteinen koennen einzelne Ein-/Ausgaenge ausgewaehlt werden.
            </p>
          </div>

          {trackedNodes.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-sm font-medium text-white">Aufgezeichnete Datenpunkte</span>
                <span className="text-xs text-slate-500 ml-2">{trackedNodes.filter(n => n.enabled).length} aktiv</span>
                {totalBytes > 0 && (
                  <span className="ml-auto text-xs text-slate-500">Gesamt: <span className="text-slate-300 font-mono">{formatBytes(totalBytes)}</span></span>
                )}
              </div>
              <div className="divide-y divide-slate-800">
                {trackedNodes.map(tn => {
                  const isExpanded = expandedNodes.has(tn.nodeId);
                  const usage = diskUsage[tn.nodeId];
                  const intervalMs = tn.sampleIntervalMs || 60000;
                  const retention = tn.retentionDays || 730;
                  const dailyEst = estimateDailyBytes(intervalMs);
                  const totalEst = dailyEst * retention;
                  return (
                    <div key={tn.nodeId} className="border-b border-slate-800 last:border-0">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tn.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-medium truncate">{tn.label}</span>
                            {tn.deleted && <span className="text-[10px] text-red-500 font-medium border border-red-800 rounded px-1 py-0.5">Gelöscht</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">{tn.pageName}{tn.unit ? ` · ${tn.unit}` : ''}</span>
                            <span className="text-[10px] text-slate-600">·</span>
                            <span className="text-[10px] text-slate-500">{SAMPLE_INTERVALS.find(s => s.ms === intervalMs)?.label || `${intervalMs}ms`}</span>
                            <span className="text-[10px] text-slate-600">·</span>
                            <span className="text-[10px] text-slate-500">{retention}T Aufbew.</span>
                            {usage && <><span className="text-[10px] text-slate-600">·</span><span className="text-[10px] font-mono text-emerald-600">{formatBytes(usage.bytes)}</span></>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={tn.color}
                            onChange={e => updateNode(tn.nodeId, { color: e.target.value })}
                            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                            title="Farbe"
                          />
                          <button
                            onClick={() => updateNode(tn.nodeId, { enabled: !tn.enabled })}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${tn.enabled ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                          >
                            {tn.enabled ? 'Aktiv' : 'Pausiert'}
                          </button>
                          <button
                            onClick={() => setExpandedNodes(prev => { const n = new Set(prev); if (n.has(tn.nodeId)) n.delete(tn.nodeId); else n.add(tn.nodeId); return n; })}
                            className={`p-1.5 rounded transition-colors ${isExpanded ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                            title="Einstellungen"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Alle Trenddaten fuer "${tn.label}" loeschen?`)) return;
                              await fetch(`${API_BASE}/trend-data?nodeId=${encodeURIComponent(tn.nodeId)}`, { method: 'DELETE' });
                            }}
                            className="p-1.5 rounded text-slate-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
                            title="Daten loeschen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeTracked(tn.nodeId)}
                            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Entfernen"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 bg-slate-800/40 border-t border-slate-800 space-y-4">
                          <div className="pt-3 grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                                <Clock className="w-3 h-3" />Abtastintervall
                              </label>
                              <div className="grid grid-cols-4 gap-1">
                                {SAMPLE_INTERVALS.map(s => (
                                  <button key={s.ms} onClick={() => updateNode(tn.nodeId, { sampleIntervalMs: s.ms })}
                                    className={`py-1 rounded text-[10px] font-medium transition-colors ${intervalMs === s.ms ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1">
                                Ca. <span className="text-slate-300 font-mono">{formatBytes(dailyEst)}</span>/Tag
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                                <Trash2 className="w-3 h-3" />Aufbewahrung
                              </label>
                              <div className="grid grid-cols-4 gap-1">
                                {RETENTION_OPTIONS.map(r => (
                                  <button key={r.days} onClick={() => updateNode(tn.nodeId, { retentionDays: r.days })}
                                    className={`py-1 rounded text-[10px] font-medium transition-colors ${retention === r.days ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                                    {r.label}
                                  </button>
                                ))}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1">
                                Max. ca. <span className="text-slate-300 font-mono">{formatBytes(totalEst)}</span> gesamt
                                {usage && <span className="ml-2 text-emerald-600">(aktuell {formatBytes(usage.bytes)})</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {Array.from(nodesByPage.entries()).map(([pageId, { page, nodes }]) => {
              const isExpanded = expandedPages.has(pageId);
              const customBlockNodes = nodes.filter(n => n.type === 'custom-block');
              const complexNodes = nodes.filter(n => n.type !== 'custom-block' && (n.data.inputs?.length > 0 || n.data.outputs?.length > 0));
              const regularNodes = nodes.filter(n => n.type !== 'custom-block' && !n.data.inputs?.length && !n.data.outputs?.length);

              return (
                <div key={pageId} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedPages((() => {
                      const next = new Set(expandedPages);
                      if (next.has(pageId)) next.delete(pageId); else next.add(pageId);
                      return next;
                    })())}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-800/60 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-sm font-medium text-white">{page.name}</span>
                    <span className="text-xs text-slate-500 ml-1">{nodes.length} Knoten</span>
                    <span className="ml-auto text-xs text-cyan-400">
                      {trackedNodes.filter(n => n.pageId === pageId && n.enabled).length} aktiv
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-800 divide-y divide-slate-800">
                      {regularNodes.map(node => {
                        const tracked = trackedNodes.find(n => n.nodeId === node.id);
                        const liveVal = liveValues[node.id];
                        return (
                          <div key={node.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tracked?.color || '#334155' }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-200 truncate">{node.data.label}</div>
                              <div className="text-xs text-slate-600">{node.type}</div>
                            </div>
                            {liveVal !== undefined && (
                              <span className="text-xs font-mono text-cyan-400 min-w-[60px] text-right">
                                {formatValue(liveVal as number)}
                              </span>
                            )}
                            <button
                              onClick={() => toggleTracked(node.id, node.data.label, page, (node.data.config?.dpUnit as string) || undefined)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                tracked?.enabled
                                  ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                                  : tracked
                                  ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                  : 'border border-slate-700 text-slate-500 hover:border-cyan-600/50 hover:text-cyan-400'
                              }`}
                            >
                              {tracked?.enabled ? (
                                <><Minus className="w-3 h-3" />Stoppen</>
                              ) : tracked ? (
                                <><Plus className="w-3 h-3" />Fortsetzen</>
                              ) : (
                                <><Plus className="w-3 h-3" />Aufzeichnen</>
                              )}
                            </button>
                          </div>
                        );
                      })}

                      {complexNodes.map(cNode => {
                        const cbKey = `complex-${pageId}-${cNode.id}`;
                        const isBlockExpanded = expandedCustomBlocks.has(cbKey);
                        const allPorts = [
                          ...(cNode.data.inputs || []).map(p => ({ ...p, dir: 'input' as const })),
                          ...(cNode.data.outputs || []).map(p => ({ ...p, dir: 'output' as const })),
                        ];
                        return (
                          <div key={cNode.id} className="border-t border-slate-800">
                            <button
                              onClick={() => setExpandedCustomBlocks((() => {
                                const next = new Set(expandedCustomBlocks);
                                if (next.has(cbKey)) next.delete(cbKey); else next.add(cbKey);
                                return next;
                              })())}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
                            >
                              {isBlockExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                              <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold bg-slate-700 text-white">
                                {cNode.data.label?.[0]?.toUpperCase() || 'B'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-200 truncate">{cNode.data.label}</div>
                                <div className="text-xs text-slate-600">Komplexer Baustein · {allPorts.length} Ports</div>
                              </div>
                              <span className="text-xs text-slate-500">
                                {trackedNodes.filter(n => allPorts.some(p => `${cNode.id}:${p.id}` === n.nodeId) && n.enabled).length}/{allPorts.length}
                              </span>
                            </button>
                            {isBlockExpanded && allPorts.length > 0 && (
                              <div className="border-t border-slate-800/50 divide-y divide-slate-800/50">
                                {allPorts.map(port => {
                                  const portNodeId = `${cNode.id}:${port.id}`;
                                  const portLabel = `${cNode.data.label} › ${port.label}`;
                                  const tracked = trackedNodes.find(n => n.nodeId === portNodeId);
                                  const liveVal = liveValues[portNodeId];
                                  return (
                                    <div key={port.id} className="flex items-center gap-3 pl-10 pr-4 py-2">
                                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tracked?.color || '#334155' }} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs text-slate-300 truncate">{port.label}</div>
                                        <div className="text-[10px] text-slate-600 capitalize">{port.dir === 'input' ? 'Eingang' : 'Ausgang'}</div>
                                      </div>
                                      {liveVal !== undefined && (
                                        <span className="text-[11px] font-mono text-cyan-400 min-w-[50px] text-right">
                                          {formatValue(liveVal as number)}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => toggleTracked(portNodeId, portLabel, page, undefined)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                                          tracked?.enabled
                                            ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                                            : tracked
                                            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                            : 'border border-slate-700 text-slate-500 hover:border-cyan-600/50 hover:text-cyan-400'
                                        }`}
                                      >
                                        {tracked?.enabled ? (
                                          <><Minus className="w-2.5 h-2.5" />Stop</>
                                        ) : tracked ? (
                                          <><Plus className="w-2.5 h-2.5" />Weiter</>
                                        ) : (
                                          <><Plus className="w-2.5 h-2.5" />Aufz.</>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                                <div className="pl-10 pr-4 py-2">
                                  <button
                                    onClick={() => {
                                      allPorts.forEach(port => {
                                        const portNodeId = `${cNode.id}:${port.id}`;
                                        const portLabel = `${cNode.data.label} › ${port.label}`;
                                        if (!trackedNodes.find(n => n.nodeId === portNodeId)) {
                                          toggleTracked(portNodeId, portLabel, page, undefined);
                                        }
                                      });
                                    }}
                                    className="text-[11px] text-cyan-500 hover:text-cyan-300 transition-colors flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Alle Ports aufzeichnen
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {customBlockNodes.map(cbNode => {
                        const cbKey = `${pageId}-${cbNode.id}`;
                        const isBlockExpanded = expandedCustomBlocks.has(cbKey);
                        const blockDef = customBlockDefs.find(d => d.id === (cbNode.data as { blockDefinitionId?: string }).blockDefinitionId);
                        const allPorts = [
                          ...(blockDef?.inputs || []).map(p => ({ ...p, dir: 'input' as const })),
                          ...(blockDef?.outputs || []).map(p => ({ ...p, dir: 'output' as const })),
                        ];

                        return (
                          <div key={cbNode.id} className="border-t border-slate-800">
                            <button
                              onClick={() => setExpandedCustomBlocks((() => {
                                const next = new Set(expandedCustomBlocks);
                                if (next.has(cbKey)) next.delete(cbKey); else next.add(cbKey);
                                return next;
                              })())}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
                            >
                              {isBlockExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                              <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: blockDef?.color || '#334155', color: 'white' }}>
                                {(blockDef?.icon || cbNode.data.label)?.[0]?.toUpperCase() || 'B'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-200 truncate">{cbNode.data.label}</div>
                                <div className="text-xs text-slate-600">Komplexer Baustein · {allPorts.length} Ports</div>
                              </div>
                              <span className="text-xs text-slate-500">
                                {trackedNodes.filter(n => allPorts.some(p => `${cbNode.id}:${p.id}` === n.nodeId) && n.enabled).length}/{allPorts.length}
                              </span>
                            </button>
                            {isBlockExpanded && allPorts.length > 0 && (
                              <div className="border-t border-slate-800/50 divide-y divide-slate-800/50">
                                {allPorts.map(port => {
                                  const portNodeId = `${cbNode.id}:${port.id}`;
                                  const portLabel = `${cbNode.data.label} › ${port.name}`;
                                  const tracked = trackedNodes.find(n => n.nodeId === portNodeId);
                                  const liveVal = liveValues[portNodeId];
                                  return (
                                    <div key={port.id} className="flex items-center gap-3 pl-10 pr-4 py-2">
                                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tracked?.color || '#334155' }} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs text-slate-300 truncate">{port.name}</div>
                                        <div className="text-[10px] text-slate-600 capitalize">{port.dir}</div>
                                      </div>
                                      {liveVal !== undefined && (
                                        <span className="text-[11px] font-mono text-cyan-400 min-w-[50px] text-right">
                                          {formatValue(liveVal as number)}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => toggleTracked(portNodeId, portLabel, page, undefined)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                                          tracked?.enabled
                                            ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                                            : tracked
                                            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                            : 'border border-slate-700 text-slate-500 hover:border-cyan-600/50 hover:text-cyan-400'
                                        }`}
                                      >
                                        {tracked?.enabled ? (
                                          <><Minus className="w-2.5 h-2.5" />Stop</>
                                        ) : tracked ? (
                                          <><Plus className="w-2.5 h-2.5" />Weiter</>
                                        ) : (
                                          <><Plus className="w-2.5 h-2.5" />Aufz.</>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                                <div className="pl-10 pr-4 py-2">
                                  <button
                                    onClick={() => {
                                      allPorts.forEach(port => {
                                        const portNodeId = `${cbNode.id}:${port.id}`;
                                        const portLabel = `${cbNode.data.label} › ${port.name}`;
                                        if (!trackedNodes.find(n => n.nodeId === portNodeId)) {
                                          toggleTracked(portNodeId, portLabel, page, undefined);
                                        }
                                      });
                                    }}
                                    className="text-[11px] text-cyan-500 hover:text-cyan-300 transition-colors flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Alle Ports aufzeichnen
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {nodesByPage.size === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">
                Keine Logikknoten vorhanden. Erstelle zuerst einen Logikplan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupsView({
  trackedNodes,
  chartGroups,
  setChartGroups,
}: {
  trackedNodes: TrackedNode[];
  chartGroups: ChartGroup[];
  setChartGroups: (groups: ChartGroup[]) => void;
}) {
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const group: ChartGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      nodeIds: [],
      visible: true,
    };
    setChartGroups([...chartGroups, group]);
    setNewGroupName('');
  };

  const removeGroup = (id: string) => {
    setChartGroups(chartGroups.filter(g => g.id !== id));
  };

  const toggleNodeInGroup = (groupId: string, nodeId: string) => {
    setChartGroups(chartGroups.map(g => {
      if (g.id !== groupId) return g;
      const has = g.nodeIds.includes(nodeId);
      return { ...g, nodeIds: has ? g.nodeIds.filter(n => n !== nodeId) : [...g.nodeIds, nodeId] };
    }));
  };

  const toggleGroupVisible = (groupId: string) => {
    setChartGroups(chartGroups.map(g => g.id === groupId ? { ...g, visible: !g.visible } : g));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl space-y-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-1">Diagramm-Gruppen</h3>
          <p className="text-xs text-slate-400 mb-4">
            Gruppiere Datenpunkte fuer die Separat-Ansicht.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGroup()}
              placeholder="Gruppenname..."
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={addGroup}
              disabled={!newGroupName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              Erstellen
            </button>
          </div>
        </div>

        {chartGroups.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm">
            Noch keine Gruppen erstellt.
          </div>
        )}

        <div className="space-y-3">
          {chartGroups.map(group => (
            <div key={group.id} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white flex-1">{group.name}</span>
                <span className="text-xs text-slate-500">{group.nodeIds.length} Datenpunkte</span>
                <button
                  onClick={() => toggleGroupVisible(group.id)}
                  className={`p-1.5 rounded transition-colors ${group.visible ? 'text-cyan-400 hover:bg-cyan-400/10' : 'text-slate-600 hover:bg-slate-700'}`}
                >
                  {group.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setEditingGroup(editingGroup === group.id ? null : group.id)}
                  className={`p-1.5 rounded transition-colors ${editingGroup === group.id ? 'bg-cyan-600/20 text-cyan-400' : 'text-slate-500 hover:text-white hover:bg-slate-700'}`}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeGroup(group.id)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {editingGroup === group.id && (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-slate-400 mb-3">Datenpunkte auswaehlen:</p>
                  {trackedNodes.length === 0 && (
                    <p className="text-xs text-slate-500">Keine aufgezeichneten Datenpunkte vorhanden.</p>
                  )}
                  {trackedNodes.map(tn => {
                    const inGroup = group.nodeIds.includes(tn.nodeId);
                    return (
                      <button
                        key={tn.nodeId}
                        onClick={() => toggleNodeInGroup(group.id, tn.nodeId)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border ${inGroup ? 'border-cyan-600/40 bg-cyan-600/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tn.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 truncate">{tn.label}</div>
                          <div className="text-xs text-slate-500">{tn.pageName}</div>
                        </div>
                        {inGroup && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {editingGroup !== group.id && group.nodeIds.length > 0 && (
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {group.nodeIds.map(nodeId => {
                    const tn = trackedNodes.find(n => n.nodeId === nodeId);
                    if (!tn) return null;
                    return (
                      <div
                        key={nodeId}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                        style={{ backgroundColor: tn.color + '20', color: tn.color, border: `1px solid ${tn.color}40` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tn.color }} />
                        {tn.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
