import React, { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, Settings, ChevronRight, ChevronDown, Server, Database, ToggleLeft, ToggleRight, Copy, X, Check, Network, RefreshCw, Edit2, Save, Download, Upload, BookmarkPlus } from 'lucide-react';
import { ModbusDevice, ModbusDatapoint } from '../types/flow';
import { modbusDeviceLibrary, ModbusDeviceTemplate } from '../data/modbusDeviceLibrary';

type DriverType = 'modbus-tcp';

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
}

const REGISTER_TYPES = ['holding', 'input', 'coil', 'discrete'] as const;
const DATA_TYPES = ['int16', 'uint16', 'int32', 'uint32', 'float32', 'bool'] as const;

export const DriversView: React.FC<DriversViewProps> = ({
  modbusDevices,
  modbusDriverEnabled,
  onModbusDevicesChange,
  onModbusDriverEnabledChange,
  modbusDeviceStatus,
  onPingDevice,
  modbusValues = {}
}) => {
  const [selectedDriverType, setSelectedDriverType] = useState<DriverType | null>('modbus-tcp');
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

  const renderDatapointRow = (device: ModbusDevice, dp: ModbusDatapoint, isOutput: boolean) => {
    const isEditing = editingDatapoint === dp.id;
    const deviceValues = modbusValues[device.id] || {};
    const liveValue = deviceValues[dp.id];

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
        <div className="flex-1 p-3">
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
                    const inputDatapoints = device.datapoints.filter(dp => !dp.writable);
                    const outputDatapoints = device.datapoints.filter(dp => dp.writable);

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
      </div>

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
