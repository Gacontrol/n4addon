import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search, RefreshCw, Check, Layers, Cpu, Tag, Database, Server, Gauge } from 'lucide-react';

interface HAEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

interface Integration {
  id: string;
  label: string;
  devices: Device[];
}

interface Device {
  id: string;
  label: string;
  entities: HAEntity[];
}

interface GaNode {
  id: string;
  type: string;
  label: string;
  unit: string;
  value?: unknown;
}

interface GaPage {
  id: string;
  name: string;
  nodes: GaNode[];
}

interface DriverNode {
  id: string;
  type: string;
  label: string;
  unit: string;
  entityId: string;
}

interface DriverSheet {
  id: string;
  name: string;
  nodes: DriverNode[];
}

interface DriverModbusDatapoint {
  id: string;
  name: string;
  unit: string;
  type: string;
  register?: number;
}

interface DriverModbusDevice {
  id: string;
  name: string;
  datapoints: DriverModbusDatapoint[];
}

interface InstanceDriverPoints {
  sheets: DriverSheet[];
  modbusDevices: DriverModbusDevice[];
}

interface InstanceInfo {
  id: string;
  name: string;
}

interface EntityBrowserProps {
  haEntities: HAEntity[];
  haLoading: boolean;
  haError?: string | null;
  selectedEntityId?: string;
  onSelect: (entity: HAEntity) => void;
  onReload: () => void;
  instances?: InstanceInfo[];
  instanceGaPages?: Record<string, GaPage[]>;
  instanceDriverPoints?: Record<string, InstanceDriverPoints>;
}

function buildHierarchy(entities: HAEntity[]): Integration[] {
  const domainMap = new Map<string, Map<string, HAEntity[]>>();

  const availableEntities = entities.filter(e =>
    e.state !== 'unavailable' && e.state !== 'unknown'
  );

  for (const entity of availableEntities) {
    const domain = entity.entity_id.split('.')[0];

    const deviceId = entity.attributes._device_id as string | null;
    const deviceName = entity.attributes._device_name as string | null;

    let deviceKey: string;
    let deviceLabel: string;

    if (deviceId && deviceName) {
      deviceKey = deviceId;
      deviceLabel = deviceName;
    } else {
      deviceKey = '_no_device';
      deviceLabel = 'Ohne Geraet';
    }

    if (!domainMap.has(domain)) {
      domainMap.set(domain, new Map());
    }
    const deviceMap = domainMap.get(domain)!;
    if (!deviceMap.has(deviceKey)) {
      deviceMap.set(deviceKey, []);
    }
    deviceMap.get(deviceKey)!.push(entity);
  }

  const integrations: Integration[] = [];
  domainMap.forEach((deviceMap, domainId) => {
    const devices: Device[] = [];
    deviceMap.forEach((ents, deviceId) => {
      const firstWithName = ents.find(e => e.attributes._device_name);
      const label = firstWithName
        ? String(firstWithName.attributes._device_name)
        : (deviceId === '_no_device' ? 'Ohne Geraet' : deviceId);
      devices.push({ id: deviceId, label, entities: ents });
    });
    devices.sort((a, b) => {
      if (a.id === '_no_device') return 1;
      if (b.id === '_no_device') return -1;
      return a.label.localeCompare(b.label);
    });
    integrations.push({ id: domainId, label: domainId, devices });
  });
  integrations.sort((a, b) => a.label.localeCompare(b.label));
  return integrations;
}

