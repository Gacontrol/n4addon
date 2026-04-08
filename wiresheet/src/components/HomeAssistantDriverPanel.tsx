import React, { useState, useCallback, useEffect } from 'react';
import { Home, Wifi, RefreshCw, ChevronRight, ChevronDown, AlertCircle, Loader2, Lightbulb, Power, Gauge, Activity, Thermometer, Eye, Film, Lock, Radio, Zap, Wind, Droplets, Sun, CheckSquare, Sliders, ToggleRight, ToggleLeft, Trash2, CreditCard as Edit2, Check, X, Eye as EyeIcon, EyeOff, Monitor, LayoutGrid as Layout, Database, Layers, Server, Plus, Save, ArrowLeft, Info, Circle } from 'lucide-react';
import { HaEntity, HaInstance } from '../types/flow';

interface GaControlPage {
  id: string;
  name: string;
  nodes: {
    id: string;
    type: string;
    label: string;
    unit: string;
    value?: unknown;
    description: string;
  }[];
}

interface VisuPage {
  id: string;
  name: string;
  widgetCount: number;
  backgroundColor?: string;
}

interface DriverPointNode {
  id: string;
  type: string;
  label: string;
  unit: string;
  entityId: string;
  dpType: string;
}

interface DriverSheet {
  id: string;
  name: string;
  nodes: DriverPointNode[];
}

interface DriverModbusDatapoint {
  id: string;
  name: string;
  unit: string;
  type: string;
  register?: number;
  description: string;
}

interface DriverModbusDevice {
  id: string;
  name: string;
  type: string;
  datapoints: DriverModbusDatapoint[];
}

interface DriverPointsData {
  sheets: DriverSheet[];
  modbusDevices: DriverModbusDevice[];
  haRemoteInstances: { id: string; name: string; url: string }[];
  error?: string;
}

interface InstanceData {
  entities: HaEntity[];
  gaPages: GaControlPage[];
  visus: VisuPage[];
  driverPoints: DriverPointsData;
  gaError?: string;
  visuError?: string;
  connectionStatus?: 'online' | 'offline' | 'unknown';
}

interface HomeAssistantDriverPanelProps {
  instance: HaInstance;
  liveValues?: Record<string, { state: string; attributes: Record<string, unknown> }>;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<HaInstance>) => void;
  onBack: () => void;
  apiBase: string;
  preloadedGaPages?: { id: string; name: string; nodes: { id: string; type: string; label: string; unit: string; value?: unknown }[] }[];
  preloadedDriverPoints?: { sheets: { id: string; name: string; nodes: { id: string; type: string; label: string; unit: string; entityId: string }[] }[]; modbusDevices: { id: string; name: string; datapoints: { id: string; name: string; unit: string; type: string; register?: number }[] }[] };
}

const WRITABLE_DOMAINS = ['switch', 'light', 'fan', 'cover', 'climate', 'input_boolean', 'input_number', 'input_select', 'automation', 'script', 'scene', 'lock', 'vacuum', 'media_player'];

function getEntityIcon(entityId: string, size = 'w-3.5 h-3.5'): React.ReactNode {
  const domain = entityId.split('.')[0];
  switch (domain) {
    case 'light': return <Lightbulb className={`${size} text-yellow-400`} />;
    case 'switch': case 'input_boolean': return <Power className={`${size} text-blue-400`} />;
    case 'sensor': return <Gauge className={`${size} text-emerald-400`} />;
    case 'binary_sensor': return <Activity className={`${size} text-cyan-400`} />;
    case 'climate': return <Thermometer className={`${size} text-orange-400`} />;
    case 'camera': return <Eye className={`${size} text-slate-400`} />;
    case 'media_player': return <Film className={`${size} text-pink-400`} />;
    case 'lock': return <Lock className={`${size} text-amber-400`} />;
    case 'automation': return <Radio className={`${size} text-violet-400`} />;
    case 'script': return <Zap className={`${size} text-yellow-300`} />;
    case 'fan': return <Wind className={`${size} text-sky-400`} />;
    case 'cover': return <Layers className={`${size} text-slate-400`} />;
    case 'weather': return <Sun className={`${size} text-yellow-400`} />;
    case 'input_number': return <Sliders className={`${size} text-blue-300`} />;
    case 'input_select': return <CheckSquare className={`${size} text-indigo-300`} />;
    case 'humidifier': case 'dehumidifier': return <Droplets className={`${size} text-blue-400`} />;
    default: return <Activity className={`${size} text-slate-400`} />;
  }
}

