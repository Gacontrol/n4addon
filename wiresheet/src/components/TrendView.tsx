import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  TrendingUp, Settings, Trash2, RefreshCw, ChevronDown, ChevronRight,
  Plus, Minus, ZoomIn, ZoomOut, Calendar, Clock, Download, Eye, EyeOff
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
}

interface Props {
  pages: WiresheetPage[];
  liveValues: Record<string, unknown>;
}

const TREND_COLORS = [
  '#38bdf8', '#34d399', '#fb923c', '#f472b6',
  '#a78bfa', '#facc15', '#f87171', '#4ade80',
  '#60a5fa', '#c084fc', '#fb7185', '#86efac',
];

const TIME_RANGES = [
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
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }
  if (rangeMs <= 86400000) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatValue(v: number | boolean | undefined | null): string {
  if (v === undefined || v === null) return '-';
  if (typeof v === 'boolean') return v ? 'EIN' : 'AUS';
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1000) return v.toFixed(1);
    if (Math.abs(v) >= 10) return v.toFixed(2);
    return v.toFixed(3);
  }
  return String(v);
}

function TrendChart({ series, rangeMs, height = 300 }: { series: TrendSeries[]; rangeMs: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; items: { label: string; color: string; value: string; unit?: string }[]; time: string } | null>(null);

  const visibleSeries = series.filter(s => s.visible && s.data.length > 0);

  const now = Date.now();
  const fromTs = now - rangeMs;

  const allValues = useMemo(() => {
    const vals: number[] = [];
    for (const s of visibleSeries) {
      for (const p of s.data) {
        if (typeof p.v === 'number') vals.push(p.v);
      }
    }
    return vals;
  }, [visibleSeries]);

  const globalMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const globalMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const valueRange = globalMax - globalMin || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 60;
    const padRight = 16;
    const padTop = 12;
    const padBottom = 36;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();

      const val = globalMax - (valueRange / gridLines) * i;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(formatValue(val), padLeft - 6, y + 4);
    }

    const timeSteps = 6;
    for (let i = 0; i <= timeSteps; i++) {
      const x = padLeft + (chartW / timeSteps) * i;
      const ts = fromTs + (rangeMs / timeSteps) * i;
      ctx.strokeStyle = '#1e293b';
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

    for (const s of visibleSeries) {
      if (s.data.length === 0) continue;

      const isBool = s.data.some(p => typeof p.v === 'boolean');

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';

      if (isBool) {
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
          lastX = x;
          lastY = y;
        }
        ctx.stroke();
      } else {
        const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        const hex = s.color;
        gradient.addColorStop(0, hex + '30');
        gradient.addColorStop(1, hex + '00');

        ctx.beginPath();
        let first = true;
        const points: [number, number][] = [];
        for (const point of s.data) {
          const x = padLeft + ((point.ts - fromTs) / rangeMs) * chartW;
          const v = typeof point.v === 'number' ? point.v : 0;
          const y = padTop + chartH - ((v - globalMin) / valueRange) * chartH;
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
    }
  }, [visibleSeries, globalMin, globalMax, valueRange, fromTs, rangeMs, height]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || visibleSeries.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const w = canvas.offsetWidth;
    const padLeft = 60;
    const padRight = 16;
    const chartW = w - padLeft - padRight;

    if (mx < padLeft || mx > padLeft + chartW) {
      setTooltip(null);
      return;
    }

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
    <div className="relative w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded cursor-crosshair"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-slate-800 border border-slate-600 rounded-lg p-2.5 shadow-xl text-xs min-w-[140px]"
          style={{ left: Math.min(tooltip.x + 12, (canvasRef.current?.offsetWidth || 400) - 160), top: Math.max(tooltip.y - 80, 8) }}
        >
          <div className="text-slate-400 mb-1.5 font-mono">{tooltip.time}</div>
          {tooltip.items.map(item => (
            <div key={item.label} className="flex items-center gap-2 py-0.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-300 truncate max-w-[80px]">{item.label}</span>
              <span className="font-mono ml-auto" style={{ color: item.color }}>
                {item.value}{item.unit ? ` ${item.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrendView({ pages, liveValues }: Props) {
  const [view, setView] = useState<'chart' | 'config'>('chart');
  const [trackedNodes, setTrackedNodes] = useState<TrackedNode[]>([]);
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(1);
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const rangeMs = TIME_RANGES[selectedRangeIdx].ms;

  const allNodes = useMemo((): { node: FlowNode; page: WiresheetPage }[] => {
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
        setTrackedNodes(data.trackedNodes || []);
      }
    } catch {}
  }, []);

  const saveConfig = useCallback(async (nodes: TrackedNode[]) => {
    try {
      await fetch(`${API_BASE}/trend-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedNodes: nodes }),
      });
    } catch {}
  }, []);

  const loadTrendData = useCallback(async () => {
    const enabled = trackedNodes.filter(n => n.enabled);
    if (enabled.length === 0) { setSeries([]); return; }

    setLoading(true);
    const now = Date.now();
    const from = now - rangeMs;

    const results: TrendSeries[] = [];
    for (const tn of enabled) {
      try {
        const res = await fetch(`${API_BASE}/trend-data?nodeId=${encodeURIComponent(tn.nodeId)}&from=${from}&to=${now}`);
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
            visible: true,
            min: numVals.length > 0 ? Math.min(...numVals) : undefined,
            max: numVals.length > 0 ? Math.max(...numVals) : undefined,
            avg: numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) / numVals.length : undefined,
          });
        }
      } catch {}
    }
    setSeries(prev => {
      return results.map(r => {
        const existing = prev.find(p => p.nodeId === r.nodeId);
        return { ...r, visible: existing ? existing.visible : true };
      });
    });
    setLoading(false);
  }, [trackedNodes, rangeMs]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    if (view === 'chart') loadTrendData();
  }, [view, loadTrendData]);

  useEffect(() => {
    if (!autoRefresh || view !== 'chart') return;
    refreshRef.current = setInterval(loadTrendData, 10000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [autoRefresh, view, loadTrendData]);

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

  const nodesByPage = useMemo(() => {
    const map = new Map<string, { page: WiresheetPage; nodes: FlowNode[] }>();
    for (const { node, page } of allNodes) {
      if (!map.has(page.id)) map.set(page.id, { page, nodes: [] });
      map.get(page.id)!.nodes.push(node);
    }
    return map;
  }, [allNodes]);

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Trends</span>
          <span className="text-xs text-slate-500">{trackedNodes.filter(n => n.enabled).length} aktiv aufgezeichnet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setView('chart')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'chart' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Diagramm
            </button>
            <button
              onClick={() => setView('config')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'config' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Settings className="w-3.5 h-3.5" />
              Konfiguration
            </button>
          </div>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex-shrink-0 flex-wrap">
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
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${autoRefresh ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'text-slate-400 hover:text-white bg-slate-800'}`}
              >
                <Clock className="w-3.5 h-3.5" />
                Auto
              </button>
              <button
                onClick={loadTrendData}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Laden
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

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {series.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <TrendingUp className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="text-slate-400 text-sm">Keine Trenddaten vorhanden.</p>
                  <p className="text-slate-500 text-xs mt-1">Aktiviere Datenpunkte unter "Konfiguration" und starte die Logik.</p>
                </div>
              )}

              {series.length > 0 && (
                <>
                  <TrendChart series={series} rangeMs={rangeMs} height={320} />

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {series.map(s => (
                      <div
                        key={s.nodeId}
                        className={`bg-slate-900 border rounded-lg p-3 transition-all cursor-pointer ${s.visible ? 'border-slate-700' : 'border-slate-800 opacity-50'}`}
                        style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
                        onClick={() => toggleSeriesVisible(s.nodeId)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-slate-300 truncate">{s.label}</span>
                          {s.visible ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-600" />}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Aktuell</span>
                            <span className="font-mono" style={{ color: s.color }}>
                              {liveValues[s.nodeId] !== undefined ? formatValue(liveValues[s.nodeId] as number) : '-'}
                              {s.unit ? ` ${s.unit}` : ''}
                            </span>
                          </div>
                          {s.min !== undefined && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Min</span>
                              <span className="font-mono text-slate-400">{formatValue(s.min)}{s.unit ? ` ${s.unit}` : ''}</span>
                            </div>
                          )}
                          {s.max !== undefined && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Max</span>
                              <span className="font-mono text-slate-400">{formatValue(s.max)}{s.unit ? ` ${s.unit}` : ''}</span>
                            </div>
                          )}
                          {s.avg !== undefined && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Ø</span>
                              <span className="font-mono text-slate-400">{formatValue(s.avg)}{s.unit ? ` ${s.unit}` : ''}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Punkte</span>
                            <span className="font-mono text-slate-400">{s.data.length}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-4xl space-y-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1">Aufzeichnung konfigurieren</h3>
                <p className="text-xs text-slate-400">
                  Waehle Datenpunkte aus der Logik aus, die aufgezeichnet werden sollen. Die Daten werden lokal gespeichert und im Diagramm angezeigt.
                </p>
              </div>

              {trackedNodes.length > 0 && (
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-sm font-medium text-white">Aufgezeichnete Datenpunkte</span>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {trackedNodes.map(tn => (
                      <div key={tn.nodeId} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tn.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{tn.label}</div>
                          <div className="text-xs text-slate-500">{tn.pageName}</div>
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
                            onClick={() => removeTracked(tn.nodeId)}
                            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-800 transition-colors"
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
                                {tracked && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tracked.color }} />}
                                {!tracked && <div className="w-2.5 h-2.5 rounded-full bg-slate-700 flex-shrink-0" />}
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
    </div>
  );
}
