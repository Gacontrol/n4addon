import React, { useState } from 'react';
import { ModbusDevice, ModbusDatapoint } from '../types/flow';
import { Plus, Trash2, ChevronDown, ChevronRight, Server, Database, Settings, Copy } from 'lucide-react';

interface ModbusConfigProps {
  host: string;
  port: number;
  devices: ModbusDevice[];
  pollInterval: number;
  timeout: number;
  onHostChange: (host: string) => void;
  onPortChange: (port: number) => void;
  onDevicesChange: (devices: ModbusDevice[]) => void;
  onPollIntervalChange: (interval: number) => void;
  onTimeoutChange: (timeout: number) => void;
  onOutputsChange: (outputs: Array<{ id: string; label: string; type: 'output' }>) => void;
  onInputsChange: (inputs: Array<{ id: string; label: string; type: 'input' }>) => void;
}

export const ModbusConfig: React.FC<ModbusConfigProps> = ({
  host,
  port,
  devices,
  pollInterval,
  timeout,
  onHostChange,
  onPortChange,
  onDevicesChange,
  onPollIntervalChange,
  onTimeoutChange,
  onOutputsChange,
  onInputsChange
}) => {
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [editingDatapoint, setEditingDatapoint] = useState<{ deviceId: string; dpId: string } | null>(null);

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

  const addDevice = () => {
    const newDevice: ModbusDevice = {
      id: `device-${Date.now()}`,
      name: `Geraet ${devices.length + 1}`,
      unitId: devices.length + 1,
      datapoints: []
    };
    const updated = [...devices, newDevice];
    onDevicesChange(updated);
    setExpandedDevices(prev => new Set(prev).add(newDevice.id));
  };

  const updateDevice = (deviceId: string, updates: Partial<ModbusDevice>) => {
    const updated = devices.map(d => d.id === deviceId ? { ...d, ...updates } : d);
    onDevicesChange(updated);
    updateNodePorts(updated);
  };

  const removeDevice = (deviceId: string) => {
    const updated = devices.filter(d => d.id !== deviceId);
    onDevicesChange(updated);
    updateNodePorts(updated);
  };

  const addDatapoint = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    const newDp: ModbusDatapoint = {
      id: `dp-${Date.now()}`,
      name: `Datenpunkt ${device.datapoints.length + 1}`,
      address: 0,
      registerType: 'holding',
      dataType: 'uint16',
      scale: 1,
      offset: 0,
      unit: '',
      writable: false
    };

    const updatedDevice = { ...device, datapoints: [...device.datapoints, newDp] };
    const updated = devices.map(d => d.id === deviceId ? updatedDevice : d);
    onDevicesChange(updated);
    updateNodePorts(updated);
    setEditingDatapoint({ deviceId, dpId: newDp.id });
  };

  const updateDatapoint = (deviceId: string, dpId: string, updates: Partial<ModbusDatapoint>) => {
    const updated = devices.map(d => {
      if (d.id !== deviceId) return d;
      return {
        ...d,
        datapoints: d.datapoints.map(dp => dp.id === dpId ? { ...dp, ...updates } : dp)
      };
    });
    onDevicesChange(updated);
    updateNodePorts(updated);
  };

  const removeDatapoint = (deviceId: string, dpId: string) => {
    const updated = devices.map(d => {
      if (d.id !== deviceId) return d;
      return { ...d, datapoints: d.datapoints.filter(dp => dp.id !== dpId) };
    });
    onDevicesChange(updated);
    updateNodePorts(updated);
  };

  const duplicateDatapoint = (deviceId: string, dpId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;
    const dp = device.datapoints.find(p => p.id === dpId);
    if (!dp) return;

    const newDp: ModbusDatapoint = {
      ...dp,
      id: `dp-${Date.now()}`,
      name: `${dp.name} (Kopie)`,
      address: dp.address + 1
    };

    const updatedDevice = { ...device, datapoints: [...device.datapoints, newDp] };
    const updated = devices.map(d => d.id === deviceId ? updatedDevice : d);
    onDevicesChange(updated);
    updateNodePorts(updated);
  };

  const updateNodePorts = (deviceList: ModbusDevice[]) => {
    const outputs: Array<{ id: string; label: string; type: 'output' }> = [];
    const inputs: Array<{ id: string; label: string; type: 'input' }> = [];

    deviceList.forEach(device => {
      device.datapoints.forEach(dp => {
        const portId = `${device.id}-${dp.id}`;
        const label = `${device.name}/${dp.name}`;
        outputs.push({ id: portId, label, type: 'output' });
        if (dp.writable) {
          inputs.push({ id: `write-${portId}`, label: `${label} (Schreiben)`, type: 'input' });
        }
      });
    });

    onOutputsChange(outputs);
    onInputsChange(inputs);
  };

  const registerTypes = [
    { value: 'coil', label: 'Coil (0xxxx)' },
    { value: 'discrete', label: 'Discrete Input (1xxxx)' },
    { value: 'input', label: 'Input Register (3xxxx)' },
    { value: 'holding', label: 'Holding Register (4xxxx)' }
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
        <span className="text-xs font-semibold uppercase tracking-wider">Modbus TCP Treiber</span>
      </div>

      <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
        <label className="block text-xs text-slate-400 font-medium">Verbindung</label>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-500 mb-1">Host / IP</label>
            <input
              type="text"
              value={host}
              onChange={e => onHostChange(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={e => onPortChange(parseInt(e.target.value) || 502)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Poll-Intervall (ms)</label>
            <input
              type="number"
              min={100}
              step={100}
              value={pollInterval}
              onChange={e => onPollIntervalChange(parseInt(e.target.value) || 1000)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Timeout (ms)</label>
            <input
              type="number"
              min={500}
              step={500}
              value={timeout}
              onChange={e => onTimeoutChange(parseInt(e.target.value) || 3000)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            Geraete ({devices.length})
          </label>
          <button
            onClick={addDevice}
            className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-600/30 text-emerald-300 rounded text-xs transition-colors"
          >
            <Plus className="w-3 h-3" /> Geraet
          </button>
        </div>

        {devices.length === 0 && (
          <div className="text-center py-6 bg-slate-700/20 rounded-lg border border-dashed border-slate-600">
            <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Keine Geraete konfiguriert</p>
            <p className="text-[10px] text-slate-600 mt-1">Klicke "+ Geraet" um ein Modbus-Geraet hinzuzufuegen</p>
          </div>
        )}

        <div className="space-y-2">
          {devices.map(device => {
            const isExpanded = expandedDevices.has(device.id);
            return (
              <div key={device.id} className="bg-slate-700/40 rounded-lg overflow-hidden border border-slate-600/50">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50">
                  <button
                    onClick={() => toggleDevice(device.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <Server className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={device.name}
                    onChange={e => updateDevice(device.id, { name: e.target.value })}
                    className="flex-1 bg-transparent text-xs text-white outline-none focus:bg-slate-600/50 px-1 py-0.5 rounded"
                  />
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span>Unit ID:</span>
                    <input
                      type="number"
                      min={1}
                      max={247}
                      value={device.unitId}
                      onChange={e => updateDevice(device.id, { unitId: parseInt(e.target.value) || 1 })}
                      className="w-12 bg-slate-600 border border-slate-500 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-emerald-500 text-center"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 bg-slate-600/50 px-1.5 py-0.5 rounded">
                    {device.datapoints.length} DP
                  </span>
                  <button
                    onClick={() => removeDevice(device.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Geraet loeschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-2 space-y-2 bg-slate-800/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Datenpunkte</span>
                      <button
                        onClick={() => addDatapoint(device.id)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-300 rounded text-[10px] transition-colors"
                      >
                        <Plus className="w-2.5 h-2.5" /> Datenpunkt
                      </button>
                    </div>

                    {device.datapoints.length === 0 && (
                      <p className="text-[10px] text-slate-500 text-center py-3">Keine Datenpunkte</p>
                    )}

                    <div className="space-y-1">
                      {device.datapoints.map(dp => {
                        const isEditing = editingDatapoint?.deviceId === device.id && editingDatapoint?.dpId === dp.id;
                        return (
                          <div key={dp.id} className="bg-slate-700/50 rounded border border-slate-600/30">
                            <div
                              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-600/30 transition-colors"
                              onClick={() => setEditingDatapoint(isEditing ? null : { deviceId: device.id, dpId: dp.id })}
                            >
                              <div className={`w-2 h-2 rounded-full ${dp.writable ? 'bg-orange-400' : 'bg-emerald-400'}`} />
                              <span className="text-xs text-white flex-1 truncate">{dp.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{dp.registerType}:{dp.address}</span>
                              <span className="text-[10px] text-slate-500">{dp.dataType}</span>
                              {dp.unit && <span className="text-[10px] text-slate-400">{dp.unit}</span>}
                              <button
                                onClick={(e) => { e.stopPropagation(); duplicateDatapoint(device.id, dp.id); }}
                                className="text-slate-500 hover:text-blue-400 transition-colors p-0.5"
                                title="Duplizieren"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeDatapoint(device.id, dp.id); }}
                                className="text-slate-500 hover:text-red-400 transition-colors p-0.5"
                                title="Loeschen"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {isEditing && (
                              <div className="px-2 pb-2 pt-1 space-y-2 border-t border-slate-600/30">
                                <div>
                                  <label className="block text-[10px] text-slate-500 mb-1">Name</label>
                                  <input
                                    type="text"
                                    value={dp.name}
                                    onChange={e => updateDatapoint(device.id, dp.id, { name: e.target.value })}
                                    className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Register-Typ</label>
                                    <select
                                      value={dp.registerType}
                                      onChange={e => updateDatapoint(device.id, dp.id, { registerType: e.target.value as ModbusDatapoint['registerType'] })}
                                      className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                    >
                                      {registerTypes.map(rt => (
                                        <option key={rt.value} value={rt.value}>{rt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Adresse</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={65535}
                                      value={dp.address}
                                      onChange={e => updateDatapoint(device.id, dp.id, { address: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 font-mono"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Datentyp</label>
                                    <select
                                      value={dp.dataType}
                                      onChange={e => updateDatapoint(device.id, dp.id, { dataType: e.target.value as ModbusDatapoint['dataType'] })}
                                      className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                    >
                                      {dataTypes.map(dt => (
                                        <option key={dt.value} value={dt.value}>{dt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Einheit</label>
                                    <input
                                      type="text"
                                      value={dp.unit || ''}
                                      onChange={e => updateDatapoint(device.id, dp.id, { unit: e.target.value })}
                                      placeholder="z.B. °C, %, kW"
                                      className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 placeholder-slate-500"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Skalierung</label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={dp.scale ?? 1}
                                      onChange={e => updateDatapoint(device.id, dp.id, { scale: parseFloat(e.target.value) || 1 })}
                                      className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 mb-1">Offset</label>
                                    <input
                                      type="number"
                                      step="any"
                                      value={dp.offset ?? 0}
                                      onChange={e => updateDatapoint(device.id, dp.id, { offset: parseFloat(e.target.value) || 0 })}
                                      className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-600/30 rounded">
                                  <span className="text-[10px] text-slate-300">Schreibbar</span>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={dp.writable}
                                      onChange={e => updateDatapoint(device.id, dp.id, { writable: e.target.checked })}
                                      className="sr-only peer"
                                    />
                                    <div className="w-8 h-4 bg-slate-500 rounded-full peer peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
                                  </label>
                                </div>

                                <p className="text-[9px] text-slate-500">
                                  Wert = (Rohwert * Skalierung) + Offset
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-700/20 rounded-lg p-2 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Settings className="w-3 h-3" />
          <span>Hinweise</span>
        </div>
        <ul className="text-[9px] text-slate-500 space-y-0.5 pl-4">
          <li>Coil/Discrete = Boolean-Werte</li>
          <li>Holding/Input Register = Numerische Werte</li>
          <li>32-Bit Typen belegen 2 Register (Big Endian)</li>
          <li>Jeder Datenpunkt erscheint als Ausgangs-Port</li>
          <li>Schreibbare Datenpunkte haben zusaetzlich Eingangs-Ports</li>
        </ul>
      </div>
    </div>
  );
};
