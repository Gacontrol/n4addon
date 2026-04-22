import { useEffect, useMemo, useState } from 'react';
import {
  X, Home, Save, Trash2, Plus, GripVertical, ChevronRight, Star, Activity,
  Thermometer, Wind, Droplets, AlertTriangle, Users, Gauge, Flame, Zap, Settings2,
  Search, ArrowUp, ArrowDown,
} from 'lucide-react';
import type { Room, Floor, Building } from '../../types/building';
import type { DatapointGroup } from './RoomBindingsPanel';
import {
  BUILDING_MODES,
  BuildingDisplayMode,
  CATEGORY_LABELS,
  DatapointCategory,
  DatapointDisplayKind,
  RoomDatapointDisplay,
  RoomDisplayConfig,
} from '../../types/roomDisplay';
import { emptyRoomConfig } from '../../hooks/useRoomDisplayConfig';

interface Props {
  building: Building;
  floor: Floor;
  room: Room;
  initialConfig?: RoomDisplayConfig;
  datapointGroups: DatapointGroup[];
  datapointLabels?: Record<string, string>;
  liveValues?: Record<string, unknown>;
  buildingMode: BuildingDisplayMode;
  onSave: (cfg: RoomDisplayConfig) => void;
  onDelete?: () => void;
  onClose: () => void;
  onOpenBindings?: () => void;
}

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

const DISPLAY_KINDS: { id: DatapointDisplayKind; label: string }[] = [
  { id: 'tile', label: 'Kachel' },
  { id: 'badge', label: 'Badge' },
  { id: 'value', label: 'Wert' },
  { id: 'trend', label: 'Trend' },
  { id: 'icon', label: 'Icon' },
  { id: 'traffic', label: 'Ampel' },
];

function fmt(val: unknown, unit?: string): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'Ein' : 'Aus';
  if (typeof val === 'number') {
    const rounded = Math.abs(val) < 10 ? Math.round(val * 10) / 10 : Math.round(val);
    return unit ? `${rounded} ${unit}` : String(rounded);
  }
  return unit ? `${String(val)} ${unit}` : String(val);
}

