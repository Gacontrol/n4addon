import React, { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Settings, ChevronRight, ChevronDown, Server, Database, ToggleLeft, ToggleRight, Copy, X, Check, Network, RefreshCw, CreditCard as Edit2, Save, Download, Upload, BookmarkPlus, Home, Lightbulb, Thermometer, Power, Gauge, Activity, AlertCircle, Loader2, Wifi, Eye, EyeOff } from 'lucide-react';
import { ModbusDevice, ModbusDatapoint, HaEntity, HaDevice, HaInstance } from '../types/flow';
import { modbusDeviceLibrary, ModbusDeviceTemplate } from '../data/modbusDeviceLibrary';
import { HomeAssistantDriverPanel } from './HomeAssistantDriverPanel';

type DriverType = 'modbus-tcp' | 'homeassistant' | string;

interface CustomLibraryDevice {
  id: string;
  name: string;
  category: string;
  datapoints: Omit<ModbusDatapoint, 'id'>[];
}

interface DriversViewProps {
  modbusDevices: ModbusDevice[];
  modbusDriverEnabled: boolean;
  onModbusDevicesChange: (devices: ModbusDevice[]) => void;
  onModbusDriverEnabledChange: (enabled: boolean) => void;
  modbusDeviceStatus: Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>;
  onPingDevice: (deviceId: string) => void;
  modbusValues?: Record<string, Record<string, number | boolean | null>>;
  haEntities: HaEntity[];
  haDevices: HaDevice[];
  haLoading: boolean;
  haError: string | null;
  haDriverEnabled: boolean;
  onHaDriverEnabledChange: (enabled: boolean) => void;
  onRefreshHaEntities: () => void;
  haInstances?: HaInstance[];
  onHaInstancesChange?: (instances: HaInstance[]) => void;
  driverLiveValues?: { modbus: Record<string, unknown>; ha: Record<string, { state: string; attributes: Record<string, unknown> }> };
  instanceGaPages?: Record<string, { id: string; name: string; nodes: { id: string; type: string; label: string; unit: string; value?: unknown }[] }[]>;
  instanceDriverPoints?: Record<string, { sheets: { id: string; name: string; nodes: { id: string; type: string; label: string; unit: string; entityId: string }[] }[]; modbusDevices: { id: string; name: string; datapoints: { id: string; name: string; unit: string; type: string; register?: number }[] }[] }>;
}

const REGISTER_TYPES = ['holding', 'input', 'coil', 'discrete'] as const;
const DATA_TYPES = ['int16', 'uint16', 'int32', 'uint32', 'float32', 'bool'] as const;

const WRITABLE_HA_DOMAINS = ['switch', 'light', 'fan', 'cover', 'climate', 'input_boolean', 'input_number', 'input_select', 'automation', 'script', 'scene', 'lock', 'vacuum', 'media_player'];

function isWritableHaEntity(entity: HaEntity): boolean {
  const domain = entity.entity_id.split('.')[0];
  return WRITABLE_HA_DOMAINS.includes(domain);
}

function getHaEntityIcon(entityId: string): React.ReactNode {
  const domain = entityId.split('.')[0];
  const iconClass = "w-3.5 h-3.5";
  switch (domain) {
    case 'light':
      return <Lightbulb className={`${iconClass} text-yellow-400`} />;
    case 'switch':
    case 'input_boolean':
      return <Power className={`${iconClass} text-blue-400`} />;
    case 'sensor':
      return <Gauge className={`${iconClass} text-green-400`} />;
    case 'binary_sensor':
      return <Activity className={`${iconClass} text-cyan-400`} />;
    case 'climate':
      return <Thermometer className={`${iconClass} text-orange-400`} />;
    default:
      return <Activity className={`${iconClass} text-slate-400`} />;
  }
}

const HaEntityRow: React.FC<{ entity: HaEntity; liveData?: { state: string; attributes: Record<string, unknown> } }> = ({ entity, liveData }) => {
  const friendlyName = entity.attributes.friendly_name as string || entity.entity_id;
  const domain = entity.entity_id.split('.')[0];
  const unit = entity.attributes.unit_of_measurement as string || '';
  const state = liveData?.state ?? entity.state;

  return (
    <div className="flex items-center gap-2 text-xs bg-slate-900 rounded px-2 py-1.5 hover:bg-slate-800 cursor-pointer group">
      {getHaEntityIcon(entity.entity_id)}
      <span className="text-white flex-1 min-w-0 truncate" title={friendlyName}>
        {friendlyName}
      </span>
      <span className="text-slate-600 text-[10px] shrink-0">{domain}</span>
      <span className={`font-mono shrink-0 min-w-[60px] text-right ${state !== 'unavailable' ? 'text-cyan-400' : 'text-slate-600'}`}>
        {state}{unit && ` ${unit}`}
      </span>
    </div>
  );
};

