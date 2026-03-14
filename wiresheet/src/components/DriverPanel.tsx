import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Network, Cpu, Circle, Home, Lightbulb, Power, Gauge, Activity, Thermometer, AlertTriangle } from 'lucide-react';
import { ModbusDevice, DriverBinding, HaDevice, HaEntity } from '../types/flow';

const WRITABLE_HA_DOMAINS = ['switch', 'light', 'fan', 'cover', 'climate', 'input_boolean', 'input_number', 'input_select', 'automation', 'script', 'scene', 'lock', 'vacuum', 'media_player'];

function isWritableHaEntity(entity: HaEntity): boolean {
  const domain = entity.entity_id.split('.')[0];
  return WRITABLE_HA_DOMAINS.includes(domain);
}

function getHaEntityIcon(entityId: string): React.ReactNode {
  const domain = entityId.split('.')[0];
  const iconClass = "w-3 h-3";
  switch (domain) {
    case 'light': return <Lightbulb className={`${iconClass} text-yellow-400`} />;
    case 'switch':
    case 'input_boolean': return <Power className={`${iconClass} text-blue-400`} />;
    case 'sensor': return <Gauge className={`${iconClass} text-green-400`} />;
    case 'binary_sensor': return <Activity className={`${iconClass} text-cyan-400`} />;
    case 'climate': return <Thermometer className={`${iconClass} text-orange-400`} />;
    default: return <Activity className={`${iconClass} text-slate-400`} />;
  }
}

interface BoundDatapointInfo {
  binding: DriverBinding;
  device?: ModbusDevice;
  datapoint?: ModbusDevice['datapoints'][0];
  haDevice?: HaDevice;
  haEntity?: HaEntity;
  isAvailable: boolean;
  errorReason?: string;
}

interface DriverPanelProps {
  side: 'left' | 'right';
  modbusDevices: ModbusDevice[];
  modbusDeviceStatus: Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>;
  driverBindings: DriverBinding[];
  connectingFrom: { nodeId: string; portId: string } | null;
  onDatapointClick: (device: ModbusDevice, datapoint: ModbusDevice['datapoints'][0], isOutput: boolean) => void;
  onDatapointDragStart: (device: ModbusDevice, datapoint: ModbusDevice['datapoints'][0], isOutput: boolean) => void;
  haDevices?: HaDevice[];
  haDriverEnabled?: boolean;
  modbusDriverEnabled?: boolean;
  onHaEntityClick?: (device: HaDevice, entity: HaEntity, isOutput: boolean) => void;
  highlightedBinding?: DriverBinding | null;
}

const STORAGE_KEY_PREFIX = 'wiresheet-driver-panel-';

