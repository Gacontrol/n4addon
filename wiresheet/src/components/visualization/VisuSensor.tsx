import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RotateCcw, X, Settings } from 'lucide-react';

export type SensorSymbolType = 'temperature' | 'pressure' | 'humidity' | 'co2' | 'flow' | 'level' | 'generic' | 'none';

interface SensorWidgetConfig {
  sensorName?: string;
  normalColor?: string;
  alarmColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  symbolType?: SensorSymbolType;
  showValue?: boolean;
  showUnit?: boolean;
  showLimits?: boolean;
}

interface SensorValues {
  sensorValue: number;
  alarm: boolean;
}

interface SensorParams {
  sensorMinLimit?: number;
  sensorMaxLimit?: number;
  sensorUnit?: string;
  sensorMonitoringEnable?: boolean;
  sensorAlarmDelayMs?: number;
  sensorName?: string;
}

interface VisuSensorProps {
  config: SensorWidgetConfig;
  value: SensorValues | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: SensorParams;
}

const CircleLetterSymbol: React.FC<{ color: string; size: number; letter: string }> = ({ color, size, letter }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    <text x="50" y="58" textAnchor="middle" fontSize="42" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">{letter}</text>
  </svg>
);

const CO2Symbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    <text x="42" y="56" textAnchor="middle" fontSize="28" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">CO</text>
    <text x="72" y="64" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">2</text>
  </svg>
);

const FlowSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    <text x="50" y="58" textAnchor="middle" fontSize="36" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">Q</text>
  </svg>
);

const LevelSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    <text x="50" y="58" textAnchor="middle" fontSize="36" fontWeight="bold" fill={color} fontFamily="Arial, sans-serif">L</text>
  </svg>
);

const GenericSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    <circle cx="50" cy="50" r="8" fill={color} />
  </svg>
);

const SensorSymbol: React.FC<{ symbolType: SensorSymbolType; color: string; size: number }> = ({ symbolType, color, size }) => {
  switch (symbolType) {
    case 'temperature': return <CircleLetterSymbol color={color} size={size} letter="T" />;
    case 'pressure': return <CircleLetterSymbol color={color} size={size} letter="P" />;
    case 'humidity': return <CircleLetterSymbol color={color} size={size} letter="H" />;
    case 'co2': return <CO2Symbol color={color} size={size} />;
    case 'flow': return <FlowSymbol color={color} size={size} />;
    case 'level': return <LevelSymbol color={color} size={size} />;
    case 'generic': return <GenericSymbol color={color} size={size} />;
    case 'none':
    default: return null;
  }
};

const getDefaultUnitForSymbol = (symbolType: SensorSymbolType): string => {
  switch (symbolType) {
    case 'temperature': return '\u00B0C';
    case 'pressure': return 'bar';
    case 'humidity': return '%rH';
    case 'co2': return 'ppm';
    case 'flow': return 'm\u00B3/h';
    case 'level': return '%';
    default: return '';
  }
};

