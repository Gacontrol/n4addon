import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, GripVertical, Check,
  Thermometer, Wind, Droplets, Activity, Users, AlertTriangle,
  Zap, Settings, Eye, EyeOff, Star, Building2
} from 'lucide-react';
import { RoomMonitorConfig, RoomDataPointConfig, DataPointCategory, DataPointDisplayType } from '../types/bms';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';

const CATEGORY_ICONS: Record<DataPointCategory, React.ReactNode> = {
  temperature: <Thermometer size={14} />,
  humidity: <Droplets size={14} />,
  co2: <Activity size={14} />,
  airflow: <Wind size={14} />,
  pressure: <Activity size={14} />,
  occupancy: <Users size={14} />,
  alarm: <AlertTriangle size={14} />,
  mode: <Settings size={14} />,
  setpoint: <Settings size={14} />,
  energy: <Zap size={14} />,
  valvePosition: <Activity size={14} />,
  fanSpeed: <Wind size={14} />,
  vavFlow: <Wind size={14} />,
  windowState: <Activity size={14} />,
  comfortIndex: <Activity size={14} />,
  generic: <Activity size={14} />,
};

const CATEGORY_LABELS: Record<DataPointCategory, string> = {
  temperature: 'Temperatur', humidity: 'Feuchte', co2: 'CO₂',
  airflow: 'Luftmenge', pressure: 'Druck', occupancy: 'Belegung',
  alarm: 'Alarm', mode: 'Modus', setpoint: 'Sollwert', energy: 'Energie',
  valvePosition: 'Ventilstellung', fanSpeed: 'Lüfterdrehzahl', vavFlow: 'VAV-Strom',
  windowState: 'Fensterstatus', comfortIndex: 'Komfortindex', generic: 'Allgemein',
};

const DISPLAY_LABELS: Record<DataPointDisplayType, string> = {
  kpi: 'KPI-Kachel', badge: 'Badge', trend: 'Trendlinie',
  statusIcon: 'Status-Symbol', trafficLight: 'Ampel', row: 'Zeile', miniChart: 'Mini-Chart',
};

const DEFAULT_CATEGORIES: DataPointCategory[] = [
  'temperature', 'setpoint', 'humidity', 'co2', 'airflow', 'occupancy', 'energy', 'alarm',
];

function createDefaultConfig(roomId: string): RoomMonitorConfig {
  return {
    roomId,
    datapoints: DEFAULT_CATEGORIES.map((cat, i): RoomDataPointConfig => ({
      datapointId: `${roomId}-${cat}`,
      label: CATEGORY_LABELS[cat],
      displayType: i < 4 ? 'kpi' : 'row',
      order: i,
      showInMonitor: true,
      showInService: true,
      showInTooltip: i < 3,
      showInBuilding: i === 0,
      isPrimaryRoomKPI: i === 0,
      isPrimaryBuildingPoint: i === 0,
      writable: cat === 'setpoint',
    })),
  };
}

interface DPRowProps {
  dp: RoomDataPointConfig;
  onChange: (dp: RoomDataPointConfig) => void;
  onDelete: () => void;
}

