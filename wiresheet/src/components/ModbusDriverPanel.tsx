import React, { useState, useCallback } from 'react';
import { ModbusDevice, ModbusDatapoint, NodeTemplate, FlowNode } from '../types/flow';
import {
  Server, ChevronDown, ChevronRight, Settings, Library, X, Search,
  Radio, Power, PowerOff, ArrowDownToLine, ArrowUpFromLine,
  GripVertical, Trash2, Plus, Save, RotateCcw, Sliders, Link2, RefreshCw,
  Download, Upload, AlertCircle
} from 'lucide-react';
import { modbusDeviceLibrary, ModbusDeviceTemplate, getDeviceCategories } from '../data/modbusDeviceLibrary';

interface ModbusDriverPanelProps {
  devices: ModbusDevice[];
  driverEnabled: boolean;
  onDriverEnabledChange: (enabled: boolean) => void;
  onDevicesChange: (devices: ModbusDevice[]) => void;
  onDatapointDragStart: (device: ModbusDevice, datapoint: ModbusDatapoint, isOutput: boolean) => void;
  onPingDevice: (deviceId: string) => void;
  deviceStatus: Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>;
  selectedDatapointPath?: { deviceId: string; datapointId: string } | null;
  allNodes?: FlowNode[];
  onReadConfigValue?: (deviceId: string, datapointId: string) => void;
  onWriteConfigValue?: (deviceId: string, datapointId: string, value: number | string | boolean) => void;
}

type ViewLevel = 'driver' | 'device' | 'datapoint';

interface NavigationState {
  level: ViewLevel;
  deviceId?: string;
  datapointId?: string;
  isOutput?: boolean;
}

const registerTypes = [
  { value: 'coil', label: 'Coil (0xxxx)', desc: 'Digitale Ausgaenge' },
  { value: 'discrete', label: 'Discrete (1xxxx)', desc: 'Digitale Eingaenge' },
  { value: 'input', label: 'Input (3xxxx)', desc: 'Analoge Eingaenge' },
  { value: 'holding', label: 'Holding (4xxxx)', desc: 'Analoge Ausgaenge' }
];

const dataTypes = [
  { value: 'bool', label: 'Boolean' },
  { value: 'int16', label: 'Int16' },
  { value: 'uint16', label: 'UInt16' },
  { value: 'int32', label: 'Int32' },
  { value: 'uint32', label: 'UInt32' },
  { value: 'float32', label: 'Float32' }
];

interface DatapointEditFormProps {
  deviceId: string;
  datapoint: ModbusDatapoint;
  registerTypes: { value: string; label: string; desc: string }[];
  dataTypes: { value: string; label: string }[];
  onUpdate: (deviceId: string, dpId: string, updates: Partial<ModbusDatapoint>) => void;
}

