import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RotateCcw, X, Settings, Sliders } from 'lucide-react';
import { ValveWidgetConfig, ValveSymbolType } from '../../types/visualization';

interface ValveValues {
  valveOutput: number;
  setpoint: number;
  feedback: number;
  alarm: boolean;
  deviation: number;
}

interface ValveParams {
  valveMinOutput?: number;
  valveMaxOutput?: number;
  valveMonitoringEnable?: boolean;
  valveTolerance?: number;
  valveAlarmDelayMs?: number;
  valveName?: string;
}

interface VisuValveProps {
  config: ValveWidgetConfig;
  value: ValveValues | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: ValveParams;
}

const Valve2WaySymbol: React.FC<{ color: string; openPercent: number; size: number }> = ({ color, openPercent, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <polygon points="10,25 50,50 10,75" fill={openPercent > 0 ? color : 'transparent'} stroke={color} strokeWidth="3" strokeLinejoin="round" fillOpacity={openPercent / 100} />
    <polygon points="90,25 50,50 90,75" fill={openPercent > 0 ? color : 'transparent'} stroke={color} strokeWidth="3" strokeLinejoin="round" fillOpacity={openPercent / 100} />
    <line x1="50" y1="50" x2="50" y2="15" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <rect x="40" y="5" width="20" height="12" rx="2" fill={openPercent > 50 ? color : 'transparent'} stroke={color} strokeWidth="2" />
  </svg>
);

const Valve3WaySymbol: React.FC<{ color: string; openPercent: number; size: number }> = ({ color, openPercent, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <polygon points="10,30 50,50 10,70" fill={openPercent > 0 ? color : 'transparent'} stroke={color} strokeWidth="3" strokeLinejoin="round" fillOpacity={openPercent / 100} />
    <polygon points="90,30 50,50 90,70" fill={openPercent > 0 ? color : 'transparent'} stroke={color} strokeWidth="3" strokeLinejoin="round" fillOpacity={openPercent / 100} />
    <polygon points="35,90 50,50 65,90" fill={openPercent > 0 ? color : 'transparent'} stroke={color} strokeWidth="3" strokeLinejoin="round" fillOpacity={(100 - openPercent) / 100} />
    <line x1="50" y1="50" x2="50" y2="15" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <rect x="40" y="5" width="20" height="12" rx="2" fill={openPercent > 50 ? color : 'transparent'} stroke={color} strokeWidth="2" />
  </svg>
);

const ValveMotorSymbol: React.FC<{ color: string; openPercent: number; size: number }> = ({ color, openPercent, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <polygon points="10,40 50,60 10,80" fill={openPercent > 0 ? color : 'transparent'} stroke={color} strokeWidth="3" strokeLinejoin="round" fillOpacity={openPercent / 100} />
    <polygon points="90,40 50,60 90,80" fill={openPercent > 0 ? color : 'transparent'} stroke={color} strokeWidth="3" strokeLinejoin="round" fillOpacity={openPercent / 100} />
    <line x1="50" y1="60" x2="50" y2="35" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <circle cx="50" cy="22" r="15" stroke={color} strokeWidth="2" fill="transparent" />
    <text x="50" y="27" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>M</text>
  </svg>
);

const ValveButterflySymbol: React.FC<{ color: string; openPercent: number; size: number }> = ({ color, openPercent, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <circle cx="50" cy="50" r="35" stroke={color} strokeWidth="3" fill="transparent" />
    <line x1="15" y1="50" x2="85" y2="50" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <line
      x1="50" y1={50 - 25 * (openPercent / 100)}
      x2="50" y2={50 + 25 * (openPercent / 100)}
      stroke={color} strokeWidth="4" strokeLinecap="round"
      transform={`rotate(${90 - openPercent * 0.9}, 50, 50)`}
    />
    <line x1="50" y1="15" x2="50" y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const ValveBallSymbol: React.FC<{ color: string; openPercent: number; size: number }> = ({ color, openPercent, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <rect x="5" y="35" width="25" height="30" stroke={color} strokeWidth="2" fill="transparent" />
    <rect x="70" y="35" width="25" height="30" stroke={color} strokeWidth="2" fill="transparent" />
    <circle cx="50" cy="50" r="20" stroke={color} strokeWidth="3" fill={openPercent > 50 ? color : 'transparent'} fillOpacity={openPercent / 100} />
    <rect x="40" y="45" width="20" height="10" fill={openPercent > 0 ? color : 'transparent'} fillOpacity={openPercent / 100} transform={`rotate(${90 - openPercent * 0.9}, 50, 50)`} />
    <line x1="50" y1="30" x2="50" y2="10" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const ValveGateSymbol: React.FC<{ color: string; openPercent: number; size: number }> = ({ color, openPercent, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <rect x="5" y="40" width="30" height="20" stroke={color} strokeWidth="2" fill="transparent" />
    <rect x="65" y="40" width="30" height="20" stroke={color} strokeWidth="2" fill="transparent" />
    <rect x="35" y="25" width="30" height="50" stroke={color} strokeWidth="3" fill="transparent" />
    <rect x="38" y={25 + 45 * (1 - openPercent / 100)} width="24" height={45 * (openPercent / 100)} fill={color} fillOpacity={0.5} />
    <line x1="50" y1="25" x2="50" y2="10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    <circle cx="50" cy="7" r="5" stroke={color} strokeWidth="2" fill="transparent" />
  </svg>
);

const ValveSymbol: React.FC<{ symbolType: ValveSymbolType; color: string; openPercent: number; size: number }> = ({ symbolType, color, openPercent, size }) => {
  switch (symbolType) {
    case 'valve-3way': return <Valve3WaySymbol color={color} openPercent={openPercent} size={size} />;
    case 'valve-motor': return <ValveMotorSymbol color={color} openPercent={openPercent} size={size} />;
    case 'valve-butterfly': return <ValveButterflySymbol color={color} openPercent={openPercent} size={size} />;
    case 'valve-ball': return <ValveBallSymbol color={color} openPercent={openPercent} size={size} />;
    case 'valve-gate': return <ValveGateSymbol color={color} openPercent={openPercent} size={size} />;
    case 'valve-2way':
    default: return <Valve2WaySymbol color={color} openPercent={openPercent} size={size} />;
  }
};

export const VisuValve: React.FC<VisuValveProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localParams, setLocalParams] = useState<ValveParams>({});
  const [localSetpoint, setLocalSetpoint] = useState<number>(0);

  const valveOutput = value?.valveOutput ?? 0;
  const setpoint = value?.setpoint ?? 0;
  const feedback = value?.feedback ?? 0;
  const alarm = value?.alarm ?? false;
  const deviation = value?.deviation ?? 0;

  const minOutput = params?.valveMinOutput ?? 0;
  const maxOutput = params?.valveMaxOutput ?? 100;

  useEffect(() => {
    if (params) {
      setLocalParams(params);
    }
  }, [params]);

  useEffect(() => {
    setLocalSetpoint(setpoint);
  }, [setpoint]);

  const getStatusColor = useCallback(() => {
    if (alarm) return config.alarmColor || '#ef4444';
    return config.normalColor || '#3b82f6';
  }, [alarm, config]);

  const handleClick = useCallback(() => {
    if (!isEditMode) {
      setShowPopup(true);
    }
  }, [isEditMode]);

  const handleReset = useCallback(() => {
    onValueChange?.({ valveControl: { reset: true } });
    setTimeout(() => onValueChange?.({ valveControl: { reset: false } }), 100);
  }, [onValueChange]);

  const handleSetpointChange = useCallback((newSetpoint: number) => {
    setLocalSetpoint(newSetpoint);
    onValueChange?.({ valveControl: { setpoint: newSetpoint } });
  }, [onValueChange]);

  const handleParamChange = useCallback((key: string, val: number | boolean) => {
    setLocalParams(prev => ({ ...prev, [key]: val }));
    onValueChange?.({ valveControl: { [`param_${key}`]: val } });
  }, [onValueChange]);

  const statusColor = getStatusColor();
  const valveName = config.valveName || params?.valveName || 'Ventil';
  const symbolType = config.symbolType || 'valve-2way';
  const orientation = config.orientation || 'horizontal';

  return (
    <>
      <div
        className="w-full h-full flex flex-col items-center justify-center cursor-pointer select-none relative"
        onClick={handleClick}
        style={{ backgroundColor: 'transparent' }}
      >
        {alarm && (
          <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[9px] font-bold z-10 bg-red-600 text-white">
            ALARM
          </div>
        )}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: '70%',
            height: '60%',
            maxWidth: 80,
            maxHeight: 80,
            transform: orientation === 'vertical' ? 'rotate(90deg)' : 'none'
          }}
        >
          <ValveSymbol
            symbolType={symbolType}
            color={statusColor}
            openPercent={valveOutput}
            size={60}
          />
          {alarm && (
            <div className="absolute -top-1 -right-1" style={{ transform: orientation === 'vertical' ? 'rotate(-90deg)' : 'none' }}>
              <AlertTriangle size={14} className="text-red-500" />
            </div>
          )}
        </div>
        <div className="text-xs text-center text-slate-300 truncate w-full px-1">
          {valveName}
        </div>
        <div className="text-xs text-slate-400">
          {valveOutput.toFixed(0)}%
        </div>
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
            className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-[450px] max-h-[90vh] overflow-hidden"
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
                  <ValveSymbol symbolType={symbolType} color={statusColor} openPercent={valveOutput} size={28} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{valveName}</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-300">{valveOutput.toFixed(0)}% offen</span>
                    {alarm && <span className="text-red-400">| Alarm</span>}
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
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {setpoint.toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Sollwert</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {feedback.toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Rueckmeldung</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: statusColor }}>
                    {valveOutput.toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Stellwert</div>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Sliders size={16} /> Sollwert einstellen
                </h3>
                <div className="space-y-3">
                  <input
                    type="range"
                    min={minOutput}
                    max={maxOutput}
                    value={localSetpoint}
                    onChange={(e) => handleSetpointChange(Number(e.target.value))}
                    className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={minOutput}
                      max={maxOutput}
                      value={localSetpoint}
                      onChange={(e) => handleSetpointChange(Number(e.target.value))}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center"
                    />
                    <span className="text-slate-400">%</span>
                  </div>
                  <div className="flex gap-2">
                    {[0, 25, 50, 75, 100].map(preset => (
                      <button
                        key={preset}
                        onClick={() => handleSetpointChange(preset)}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          localSetpoint === preset
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Abweichung</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(deviation, 100)}%`,
                        backgroundColor: deviation > (localParams.valveTolerance ?? 5) ? '#ef4444' : '#22c55e'
                      }}
                    />
                  </div>
                  <span className={`text-lg font-bold ${deviation > (localParams.valveTolerance ?? 5) ? 'text-red-400' : 'text-green-400'}`}>
                    {deviation.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Toleranz: {localParams.valveTolerance ?? 5}%
                </div>
              </div>

              {alarm && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={20} />
                      <span className="font-medium">Ventilalarm aktiv</span>
                    </div>
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium transition-colors"
                    >
                      <RotateCcw size={16} />
                      Quittieren
                    </button>
                  </div>
                </div>
              )}

              {showSettings && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-medium text-blue-300 flex items-center gap-2">
                    <Settings size={16} /> Parameter einstellen
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min. Ausgang (%)</label>
                      <input
                        type="number"
                        value={localParams.valveMinOutput ?? 0}
                        onChange={(e) => handleParamChange('valveMinOutput', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max. Ausgang (%)</label>
                      <input
                        type="number"
                        value={localParams.valveMaxOutput ?? 100}
                        onChange={(e) => handleParamChange('valveMaxOutput', parseInt(e.target.value) || 100)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Toleranz (%)</label>
                      <input
                        type="number"
                        value={localParams.valveTolerance ?? 5}
                        onChange={(e) => handleParamChange('valveTolerance', parseInt(e.target.value) || 5)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Alarmverzoegerung (s)</label>
                      <input
                        type="number"
                        value={(localParams.valveAlarmDelayMs ?? 10000) / 1000}
                        onChange={(e) => handleParamChange('valveAlarmDelayMs', (parseInt(e.target.value) || 10) * 1000)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="monitoringEnable"
                        checked={localParams.valveMonitoringEnable !== false}
                        onChange={(e) => handleParamChange('valveMonitoringEnable', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600"
                      />
                      <label htmlFor="monitoringEnable" className="text-sm text-slate-300">Ueberwachung aktiv</label>
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