function getNodeTypeIcon(type: string): React.ReactNode {
  const cls = 'w-3 h-3';
  if (type?.includes('input') || type?.includes('sensor')) return <Gauge className={`${cls} text-emerald-400`} />;
  if (type?.includes('output') || type?.includes('switch')) return <Power className={`${cls} text-blue-400`} />;
  if (type?.includes('setpoint') || type?.includes('temperature')) return <Thermometer className={`${cls} text-orange-400`} />;
  return <Circle className={`${cls} text-slate-500`} />;
}

function getStateColor(state: string): string {
  if (state === 'on' || state === 'true' || state === 'home') return 'text-emerald-400';
  if (state === 'off' || state === 'false' || state === 'away') return 'text-slate-500';
  if (state === 'unavailable' || state === 'unknown') return 'text-slate-600';
  return 'text-cyan-400';
}

const EntityRow: React.FC<{
  entity: HaEntity;
  liveData?: { state: string; attributes: Record<string, unknown> };
}> = ({ entity, liveData }) => {
  const [expanded, setExpanded] = useState(false);
  const friendlyName = entity.attributes.friendly_name as string || entity.entity_id;
  const domain = entity.entity_id.split('.')[0];
  const unit = entity.attributes.unit_of_measurement as string || '';
  const state = liveData?.state ?? entity.state;
  const attrs = liveData?.attributes ?? entity.attributes;
  const isWritable = WRITABLE_DOMAINS.includes(domain);
  const attrEntries = Object.entries(attrs).filter(([k]) => !k.startsWith('_') && k !== 'friendly_name' && k !== 'unit_of_measurement');

  return (
    <div className="rounded border border-slate-700/60 bg-slate-900/50 overflow-hidden">
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-800/60 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {getEntityIcon(entity.entity_id)}
        <span className="text-white text-xs flex-1 min-w-0 truncate" title={friendlyName}>{friendlyName}</span>
        <span className="text-slate-600 text-[10px] shrink-0 mr-1">{domain}</span>
        <span className={`font-mono text-xs shrink-0 min-w-[50px] text-right ${getStateColor(state)}`}>
          {state}{unit && <span className="text-slate-600 ml-0.5 text-[10px]">{unit}</span>}
        </span>
        {isWritable && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 ml-1" title="Steuerbar" />}
        {attrEntries.length > 0 && (
          expanded ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
        )}
      </div>
      {expanded && attrEntries.length > 0 && (
        <div className="px-3 pb-2 pt-1 bg-slate-900/80 border-t border-slate-700/40">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {attrEntries.slice(0, 12).map(([key, val]) => (
              <div key={key} className="flex gap-1 items-start">
                <span className="text-slate-500 text-[10px] shrink-0 pt-px">{key}:</span>
                <span className="text-slate-300 text-[10px] truncate">{String(val)}</span>
              </div>
            ))}
            {attrEntries.length > 12 && (
              <span className="text-slate-600 text-[10px] col-span-2">+{attrEntries.length - 12} weitere Attribute</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DomainGroup: React.FC<{
  domain: string;
  entities: HaEntity[];
  liveValues?: Record<string, { state: string; attributes: Record<string, unknown> }>;
  instanceId: string;
}> = ({ domain, entities, liveValues, instanceId }) => {
  const [expanded, setExpanded] = useState(false);
  const isWritable = WRITABLE_DOMAINS.includes(domain);

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-800 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        {getEntityIcon(domain + '.x')}
        <span className="text-white text-sm font-medium flex-1">{domain}</span>
        <span className="text-slate-500 text-xs">{entities.length}</span>
        {isWritable && <span className="text-[10px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">steuerbar</span>}
      </button>
      {expanded && (
        <div className="p-2 space-y-1 bg-slate-900/30">
          {entities.map(e => (
            <EntityRow
              key={e.entity_id}
              entity={e}
              liveData={liveValues?.[`${instanceId}:${e._original_entity_id || e.entity_id.replace(`${instanceId}:`, '')}`] || liveValues?.[e.entity_id]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const GaControlSection: React.FC<{
  pages: GaControlPage[];
  error?: string;
  loading: boolean;
  onRefresh: () => void;
}> = ({ pages, error, loading, onRefresh }) => {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  const togglePage = (id: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">GA-Control</span>
          {pages.length > 0 && <span className="text-xs text-slate-500">{pages.length} Logikseiten</span>}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          title="GA-Control Daten neu laden"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-900/20 border border-amber-700/40 rounded-lg mb-3">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300">GA-Control nicht erreichbar</p>
            <p className="text-[10px] text-amber-500/70 mt-0.5">{error}</p>
            <p className="text-[10px] text-slate-500 mt-1">Das Wiresheet-Addon muss auf dem Zielgeraet installiert und aktiv sein.</p>
          </div>
        </div>
      )}

      {loading && pages.length === 0 && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-xs text-slate-400">Lade GA-Control Daten...</span>
        </div>
      )}

      {!loading && !error && pages.length === 0 && (
        <div className="text-center py-4">
          <Database className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Keine Logikseiten gefunden</p>
          <button
            onClick={onRefresh}
            className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {pages.length > 0 && (
        <div className="space-y-1.5">
          {pages.map(page => {
            const isExp = expandedPages.has(page.id);
            const dpCount = page.nodes.length;
            return (
              <div key={page.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => togglePage(page.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/70 hover:bg-slate-800 transition-colors text-left"
                >
                  {isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-white text-sm font-medium flex-1 truncate">{page.name}</span>
                  <span className="text-slate-500 text-xs shrink-0">{dpCount} Datenpunkte</span>
                </button>
                {isExp && (
                  <div className="p-2 space-y-1 bg-slate-900/30">
                    {dpCount === 0 && (
                      <p className="text-xs text-slate-600 text-center py-2">Keine Datenpunkte auf dieser Seite</p>
                    )}
                    {page.nodes.map(node => (
                      <div key={node.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900/60 border border-slate-700/40 hover:bg-slate-800/60 transition-colors">
                        {getNodeTypeIcon(node.type)}
                        <span className="text-white text-xs flex-1 min-w-0 truncate" title={node.label}>{node.label}</span>
                        {node.unit && <span className="text-slate-600 text-[10px] shrink-0">{node.unit}</span>}
                        {node.value !== undefined && (
                          <span className="font-mono text-xs text-cyan-400 shrink-0 min-w-[40px] text-right">
                            {String(node.value)}
                          </span>
                        )}
                        <span className="text-slate-700 text-[9px] shrink-0 font-mono">{node.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const VisusSection: React.FC<{
  visus: VisuPage[];
  error?: string;
  loading: boolean;
  onRefresh: () => void;
}> = ({ visus, error, loading, onRefresh }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">Visus</span>
          {visus.length > 0 && <span className="text-xs text-slate-500">{visus.length} Seiten</span>}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          title="Visus neu laden"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-sky-900/20 border border-sky-700/40 rounded-lg mb-3">
          <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-sky-300">Visus nicht erreichbar</p>
            <p className="text-[10px] text-sky-500/70 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && visus.length === 0 && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
          <span className="text-xs text-slate-400">Lade Visus...</span>
        </div>
      )}

      {!loading && !error && visus.length === 0 && (
        <div className="text-center py-4">
          <Monitor className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Keine Visus gefunden</p>
          <button
            onClick={onRefresh}
            className="mt-2 text-xs text-sky-400 hover:text-sky-300 underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {visus.length > 0 && (
        <div className="space-y-1.5">
          {visus.map(visu => (
            <div
              key={visu.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-700/50 bg-slate-800/60 hover:bg-slate-800 transition-colors"
            >
              <div
                className="w-6 h-6 rounded shrink-0 border border-slate-600/50 flex items-center justify-center"
                style={{ backgroundColor: visu.backgroundColor || '#0f172a' }}
              >
                <Layout className="w-3 h-3 text-sky-400" />
              </div>
              <span className="text-white text-sm flex-1 min-w-0 truncate">{visu.name}</span>
              {visu.widgetCount > 0 && (
                <span className="text-slate-500 text-xs shrink-0">{visu.widgetCount} Widgets</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DriverPointsSection: React.FC<{
  data: DriverPointsData;
  loading: boolean;
  onRefresh: () => void;
}> = ({ data, loading, onRefresh }) => {
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set());
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());

  const toggleSheet = (id: string) => setExpandedSheets(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const toggleDevice = (id: string) => setExpandedDevices(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const totalNodes = data.sheets.reduce((s, sh) => s + sh.nodes.length, 0);
  const totalDps = data.modbusDevices.reduce((s, d) => s + d.datapoints.length, 0);

  function getDriverNodeIcon(type: string) {
    if (type.includes('ha-input')) return <Activity className="w-3 h-3 text-cyan-400" />;
    if (type.includes('ha-output')) return <Zap className="w-3 h-3 text-amber-400" />;
    if (type.includes('modbus')) return <Server className="w-3 h-3 text-emerald-400" />;
    return <Circle className="w-3 h-3 text-slate-500" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Treiberpunkte</span>
          {(totalNodes + totalDps) > 0 && (
            <span className="text-xs text-slate-500">{totalNodes + totalDps} Punkte</span>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          title="Treiberpunkte neu laden"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {data.error && (
        <div className="flex items-start gap-2 p-2.5 bg-slate-800/60 border border-slate-700/40 rounded-lg mb-3">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400">Treiberpunkte nicht verfuegbar</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{data.error}</p>
          </div>
        </div>
      )}

      {loading && data.sheets.length === 0 && data.modbusDevices.length === 0 && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span className="text-xs text-slate-400">Lade Treiberpunkte...</span>
        </div>
      )}

      {!loading && !data.error && data.sheets.length === 0 && data.modbusDevices.length === 0 && (
        <div className="text-center py-6">
          <Server className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Keine Treiberpunkte gefunden</p>
          <button onClick={onRefresh} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 underline">
            Erneut versuchen
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {data.sheets.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300">Logikseiten ({data.sheets.length})</span>
            </div>
            {data.sheets.map(sheet => {
              const isExp = expandedSheets.has(sheet.id);
              return (
                <div key={sheet.id} className="border border-slate-700/50 rounded-lg overflow-hidden mb-1">
                  <button
                    onClick={() => toggleSheet(sheet.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/70 hover:bg-slate-800 transition-colors text-left"
                  >
                    {isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-white text-sm font-medium flex-1 truncate">{sheet.name}</span>
                    <span className="text-slate-500 text-xs">{sheet.nodes.length} Punkte</span>
                  </button>
                  {isExp && (
                    <div className="p-2 space-y-1 bg-slate-900/30">
                      {sheet.nodes.map(node => (
                        <div key={node.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900/60 border border-slate-700/40">
                          {getDriverNodeIcon(node.type)}
                          <span className="text-white text-xs flex-1 truncate" title={node.label}>{node.label}</span>
                          {node.unit && <span className="text-slate-600 text-[10px] shrink-0">{node.unit}</span>}
                          {node.entityId && <span className="text-cyan-700 text-[9px] font-mono truncate max-w-[120px]">{node.entityId}</span>}
                          <span className="text-slate-700 text-[9px] font-mono">{node.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {data.modbusDevices.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-300">Modbus-Geraete ({data.modbusDevices.length})</span>
            </div>
            {data.modbusDevices.map(device => {
              const isExp = expandedDevices.has(device.id);
              return (
                <div key={device.id} className="border border-slate-700/50 rounded-lg overflow-hidden mb-1">
                  <button
                    onClick={() => toggleDevice(device.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/70 hover:bg-slate-800 transition-colors text-left"
                  >
                    {isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-white text-sm font-medium flex-1 truncate">{device.name}</span>
                    <span className="text-slate-500 text-xs">{device.datapoints.length} Datenpunkte</span>
                  </button>
                  {isExp && (
                    <div className="p-2 space-y-1 bg-slate-900/30">
                      {device.datapoints.map(dp => (
                        <div key={dp.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900/60 border border-slate-700/40">
                          <Gauge className="w-3 h-3 text-emerald-400" />
                          <span className="text-white text-xs flex-1 truncate" title={dp.description || dp.name}>{dp.name}</span>
                          {dp.unit && <span className="text-slate-600 text-[10px] shrink-0">{dp.unit}</span>}
                          {dp.register !== undefined && <span className="text-slate-600 text-[9px] font-mono">Reg {dp.register}</span>}
                          <span className="text-slate-700 text-[9px] font-mono">{dp.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {data.haRemoteInstances.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-1 mb-1.5 mt-2">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300">Verbundene HA-Instanzen ({data.haRemoteInstances.length})</span>
            </div>
            {data.haRemoteInstances.map(inst => (
              <div key={inst.id} className="flex items-center gap-2 px-3 py-2 rounded border border-slate-700/40 bg-slate-800/50 mb-1">
                <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-white text-xs flex-1 truncate">{inst.name}</span>
                <span className="text-slate-500 text-[10px] font-mono truncate max-w-[140px]">{inst.url}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const EntitiesSection: React.FC<{
  entities: HaEntity[];
  liveValues?: Record<string, { state: string; attributes: Record<string, unknown> }>;
  instanceId: string;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}> = ({ entities, liveValues, instanceId, loading, error, onRefresh, searchQuery, onSearchChange }) => {
  const filtered = entities.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.entity_id.toLowerCase().includes(q) ||
      ((e.attributes.friendly_name as string) || '').toLowerCase().includes(q);
  });

  const byDomain = filtered.reduce<Record<string, HaEntity[]>>((acc, e) => {
    const domain = (e._original_entity_id || e.entity_id).split('.')[0];
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(e);
    return acc;
  }, {});

  const sortedDomains = Object.keys(byDomain).sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Entities</span>
          {entities.length > 0 && <span className="text-xs text-slate-500">{entities.length} gesamt</span>}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          title="Entities aktualisieren"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-900/20 border border-red-700/40 rounded-lg mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      <div className="mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Entities durchsuchen..."
          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {loading && entities.length === 0 && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span className="text-sm text-slate-400">Lade Entities...</span>
        </div>
      )}

      {!loading && entities.length === 0 && !error && (
        <div className="text-center py-6">
          <Home className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Keine Entities geladen</p>
          <button
            onClick={onRefresh}
            className="mt-2 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-medium"
          >
            Entities laden
          </button>
        </div>
      )}

      {sortedDomains.length > 0 && (
        <div className="space-y-1.5">
          {sortedDomains.map(domain => (
            <DomainGroup
              key={domain}
              domain={domain}
              entities={byDomain[domain]}
              liveValues={liveValues}
              instanceId={instanceId}
            />
          ))}
          {filtered.length < entities.length && (
            <p className="text-xs text-slate-600 text-center pt-1">
              {filtered.length} von {entities.length} Entities angezeigt
            </p>
          )}
        </div>
      )}
    </div>
  );
};

type TabType = 'entities' | 'ga-control' | 'driver-points' | 'visus';

export const HomeAssistantDriverPanel: React.FC<HomeAssistantDriverPanelProps> = ({
  instance,
  liveValues,
  onDelete,
  onToggle,
  onUpdate,
  onBack,
  apiBase,
  preloadedGaPages,
  preloadedDriverPoints,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('entities');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: instance.name, url: instance.url, token: instance.token });
  const [showToken, setShowToken] = useState(false);
  const emptyDriverPoints: DriverPointsData = { sheets: [], modbusDevices: [], haRemoteInstances: [] };

  const hasPreloadedGa = !!(preloadedGaPages && preloadedGaPages.length >= 0);
  const hasPreloadedDp = !!(preloadedDriverPoints && (preloadedDriverPoints.sheets || preloadedDriverPoints.modbusDevices));

  const [data, setData] = useState<InstanceData>(() => ({
    entities: [],
    gaPages: hasPreloadedGa ? (preloadedGaPages as InstanceData['gaPages']) : [],
    visus: [],
    driverPoints: hasPreloadedDp
      ? { sheets: preloadedDriverPoints!.sheets || [], modbusDevices: preloadedDriverPoints!.modbusDevices || [], haRemoteInstances: [] }
      : emptyDriverPoints
  }));
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [loadingGa, setLoadingGa] = useState(false);
  const [loadingVisus, setLoadingVisus] = useState(false);
  const [loadingDriverPoints, setLoadingDriverPoints] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const [gaLoaded, setGaLoaded] = useState(hasPreloadedGa);
  const [visuLoaded, setVisuLoaded] = useState(false);
  const [driverPointsLoaded, setDriverPointsLoaded] = useState(hasPreloadedDp);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');

  useEffect(() => {
    if (preloadedGaPages) {
      setData(prev => ({ ...prev, gaPages: preloadedGaPages as InstanceData['gaPages'] }));
      setGaLoaded(true);
    }
  }, [preloadedGaPages]);

  useEffect(() => {
    if (preloadedDriverPoints) {
      setData(prev => ({
        ...prev,
        driverPoints: {
          sheets: preloadedDriverPoints.sheets || [],
          modbusDevices: preloadedDriverPoints.modbusDevices || [],
          haRemoteInstances: []
        }
      }));
      setDriverPointsLoaded(true);
    }
  }, [preloadedDriverPoints]);

  const loadEntities = useCallback(async () => {
    setLoadingEntities(true);
    setEntityError(null);
    try {
      const resp = await fetch(`${apiBase}/ha/instances/${instance.id}/states`);
      const d = await resp.json();
      if (d.entities) {
        setData(prev => ({ ...prev, entities: d.entities }));
        setEntitiesLoaded(true);
      } else {
        setEntityError(d.error || 'Unbekannter Fehler');
      }
    } catch (e) {
      setEntityError(e instanceof Error ? e.message : 'Netzwerkfehler');
    } finally {
      setLoadingEntities(false);
    }
  }, [instance.id, apiBase]);

  const loadGaControl = useCallback(async () => {
    setLoadingGa(true);
    try {
      const resp = await fetch(`${apiBase}/ha/instances/${instance.id}/ga-control`);
      const d = await resp.json();
      setData(prev => ({ ...prev, gaPages: d.pages || [], gaError: d.error }));
      setGaLoaded(true);
    } catch (e) {
      setData(prev => ({ ...prev, gaPages: [], gaError: e instanceof Error ? e.message : 'Fehler' }));
    } finally {
      setLoadingGa(false);
    }
  }, [instance.id, apiBase]);

  const loadVisus = useCallback(async () => {
    setLoadingVisus(true);
    try {
      const resp = await fetch(`${apiBase}/ha/instances/${instance.id}/visus`);
      const d = await resp.json();
      setData(prev => ({ ...prev, visus: d.visus || [], visuError: d.error }));
      setVisuLoaded(true);
    } catch (e) {
      setData(prev => ({ ...prev, visus: [], visuError: e instanceof Error ? e.message : 'Fehler' }));
    } finally {
      setLoadingVisus(false);
    }
  }, [instance.id, apiBase]);

  const loadDriverPoints = useCallback(async () => {
    setLoadingDriverPoints(true);
    try {
      const resp = await fetch(`${apiBase}/ha/instances/${instance.id}/driver-points`);
      const d = await resp.json();
      setData(prev => ({
        ...prev,
        driverPoints: {
          sheets: d.sheets || [],
          modbusDevices: d.modbusDevices || [],
          haRemoteInstances: d.haRemoteInstances || [],
          error: d.error
        }
      }));
      setDriverPointsLoaded(true);
    } catch (e) {
      setData(prev => ({ ...prev, driverPoints: { sheets: [], modbusDevices: [], haRemoteInstances: [], error: e instanceof Error ? e.message : 'Fehler' } }));
    } finally {
      setLoadingDriverPoints(false);
    }
  }, [instance.id, apiBase]);

  useEffect(() => {
    if (activeTab === 'entities' && !entitiesLoaded) loadEntities();
    if (activeTab === 'ga-control' && !gaLoaded) loadGaControl();
    if (activeTab === 'visus' && !visuLoaded) loadVisus();
    if (activeTab === 'driver-points' && !driverPointsLoaded) loadDriverPoints();
  }, [activeTab, entitiesLoaded, gaLoaded, visuLoaded, driverPointsLoaded, loadEntities, loadGaControl, loadVisus, loadDriverPoints]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(`${apiBase}/ha/instances/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: instance.url, token: instance.token })
      });
      const d = await resp.json();
      setTestResult(d);
    } catch {
      setTestResult({ ok: false, msg: 'Verbindungsfehler' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editForm.name || !editForm.url || !editForm.token) return;
    onUpdate(instance.id, { name: editForm.name, url: editForm.url.replace(/\/$/, ''), token: editForm.token });
    setEditing(false);
    setEntitiesLoaded(false);
    setGaLoaded(false);
    setVisuLoaded(false);
    setDriverPointsLoaded(false);
    setData({ entities: [], gaPages: [], visus: [], driverPoints: { sheets: [], modbusDevices: [], haRemoteInstances: [] } });
  };

  const driverPointsTotal = data.driverPoints.sheets.reduce((s, sh) => s + sh.nodes.length, 0) +
    data.driverPoints.modbusDevices.reduce((s, d) => s + d.datapoints.length, 0);

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'entities', label: 'Entities', icon: <Home className="w-3.5 h-3.5" />, count: data.entities.length || undefined },
    { id: 'ga-control', label: 'GA-Control', icon: <Database className="w-3.5 h-3.5" />, count: data.gaPages.length || undefined },
    { id: 'driver-points', label: 'Treiberpunkte', icon: <Server className="w-3.5 h-3.5" />, count: driverPointsTotal || undefined },
    { id: 'visus', label: 'Visus', icon: <Monitor className="w-3.5 h-3.5" />, count: data.visus.length || undefined },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Zurueck"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative shrink-0">
              <Wifi className="w-5 h-5 text-cyan-400" />
              <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-800 ${instance.enabled ? 'bg-green-500' : 'bg-slate-500'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white truncate">{instance.name}</h2>
              </div>
              <p className="text-xs text-slate-500 font-mono truncate">{instance.url}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {testResult && (
              <span className={`text-xs flex items-center gap-1 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.ok ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {testResult.msg}
              </span>
            )}
            <button
              onClick={handleTest}
              disabled={testing}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition-colors disabled:opacity-40"
              title="Verbindung testen"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setEditing(true); setEditForm({ name: instance.name, url: instance.url, token: instance.token }); }}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Bearbeiten"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggle(instance.id)}
              className={`p-1.5 rounded transition-colors ${instance.enabled ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:bg-slate-700'}`}
              title={instance.enabled ? 'Deaktivieren' : 'Aktivieren'}
            >
              {instance.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onDelete(instance.id)}
              className="p-1.5 rounded hover:bg-red-900/40 text-slate-400 hover:text-red-400 transition-colors"
              title="Instanz loeschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {editing && (
          <div className="px-4 pb-4 border-t border-slate-700 pt-3">
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">URL</label>
                  <input
                    type="text"
                    value={editForm.url}
                    onChange={e => setEditForm(p => ({ ...p, url: e.target.value }))}
                    placeholder="http://192.168.1.x:8123"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Long-Lived Access Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={editForm.token}
                    onChange={e => setEditForm(p => ({ ...p, token: e.target.value }))}
                    className="w-full px-2.5 py-1.5 pr-9 bg-slate-900 border border-slate-600 rounded text-sm text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editForm.name || !editForm.url || !editForm.token}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-medium disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex border-t border-slate-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === tab.id ? 'bg-cyan-900/60 text-cyan-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'entities' && (
          <EntitiesSection
            entities={data.entities}
            liveValues={liveValues}
            instanceId={instance.id}
            loading={loadingEntities}
            error={entityError}
            onRefresh={loadEntities}
            searchQuery={entitySearch}
            onSearchChange={setEntitySearch}
          />
        )}
        {activeTab === 'ga-control' && (
          <GaControlSection
            pages={data.gaPages}
            error={data.gaError}
            loading={loadingGa}
            onRefresh={loadGaControl}
          />
        )}
        {activeTab === 'driver-points' && (
          <DriverPointsSection
            data={data.driverPoints}
            loading={loadingDriverPoints}
            onRefresh={loadDriverPoints}
          />
        )}
        {activeTab === 'visus' && (
          <VisusSection
            visus={data.visus}
            error={data.visuError}
            loading={loadingVisus}
            onRefresh={loadVisus}
          />
        )}
      </div>
    </div>
  );
};
