import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, Download, X, Eye, EyeOff, RefreshCw, Calendar, Check } from 'lucide-react';

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

export interface VisuTrendTilesConfig {
  tileSize: 'xs' | 'sm' | 'md' | 'lg';
  tileMode: 'simple' | 'detailed';
  timeRange: '30min' | '1h' | '6h' | '12h' | '24h' | '7d' | '30d';
  columns?: number;
  showPageHeaders?: boolean;
  backgroundColor?: string;
  refreshIntervalMs?: number;
}

interface VisuTrendTilesProps {
  config: VisuTrendTilesConfig;
  liveValues: Record<string, unknown>;
  isEditMode?: boolean;
  width: number;
  height: number;
}

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? `${m[1]}/api` : '/api';
}

const TIME_RANGES = [
  { label: '30 Min', key: '30min', ms: 1800000 },
  { label: '1 Std', key: '1h', ms: 3600000 },
  { label: '6 Std', key: '6h', ms: 21600000 },
  { label: '12 Std', key: '12h', ms: 43200000 },
  { label: '24 Std', key: '24h', ms: 86400000 },
  { label: '7 Tage', key: '7d', ms: 604800000 },
  { label: '30 Tage', key: '30d', ms: 2592000000 },
];

function formatValue(v: number | boolean | undefined | null): string {
  if (v === undefined || v === null) return '-';
  if (typeof v === 'boolean') return v ? 'EIN' : 'AUS';
  if (Math.abs(v) >= 10000) return v.toFixed(0);
  if (Math.abs(v) >= 1000) return v.toFixed(1);
  if (Math.abs(v) >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

function formatTs(ts: number, rangeMs: number): string {
  const d = new Date(ts);
  if (rangeMs <= 3600000)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  if (rangeMs <= 86400000)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function drawTileChart(canvas: HTMLCanvasElement, series: TrendSeries, rangeMs: number, fromTs: number, h: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (series.data.length < 2) return;

  const isBool = series.data.some(p => typeof p.v === 'boolean');
  const numVals = series.data.filter(p => typeof p.v === 'number').map(p => p.v as number);
  const valMin = numVals.length > 0 ? Math.min(...numVals) : 0;
  const valMax = numVals.length > 0 ? Math.max(...numVals) : 1;
  const pad = (valMax - valMin) * 0.12 || 0.5;
  const yMin = valMin - pad;
  const yMax = valMax + pad;
  const yRange = yMax - yMin || 1;

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, series.color + '40');
  gradient.addColorStop(1, series.color + '00');

  if (isBool) {
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let lastY: number | null = null;
    for (const pt of series.data) {
      const x = ((pt.ts - fromTs) / rangeMs) * w;
      const v = pt.v ? 1 : 0;
      const y = h - v * h * 0.7 - h * 0.15;
      if (lastY !== null) { ctx.lineTo(x, lastY); ctx.lineTo(x, y); }
      else ctx.moveTo(x, y);
      lastY = y;
    }
    ctx.stroke();
  } else {
    const points: [number, number][] = series.data.map(pt => [
      ((pt.ts - fromTs) / rangeMs) * w,
      h - (((typeof pt.v === 'number' ? pt.v : 0) - yMin) / yRange * h * 0.85) - h * 0.05
    ]);
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
    ctx.stroke();
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], h);
      points.forEach(([px, py]) => ctx.lineTo(px, py));
      ctx.lineTo(points[points.length - 1][0], h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }
}

function drawPopupChart(
  canvas: HTMLCanvasElement,
  seriesList: TrendSeries[],
  rangeMs: number,
  fromTs: number,
  h: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const bg = '#0f172a';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const visible = seriesList.filter(s => s.visible && s.data.length > 0);
  if (visible.length === 0) {
    ctx.fillStyle = '#475569';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Keine Daten', w / 2, h / 2);
    return;
  }

  const padLeft = 58, padRight = 16, padTop = 14, padBottom = 46;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const allVals: number[] = [];
  for (const s of visible) for (const p of s.data) if (typeof p.v === 'number') allVals.push(p.v);
  const gMin = allVals.length > 0 ? Math.min(...allVals) : 0;
  const gMax = allVals.length > 0 ? Math.max(...allVals) : 1;
  const vPad = (gMax - gMin) * 0.08 || 0.5;
  const yMin = gMin - vPad, yMax = gMax + vPad, yRange = yMax - yMin || 1;

  for (let i = 0; i <= 5; i++) {
    const y = padTop + (chartH / 5) * i;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
    const val = yMax - (yRange / 5) * i;
    ctx.fillStyle = '#64748b'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(formatValue(val), padLeft - 5, y + 4);
  }
  for (let i = 0; i <= 6; i++) {
    const x = padLeft + (chartW / 6) * i;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, padTop); ctx.lineTo(x, padTop + chartH); ctx.stroke();
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(formatTs(fromTs + (rangeMs / 6) * i, rangeMs), x, padTop + chartH + 18);
  }
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.strokeRect(padLeft, padTop, chartW, chartH);

  ctx.save(); ctx.rect(padLeft, padTop, chartW, chartH); ctx.clip();
  visible.forEach(s => {
    const isBool = s.data.some(p => typeof p.v === 'boolean');
    function toX(ts: number) { return padLeft + ((ts - fromTs) / rangeMs) * chartW; }
    function toY(v: number) { return padTop + chartH - ((v - yMin) / yRange) * chartH; }

    if (isBool) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
      let lastY: number | null = null;
      for (const pt of s.data) {
        const x = toX(pt.ts); const v = pt.v ? 1 : 0;
        const y = padTop + chartH - v * chartH * 0.8 - chartH * 0.1;
        if (lastY !== null) { ctx.lineTo(x, lastY); ctx.lineTo(x, y); } else ctx.moveTo(x, y);
        lastY = y;
      }
      ctx.stroke();
    } else {
      const pts: [number, number][] = s.data.map(p => [toX(p.ts), toY(typeof p.v === 'number' ? p.v : 0)]);
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, s.color + '30'); grad.addColorStop(1, s.color + '00');
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
      pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
      ctx.stroke();
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], padTop + chartH);
        pts.forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.lineTo(pts[pts.length - 1][0], padTop + chartH);
        ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      }
    }
  });
  ctx.restore();

  if (visible.length > 0) {
    let lx = padLeft;
    ctx.font = '10px sans-serif';
    for (const s of visible) {
      const lw = ctx.measureText(s.label).width + 18;
      if (lx + lw > w - 8) break;
      ctx.fillStyle = s.color; ctx.fillRect(lx, padTop + chartH + 30, 10, 7);
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left';
      ctx.fillText(s.label, lx + 14, padTop + chartH + 37);
      lx += lw + 10;
    }
  }
}

