import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  TrendingUp, Settings, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Plus, Minus, Download, Eye, EyeOff, Clock, BarChart2, Image,
  Layers, Calendar, X, Check, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { WiresheetPage, FlowNode } from '../types/flow';

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
}

function TrendChart({
  series,
  rangeMs,
  fromTs,
  height = 300,
  title,
  onExportImage,
  separateAxes,
}: {
  series: TrendSeries[];
  rangeMs: number;
  fromTs: number;
  height?: number;
  title?: string;
  onExportImage?: (canvas: HTMLCanvasElement) => void;
  separateAxes: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
              title="Als PNG exportieren"
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

function StatCard({ s, liveValues }: { s: TrendSeries; liveValues: Record<string, unknown> }) {
  const live = liveValues[s.nodeId];
  return (
    <div
      className={`bg-slate-900 border rounded-xl p-3 transition-all ${s.visible ? 'border-slate-700' : 'border-slate-800 opacity-40'}`}
      style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{s.label}</span>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-slate-500">Aktuell</span>
          <span className="text-sm font-mono font-semibold" style={{ color: s.color }}>
            {live !== undefined ? formatValue(live as number) : '-'}
            {s.unit ? <span className="text-xs ml-0.5 text-slate-400">{s.unit}</span> : null}
          </span>
        </div>
        {s.min !== undefined && (
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-slate-500">Min</span>
            <span className="text-xs font-mono text-blue-400">{formatValue(s.min)}{s.unit ? ` ${s.unit}` : ''}</span>
          </div>
        )}
        {s.max !== undefined && (
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-slate-500">Max</span>
            <span className="text-xs font-mono text-orange-400">{formatValue(s.max)}{s.unit ? ` ${s.unit}` : ''}</span>
          </div>
        )}
        {s.avg !== undefined && (
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-slate-500">Durchschn.</span>
            <span className="text-xs font-mono text-slate-300">{formatValue(s.avg)}{s.unit ? ` ${s.unit}` : ''}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-slate-500">Punkte</span>
          <span className="text-xs font-mono text-slate-500">{s.data.length}</span>
        </div>
      </div>
    </div>
  );
}

export function TrendView({ pages, liveValues }: Props) {
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
  const [chartMode, setChartMode] = useState<'combined' | 'separate'>('combined');
  const [separateAxes, setSeparateAxes] = useState(false);
  const [chartGroups, setChartGroups] = useState<ChartGroup[]>([]);
  const [visibleSeriesIds, setVisibleSeriesIds] = useState<Set<string>>(new Set());
  const [showSeriesSelector, setShowSeriesSelector] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exportRef = useRef<HTMLCanvasElement | null>(null);

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
        if (node.type === 'datapoint' || node.type === 'custom-block') continue;
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

  const toggleTracked = useCallback((node: FlowNode, page: WiresheetPage) => {
    setTrackedNodes(prev => {
      const exists = prev.find(n => n.nodeId === node.id);
      let next: TrackedNode[];
      if (exists) {
        next = prev.map(n => n.nodeId === node.id ? { ...n, enabled: !n.enabled } : n);
      } else {
        const colorIdx = prev.length % TREND_COLORS.length;
        next = [...prev, {
          nodeId: node.id,
          label: node.data.label,
          pageId: page.id,
          pageName: page.name,
          enabled: true,
          color: TREND_COLORS[colorIdx],
          unit: (node.data.config?.dpUnit as string) || undefined,
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

  const exportAllChartsPng = useCallback(() => {
    const canvases = document.querySelectorAll<HTMLCanvasElement>('canvas[data-trend-chart]');
    canvases.forEach((canvas, i) => {
      setTimeout(() => exportPng(canvas, `trend_chart_${i + 1}_${new Date().toISOString().slice(0, 10)}.png`), i * 100);
    });
  }, [exportPng]);

  const nodesByPage = useMemo(() => {
    const map = new Map<string, { page: WiresheetPage; nodes: FlowNode[] }>();
    for (const { node, page } of allNodes) {
      if (!map.has(page.id)) map.set(page.id, { page, nodes: [] });
      map.get(page.id)!.nodes.push(node);
    }
    return map;
  }, [allNodes]);

  const visibleSeries = series.filter(s => s.visible);

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
                <button
                  onClick={() => setChartMode('combined')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === 'combined' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <TrendingUp className="w-3 h-3" />
                  Kombiniert
                </button>
                <button
                  onClick={() => setChartMode('separate')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${chartMode === 'separate' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <BarChart2 className="w-3 h-3" />
                  Separat
                </button>
              </div>

              <button
                onClick={() => setShowSeriesSelector(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${showSeriesSelector ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                <Eye className="w-3.5 h-3.5" />
                Auswahl
              </button>

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
                <>
                  <button
                    onClick={exportCsv}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={exportAllChartsPng}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  >
                    <Image className="w-3.5 h-3.5" />
                    PNG
                  </button>
                </>
              )}
            </div>
          </div>

          {showSeriesSelector && series.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex-shrink-0 flex-wrap">
              <span className="text-xs text-slate-400 font-medium">Sichtbare Reihen:</span>
              {series.map(s => (
                <button
                  key={s.nodeId}
                  onClick={() => toggleSeriesVisible(s.nodeId)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${s.visible ? 'text-white border-transparent' : 'bg-transparent text-slate-500 border-slate-700'}`}
                  style={s.visible ? { backgroundColor: s.color + '30', borderColor: s.color + '60', color: s.color } : {}}
                >
                  {s.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {s.label}
                  {s.unit ? <span className="opacity-60">{s.unit}</span> : null}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

            {series.length > 0 && chartMode === 'combined' && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
                  <span className="text-sm font-medium text-slate-300">Alle Datenpunkte</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSeparateAxes(v => !v)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${separateAxes ? 'bg-cyan-600/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Dual-Achse
                    </button>
                    <button
                      onClick={() => {
                        const canvases = document.querySelectorAll<HTMLCanvasElement>('canvas[data-trend-chart]');
                        if (canvases[0]) exportPng(canvases[0]);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <Image className="w-3.5 h-3.5" />
                      PNG
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

            {visibleSeries.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {series.map(s => (
                  <div key={s.nodeId} onClick={() => toggleSeriesVisible(s.nodeId)} className="cursor-pointer">
                    <StatCard s={s} liveValues={liveValues} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'config' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-4xl space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1">Aufzeichnung konfigurieren</h3>
                <p className="text-xs text-slate-400">
                  Waehle Datenpunkte aus, die aufgezeichnet werden sollen. Die Daten werden lokal gespeichert.
                </p>
              </div>

              {trackedNodes.length > 0 && (
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-sm font-medium text-white">Aufgezeichnete Datenpunkte</span>
                    <span className="ml-auto text-xs text-slate-500">{trackedNodes.filter(n => n.enabled).length} aktiv</span>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {trackedNodes.map(tn => (
                      <div key={tn.nodeId} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tn.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{tn.label}</div>
                          <div className="text-xs text-slate-500">{tn.pageName} {tn.unit ? `· ${tn.unit}` : ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={tn.color}
                            onChange={e => {
                              const next = trackedNodes.map(n => n.nodeId === tn.nodeId ? { ...n, color: e.target.value } : n);
                              setTrackedNodes(next);
                              saveConfig(next);
                            }}
                            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                            title="Farbe"
                          />
                          <button
                            onClick={() => {
                              const next = trackedNodes.map(n => n.nodeId === tn.nodeId ? { ...n, enabled: !n.enabled } : n);
                              setTrackedNodes(next);
                              saveConfig(next);
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${tn.enabled ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                          >
                            {tn.enabled ? 'Aktiv' : 'Pausiert'}
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
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {Array.from(nodesByPage.entries()).map(([pageId, { page, nodes }]) => {
                  const isExpanded = expandedPages.has(pageId);
                  return (
                    <div key={pageId} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedPages(prev => {
                          const next = new Set(prev);
                          if (next.has(pageId)) next.delete(pageId); else next.add(pageId);
                          return next;
                        })}
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
                          {nodes.map(node => {
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
                                  onClick={() => toggleTracked(node, page)}
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
            Gruppiere Datenpunkte fuer die Separate-Ansicht. Jede Gruppe wird als eigenes Diagramm dargestellt.
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
            Noch keine Gruppen erstellt. Im Separat-Modus wird jeder Datenpunkt einzeln angezeigt.
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
                  <p className="text-xs text-slate-400 mb-3">Datenpunkte fuer diese Gruppe auswaehlen:</p>
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