const GaControlRubric: React.FC<{
  instanceName: string;
  instanceId: string;
  pages: GaPage[];
  searchQuery: string;
}> = ({ instanceName, instanceId, pages, searchQuery }) => {
  const [open, setOpen] = useState(false);
  const [openPages, setOpenPages] = useState<Set<string>>(new Set());

  const togglePage = (id: string) => setOpenPages(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.toLowerCase();

  const filteredPages = useMemo(() => {
    if (!isSearching) return pages;
    return pages
      .map(p => ({
        ...p,
        nodes: p.nodes.filter(n =>
          n.label.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q)
        )
      }))
      .filter(p => p.nodes.length > 0 || p.name.toLowerCase().includes(q));
  }, [pages, q, isSearching]);

  if (filteredPages.length === 0 && !isSearching) return null;

  const totalNodes = pages.reduce((s, p) => s + p.nodes.length, 0);

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-1.5 py-1 hover:bg-slate-700/50 rounded text-left transition-colors"
      >
        {open || isSearching
          ? <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
        }
        <Database className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-300 truncate">GA-Control</span>
        <span className="text-[9px] px-1 rounded bg-cyan-900/50 text-cyan-400 border border-cyan-800/40 flex-shrink-0 ml-1">
          {instanceName}
        </span>
        <span className="text-xs text-slate-500 ml-auto flex-shrink-0">{totalNodes}</span>
      </button>

      {(open || isSearching) && (
        <div className="ml-3 space-y-0.5">
          {filteredPages.map(page => (
            <div key={`${instanceId}-ga-${page.id}`}>
              <button
                onClick={() => togglePage(page.id)}
                className="w-full flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-slate-700/50 rounded text-left transition-colors"
              >
                {openPages.has(page.id) || isSearching
                  ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                }
                <Layers className="w-3 h-3 text-amber-400/70 flex-shrink-0" />
                <span className="text-xs text-slate-400 truncate">{page.name}</span>
                <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{page.nodes.length}</span>
              </button>

              {(openPages.has(page.id) || isSearching) && (
                <div className="ml-4 space-y-0.5">
                  {page.nodes.map(node => (
                    <div
                      key={node.id}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-slate-800/40"
                    >
                      <Tag className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-300 truncate">{node.label}</p>
                        <p className="text-[9px] font-mono text-slate-600 truncate">{node.type}</p>
                      </div>
                      {node.unit && <span className="text-[10px] text-slate-600 flex-shrink-0">{node.unit}</span>}
                      {node.value !== undefined && (
                        <span className="text-[10px] font-mono text-cyan-400 flex-shrink-0">{String(node.value)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DriverPointsRubric: React.FC<{
  instanceName: string;
  instanceId: string;
  data: InstanceDriverPoints;
  searchQuery: string;
}> = ({ instanceName, instanceId, data, searchQuery }) => {
  const [open, setOpen] = useState(false);
  const [openSheets, setOpenSheets] = useState<Set<string>>(new Set());
  const [openDevices, setOpenDevices] = useState<Set<string>>(new Set());

  const toggleSheet = (id: string) => setOpenSheets(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleDevice = (id: string) => setOpenDevices(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const isSearching = searchQuery.trim().length > 0;
  const q = searchQuery.toLowerCase();

  const filteredSheets = useMemo(() => {
    if (!isSearching) return data.sheets;
    return data.sheets
      .map(s => ({
        ...s,
        nodes: s.nodes.filter(n =>
          n.label.toLowerCase().includes(q) ||
          n.entityId?.toLowerCase().includes(q)
        )
      }))
      .filter(s => s.nodes.length > 0 || s.name.toLowerCase().includes(q));
  }, [data.sheets, q, isSearching]);

  const filteredDevices = useMemo(() => {
    if (!isSearching) return data.modbusDevices;
    return data.modbusDevices
      .map(d => ({
        ...d,
        datapoints: d.datapoints.filter(dp =>
          dp.name.toLowerCase().includes(q)
        )
      }))
      .filter(d => d.datapoints.length > 0 || d.name.toLowerCase().includes(q));
  }, [data.modbusDevices, q, isSearching]);

  const totalPoints = data.sheets.reduce((s, sh) => s + sh.nodes.length, 0) +
    data.modbusDevices.reduce((s, d) => s + d.datapoints.length, 0);

  if (totalPoints === 0 && !isSearching) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-1.5 py-1 hover:bg-slate-700/50 rounded text-left transition-colors"
      >
        {open || isSearching
          ? <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
        }
        <Server className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-300 truncate">Treiberpunkte</span>
        <span className="text-[9px] px-1 rounded bg-cyan-900/50 text-cyan-400 border border-cyan-800/40 flex-shrink-0 ml-1">
          {instanceName}
        </span>
        <span className="text-xs text-slate-500 ml-auto flex-shrink-0">{totalPoints}</span>
      </button>

      {(open || isSearching) && (
        <div className="ml-3 space-y-0.5">
          {filteredSheets.map(sheet => (
            <div key={`${instanceId}-dp-sheet-${sheet.id}`}>
              <button
                onClick={() => toggleSheet(sheet.id)}
                className="w-full flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-slate-700/50 rounded text-left transition-colors"
              >
                {openSheets.has(sheet.id) || isSearching
                  ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                }
                <Layers className="w-3 h-3 text-cyan-400/70 flex-shrink-0" />
                <span className="text-xs text-slate-400 truncate">{sheet.name}</span>
                <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{sheet.nodes.length}</span>
              </button>

              {(openSheets.has(sheet.id) || isSearching) && (
                <div className="ml-4 space-y-0.5">
                  {sheet.nodes.map(node => (
                    <div
                      key={node.id}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-slate-800/40"
                    >
                      <Tag className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-300 truncate">{node.label}</p>
                        {node.entityId && (
                          <p className="text-[9px] font-mono text-slate-600 truncate">{node.entityId}</p>
                        )}
                      </div>
                      {node.unit && <span className="text-[10px] text-slate-600 flex-shrink-0">{node.unit}</span>}
                      <span className="text-[9px] font-mono text-slate-700 flex-shrink-0">{node.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {filteredDevices.map(device => (
            <div key={`${instanceId}-dp-dev-${device.id}`}>
              <button
                onClick={() => toggleDevice(device.id)}
                className="w-full flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-slate-700/50 rounded text-left transition-colors"
              >
                {openDevices.has(device.id) || isSearching
                  ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                }
                <Server className="w-3 h-3 text-emerald-400/70 flex-shrink-0" />
                <span className="text-xs text-slate-400 truncate">{device.name}</span>
                <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{device.datapoints.length}</span>
              </button>

              {(openDevices.has(device.id) || isSearching) && (
                <div className="ml-4 space-y-0.5">
                  {device.datapoints.map(dp => (
                    <div
                      key={dp.id}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-slate-800/40"
                    >
                      <Gauge className="w-2.5 h-2.5 text-emerald-400/60 flex-shrink-0" />
                      <span className="text-[10px] text-slate-300 flex-1 truncate">{dp.name}</span>
                      {dp.unit && <span className="text-[10px] text-slate-600 flex-shrink-0">{dp.unit}</span>}
                      {dp.register !== undefined && (
                        <span className="text-[9px] font-mono text-slate-700 flex-shrink-0">R{dp.register}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const EntityBrowser: React.FC<EntityBrowserProps> = ({
  haEntities,
  haLoading,
  haError,
  selectedEntityId,
  onSelect,
  onReload,
  instances = [],
  instanceGaPages = {},
  instanceDriverPoints = {},
}) => {
  const [search, setSearch] = useState('');
  const [openIntegrations, setOpenIntegrations] = useState<Set<string>>(new Set());
  const [openDevices, setOpenDevices] = useState<Set<string>>(new Set());

  const hierarchy = useMemo(() => buildHierarchy(haEntities), [haEntities]);

  const toggleIntegration = (id: string) => {
    setOpenIntegrations(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDevice = (id: string) => {
    setOpenDevices(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return hierarchy;
    const q = search.toLowerCase();
    return hierarchy
      .map(integration => ({
        ...integration,
        devices: integration.devices
          .map(device => ({
            ...device,
            entities: device.entities.filter(e =>
              e.entity_id.toLowerCase().includes(q) ||
              String(e.attributes.friendly_name || '').toLowerCase().includes(q) ||
              String(e.attributes._device_name || '').toLowerCase().includes(q)
            )
          }))
          .filter(d => d.entities.length > 0)
      }))
      .filter(i => i.devices.length > 0);
  }, [hierarchy, search]);

  const isSearching = search.trim().length > 0;

  const instancesWithExtras = useMemo(() =>
    instances.filter(inst =>
      (instanceGaPages[inst.id] && instanceGaPages[inst.id].length > 0) ||
      (instanceDriverPoints[inst.id] &&
        (instanceDriverPoints[inst.id].sheets.length > 0 || instanceDriverPoints[inst.id].modbusDevices.length > 0))
    ),
    [instances, instanceGaPages, instanceDriverPoints]
  );

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-1.5 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 focus-within:border-blue-500 transition-colors">
          <Search className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Entity suchen..."
            className="bg-transparent text-xs text-white placeholder-slate-500 outline-none flex-1"
          />
        </div>
        <button
          onClick={onReload}
          className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
          title="Entities neu laden"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${haLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {haError && !haLoading && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-3 py-2 mb-2">
          <p className="text-xs text-red-400 font-semibold mb-0.5">Fehler beim Laden</p>
          <p className="text-[10px] text-red-300/80 font-mono break-all">{haError}</p>
          <button onClick={onReload} className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            Erneut versuchen
          </button>
        </div>
      )}

      {haEntities.length === 0 && !haLoading && !haError && (
        <div className="text-center py-4 text-xs text-slate-500">
          <p>HA nicht verbunden</p>
          <button onClick={onReload} className="mt-1 text-blue-400 hover:text-blue-300 transition-colors">
            Erneut versuchen
          </button>
        </div>
      )}

      {haLoading && (
        <div className="text-center py-4 text-xs text-slate-400">
          Lade Entities...
        </div>
      )}

      <div className="overflow-y-auto max-h-72 space-y-0.5">
        {filtered.map(integration => (
          <div key={integration.id}>
            <button
              onClick={() => toggleIntegration(integration.id)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 hover:bg-slate-700/50 rounded text-left transition-colors"
            >
              {openIntegrations.has(integration.id) || isSearching
                ? <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                : <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
              }
              <Layers className="w-3 h-3 text-cyan-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-300 truncate">{integration.label}</span>
              <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
                {integration.devices.reduce((sum, d) => sum + d.entities.length, 0)}
              </span>
            </button>

            {(openIntegrations.has(integration.id) || isSearching) && (
              <div className="ml-3">
                {integration.devices.map(device => (
                  <div key={device.id}>
                    <button
                      onClick={() => toggleDevice(`${integration.id}::${device.id}`)}
                      className="w-full flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-slate-700/50 rounded text-left transition-colors"
                    >
                      {openDevices.has(`${integration.id}::${device.id}`) || isSearching
                        ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      }
                      <Cpu className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-slate-400 truncate">{device.label}</span>
                      <span className="text-xs text-slate-600 ml-auto flex-shrink-0">{device.entities.length}</span>
                    </button>

                    {(openDevices.has(`${integration.id}::${device.id}`) || isSearching) && (
                      <div className="ml-4">
                        {device.entities.map(entity => {
                          const friendlyName = String(entity.attributes.friendly_name || '');
                          const instanceName = entity.attributes._instance_name as string | undefined;
                          const isSelected = entity.entity_id === selectedEntityId;
                          return (
                            <button
                              key={entity.entity_id}
                              onClick={() => onSelect(entity)}
                              className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-colors ${
                                isSelected
                                  ? 'bg-blue-600/30 border border-blue-600/40'
                                  : 'hover:bg-slate-700/50'
                              }`}
                            >
                              <Tag className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-mono text-slate-300 truncate">{entity.entity_id}</p>
                                <div className="flex items-center gap-1.5">
                                  {friendlyName && (
                                    <p className="text-[10px] text-slate-500 truncate">{friendlyName}</p>
                                  )}
                                  {instanceName && (
                                    <span className="text-[9px] px-1 py-0 rounded bg-cyan-900/50 text-cyan-400 border border-cyan-800/40 flex-shrink-0">
                                      {instanceName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 max-w-14 truncate">
                                {entity.state}
                              </span>
                              {isSelected && <Check className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {instancesWithExtras.map(inst => (
          <div key={`ext-${inst.id}`}>
            {instanceGaPages[inst.id] && instanceGaPages[inst.id].length > 0 && (
              <GaControlRubric
                instanceName={inst.name}
                instanceId={inst.id}
                pages={instanceGaPages[inst.id]}
                searchQuery={search}
              />
            )}
            {instanceDriverPoints[inst.id] && (
              instanceDriverPoints[inst.id].sheets.length > 0 ||
              instanceDriverPoints[inst.id].modbusDevices.length > 0
            ) && (
              <DriverPointsRubric
                instanceName={inst.name}
                instanceId={inst.id}
                data={instanceDriverPoints[inst.id]}
                searchQuery={search}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
