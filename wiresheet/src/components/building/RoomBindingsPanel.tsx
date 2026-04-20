import { useMemo, useState } from 'react';
import {
  Thermometer, Droplets, Wind, Bell, Activity, Fan, Lightbulb,
  Gauge, Zap, Flame, Snowflake, X, Search, Sparkles, Save,
  ChevronsUpDown, ChevronDown, ChevronUp, Trash2, Users, Blinds, Plug
} from 'lucide-react';
import type { Building, Floor, Room, Widget3D, Widget3DType } from '../../types/building';

export interface DatapointOption {
  entityId: string;
  label: string;
}

export interface DatapointGroup {
  pageId: string;
  pageName: string;
  datapoints: DatapointOption[];
}

function displayLabel(entityId: string, labels?: Record<string, string>): string {
  if (!entityId) return '';
  if (labels && labels[entityId]) return labels[entityId];
  return entityId;
}

export interface HvacRole {
  key: string;
  label: string;
  widgetType: Widget3DType;
  unit: string;
  icon: React.ReactNode;
  accent: string;
  min?: number;
  max?: number;
  hint?: string;
  category: 'climate' | 'air' | 'actuator' | 'lighting' | 'safety' | 'energy';
}

export const HVAC_ROLES: HvacRole[] = [
  { key: 'temperature',   label: 'Raumtemperatur',    widgetType: 'temperature', unit: '°C', icon: <Thermometer className="w-4 h-4" />, accent: '#ef4444', min: 15, max: 30, category: 'climate', hint: 'Ist-Wert vom Raumsensor' },
  { key: 'setpoint',      label: 'Sollwert',          widgetType: 'setpoint',    unit: '°C', icon: <Gauge className="w-4 h-4" />,      accent: '#f97316', min: 15, max: 28, category: 'climate', hint: 'Nutzer-Sollwert / Schema' },
  { key: 'humidity',      label: 'Feuchte',           widgetType: 'humidity',    unit: '%',  icon: <Droplets className="w-4 h-4" />,    accent: '#06b6d4', min: 20, max: 80, category: 'climate' },
  { key: 'co2',           label: 'CO\u2082',          widgetType: 'co2',         unit: 'ppm',icon: <Wind className="w-4 h-4" />,        accent: '#84cc16', min: 400, max: 2000, category: 'air' },
  { key: 'voc',           label: 'Luftqualit\u00e4t', widgetType: 'co2',         unit: 'IAQ',icon: <Sparkles className="w-4 h-4" />,    accent: '#10b981', category: 'air' },
  { key: 'presence',      label: 'Pr\u00e4senz',      widgetType: 'presence',    unit: '',   icon: <Users className="w-4 h-4" />,       accent: '#0ea5e9', category: 'air' },
  { key: 'supplyDamper',  label: 'Zuluft-Klappe',     widgetType: 'damper',      unit: '%',  icon: <ChevronsUpDown className="w-4 h-4" />, accent: '#3b82f6', min: 0, max: 100, category: 'actuator' },
  { key: 'extractDamper', label: 'Abluft-Klappe',     widgetType: 'damper',      unit: '%',  icon: <ChevronsUpDown className="w-4 h-4" />, accent: '#64748b', min: 0, max: 100, category: 'actuator' },
  { key: 'fireDamper',    label: 'Brandschutzklappe', widgetType: 'fire-damper', unit: '',   icon: <Flame className="w-4 h-4" />,       accent: '#f43f5e', category: 'safety' },
  { key: 'shutoff',       label: 'Absperrklappe',     widgetType: 'shutoff-damper', unit: '',icon: <ChevronsUpDown className="w-4 h-4" />, accent: '#0ea5e9', category: 'safety' },
  { key: 'valveHeat',     label: 'Heizventil',        widgetType: 'valve',       unit: '%',  icon: <Flame className="w-4 h-4" />,       accent: '#dc2626', min: 0, max: 100, category: 'actuator' },
  { key: 'valveCool',     label: 'K\u00fchlventil',   widgetType: 'valve',       unit: '%',  icon: <Snowflake className="w-4 h-4" />,   accent: '#0284c7', min: 0, max: 100, category: 'actuator' },
  { key: 'pump',          label: 'Pumpe',             widgetType: 'pump',        unit: '',   icon: <Plug className="w-4 h-4" />,        accent: '#2563eb', category: 'actuator' },
  { key: 'fan',           label: 'Ventilator',        widgetType: 'fan',         unit: '%',  icon: <Fan className="w-4 h-4" />,         accent: '#4f46e5', min: 0, max: 100, category: 'actuator' },
  { key: 'light',         label: 'Licht',             widgetType: 'light',       unit: '%',  icon: <Lightbulb className="w-4 h-4" />,   accent: '#facc15', category: 'lighting' },
  { key: 'blinds',        label: 'Jalousie',          widgetType: 'blinds',      unit: '%',  icon: <Blinds className="w-4 h-4" />,      accent: '#7c3aed', min: 0, max: 100, category: 'lighting' },
  { key: 'alarm',         label: 'Alarm',             widgetType: 'alarm',       unit: '',   icon: <Bell className="w-4 h-4" />,        accent: '#ef4444', category: 'safety' },
  { key: 'energy',        label: 'Energie',           widgetType: 'energy',      unit: 'kWh',icon: <Zap className="w-4 h-4" />,         accent: '#eab308', category: 'energy' },
  { key: 'roomcolor',     label: 'Raum-Einf\u00e4rbung', widgetType: 'roomcolor', unit: '',  icon: <Activity className="w-4 h-4" />,    accent: '#22c55e', category: 'climate', hint: 'Tint des ganzen Raums' },
];