function MiniTile({
  s, liveValues, tileSize, tileMode, onClick
}: {
  s: TrendSeries;
  liveValues: Record<string, unknown>;
  tileSize: 'xs' | 'sm' | 'md' | 'lg';
  tileMode: 'simple' | 'detailed';
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = liveValues[s.nodeId];

  const chartH = tileSize === 'xs' ? 36 : tileSize === 'sm' ? 56 : tileSize === 'md' ? 80 : 120;
  const valClass = tileSize === 'xs' ? 'text-sm' : tileSize === 'sm' ? 'text-lg' : tileSize === 'md' ? 'text-2xl' : 'text-3xl';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || s.data.length === 0) return;
    const rMs = s.data.length > 1 ? s.data[s.data.length - 1].ts - s.data[0].ts || 3600000 : 3600000;
    const fTs = s.data[0]?.ts ?? Date.now() - rMs;
    const redraw = () => drawTileChart(canvas, s, rMs, fTs, chartH);
    redraw();
    const obs = new ResizeObserver(redraw);
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [s, chartH]);

  const displayVal = live !== undefined ? formatValue(live as number) : (s.last !== undefined ? formatValue(s.last as number) : '-');

  if (tileSize === 'xs') {
    return (
      <div
        onClick={onClick}
        className={`bg-slate-800/80 border rounded-lg overflow-hidden cursor-pointer transition-all hover:border-slate-500 flex items-center ${s.visible ? 'border-slate-700' : 'border-slate-800 opacity-50'}`}
        style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
      >
        <div className="px-2 py-1.5 flex-shrink-0 min-w-[80px]">
          <div className="text-[9px] text-slate-400 truncate leading-tight">{s.label}</div>
          <div className="flex items-baseline gap-0.5">
            <span className={`${valClass} font-mono font-bold leading-none`} style={{ color: s.color }}>{displayVal}</span>
            {s.unit && <span className="text-[9px] text-slate-500">{s.unit}</span>}
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
      className={`bg-slate-800/80 border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-slate-500 hover:shadow-lg hover:shadow-black/20 group ${s.visible ? 'border-slate-700' : 'border-slate-800 opacity-50'}`}
      style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
    >
      <div className={`px-2.5 ${tileSize === 'lg' ? 'pt-3 pb-1.5' : 'pt-2.5 pb-1'}`}>
        <div className="flex items-center justify-between mb-0.5">
          <span className={`${tileSize === 'lg' ? 'text-xs' : 'text-[10px]'} font-semibold text-slate-300 truncate flex-1`}>{s.label}</span>
          <Maximize2 className="w-2.5 h-2.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0 ml-1" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`${valClass} font-mono font-bold leading-none`} style={{ color: s.color }}>{displayVal}</span>
          {s.unit && <span className="text-[10px] text-slate-500">{s.unit}</span>}
        </div>
      </div>
      <div className="relative w-full" style={{ height: chartH }}>
        <canvas ref={canvasRef} className="w-full h-full" style={{ height: chartH }} />
      </div>
      {tileMode === 'detailed' && (
        <div className="px-2.5 pb-1.5 pt-1 flex gap-2 text-[9px] font-mono border-t border-slate-700/50">
          {s.min !== undefined && <span className="text-blue-400">↓{formatValue(s.min)}</span>}
          {s.max !== undefined && <span className="text-orange-400">↑{formatValue(s.max)}</span>}
          {s.avg !== undefined && <span className="text-slate-500">∅{formatValue(s.avg)}</span>}
        </div>
      )}
    </div>
  );
}

