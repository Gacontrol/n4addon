import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RotateCcw, X, Settings, CheckCircle, XCircle } from 'lucide-react';

export type BoolSensorSymbolType = 'filter' | 'frost' | 'humidity' | 'generic' | 'pressure' | 'fire' | 'none';
export type WidgetSizePreset = 'small' | 'medium' | 'large';

const getSizeValues = (size: WidgetSizePreset | undefined) => {
  switch (size) {
    case 'small': return { symbolSize: 35, maxWidth: 50, maxHeight: 50, fontSize: 'text-[9px]', iconSize: 10 };
    case 'large': return { symbolSize: 70, maxWidth: 90, maxHeight: 90, fontSize: 'text-sm', iconSize: 18 };
    case 'medium':
    default: return { symbolSize: 50, maxWidth: 65, maxHeight: 65, fontSize: 'text-xs', iconSize: 14 };
  }
};

interface BoolSensorWidgetConfig {
  boolSensorName?: string;
  normalColor?: string;
  alarmColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  symbolType?: BoolSensorSymbolType;
  showStatus?: boolean;
  widgetSize?: WidgetSizePreset;
  labelPosition?: string;
  fontSize?: number;
}

interface BoolSensorValues {
  signalValue: boolean;
  alarm: boolean;
}

export interface BoolSensorParams {
  boolSensorName?: string;
  boolSensorAlarmOnTrue?: boolean;
  boolSensorMonitoringEnable?: boolean;
  boolSensorAlarmDelayMs?: number;
  boolSensorNormalLabel?: string;
  boolSensorAlarmLabel?: string;
  boolSensorSymbolType?: BoolSensorSymbolType;
}

interface VisuBoolSensorProps {
  config: BoolSensorWidgetConfig;
  value: BoolSensorValues | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: BoolSensorParams;
}

// ── SVG Symbols ──────────────────────────────────────────────────────────────

const FilterSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    {/* Filter funnel */}
    <polygon points="22,28 78,28 58,54 58,76 42,68 42,54" stroke={color} strokeWidth="3.5" fill="transparent" strokeLinejoin="round" />
    <line x1="26" y1="34" x2="74" y2="34" stroke={color} strokeWidth="2.5" />
    <line x1="32" y1="40" x2="68" y2="40" stroke={color} strokeWidth="2.5" />
  </svg>
);

const FrostSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    {/* Snowflake */}
    <line x1="50" y1="18" x2="50" y2="82" stroke={color} strokeWidth="3.5" />
    <line x1="18" y1="50" x2="82" y2="50" stroke={color} strokeWidth="3.5" />
    <line x1="27" y1="27" x2="73" y2="73" stroke={color} strokeWidth="3.5" />
    <line x1="73" y1="27" x2="27" y2="73" stroke={color} strokeWidth="3.5" />
    {/* Snowflake tips */}
    {[[50,18],[50,82],[18,50],[82,50],[27,27],[73,73],[73,27],[27,73]].map(([cx,cy],i) => (
      <circle key={i} cx={cx} cy={cy} r="5" fill={color} />
    ))}
  </svg>
);

const HumiditySymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    {/* Water drop */}
    <path d="M50 22 C50 22 28 50 28 62 C28 74 38 82 50 82 C62 82 72 74 72 62 C72 50 50 22 50 22Z" stroke={color} strokeWidth="3.5" fill="transparent" />
    <text x="50" y="68" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color} fontFamily="Arial">H</text>
  </svg>
);

const PressureSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    <text x="50" y="58" textAnchor="middle" fontSize="38" fontWeight="bold" fill={color} fontFamily="Arial">P</text>
  </svg>
);

const FireSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    {/* Flame */}
    <path d="M50 20 C50 20 60 32 62 44 C66 38 64 28 62 22 C72 32 76 48 68 60 C72 58 74 52 72 46 C80 56 76 76 50 80 C24 76 20 56 28 46 C26 52 28 58 32 60 C24 48 28 32 38 22 C36 28 34 38 38 44 C40 32 50 20 50 20Z" stroke={color} strokeWidth="2.5" fill="transparent" />
  </svg>
);

const GenericBoolSymbol: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="4" fill="transparent" />
    <circle cx="50" cy="50" r="14" fill={color} />
  </svg>
);