function DPRow({ dp, onChange, onDelete }: DPRowProps) {
  const [expanded, setExpanded] = useState(false);

  const category = (dp.datapointId.split('-').pop() as DataPointCategory) || 'generic';
  const icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.generic;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical size={14} className="text-slate-600 cursor-grab shrink-0" />
        <span className="text-slate-400 shrink-0">{icon}</span>
        <input
          type="text"
          value={dp.label}
          onChange={e => onChange({ ...dp, label: e.target.value })}
          className="flex-1 bg-transparent text-sm text-slate-200 focus:outline-none min-w-0"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onChange({ ...dp, showInMonitor: !dp.showInMonitor })}
            title="Im Monitor anzeigen"
            className={`p-1.5 rounded transition-colors ${dp.showInMonitor ? 'text-sky-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'}`}
          >
            {dp.showInMonitor ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            onClick={() => onChange({ ...dp, isPrimaryBuildingPoint: !dp.isPrimaryBuildingPoint })}
            title="Primärer Gebäudepunkt"
            className={`p-1.5 rounded transition-colors ${dp.isPrimaryBuildingPoint ? 'text-amber-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'}`}
          >
            <Building2 size={13} />
          </button>
          <button
            onClick={() => onChange({ ...dp, isPrimaryRoomKPI: !dp.isPrimaryRoomKPI })}
            title="Primärer Raum-KPI"
            className={`p-1.5 rounded transition-colors ${dp.isPrimaryRoomKPI ? 'text-yellow-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'}`}
          >
            <Star size={13} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-slate-600 hover:bg-red-900/40 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700 px-3 py-3 grid grid-cols-2 gap-3 bg-slate-800/50">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Datenpunkt-ID</label>
            <input
              type="text"
              value={dp.datapointId}
              onChange={e => onChange({ ...dp, datapointId: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
              placeholder="z.B. HA:sensor.temp_buero"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Darstellung</label>
            <select
              value={dp.displayType}
              onChange={e => onChange({ ...dp, displayType: e.target.value as DataPointDisplayType })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {Object.entries(DISPLAY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={dp.showInTooltip}
              onChange={e => onChange({ ...dp, showInTooltip: e.target.checked })}
              className="rounded border-slate-600"
            />
            Im Tooltip anzeigen
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={dp.writable}
              onChange={e => onChange({ ...dp, writable: e.target.checked })}
              className="rounded border-slate-600"
            />
            Schreibbar (steuerbar)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={dp.showInService}
              onChange={e => onChange({ ...dp, showInService: e.target.checked })}
              className="rounded border-slate-600"
            />
            Im Service-Modus
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={dp.showInBuilding}
              onChange={e => onChange({ ...dp, showInBuilding: e.target.checked })}
              className="rounded border-slate-600"
            />
            Im Gebäude-Layer
          </label>
        </div>
      )}
    </div>
  );
}

export function RoomConfigPage() {
  const { buildingId, roomId } = useParams<{ buildingId: string; roomId: string }>();
  const navigate = useNavigate();
  const { buildings, monitorConfigs, saveRoomMonitorConfig } = useBuildingContext();

  const building = buildings.find(b => b.id === buildingId);
  const { floor, room } = useMemo(() => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === roomId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, roomId]);

  const [config, setConfig] = useState<RoomMonitorConfig>(() => {
    if (!roomId) return createDefaultConfig('');
    return monitorConfigs[roomId] ?? createDefaultConfig(roomId);
  });

  const [saved, setSaved] = useState(false);

  const addDatapoint = () => {
    const newDp: RoomDataPointConfig = {
      datapointId: `new-dp-${Date.now()}`,
      label: 'Neuer Datenpunkt',
      displayType: 'row',
      order: config.datapoints.length,
      showInMonitor: true,
      showInService: false,
      showInTooltip: false,
      showInBuilding: false,
      isPrimaryRoomKPI: false,
      isPrimaryBuildingPoint: false,
      writable: false,
    };
    setConfig(c => ({ ...c, datapoints: [...c.datapoints, newDp] }));
  };

  const updateDp = (i: number, dp: RoomDataPointConfig) => {
    setConfig(c => {
      const dps = [...c.datapoints];
      dps[i] = dp;
      return { ...c, datapoints: dps };
    });
  };

  const deleteDp = (i: number) => {
    setConfig(c => ({ ...c, datapoints: c.datapoints.filter((_, idx) => idx !== i) }));
  };

  const handleSave = () => {
    saveRoomMonitorConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!building || !room || !floor) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-200 items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Raum nicht gefunden</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-700 rounded-lg text-sm">Zurück</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <Breadcrumbs items={[
            { label: building.name, path: `/building/${buildingId}/monitor`, icon: 'building' },
            { label: room.name, path: `/building/${buildingId}/room/${roomId}/monitor`, icon: 'room' },
            { label: 'Konfiguration' },
          ]} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{room.name} — Konfiguration</h1>
            <p className="text-xs text-slate-400">{floor.name} · Datenpunkte und Darstellung</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/building/${buildingId}/room/${roomId}/monitor`)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className={[
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
                saved ? 'bg-green-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white',
              ].join(' ')}
            >
              {saved ? <><Check size={14} /> Gespeichert</> : <><Check size={14} /> Speichern</>}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Raum-Metadaten</h2>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Raumname</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg text-sm text-slate-300 border border-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: room.color || '#94a3b8' }} />
                  {room.name}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Raumfarbe (Hervorhebung)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.accentColor ?? room.color ?? '#94a3b8'}
                    onChange={e => setConfig(c => ({ ...c, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-xs text-slate-400">{config.accentColor ?? room.color ?? '#94a3b8'}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Standard-Layout</label>
                <select
                  value={config.layout ?? 'grid'}
                  onChange={e => setConfig(c => ({ ...c, layout: e.target.value as 'grid' | 'list' }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="grid">Rasteransicht</option>
                  <option value="list">Listenansicht</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Datenpunkte ({config.datapoints.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  <Star size={10} className="inline text-yellow-400" /> Primär-KPI &nbsp;
                  <Building2 size={10} className="inline text-amber-400" /> Gebäudepunkt &nbsp;
                  <Eye size={10} className="inline text-sky-400" /> Monitor
                </p>
              </div>
              <button
                onClick={addDatapoint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition-colors"
              >
                <Plus size={13} />
                Datenpunkt hinzufügen
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {config.datapoints
                .sort((a, b) => a.order - b.order)
                .map((dp, i) => (
                  <DPRow
                    key={dp.datapointId + i}
                    dp={dp}
                    onChange={updated => updateDp(i, updated)}
                    onDelete={() => deleteDp(i)}
                  />
                ))}
            </div>

            {config.datapoints.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                <Plus size={24} className="mb-2 text-slate-600" />
                <p className="text-sm">Noch keine Datenpunkte konfiguriert</p>
                <button onClick={addDatapoint} className="mt-3 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 transition-colors">
                  Ersten Datenpunkt hinzufügen
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