const DatapointEditForm: React.FC<DatapointEditFormProps> = ({
  deviceId,
  datapoint,
  registerTypes,
  dataTypes,
  onUpdate
}) => {
  const [localName, setLocalName] = useState(datapoint.name);
  const [localUnit, setLocalUnit] = useState(datapoint.unit || '');
  const [localAddress, setLocalAddress] = useState(String(datapoint.address));
  const [localBitIndex, setLocalBitIndex] = useState(String(datapoint.bitIndex ?? -1));
  const [localScale, setLocalScale] = useState(String(datapoint.scale || 1));
  const [localOffset, setLocalOffset] = useState(String(datapoint.offset || 0));

  React.useEffect(() => {
    setLocalName(datapoint.name);
    setLocalUnit(datapoint.unit || '');
    setLocalAddress(String(datapoint.address));
    setLocalBitIndex(String(datapoint.bitIndex ?? -1));
    setLocalScale(String(datapoint.scale || 1));
    setLocalOffset(String(datapoint.offset || 0));
  }, [datapoint.id]);

  const handleNameBlur = () => {
    if (localName !== datapoint.name) {
      onUpdate(deviceId, datapoint.id, { name: localName });
    }
  };

  const handleUnitBlur = () => {
    if (localUnit !== (datapoint.unit || '')) {
      onUpdate(deviceId, datapoint.id, { unit: localUnit });
    }
  };

  const handleAddressBlur = () => {
    const val = parseInt(localAddress) || 0;
    if (val !== datapoint.address) {
      onUpdate(deviceId, datapoint.id, { address: val });
    }
  };

  const handleBitIndexBlur = () => {
    const val = parseInt(localBitIndex);
    const newBitIndex = val >= 0 ? val : undefined;
    if (newBitIndex !== datapoint.bitIndex) {
      onUpdate(deviceId, datapoint.id, { bitIndex: newBitIndex });
    }
  };

  const handleScaleBlur = () => {
    const val = parseFloat(localScale) || 1;
    if (val !== datapoint.scale) {
      onUpdate(deviceId, datapoint.id, { scale: val });
    }
  };

  const handleOffsetBlur = () => {
    const val = parseFloat(localOffset) || 0;
    if (val !== datapoint.offset) {
      onUpdate(deviceId, datapoint.id, { offset: val });
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Name</label>
          <input
            type="text"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={handleNameBlur}
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Einheit</label>
          <input
            type="text"
            value={localUnit}
            onChange={e => setLocalUnit(e.target.value)}
            onBlur={handleUnitBlur}
            placeholder="z.B. degC, %"
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-slate-400 mb-1">Register-Typ</label>
        <select
          value={datapoint.registerType}
          onChange={e => onUpdate(deviceId, datapoint.id, { registerType: e.target.value as ModbusDatapoint['registerType'] })}
          className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
        >
          {registerTypes.map(rt => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Register-Adresse</label>
          <input
            type="number"
            min={0}
            value={localAddress}
            onChange={e => setLocalAddress(e.target.value)}
            onBlur={handleAddressBlur}
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Datentyp</label>
          <select
            value={datapoint.dataType}
            onChange={e => onUpdate(deviceId, datapoint.id, { dataType: e.target.value as ModbusDatapoint['dataType'] })}
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          >
            {dataTypes.map(dt => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {(datapoint.registerType === 'holding' || datapoint.registerType === 'input') && (
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Bit-Index (optional, fuer Digital I/O)</label>
          <input
            type="number"
            min={-1}
            max={15}
            value={localBitIndex}
            onChange={e => setLocalBitIndex(e.target.value)}
            onBlur={handleBitIndexBlur}
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-blue-500"
          />
          <p className="text-[9px] text-slate-500 mt-1">-1 = kein Bit-Zugriff, 0-15 = Bit-Position im Register</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Skalierung (Faktor)</label>
          <input
            type="number"
            step="0.001"
            value={localScale}
            onChange={e => setLocalScale(e.target.value)}
            onBlur={handleScaleBlur}
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
          <p className="text-[9px] text-slate-500 mt-0.5">Wert = Register * Faktor</p>
        </div>
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Offset</label>
          <input
            type="number"
            step="0.1"
            value={localOffset}
            onChange={e => setLocalOffset(e.target.value)}
            onBlur={handleOffsetBlur}
            className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
          <p className="text-[9px] text-slate-500 mt-0.5">Wert = (Register * Faktor) + Offset</p>
        </div>
      </div>
    </>
  );
};

interface ConfigDatapointRowProps {
  deviceId: string;
  datapoint: ModbusDatapoint;
  onUpdate: (deviceId: string, dpId: string, value: number | string | boolean) => void;
  onRead?: (deviceId: string, dpId: string) => void;
}

const ConfigDatapointRow: React.FC<ConfigDatapointRowProps> = ({
  deviceId,
  datapoint,
  onUpdate,
  onRead
}) => {
  const [localValue, setLocalValue] = useState<string>(
    String(datapoint.pendingValue ?? datapoint.currentValue ?? '')
  );
  const [isEditing, setIsEditing] = useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(datapoint.pendingValue ?? datapoint.currentValue ?? ''));
    }
  }, [datapoint.currentValue, datapoint.pendingValue, isEditing]);

  const hasOptions = datapoint.configOptions && datapoint.configOptions.length > 0;
  const hasPendingChange = datapoint.pendingValue !== undefined &&
    datapoint.pendingValue !== datapoint.currentValue;

  const handleSelectChange = (value: string) => {
    const numVal = parseInt(value);
    onUpdate(deviceId, datapoint.id, numVal);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const numVal = parseFloat(localValue);
    if (!isNaN(numVal) && numVal !== datapoint.currentValue) {
      onUpdate(deviceId, datapoint.id, numVal);
    }
  };

  const displayValue = datapoint.currentValue !== undefined
    ? (hasOptions
        ? datapoint.configOptions?.find(o => o.value === datapoint.currentValue)?.label || String(datapoint.currentValue)
        : `${datapoint.currentValue}${datapoint.unit ? ` ${datapoint.unit}` : ''}`)
    : '---';

  return (
    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-white truncate">{datapoint.name}</span>
          {hasPendingChange && (
            <span className="text-[9px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded flex-shrink-0">
              Ungespeichert
            </span>
          )}
        </div>
        <button
          onClick={() => onRead?.(deviceId, datapoint.id)}
          className="p-1 text-slate-500 hover:text-purple-400 transition-colors flex-shrink-0"
          title="Wert vom Geraet lesen"
        >
          <Download className="w-3 h-3" />
        </button>
      </div>

      {datapoint.configDescription && (
        <p className="text-[9px] text-slate-500">{datapoint.configDescription}</p>
      )}

      <div className="flex items-center gap-2">
        {hasOptions ? (
          <select
            value={String(datapoint.pendingValue ?? datapoint.currentValue ?? '')}
            onChange={e => handleSelectChange(e.target.value)}
            className="flex-1 bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500"
          >
            <option value="">-- Waehlen --</option>
            {datapoint.configOptions?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            step={datapoint.scale && datapoint.scale < 1 ? datapoint.scale : 1}
            value={localValue}
            onChange={e => {
              setIsEditing(true);
              setLocalValue(e.target.value);
            }}
            onBlur={handleInputBlur}
            onKeyDown={e => e.key === 'Enter' && handleInputBlur()}
            className="flex-1 bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500"
          />
        )}
        {datapoint.unit && !hasOptions && (
          <span className="text-[10px] text-slate-400">{datapoint.unit}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-[9px]">
        <span className="text-slate-500">
          Addr: {datapoint.address} | Aktuell: {displayValue}
        </span>
        {datapoint.lastReadAt && (
          <span className="text-slate-600">
            {new Date(datapoint.lastReadAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};

export const ModbusDriverPanel: React.FC<ModbusDriverPanelProps> = ({
  devices,
  driverEnabled,
  onDriverEnabledChange,
  onDevicesChange,
  onDatapointDragStart,
  onPingDevice,
  deviceStatus,
  selectedDatapointPath,
  allNodes = [],
  onReadConfigValue,
  onWriteConfigValue
}) => {
  const [nav, setNav] = useState<NavigationState>({ level: 'driver' });
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const lastSelectedPathRef = React.useRef<{ deviceId: string; datapointId: string } | null>(null);

  React.useEffect(() => {
    if (selectedDatapointPath) {
      const isSamePath = lastSelectedPathRef.current &&
        lastSelectedPathRef.current.deviceId === selectedDatapointPath.deviceId &&
        lastSelectedPathRef.current.datapointId === selectedDatapointPath.datapointId;

      if (!isSamePath) {
        const device = devices.find(d => d.id === selectedDatapointPath.deviceId);
        if (device) {
          const isOutput = device.outputDatapoints?.some(dp => dp.id === selectedDatapointPath.datapointId);
          setNav({
            level: 'datapoint',
            deviceId: selectedDatapointPath.deviceId,
            datapointId: selectedDatapointPath.datapointId,
            isOutput
          });
          lastSelectedPathRef.current = { ...selectedDatapointPath };
        }
      }
    }
  }, [selectedDatapointPath]);

  const currentDevice = nav.deviceId ? devices.find(d => d.id === nav.deviceId) : null;
  const currentDatapoint = currentDevice && nav.datapointId
    ? [...(currentDevice.inputDatapoints || []), ...(currentDevice.outputDatapoints || [])].find(dp => dp.id === nav.datapointId)
    : null;

  const getDatapointUsage = useCallback((deviceId: string, datapointId: string): FlowNode | null => {
    return allNodes.find(node =>
      (node.type === 'modbus-device-input' || node.type === 'modbus-device-output') &&
      node.data.config?.modbusDeviceId === deviceId &&
      node.data.config?.modbusDatapointId === datapointId
    ) || null;
  }, [allNodes]);

  const addDeviceFromLibrary = (template: ModbusDeviceTemplate) => {
    const inputDps = (template.inputDatapoints || template.datapoints.filter(dp => !dp.writable)).map((dp, idx) => ({
      ...dp,
      id: `dp-in-${Date.now()}-${idx}`
    }));
    const outputDps = (template.outputDatapoints || template.datapoints.filter(dp => dp.writable)).map((dp, idx) => ({
      ...dp,
      id: `dp-out-${Date.now()}-${idx}`
    }));
    const configDps = (template.configDatapoints || []).map((dp, idx) => ({
      ...dp,
      id: `dp-cfg-${Date.now()}-${idx}`
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
      outputDatapoints: outputDps,
      configDatapoints: configDps
    };

    onDevicesChange([...devices, newDevice]);
    setShowLibrary(false);
    setNav({ level: 'device', deviceId: newDevice.id });
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
    setNav({ level: 'device', deviceId: newDevice.id });
    setEditMode(true);
  };

  const updateDevice = (deviceId: string, updates: Partial<ModbusDevice>) => {
    onDevicesChange(devices.map(d => d.id === deviceId ? { ...d, ...updates } : d));
  };

  const removeDevice = (deviceId: string) => {
    onDevicesChange(devices.filter(d => d.id !== deviceId));
    if (nav.deviceId === deviceId) {
      setNav({ level: 'driver' });
    }
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
    setNav({ level: 'datapoint', deviceId, datapointId: newDp.id, isOutput });
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
        outputDatapoints: updateDpList(d.outputDatapoints),
        configDatapoints: updateDpList(d.configDatapoints)
      };
    }));
  };

  const updateConfigValue = (deviceId: string, dpId: string, value: number | string | boolean) => {
    updateDatapoint(deviceId, dpId, { pendingValue: value });
    if (onWriteConfigValue) {
      onWriteConfigValue(deviceId, dpId, value);
    }
  };

  const readAllConfigValues = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device && device.configDatapoints && onReadConfigValue) {
      device.configDatapoints.forEach(dp => {
        onReadConfigValue(deviceId, dp.id);
      });
    }
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
    if (nav.datapointId === dpId) {
      setNav({ level: 'device', deviceId });
    }
  };

  const categories = getDeviceCategories();
  const filteredLibrary = modbusDeviceLibrary.filter(template => {
    const matchesSearch = librarySearch === '' ||
      template.model.toLowerCase().includes(librarySearch.toLowerCase()) ||
      template.manufacturer.toLowerCase().includes(librarySearch.toLowerCase());
    const matchesCategory = selectedCategory === null || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (e: React.DragEvent, device: ModbusDevice, dp: ModbusDatapoint, isOutput: boolean) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'modbus-datapoint',
      device,
      datapoint: dp,
      isOutput
    }));
    onDatapointDragStart(device, dp, isOutput);
  };

  const renderBreadcrumb = () => {
    const parts: { label: string; onClick: () => void }[] = [
      { label: 'Modbus Treiber', onClick: () => setNav({ level: 'driver' }) }
    ];

    if (currentDevice) {
      parts.push({
        label: currentDevice.name,
        onClick: () => setNav({ level: 'device', deviceId: currentDevice.id })
      });
    }

    if (currentDatapoint) {
      parts.push({
        label: currentDatapoint.name,
        onClick: () => {}
      });
    }

    return (
      <div className="flex items-center gap-1 text-xs mb-3 flex-wrap">
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-500" />}
            <button
              onClick={part.onClick}
              className={`hover:text-white transition-colors ${
                idx === parts.length - 1 ? 'text-emerald-400 font-medium' : 'text-slate-400'
              }`}
            >
              {part.label}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderDriverView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <Server className={`w-5 h-5 ${driverEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
          <div>
            <div className="text-sm font-medium text-white">Modbus TCP Treiber</div>
            <div className="text-[10px] text-slate-400">
              {driverEnabled ? 'Aktiv' : 'Deaktiviert'} - {devices.length} Geraet(e)
            </div>
          </div>
        </div>
        <button
          onClick={() => onDriverEnabledChange(!driverEnabled)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            driverEnabled
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-slate-600/50 text-slate-400 border border-slate-500/30 hover:bg-slate-600 hover:text-white'
          }`}
        >
          {driverEnabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          {driverEnabled ? 'Aktiv' : 'Deaktiviert'}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Geraete</span>
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
            <Plus className="w-3 h-3" /> Neu
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-8 bg-slate-700/20 rounded-lg border border-dashed border-slate-600">
          <Server className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Keine Geraete konfiguriert</p>
          <p className="text-[10px] text-slate-600 mt-1">Klicke "Bibliothek" um ein Geraet hinzuzufuegen</p>
        </div>
      ) : (
        <div className="space-y-1">
          {devices.map(device => {
            const status = deviceStatus[device.id] || { online: false };
            const inputCount = device.inputDatapoints?.length || 0;
            const outputCount = device.outputDatapoints?.length || 0;

            return (
              <button
                key={device.id}
                onClick={() => setNav({ level: 'device', deviceId: device.id })}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg transition-colors group"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  !device.enabled ? 'bg-slate-600' :
                  status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                }`} />
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs font-medium text-white truncate">{device.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{device.host}:{device.port}</div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-0.5">
                    <ArrowDownToLine className="w-3 h-3 text-cyan-400" />
                    {inputCount}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <ArrowUpFromLine className="w-3 h-3 text-orange-400" />
                    {outputCount}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDeviceView = () => {
    if (!currentDevice) return null;
    const status = deviceStatus[currentDevice.id] || { online: false };

    return (
      <div className="space-y-4">
        <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                !currentDevice.enabled ? 'bg-slate-600' :
                status.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`} />
              <span className="text-sm font-medium text-white">{currentDevice.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPingDevice(currentDevice.id)}
                disabled={status.pinging}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  status.pinging ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-slate-600/50 text-slate-400 hover:bg-slate-600 hover:text-white'
                }`}
              >
                <Radio className={`w-3 h-3 ${status.pinging ? 'animate-pulse' : ''}`} />
                Ping
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`p-1.5 rounded transition-colors ${
                  editMode ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => updateDevice(currentDevice.id, { enabled: !currentDevice.enabled })}
                className={`p-1.5 rounded transition-colors ${
                  currentDevice.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-white'
                }`}
                title={currentDevice.enabled ? 'Deaktivieren' : 'Aktivieren'}
              >
                {currentDevice.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => removeDevice(currentDevice.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {editMode && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-600/50">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  value={currentDevice.name}
                  onChange={e => updateDevice(currentDevice.id, { name: e.target.value })}
                  className="w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Unit ID</label>
                <input
                  type="number"
                  min={1}
                  max={247}
                  value={currentDevice.unitId}
                  onChange={e => updateDevice(currentDevice.id, { unitId: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Host / IP</label>
                <input
                  type="text"
                  value={currentDevice.host}
                  onChange={e => updateDevice(currentDevice.id, { host: e.target.value })}
                  className="w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Port</label>
                <input
                  type="number"
                  value={currentDevice.port}
                  onChange={e => updateDevice(currentDevice.id, { port: parseInt(e.target.value) || 502 })}
                  className="w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Poll-Intervall (ms)</label>
                <input
                  type="number"
                  min={100}
                  value={currentDevice.pollInterval || 1000}
                  onChange={e => updateDevice(currentDevice.id, { pollInterval: parseInt(e.target.value) || 1000 })}
                  className="w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Timeout (ms)</label>
                <input
                  type="number"
                  min={500}
                  value={currentDevice.timeout || 3000}
                  onChange={e => updateDevice(currentDevice.id, { timeout: parseInt(e.target.value) || 3000 })}
                  className="w-full bg-slate-600/50 border border-slate-500/50 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-medium text-slate-300">Eingaenge ({currentDevice.inputDatapoints?.length || 0})</span>
            </div>
            <button
              onClick={() => addDatapoint(currentDevice.id, false)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Plus className="w-3 h-3" /> Hinzufuegen
            </button>
          </div>
          <div className="space-y-1">
            {(currentDevice.inputDatapoints || []).map(dp => {
              const usedInNode = getDatapointUsage(currentDevice.id, dp.id);
              return (
                <div
                  key={dp.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, currentDevice, dp, false)}
                  onClick={() => setNav({ level: 'datapoint', deviceId: currentDevice.id, datapointId: dp.id, isOutput: false })}
                  className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg cursor-grab active:cursor-grabbing group transition-colors"
                >
                  <GripVertical className="w-3 h-3 text-cyan-400/50 group-hover:text-cyan-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-white">
                      <span className="truncate">{dp.name}</span>
                      {usedInNode && (
                        <Link2 className="w-3 h-3 text-emerald-400 flex-shrink-0" title="Im Wiresheet verwendet" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Addr: {dp.address} | {dp.registerType} | {dp.dataType}
                      {dp.unit && ` | ${dp.unit}`}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white" />
                </div>
              );
            })}
            {(!currentDevice.inputDatapoints || currentDevice.inputDatapoints.length === 0) && (
              <div className="text-center py-4 text-[10px] text-slate-500 bg-slate-700/20 rounded-lg border border-dashed border-slate-600">
                Keine Eingaenge konfiguriert
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-medium text-slate-300">Ausgaenge ({currentDevice.outputDatapoints?.length || 0})</span>
            </div>
            <button
              onClick={() => addDatapoint(currentDevice.id, true)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
            >
              <Plus className="w-3 h-3" /> Hinzufuegen
            </button>
          </div>
          <div className="space-y-1">
            {(currentDevice.outputDatapoints || []).map(dp => {
              const usedInNode = getDatapointUsage(currentDevice.id, dp.id);
              return (
                <div
                  key={dp.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, currentDevice, dp, true)}
                  onClick={() => setNav({ level: 'datapoint', deviceId: currentDevice.id, datapointId: dp.id, isOutput: true })}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg cursor-grab active:cursor-grabbing group transition-colors"
                >
                  <GripVertical className="w-3 h-3 text-orange-400/50 group-hover:text-orange-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-white">
                      <span className="truncate">{dp.name}</span>
                      {usedInNode && (
                        <Link2 className="w-3 h-3 text-emerald-400 flex-shrink-0" title="Im Wiresheet verwendet" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Addr: {dp.address} | {dp.registerType} | {dp.dataType}
                      {dp.unit && ` | ${dp.unit}`}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white" />
                </div>
              );
            })}
            {(!currentDevice.outputDatapoints || currentDevice.outputDatapoints.length === 0) && (
              <div className="text-center py-4 text-[10px] text-slate-500 bg-slate-700/20 rounded-lg border border-dashed border-slate-600">
                Keine Ausgaenge konfiguriert
              </div>
            )}
          </div>
        </div>

        {currentDevice.configDatapoints && currentDevice.configDatapoints.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-slate-300">Konfiguration ({currentDevice.configDatapoints.length})</span>
              </div>
              <button
                onClick={() => readAllConfigValues(currentDevice.id)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                title="Alle Konfigurationswerte vom Geraet lesen"
              >
                <Download className="w-3 h-3" /> Alle lesen
              </button>
            </div>
            <div className="space-y-1">
              {currentDevice.configDatapoints.map(dp => (
                <ConfigDatapointRow
                  key={dp.id}
                  deviceId={currentDevice.id}
                  datapoint={dp}
                  onUpdate={updateConfigValue}
                  onRead={onReadConfigValue}
                />
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-600/50">
          <p className="text-[10px] text-slate-500 text-center">
            Datenpunkte per Drag & Drop ins Wiresheet ziehen
          </p>
        </div>
      </div>
    );
  };

  const renderDatapointView = () => {
    if (!currentDevice || !currentDatapoint) return null;

    return (
      <div className="space-y-4">
        <div className={`rounded-lg p-3 ${nav.isOutput ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-cyan-500/10 border border-cyan-500/20'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {nav.isOutput ? (
                <ArrowUpFromLine className="w-4 h-4 text-orange-400" />
              ) : (
                <ArrowDownToLine className="w-4 h-4 text-cyan-400" />
              )}
              <span className="text-sm font-medium text-white">{currentDatapoint.name}</span>
            </div>
            <button
              onClick={() => removeDatapoint(currentDevice.id, currentDatapoint.id)}
              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <DatapointEditForm
              deviceId={currentDevice.id}
              datapoint={currentDatapoint}
              registerTypes={registerTypes}
              dataTypes={dataTypes}
              onUpdate={updateDatapoint}
            />
          </div>
        </div>

        <div className="bg-slate-700/30 rounded-lg p-3">
          <div className="text-[10px] text-slate-400 font-medium uppercase mb-2">Geraete-Info</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            <span className="text-slate-500">Geraet:</span>
            <span className="text-white">{currentDevice.name}</span>
            <span className="text-slate-500">Host:</span>
            <span className="text-white font-mono">{currentDevice.host}:{currentDevice.port}</span>
            <span className="text-slate-500">Unit ID:</span>
            <span className="text-white font-mono">{currentDevice.unitId}</span>
            <span className="text-slate-500">Poll-Intervall:</span>
            <span className="text-white">{currentDevice.pollInterval || 1000} ms</span>
          </div>
        </div>

        <div
          draggable
          onDragStart={(e) => handleDragStart(e, currentDevice, currentDatapoint, nav.isOutput || false)}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
            nav.isOutput
              ? 'bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300'
              : 'bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300'
          }`}
        >
          <GripVertical className="w-4 h-4" />
          <span className="text-xs font-medium">Ins Wiresheet ziehen</span>
        </div>
      </div>
    );
  };

  const renderLibrary = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-white">Geraete-Bibliothek</span>
          </div>
          <button
            onClick={() => setShowLibrary(false)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-700 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={librarySearch}
              onChange={e => setLibrarySearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              Alle
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredLibrary.map(template => (
            <button
              key={template.id}
              onClick={() => addDeviceFromLibrary(template)}
              className="w-full text-left p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{template.model}</span>
                <span className="text-[10px] text-slate-400">{template.manufacturer}</span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">{template.description}</p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-cyan-400">
                  <ArrowDownToLine className="w-3 h-3" />
                  {(template.inputDatapoints || template.datapoints.filter(d => !d.writable)).length} Eingaenge
                </span>
                <span className="flex items-center gap-1 text-orange-400">
                  <ArrowUpFromLine className="w-3 h-3" />
                  {(template.outputDatapoints || template.datapoints.filter(d => d.writable)).length} Ausgaenge
                </span>
              </div>
            </button>
          ))}
          {filteredLibrary.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Keine Geraete gefunden
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {renderBreadcrumb()}
      <div className="flex-1 overflow-y-auto">
        {nav.level === 'driver' && renderDriverView()}
        {nav.level === 'device' && renderDeviceView()}
        {nav.level === 'datapoint' && renderDatapointView()}
      </div>
      {showLibrary && renderLibrary()}
    </div>
  );
};
