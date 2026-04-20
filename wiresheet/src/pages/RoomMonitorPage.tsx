import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Thermometer, Wind, Droplets, Activity,
  Users, AlertTriangle, Zap, TrendingUp, TrendingDown, Minus,
  Clock, RefreshCw, ChevronRight, Box
} from 'lucide-react';
import { DataPoint, DataPointCategory } from '../types/bms';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';

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
}

export function RoomMonitorPage({ buildingId: propBuildingId, roomId: propRoomId, onBack, onOpenConfig }: RoomMonitorPageProps) {
  const params = useParams<{ buildingId: string; roomId: string }>();
  const navigate = useNavigate();
  const buildingId = propBuildingId ?? params.buildingId;
  const roomId = propRoomId ?? params.roomId;
  const handleBack = onBack ?? (() => navigate(`/building/${buildingId}/monitor`));
  const handleOpenConfig = onOpenConfig ?? (() => navigate(`/building/${buildingId}/room/${roomId}/config`));
  const [activeTab, setActiveTab] = useState<'overview' | 'points' | 'alarms' | 'trends'>('overview');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const { buildings } = useBuildingContext();

  const building = buildings.find(b => b.id === buildingId);
  const { floor, room } = useMemo(() => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === roomId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, roomId]);

  const dataPoints = useMemo(() => {
    if (!room) return [];
    return generateMockDataPoints(room);
  }, [room, lastRefresh]);

  const alarms = dataPoints.filter(dp => dp.status === 'alarm');
  const primaryKPIs = dataPoints.slice(0, 6);

  if (!building || !room || !floor) {
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

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={handleBack}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <Breadcrumbs items={[
            { label: building.name, onClick: handleBack, icon: 'building' },
            { label: floor.name, onClick: handleBack, icon: 'floor' },
            { label: room.name, icon: 'room' },
          ]} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-sm" style={{ background: room.color || '#94a3b8' }} />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">{room.name}</h1>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLastRefresh(Date.now())}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleOpenConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
            >
              <Settings size={13} />
              Konfigurieren
            </button>
          </div>
        </div>
      </header>

      <div className="flex border-b border-slate-800 bg-slate-900 px-6">
        {([
          { id: 'overview', label: 'Übersicht' },
          { id: 'points', label: `Datenpunkte (${dataPoints.length})` },
          { id: 'alarms', label: `Alarme${alarms.length > 0 ? ` (${alarms.length})` : ''}` },
          { id: 'trends', label: 'Trends' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="p-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Kennwerte
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
              {primaryKPIs.map(dp => (
                <KPICard key={dp.id} dp={dp} />
              ))}
            </div>

            {alarms.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle size={12} className="text-red-400" />
                  Aktive Alarme
                </h2>
                <div className="flex flex-col gap-2">
                  {alarms.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3 bg-red-950/20 border border-red-800/50 rounded-lg">
                      <AlertTriangle size={14} className="text-red-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-200">{a.label}</p>
                        <p className="text-xs text-red-400/70">Grenzwert überschritten — {a.formattedValue}</p>
                      </div>
                      <button className="px-2.5 py-1 rounded bg-red-800/50 hover:bg-red-700/60 text-xs text-red-200 transition-colors">
                        Quittieren
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Alle Werte
            </h2>
            <div className="flex flex-col gap-1.5">
              {dataPoints.map(dp => (
                <PointRow key={dp.id} dp={dp} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'points' && (
          <div className="p-6">
            <div className="flex flex-col gap-1.5">
              {dataPoints.map(dp => (
                <PointRow key={dp.id} dp={dp} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'alarms' && (
          <div className="p-6">
            {alarms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                  <AlertTriangle size={20} className="text-slate-600" />
                </div>
                <p className="text-sm">Keine aktiven Alarme</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {alarms.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 bg-red-950/20 border border-red-800/50 rounded-lg">
                    <AlertTriangle size={14} className="text-red-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-200">{a.label}</p>
                      <p className="text-xs text-red-400/70 mt-0.5">
                        Istwert: {a.formattedValue} · Datenpunkt: {a.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} className="text-slate-500" />
                      <span className="text-xs text-slate-500">
                        {Math.round((Date.now() - (a.lastUpdate ?? Date.now())) / 1000)}s
                      </span>
                    </div>
                    <button className="px-2.5 py-1 rounded bg-red-800/50 hover:bg-red-700/60 text-xs text-red-200 transition-colors">
                      Quittieren
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dataPoints.filter(dp => dp.historicValues && dp.historicValues.length > 2 && dp.category !== 'occupancy' && dp.category !== 'alarm').map(dp => (
                <div key={dp.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span style={{ color: STATUS_COLORS[dp.status] }}>{CATEGORY_ICONS[dp.category]}</span>
                      <span className="text-sm font-medium text-slate-200">{dp.label}</span>
                    </div>
                    <span className="text-lg font-bold text-white">{dp.formattedValue}</span>
                  </div>
                  {dp.historicValues && (
                    <TrendChartFull values={dp.historicValues} />
                  )}
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
