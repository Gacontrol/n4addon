import React, { useState } from 'react';
import { ModbusDevice, ModbusDatapoint, FlowNode } from '../types/flow';
import { Plus, Trash2, ChevronDown, ChevronRight, Server, Settings, Library, X, Search, Wifi, WifiOff, Play, RefreshCw } from 'lucide-react';
import { modbusDeviceLibrary, ModbusDeviceTemplate, getDeviceCategories } from '../data/modbusDeviceLibrary';

interface ModbusDriverConfigProps {
  node: FlowNode;
  devices: ModbusDevice[];
  onDevicesChange: (devices: ModbusDevice[]) => void;
  onPlaceDevice: (device: ModbusDevice, type: 'input' | 'output') => void;
  onPingDevice: (deviceId: string) => void;
  deviceStatus: Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>;
}

export const ModbusDriverConfig: React.FC<ModbusDriverConfigProps> = ({
  devices,
  onDevicesChange,
  onPlaceDevice,
  onPingDevice,
  deviceStatus
}) => {
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);

  const toggleDevice = (deviceId: string) => {
    setExpandedDevices(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const addDeviceFromLibrary = (template: ModbusDeviceTemplate) => {
    const inputDps = (template.inputDatapoints || template.datapoints.filter(dp => !dp.writable)).map((dp, idx) => ({
      ...dp,
      id: `dp-in-${Date.now()}-${idx}`
    }));
    const outputDps = (template.outputDatapoints || template.datapoints.filter(dp => dp.writable)).map((dp, idx) => ({
      ...dp,
      id: `dp-out-${Date.now()}-${idx}`
    }));

    const newDevice: ModbusDevice = {
      id: `device-${Date.now()}`,
      name: template.model,
      host: '192.168.1.100',
      port: 502,
      unitId: devices.length + 1,
      templateId: template.id,
      enabled: true,
      pollInterval: 1000,
      timeout: 3000,
      datapoints: [...inputDps, ...outputDps],
      inputDatapoints: inputDps,
      outputDatapoints: outputDps
    };

    onDevicesChange([...devices, newDevice]);
    setExpandedDevices(prev => new Set(prev).add(newDevice.id));
    setShowLibrary(false);
  };

  const addEmptyDevice = () => {
    const newDevice: ModbusDevice = {
      id: `device-${Date.now()}`,
      name: `Geraet ${devices.length + 1}`,
      host: '192.168.1.100',
      port: 502,
      unitId: devices.length + 1,
      enabled: true,
      pollInterval: 1000,
      timeout: 3000,
      datapoints: [],
      inputDatapoints: [],
      outputDatapoints: []
    };
    onDevicesChange([...devices, newDevice]);
    setExpandedDevices(prev => new Set(prev).add(newDevice.id));
    setEditingDevice(newDevice.id);
  };

  const updateDevice = (deviceId: string, updates: Partial<ModbusDevice>) => {
    onDevicesChange(devices.map(d => d.id === deviceId ? { ...d, ...updates } : d));
  };

  const removeDevice = (deviceId: string) => {
    onDevicesChange(devices.filter(d => d.id !== deviceId));
  };

  const addDatapoint = (deviceId: string, isOutput: boolean) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    const newDp: ModbusDatapoint = {
      id: `dp-${Date.now()}`,
      name: isOutput ? `AO${(device.outputDatapoints?.length || 0) + 1}` : `UI${(device.inputDatapoints?.length || 0) + 1}`,
      address: 0,
      registerType: isOutput ? 'holding' : 'input',
      dataType: 'uint16',
      scale: 1,
      offset: 0,
      unit: '',
      writable: isOutput
    };

    const updatedDevice = {
      ...device,
      datapoints: [...device.datapoints, newDp],
      inputDatapoints: isOutput ? device.inputDatapoints : [...(device.inputDatapoints || []), newDp],
      outputDatapoints: isOutput ? [...(device.outputDatapoints || []), newDp] : device.outputDatapoints
    };

    onDevicesChange(devices.map(d => d.id === deviceId ? updatedDevice : d));
  };

  const updateDatapoint = (deviceId: string, dpId: string, updates: Partial<ModbusDatapoint>) => {
    onDevicesChange(devices.map(d => {
      if (d.id !== deviceId) return d;
      const updateDpList = (list: ModbusDatapoint[] | undefined) =>
        list?.map(dp => dp.id === dpId ? { ...dp, ...updates } : dp);
      return {
        ...d,
        datapoints: d.datapoints.map(dp => dp.id === dpId ? { ...dp, ...updates } : dp),
        inputDatapoints: updateDpList(d.inputDatapoints),
        outputDatapoints: updateDpList(d.outputDatapoints)
      };
    }));
  };

  const removeDatapoint = (deviceId: string, dpId: string) => {
    onDevicesChange(devices.map(d => {
      if (d.id !== deviceId) return d;
      return {
        ...d,
        datapoints: d.datapoints.filter(dp => dp.id !== dpId),
        inputDatapoints: d.inputDatapoints?.filter(dp => dp.id !== dpId),
        outputDatapoints: d.outputDatapoints?.filter(dp => dp.id !== dpId)
      };
    }));
  };

  const categories = getDeviceCategories();
  const filteredLibrary = modbusDeviceLibrary.filter(template => {
    const matchesSearch = librarySearch === '' ||
      template.model.toLowerCase().includes(librarySearch.toLowerCase()) ||
      template.manufacturer.toLowerCase().includes(librarySearch.toLowerCase());
    const matchesCategory = selectedCategory === null || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const registerTypes = [
    { value: 'coil', label: 'Coil (0xxxx)' },
    { value: 'discrete', label: 'Discrete (1xxxx)' },
    { value: 'input', label: 'Input (3xxxx)' },
    { value: 'holding', label: 'Holding (4xxxx)' }
  ];

  const dataTypes = [
    { value: 'bool', label: 'Boolean' },
    { value: 'int16', label: 'Int16' },
    { value: 'uint16', label: 'UInt16' },
    { value: 'int32', label: 'Int32' },
    { value: 'uint32', label: 'UInt32' },
    { value: 'float32', label: 'Float32' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-emerald-400">
        <Server className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Modbus Treiber</span>
      </div>

      <div className="bg-slate-700/20 rounded-lg p-2 text-[10px] text-emerald-400">
        Treiber ist aktiv. Geraete unten konfigurieren und auf Wiresheet platzieren.
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400 font-medium">Geraete ({devices.length})</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowLibrary(true)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-300 rounded text-xs transition-colors"
            >
              <Library className="w-3 h-3" /> Bibliothek
            </button>
            <button
              onClick={addEmptyDevice}
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-600/30 text-emerald-300 rounded text-xs transition-colors"
            >
              <Plus className="w-3 h-3" /> Leer
            </button>
          </div>
        </div>

        {devices.length === 0 && (
          <div className="text-center py-6 bg-slate-700/20 rounded-lg border border-dashed border-slate-600">
            <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Keine Geraete konfiguriert</p>
            <p className="text-[10px] text-slate-600 mt-1">Klicke "Bibliothek" um ein Geraet hinzuzufuegen</p>
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {devices.map(device => {
            const isExpanded = expandedDevices.has(device.id);
            const status = deviceStatus[device.id] || { online: false };
            const isEditing = editingDevice === device.id;

            return (
              <div key={device.id} className="bg-slate-700/40 rounded-lg overflow-hidden border border-slate-600/50">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50">
                  <button
                    onClick={() => toggleDevice(device.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className={`w-2.5 h-2.5 rounded-full ${status.online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />

                  <span className="flex-1 text-xs text-white font-medium truncate">{device.name}</span>

                  <span className="text-[10px] text-slate-400 font-mono">{device.host}:{device.port}</span>

                  <button
                    onClick={() => onPingDevice(device.id)}
                    disabled={status.pinging}
                    className={`p-1 rounded transition-colors ${status.pinging ? 'text-yellow-400 animate-spin' : 'text-slate-400 hover:text-emerald-400'}`}
                    title="Ping"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setEditingDevice(isEditing ? null : device.id)}
                    className={`p-1 rounded transition-colors ${isEditing ? 'text-blue-400' : 'text-slate-400 hover:text-blue-400'}`}
                    title="Bearbeiten"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => removeDevice(device.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Loeschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-2 space-y-3 bg-slate-800/30">
                    {isEditing && (
                      <div className="bg-slate-700/30 rounded p-2 space-y-2 border border-blue-500/30">
                        <div className="text-[10px] text-blue-400 font-medium uppercase">Geraete-Konfiguration</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Name</label>
                            <input
                              type="text"
                              value={device.name}
                              onChange={e => updateDevice(device.id, { name: e.target.value })}
                              className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Unit ID</label>
                            <input
                              type="number"
                              min={1}
                              max={247}
                              value={device.unitId}
                              onChange={e => updateDevice(device.id, { unitId: parseInt(e.target.value) || 1 })}
                              className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Host / IP</label>
                            <input
                              type="text"
                              value={device.host}
                              onChange={e => updateDevice(device.id, { host: e.target.value })}
                              placeholder="192.168.1.100"
                              className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Port</label>
                            <input
                              type="number"
                              value={device.port}
                              onChange={e => updateDevice(device.id, { port: parseInt(e.target.value) || 502 })}
                              className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Poll-Intervall (ms)</label>
                            <input
                              type="number"
                              min={100}
                              value={device.pollInterval || 1000}
                              onChange={e => updateDevice(device.id, { pollInterval: parseInt(e.target.value) || 1000 })}
                              className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Timeout (ms)</label>
                            <input
                              type="number"
                              min={500}
                              value={device.timeout || 3000}
                              onChange={e => updateDevice(device.id, { timeout: parseInt(e.target.value) || 3000 })}
                              className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPlaceDevice(device, 'input')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-600/30 text-cyan-300 rounded text-xs transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Eingaenge platzieren ({device.inputDatapoints?.length || 0})
                      </button>
                      <button
                        onClick={() => onPlaceDevice(device, 'output')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-300 rounded text-xs transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Ausgaenge platzieren ({device.outputDatapoints?.length || 0})
                      </button>
                    </div>

                    {isEditing && (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-cyan-400 uppercase tracking-wider">Eingaenge</span>
                            <button
                              onClick={() => addDatapoint(device.id, false)}
                              className="text-[10px] text-cyan-300 hover:text-cyan-200"
                            >
                              + Hinzufuegen
                            </button>
                          </div>
                          {device.inputDatapoints?.map(dp => (
                            <DatapointRow
                              key={dp.id}
                              dp={dp}
                              onUpdate={(updates) => updateDatapoint(device.id, dp.id, updates)}
                              onRemove={() => removeDatapoint(device.id, dp.id)}
                              registerTypes={registerTypes}
                              dataTypes={dataTypes}
                            />
                          ))}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-red-400 uppercase tracking-wider">Ausgaenge</span>
                            <button
                              onClick={() => addDatapoint(device.id, true)}
                              className="text-[10px] text-red-300 hover:text-red-200"
                            >
                              + Hinzufuegen
                            </button>
                          </div>
                          {device.outputDatapoints?.map(dp => (
                            <DatapointRow
                              key={dp.id}
                              dp={dp}
                              onUpdate={(updates) => updateDatapoint(device.id, dp.id, updates)}
                              onRemove={() => removeDatapoint(device.id, dp.id)}
                              registerTypes={registerTypes}
                              dataTypes={dataTypes}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showLibrary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowLibrary(false)}>
          <div
            className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Library className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Geraete-Bibliothek</h3>
              </div>
              <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-700 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                  placeholder="Suchen..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2 py-1 text-[10px] rounded ${selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                  Alle
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 text-[10px] rounded ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredLibrary.map(template => (
                <div
                  key={template.id}
                  className="bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-emerald-500/50 rounded-lg p-3 cursor-pointer transition-all"
                  onClick={() => addDeviceFromLibrary(template)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-semibold text-white truncate">{template.model}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{template.manufacturer}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{template.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] text-slate-500 bg-slate-600/50 px-1.5 py-0.5 rounded">{template.category}</span>
                      <div className="mt-1 text-[10px]">
                        <span className="text-cyan-400">{template.inputDatapoints?.length || template.datapoints.filter(d => !d.writable).length} IN</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-red-400">{template.outputDatapoints?.length || template.datapoints.filter(d => d.writable).length} OUT</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DatapointRowProps {
  dp: ModbusDatapoint;
  onUpdate: (updates: Partial<ModbusDatapoint>) => void;
  onRemove: () => void;
  registerTypes: { value: string; label: string }[];
  dataTypes: { value: string; label: string }[];
}

const DatapointRow: React.FC<DatapointRowProps> = ({ dp, onUpdate, onRemove, registerTypes, dataTypes }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-700/50 rounded border border-slate-600/30">
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-600/30"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs text-white flex-1 truncate">{dp.name}</span>
        <span className="text-[10px] text-slate-500 font-mono">{dp.registerType}:{dp.address}</span>
        {dp.bitIndex !== undefined && <span className="text-[10px] text-yellow-400">bit:{dp.bitIndex}</span>}
        <span className="text-[10px] text-slate-500">{dp.dataType}</span>
        {dp.unit && <span className="text-[10px] text-slate-400">{dp.unit}</span>}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-slate-500 hover:text-red-400 p-0.5"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 pt-1 space-y-2 border-t border-slate-600/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={dp.name}
                onChange={e => onUpdate({ name: e.target.value })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Adresse</label>
              <input
                type="number"
                value={dp.address}
                onChange={e => onUpdate({ address: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Register</label>
              <select
                value={dp.registerType}
                onChange={e => onUpdate({ registerType: e.target.value as ModbusDatapoint['registerType'] })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-1 py-1 text-[10px] text-white outline-none"
              >
                {registerTypes.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Datentyp</label>
              <select
                value={dp.dataType}
                onChange={e => onUpdate({ dataType: e.target.value as ModbusDatapoint['dataType'] })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-1 py-1 text-[10px] text-white outline-none"
              >
                {dataTypes.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Bit-Index</label>
              <input
                type="number"
                min={-1}
                max={15}
                value={dp.bitIndex ?? -1}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  onUpdate({ bitIndex: v >= 0 ? v : undefined });
                }}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Skalierung</label>
              <input
                type="number"
                step="any"
                value={dp.scale ?? 1}
                onChange={e => onUpdate({ scale: parseFloat(e.target.value) || 1 })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Offset</label>
              <input
                type="number"
                step="any"
                value={dp.offset ?? 0}
                onChange={e => onUpdate({ offset: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">Einheit</label>
              <input
                type="text"
                value={dp.unit || ''}
                onChange={e => onUpdate({ unit: e.target.value })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ModbusDeviceBlockConfigProps {
  node: FlowNode;
  deviceName: string;
  datapoints: ModbusDatapoint[];
}

export const ModbusDeviceBlockConfig: React.FC<ModbusDeviceBlockConfigProps> = ({
  node,
  deviceName,
  datapoints
}) => {
  const isInput = node.type === 'modbus-device-input';

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 ${isInput ? 'text-cyan-400' : 'text-red-400'}`}>
        <Server className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {isInput ? 'Modbus Eingaenge' : 'Modbus Ausgaenge'}
        </span>
      </div>

      <div className="bg-slate-700/30 rounded-lg p-3">
        <div className="text-xs text-white font-medium">{deviceName}</div>
        <div className="text-[10px] text-slate-400 mt-1">{datapoints.length} Datenpunkte</div>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Datenpunkte</div>
        {datapoints.map(dp => (
          <div key={dp.id} className="bg-slate-700/50 rounded px-2 py-1.5 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isInput ? 'bg-cyan-400' : 'bg-red-400'}`} />
            <span className="text-xs text-white flex-1">{dp.name}</span>
            <span className="text-[10px] text-slate-500 font-mono">{dp.address}</span>
            {dp.unit && <span className="text-[10px] text-slate-400">{dp.unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