export const DriversView: React.FC<DriversViewProps> = ({
  modbusDevices,
  modbusDriverEnabled,
  onModbusDevicesChange,
  onModbusDriverEnabledChange,
  modbusDeviceStatus,
  onPingDevice,
  modbusValues = {},
  haEntities,
  haDevices,
  haLoading,
  haError,
  haDriverEnabled,
  onHaDriverEnabledChange,
  onRefreshHaEntities,
  haInstances = [],
  onHaInstancesChange,
  driverLiveValues = { modbus: {}, ha: {} },
  instanceGaPages = {},
  instanceDriverPoints = {},
}) => {
  const [selectedDriverType, setSelectedDriverType] = useState<DriverType | null>('modbus-tcp');
  const [expandedHaDevices, setExpandedHaDevices] = useState<Set<string>>(new Set());
  const [haSearchQuery, setHaSearchQuery] = useState('');
  const [showAddHaInstance, setShowAddHaInstance] = useState(false);
  const [newHaInstance, setNewHaInstance] = useState<Partial<HaInstance>>({ name: '', url: 'http://192.168.1.x:8123', token: '', enabled: true });
  const [haInstanceTestResult] = useState<Record<string, { ok: boolean; msg: string; testing?: boolean }>>({});
  const [manualAuthMode, setManualAuthMode] = useState<'token' | 'credentials'>('token');
  const [manualCredentials, setManualCredentials] = useState({ username: '', password: '' });
  const [manualAuthLoading, setManualAuthLoading] = useState(false);
  const [manualAuthError, setManualAuthError] = useState<string | null>(null);
  const [instanceEntities, setInstanceEntities] = useState<Record<string, HaEntity[]>>({});
  const [instanceEntitiesLoading, setInstanceEntitiesLoading] = useState<Record<string, boolean>>({});
  const [haInstanceSearchQuery, setHaInstanceSearchQuery] = useState<Record<string, string>>({});
  const [showTokens, setShowTokens] = useState<Set<string>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredHosts, setDiscoveredHosts] = useState<{ url: string; ip: string; name: string }[]>([]);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [authTarget, setAuthTarget] = useState<{ url: string; name: string } | null>(null);
  const [authCredentials, setAuthCredentials] = useState({ username: '', password: '' });
  const [authToken, setAuthToken] = useState('');
  const [authMode, setAuthMode] = useState<'credentials' | 'token'>('credentials');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [editingDatapoint, setEditingDatapoint] = useState<string | null>(null);
  const [showSaveToLibrary, setShowSaveToLibrary] = useState<ModbusDevice | null>(null);
  const [customLibrary, setCustomLibrary] = useState<CustomLibraryDevice[]>(() => {
    const saved = localStorage.getItem('wiresheet-custom-modbus-library');
    return saved ? JSON.parse(saved) : [];
  });
  const [newLibraryCategory, setNewLibraryCategory] = useState('Benutzerdefiniert');
  const [newLibraryName, setNewLibraryName] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, Record<string, unknown>>>({});
  const [loadingConfig, setLoadingConfig] = useState<Record<string, boolean>>({});
  const [savingConfig, setSavingConfig] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newDevice, setNewDevice] = useState<Partial<ModbusDevice>>({
    name: '',
    host: '192.168.1.100',
    port: 502,
    unitId: 1,
    pollIntervalMs: 1000,
    datapoints: []
  });

  const toggleDeviceExpanded = useCallback((deviceId: string) => {
    setExpandedDevices(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, []);

  const handleAddDevice = useCallback(() => {
    if (!newDevice.name || !newDevice.host) return;
    const device: ModbusDevice = {
      id: `modbus-device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newDevice.name,
      host: newDevice.host,
      port: newDevice.port || 502,
      unitId: newDevice.unitId || 1,
      pollIntervalMs: newDevice.pollIntervalMs || 1000,
      enabled: true,
      datapoints: newDevice.datapoints || []
    };
    onModbusDevicesChange([...modbusDevices, device]);
    setNewDevice({ name: '', host: '192.168.1.100', port: 502, unitId: 1, pollIntervalMs: 1000, datapoints: [] });
    setShowAddDevice(false);
    setExpandedDevices(prev => new Set([...prev, device.id]));
  }, [newDevice, modbusDevices, onModbusDevicesChange]);

  const handleAddFromLibrary = useCallback((template: ModbusDeviceTemplate | CustomLibraryDevice) => {
    const isCustom = !('manufacturer' in template);
    const device: ModbusDevice = {
      id: `modbus-device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: isCustom ? template.name : template.model,
      host: '192.168.1.100',
      port: 502,
      unitId: 1,
      pollIntervalMs: 1000,
      enabled: true,
      datapoints: template.datapoints.map((dp, idx) => ({
        ...dp,
        id: `dp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
      })),
      configDatapoints: !isCustom && template.configDatapoints ? template.configDatapoints.map((dp, idx) => ({
        ...dp,
        id: `cfg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
      })) : undefined
    };
    onModbusDevicesChange([...modbusDevices, device]);
    setShowLibrary(false);
    setExpandedDevices(prev => new Set([...prev, device.id]));
  }, [modbusDevices, onModbusDevicesChange]);

  const handleDeleteDevice = useCallback((deviceId: string) => {
    onModbusDevicesChange(modbusDevices.filter(d => d.id !== deviceId));
  }, [modbusDevices, onModbusDevicesChange]);

  const handleUpdateDevice = useCallback((deviceId: string, updates: Partial<ModbusDevice>) => {
    onModbusDevicesChange(modbusDevices.map(d => d.id === deviceId ? { ...d, ...updates } : d));
  }, [modbusDevices, onModbusDevicesChange]);

  const handleDuplicateDevice = useCallback((device: ModbusDevice) => {
    const newDev: ModbusDevice = {
      ...device,
      id: `modbus-device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${device.name} (Kopie)`,
      datapoints: device.datapoints.map((dp, idx) => ({
        ...dp,
        id: `dp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
      }))
    };
    onModbusDevicesChange([...modbusDevices, newDev]);
  }, [modbusDevices, onModbusDevicesChange]);

  const handleAddDatapoint = useCallback((deviceId: string) => {
    const device = modbusDevices.find(d => d.id === deviceId);
    if (!device) return;
    const newDpId = `dp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newDp: ModbusDatapoint = {
      id: newDpId,
      name: `Datenpunkt ${device.datapoints.length + 1}`,
      address: 0,
      registerType: 'holding',
      dataType: 'int16',
      scale: 1,
      unit: '',
      writable: false
    };
    handleUpdateDevice(deviceId, { datapoints: [...device.datapoints, newDp] });
    setEditingDatapoint(newDpId);
  }, [modbusDevices, handleUpdateDevice]);

  const handleUpdateDatapoint = useCallback((deviceId: string, datapointId: string, updates: Partial<ModbusDatapoint>) => {
    const device = modbusDevices.find(d => d.id === deviceId);
    if (!device) return;
    handleUpdateDevice(deviceId, {
      datapoints: device.datapoints.map(dp => dp.id === datapointId ? { ...dp, ...updates } : dp)
    });
  }, [modbusDevices, handleUpdateDevice]);

  const handleDeleteDatapoint = useCallback((deviceId: string, datapointId: string) => {
    const device = modbusDevices.find(d => d.id === deviceId);
    if (!device) return;
    handleUpdateDevice(deviceId, {
      datapoints: device.datapoints.filter(dp => dp.id !== datapointId)
    });
    if (editingDatapoint === datapointId) {
      setEditingDatapoint(null);
    }
  }, [modbusDevices, handleUpdateDevice, editingDatapoint]);

  const handleSaveToLibrary = useCallback((device: ModbusDevice) => {
    if (!newLibraryName) return;
    const customDevice: CustomLibraryDevice = {
      id: `custom-${Date.now()}`,
      name: newLibraryName,
      category: newLibraryCategory,
      datapoints: device.datapoints.map(({ id, ...rest }) => rest)
    };
    const updated = [...customLibrary, customDevice];
    setCustomLibrary(updated);
    localStorage.setItem('wiresheet-custom-modbus-library', JSON.stringify(updated));
    setShowSaveToLibrary(null);
    setNewLibraryName('');
  }, [customLibrary, newLibraryName, newLibraryCategory]);

  const handleDeleteFromLibrary = useCallback((customId: string) => {
    const updated = customLibrary.filter(d => d.id !== customId);
    setCustomLibrary(updated);
    localStorage.setItem('wiresheet-custom-modbus-library', JSON.stringify(updated));
  }, [customLibrary]);

  const handleExportLibrary = useCallback(() => {
    const exportData = {
      version: 1,
      devices: customLibrary
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modbus-library.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [customLibrary]);

  const handleImportLibrary = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.devices && Array.isArray(data.devices)) {
          const imported = data.devices.map((d: CustomLibraryDevice) => ({
            ...d,
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }));
          const updated = [...customLibrary, ...imported];
          setCustomLibrary(updated);
          localStorage.setItem('wiresheet-custom-modbus-library', JSON.stringify(updated));
        }
      } catch {
        console.error('Import fehlgeschlagen');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [customLibrary]);

  const formatValue = (value: number | boolean | null | undefined, dp: ModbusDatapoint): string => {
    if (value === null || value === undefined) return '--';
    if (typeof value === 'boolean') return value ? 'EIN' : 'AUS';
    const scaled = typeof dp.scale === 'number' ? value * dp.scale : value;
    return `${scaled.toFixed(dp.scale && dp.scale < 1 ? 1 : 0)}${dp.unit ? ` ${dp.unit}` : ''}`;
  };

  const getApiBase = () => {
    const path = window.location.pathname;
    const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
    return m ? `${m[1]}/api` : '/api';
  };

  const loadConfigValue = useCallback(async (device: ModbusDevice, dp: ModbusDatapoint) => {
    const key = `${device.id}:${dp.id}`;
    setLoadingConfig(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${getApiBase()}/modbus/read-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: device.host,
          port: device.port,
          unitId: device.unitId,
          address: dp.address,
          registerType: dp.registerType,
          dataType: dp.dataType,
          scale: dp.scale || 1,
          timeout: device.timeout || 3000
        })
      });
      const data = await res.json();
      if (data.success && data.value !== undefined) {
        setConfigValues(prev => ({
          ...prev,
          [device.id]: { ...(prev[device.id] || {}), [dp.id]: data.value }
        }));
      } else if (!data.success) {
        console.error('Config read failed:', data.error);
      }
    } catch (err) {
      console.error('Config read error:', err);
    } finally {
      setLoadingConfig(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  const writeConfigValue = useCallback(async (device: ModbusDevice, dp: ModbusDatapoint, value: number) => {
    const key = `${device.id}:${dp.id}`;
    setSavingConfig(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${getApiBase()}/modbus/write-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: device.host,
          port: device.port,
          unitId: device.unitId,
          address: dp.address,
          registerType: dp.registerType,
          dataType: dp.dataType,
          scale: dp.scale || 1,
          value,
          timeout: device.timeout || 3000
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfigValues(prev => ({
          ...prev,
          [device.id]: { ...(prev[device.id] || {}), [dp.id]: value }
        }));
      } else {
        console.error('Config write failed:', data.error);
      }
    } catch (err) {
      console.error('Config write error:', err);
    } finally {
      setSavingConfig(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  const handleAddHaInstance = useCallback(async () => {
    if (!newHaInstance.name || !newHaInstance.url) return;

    if (manualAuthMode === 'credentials') {
      if (!manualCredentials.username || !manualCredentials.password) return;
      setManualAuthLoading(true);
      setManualAuthError(null);
      try {
        const resp = await fetch(`${getApiBase()}/ha/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: newHaInstance.url, username: manualCredentials.username, password: manualCredentials.password })
        });
        const data = await resp.json();
        if (data.ok && data.token) {
          const instance: HaInstance = {
            id: `ha-${Date.now()}`,
            name: newHaInstance.name!,
            url: newHaInstance.url!.replace(/\/$/, ''),
            token: data.token,
            enabled: true
          };
          onHaInstancesChange?.([...haInstances, instance]);
          setNewHaInstance({ name: '', url: 'http://192.168.1.x:8123', token: '', enabled: true });
          setManualCredentials({ username: '', password: '' });
          setManualAuthError(null);
          setShowAddHaInstance(false);
        } else {
          setManualAuthError(data.msg || 'Anmeldung fehlgeschlagen');
        }
      } catch (err) {
        setManualAuthError(err instanceof Error ? err.message : 'Netzwerkfehler');
      } finally {
        setManualAuthLoading(false);
      }
      return;
    }

    if (!newHaInstance.token) return;
    const instance: HaInstance = {
      id: `ha-${Date.now()}`,
      name: newHaInstance.name!,
      url: newHaInstance.url!.replace(/\/$/, ''),
      token: newHaInstance.token!,
      enabled: true
    };
    onHaInstancesChange?.([...haInstances, instance]);
    setNewHaInstance({ name: '', url: 'http://192.168.1.x:8123', token: '', enabled: true });
    setShowAddHaInstance(false);
  }, [newHaInstance, manualAuthMode, manualCredentials, haInstances, onHaInstancesChange]);

  const handleDeleteHaInstance = useCallback((id: string) => {
    onHaInstancesChange?.(haInstances.filter(i => i.id !== id));
  }, [haInstances, onHaInstancesChange]);

  const handleToggleHaInstance = useCallback((id: string) => {
    onHaInstancesChange?.(haInstances.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i));
  }, [haInstances, onHaInstancesChange]);

  const handleLoadInstanceEntities = useCallback(async (instance: HaInstance) => {
    setInstanceEntitiesLoading(prev => ({ ...prev, [instance.id]: true }));
    try {
      const resp = await fetch(`${getApiBase()}/ha/instances/${instance.id}/states`);
      const data = await resp.json();
      if (data.entities) {
        setInstanceEntities(prev => ({ ...prev, [instance.id]: data.entities }));
      }
    } catch {
      setInstanceEntities(prev => ({ ...prev, [instance.id]: [] }));
    } finally {
      setInstanceEntitiesLoading(prev => ({ ...prev, [instance.id]: false }));
    }
  }, [instanceEntities]);

  const [discoverProgress, setDiscoverProgress] = useState<{ scanned: number; total: number } | null>(null);

  const handleDiscoverHa = useCallback(() => {
    setIsDiscovering(true);
    setDiscoveredHosts([]);
    setDiscoverProgress(null);
    setShowDiscovery(true);

    const apiBase = getApiBase();
    const es = new EventSource(`${apiBase}/ha/discover`, { withCredentials: false });

    const foundSet = new Set<string>();

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'found') {
          const host = msg.host as { url: string; ip: string; name: string };
          if (!foundSet.has(host.url)) {
            foundSet.add(host.url);
            setDiscoveredHosts(prev => [...prev, host]);
          }
        } else if (msg.type === 'progress') {
          setDiscoverProgress({ scanned: msg.scanned, total: msg.total });
        } else if (msg.type === 'done' || msg.type === 'error') {
          es.close();
          setIsDiscovering(false);
          setDiscoverProgress(null);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setIsDiscovering(false);
      setDiscoverProgress(null);
    };
  }, []);

  const handleAuthenticateInstance = useCallback(async () => {
    if (!authTarget) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const body = authMode === 'token'
        ? { url: authTarget.url, token: authToken }
        : { url: authTarget.url, username: authCredentials.username, password: authCredentials.password };

      const resp = await fetch(`${getApiBase()}/ha/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (data.ok && data.token) {
        const newInst: HaInstance = {
          id: `ha-${Date.now()}`,
          name: authTarget.name,
          url: authTarget.url,
          token: data.token,
          enabled: true
        };
        onHaInstancesChange?.([...haInstances, newInst]);
        setAuthTarget(null);
        setAuthCredentials({ username: '', password: '' });
        setAuthToken('');
        setDiscoveredHosts(prev => prev.filter(h => h.url !== authTarget.url));
      } else {
        setAuthError(data.msg || 'Anmeldung fehlgeschlagen');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Netzwerkfehler');
    } finally {
      setAuthLoading(false);
    }
  }, [authTarget, authMode, authToken, authCredentials, haInstances, onHaInstancesChange]);

  const renderConfigDatapointRow = (device: ModbusDevice, dp: ModbusDatapoint) => {
    const key = `${device.id}:${dp.id}`;
    const currentValue = configValues[device.id]?.[dp.id];
    const isLoading = loadingConfig[key];
    const isSaving = savingConfig[key];
    const hasValue = currentValue !== undefined;

    return (
      <div key={dp.id} className="flex items-center gap-2 text-xs bg-slate-900/50 rounded px-2 py-2 border border-slate-700/50">
        <Settings className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-slate-300 flex-1 min-w-0 truncate" title={dp.configDescription}>
          {dp.name}
        </span>
        {dp.configOptions ? (
          <select
            value={hasValue ? (currentValue as number) : ''}
            onChange={(e) => writeConfigValue(device, dp, parseInt(e.target.value))}
            disabled={!hasValue || isSaving}
            className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white min-w-[120px] disabled:opacity-50"
          >
            {!hasValue && <option value="">--</option>}
            {dp.configOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            value={hasValue ? (currentValue as number) : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) {
                setConfigValues(prev => ({
                  ...prev,
                  [device.id]: { ...(prev[device.id] || {}), [dp.id]: val }
                }));
              }
            }}
            onBlur={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && hasValue) {
                writeConfigValue(device, dp, val);
              }
            }}
            disabled={!hasValue || isSaving}
            className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white text-right disabled:opacity-50"
            placeholder="--"
          />
        )}
        {dp.unit && <span className="text-slate-500 text-[10px]">{dp.unit}</span>}
        <button
          onClick={() => loadConfigValue(device, dp)}
          disabled={isLoading}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-50"
          title="Wert vom Geraet lesen"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
        {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
      </div>
    );
  };

  const renderDatapointRow = (device: ModbusDevice, dp: ModbusDatapoint, isOutput: boolean) => {
    const isEditing = editingDatapoint === dp.id;
    const modbusKey = `${device.id}:${dp.id}`;
    const liveValue = driverLiveValues.modbus[modbusKey] ?? modbusValues[device.id]?.[dp.id];

    if (isEditing) {
      return (
        <div key={dp.id} className="bg-slate-900 rounded p-2 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Name</label>
              <input
                type="text"
                value={dp.name}
                onChange={(e) => handleUpdateDatapoint(device.id, dp.id, { name: e.target.value })}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Adresse</label>
              <input
                type="number"
                value={dp.address}
                onChange={(e) => handleUpdateDatapoint(device.id, dp.id, { address: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Register</label>
              <select
                value={dp.registerType}
                onChange={(e) => handleUpdateDatapoint(device.id, dp.id, { registerType: e.target.value as typeof REGISTER_TYPES[number] })}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
              >
                {REGISTER_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Datentyp</label>
              <select
                value={dp.dataType}
                onChange={(e) => handleUpdateDatapoint(device.id, dp.id, { dataType: e.target.value as typeof DATA_TYPES[number] })}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
              >
                {DATA_TYPES.map(dt => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Skalierung</label>
              <input
                type="number"
                step="0.01"
                value={dp.scale ?? 1}
                onChange={(e) => handleUpdateDatapoint(device.id, dp.id, { scale: parseFloat(e.target.value) || 1 })}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Einheit</label>
              <input
                type="text"
                value={dp.unit || ''}
                onChange={(e) => handleUpdateDatapoint(device.id, dp.id, { unit: e.target.value })}
                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Schreibbar</label>
              <button
                onClick={() => handleUpdateDatapoint(device.id, dp.id, { writable: !dp.writable })}
                className={`w-full px-2 py-1 rounded text-xs font-medium ${dp.writable ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
              >
                {dp.writable ? 'Ja' : 'Nein'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setEditingDatapoint(null)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
            >
              <Check className="w-3 h-3" />
              Fertig
            </button>
            <button
              onClick={() => handleDeleteDatapoint(device.id, dp.id)}
              className="flex items-center gap-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs"
            >
              <Trash2 className="w-3 h-3" />
              Loeschen
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={dp.id}
        className="flex items-center gap-2 text-xs bg-slate-900 rounded px-2 py-1.5 hover:bg-slate-800 cursor-pointer group"
        onClick={() => setEditingDatapoint(dp.id)}
      >
        <div className={`w-2 h-2 rounded-full ${isOutput ? 'bg-blue-500' : 'bg-green-500'}`} />
        <span className="text-white flex-1 min-w-0 truncate">{dp.name}</span>
        <span className="text-slate-500 shrink-0">{dp.registerType}[{dp.address}]</span>
        <span className="text-slate-500 shrink-0">{dp.dataType}</span>
        <span className={`font-mono shrink-0 min-w-[60px] text-right ${liveValue !== null && liveValue !== undefined ? 'text-cyan-400' : 'text-slate-600'}`}>
          {formatValue(liveValue, dp)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setEditingDatapoint(dp.id); }}
          className="p-0.5 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit2 className="w-3 h-3 text-slate-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDeleteDatapoint(device.id, dp.id); }}
          className="p-0.5 rounded hover:bg-red-600/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3 h-3 text-red-400" />
        </button>
      </div>
    );
  };

  const allLibraryDevices = [
    ...modbusDeviceLibrary.map(d => ({ ...d, isCustom: false as const })),
    ...customLibrary.map(d => ({ ...d, isCustom: true as const, manufacturer: 'Benutzerdefiniert', model: d.name, description: '' }))
  ];

  const libraryByCategory = allLibraryDevices.reduce((acc, device) => {
    const cat = device.category || 'Sonstiges';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(device);
    return acc;
  }, {} as Record<string, typeof allLibraryDevices>);

  return (
    <div className="flex h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportLibrary}
      />

      <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-white mb-2">Treiber</h2>
          <p className="text-xs text-slate-500">Externe Schnittstellen konfigurieren</p>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-1">
          <button
            onClick={() => setSelectedDriverType('modbus-tcp')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
              selectedDriverType === 'modbus-tcp'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Network className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium text-sm">Modbus TCP</div>
              <div className={`text-xs ${selectedDriverType === 'modbus-tcp' ? 'text-blue-200' : 'text-slate-500'}`}>
                {modbusDevices.length} Geraete
              </div>
            </div>
          </button>

          <div className="pt-1">
            <div className="px-1 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Home Assistant</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDiscoverHa}
                  disabled={isDiscovering}
                  className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-cyan-400 disabled:opacity-40"
                  title="Netzwerk nach HA-Instanzen durchsuchen"
                >
                  {isDiscovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => setShowAddHaInstance(true)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-cyan-400"
                  title="HA-Instanz manuell hinzufuegen"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedDriverType('homeassistant')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                selectedDriverType === 'homeassistant'
                  ? 'bg-cyan-700 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Home className="w-4 h-4" />
              <div className="text-left">
                <div className="font-medium text-sm">Lokal (Supervisor)</div>
                <div className={`text-xs ${selectedDriverType === 'homeassistant' ? 'text-cyan-200' : 'text-slate-500'}`}>
                  {haDevices.length} Geraete
                </div>
              </div>
            </button>
            {haInstances.map(instance => (
              <button
                key={instance.id}
                onClick={() => {
                  setSelectedDriverType(instance.id);
                  handleLoadInstanceEntities(instance);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors mt-0.5 ${
                  selectedDriverType === instance.id
                    ? 'bg-cyan-700 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="flex-shrink-0 relative">
                  <Wifi className="w-4 h-4" />
                  <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-800 ${instance.enabled ? 'bg-green-500' : 'bg-slate-500'}`} />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{instance.name}</div>
                  <div className={`text-xs truncate ${selectedDriverType === instance.id ? 'text-cyan-200' : 'text-slate-500'}`}>
                    {instance.url.replace(/^https?:\/\//, '')}
                  </div>
                </div>
              </button>
            ))}
            {haInstances.length === 0 && (
              <div className="mt-1 rounded-lg border border-dashed border-slate-600 bg-slate-800/40 px-3 py-3">
                <p className="text-[11px] text-slate-500 text-center mb-2">Keine weiteren HA-Instanzen</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleDiscoverHa}
                    disabled={isDiscovering}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-cyan-300 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                  >
                    {isDiscovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                    Netzwerk scannen
                  </button>
                  <button
                    onClick={() => setShowAddHaInstance(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-cyan-300 rounded text-[11px] font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Manuell
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDriverType === 'modbus-tcp' && (
          <>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-blue-400" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Modbus TCP</h2>
                  <p className="text-xs text-slate-500">Industriestandard fuer Geraetekommunikation</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onModbusDriverEnabledChange(!modbusDriverEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    modbusDriverEnabled
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {modbusDriverEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {modbusDriverEnabled ? 'Aktiv' : 'Deaktiviert'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setShowAddDevice(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Geraet hinzufuegen
                </button>
                <button
                  onClick={() => setShowLibrary(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Aus Bibliothek
                </button>
              </div>

              {modbusDevices.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Keine Modbus-Geraete konfiguriert</p>
                  <p className="text-slate-600 text-xs mt-1">Fuegen Sie ein neues Geraet hinzu oder waehlen Sie eines aus der Bibliothek</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modbusDevices.map(device => {
                    const isExpanded = expandedDevices.has(device.id);
                    const status = modbusDeviceStatus[device.id];
                    const inputDatapoints = device.datapoints.filter(dp => !dp.writable && !dp.isConfig);
                    const outputDatapoints = device.datapoints.filter(dp => dp.writable && !dp.isConfig);
                    const configDatapoints = device.configDatapoints || [];

                    return (
                      <div key={device.id} className="bg-slate-800 rounded-lg border border-slate-700">
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-750"
                          onClick={() => toggleDeviceExpanded(device.id)}
                        >
                          <button className="text-slate-400">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <Server className="w-5 h-5 text-blue-400" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white text-sm truncate">{device.name}</div>
                            <div className="text-xs text-slate-500">{device.host}:{device.port} (Unit {device.unitId})</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{device.datapoints.length} DPs</span>
                            <div className={`w-2 h-2 rounded-full ${status?.online ? 'bg-green-500' : 'bg-slate-600'}`} />
                            <button
                              onClick={(e) => { e.stopPropagation(); onPingDevice(device.id); }}
                              className={`p-1 rounded hover:bg-slate-700 ${status?.pinging ? 'animate-spin' : ''}`}
                              title="Verbindung testen"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowSaveToLibrary(device); setNewLibraryName(device.name); }}
                              className="p-1 rounded hover:bg-slate-700"
                              title="In Bibliothek speichern"
                            >
                              <BookmarkPlus className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDuplicateDevice(device); }}
                              className="p-1 rounded hover:bg-slate-700"
                              title="Duplizieren"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingDevice(device.id); }}
                              className="p-1 rounded hover:bg-slate-700"
                              title="Bearbeiten"
                            >
                              <Settings className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.id); }}
                              className="p-1 rounded hover:bg-slate-700 hover:text-red-400"
                              title="Loeschen"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-700 p-3">
                            {editingDevice === device.id ? (
                              <div className="space-y-3 mb-4 p-3 bg-slate-900 rounded-lg">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Name</label>
                                    <input
                                      type="text"
                                      value={device.name}
                                      onChange={(e) => handleUpdateDevice(device.id, { name: e.target.value })}
                                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Host/IP</label>
                                    <input
                                      type="text"
                                      value={device.host}
                                      onChange={(e) => handleUpdateDevice(device.id, { host: e.target.value })}
                                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Port</label>
                                    <input
                                      type="number"
                                      value={device.port}
                                      onChange={(e) => handleUpdateDevice(device.id, { port: parseInt(e.target.value) || 502 })}
                                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Unit ID</label>
                                    <input
                                      type="number"
                                      value={device.unitId}
                                      onChange={(e) => handleUpdateDevice(device.id, { unitId: parseInt(e.target.value) || 1 })}
                                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Poll Intervall (ms)</label>
                                    <input
                                      type="number"
                                      value={device.pollIntervalMs}
                                      onChange={(e) => handleUpdateDevice(device.id, { pollIntervalMs: parseInt(e.target.value) || 1000 })}
                                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={() => setEditingDevice(null)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                                >
                                  <Check className="w-3 h-3" />
                                  Fertig
                                </button>
                              </div>
                            ) : null}

                            <div className="space-y-4">
                              {inputDatapoints.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3" />
                                    Eingaenge ({inputDatapoints.length})
                                  </h4>
                                  <div className="space-y-1 pl-4">
                                    {inputDatapoints.map(dp => renderDatapointRow(device, dp, false))}
                                  </div>
                                </div>
                              )}

                              {outputDatapoints.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3" />
                                    Ausgaenge ({outputDatapoints.length})
                                  </h4>
                                  <div className="space-y-1 pl-4">
                                    {outputDatapoints.map(dp => renderDatapointRow(device, dp, true))}
                                  </div>
                                </div>
                              )}

                              {configDatapoints.length > 0 && (
                                <div className="border-t border-slate-700 pt-3 mt-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                                      <Settings className="w-3 h-3" />
                                      Konfiguration ({configDatapoints.length})
                                    </h4>
                                    <button
                                      onClick={() => {
                                        configDatapoints.forEach(dp => loadConfigValue(device, dp));
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Alle lesen
                                    </button>
                                  </div>
                                  <div className="space-y-1.5 pl-4 max-h-60 overflow-y-auto">
                                    {configDatapoints.map(dp => renderConfigDatapointRow(device, dp))}
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-2 pl-4">
                                    Klicke auf den Refresh-Button um den aktuellen Wert vom Geraet zu lesen bevor du ihn aenderst.
                                  </p>
                                </div>
                              )}

                              <button
                                onClick={() => handleAddDatapoint(device.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                Datenpunkt hinzufuegen
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {selectedDriverType === 'homeassistant' && (
          <>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800">
              <div className="flex items-center gap-3">
                <Home className="w-5 h-5 text-cyan-400" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Home Assistant</h2>
                  <p className="text-xs text-slate-500">Integration mit Home Assistant Entities</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onRefreshHaEntities}
                  disabled={haLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {haLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Aktualisieren
                </button>
                <button
                  onClick={() => onHaDriverEnabledChange(!haDriverEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    haDriverEnabled
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {haDriverEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {haDriverEnabled ? 'Aktiv' : 'Deaktiviert'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {haError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-300">{haError}</span>
                </div>
              )}

              <div className="mb-4">
                <input
                  type="text"
                  value={haSearchQuery}
                  onChange={(e) => setHaSearchQuery(e.target.value)}
                  placeholder="Geraete oder Entities suchen..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {haLoading && haDevices.length === 0 ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-cyan-400 mx-auto mb-3 animate-spin" />
                  <p className="text-slate-500 text-sm">Lade Home Assistant Entities...</p>
                </div>
              ) : haDevices.length === 0 && haEntities.length === 0 ? (
                <div className="text-center py-12">
                  <Home className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Keine Home Assistant Entities gefunden</p>
                  <p className="text-slate-600 text-xs mt-1">Stellen Sie sicher, dass die Verbindung zu Home Assistant aktiv ist</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {haDevices
                    .filter(device => {
                      if (!haSearchQuery) return true;
                      const query = haSearchQuery.toLowerCase();
                      if (device.name.toLowerCase().includes(query)) return true;
                      return device.entities.some(e =>
                        e.entity_id.toLowerCase().includes(query) ||
                        (e.attributes.friendly_name as string || '').toLowerCase().includes(query)
                      );
                    })
                    .map(device => {
                      const isExpanded = expandedHaDevices.has(device.id);
                      const inputEntities = device.entities.filter(e => !isWritableHaEntity(e));
                      const outputEntities = device.entities.filter(e => isWritableHaEntity(e));

                      return (
                        <div key={device.id} className="bg-slate-800 rounded-lg border border-slate-700">
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-750"
                            onClick={() => {
                              setExpandedHaDevices(prev => {
                                const next = new Set(prev);
                                if (next.has(device.id)) {
                                  next.delete(device.id);
                                } else {
                                  next.add(device.id);
                                }
                                return next;
                              });
                            }}
                          >
                            <button className="text-slate-400">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <Home className="w-5 h-5 text-cyan-400" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white text-sm truncate">{device.name}</div>
                              <div className="text-xs text-slate-500">
                                {device.manufacturer && `${device.manufacturer} `}
                                {device.model && `${device.model} - `}
                                {device.entities.length} Entities
                              </div>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                          </div>

                          {isExpanded && (
                            <div className="border-t border-slate-700 p-3 space-y-4">
                              {inputEntities.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3" />
                                    Eingaenge ({inputEntities.length})
                                  </h4>
                                  <div className="space-y-1 pl-4">
                                    {inputEntities.map(entity => (
                                      <HaEntityRow key={entity.entity_id} entity={entity} liveData={driverLiveValues.ha[entity.entity_id]} />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {outputEntities.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                                    <ChevronRight className="w-3 h-3" />
                                    Ausgaenge ({outputEntities.length})
                                  </h4>
                                  <div className="space-y-1 pl-4">
                                    {outputEntities.map(entity => (
                                      <HaEntityRow key={entity.entity_id} entity={entity} liveData={driverLiveValues.ha[entity.entity_id]} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {haEntities.filter(e => !haDevices.some(d => d.entities.includes(e))).length > 0 && (
                    <div className="bg-slate-800 rounded-lg border border-slate-700">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-750"
                        onClick={() => {
                          setExpandedHaDevices(prev => {
                            const next = new Set(prev);
                            if (next.has('__unassigned__')) {
                              next.delete('__unassigned__');
                            } else {
                              next.add('__unassigned__');
                            }
                            return next;
                          });
                        }}
                      >
                        <button className="text-slate-400">
                          {expandedHaDevices.has('__unassigned__') ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <Activity className="w-5 h-5 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm">Nicht zugeordnete Entities</div>
                          <div className="text-xs text-slate-500">
                            {haEntities.filter(e => !haDevices.some(d => d.entities.includes(e))).length} Entities
                          </div>
                        </div>
                      </div>

                      {expandedHaDevices.has('__unassigned__') && (
                        <div className="border-t border-slate-700 p-3">
                          <div className="space-y-1">
                            {haEntities
                              .filter(e => !haDevices.some(d => d.entities.includes(e)))
                              .filter(e => {
                                if (!haSearchQuery) return true;
                                const query = haSearchQuery.toLowerCase();
                                return e.entity_id.toLowerCase().includes(query) ||
                                  (e.attributes.friendly_name as string || '').toLowerCase().includes(query);
                              })
                              .slice(0, 100)
                              .map(entity => (
                                <HaEntityRow key={entity.entity_id} entity={entity} liveData={driverLiveValues.ha[entity.entity_id]} />
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </>
        )}

        {(() => {
          const selectedInstance = haInstances.find(i => i.id === selectedDriverType);
          if (!selectedInstance) return null;
          return (
            <HomeAssistantDriverPanel
              key={selectedInstance.id}
              instance={selectedInstance}
              liveValues={driverLiveValues.ha}
              onDelete={(id) => { handleDeleteHaInstance(id); setSelectedDriverType('homeassistant'); }}
              onToggle={handleToggleHaInstance}
              onUpdate={(id, updates) => {
                onHaInstancesChange?.(haInstances.map(i => i.id === id ? { ...i, ...updates } : i));
              }}
              onBack={() => setSelectedDriverType('homeassistant')}
              apiBase={getApiBase()}
              preloadedGaPages={instanceGaPages[selectedInstance.id]}
              preloadedDriverPoints={instanceDriverPoints[selectedInstance.id]}
            />
          );
        })()}
      </div>

      {showDiscovery && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => !authTarget && setShowDiscovery(false)}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-[480px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">HA-Instanzen im Netzwerk</h3>
                  <p className="text-xs text-slate-400">Port 8123 wird im lokalen Netzwerk gesucht</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDiscovering && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
                <button onClick={() => setShowDiscovery(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isDiscovering && discoveredHosts.length === 0 && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Suche nach Home Assistant Instanzen...</p>
                  {discoverProgress ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-500">{discoverProgress.scanned} / {discoverProgress.total} IPs geprueft</p>
                      <div className="w-48 mx-auto h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all duration-300"
                          style={{ width: `${Math.round((discoverProgress.scanned / discoverProgress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">Scanne lokales Netzwerk...</p>
                  )}
                </div>
              )}
              {isDiscovering && discoveredHosts.length > 0 && (
                <div className="flex items-center gap-2 px-1 py-2 mb-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 flex-shrink-0" />
                  <span className="text-xs text-slate-400">
                    {discoverProgress ? `${discoverProgress.scanned} / ${discoverProgress.total} gescannt` : 'Suche laeuft...'}
                  </span>
                </div>
              )}
              {!isDiscovering && discoveredHosts.length === 0 && (
                <div className="text-center py-8">
                  <Wifi className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Keine HA-Instanzen gefunden</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Stelle sicher, dass HA auf Port 8123 erreichbar ist</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleDiscoverHa}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium transition-colors"
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      Erneut scannen
                    </button>
                    <button
                      onClick={() => { setShowDiscovery(false); setShowAddHaInstance(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Manuell hinzufuegen
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {discoveredHosts.map(host => {
                  const alreadyAdded = haInstances.some(i => i.url === host.url);
                  return (
                    <div key={host.url} className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{host.name}</div>
                        <div className="text-xs text-slate-500">{host.url}</div>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Hinzugefuegt
                        </span>
                      ) : (
                        <button
                          onClick={() => { setAuthTarget(host); setAuthCredentials({ username: '', password: '' }); setAuthError(null); }}
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium whitespace-nowrap"
                        >
                          Anmelden
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isDiscovering && discoveredHosts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                  <button
                    onClick={handleDiscoverHa}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Wifi className="w-3 h-3" />
                    Erneut scannen
                  </button>
                  <button
                    onClick={() => { setShowDiscovery(false); setShowAddHaInstance(true); }}
                    className="flex items-center gap-1.5 text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Manuell hinzufuegen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {authTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-[420px] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-white">Anmelden bei HA</h3>
                <p className="text-xs text-slate-400 mt-0.5">{authTarget.name} — {authTarget.url}</p>
              </div>
              <button onClick={() => { setAuthTarget(null); setAuthError(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Authentifizierung</label>
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('credentials'); setAuthError(null); }}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${authMode === 'credentials' ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}
                  >
                    Benutzername & Passwort
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('token'); setAuthError(null); }}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${authMode === 'token' ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}
                  >
                    Long-Lived Token
                  </button>
                </div>
              </div>

              {authMode === 'credentials' ? (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Benutzername</label>
                    <input
                      type="text"
                      value={authCredentials.username}
                      onChange={(e) => setAuthCredentials(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="admin"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Passwort</label>
                    <input
                      type="password"
                      value={authCredentials.password}
                      onChange={(e) => setAuthCredentials(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500"
                      autoComplete="current-password"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAuthenticateInstance(); }}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Long-Lived Access Token</label>
                  <div className="relative">
                    <input
                      type={showTokens.has('auth-dialog') ? 'text' : 'password'}
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="eyJ..."
                      className="w-full px-3 py-2 pr-10 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 font-mono"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAuthenticateInstance(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokens(prev => {
                        const next = new Set(prev);
                        if (next.has('auth-dialog')) next.delete('auth-dialog'); else next.add('auth-dialog');
                        return next;
                      })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showTokens.has('auth-dialog') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Token aus HA Profil &gt; Sicherheit &gt; Long-Lived Access Tokens</p>
                </div>
              )}

              {authError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {authError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setAuthTarget(null); setAuthError(null); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAuthenticateInstance}
                disabled={authLoading || (authMode === 'credentials' ? (!authCredentials.username || !authCredentials.password) : !authToken)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-medium disabled:opacity-50"
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Anmelden & Hinzufuegen
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddHaInstance && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setShowAddHaInstance(false); setManualAuthError(null); }}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-[420px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">HA-Instanz hinzufuegen</h3>
              </div>
              <button onClick={() => { setShowAddHaInstance(false); setManualAuthError(null); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newHaInstance.name || ''}
                  onChange={(e) => setNewHaInstance(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="z.B. Buero HA"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">URL</label>
                <input
                  type="text"
                  value={newHaInstance.url || ''}
                  onChange={(e) => setNewHaInstance(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="http://192.168.1.x:8123"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Authentifizierung</label>
                <div className="flex rounded-lg overflow-hidden border border-slate-600">
                  <button
                    type="button"
                    onClick={() => { setManualAuthMode('credentials'); setManualAuthError(null); }}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${manualAuthMode === 'credentials' ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}
                  >
                    Benutzername & Passwort
                  </button>
                  <button
                    type="button"
                    onClick={() => { setManualAuthMode('token'); setManualAuthError(null); }}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${manualAuthMode === 'token' ? 'bg-cyan-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'}`}
                  >
                    Long-Lived Token
                  </button>
                </div>
              </div>

              {manualAuthMode === 'credentials' ? (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Benutzername</label>
                    <input
                      type="text"
                      value={manualCredentials.username}
                      onChange={(e) => setManualCredentials(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="admin"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500"
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Passwort</label>
                    <input
                      type="password"
                      value={manualCredentials.password}
                      onChange={(e) => setManualCredentials(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500"
                      autoComplete="current-password"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddHaInstance(); }}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Long-Lived Access Token</label>
                  <div className="relative">
                    <input
                      type={showTokens.has('new') ? 'text' : 'password'}
                      value={newHaInstance.token || ''}
                      onChange={(e) => setNewHaInstance(prev => ({ ...prev, token: e.target.value }))}
                      placeholder="eyJ..."
                      className="w-full px-3 py-2 pr-10 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokens(prev => {
                        const next = new Set(prev);
                        if (next.has('new')) next.delete('new'); else next.add('new');
                        return next;
                      })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showTokens.has('new') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Token aus HA Profil &gt; Sicherheit &gt; Long-Lived Access Tokens</p>
                </div>
              )}

              {manualAuthError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {manualAuthError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowAddHaInstance(false); setManualAuthError(null); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddHaInstance}
                disabled={
                  manualAuthLoading ||
                  !newHaInstance.name ||
                  !newHaInstance.url ||
                  (manualAuthMode === 'token' ? !newHaInstance.token : (!manualCredentials.username || !manualCredentials.password))
                }
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {manualAuthLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {manualAuthMode === 'credentials' ? 'Anmelden & Hinzufuegen' : 'Hinzufuegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddDevice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddDevice(false)}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-[400px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Neues Modbus Geraet</h3>
              <button onClick={() => setShowAddDevice(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  placeholder="z.B. Waermepumpe"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white placeholder-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Host/IP</label>
                  <input
                    type="text"
                    value={newDevice.host}
                    onChange={(e) => setNewDevice({ ...newDevice, host: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={newDevice.port}
                    onChange={(e) => setNewDevice({ ...newDevice, port: parseInt(e.target.value) || 502 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unit ID</label>
                  <input
                    type="number"
                    value={newDevice.unitId}
                    onChange={(e) => setNewDevice({ ...newDevice, unitId: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Poll Intervall (ms)</label>
                  <input
                    type="number"
                    value={newDevice.pollIntervalMs}
                    onChange={(e) => setNewDevice({ ...newDevice, pollIntervalMs: parseInt(e.target.value) || 1000 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowAddDevice(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddDevice}
                disabled={!newDevice.name || !newDevice.host}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hinzufuegen
              </button>
            </div>
          </div>
        </div>
      )}

      {showLibrary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowLibrary(false)}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-[700px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-white">Geraetebibliothek</h3>
                <p className="text-xs text-slate-500">Waehlen Sie ein vorkonfiguriertes Geraet</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                >
                  <Upload className="w-3 h-3" />
                  Importieren
                </button>
                {customLibrary.length > 0 && (
                  <button
                    onClick={handleExportLibrary}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                  >
                    <Download className="w-3 h-3" />
                    Exportieren
                  </button>
                )}
                <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-white ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {Object.entries(libraryByCategory).map(([category, devices]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{category}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {devices.map(device => (
                      <div
                        key={device.id}
                        className="flex items-start gap-3 p-3 bg-slate-900 hover:bg-slate-700 rounded-lg text-left transition-colors group"
                      >
                        <button
                          onClick={() => handleAddFromLibrary(device)}
                          className="flex items-start gap-3 flex-1 text-left"
                        >
                          <Server className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white text-sm">{device.model}</div>
                            <div className="text-xs text-slate-500">{device.manufacturer}</div>
                            <div className="text-xs text-slate-600 mt-1">{device.datapoints.length} Datenpunkte</div>
                          </div>
                        </button>
                        {device.isCustom && (
                          <button
                            onClick={() => handleDeleteFromLibrary(device.id)}
                            className="p-1 rounded hover:bg-red-600/40 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Aus Bibliothek loeschen"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSaveToLibrary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSaveToLibrary(null)}>
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-[400px] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">In Bibliothek speichern</h3>
              <button onClick={() => setShowSaveToLibrary(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name in Bibliothek</label>
                <input
                  type="text"
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Kategorie</label>
                <input
                  type="text"
                  value={newLibraryCategory}
                  onChange={(e) => setNewLibraryCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-white"
                />
              </div>
              <p className="text-xs text-slate-500">
                {showSaveToLibrary.datapoints.length} Datenpunkte werden gespeichert
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowSaveToLibrary(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleSaveToLibrary(showSaveToLibrary)}
                disabled={!newLibraryName}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
