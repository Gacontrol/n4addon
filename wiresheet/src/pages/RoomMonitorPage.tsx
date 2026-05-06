import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Thermometer, Wind, Droplets, Activity,
  Users, AlertTriangle, Zap, Gauge, Flame, Settings2,
  ChevronRight, RefreshCw,
} from 'lucide-react';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';
import { useRoomDisplayConfig } from '../hooks/useRoomDisplayConfig';
import { DatapointCategory, CATEGORY_LABELS, RoomDatapointDisplay } from '../types/roomDisplay';
import type { Room } from '../types/building';

// ---- Category icons ----

const CATEGORY_ICONS: Record<DatapointCategory, typeof Thermometer> = {
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

const CATEGORY_COLORS: Record<DatapointCategory, string> = {
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

// ---- Format a live value ----

function fmt(val: unknown, unit?: string): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'Ein' : 'Aus';
  if (typeof val === 'number') {
    const rounded = Math.abs(val) < 10 ? Math.round(val * 10) / 10 : Math.round(val);
    return unit ? `${rounded} ${unit}` : String(rounded);
  }
  return unit ? `${String(val)} ${unit}` : String(val);
}

function getStatus(val: unknown, dp: RoomDatapointDisplay): 'ok' | 'warning' | 'alarm' | 'offline' {
  if (val === undefined || val === null) return 'offline';
  if (dp.category === 'alarm' && (val === true || val === 1 || val === '1')) return 'alarm';
  if (typeof val === 'number') {
    if (dp.highThreshold !== undefined && val > dp.highThreshold) return 'alarm';
    if (dp.lowThreshold !== undefined && val < dp.lowThreshold) return 'alarm';
  }
  return 'ok';
}

const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  alarm: '#ef4444',
  offline: '#475569',
};

// ---- KPI Card ----

