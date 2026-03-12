import React, { useState, useEffect, useCallback } from 'react';
import { X, Settings } from 'lucide-react';

export type PIDSymbolType = 'pid' | 'controller' | 'regulator';
export type WidgetSizePreset = 'small' | 'medium' | 'large';

const getSizeValues = (size: WidgetSizePreset | undefined) => {
  switch (size) {
    case 'small': return { symbolSize: 40, maxWidth: 55, maxHeight: 55, fontSize: 'text-[10px]' };
    case 'large': return { symbolSize: 80, maxWidth: 100, maxHeight: 100, fontSize: 'text-sm' };
    case 'medium':
    default: return { symbolSize: 60, maxWidth: 80, maxHeight: 80, fontSize: 'text-xs' };
  }
};

interface PIDWidgetConfig {
  pidName?: string;
  normalColor?: string;
  activeColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  symbolType?: PIDSymbolType;
  showSetpoint?: boolean;
  showActualValue?: boolean;
  showOutput?: boolean;
  widgetSize?: WidgetSizePreset;
}

interface PIDValues {
  controlOutput: number;
  setpoint: number;
  actualValue: number;
  enable: boolean;
  hoaMode?: 'hand' | 'auto';
  manualOutput?: number;
}

interface PIDParams {
  pidKp?: number;
  pidKi?: number;
  pidKd?: number;
  pidWindupLimit?: number;
  pidMinOutput?: number;
  pidMaxOutput?: number;
  pidName?: string;
}

interface VisuPIDProps {
  config: PIDWidgetConfig;
  value: PIDValues | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: PIDParams;
}

const PIDSymbol: React.FC<{ color: string; size: number; active: boolean }> = ({ color, size, active }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <rect x="10" y="20" width="80" height="60" rx="8" stroke={color} strokeWidth="4" fill={active ? color : 'transparent'} fillOpacity={active ? 0.2 : 0} />
    <text x="50" y="58" textAnchor="middle" fontSize="24" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">PID</text>
    <line x1="0" y1="50" x2="10" y2="50" stroke={color} strokeWidth="3" />
    <line x1="90" y1="50" x2="100" y2="50" stroke={color} strokeWidth="3" />
    <polygon points="95,45 100,50 95,55" fill={color} />
  </svg>
);

const ControllerSymbol: React.FC<{ color: string; size: number; active: boolean }> = ({ color, size, active }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <circle cx="50" cy="50" r="40" stroke={color} strokeWidth="4" fill={active ? color : 'transparent'} fillOpacity={active ? 0.2 : 0} />
    <text x="50" y="45" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">PID</text>
    <text x="50" y="65" textAnchor="middle" fontSize="14" fill={color} fontFamily="Arial, sans-serif">CTRL</text>
  </svg>
);

const RegulatorSymbol: React.FC<{ color: string; size: number; active: boolean }> = ({ color, size, active }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <rect x="15" y="15" width="70" height="70" stroke={color} strokeWidth="4" fill={active ? color : 'transparent'} fillOpacity={active ? 0.2 : 0} />
    <line x1="25" y1="50" x2="75" y2="50" stroke={color} strokeWidth="2" />
    <line x1="50" y1="25" x2="50" y2="75" stroke={color} strokeWidth="2" />
    <circle cx="50" cy="50" r="15" stroke={color} strokeWidth="3" fill="transparent" />
    <text x="50" y="55" textAnchor="middle" fontSize="12" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">R</text>
  </svg>
);

const PIDSymbolRenderer: React.FC<{ symbolType: PIDSymbolType; color: string; size: number; active: boolean }> = ({ symbolType, color, size, active }) => {
  switch (symbolType) {
    case 'controller': return <ControllerSymbol color={color} size={size} active={active} />;
    case 'regulator': return <RegulatorSymbol color={color} size={size} active={active} />;
    case 'pid':
    default: return <PIDSymbol color={color} size={size} active={active} />;
  }
};