const CATEGORY_LABELS: Record<HvacRole['category'], string> = {
  climate:  'Klima',
  air:      'Luft',
  actuator: 'Aktoren',
  lighting: 'Licht / Beschattung',
  safety:   'Sicherheit',
  energy:   'Energie',
};

const PRESETS: { id: string; label: string; description: string; roles: string[] }[] = [
  { id: 'office',     label: 'B\u00fcroraum',      description: 'Temp, Sollwert, CO\u2082, Pr\u00e4senz, Klappen, Licht, Jalousie',
    roles: ['temperature', 'setpoint', 'co2', 'presence', 'supplyDamper', 'extractDamper', 'light', 'blinds'] },
  { id: 'meeting',    label: 'Besprechungsraum',   description: 'Volles Klimapaket inkl. Feuchte + VOC',
    roles: ['temperature', 'setpoint', 'humidity', 'co2', 'voc', 'presence', 'supplyDamper', 'extractDamper', 'valveHeat', 'valveCool', 'light', 'blinds'] },
  { id: 'hotel',      label: 'Hotelzimmer',        description: 'Einfaches Zimmer mit FCU',
    roles: ['temperature', 'setpoint', 'presence', 'valveHeat', 'valveCool', 'fan', 'light'] },
  { id: 'server',     label: 'Serverraum',         description: 'Strenge Klima- und Sicherheits\u00fcberwachung',
    roles: ['temperature', 'humidity', 'valveCool', 'fan', 'alarm', 'fireDamper'] },
  { id: 'corridor',   label: 'Flur',               description: 'Minimal mit Licht + Pr\u00e4senz',
    roles: ['presence', 'light'] },
  { id: 'plant',      label: 'Technikraum',        description: 'Pumpen, Ventile, Alarme',
    roles: ['temperature', 'pump', 'valveHeat', 'valveCool', 'alarm', 'energy'] },
];

function getRoomCenter(room: Room): { x: number; y: number } {
  return { x: room.x + room.width / 2, y: room.y + room.depth / 2 };
}

