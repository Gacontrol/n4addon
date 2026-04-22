import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Thermometer, Wind, Droplets, Activity, Users, AlertTriangle,
  Zap, Settings, Eye, EyeOff, Star, Building2, GripVertical, ChevronDown, ChevronUp,
  Gauge, RefreshCw, Plug, Fan, Lightbulb, Bell, Snowflake, Flame
} from 'lucide-react';
import { RoomMonitorConfig, RoomDataPointConfig } from '../types/bms';
import { RoomDataPointBinding } from '../types/building';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';

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

const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e', warning: '#f59e0b', alarm: '#ef4444', offline: '#64748b',
};

const DISPLAY_TYPE_LABELS: Record<string, string> = {
  kpi: 'KPI-Kachel',
  row: 'Zeile',
  badge: 'Badge',
  trend: 'Trend',
  statusIcon: 'Status-Symbol',
  trafficLight: 'Ampel',
  miniChart: 'Mini-Chart',
};

function bindingToConfig(b: RoomDataPointBinding, index: number): RoomDataPointConfig {
  return {
    datapointId: b.id,
    label: b.label ?? b.datapoint,
    displayType: b.category === 'alarm' ? 'badge' : index < 4 ? 'kpi' : 'row',
    order: b.order ?? index,
    showInMonitor: b.showInRoom !== false,
    showInService: true,
    showInTooltip: index < 3,
    showInBuilding: b.showInBuilding !== false,
    isPrimaryRoomKPI: index === 0,
    isPrimaryBuildingPoint: index === 0,
    writable: b.writable ?? false,
  };
}

// ---- Live Preview ----

function getMockValue(category: string, binding: RoomDataPointBinding): { value: string; unit: string; status: string } {
  const seed = binding.id.charCodeAt(binding.id.length - 1) || 42;
  const rand = ((seed * 9301 + 49297) % 233280) / 233280;
  const unit = binding.unit ?? '';
  switch (category) {
    case 'temperature': return { value: (19 + rand * 8).toFixed(1), unit: unit || '°C', status: rand > 0.85 ? 'alarm' : rand > 0.7 ? 'warning' : 'ok' };
    case 'setpoint': return { value: (20 + rand * 3).toFixed(1), unit: unit || '°C', status: 'ok' };
    case 'humidity': return { value: (35 + rand * 35).toFixed(0), unit: unit || '%', status: rand > 0.85 ? 'warning' : 'ok' };
    case 'co2': return { value: (400 + rand * 800).toFixed(0), unit: unit || 'ppm', status: rand > 0.7 ? 'warning' : 'ok' };
    case 'airflow': return { value: (rand * 400).toFixed(0), unit: unit || 'm³/h', status: 'ok' };
    case 'occupancy': return { value: rand > 0.5 ? 'Belegt' : 'Frei', unit: '', status: 'ok' };
    case 'alarm': return { value: rand > 0.8 ? 'Alarm' : 'OK', unit: '', status: rand > 0.8 ? 'alarm' : 'ok' };
    case 'energy': return { value: (rand * 1200).toFixed(0), unit: unit || 'W', status: 'ok' };
    default: return { value: (rand * 100).toFixed(1), unit, status: 'ok' };
  }
}

interface PreviewProps {
  roomName: string;
  roomColor: string;
  accentColor: string;
  configs: RoomDataPointConfig[];
  bindings: RoomDataPointBinding[];
}

