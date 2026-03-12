import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings } from 'lucide-react';

type WidgetSizePreset = 'small' | 'medium' | 'large';

const getSizeValues = (size: WidgetSizePreset | undefined) => {
  switch (size) {
    case 'small': return { symbolSize: 40, maxWidth: 55, maxHeight: 55, fontSize: 'text-[10px]' };
    case 'large': return { symbolSize: 80, maxWidth: 100, maxHeight: 100, fontSize: 'text-sm' };
    case 'medium':
    default: return { symbolSize: 55, maxWidth: 70, maxHeight: 70, fontSize: 'text-xs' };
  }
};

interface HeatingCurveWidgetConfig {
  hcName?: string;
  normalColor?: string;
  activeColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  showInput?: boolean;
  showOutput?: boolean;
  widgetSize?: WidgetSizePreset;
}

interface HeatingCurveValues {
  outputValue: number;
  inputValue: number;
  enable: boolean;
}

interface HeatingCurveParams {
  hcMinInput?: number;
  hcMaxInput?: number;
  hcMinOutput?: number;
  hcMaxOutput?: number;
  hcReverseDirection?: boolean;
  hcName?: string;
}

interface VisuHeatingCurveProps {
  config: HeatingCurveWidgetConfig;
  value: HeatingCurveValues | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: HeatingCurveParams;
}

const HeatingCurveSymbol: React.FC<{ color: string; size: number; active: boolean; reverse: boolean }> = ({ color, size, active, reverse }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', background: 'transparent' }}>
    <rect x="10" y="10" width="80" height="80" rx="6" stroke={color} strokeWidth="3" fill={active ? color : 'transparent'} fillOpacity={active ? 0.15 : 0} />
    <line x1="20" y1="80" x2="80" y2="80" stroke={color} strokeWidth="2" />
    <line x1="20" y1="80" x2="20" y2="20" stroke={color} strokeWidth="2" />
    {reverse ? (
      <line x1="20" y1="30" x2="75" y2="75" stroke={color} strokeWidth="3" strokeLinecap="round" />
    ) : (
      <line x1="20" y1="75" x2="75" y2="30" stroke={color} strokeWidth="3" strokeLinecap="round" />
    )}
    <polygon points="80,77 80,83 74,80" fill={color} />
    <polygon points="17,20 23,20 20,14" fill={color} />
  </svg>
);

const CurveGraph: React.FC<{
  minInput: number;
  maxInput: number;
  minOutput: number;
  maxOutput: number;
  reverse: boolean;
  inputValue: number;
  outputValue: number;
  color: string;
}> = ({ minInput, maxInput, minOutput, maxOutput, reverse, inputValue, outputValue, color }) => {
  const width = 320;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const inputRange = maxInput - minInput;
  const outputRange = maxOutput - minOutput;

  const xScale = (val: number) => padding.left + ((val - minInput) / inputRange) * graphWidth;
  const yScale = (val: number) => padding.top + graphHeight - ((val - minOutput) / outputRange) * graphHeight;

  const lineStart = reverse
    ? { x: xScale(minInput), y: yScale(maxOutput) }
    : { x: xScale(minInput), y: yScale(minOutput) };
  const lineEnd = reverse
    ? { x: xScale(maxInput), y: yScale(minOutput) }
    : { x: xScale(maxInput), y: yScale(maxOutput) };

  const clampedInput = Math.max(minInput, Math.min(maxInput, inputValue));
  const pointX = xScale(clampedInput);
  const pointY = yScale(outputValue);

  const xTicks = 5;
  const yTicks = 5;

  return (
    <svg width={width} height={height} className="bg-slate-800/50 rounded-lg">
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect x={padding.left} y={padding.top} width={graphWidth} height={graphHeight} fill="transparent" stroke="#475569" strokeWidth="1" />

      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const val = minInput + (inputRange / xTicks) * i;
        const x = xScale(val);
        return (
          <g key={`x-${i}`}>
            <line x1={x} y1={padding.top} x2={x} y2={padding.top + graphHeight} stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
            <text x={x} y={height - 10} textAnchor="middle" fontSize="10" fill="#94a3b8">{val.toFixed(0)}</text>
          </g>
        );
      })}

      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const val = minOutput + (outputRange / yTicks) * i;
        const y = yScale(val);
        return (
          <g key={`y-${i}`}>
            <line x1={padding.left} y1={y} x2={padding.left + graphWidth} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{val.toFixed(0)}</text>
          </g>
        );
      })}

      <line x1={lineStart.x} y1={lineStart.y} x2={lineEnd.x} y2={lineEnd.y} stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" />

      <line x1={pointX} y1={padding.top} x2={pointX} y2={padding.top + graphHeight} stroke="#64748b" strokeWidth="1" strokeDasharray="4,4" />
      <line x1={padding.left} y1={pointY} x2={padding.left + graphWidth} y2={pointY} stroke="#64748b" strokeWidth="1" strokeDasharray="4,4" />

      <circle cx={pointX} cy={pointY} r="8" fill={color} stroke="#fff" strokeWidth="2" />
      <circle cx={pointX} cy={pointY} r="3" fill="#fff" />

      <text x={width / 2} y={height - 2} textAnchor="middle" fontSize="11" fill="#94a3b8">Eingang</text>
      <text x="12" y={height / 2} textAnchor="middle" fontSize="11" fill="#94a3b8" transform={`rotate(-90, 12, ${height / 2})`}>Ausgang</text>
    </svg>
  );
};

