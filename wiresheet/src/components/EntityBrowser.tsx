import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search, RefreshCw, Check, Layers, Cpu, Tag } from 'lucide-react';

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

interface EntityBrowserProps {
  haEntities: HAEntity[];
  haLoading: boolean;
  haError?: string | null;
  selectedEntityId?: string;
  onSelect: (entity: HAEntity) => void;
  onReload: () => void;
}

function buildHierarchy(entities: HAEntity[]): Integration[] {
  const domainMap = new Map<string, Map<string, HAEntity[]>>();

  for (const entity of entities) {
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

export const EntityBrowser: React.FC<EntityBrowserProps> = ({
  haEntities,
  haLoading,
  haError,
  selectedEntityId,
  onSelect,
  onReload
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
                                {friendlyName && (
                                  <p className="text-[10px] text-slate-500 truncate">{friendlyName}</p>
                                )}
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
      </div>
    </div>
  );
};