export function RoomDetailsPage({
  building,
  floor,
  room,
  initialConfig,
  datapointGroups,
  datapointLabels,
  liveValues,
  buildingMode,
  onSave,
  onDelete,
  onClose,
  onOpenBindings,
}: Props) {
  const [cfg, setCfg] = useState<RoomDisplayConfig>(
    initialConfig ?? emptyRoomConfig(building.id, floor.id, room.id),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPageId, setPickerPageId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<'primary' | 'add' | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setCfg(initialConfig ?? emptyRoomConfig(building.id, floor.id, room.id));
  }, [initialConfig, building.id, floor.id, room.id]);

  const mode = BUILDING_MODES.find(m => m.id === buildingMode);

  const getLabel = (entityId: string) => {
    if (!entityId) return '';
    if (datapointLabels && datapointLabels[entityId]) return datapointLabels[entityId];
    for (const g of datapointGroups) {
      const hit = g.datapoints.find(d => d.entityId === entityId);
      if (hit && hit.label && hit.label !== hit.entityId) return hit.label;
    }
    return entityId;
  };

  const updateVisible = (idx: number, patch: Partial<RoomDatapointDisplay>) => {
    setCfg(prev => ({
      ...prev,
      visibleDatapoints: prev.visibleDatapoints.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }));
  };

  const removeVisible = (idx: number) => {
    setCfg(prev => ({ ...prev, visibleDatapoints: prev.visibleDatapoints.filter((_, i) => i !== idx) }));
  };

  const moveVisible = (idx: number, dir: -1 | 1) => {
    setCfg(prev => {
      const arr = [...prev.visibleDatapoints];
      const ni = idx + dir;
      if (ni < 0 || ni >= arr.length) return prev;
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return { ...prev, visibleDatapoints: arr };
    });
  };

  const openPicker = (mode: 'primary' | 'add') => {
    setPickerFor(mode);
    setPickerPageId(null);
    setSearch('');
    setPickerOpen(true);
  };

  const pickDatapoint = (entityId: string) => {
    const label = getLabel(entityId);
    if (pickerFor === 'primary') {
      setCfg(prev => ({ ...prev, primaryDatapoint: entityId, primaryLabel: label }));
    } else if (pickerFor === 'add') {
      if (cfg.visibleDatapoints.some(d => d.datapoint === entityId)) {
        setPickerOpen(false);
        setPickerFor(null);
        return;
      }
      const newItem: RoomDatapointDisplay = {
        datapoint: entityId,
        label,
        category: 'generic',
        unit: '',
        displayKind: 'tile',
      };
      setCfg(prev => ({ ...prev, visibleDatapoints: [...prev.visibleDatapoints, newItem] }));
    }
    setPickerOpen(false);
    setPickerFor(null);
  };

  const kpiCards = useMemo(() => {
    const byCat: Record<string, RoomDatapointDisplay | undefined> = {};
    for (const d of cfg.visibleDatapoints) {
      if (!byCat[d.category]) byCat[d.category] = d;
    }
    const preferredOrder: DatapointCategory[] = ['temperature', 'co2', 'humidity', 'occupancy', 'alarm', 'energy'];
    return preferredOrder.map(cat => byCat[cat]).filter(Boolean) as RoomDatapointDisplay[];
  }, [cfg.visibleDatapoints]);

  const handleSave = () => { onSave(cfg); };

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-[min(680px,48vw)] h-[min(88vh,900px)] flex flex-col pointer-events-none">
      <div className="relative flex flex-col h-full w-full bg-slate-950/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.7)] pointer-events-auto animate-[slideInRight_.22s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Home className="w-3 h-3" />
            <span className="truncate">{building.name}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="truncate">{floor.name}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-200 font-medium truncate">{room.name}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${room.color}22`, border: `1px solid ${room.color}66` }}
                >
                  <Home className="w-5 h-5" style={{ color: room.color }} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white truncate">{room.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="capitalize">{room.type}</span>
                    <span>•</span>
                    <span>{floor.name}</span>
                    {mode && mode.id !== 'none' && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-900/40 text-sky-300 rounded">
                          <Activity className="w-2.5 h-2.5" />
                          {mode.label} aktiv
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onOpenBindings && (
                <button
                  onClick={onOpenBindings}
                  className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  HLK-Belegung
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {kpiCards.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Übersicht</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {kpiCards.map(dp => {
                    const Icon = CATEGORY_ICONS[dp.category] ?? Activity;
                    const val = liveValues?.[dp.datapoint];
                    return (
                      <div key={dp.datapoint} className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/40 p-3 hover:border-slate-700 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <Icon className="w-4 h-4 text-sky-400" />
                          <span className="text-[9px] uppercase tracking-wider text-slate-500">{CATEGORY_LABELS[dp.category]}</span>
                        </div>
                        <div className="text-xl font-semibold text-white tabular-nums">{fmt(val, dp.unit)}</div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{dp.label || dp.datapoint}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Hauptdatenpunkt im Gebäude</div>
                  <div className="text-xs text-slate-400 mt-0.5">Wird im 3D-Gesamtgebäude angezeigt und zum Einfärben genutzt.</div>
                </div>
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <button
                onClick={() => openPicker('primary')}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-sky-600 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  {cfg.primaryDatapoint ? (
                    <>
                      <div className="text-sm text-white truncate">{getLabel(cfg.primaryDatapoint)}</div>
                      {getLabel(cfg.primaryDatapoint) !== cfg.primaryDatapoint && (
                        <div className="text-[10px] font-mono text-slate-500 truncate">{cfg.primaryDatapoint}</div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-500">Datenpunkt wählen…</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {cfg.primaryDatapoint && liveValues?.[cfg.primaryDatapoint] !== undefined && (
                    <span className="text-xs font-mono text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded">
                      {fmt(liveValues[cfg.primaryDatapoint], cfg.primaryUnit)}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </button>
              {cfg.primaryDatapoint && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={cfg.primaryLabel}
                    onChange={e => setCfg(p => ({ ...p, primaryLabel: e.target.value }))}
                    placeholder="Anzeigename"
                    className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-600"
                  />
                  <input
                    type="text"
                    value={cfg.primaryUnit}
                    onChange={e => setCfg(p => ({ ...p, primaryUnit: e.target.value }))}
                    placeholder="Einheit (z.B. °C)"
                    className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-600"
                  />
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Raum-Datenpunkte</div>
                  <div className="text-xs text-slate-400 mt-0.5">Auf der Raumseite sichtbar — Reihenfolge und Darstellung frei wählbar.</div>
                </div>
                <button
                  onClick={() => openPicker('add')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Hinzufügen
                </button>
              </div>

              {cfg.visibleDatapoints.length === 0 ? (
                <div className="text-center py-8 rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
                  Noch keine Datenpunkte zugewiesen.
                </div>
              ) : (
                <div className="space-y-2">
                  {cfg.visibleDatapoints.map((dp, idx) => {
                    const Icon = CATEGORY_ICONS[dp.category] ?? Activity;
                    const live = liveValues?.[dp.datapoint];
                    return (
                      <div key={`${dp.datapoint}-${idx}`} className="group rounded-lg border border-slate-800 bg-slate-900/50 p-3 hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-slate-600 flex-shrink-0" />
                          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1e293b' }}>
                            <Icon className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={dp.label}
                              onChange={e => updateVisible(idx, { label: e.target.value })}
                              className="w-full bg-transparent text-sm text-white focus:outline-none"
                              placeholder="Bezeichnung"
                            />
                            <div className="text-[10px] font-mono text-slate-500 truncate">{dp.datapoint}</div>
                          </div>
                          {live !== undefined && (
                            <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                              {fmt(live, dp.unit)}
                            </span>
                          )}
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => moveVisible(idx, -1)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white">
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => moveVisible(idx, 1)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white">
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button onClick={() => removeVisible(idx)} className="p-1 rounded hover:bg-rose-900/40 text-slate-500 hover:text-rose-400">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 pl-11">
                          <select
                            value={dp.category}
                            onChange={e => updateVisible(idx, { category: e.target.value as DatapointCategory })}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-sky-600"
                          >
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                          <select
                            value={dp.displayKind}
                            onChange={e => updateVisible(idx, { displayKind: e.target.value as DatapointDisplayKind })}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-sky-600"
                          >
                            {DISPLAY_KINDS.map(k => (
                              <option key={k.id} value={k.id}>{k.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={dp.unit}
                            onChange={e => updateVisible(idx, { unit: e.target.value })}
                            placeholder="Einheit"
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-200 focus:outline-none focus:border-sky-600"
                          />
                          <button
                            onClick={() => setCfg(prev => ({ ...prev, primaryDatapoint: dp.datapoint, primaryLabel: dp.label, primaryUnit: dp.unit }))}
                            className={`px-2 py-1 rounded border text-[11px] transition-colors ${
                              cfg.primaryDatapoint === dp.datapoint
                                ? 'bg-amber-600/20 border-amber-600 text-amber-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-amber-600 hover:text-amber-400'
                            }`}
                          >
                            <Star className="w-3 h-3 inline mr-1" />
                            {cfg.primaryDatapoint === dp.datapoint ? 'Primär' : 'Als Primär'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Raumbeschreibung</div>
              <textarea
                value={cfg.description}
                onChange={e => setCfg(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Optionale Beschreibung, Anlagen, Besonderheiten…"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-sky-600 resize-none"
              />
            </section>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-900/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Raum löschen
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-md transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Speichern
            </button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Datenpunkt auswählen</div>
                <div className="text-sm font-semibold text-white">
                  {pickerFor === 'primary' ? 'Hauptdatenpunkt' : 'Datenpunkt hinzufügen'}
                </div>
              </div>
              <button onClick={() => setPickerOpen(false)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {pickerPageId !== null && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/60">
                <button
                  onClick={() => { setPickerPageId(null); setSearch(''); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  Zurück
                </button>
                <span className="text-slate-600 text-xs">/</span>
                <span className="text-xs text-slate-200 font-medium truncate">
                  {datapointGroups.find(g => g.pageId === pickerPageId)?.pageName ?? pickerPageId}
                </span>
              </div>
            )}

            <div className="px-4 py-2 border-b border-slate-800">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="flex-1 bg-transparent text-slate-200 text-xs outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {pickerPageId === null ? (
                datapointGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Activity className="w-8 h-8 mb-2 opacity-30" />
                    <span className="text-xs">Keine Datenpunkte gefunden</span>
                  </div>
                ) : (
                  datapointGroups
                    .filter(g => !search || g.pageName.toLowerCase().includes(search.toLowerCase())
                      || g.datapoints.some(d => d.entityId.toLowerCase().includes(search.toLowerCase())
                        || d.label.toLowerCase().includes(search.toLowerCase())))
                    .map(g => (
                      <button
                        key={g.pageId}
                        onClick={() => { setPickerPageId(g.pageId); setSearch(''); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <span className="text-xs text-slate-200 font-medium">{g.pageName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{g.datapoints.length}</span>
                      </button>
                    ))
                )
              ) : (() => {
                const g = datapointGroups.find(x => x.pageId === pickerPageId);
                const q = search.trim().toLowerCase();
                const list = g ? (q
                  ? g.datapoints.filter(d => d.entityId.toLowerCase().includes(q) || d.label.toLowerCase().includes(q) || getLabel(d.entityId).toLowerCase().includes(q))
                  : g.datapoints) : [];
                if (list.length === 0) {
                  return <div className="py-10 text-center text-xs text-slate-500">Keine Treffer</div>;
                }
                return list.map(dp => {
                  const primary = dp.label !== dp.entityId ? dp.label : getLabel(dp.entityId);
                  const showSecondary = primary !== dp.entityId;
                  return (
                    <button
                      key={dp.entityId}
                      onClick={() => pickDatapoint(dp.entityId)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800 text-left border-b border-slate-800/30"
                    >
                      <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-3 h-3 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-200 truncate">{primary}</div>
                        {showSecondary && (
                          <div className="text-[10px] text-slate-500 font-mono truncate">{dp.entityId}</div>
                        )}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
