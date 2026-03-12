import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Network, Cpu, Circle } from 'lucide-react';
import { ModbusDevice, DriverBinding } from '../types/flow';

interface DriverPanelProps {
  side: 'left' | 'right';
  modbusDevices: ModbusDevice[];
  modbusDeviceStatus: Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>;
  driverBindings: DriverBinding[];
  connectingFrom: { nodeId: string; portId: string } | null;
  onDatapointClick: (device: ModbusDevice, datapoint: ModbusDevice['datapoints'][0], isOutput: boolean) => void;
  onDatapointDragStart: (device: ModbusDevice, datapoint: ModbusDevice['datapoints'][0], isOutput: boolean) => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
  side,
  modbusDevices,
  modbusDeviceStatus,
  driverBindings,
  connectingFrom,
  onDatapointClick,
  onDatapointDragStart
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());

  const isOutputPanel = side === 'right';
  const panelTitle = isOutputPanel ? 'Ausgaenge' : 'Eingaenge';

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

  const getDatapointsForPanel = (device: ModbusDevice) => {
    if (isOutputPanel) {
      return device.datapoints.filter(dp => dp.writable && !dp.isConfig);
    } else {
      return device.datapoints.filter(dp => !dp.isConfig);
    }
  };

  const hasDatapoints = modbusDevices.some(d => getDatapointsForPanel(d).length > 0);

  const getBindingForDatapoint = (deviceId: string, datapointId: string) => {
    return driverBindings.find(
      b => b.deviceId === deviceId && b.datapointId === datapointId
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
            {modbusDevices.filter(d => d.enabled).map(device => {
              const datapoints = getDatapointsForPanel(device);
              if (datapoints.length === 0) return null;

              const isExpanded = expandedDevices.has(device.id);
              const status = modbusDeviceStatus[device.id];

              return (
                <div key={device.id} className="border-b border-slate-700/50">
                  <button
                    onClick={() => toggleDevice(device.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 transition-colors"
                  >
                    <Cpu className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="flex-1 text-xs font-medium text-slate-200 truncate text-left">
                      {device.name}
                    </span>
                    <Circle
                      className={`w-2 h-2 flex-shrink-0 ${
                        status?.online ? 'text-emerald-400 fill-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="bg-slate-900/50">
                      {datapoints.map(dp => {
                        const binding = getBindingForDatapoint(device.id, dp.id);
                        const isConnecting = !!connectingFrom;
                        const canConnect = isConnecting && (
                          (isOutputPanel && dp.writable) ||
                          (!isOutputPanel)
                        );

                        return (
                          <div
                            key={dp.id}
                            className={`group flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors ${
                              canConnect
                                ? 'hover:bg-blue-600/30 bg-blue-900/20'
                                : 'hover:bg-slate-700/30'
                            } ${binding ? 'bg-amber-900/20' : ''}`}
                            onClick={() => onDatapointClick(device, dp, isOutputPanel)}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/json', JSON.stringify({
                                type: 'driver-datapoint',
                                driverType: 'modbus',
                                device,
                                datapoint: dp,
                                isOutput: isOutputPanel
                              }));
                              onDatapointDragStart(device, dp, isOutputPanel);
                            }}
                            draggable
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              binding
                                ? 'bg-amber-400'
                                : canConnect
                                  ? 'bg-blue-400 animate-pulse'
                                  : 'bg-slate-500'
                            }`} />
                            <span className="flex-1 text-[11px] text-slate-300 truncate">
                              {dp.name}
                            </span>
                            {dp.unit && (
                              <span className="text-[10px] text-slate-500">{dp.unit}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {modbusDevices.filter(d => d.enabled).length === 0 && (
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
