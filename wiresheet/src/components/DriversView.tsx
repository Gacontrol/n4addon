import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Settings, ChevronRight, ChevronDown, Server, Database, ToggleLeft, ToggleRight, Copy, Edit2, X, Check, Network, AlertCircle, RefreshCw } from 'lucide-react';
import { ModbusDevice } from '../types/flow';
import { modbusDeviceLibrary, ModbusDeviceTemplate } from '../data/modbusDeviceLibrary';

type DriverType = 'modbus-tcp';

interface DriversViewProps {
  modbusDevices: ModbusDevice[];
  modbusDriverEnabled: boolean;
  onModbusDevicesChange: (devices: ModbusDevice[]) => void;
  onModbusDriverEnabledChange: (enabled: boolean) => void;
  modbusDeviceStatus: Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>;
  onPingDevice: (deviceId: string) => void;
}

export const DriversView: React.FC<DriversViewProps> = ({
  modbusDevices,
  modbusDriverEnabled,
  onModbusDevicesChange,
  onModbusDriverEnabledChange,
  modbusDeviceStatus,
  onPingDevice
}) => {
  const [selectedDriverType, setSelectedDriverType] = useState<DriverType | null>('modbus-tcp');
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
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
      datapoints: newDevice.datapoints || []
    };
    onModbusDevicesChange([...modbusDevices, device]);
    setNewDevice({ name: '', host: '192.168.1.100', port: 502, unitId: 1, pollIntervalMs: 1000, datapoints: [] });
    setShowAddDevice(false);
  }, [newDevice, modbusDevices, onModbusDevicesChange]);

  const handleAddFromLibrary = useCallback((template: ModbusDeviceTemplate) => {
    const device: ModbusDevice = {
      id: `modbus-device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: template.name,
      host: '192.168.1.100',
      port: 502,
      unitId: 1,
      pollIntervalMs: 1000,
      datapoints: template.datapoints.map(dp => ({
        ...dp,
        id: `dp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })),
      configDatapoints: template.configDatapoints?.map(dp => ({
        ...dp,
        id: `cfg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }))
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
      datapoints: device.datapoints.map(dp => ({
        ...dp,
        id: `dp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }))
    };
    onModbusDevicesChange([...modbusDevices, newDev]);
  }, [modbusDevices, onModbusDevicesChange]);

  const handleAddDatapoint = useCallback((deviceId: string) => {
    const device = modbusDevices.find(d => d.id === deviceId);
    if (!device) return;
    const newDp = {
      id: `dp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Datenpunkt ${device.datapoints.length + 1}`,
      address: 0,
      registerType: 'holding' as const,
      dataType: 'int16' as const,
      scale: 1,
      unit: '',
      isOutput: false
    };
    handleUpdateDevice(deviceId, { datapoints: [...device.datapoints, newDp] });
  }, [modbusDevices, handleUpdateDevice]);

  const handleUpdateDatapoint = useCallback((deviceId: string, datapointId: string, updates: Partial<ModbusDevice['datapoints'][0]>) => {
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
  }, [modbusDevices, handleUpdateDevice]);

  return (
    <div className="flex h-full">
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
                    const inputDatapoints = device.datapoints.filter(dp => !dp.isOutput);
                    const outputDatapoints = device.datapoints.filter(dp => dp.isOutput);

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
                                    {inputDatapoints.map(dp => (
                                      <div key={dp.id} className="flex items-center gap-2 text-xs bg-slate-900 rounded px-2 py-1.5">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className="text-white flex-1">{dp.name}</span>
                                        <span className="text-slate-500">{dp.registerType}[{dp.address}]</span>
                                        <span className="text-slate-500">{dp.dataType}</span>
                                        {dp.unit && <span className="text-slate-500">{dp.unit}</span>}
                                      </div>
                                    ))}
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
                                    {outputDatapoints.map(dp => (
                                      <div key={dp.id} className="flex items-center gap-2 text-xs bg-slate-900 rounded px-2 py-1.5">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span className="text-white flex-1">{dp.name}</span>
                                        <span className="text-slate-500">{dp.registerType}[{dp.address}]</span>
                                        <span className="text-slate-500">{dp.dataType}</span>
                                        {dp.unit && <span className="text-slate-500">{dp.unit}</span>}
                                      </div>
                                    ))}
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
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-white">Geraetebibliothek</h3>
                <p className="text-xs text-slate-500">Waehlen Sie ein vorkonfiguriertes Geraet</p>
              </div>
              <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {Object.entries(
                modbusDeviceLibrary.reduce((acc, device) => {
                  const cat = device.category || 'Sonstiges';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(device);
                  return acc;
                }, {} as Record<string, ModbusDeviceTemplate[]>)
              ).map(([category, devices]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{category}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {devices.map(device => (
                      <button
                        key={device.id}
                        onClick={() => handleAddFromLibrary(device)}
                        className="flex items-start gap-3 p-3 bg-slate-900 hover:bg-slate-700 rounded-lg text-left transition-colors"
                      >
                        <Server className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm">{device.name}</div>
                          <div className="text-xs text-slate-500">{device.manufacturer}</div>
                          <div className="text-xs text-slate-600 mt-1">{device.datapoints.length} Datenpunkte</div>
                        </div>
                      </button>
                    ))}
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