function KPICard({ dp, val }: { dp: RoomDatapointDisplay; val: unknown }) {
  const Icon = CATEGORY_ICONS[dp.category] ?? Activity;
  const catColor = CATEGORY_COLORS[dp.category] ?? '#64748b';
  const status = getStatus(val, dp);
  const statusColor = STATUS_COLORS[status];
  const isAlarm = status === 'alarm';

  return (
    <div className={[
      'rounded-xl border p-3 flex flex-col gap-2 transition-colors',
      isAlarm ? 'border-red-500/40 bg-red-950/10' : 'border-slate-700/60 bg-slate-800/50',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4" style={{ color: catColor }} />
        <span className="text-[9px] uppercase tracking-wider text-slate-500">{CATEGORY_LABELS[dp.category]}</span>
      </div>
      <div>
        <span className="text-xl font-bold leading-none" style={{ color: isAlarm ? statusColor : 'white' }}>
          {fmt(val, dp.unit)}
        </span>
      </div>
      <div className="text-[10px] text-slate-500 truncate">{dp.label || dp.datapoint}</div>
    </div>
  );
}

// ---- Point Row ----

function PointRow({ dp, val }: { dp: RoomDatapointDisplay; val: unknown }) {
  const Icon = CATEGORY_ICONS[dp.category] ?? Activity;
  const catColor = CATEGORY_COLORS[dp.category] ?? '#64748b';
  const status = getStatus(val, dp);
  const isAlarm = status === 'alarm';

  return (
    <div className={[
      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
      isAlarm ? 'border-red-500/30 bg-red-950/10' : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800',
    ].join(' ')}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: catColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 font-medium truncate">{dp.label || dp.datapoint}</p>
        <p className="text-[10px] font-mono text-slate-600 truncate">{dp.datapoint}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {val !== undefined && val !== null ? (
          <span className={[
            'text-sm font-semibold',
            isAlarm ? 'text-red-400' : 'text-white',
          ].join(' ')}>
            {fmt(val, dp.unit)}
          </span>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[status] }} />
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

  const { buildings } = useBuildingContext();
  const { getConfig } = useRoomDisplayConfig(buildingId);

  const [activeTab, setActiveTab] = useState<'overview' | 'points' | 'alarms'>('overview');

  const building = buildings.find(b => b.id === buildingId);

  const { floor, room } = useMemo((): { floor: { id: string; name: string; level: number; rooms: Room[] } | null; room: Room | null } => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === roomId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, roomId]);

  const roomCfg = roomId ? getConfig(roomId) : undefined;
  const datapoints = roomCfg?.visibleDatapoints ?? [];

  const alarmDps = useMemo(() =>
    datapoints.filter(dp => getStatus(liveValues[dp.datapoint], dp) === 'alarm'),
    [datapoints, liveValues],
  );

  const kpiDps = useMemo(() => {
    const seen = new Set<DatapointCategory>();
    const preferred: DatapointCategory[] = ['temperature', 'co2', 'humidity', 'occupancy', 'alarm', 'energy'];
    const result: RoomDatapointDisplay[] = [];
    for (const cat of preferred) {
      const dp = datapoints.find(d => d.category === cat && !seen.has(d.category));
      if (dp) { seen.add(dp.category); result.push(dp); }
    }
    return result;
  }, [datapoints]);

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

  const headerContent = (
    <div className={asPanel ? 'bg-slate-900/80 border-b border-slate-800 px-4 py-3 rounded-t-2xl shrink-0' : 'bg-slate-900/80 border-b border-slate-800 px-6 py-4 shrink-0'}>
      <div className="flex items-center gap-2 mb-2">
        <Breadcrumbs items={[
          { label: building.name, onClick: handleBack, icon: 'building' },
          { label: floor.name, onClick: handleBack, icon: 'floor' },
          { label: room.name, icon: 'room' },
        ]} />
        <button
          onClick={handleBack}
          className="ml-auto p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors shrink-0"
        >
          <ArrowLeft size={14} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
          <div className="min-w-0">
            <h1 className={`${asPanel ? 'text-base' : 'text-xl'} font-bold text-white leading-tight truncate`}>{room.name}</h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              {(room as unknown as { number?: string }).number && <span>{(room as unknown as { number?: string }).number}</span>}
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
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleOpenConfig}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-200 transition-colors"
          >
            <Settings size={12} />
            {asPanel ? '' : 'Konfigurieren'}
          </button>
        </div>
      </div>
    </div>
  );

  const tabBar = (
    <div className={`flex border-b border-slate-800 bg-slate-900/60 ${asPanel ? 'px-4' : 'px-6'} shrink-0`}>
      {([
        { id: 'overview' as const, label: 'Übersicht' },
        { id: 'points' as const, label: `Datenpunkte (${datapoints.length})` },
        { id: 'alarms' as const, label: `Alarme${alarmDps.length > 0 ? ` (${alarmDps.length})` : ''}` },
      ]).map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
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

  const tabContent = (
    <div className="flex-1 overflow-y-auto">
      {activeTab === 'overview' && (
        <div className={asPanel ? 'p-4' : 'p-6 max-w-5xl mx-auto'}>
          {/* Primary datapoint highlight */}
          {roomCfg?.primaryDatapoint && (
            <div className="mb-5 rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Hauptdatenpunkt</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-white">
                  {fmt(liveValues[roomCfg.primaryDatapoint], roomCfg.primaryUnit)}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">{roomCfg.primaryLabel || roomCfg.primaryDatapoint}</div>
            </div>
          )}

          {kpiDps.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Kennwerte</div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {kpiDps.map(dp => (
                  <KPICard key={dp.datapoint} dp={dp} val={liveValues[dp.datapoint]} />
                ))}
              </div>
            </>
          )}

          {alarmDps.length > 0 && (
            <div className="mb-5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-red-400" /> Aktive Alarme
              </div>
              <div className="flex flex-col gap-1.5">
                {alarmDps.map(dp => (
                  <div key={dp.datapoint} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                    <AlertTriangle size={12} className="text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-red-200 truncate">{dp.label}</p>
                      <p className="text-xs text-red-400/70">{fmt(liveValues[dp.datapoint], dp.unit)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {datapoints.length === 0 ? (
            <EmptyState onConfigure={handleOpenConfig} />
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Alle Werte</div>
              <div className="flex flex-col gap-1">
                {datapoints.map(dp => (
                  <PointRow key={dp.datapoint} dp={dp} val={liveValues[dp.datapoint]} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'points' && (
        <div className={asPanel ? 'p-4' : 'p-6 max-w-3xl mx-auto'}>
          {datapoints.length === 0 ? (
            <EmptyState onConfigure={handleOpenConfig} />
          ) : (
            <div className="flex flex-col gap-1">
              {datapoints.map(dp => (
                <PointRow key={dp.datapoint} dp={dp} val={liveValues[dp.datapoint]} />
              ))}
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
              {alarmDps.map(dp => (
                <div key={dp.datapoint} className="flex items-center gap-2.5 px-3 py-2.5 bg-red-950/20 border border-red-800/50 rounded-lg">
                  <AlertTriangle size={12} className="text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-200">{dp.label}</p>
                    <p className="text-xs text-red-400/70 mt-0.5">{fmt(liveValues[dp.datapoint], dp.unit)}</p>
                  </div>
                </div>
              ))}
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