function LivePreview({ roomName, roomColor, accentColor, configs, bindings }: PreviewProps) {
  const visible = configs.filter(c => c.showInMonitor).sort((a, b) => a.order - b.order);
  const kpis = visible.filter(c => c.displayType === 'kpi').slice(0, 4);
  const rows = visible.filter(c => c.displayType !== 'kpi');
  const primary = kpis[0] ?? rows[0];
  const primaryBinding = primary ? bindings.find(b => b.id === primary.datapointId) : null;
  const primaryMock = primaryBinding ? getMockValue(primaryBinding.category, primaryBinding) : null;

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden shadow-xl">
      <div
        className="px-4 py-3 border-b border-slate-800"
        style={{ borderLeftColor: accentColor || roomColor, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: roomColor || '#94a3b8' }} />
          <span className="text-sm font-semibold text-white truncate flex-1">{roomName}</span>
          {primaryMock && (
            <span className="text-sm font-bold shrink-0" style={{ color: STATUS_COLORS[primaryMock.status] || '#94a3b8' }}>
              {primaryMock.value}{primaryMock.unit ? ` ${primaryMock.unit}` : ''}
            </span>
          )}
        </div>
        {primary && <p className="text-[10px] text-slate-500">{primary.label}</p>}
      </div>

      {kpis.length > 0 && (
        <div className={`grid gap-2 p-3 grid-cols-2`}>
          {kpis.map(cfg => {
            const b = bindings.find(x => x.id === cfg.datapointId);
            const mock = b ? getMockValue(b.category, b) : null;
            const icon = CATEGORY_ICONS[b?.category ?? 'generic'] ?? CATEGORY_ICONS.generic;
            const statusColor = mock ? (STATUS_COLORS[mock.status] || '#94a3b8') : '#94a3b8';
            return (
              <div key={cfg.datapointId} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: statusColor }}>{icon}</span>
                  <span className="text-[10px] text-slate-400 truncate">{cfg.label}</span>
                </div>
                {mock && (
                  <div className="flex items-end gap-1">
                    <span className="text-base font-bold text-white leading-none">{mock.value}</span>
                    {mock.unit && <span className="text-[10px] text-slate-400 pb-0.5">{mock.unit}</span>}
                  </div>
                )}
                {cfg.writable && mock && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] text-slate-500">Sollwert</span>
                      <span className="text-[9px] text-sky-400">{mock.value} {mock.unit}</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, (parseFloat(mock.value) - (b?.minValue ?? 15)) / ((b?.maxValue ?? 30) - (b?.minValue ?? 15)) * 100))}%`,
                          background: accentColor || '#0ea5e9',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div className="px-3 pb-3 flex flex-col gap-1">
          {rows.slice(0, 4).map(cfg => {
            const b = bindings.find(x => x.id === cfg.datapointId);
            const mock = b ? getMockValue(b.category, b) : null;
            const icon = CATEGORY_ICONS[b?.category ?? 'generic'] ?? CATEGORY_ICONS.generic;
            const statusColor = mock ? (STATUS_COLORS[mock.status] || '#94a3b8') : '#94a3b8';
            return (
              <div key={cfg.datapointId} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-800/40 border border-slate-700/40">
                <span style={{ color: statusColor }} className="shrink-0">{icon}</span>
                <span className="text-[11px] text-slate-300 flex-1 truncate">{cfg.label}</span>
                {mock && (
                  <span className="text-[11px] font-semibold text-white shrink-0">
                    {mock.value}{mock.unit ? ` ${mock.unit}` : ''}
                  </span>
                )}
              </div>
            );
          })}
          {rows.length > 4 && (
            <p className="text-[10px] text-slate-600 text-center py-0.5">+{rows.length - 4} weitere</p>
          )}
        </div>
      )}

      {visible.length === 0 && (
        <div className="px-4 py-8 text-center text-slate-600 text-xs">
          Keine sichtbaren Datenpunkte konfiguriert
        </div>
      )}
    </div>
  );
}

// ---- Config Row ----

interface ConfigRowProps {
  cfg: RoomDataPointConfig;
  binding?: RoomDataPointBinding;
  onChange: (updated: RoomDataPointConfig) => void;
  onDelete: () => void;
}

function ConfigRow({ cfg, binding, onChange, onDelete }: ConfigRowProps) {
  const [expanded, setExpanded] = useState(false);
  const category = (binding?.category ?? 'generic') as string;
  const icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.generic;

  return (
    <div className={`bg-slate-800/70 border rounded-xl overflow-hidden transition-all ${cfg.showInMonitor ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical size={13} className="text-slate-600 cursor-grab shrink-0" />
        <span className="text-slate-400 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={cfg.label}
            onChange={e => onChange({ ...cfg, label: e.target.value })}
            className="w-full bg-transparent text-sm text-slate-200 focus:outline-none"
          />
          {binding && (
            <p className="text-[10px] text-slate-600 font-mono truncate">{binding.datapoint}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onChange({ ...cfg, showInMonitor: !cfg.showInMonitor })}
            title={cfg.showInMonitor ? 'Im Monitor sichtbar' : 'Versteckt'}
            className={`p-1.5 rounded-lg transition-colors ${cfg.showInMonitor ? 'text-sky-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'}`}
          >
            {cfg.showInMonitor ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            onClick={() => onChange({ ...cfg, isPrimaryBuildingPoint: !cfg.isPrimaryBuildingPoint })}
            title="Gebäude-Hauptwert"
            className={`p-1.5 rounded-lg transition-colors ${cfg.isPrimaryBuildingPoint ? 'text-amber-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'}`}
          >
            <Building2 size={13} />
          </button>
          <button
            onClick={() => onChange({ ...cfg, isPrimaryRoomKPI: !cfg.isPrimaryRoomKPI })}
            title="Primärer Raum-KPI"
            className={`p-1.5 rounded-lg transition-colors ${cfg.isPrimaryRoomKPI ? 'text-yellow-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-700 hover:text-slate-400'}`}
          >
            <Star size={13} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-lg transition-colors ${expanded ? 'text-slate-300 bg-slate-700' : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-red-900/40 hover:text-red-400 transition-colors"
          >
            <AlertTriangle size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 px-3 py-3 bg-slate-900/40 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Darstellung</label>
            <select
              value={cfg.displayType}
              onChange={e => onChange({ ...cfg, displayType: e.target.value as RoomDataPointConfig['displayType'] })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {Object.entries(DISPLAY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.writable}
                onChange={e => onChange({ ...cfg, writable: e.target.checked })}
                className="rounded border-slate-600 accent-sky-500"
              />
              Steuerbar (Sollwert-Slider)
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.showInTooltip}
                onChange={e => onChange({ ...cfg, showInTooltip: e.target.checked })}
                className="rounded border-slate-600 accent-sky-500"
              />
              Im Tooltip anzeigen
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.showInBuilding}
                onChange={e => onChange({ ...cfg, showInBuilding: e.target.checked })}
                className="rounded border-slate-600 accent-sky-500"
              />
              Im Gebäude-Layer
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.showInService}
                onChange={e => onChange({ ...cfg, showInService: e.target.checked })}
                className="rounded border-slate-600 accent-sky-500"
              />
              Im Service-Modus
            </label>
          </div>
          {binding && (
            <div className="col-span-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Datenpunkt-Binding</p>
              <p className="text-xs text-slate-200 font-mono truncate">{binding.datapoint}</p>
              {binding.unit && <p className="text-[10px] text-slate-500 mt-0.5">Einheit: {binding.unit}</p>}
              {(binding.minValue !== undefined || binding.maxValue !== undefined) && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Bereich: {binding.minValue ?? '—'} … {binding.maxValue ?? '—'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

interface RoomConfigPageProps {
  buildingId?: string;
  roomId?: string;
  onBack?: () => void;
  onOpenMonitor?: () => void;
}

export function RoomConfigPage({ buildingId: propBuildingId, roomId: propRoomId, onBack, onOpenMonitor }: RoomConfigPageProps) {
  const params = useParams<{ buildingId: string; roomId: string }>();
  const navigate = useNavigate();
  const buildingId = propBuildingId ?? params.buildingId;
  const roomId = propRoomId ?? params.roomId;
  const handleBack = onBack ?? (() => navigate(-1));
  const handleOpenMonitor = onOpenMonitor ?? (() => navigate(`/building/${buildingId}/room/${roomId}/monitor`));
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

  const bindings: RoomDataPointBinding[] = useMemo(() => room?.bindings ?? [], [room]);

  const initialConfig = useMemo<RoomMonitorConfig>(() => {
    if (!roomId) return { roomId: '', datapoints: [] };
    const saved = monitorConfigs[roomId];
    if (saved) return saved;
    if (bindings.length > 0) {
      return {
        roomId,
        datapoints: bindings
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((b, i) => bindingToConfig(b, i)),
      };
    }
    return { roomId, datapoints: [] };
  }, [roomId, monitorConfigs, bindings]);

  const [config, setConfig] = useState<RoomMonitorConfig>(initialConfig);
  const [accentColor, setAccentColor] = useState(initialConfig.accentColor ?? room?.color ?? '#0ea5e9');
  const [saved, setSaved] = useState(false);

  const unaddedBindings = bindings.filter(b => !config.datapoints.find(d => d.datapointId === b.id));

  const addBinding = (b: RoomDataPointBinding) => {
    setConfig(c => ({
      ...c,
      datapoints: [...c.datapoints, bindingToConfig(b, c.datapoints.length)],
    }));
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
    saveRoomMonitorConfig({ ...config, accentColor });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!building || !room || !floor) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-200 items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Raum nicht gefunden</p>
          <button onClick={handleBack} className="px-4 py-2 bg-slate-700 rounded-lg text-sm">Zurück</button>
        </div>
      </div>
    );
  }

  const sortedDps = config.datapoints.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={handleBack} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <Breadcrumbs items={[
            { label: building.name, onClick: handleBack, icon: 'building' },
            { label: room.name, onClick: handleOpenMonitor, icon: 'room' },
            { label: 'Konfiguration' },
          ]} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{room.name}</h1>
            <p className="text-xs text-slate-400">{floor.name} · Monitor-Konfiguration</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleOpenMonitor} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors">
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className={[
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
                saved ? 'bg-emerald-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white',
              ].join(' ')}
            >
              <Check size={14} />
              {saved ? 'Gespeichert' : 'Speichern'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Config panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-8">

            <section>
              <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Darstellung</h2>
              <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Raumname</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 rounded-lg text-sm text-slate-300 border border-slate-700/60">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
                    {room.name}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Akzentfarbe (Label)</label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs text-slate-400 font-mono">{accentColor}</span>
                    <button
                      onClick={() => setAccentColor(room.color || '#0ea5e9')}
                      className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      zurücksetzen
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Datenpunkte ({config.datapoints.length})
                  </h2>
                  <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-2">
                    <Star size={9} className="text-yellow-400" /> Primär-KPI &nbsp;
                    <Building2 size={9} className="text-amber-400" /> Gebäudewert &nbsp;
                    <Eye size={9} className="text-sky-400" /> Monitor
                  </p>
                </div>
              </div>

              {bindings.length === 0 && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-medium mb-0.5">Keine Bindings konfiguriert</p>
                    <p className="text-amber-400/70">
                      Öffne den Gebäude-Editor und weise dem Raum unter "HLK-Belegung" Datenpunkte zu. Danach erscheinen sie hier.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {sortedDps.map((dp, i) => {
                  const binding = bindings.find(b => b.id === dp.datapointId);
                  return (
                    <ConfigRow
                      key={dp.datapointId + i}
                      cfg={dp}
                      binding={binding}
                      onChange={updated => updateDp(i, updated)}
                      onDelete={() => deleteDp(i)}
                    />
                  );
                })}
              </div>

              {unaddedBindings.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Weitere verfügbare Datenpunkte</p>
                  <div className="flex flex-col gap-1.5">
                    {unaddedBindings.map(b => {
                      const cat = b.category as string;
                      const icon = CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.generic;
                      return (
                        <button
                          key={b.id}
                          onClick={() => addBinding(b)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/40 border border-dashed border-slate-700 hover:border-sky-700 hover:bg-slate-800 text-left transition-colors group"
                        >
                          <span className="text-slate-500 group-hover:text-sky-400 shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 group-hover:text-slate-200 truncate">{b.label ?? b.datapoint}</p>
                            <p className="text-[10px] text-slate-600 font-mono truncate">{b.datapoint}</p>
                          </div>
                          <span className="text-[10px] text-sky-600 group-hover:text-sky-400 shrink-0">+ Hinzufügen</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {config.datapoints.length === 0 && bindings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-600 border border-dashed border-slate-800 rounded-xl">
                  <Settings size={22} className="mb-2 text-slate-700" />
                  <p className="text-xs">Weise dem Raum im Editor zuerst Datenpunkte zu.</p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Live preview */}
        <div className="w-72 shrink-0 border-l border-slate-800 bg-slate-900/50 p-5 overflow-y-auto">
          <h2 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-4">Vorschau — Monitor-Label</h2>
          <LivePreview
            roomName={room.name}
            roomColor={room.color}
            accentColor={accentColor}
            configs={config.datapoints}
            bindings={bindings}
          />
          <p className="mt-4 text-[10px] text-slate-600 leading-relaxed">
            Die Vorschau zeigt wie der Raum im Monitor-Panel erscheint. Aktiviere den Sichtbarkeits-Button um Datenpunkte ein-/auszublenden.
          </p>
        </div>
      </div>
    </div>
  );
}
