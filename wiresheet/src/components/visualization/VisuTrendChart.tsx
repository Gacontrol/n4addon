import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TrendChartConfig, TrendChartType } from '../../types/visualization';

interface TrendPoint {
  ts: number;
  v: number | boolean;
}

interface ResolvedSeries {
  nodeId: string;
  label: string;
  color: string;
  unit?: string;
  decimals?: number;
  visible: boolean;
  chartType?: TrendChartType;
  lineWidth?: number;
  fillOpacity?: number;
  yAxisSide?: 'left' | 'right';
  data: TrendPoint[];
  min?: number;
  max?: number;
  avg?: number;
  last?: number | boolean;
}

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? `${m[1]}/api` : '/api';
}

function formatTs(ts: number, rangeMs: number): string {
  const d = new Date(ts);
  if (rangeMs <= 3600000)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  if (rangeMs <= 86400000)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatVal(v: number | boolean | undefined | null, decimals?: number): string {
  if (v === undefined || v === null) return '-';
  if (typeof v === 'boolean') return v ? 'EIN' : 'AUS';
  if (decimals !== undefined) return v.toFixed(decimals);
  if (Math.abs(v) >= 10000) return v.toFixed(0);
  if (Math.abs(v) >= 100) return v.toFixed(1);
  if (Math.abs(v) >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

const TIME_RANGE_MS: Record<string, number> = {
  '5min': 300000,
  '15min': 900000,
  '30min': 1800000,
  '1h': 3600000,
  '6h': 21600000,
  '12h': 43200000,
  '24h': 86400000,
  '7d': 604800000,
  '30d': 2592000000,
};

function drawTrendChart(
  canvas: HTMLCanvasElement,
  seriesList: ResolvedSeries[],
  rangeMs: number,
  fromTs: number,
  cfg: TrendChartConfig
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const bg = cfg.backgroundColor || '#0f172a';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const visibleSeries = seriesList.filter(s => s.visible && s.data.length > 0);

  const hasRightAxis = visibleSeries.some(s => s.yAxisSide === 'right');
  const padLeft = 58;
  const padRight = hasRightAxis ? 58 : 12;
  const padTop = cfg.title ? 32 : 14;
  const padBottom = cfg.showLegend !== false ? 50 : 32;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  if (cfg.title) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.title, w / 2, 18);
  }

  if (visibleSeries.length === 0) {
    ctx.fillStyle = '#475569';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Keine Daten', w / 2, h / 2);
    return;
  }

  const leftSeries = visibleSeries.filter(s => s.yAxisSide !== 'right');
  const rightSeries = visibleSeries.filter(s => s.yAxisSide === 'right');

  function getAxisBounds(series: ResolvedSeries[]): { yMin: number; yMax: number; range: number } {
    if (series.length === 0) return { yMin: 0, yMax: 1, range: 1 };
    if (!cfg.autoScale && cfg.yMin !== undefined && cfg.yMax !== undefined) {
      return { yMin: cfg.yMin, yMax: cfg.yMax, range: cfg.yMax - cfg.yMin || 1 };
    }
    const allVals: number[] = [];
    for (const s of series) {
      for (const p of s.data) {
        if (typeof p.v === 'number') allVals.push(p.v);
      }
    }
    if (allVals.length === 0) return { yMin: 0, yMax: 1, range: 1 };
    const mn = Math.min(...allVals);
    const mx = Math.max(...allVals);
    const pad = (mx - mn) * 0.08 || 0.5;
    const yMin = mn - pad;
    const yMax = mx + pad;
    return { yMin, yMax, range: yMax - yMin || 1 };
  }

  const leftBounds = getAxisBounds(leftSeries.length > 0 ? leftSeries : visibleSeries);
  const rightBounds = getAxisBounds(rightSeries);

  const gridLines = 5;
  const gridColor = cfg.gridColor || '#1e293b';

  if (cfg.showGrid !== false) {
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (chartH / gridLines) * i;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();

      const val = leftBounds.yMax - (leftBounds.range / gridLines) * i;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(formatVal(val), padLeft - 5, y + 4);
    }

    if (hasRightAxis && rightBounds) {
      for (let i = 0; i <= gridLines; i++) {
        const y = padTop + (chartH / gridLines) * i;
        const val = rightBounds.yMax - (rightBounds.range / gridLines) * i;
        ctx.fillStyle = rightSeries[0]?.color + 'cc' || '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(formatVal(val), padLeft + chartW + 5, y + 4);
      }
    }

    const timeSteps = 6;
    for (let i = 0; i <= timeSteps; i++) {
      const x = padLeft + (chartW / timeSteps) * i;
      const ts = fromTs + (rangeMs / timeSteps) * i;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + chartH);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatTs(ts, rangeMs), x, padTop + chartH + 18);
    }
  }

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(padLeft, padTop, chartW, chartH);

  ctx.save();
  ctx.rect(padLeft, padTop, chartW, chartH);
  ctx.clip();

  visibleSeries.forEach((s) => {
    if (s.data.length === 0) return;

    const isRight = s.yAxisSide === 'right';
    const bounds = isRight ? rightBounds : leftBounds;
    const { yMin, yMax, range } = bounds;

    const effectiveType = s.chartType || cfg.chartType || 'line';
    const lineW = s.lineWidth || 2;
    const fillOp = s.fillOpacity !== undefined ? s.fillOpacity : (cfg.fillArea ? 0.15 : 0.06);

    const isBool = s.data.some(p => typeof p.v === 'boolean');

    function toX(ts: number) {
      return padLeft + ((ts - fromTs) / rangeMs) * chartW;
    }
    function toY(v: number) {
      return padTop + chartH - ((v - yMin) / range) * chartH;
    }

    if (isBool || effectiveType === 'stepped') {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      let lastY: number | null = null;
      for (const point of s.data) {
        const x = toX(point.ts);
        const v = typeof point.v === 'boolean' ? (point.v ? 1 : 0) : point.v;
        const y = isBool ? padTop + chartH - v * chartH * 0.8 - chartH * 0.1 : toY(v);
        if (lastY !== null) {
          ctx.lineTo(x, lastY);
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x, y);
        }
        lastY = y;
      }
      ctx.stroke();
    } else if (effectiveType === 'bar') {
      const barWidth = Math.max(2, (chartW / s.data.length) * 0.7);
      for (const point of s.data) {
        const x = toX(point.ts);
        const v = typeof point.v === 'number' ? point.v : 0;
        const y = toY(v);
        const zeroY = toY(Math.max(yMin, 0));
        ctx.fillStyle = s.color + 'cc';
        ctx.fillRect(x - barWidth / 2, Math.min(y, zeroY), barWidth, Math.abs(zeroY - y));
      }
    } else if (effectiveType === 'scatter') {
      ctx.fillStyle = s.color;
      for (const point of s.data) {
        const x = toX(point.ts);
        const v = typeof point.v === 'number' ? point.v : 0;
        const y = toY(v);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const points: [number, number][] = s.data.map(p => [
        toX(p.ts),
        toY(typeof p.v === 'number' ? p.v : 0)
      ]);

      ctx.strokeStyle = s.color;
      ctx.lineWidth = lineW;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      if (cfg.smoothing && points.length > 2) {
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length - 1; i++) {
          const cpx = (points[i][0] + points[i + 1][0]) / 2;
          const cpy = (points[i][1] + points[i + 1][1]) / 2;
          ctx.quadraticCurveTo(points[i][0], points[i][1], cpx, cpy);
        }
        ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
      } else {
        for (let i = 0; i < points.length; i++) {
          if (i === 0) ctx.moveTo(points[i][0], points[i][1]);
          else ctx.lineTo(points[i][0], points[i][1]);
        }
      }
      ctx.stroke();

      if (fillOp > 0 && points.length > 1) {
        const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        gradient.addColorStop(0, s.color + Math.round(fillOp * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, s.color + '00');
        ctx.beginPath();
        ctx.moveTo(points[0][0], padTop + chartH);
        if (cfg.smoothing && points.length > 2) {
          ctx.lineTo(points[0][0], points[0][1]);
          for (let i = 1; i < points.length - 1; i++) {
            const cpx = (points[i][0] + points[i + 1][0]) / 2;
            const cpy = (points[i][1] + points[i + 1][1]) / 2;
            ctx.quadraticCurveTo(points[i][0], points[i][1], cpx, cpy);
          }
          ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
        } else {
          for (const [px, py] of points) ctx.lineTo(px, py);
        }
        ctx.lineTo(points[points.length - 1][0], padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
  });

  ctx.restore();

  if (cfg.showLegend !== false && visibleSeries.length > 0) {
    const legendY = padTop + chartH + 30;
    let legendX = padLeft;
    ctx.font = '11px sans-serif';
    for (const s of visibleSeries) {
      const labelWidth = ctx.measureText(s.label).width + 20;
      if (legendX + labelWidth > w - 8) break;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.roundRect(legendX, legendY - 6, 12, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, legendX + 16, legendY + 2);
      legendX += labelWidth + 12;
    }
  }
}

interface VisuTrendChartProps {
  config: TrendChartConfig;
  isEditMode: boolean;
  width: number;
  height: number;
}

export const VisuTrendChart: React.FC<VisuTrendChartProps> = ({
  config,
  isEditMode,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seriesData, setSeriesData] = useState<ResolvedSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; items: { label: string; color: string; value: string }[] } | null>(null);
  const animFrameRef = useRef<number>(0);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rangeMs = config.timeRange === 'custom'
    ? ((config.customToMs || Date.now()) - (config.customFromMs || Date.now() - 3600000))
    : (TIME_RANGE_MS[config.timeRange] || 3600000);

  const fromTs = config.timeRange === 'custom'
    ? (config.customFromMs || Date.now() - rangeMs)
    : Date.now() - rangeMs;

  const fetchData = useCallback(async () => {
    if (!config.series || config.series.length === 0) {
      setSeriesData([]);
      return;
    }
    setLoading(true);
    try {
      const from = config.timeRange === 'custom' ? (config.customFromMs || Date.now() - rangeMs) : Date.now() - rangeMs;
      const to = config.timeRange === 'custom' ? (config.customToMs || Date.now()) : Date.now();
      const nodeIds = config.series.filter(s => s.visible !== false).map(s => s.nodeId);
      if (nodeIds.length === 0) { setSeriesData([]); setLoading(false); return; }

      const params = new URLSearchParams({ nodeIds: nodeIds.join(','), from: String(from), to: String(to) });
      const res = await fetch(`${getApiBase()}/trend?${params}`);
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();

      const resolved: ResolvedSeries[] = config.series.map(s => {
        const raw: TrendPoint[] = json[s.nodeId] || [];
        const numVals = raw.filter(p => typeof p.v === 'number').map(p => p.v as number);
        return {
          ...s,
          data: raw,
          min: numVals.length > 0 ? Math.min(...numVals) : undefined,
          max: numVals.length > 0 ? Math.max(...numVals) : undefined,
          avg: numVals.length > 0 ? numVals.reduce((a, b) => a + b, 0) / numVals.length : undefined,
          last: raw.length > 0 ? raw[raw.length - 1].v : undefined,
        };
      });
      setSeriesData(resolved);
    } catch {
      setSeriesData(config.series.map(s => ({ ...s, data: [] })));
    } finally {
      setLoading(false);
    }
  }, [config.series, config.timeRange, config.customFromMs, config.customToMs, rangeMs]);

  useEffect(() => {
    fetchData();
    const interval = config.refreshIntervalMs || 10000;
    refreshRef.current = setInterval(fetchData, interval);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [fetchData, config.refreshIntervalMs]);

  useEffect(() => {
    if (!canvasRef.current) return;
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      if (canvasRef.current) {
        drawTrendChart(canvasRef.current, seriesData, rangeMs, fromTs, config);
      }
    });
  }, [seriesData, width, height, config, rangeMs, fromTs]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || seriesData.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const padLeft = 58;
    const padTop = config.title ? 32 : 14;
    const padBottom = config.showLegend !== false ? 50 : 32;
    const hasRightAxis = seriesData.some(s => s.yAxisSide === 'right');
    const padRight = hasRightAxis ? 58 : 12;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    if (mx < padLeft || mx > padLeft + chartW || my < padTop || my > padTop + chartH) {
      setTooltip(null);
      return;
    }

    const fraction = (mx - padLeft) / chartW;
    const ts = fromTs + fraction * rangeMs;

    const items = seriesData
      .filter(s => s.visible && s.data.length > 0)
      .map(s => {
        let closest = s.data[0];
        let minDist = Infinity;
        for (const p of s.data) {
          const d = Math.abs(p.ts - ts);
          if (d < minDist) { minDist = d; closest = p; }
        }
        return { label: s.label, color: s.color, value: `${formatVal(closest.v, s.decimals)}${s.unit ? ' ' + s.unit : ''}` };
      });

    setTooltip({ x: mx, y: my, items });
  }, [seriesData, fromTs, rangeMs, width, height, config.title, config.showLegend]);

  const visibleSeries = seriesData.filter(s => s.visible);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={config.showTooltip !== false ? handleMouseMove : undefined}
        onMouseLeave={() => setTooltip(null)}
      />

      {loading && (
        <div className="absolute top-1 right-2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        </div>
      )}

      {config.showMinMaxAvg && visibleSeries.length > 0 && (
        <div className="absolute top-0 left-0 flex gap-2 px-1 py-0.5 flex-wrap" style={{ maxWidth: width }}>
          {visibleSeries.slice(0, 3).map(s => (
            <div key={s.nodeId} className="flex gap-1 text-[9px] font-mono" style={{ color: s.color }}>
              <span>↓{formatVal(s.min, s.decimals)}</span>
              <span>↑{formatVal(s.max, s.decimals)}</span>
              <span>∅{formatVal(s.avg, s.decimals)}</span>
              {s.unit && <span>{s.unit}</span>}
            </div>
          ))}
        </div>
      )}

      {tooltip && config.showTooltip !== false && (
        <div
          className="absolute pointer-events-none z-50 bg-slate-900/95 border border-slate-700 rounded-lg p-2 shadow-xl text-xs"
          style={{
            left: tooltip.x + 12 > width - 120 ? tooltip.x - 130 : tooltip.x + 12,
            top: Math.max(4, tooltip.y - 10)
          }}
        >
          {tooltip.items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-400">{item.label}:</span>
              <span className="text-white font-mono">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {isEditMode && config.series.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <div className="text-sm">Trend-Chart</div>
            <div className="text-xs mt-1">Datenpunkte in den Eigenschaften auswählen</div>
          </div>
        </div>
      )}
    </div>
  );
};