const BoolSensorSymbol: React.FC<{ symbolType: BoolSensorSymbolType; color: string; size: number }> = ({ symbolType, color, size }) => {
  switch (symbolType) {
    case 'filter':   return <FilterSymbol color={color} size={size} />;
    case 'frost':    return <FrostSymbol color={color} size={size} />;
    case 'humidity': return <HumiditySymbol color={color} size={size} />;
    case 'pressure': return <PressureSymbol color={color} size={size} />;
    case 'fire':     return <FireSymbol color={color} size={size} />;
    case 'generic':  return <GenericBoolSymbol color={color} size={size} />;
    case 'none':
    default: return null;
  }
};

const SYMBOL_LABELS: Record<BoolSensorSymbolType, string> = {
  filter:   'Filterueberwachung',
  frost:    'Frostschutzueberwachung',
  humidity: 'Hygrostatabsicherung',
  pressure: 'Druckueberwachung',
  fire:     'Brandmeldung',
  generic:  'Bool-Signal',
  none:     'Signal',
};

// ── Component ────────────────────────────────────────────────────────────────

export const VisuBoolSensor: React.FC<VisuBoolSensorProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params,
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localParams, setLocalParams] = useState<BoolSensorParams>({});

  const signalValue = value?.signalValue ?? false;
  const alarm = value?.alarm ?? false;

  const symbolType: BoolSensorSymbolType = (config.symbolType as BoolSensorSymbolType) || (params?.boolSensorSymbolType) || 'filter';
  const alarmOnTrue = params?.boolSensorAlarmOnTrue !== false;
  const normalLabel = params?.boolSensorNormalLabel || 'OK';
  const alarmLabel = params?.boolSensorAlarmLabel || 'ALARM';

  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (showPopup && paramsRef.current) setLocalParams(paramsRef.current);
  }, [showPopup]);

  const getStatusColor = useCallback(() => {
    if (alarm) return config.alarmColor || '#ef4444';
    return config.normalColor || '#d97706';
  }, [alarm, config]);

  const handleClick = useCallback(() => {
    if (!isEditMode) setShowPopup(true);
  }, [isEditMode]);

  const handleReset = useCallback(() => {
    onValueChange?.({ boolSensorControl: { reset: true } });
    setTimeout(() => onValueChange?.({ boolSensorControl: { reset: false } }), 100);
  }, [onValueChange]);

  const handleParamChange = useCallback((key: string, val: number | boolean | string) => {
    setLocalParams(prev => ({ ...prev, [key]: val }));
    onValueChange?.({ boolSensorControl: { [`param_${key}`]: val } });
  }, [onValueChange]);

  const statusColor = getStatusColor();
  const sensorName = config.boolSensorName || params?.boolSensorName || SYMBOL_LABELS[symbolType];
  const rotation = config.rotation ?? 0;
  const sizeValues = getSizeValues(config.widgetSize);
  const showStatus = config.showStatus !== false;
  const hasSymbol = symbolType !== 'none';
  const labelPos = config.labelPosition || 'bottom';
  const textFontSize = config.fontSize ? `${config.fontSize}px` : undefined;
  const isHorizontal = labelPos === 'left' || labelPos === 'right';

  const statusText = alarm ? alarmLabel : normalLabel;
  const statusTextColor = alarm ? '#ef4444' : '#22c55e';

  const labelEl = labelPos !== 'none' ? (
    <div className={`${sizeValues.fontSize} text-center text-slate-300 truncate px-1`} style={{ fontSize: textFontSize }}>
      {sensorName}
      {showStatus && (
        <span className="font-semibold ml-1" style={{ color: statusTextColor }}>
          {statusText}
        </span>
      )}
    </div>
  ) : null;

  const symbolEl = hasSymbol ? (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{
        width: '70%', height: '50%',
        maxWidth: sizeValues.maxWidth, maxHeight: sizeValues.maxHeight,
        transform: `rotate(${rotation}deg)`
      }}
    >
      <BoolSensorSymbol symbolType={symbolType} color={statusColor} size={sizeValues.symbolSize} />
      {alarm && (
        <div className="absolute -top-1 -right-1" style={{ transform: `rotate(-${rotation}deg)` }}>
          <AlertTriangle size={sizeValues.iconSize} className="text-red-500" />
        </div>
      )}
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center">
      {alarm && <div className="absolute top-0.5 right-0.5"><AlertTriangle size={sizeValues.iconSize} className="text-red-500" /></div>}
    </div>
  );

  return (
    <>
      <div
        className={`w-full h-full ${isHorizontal ? 'flex flex-row' : 'flex flex-col'} items-center justify-center cursor-pointer select-none relative`}
        onClick={handleClick}
        style={{ backgroundColor: 'transparent' }}
      >
        {alarm && (
          <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[9px] font-bold z-10 bg-red-600 text-white">
            ALARM
          </div>
        )}
        {(labelPos === 'top' || labelPos === 'left') && labelEl}
        {symbolEl}
        {(labelPos === 'bottom' || labelPos === 'right') && labelEl}
      </div>

      {showPopup && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center"
          style={{ zIndex: 99999 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPopup(false); setShowSettings(false); } }}
        >
          <div
            className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-[420px] max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-slate-700"
              style={{ backgroundColor: statusColor + '20' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: statusColor + '30', border: `2px solid ${statusColor}` }}
                >
                  <BoolSensorSymbol symbolType={symbolType} color={statusColor} size={28} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{sensorName}</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span style={{ color: statusTextColor }} className="font-medium">{statusText}</span>
                    {alarm && <span className="text-red-400">| Alarm aktiv</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-amber-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                  title="Parameter anzeigen"
                >
                  <Settings size={20} />
                </button>
                <button
                  onClick={() => { setShowPopup(false); setShowSettings(false); }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">

              {/* Status display */}
              <div className="bg-slate-700/50 rounded-lg p-5 flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: alarm ? '#ef444420' : '#22c55e20',
                    border: `3px solid ${alarm ? '#ef4444' : '#22c55e'}`
                  }}
                >
                  {alarm
                    ? <XCircle size={36} className="text-red-400" />
                    : <CheckCircle size={36} className="text-green-400" />}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: alarm ? '#ef4444' : '#22c55e' }}>
                    {statusText}
                  </div>
                  <div className="text-sm text-slate-400 mt-0.5">
                    Eingangssignal: <span className="font-mono font-semibold text-white">{signalValue ? 'TRUE' : 'FALSE'}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Alarmausloesung bei: <span className="font-mono text-amber-400">{alarmOnTrue ? 'TRUE' : 'FALSE'}</span>
                  </div>
                </div>

                {/* Signal indicator bar */}
                <div className="w-full mt-2">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>FALSE</span>
                    <span>TRUE</span>
                  </div>
                  <div className="h-4 bg-slate-600 rounded-full overflow-hidden relative">
                    <div
                      className="absolute h-full transition-all duration-500 rounded-full"
                      style={{
                        width: signalValue ? '100%' : '0%',
                        backgroundColor: alarm ? '#ef4444' : '#22c55e'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Alarm panel */}
              {alarm && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={20} />
                      <div>
                        <span className="font-medium block">Alarm aktiv</span>
                        <span className="text-xs text-red-300/70">
                          Signal {alarmOnTrue ? 'HIGH' : 'LOW'} - {SYMBOL_LABELS[symbolType]}
                        </span>
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

              {/* Settings panel */}
              {showSettings && (
                <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-medium text-amber-300 flex items-center gap-2">
                    <Settings size={16} /> Parameter einstellen
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Bezeichnung</label>
                      <input
                        type="text"
                        value={localParams.boolSensorName ?? ''}
                        onChange={(e) => handleParamChange('boolSensorName', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        placeholder="z.B. Filterueberwachung AHU-01"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Text bei Normal</label>
                        <input
                          type="text"
                          value={localParams.boolSensorNormalLabel ?? 'OK'}
                          onChange={(e) => handleParamChange('boolSensorNormalLabel', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Text bei Alarm</label>
                        <input
                          type="text"
                          value={localParams.boolSensorAlarmLabel ?? 'ALARM'}
                          onChange={(e) => handleParamChange('boolSensorAlarmLabel', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Alarmverz. (s)</label>
                        <input
                          type="number"
                          min={0}
                          value={(localParams.boolSensorAlarmDelayMs ?? 5000) / 1000}
                          onChange={(e) => handleParamChange('boolSensorAlarmDelayMs', (parseFloat(e.target.value) || 0) * 1000)}
                          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="block text-xs text-slate-400 mb-1">Alarm bei Signal</label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-600">
                          <button
                            onClick={() => handleParamChange('boolSensorAlarmOnTrue', true)}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${localParams.boolSensorAlarmOnTrue !== false ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                          >
                            TRUE
                          </button>
                          <button
                            onClick={() => handleParamChange('boolSensorAlarmOnTrue', false)}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${localParams.boolSensorAlarmOnTrue === false ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                          >
                            FALSE
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="boolMonEnable"
                        checked={localParams.boolSensorMonitoringEnable !== false}
                        onChange={(e) => handleParamChange('boolSensorMonitoringEnable', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 accent-amber-500"
                      />
                      <label htmlFor="boolMonEnable" className="text-sm text-slate-300">Ueberwachung aktiv</label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