export const VisuSensor: React.FC<VisuSensorProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localParams, setLocalParams] = useState<SensorParams>({});

  const sensorValue = value?.sensorValue ?? 0;
  const alarm = value?.alarm ?? false;

  const minLimit = params?.sensorMinLimit ?? 0;
  const maxLimit = params?.sensorMaxLimit ?? 100;
  const symbolType = config.symbolType || 'generic';
  const autoUnit = getDefaultUnitForSymbol(symbolType);
  const unit = params?.sensorUnit || autoUnit;

  useEffect(() => {
    if (params) {
      setLocalParams(params);
    }
  }, [params]);

  const getStatusColor = useCallback(() => {
    if (alarm) return config.alarmColor || '#ef4444';
    return config.normalColor || '#0891b2';
  }, [alarm, config]);

  const handleClick = useCallback(() => {
    if (!isEditMode) {
      setShowPopup(true);
    }
  }, [isEditMode]);

  const handleReset = useCallback(() => {
    onValueChange?.({ sensorControl: { reset: true } });
    setTimeout(() => onValueChange?.({ sensorControl: { reset: false } }), 100);
  }, [onValueChange]);

  const handleParamChange = useCallback((key: string, val: number | boolean | string) => {
    setLocalParams(prev => ({ ...prev, [key]: val }));
    onValueChange?.({ sensorControl: { [`param_${key}`]: val } });
  }, [onValueChange]);

  const statusColor = getStatusColor();
  const sensorName = config.sensorName || params?.sensorName || 'Sensor';
  const rotation = config.rotation ?? 0;

  const showValue = config.showValue !== false;
  const showUnit = config.showUnit !== false;
  const showLimits = config.showLimits !== false;
  const hasSymbol = symbolType !== 'none';

  const isOutOfLimits = sensorValue < minLimit || sensorValue > maxLimit;
  const valuePercent = Math.max(0, Math.min(100, ((sensorValue - minLimit) / (maxLimit - minLimit)) * 100));

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
        {hasSymbol ? (
          <div
            className="relative flex items-center justify-center"
            style={{
              width: '70%',
              height: '50%',
              maxWidth: 70,
              maxHeight: 70,
              transform: `rotate(${rotation}deg)`
            }}
          >
            <SensorSymbol
              symbolType={symbolType}
              color={statusColor}
              size={55}
            />
            {alarm && (
              <div className="absolute -top-1 -right-1" style={{ transform: `rotate(-${rotation}deg)` }}>
                <AlertTriangle size={14} className="text-red-500" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            {alarm && (
              <div className="absolute top-0.5 right-0.5">
                <AlertTriangle size={14} className="text-red-500" />
              </div>
            )}
          </div>
        )}
        <div className="text-xs text-center text-slate-300 truncate w-full px-1">
          {sensorName}
        </div>
        {showValue && (
          <div className={`font-semibold ${hasSymbol ? 'text-sm' : 'text-lg'}`} style={{ color: isOutOfLimits ? '#ef4444' : statusColor }}>
            {sensorValue.toFixed(1)}{showUnit && unit ? ` ${unit}` : ''}
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
            className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-[400px] max-h-[90vh] overflow-hidden"
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
                  <SensorSymbol symbolType={symbolType} color={statusColor} size={28} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{sensorName}</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-300">{sensorValue.toFixed(1)} {unit}</span>
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
              <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-4xl font-bold" style={{ color: isOutOfLimits ? '#ef4444' : statusColor }}>
                  {sensorValue.toFixed(1)}
                </div>
                <div className="text-lg text-slate-400 mt-1">{unit || 'Einheit'}</div>
              </div>

              {showLimits && (
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Grenzwerte</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Min: {minLimit} {unit}</span>
                      <span>Max: {maxLimit} {unit}</span>
                    </div>
                    <div className="h-4 bg-slate-600 rounded-full overflow-hidden relative">
                      <div
                        className="absolute h-full transition-all"
                        style={{
                          left: 0,
                          width: `${valuePercent}%`,
                          backgroundColor: isOutOfLimits ? '#ef4444' : statusColor
                        }}
                      />
                      <div
                        className="absolute h-full w-0.5 bg-white/50"
                        style={{ left: '0%' }}
                      />
                      <div
                        className="absolute h-full w-0.5 bg-white/50"
                        style={{ left: '100%' }}
                      />
                    </div>
                    <div className="text-center text-sm">
                      {isOutOfLimits ? (
                        <span className="text-red-400 font-medium">Ausserhalb Grenzwerte!</span>
                      ) : (
                        <span className="text-green-400">Im Normalbereich</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {alarm && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={20} />
                      <div>
                        <span className="font-medium block">Sensoralarm aktiv</span>
                        <span className="text-xs text-red-300/70">Grenzwert ueberschritten</span>
                      </div>
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
                      <label className="block text-xs text-slate-400 mb-1">Min. Grenzwert</label>
                      <input
                        type="number"
                        value={localParams.sensorMinLimit ?? 0}
                        onChange={(e) => handleParamChange('sensorMinLimit', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max. Grenzwert</label>
                      <input
                        type="number"
                        value={localParams.sensorMaxLimit ?? 100}
                        onChange={(e) => handleParamChange('sensorMaxLimit', parseFloat(e.target.value) || 100)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Einheit</label>
                      <input
                        type="text"
                        value={localParams.sensorUnit ?? ''}
                        onChange={(e) => handleParamChange('sensorUnit', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        placeholder="z.B. C, Pa, ppm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Alarmverzoegerung (s)</label>
                      <input
                        type="number"
                        value={(localParams.sensorAlarmDelayMs ?? 5000) / 1000}
                        onChange={(e) => handleParamChange('sensorAlarmDelayMs', (parseFloat(e.target.value) || 5) * 1000)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="sensorMonitoringEnable"
                        checked={localParams.sensorMonitoringEnable !== false}
                        onChange={(e) => handleParamChange('sensorMonitoringEnable', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600"
                      />
                      <label htmlFor="sensorMonitoringEnable" className="text-sm text-slate-300">Ueberwachung aktiv</label>
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