export const VisuPID: React.FC<VisuPIDProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localParams, setLocalParams] = useState<PIDParams>({});

  const controlOutput = value?.controlOutput ?? 0;
  const setpoint = value?.setpoint ?? 0;
  const actualValue = value?.actualValue ?? 0;
  const enable = value?.enable ?? false;
  const hoaMode = value?.hoaMode ?? 'auto';
  const manualOutput = value?.manualOutput ?? 0;

  const minOutput = params?.pidMinOutput ?? 0;
  const maxOutput = params?.pidMaxOutput ?? 100;
  const symbolType = config.symbolType || 'pid';

  const isHandMode = hoaMode === 'hand';
  const isActive = enable || isHandMode;
  const [localManualOutput, setLocalManualOutput] = useState(manualOutput);

  useEffect(() => {
    if (params) {
      setLocalParams(params);
    }
  }, [params]);

  useEffect(() => {
    setLocalManualOutput(manualOutput);
  }, [manualOutput]);

  const getStatusColor = useCallback(() => {
    if (isActive) return config.activeColor || '#22c55e';
    return config.normalColor || '#64748b';
  }, [isActive, config]);

  const handleClick = useCallback(() => {
    if (!isEditMode) {
      setShowPopup(true);
    }
  }, [isEditMode]);

  const handleParamChange = useCallback((key: string, val: number | boolean | string) => {
    setLocalParams(prev => ({ ...prev, [key]: val }));
    onValueChange?.({ pidControl: { [`param_${key}`]: val } });
  }, [onValueChange]);

  const handleHOAChange = useCallback((mode: 'hand' | 'auto') => {
    onValueChange?.({ pidControl: { hoaMode: mode } });
  }, [onValueChange]);

  const handleManualOutputChange = useCallback((val: number) => {
    setLocalManualOutput(val);
    onValueChange?.({ pidControl: { manualOutput: val } });
  }, [onValueChange]);

  const statusColor = getStatusColor();
  const pidName = config.pidName || params?.pidName || 'PID Regler';
  const rotation = config.rotation ?? 0;
  const sizeValues = getSizeValues(config.widgetSize);

  const showSetpointDisplay = config.showSetpoint !== false;
  const showActualValueDisplay = config.showActualValue !== false;
  const showOutputDisplay = config.showOutput !== false;

  const error = setpoint - actualValue;

  return (
    <>
      <div
        className="w-full h-full flex flex-col items-center justify-center cursor-pointer select-none relative"
        onClick={handleClick}
        style={{ backgroundColor: 'transparent' }}
      >
        {isHandMode && (
          <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[9px] font-bold z-10 bg-amber-600 text-white">
            HAND
          </div>
        )}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: '70%',
            height: '50%',
            maxWidth: sizeValues.maxWidth,
            maxHeight: sizeValues.maxHeight,
            transform: `rotate(${rotation}deg)`
          }}
        >
          <PIDSymbolRenderer
            symbolType={symbolType}
            color={statusColor}
            size={sizeValues.symbolSize}
            active={isActive}
          />
        </div>
        <div className={`${sizeValues.fontSize} text-center text-slate-300 truncate w-full px-1`}>
          {pidName}
        </div>
        {showOutputDisplay && (
          <div className={`${sizeValues.fontSize} font-semibold`} style={{ color: statusColor }}>
            {controlOutput.toFixed(1)} %
          </div>
        )}
      </div>

      {showPopup && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPopup(false);
              setShowSettings(false);
            }
          }}
        >
          <div
            className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-[420px] max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-slate-700"
              style={{ backgroundColor: statusColor + '20' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: statusColor + '30', border: `2px solid ${statusColor}` }}
                >
                  <PIDSymbolRenderer symbolType={symbolType} color={statusColor} size={28} active={isActive} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{pidName}</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-300">Ausgang: {controlOutput.toFixed(1)} %</span>
                    {isHandMode && <span className="text-amber-400">| Hand</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                  title="Parameter anzeigen"
                >
                  <Settings size={20} />
                </button>
                <button
                  onClick={() => {
                    setShowPopup(false);
                    setShowSettings(false);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Betriebsart</span>
                  <div className="flex rounded-lg overflow-hidden border border-slate-600">
                    <button
                      onClick={() => handleHOAChange('hand')}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        isHandMode
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      Hand
                    </button>
                    <button
                      onClick={() => handleHOAChange('auto')}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        !isHandMode
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      Auto
                    </button>
                  </div>
                </div>
                {isHandMode && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Handwert</span>
                      <span className="text-sm font-medium" style={{ color: statusColor }}>
                        {localManualOutput.toFixed(1)} %
                      </span>
                    </div>
                    <input
                      type="range"
                      min={minOutput}
                      max={maxOutput}
                      step={0.1}
                      value={localManualOutput}
                      onChange={(e) => handleManualOutputChange(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${statusColor} 0%, ${statusColor} ${((localManualOutput - minOutput) / (maxOutput - minOutput)) * 100}%, #475569 ${((localManualOutput - minOutput) / (maxOutput - minOutput)) * 100}%, #475569 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{minOutput} %</span>
                      <span>{maxOutput} %</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {showSetpointDisplay && (
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Sollwert</div>
                    <div className="text-xl font-bold text-blue-400">{setpoint.toFixed(1)}</div>
                  </div>
                )}
                {showActualValueDisplay && (
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Istwert</div>
                    <div className="text-xl font-bold text-cyan-400">{actualValue.toFixed(1)}</div>
                  </div>
                )}
                {showOutputDisplay && (
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Ausgang</div>
                    <div className="text-xl font-bold" style={{ color: statusColor }}>{controlOutput.toFixed(1)} %</div>
                  </div>
                )}
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Regeldifferenz</h3>
                <div className="flex items-center justify-center">
                  <div className={`text-3xl font-bold ${error >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {error >= 0 ? '+' : ''}{error.toFixed(2)}
                  </div>
                </div>
                <div className="mt-3 h-3 bg-slate-600 rounded-full overflow-hidden relative">
                  <div
                    className="absolute h-full w-1 bg-white"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                  />
                  <div
                    className="absolute h-full transition-all rounded-full"
                    style={{
                      left: error >= 0 ? '50%' : `${50 + (error / 10) * 50}%`,
                      width: `${Math.min(50, Math.abs(error / 10) * 50)}%`,
                      backgroundColor: error >= 0 ? '#22c55e' : '#ef4444'
                    }}
                  />
                </div>
              </div>

              {showSettings && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-medium text-blue-300 flex items-center gap-2">
                    <Settings size={16} /> PID Parameter
                  </h3>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Kp (P-Anteil)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={localParams.pidKp ?? 1.0}
                        onChange={(e) => handleParamChange('pidKp', parseFloat(e.target.value) || 1.0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Ki (I-Anteil)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={localParams.pidKi ?? 0.1}
                        onChange={(e) => handleParamChange('pidKi', parseFloat(e.target.value) || 0.1)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Kd (D-Anteil)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={localParams.pidKd ?? 0.0}
                        onChange={(e) => handleParamChange('pidKd', parseFloat(e.target.value) || 0.0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Windup Limit</label>
                      <input
                        type="number"
                        value={localParams.pidWindupLimit ?? 100}
                        onChange={(e) => handleParamChange('pidWindupLimit', parseFloat(e.target.value) || 100)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min. Ausgang (%)</label>
                      <input
                        type="number"
                        value={localParams.pidMinOutput ?? 0}
                        onChange={(e) => handleParamChange('pidMinOutput', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max. Ausgang (%)</label>
                      <input
                        type="number"
                        value={localParams.pidMaxOutput ?? 100}
                        onChange={(e) => handleParamChange('pidMaxOutput', parseFloat(e.target.value) || 100)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