export const VisuHeatingCurve: React.FC<VisuHeatingCurveProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localParams, setLocalParams] = useState<HeatingCurveParams>({});

  const outputValue = value?.outputValue ?? 0;
  const inputValue = value?.inputValue ?? 0;
  const enable = value?.enable ?? true;

  const minInput = params?.hcMinInput ?? -20;
  const maxInput = params?.hcMaxInput ?? 20;
  const minOutput = params?.hcMinOutput ?? 20;
  const maxOutput = params?.hcMaxOutput ?? 80;
  const reverseDirection = params?.hcReverseDirection !== false;

  useEffect(() => {
    if (params) {
      setLocalParams(params);
    }
  }, [params]);

  const getStatusColor = useCallback(() => {
    if (enable) return config.activeColor || '#f97316';
    return config.normalColor || '#64748b';
  }, [enable, config]);

  const handleClick = useCallback(() => {
    if (!isEditMode) {
      setShowPopup(true);
    }
  }, [isEditMode]);

  const handleParamChange = useCallback((key: string, val: number | boolean) => {
    setLocalParams(prev => ({ ...prev, [key]: val }));
    onValueChange?.({ heatingCurveControl: { [`param_${key}`]: val } });
  }, [onValueChange]);

  const statusColor = getStatusColor();
  const hcName = config.hcName || params?.hcName || 'Heizkurve';
  const rotation = config.rotation ?? 0;
  const sizeValues = getSizeValues(config.widgetSize);
  const showInputDisplay = config.showInput !== false;
  const showOutputDisplay = config.showOutput !== false;

  return (
    <>
      <div
        className="w-full h-full flex flex-col items-center justify-center cursor-pointer select-none relative"
        onClick={handleClick}
        style={{ backgroundColor: 'transparent' }}
      >
        {!enable && (
          <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[9px] font-bold z-10 bg-slate-600 text-white">
            AUS
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
          <HeatingCurveSymbol
            color={statusColor}
            size={sizeValues.symbolSize}
            active={enable}
            reverse={reverseDirection}
          />
        </div>
        <div className={`${sizeValues.fontSize} text-center text-slate-300 truncate w-full px-1`}>
          {hcName}
        </div>
        {showOutputDisplay && (
          <div className={`${sizeValues.fontSize} font-semibold`} style={{ color: statusColor }}>
            {outputValue.toFixed(1)}
          </div>
        )}
      </div>

      {showPopup && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center"
          style={{ zIndex: 99999 }}
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
                  <HeatingCurveSymbol color={statusColor} size={28} active={enable} reverse={reverseDirection} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{hcName}</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-300">Ausgang: {outputValue.toFixed(1)}</span>
                    {!enable && <span className="text-slate-500">| Deaktiviert</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-orange-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
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
              <div className="flex justify-center">
                <CurveGraph
                  minInput={localParams.hcMinInput ?? minInput}
                  maxInput={localParams.hcMaxInput ?? maxInput}
                  minOutput={localParams.hcMinOutput ?? minOutput}
                  maxOutput={localParams.hcMaxOutput ?? maxOutput}
                  reverse={localParams.hcReverseDirection ?? reverseDirection}
                  inputValue={inputValue}
                  outputValue={outputValue}
                  color={statusColor}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {showInputDisplay && (
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Eingang</div>
                    <div className="text-xl font-bold text-blue-400">{inputValue.toFixed(1)}</div>
                  </div>
                )}
                {showOutputDisplay && (
                  <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Ausgang</div>
                    <div className="text-xl font-bold" style={{ color: statusColor }}>{outputValue.toFixed(1)}</div>
                  </div>
                )}
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Eingangsbereich:</span>
                    <span className="text-white ml-2">{localParams.hcMinInput ?? minInput} ... {localParams.hcMaxInput ?? maxInput}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Ausgangsbereich:</span>
                    <span className="text-white ml-2">{localParams.hcMinOutput ?? minOutput} ... {localParams.hcMaxOutput ?? maxOutput}</span>
                  </div>
                </div>
              </div>

              {showSettings && (
                <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-medium text-orange-300 flex items-center gap-2">
                    <Settings size={16} /> Heizkurven Parameter
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min. Eingang</label>
                      <input
                        type="number"
                        step="any"
                        value={localParams.hcMinInput ?? minInput}
                        onChange={(e) => handleParamChange('hcMinInput', parseFloat(e.target.value) || -20)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max. Eingang</label>
                      <input
                        type="number"
                        step="any"
                        value={localParams.hcMaxInput ?? maxInput}
                        onChange={(e) => handleParamChange('hcMaxInput', parseFloat(e.target.value) || 20)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min. Ausgang</label>
                      <input
                        type="number"
                        step="any"
                        value={localParams.hcMinOutput ?? minOutput}
                        onChange={(e) => handleParamChange('hcMinOutput', parseFloat(e.target.value) || 20)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Max. Ausgang</label>
                      <input
                        type="number"
                        step="any"
                        value={localParams.hcMaxOutput ?? maxOutput}
                        onChange={(e) => handleParamChange('hcMaxOutput', parseFloat(e.target.value) || 80)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
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