function TilePopup({
  s, allSeries, liveValues, onClose
}: {
  s: TrendSeries;
  allSeries: TrendSeries[];
  liveValues: Record<string, unknown>;
  onClose: () => void;
}) {
  const API_BASE = getApiBase();
  const live = liveValues[s.nodeId];
  const [rangeIdx, setRangeIdx] = useState(1);
  const [useCustom, setUseCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [zoomRange, setZoomRange] = useState<{ from: number; to: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set([s.nodeId]));
  const [popupData, setPopupData] = useState<TrendSeries[]>([s]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; items: { label: string; color: string; value: string }[]; time: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rangeMs = useCustom && customFrom && customTo
    ? new Date(customTo).getTime() - new Date(customFrom).getTime()
    : TIME_RANGES[rangeIdx].ms;
  const baseFrom = useCustom && customFrom ? new Date(customFrom).getTime() : Date.now() - rangeMs;
  const effectiveFrom = zoomRange ? zoomRange.from : baseFrom;
  const effectiveRange = zoomRange ? zoomRange.to - zoomRange.from : rangeMs;

  const loadData = useCallback(async (nodeIds: string[]) => {
    const from = zoomRange ? zoomRange.from : baseFrom;
    const to = zoomRange ? zoomRange.to : baseFrom + rangeMs;
    setLoading(true);
    try {
      const params = new URLSearchParams({ nodeIds: nodeIds.join(','), from: String(from), to: String(to) });
      const res = await fetch(`${API_BASE}/trend?${params}`);
      if (res.ok) {
        const json = await res.json();
        const newSeries: TrendSeries[] = nodeIds.map(nodeId => {
          const src = allSeries.find(x => x.nodeId === nodeId) || (nodeId === s.nodeId ? s : null);
          if (!src) return null!;
          const raw: TrendPoint[] = json[nodeId] || [];
          const numVals = raw.filter(p => typeof p.v === 'number').map(p => p.v as number);
          return {
            ...src,
            data: raw,
            min: numVals.length > 0 ? Math.min(...numVals) : undefined,
            max: numVals.length > 0 ? Math.max(...numVals) : undefined,
            avg: numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) / numVals.length : undefined,
            last: raw.length > 0 ? raw[raw.length - 1].v : undefined,
            visible: visibleIds.has(nodeId),
          };
        }).filter(Boolean);
        setPopupData(newSeries);
      }
    } catch {} finally { setLoading(false); }
  }, [s, allSeries, baseFrom, rangeMs, zoomRange, visibleIds, API_BASE]);

  useEffect(() => {
    loadData(Array.from(visibleIds));
  }, [rangeIdx, useCustom, customFrom, customTo, zoomRange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const displayed = popupData.map(ps => ({ ...ps, visible: visibleIds.has(ps.nodeId) }));
    drawPopupChart(canvas, displayed, effectiveRange, effectiveFrom, 340);
  }, [popupData, effectiveFrom, effectiveRange, visibleIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      const displayed = popupData.map(ps => ({ ...ps, visible: visibleIds.has(ps.nodeId) }));
      drawPopupChart(canvas, displayed, effectiveRange, effectiveFrom, 340);
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [popupData, effectiveFrom, effectiveRange, visibleIds]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const padLeft = 58;
    const chartW = canvas.offsetWidth - padLeft - 16;
    if (mx < padLeft || mx > padLeft + chartW) return;
    const factor = e.deltaY < 0 ? 0.7 : 1.3;
    const frac = (mx - padLeft) / chartW;
    const pivot = effectiveFrom + frac * effectiveRange;
    const newRange = effectiveRange * factor;
    setZoomRange({ from: pivot - frac * newRange, to: pivot - frac * newRange + newRange });
  }, [effectiveFrom, effectiveRange]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const padLeft = 58, padRight = 16, padTop = 14;
    const chartW = canvas.offsetWidth - padLeft - padRight;
    const chartH = 340 - padTop - 46;
    if (mx < padLeft || mx > padLeft + chartW) { setTooltip(null); return; }
    const frac = (mx - padLeft) / chartW;
    const hoverTs = effectiveFrom + frac * effectiveRange;
    const visible = popupData.filter(ps => visibleIds.has(ps.nodeId) && ps.data.length > 0);
    const items = visible.map(ps => {
      let closest = ps.data[0];
      for (const p of ps.data) if (Math.abs(p.ts - hoverTs) < Math.abs(closest.ts - hoverTs)) closest = p;
      return { label: ps.label, color: ps.color, value: `${formatValue(closest?.v as number)}${ps.unit ? ' ' + ps.unit : ''}` };
    });
    setTooltip({ x: mx, y: e.clientY - rect.top, items, time: formatTs(hoverTs, effectiveRange) });
    void chartH;
  }, [popupData, effectiveFrom, effectiveRange, visibleIds]);

  const toggleSeries = (nodeId: string) => {
    setVisibleIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) { if (next.size > 1) next.delete(nodeId); }
      else {
        next.add(nodeId);
        if (!popupData.find(ps => ps.nodeId === nodeId)) {
          loadData(Array.from(next));
          return next;
        }
      }
      setPopupData(prev2 => prev2.map(ps => ({ ...ps, visible: next.has(ps.nodeId) })));
      return next;
    });
  };

  const exportCsv = () => {
    const visible = popupData.filter(ps => visibleIds.has(ps.nodeId));
    if (!visible.length) return;
    const allTs = [...new Set(visible.flatMap(ps => ps.data.map(p => p.ts)))].sort((a, b) => a - b);
    const header = ['Zeitstempel', 'Zeit', ...visible.map(ps => `${ps.label}${ps.unit ? ` (${ps.unit})` : ''}`)].join(';');
    const rows = allTs.map(ts => {
      const d = new Date(ts);
      const time = `${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE')}`;
      return [ts, time, ...visible.map(ps => { const pt = ps.data.find(x => x.ts === ts); return pt !== undefined ? String(pt.v) : ''; })].join(';');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trend_${s.label}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `trend_${s.label}.png`; a.click();
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[99999] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: '92vw', maxWidth: 1100, maxHeight: '92vh' }}>
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 flex-shrink-0" style={{ borderLeftColor: s.color, borderLeftWidth: 4 }}>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{s.label}</h3>
            {s.unit && <span className="text-[10px] text-slate-400">{s.unit}</span>}
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const ps = popupData.find(x => x.nodeId === s.nodeId);
              if (!ps) return null;
              return (
                <div className="flex items-center gap-3 border-r border-slate-700 pr-3 text-center">
                  <div><div className="text-[9px] text-slate-600 uppercase">Aktuell</div><div className="text-xs font-mono font-bold" style={{ color: s.color }}>{live !== undefined ? formatValue(live as number) : formatValue(ps.last as number)}{s.unit ? ' ' + s.unit : ''}</div></div>
                  {ps.min !== undefined && <div><div className="text-[9px] text-slate-600 uppercase">Min</div><div className="text-xs font-mono text-blue-400">{formatValue(ps.min)}</div></div>}
                  {ps.max !== undefined && <div><div className="text-[9px] text-slate-600 uppercase">Max</div><div className="text-xs font-mono text-orange-400">{formatValue(ps.max)}</div></div>}
                  {ps.avg !== undefined && <div><div className="text-[9px] text-slate-600 uppercase">Avg</div><div className="text-xs font-mono text-slate-300">{formatValue(ps.avg)}</div></div>}
                </div>
              );
            })()}
            <button onClick={exportCsv} className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><Download className="w-3 h-3" />CSV</button>
            <button onClick={exportPng} className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><Download className="w-3 h-3" />PNG</button>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 flex-shrink-0 flex-wrap gap-y-1.5">
          {!useCustom && (
            <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
              {TIME_RANGES.map((r, i) => (
                <button key={r.key} onClick={() => { setRangeIdx(i); setZoomRange(null); }} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${rangeIdx === i && !zoomRange ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{r.label}</button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              if (!useCustom) {
                const now = new Date();
                setCustomFrom(new Date(now.getTime() - rangeMs).toISOString().slice(0, 16));
                setCustomTo(now.toISOString().slice(0, 16));
              }
              setUseCustom(v => !v);
              setZoomRange(null);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${useCustom ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30' : 'text-slate-400 hover:text-white bg-slate-800'}`}
          >
            <Calendar className="w-3 h-3" />Custom
          </button>
          {useCustom && (
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500" />
              <span className="text-slate-500 text-xs">bis</span>
              <input type="datetime-local" value={customTo} onChange={e => setCustomTo(e.target.value)} className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500" />
              <button onClick={() => loadData(Array.from(visibleIds))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"><Check className="w-3 h-3" />Laden</button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {zoomRange && (
              <button onClick={() => setZoomRange(null)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-orange-600/20 text-orange-400 border border-orange-600/30 hover:bg-orange-600/30 transition-colors"><RotateCcw className="w-3 h-3" />Reset</button>
            )}
            <div className="flex gap-0.5 bg-slate-800 rounded-lg p-0.5">
              <button onClick={() => { const nr = effectiveRange * 0.6; const c = effectiveFrom + effectiveRange / 2; setZoomRange({ from: c - nr / 2, to: c + nr / 2 }); }} className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
              <button onClick={() => { const nr = effectiveRange * 1.6; const c = effectiveFrom + effectiveRange / 2; setZoomRange({ from: c - nr / 2, to: c + nr / 2 }); }} className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-slate-800/60 flex-shrink-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Serien:</span>
          {allSeries.map(as => {
            const isVis = visibleIds.has(as.nodeId);
            return (
              <button key={as.nodeId} onClick={() => toggleSeries(as.nodeId)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all border"
                style={isVis ? { backgroundColor: as.color + '25', borderColor: as.color + '60', color: as.color } : { backgroundColor: 'transparent', borderColor: '#334155', color: '#475569' }}
              >
                {isVis ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                {as.label}
              </button>
            );
          })}
        </div>

        <div
          className="flex-1 overflow-hidden p-3 select-none"
          onMouseDown={e => { setIsDragging(true); setDragStartX(e.clientX); }}
          onMouseMove={e => {
            if (!isDragging) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const chartW = canvas.offsetWidth - 74;
            const dx = e.clientX - dragStartX;
            const dTs = -(dx / chartW) * effectiveRange;
            setZoomRange({ from: effectiveFrom + dTs, to: effectiveFrom + dTs + effectiveRange });
            setDragStartX(e.clientX);
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => { setIsDragging(false); setTooltip(null); }}
          style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
        >
          <div className="relative w-full" style={{ height: 340 }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ height: 340, display: 'block' }}
              onWheel={handleWheel}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
            />
            {tooltip && (
              <div
                className="absolute pointer-events-none z-50 bg-slate-900/95 border border-slate-700 rounded-lg p-2 shadow-xl text-xs"
                style={{ left: tooltip.x + 12, top: Math.max(4, tooltip.y - 10) }}
              >
                <div className="text-slate-400 mb-1 font-mono text-[10px]">{tooltip.time}</div>
                {tooltip.items.map(item => (
                  <div key={item.label} className="flex items-center gap-2 py-0.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300 truncate max-w-[100px]">{item.label}</span>
                    <span className="font-mono ml-auto" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TrackedNodeEntry {
  nodeId: string;
  label: string;
  pageId: string;
  pageName: string;
  enabled: boolean;
  color: string;
  unit?: string;
}

export const VisuTrendTiles: React.FC<VisuTrendTilesProps> = ({
  config, liveValues, width, height
}) => {
  const API_BASE = getApiBase();
  const [trackedNodes, setTrackedNodes] = useState<TrackedNodeEntry[]>([]);
  const [seriesData, setSeriesData] = useState<TrendSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [popupSeries, setPopupSeries] = useState<TrendSeries | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tileSize = config.tileSize || 'sm';
  const tileMode = config.tileMode || 'simple';
  const rangeKey = config.timeRange || '1h';
  const rangeMs = TIME_RANGES.find(r => r.key === rangeKey)?.ms || 3600000;
  const refreshMs = config.refreshIntervalMs || 30000;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/trend-config`);
        if (res.ok) {
          const data = await res.json();
          setTrackedNodes(data.trackedNodes || []);
        }
      } catch {}
    };
    load();
  }, [API_BASE]);

  const fetchData = useCallback(async () => {
    const enabled = trackedNodes.filter(n => n.enabled);
    if (enabled.length === 0) return;
    setLoading(true);
    const from = Date.now() - rangeMs;
    const to = Date.now();
    try {
      const nodeIds = enabled.map(n => n.nodeId);
      const params = new URLSearchParams({ nodeIds: nodeIds.join(','), from: String(from), to: String(to) });
      const res = await fetch(`${API_BASE}/trend?${params}`);
      if (res.ok) {
        const json = await res.json();
        const series: TrendSeries[] = enabled.map(tn => {
          const raw: TrendPoint[] = json[tn.nodeId] || [];
          const numVals = raw.filter(p => typeof p.v === 'number').map(p => p.v as number);
          return {
            nodeId: tn.nodeId,
            label: tn.label,
            color: tn.color,
            unit: tn.unit,
            data: raw,
            visible: true,
            min: numVals.length > 0 ? Math.min(...numVals) : undefined,
            max: numVals.length > 0 ? Math.max(...numVals) : undefined,
            avg: numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) / numVals.length : undefined,
            last: raw.length > 0 ? raw[raw.length - 1].v : undefined,
          };
        });
        setSeriesData(series);
      }
    } catch {} finally { setLoading(false); }
  }, [trackedNodes, rangeMs, API_BASE]);

  useEffect(() => {
    if (trackedNodes.length > 0) fetchData();
  }, [trackedNodes, fetchData]);

  useEffect(() => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(fetchData, refreshMs);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [fetchData, refreshMs]);

  const seriesByPage = useMemo(() => {
    const map = new Map<string, { pageName: string; series: TrendSeries[] }>();
    for (const s of seriesData) {
      const tn = trackedNodes.find(n => n.nodeId === s.nodeId);
      const key = tn?.pageId || 'unknown';
      const name = tn?.pageName || 'Unbekannt';
      if (!map.has(key)) map.set(key, { pageName: name, series: [] });
      map.get(key)!.series.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].pageName.localeCompare(b[1].pageName));
  }, [seriesData, trackedNodes]);

  const gridClass = tileSize === 'xs' ? 'grid-cols-1 sm:grid-cols-2' :
    tileSize === 'sm' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' :
    tileSize === 'md' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
    'grid-cols-1 sm:grid-cols-2';

  if (trackedNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded border border-slate-700 border-dashed" style={{ backgroundColor: config.backgroundColor || 'transparent' }}>
        <div className="text-center">
          <div className="text-sm font-medium text-slate-400">Trend Kachelansicht</div>
          <div className="text-xs text-slate-600 mt-1">Keine Trends konfiguriert</div>
          <div className="text-[10px] text-slate-700 mt-0.5">{rangeKey} · {tileSize} · {tileMode}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto" style={{ backgroundColor: config.backgroundColor || 'transparent', width, height }}>
      {loading && seriesData.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
        </div>
      )}

      {seriesData.length > 0 && (
        <div className="p-2 space-y-3">
          {seriesByPage.map(([pageId, { pageName, series }]) => (
            <div key={pageId}>
              {config.showPageHeaders !== false && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{pageName}</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              )}
              <div className={`grid ${gridClass} gap-2`}>
                {series.map(s => (
                  <MiniTile
                    key={s.nodeId}
                    s={s}
                    liveValues={liveValues}
                    tileSize={tileSize}
                    tileMode={tileMode}
                    onClick={() => setPopupSeries(s)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {popupSeries && (
        <TilePopup
          s={popupSeries}
          allSeries={seriesData}
          liveValues={liveValues}
          onClose={() => setPopupSeries(null)}
        />
      )}
    </div>
  );
};