function findExistingForRole(widgets: Widget3D[], room: Room, role: HvacRole): Widget3D | undefined {
  return widgets.find(w =>
    (w.roomIds ?? []).includes(room.id) &&
    w.type === role.widgetType &&
    (w.label === role.label || w.label?.toLowerCase().includes(role.label.toLowerCase().slice(0, 6)))
  );
}

interface Props {
  building: Building;
  floor: Floor;
  room: Room;
  datapointGroups: DatapointGroup[];
  datapointLabels?: Record<string, string>;
  addWidget3D: (buildingId: string, widget: Omit<Widget3D, 'id'>) => string;
  updateWidget3D: (buildingId: string, widgetId: string, changes: Partial<Widget3D>) => void;
  deleteWidget3D: (buildingId: string, widgetId: string) => void;
  onClose: () => void;
}

interface DraftBinding {
  enabled: boolean;
  datapoint: string;
  unit: string;
  min?: number;
  max?: number;
  alarmDatapoint?: string;
  existingWidgetId?: string;
}

export function RoomBindingsPanel({
  building,
  floor,
  room,
  datapointGroups,
  datapointLabels,
  addWidget3D,
  updateWidget3D,
  deleteWidget3D,
  onClose,
}: Props) {
  const widgets = building.widgets3d ?? [];

  const initialDrafts = useMemo(() => {
    const drafts: Record<string, DraftBinding> = {};
    for (const role of HVAC_ROLES) {
      const existing = findExistingForRole(widgets, room, role);
      drafts[role.key] = {
        enabled: !!existing,
        datapoint: existing?.datapoint ?? '',
        unit: existing?.unit ?? role.unit,
        min: existing?.minValue ?? role.min,
        max: existing?.maxValue ?? role.max,
        alarmDatapoint: existing?.alarmDatapoint ?? '',
        existingWidgetId: existing?.id,
      };
    }
    return drafts;
  }, [widgets, room]);

  const [drafts, setDrafts] = useState<Record<string, DraftBinding>>(initialDrafts);
  const [dpSearch, setDpSearch] = useState('');
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [pickerPageId, setPickerPageId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    climate: true, air: true, actuator: true, lighting: true, safety: true, energy: true,
  });

  const rolesByCat = useMemo(() => {
    const map: Record<string, HvacRole[]> = {};
    for (const r of HVAC_ROLES) {
      (map[r.category] ||= []).push(r);
    }
    return map;
  }, []);

  const toggleRole = (key: string) => {
    setDrafts(d => ({ ...d, [key]: { ...d[key], enabled: !d[key].enabled } }));
  };

  const updateDraft = (key: string, changes: Partial<DraftBinding>) => {
    setDrafts(d => ({ ...d, [key]: { ...d[key], ...changes } }));
  };

  const applyPreset = (presetId: string) => {
    const p = PRESETS.find(x => x.id === presetId);
    if (!p) return;
    setDrafts(d => {
      const next = { ...d };
      for (const role of HVAC_ROLES) {
        next[role.key] = { ...next[role.key], enabled: p.roles.includes(role.key) };
      }
      return next;
    });
  };

  const enabledCount = Object.values(drafts).filter(d => d.enabled).length;

  const handleSave = () => {
    const center = getRoomCenter(room);
    let slot = 0;
    const enabledKeys = HVAC_ROLES.filter(r => drafts[r.key]?.enabled).map(r => r.key);

    for (const role of HVAC_ROLES) {
      const draft = drafts[role.key];
      if (!draft) continue;

      if (!draft.enabled && draft.existingWidgetId) {
        deleteWidget3D(building.id, draft.existingWidgetId);
        continue;
      }

      if (!draft.enabled) continue;

      const idx = enabledKeys.indexOf(role.key);
      const cols = 4;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const offsetX = (col - (cols - 1) / 2) * 0.6;
      const offsetY = (row - 0.5) * 0.6;

      const widgetBase: Omit<Widget3D, 'id'> = {
        type: role.widgetType,
        label: role.label,
        datapoint: draft.datapoint || '',
        unit: draft.unit || role.unit,
        x: center.x + offsetX,
        y: center.y + offsetY,
        z: 1.6,
        floorId: floor.id,
        scale: 1,
        color: role.accent,
        showLabel: true,
        showValue: true,
        roomIds: [room.id],
        minValue: draft.min,
        maxValue: draft.max,
        alarmDatapoint: draft.alarmDatapoint || undefined,
      };

      if (role.widgetType === 'roomcolor') {
        widgetBase.opacity = 0.35;
        widgetBase.z = 0.1;
      }

      if (draft.existingWidgetId) {
        updateWidget3D(building.id, draft.existingWidgetId, widgetBase);
      } else {
        addWidget3D(building.id, widgetBase);
      }
      slot++;
    }

    onClose();
  };

  const clearAll = () => {
    setDrafts(d => {
      const next = { ...d };
      for (const k of Object.keys(next)) next[k] = { ...next[k], enabled: false };
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">HLK-Belegung</div>
              <div className="text-lg font-semibold text-white">{room.name}</div>
              <div className="text-xs text-slate-500">{floor.name} &middot; {building.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {enabledCount} Bindings aktiv
            </span>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">Schnellvorlagen</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className="group px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-sky-600 transition-all"
                title={p.description}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-sky-400 group-hover:text-sky-300" />
                  {p.label}
                </div>
              </button>
            ))}
            <button
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-900 transition-all"
            >
              <div className="flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" />
                Alle aus
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {Object.entries(rolesByCat).map(([cat, roles]) => {
            const enabled = roles.filter(r => drafts[r.key]?.enabled).length;
            const isOpen = expandedCats[cat] !== false;
            return (
              <div key={cat} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <button
                  onClick={() => setExpandedCats(s => ({ ...s, [cat]: !isOpen }))}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900/60 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{CATEGORY_LABELS[cat as HvacRole['category']]}</span>
                    <span className="text-[10px] text-slate-500">({enabled}/{roles.length})</span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {isOpen && (
                  <div className="divide-y divide-slate-800">
                    {roles.map(role => {
                      const draft = drafts[role.key];
                      if (!draft) return null;
                      return (
                        <div key={role.key} className={`px-4 py-3 ${draft.enabled ? 'bg-slate-900/20' : ''}`}>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleRole(role.key)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border transition-all ${
                                draft.enabled
                                  ? 'border-transparent text-white shadow-md'
                                  : 'border-slate-700 text-slate-500 bg-slate-900'
                              }`}
                              style={draft.enabled ? { backgroundColor: role.accent, boxShadow: `0 0 0 3px ${role.accent}22` } : {}}
                            >
                              {role.icon}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${draft.enabled ? 'text-white' : 'text-slate-400'}`}>{role.label}</span>
                                {role.hint && <span className="text-[10px] text-slate-600">{role.hint}</span>}
                              </div>
                              {draft.enabled && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <div className="flex-1 min-w-[220px]">
                                    <button
                                      onClick={() => { setOpenPickerFor(role.key); setPickerPageId(null); setDpSearch(''); }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700 hover:border-sky-600 text-xs transition-colors flex items-center justify-between gap-2"
                                    >
                                      <div className="flex-1 min-w-0 truncate">
                                        {draft.datapoint ? (
                                          <>
                                            <div className="text-slate-200 truncate">{displayLabel(draft.datapoint, datapointLabels)}</div>
                                            {displayLabel(draft.datapoint, datapointLabels) !== draft.datapoint && (
                                              <div className="text-[10px] text-slate-500 font-mono truncate">{draft.datapoint}</div>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-slate-500">Datenpunkt wählen…</span>
                                        )}
                                      </div>
                                      <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                    </button>
                                  </div>

                                  <input
                                    type="text"
                                    value={draft.unit}
                                    onChange={e => updateDraft(role.key, { unit: e.target.value })}
                                    placeholder="Einheit"
                                    className="w-20 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-200"
                                  />
                                  {(role.min !== undefined || role.max !== undefined) && (
                                    <>
                                      <input
                                        type="number"
                                        value={draft.min ?? ''}
                                        onChange={e => updateDraft(role.key, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                                        placeholder="min"
                                        className="w-16 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-200"
                                      />
                                      <input
                                        type="number"
                                        value={draft.max ?? ''}
                                        onChange={e => updateDraft(role.key, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                                        placeholder="max"
                                        className="w-16 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-xs text-slate-200"
                                      />
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center">
                              <button
                                onClick={() => toggleRole(role.key)}
                                className={`relative w-10 h-5 rounded-full transition-colors ${draft.enabled ? '' : 'bg-slate-700'}`}
                                style={draft.enabled ? { backgroundColor: role.accent } : {}}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${draft.enabled ? 'left-5' : 'left-0.5'}`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/60">
          <div className="text-xs text-slate-500">
            {enabledCount === 0 ? 'Keine Bindings ausgew\u00e4hlt' : `${enabledCount} Widget${enabledCount === 1 ? '' : 's'} werden erstellt / aktualisiert`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Übernehmen
            </button>
          </div>
        </div>
      </div>

      {openPickerFor && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setOpenPickerFor(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Datenpunkt wählen</div>
                <div className="text-sm font-semibold text-white">
                  {HVAC_ROLES.find(r => r.key === openPickerFor)?.label || ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { updateDraft(openPickerFor, { datapoint: '' }); setOpenPickerFor(null); }}
                  className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-rose-300 hover:bg-rose-900/30 transition-colors"
                >
                  Zurücksetzen
                </button>
                <button onClick={() => setOpenPickerFor(null)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {pickerPageId !== null && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/60">
                <button
                  onClick={() => { setPickerPageId(null); setDpSearch(''); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" />
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
                <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={dpSearch}
                  onChange={e => setDpSearch(e.target.value)}
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
                    <span className="text-xs">Keine Logik-Datenpunkte gefunden</span>
                  </div>
                ) : (
                  datapointGroups
                    .filter(g => !dpSearch || g.pageName.toLowerCase().includes(dpSearch.toLowerCase())
                      || g.datapoints.some(d => d.entityId.toLowerCase().includes(dpSearch.toLowerCase()) || d.label.toLowerCase().includes(dpSearch.toLowerCase())))
                    .map(group => (
                      <button
                        key={group.pageId}
                        onClick={() => { setPickerPageId(group.pageId); setDpSearch(''); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-800/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <span className="text-xs text-slate-200 font-medium">{group.pageName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{group.datapoints.length}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500 -rotate-90" />
                        </div>
                      </button>
                    ))
                )
              ) : (() => {
                const group = datapointGroups.find(g => g.pageId === pickerPageId);
                const q = dpSearch.trim().toLowerCase();
                const dps = group
                  ? (q ? group.datapoints.filter(d =>
                      d.entityId.toLowerCase().includes(q) ||
                      d.label.toLowerCase().includes(q) ||
                      displayLabel(d.entityId, datapointLabels).toLowerCase().includes(q)
                    ) : group.datapoints)
                  : [];
                if (dps.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <Search className="w-8 h-8 mb-2 opacity-30" />
                      <span className="text-xs">Keine Treffer</span>
                    </div>
                  );
                }
                return dps.map(dp => {
                  const human = displayLabel(dp.entityId, datapointLabels);
                  const primary = dp.label && dp.label !== dp.entityId ? dp.label : human;
                  const showSecondary = primary !== dp.entityId;
                  return (
                    <button
                      key={dp.entityId}
                      onClick={() => { updateDraft(openPickerFor, { datapoint: dp.entityId }); setOpenPickerFor(null); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800 transition-colors text-left border-b border-slate-800/30"
                    >
                      <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-3 h-3 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-200 truncate">{primary}</div>
                        {showSecondary && (
                          <div className="text-[10px] text-slate-500 truncate font-mono">{dp.entityId}</div>
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