export const DriverPanel: React.FC<DriverPanelProps> = ({
  side,
  modbusDevices,
  modbusDeviceStatus,
  driverBindings,
  connectingFrom,
  onDatapointClick,
  onDatapointDragStart,
  haDevices = [],
  haDriverEnabled = false,
  modbusDriverEnabled = true,
  onHaEntityClick,
  highlightedBinding
}) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${side}`;

  const loadExpandedState = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          isCollapsed: parsed.isCollapsed ?? true,
          expandedDriverTypes: new Set<string>(parsed.expandedDriverTypes || []),
          expandedDevices: new Set<string>(parsed.expandedDevices || []),
          expandedHaDevices: new Set<string>(parsed.expandedHaDevices || [])
        };
      }
    } catch {}
    return {
      isCollapsed: true,
      expandedDriverTypes: new Set<string>(),
      expandedDevices: new Set<string>(),
      expandedHaDevices: new Set<string>()
    };
  };

  const initialState = loadExpandedState();
  const [isCollapsed, setIsCollapsed] = useState(initialState.isCollapsed);
  const [expandedDriverTypes, setExpandedDriverTypes] = useState<Set<string>>(initialState.expandedDriverTypes);
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(initialState.expandedDevices);
  const [expandedHaDevices, setExpandedHaDevices] = useState<Set<string>>(initialState.expandedHaDevices);

  useEffect(() => {
    const state = {
      isCollapsed,
      expandedDriverTypes: Array.from(expandedDriverTypes),
      expandedDevices: Array.from(expandedDevices),
      expandedHaDevices: Array.from(expandedHaDevices)
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [isCollapsed, expandedDriverTypes, expandedDevices, expandedHaDevices, storageKey]);

  const isOutputPanel = side === 'right';
  const shouldHighlight = highlightedBinding && (
    (isOutputPanel && highlightedBinding.direction === 'output') ||
    (!isOutputPanel && highlightedBinding.direction === 'input')
  );

  useEffect(() => {
    if (shouldHighlight && highlightedBinding) {
      setIsCollapsed(false);
      if (highlightedBinding.driverType === 'modbus') {
        setExpandedDriverTypes(prev => new Set([...prev, 'modbus']));
        setExpandedDevices(prev => new Set([...prev, highlightedBinding.deviceId]));
      } else if (highlightedBinding.driverType === 'homeassistant') {
        setExpandedDriverTypes(prev => new Set([...prev, 'homeassistant']));
        setExpandedHaDevices(prev => new Set([...prev, highlightedBinding.deviceId]));
      }
    }
  }, [shouldHighlight, highlightedBinding]);

  const panelTitle = isOutputPanel ? 'Ausgaenge' : 'Eingaenge';

  const toggleDriverType = (driverType: string) => {
    setExpandedDriverTypes(prev => {
      const next = new Set(prev);
      if (next.has(driverType)) {
        next.delete(driverType);
      } else {
        next.add(driverType);
      }
      return next;
    });
  };

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

  const toggleHaDevice = (deviceId: string) => {
    setExpandedHaDevices(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const getDatapointsForPanel = (device: ModbusDevice) => {
    if (isOutputPanel) {
      return device.datapoints.filter(dp => dp.writable && !dp.isConfig);
    } else {
      return device.datapoints.filter(dp => !dp.isConfig);
    }
  };

  const boundDatapointsInfo = useMemo((): BoundDatapointInfo[] => {
    return driverBindings.map(binding => {
      if (binding.driverType === 'modbus') {
        const device = modbusDevices.find(d => d.id === binding.deviceId);
        const datapoint = device?.datapoints.find(dp => dp.id === binding.datapointId);

        let isAvailable = true;
        let errorReason: string | undefined;

        if (!device) {
          isAvailable = false;
          errorReason = 'Geraet nicht gefunden';
        } else if (!device.enabled) {
          isAvailable = false;
          errorReason = 'Treiber deaktiviert';
        } else if (!modbusDriverEnabled) {
          isAvailable = false;
          errorReason = 'Modbus deaktiviert';
        } else if (!datapoint) {
          isAvailable = false;
          errorReason = 'Datenpunkt nicht gefunden';
        }

        return { binding, device, datapoint, isAvailable, errorReason };
      } else if (binding.driverType === 'homeassistant') {
        const device = haDevices.find(d => d.id === binding.deviceId);
        const entity = device?.entities.find(e => e.entity_id === binding.haEntityId);

        let isAvailable = true;
        let errorReason: string | undefined;

        if (!haDriverEnabled) {
          isAvailable = false;
          errorReason = 'HA deaktiviert';
        } else if (!device) {
          isAvailable = false;
          errorReason = 'Geraet nicht gefunden';
        } else if (!entity) {
          isAvailable = false;
          errorReason = 'Entity nicht gefunden';
        }

        return { binding, haDevice: device, haEntity: entity, isAvailable, errorReason };
      }
      return { binding, isAvailable: false, errorReason: 'Unbekannter Treiber' };
    });
  }, [driverBindings, modbusDevices, modbusDriverEnabled, haDevices, haDriverEnabled]);

  const unavailableModbusBindings = boundDatapointsInfo.filter(
    info => info.binding.driverType === 'modbus' && !info.isAvailable
  );
  const unavailableHaBindings = boundDatapointsInfo.filter(
    info => info.binding.driverType === 'homeassistant' && !info.isAvailable
  );

  const boundModbusDatapointIds = new Set(
    driverBindings
      .filter(b => b.driverType === 'modbus')
      .map(b => `${b.deviceId}:${b.datapointId}`)
  );

  const modbusDevicesWithData = modbusDevices.filter(d => {
    const datapoints = getDatapointsForPanel(d);
    if (d.enabled) {
      return datapoints.length > 0;
    }
    return datapoints.some(dp => boundModbusDatapointIds.has(`${d.id}:${dp.id}`));
  });
  const hasModbusDatapoints = modbusDevicesWithData.length > 0 || unavailableModbusBindings.length > 0;

  const getHaEntitiesForPanel = (device: HaDevice) => {
    if (isOutputPanel) {
      return device.entities.filter(e => isWritableHaEntity(e));
    } else {
      return device.entities;
    }
  };

  const haDevicesWithEntities = haDevices.filter(d => getHaEntitiesForPanel(d).length > 0);
  const hasHaEntities = (haDriverEnabled && haDevicesWithEntities.length > 0) || unavailableHaBindings.length > 0;
  const hasDatapoints = hasModbusDatapoints || hasHaEntities;

  const getBindingForDatapoint = (deviceId: string, datapointId: string) => {
    return driverBindings.find(
      b => b.deviceId === deviceId && b.datapointId === datapointId
    );
  };

  const getBindingForHaEntity = (entityId: string) => {
    return driverBindings.find(
      b => b.driverType === 'homeassistant' && b.haEntityId === entityId
    );
  };

  if (!hasDatapoints) {
    return null;
  }

  return (
    <div
      className={`flex-shrink-0 bg-slate-800 border-slate-700 transition-all duration-200 flex ${
        side === 'left' ? 'border-r' : 'border-l'
      }`}
      style={{ width: isCollapsed ? '32px' : '240px' }}
    >
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          {side === 'left' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          <span className="writing-mode-vertical text-xs font-medium" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            {panelTitle}
          </span>
          <Network className="w-4 h-4" />
        </button>
      ) : (
        <div className="flex flex-col w-full">
          <div className={`flex items-center justify-between px-3 py-2 border-b border-slate-700 ${
            side === 'left' ? 'flex-row' : 'flex-row-reverse'
          }`}>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              {side === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-white">{panelTitle}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {hasModbusDatapoints && (
              <div className="border-b border-slate-700">
                <button
                  onClick={() => toggleDriverType('modbus')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 transition-colors bg-slate-900/30"
                >
                  <Cpu className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="flex-1 text-xs font-semibold text-amber-300 text-left">
                    Modbus
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                    {modbusDevicesWithData.length}
                  </span>
                  {expandedDriverTypes.has('modbus') ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {expandedDriverTypes.has('modbus') && (
                  <div className="bg-slate-900/20">
                    {modbusDevicesWithData.map(device => {
                      const allDatapoints = getDatapointsForPanel(device);
                      const isDeviceDisabled = !device.enabled || !modbusDriverEnabled;
                      const datapoints = isDeviceDisabled
                        ? allDatapoints.filter(dp => boundModbusDatapointIds.has(`${device.id}:${dp.id}`))
                        : allDatapoints;
                      const isExpanded = expandedDevices.has(device.id);
                      const status = modbusDeviceStatus[device.id];

                      return (
                        <div key={device.id} className="border-b border-slate-700/30">
                          <button
                            onClick={() => toggleDevice(device.id)}
                            className={`w-full flex items-center gap-2 px-4 py-1.5 hover:bg-slate-700/50 transition-colors ${isDeviceDisabled ? 'opacity-60' : ''}`}
                          >
                            <Circle
                              className={`w-2 h-2 flex-shrink-0 ${
                                isDeviceDisabled ? 'text-red-400' :
                                status?.online ? 'text-emerald-400 fill-emerald-400' : 'text-slate-500'
                              }`}
                            />
                            <span className="flex-1 text-[11px] font-medium text-slate-200 truncate text-left">
                              {device.name}
                            </span>
                            {isDeviceDisabled && (
                              <span title={!modbusDriverEnabled ? 'Treiber deaktiviert' : 'Geraet deaktiviert'}>
                                <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="bg-slate-900/50">
                              {datapoints.map(dp => {
                                const binding = getBindingForDatapoint(device.id, dp.id);
                                const isConnecting = !!connectingFrom;
                                const isWritable = dp.writable;
                                const effectiveIsOutput = isOutputPanel ? true : isWritable;
                                const canConnect = isConnecting && !isDeviceDisabled && (
                                  (isOutputPanel && dp.writable) ||
                                  (!isOutputPanel)
                                );
                                const isHighlighted = shouldHighlight && highlightedBinding?.datapointId === dp.id && highlightedBinding?.deviceId === device.id;

                                return (
                                  <div
                                    key={dp.id}
                                    className={`group flex items-center gap-2 px-5 py-1 cursor-pointer transition-colors ${
                                      isDeviceDisabled && binding
                                        ? 'bg-red-950/30 hover:bg-red-950/50'
                                        : canConnect
                                          ? 'hover:bg-blue-600/30 bg-blue-900/20'
                                          : 'hover:bg-slate-700/30'
                                    } ${binding && !isDeviceDisabled ? 'bg-amber-900/20' : ''} ${isHighlighted ? 'ring-2 ring-amber-400 bg-amber-800/40 animate-pulse' : ''}`}
                                    onClick={() => !isDeviceDisabled && onDatapointClick(device, dp, effectiveIsOutput)}
                                    onDragStart={(e) => {
                                      if (isDeviceDisabled) {
                                        e.preventDefault();
                                        return;
                                      }
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        type: 'driver-datapoint',
                                        driverType: 'modbus',
                                        device,
                                        datapoint: dp,
                                        isOutput: effectiveIsOutput
                                      }));
                                      onDatapointDragStart(device, dp, effectiveIsOutput);
                                    }}
                                    draggable={!isDeviceDisabled}
                                  >
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      isDeviceDisabled && binding
                                        ? 'bg-red-500'
                                        : binding
                                          ? 'bg-amber-400'
                                          : canConnect
                                            ? 'bg-blue-400 animate-pulse'
                                            : isWritable && !isOutputPanel
                                              ? 'bg-emerald-500'
                                              : 'bg-slate-500'
                                    }`} />
                                    <span className={`flex-1 text-[10px] truncate ${
                                      isDeviceDisabled && binding ? 'text-red-300' :
                                      binding ? 'text-amber-300' :
                                      isWritable && !isOutputPanel ? 'text-emerald-300/80' : 'text-slate-300'
                                    }`}>
                                      {dp.name}
                                    </span>
                                    {binding && isDeviceDisabled && (
                                      <span className="text-[8px] text-red-500 bg-red-900/40 px-1 py-0.5 rounded">Fehler</span>
                                    )}
                                    {binding && !isDeviceDisabled && (
                                      <span className="text-[8px] text-amber-500 bg-amber-900/40 px-1 py-0.5 rounded">verb.</span>
                                    )}
                                    {!binding && isWritable && !isOutputPanel && (
                                      <span className="text-[8px] text-emerald-600 bg-emerald-950/60 px-1 py-0.5 rounded">Ausg.</span>
                                    )}
                                    {dp.unit && !binding && (!isWritable || isOutputPanel) && (
                                      <span className="text-[9px] text-slate-500">{dp.unit}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {unavailableModbusBindings.length > 0 && (
                      <div className="border-t border-red-900/50 bg-red-950/20">
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-950/40">
                          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          <span className="text-[10px] font-medium text-red-300">Nicht erreichbar</span>
                        </div>
                        {unavailableModbusBindings.map(info => {
                          const isHighlighted = shouldHighlight && highlightedBinding?.id === info.binding.id;
                          return (
                            <div
                              key={info.binding.id}
                              className={`group flex items-center gap-2 px-5 py-1.5 bg-red-950/30 border-b border-red-900/30 ${isHighlighted ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
                              title={info.errorReason}
                            >
                              <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-red-300 truncate block">
                                  {info.binding.deviceName} - {info.binding.datapointName}
                                </span>
                                <span className="text-[9px] text-red-500/80">{info.errorReason}</span>
                              </div>
                              <span className="text-[8px] text-red-500 bg-red-900/40 px-1 py-0.5 rounded">verb.</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {hasHaEntities && (
              <div className="border-b border-slate-700">
                <button
                  onClick={() => toggleDriverType('homeassistant')}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 transition-colors bg-slate-900/30"
                >
                  <Home className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="flex-1 text-xs font-semibold text-cyan-300 text-left">
                    Home Assistant
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                    {haDevicesWithEntities.length}
                  </span>
                  {expandedDriverTypes.has('homeassistant') ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {expandedDriverTypes.has('homeassistant') && (
                  <div className="bg-slate-900/20">
                    {haDevicesWithEntities.map(device => {
                      const entities = getHaEntitiesForPanel(device);
                      const isExpanded = expandedHaDevices.has(device.id);

                      return (
                        <div key={`ha-${device.id}`} className="border-b border-slate-700/30">
                          <button
                            onClick={() => toggleHaDevice(device.id)}
                            className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-slate-700/50 transition-colors"
                          >
                            <Circle className="w-2 h-2 flex-shrink-0 text-emerald-400 fill-emerald-400" />
                            <span className="flex-1 text-[11px] font-medium text-slate-200 truncate text-left">
                              {device.name}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="bg-slate-900/50">
                              {entities.map(entity => {
                                const binding = getBindingForHaEntity(entity.entity_id);
                                const isConnecting = !!connectingFrom;
                                const friendlyName = (entity.attributes.friendly_name as string) || entity.entity_id;
                                const unit = entity.attributes.unit_of_measurement as string || '';
                                const isHaHighlighted = shouldHighlight && highlightedBinding?.haEntityId === entity.entity_id;

                                return (
                                  <div
                                    key={entity.entity_id}
                                    className={`group flex items-center gap-2 px-5 py-1 cursor-pointer transition-colors ${
                                      isConnecting
                                        ? 'hover:bg-blue-600/30 bg-blue-900/20'
                                        : 'hover:bg-slate-700/30'
                                    } ${binding ? 'bg-cyan-900/20' : ''} ${isHaHighlighted ? 'ring-2 ring-cyan-400 bg-cyan-800/40 animate-pulse' : ''}`}
                                    onClick={() => onHaEntityClick?.(device, entity, isOutputPanel)}
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('application/json', JSON.stringify({
                                        type: 'driver-datapoint',
                                        driverType: 'homeassistant',
                                        device,
                                        entity,
                                        isOutput: isOutputPanel
                                      }));
                                    }}
                                  >
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      binding
                                        ? 'bg-cyan-400'
                                        : isConnecting
                                          ? 'bg-blue-400 animate-pulse'
                                          : 'bg-slate-500'
                                    }`} />
                                    {getHaEntityIcon(entity.entity_id)}
                                    <span className={`flex-1 text-[10px] truncate ${binding ? 'text-cyan-300' : 'text-slate-300'}`}>
                                      {friendlyName}
                                    </span>
                                    {binding && (
                                      <span className="text-[8px] text-cyan-500 bg-cyan-900/40 px-1 py-0.5 rounded">verb.</span>
                                    )}
                                    {unit && !binding && (
                                      <span className="text-[9px] text-slate-500">{unit}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {unavailableHaBindings.length > 0 && (
                      <div className="border-t border-red-900/50 bg-red-950/20">
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-950/40">
                          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          <span className="text-[10px] font-medium text-red-300">Nicht erreichbar</span>
                        </div>
                        {unavailableHaBindings.map(info => {
                          const isHighlighted = shouldHighlight && highlightedBinding?.id === info.binding.id;
                          return (
                            <div
                              key={info.binding.id}
                              className={`group flex items-center gap-2 px-5 py-1.5 bg-red-950/30 border-b border-red-900/30 ${isHighlighted ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
                              title={info.errorReason}
                            >
                              <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-red-300 truncate block">
                                  {info.binding.deviceName} - {info.binding.datapointName}
                                </span>
                                <span className="text-[9px] text-red-500/80">{info.errorReason}</span>
                              </div>
                              <span className="text-[8px] text-red-500 bg-red-900/40 px-1 py-0.5 rounded">verb.</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!hasModbusDatapoints && !hasHaEntities && (
              <div className="px-3 py-4 text-center text-xs text-slate-500">
                Keine Treiber aktiv
              </div>
            )}
          </div>

          {connectingFrom && (
            <div className="px-3 py-2 bg-blue-900/30 border-t border-blue-700/50">
              <p className="text-[10px] text-blue-300 text-center">
                Datenpunkt anklicken zum Verbinden
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
