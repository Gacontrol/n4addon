import React, { useState, useEffect, useCallback } from 'react';
import { Fan, AlertTriangle, Wrench, Power, RotateCcw, X, Settings, Play, Pause, ChevronRight } from 'lucide-react';
import { PumpWidgetConfig } from '../../types/visualization';

interface PumpValues {
  pumpCmd: boolean;
  speedOut: number;
  running: boolean;
  fault: boolean;
  ready: boolean;
  alarm: boolean;
  opHours: number;
  starts: number;
  hoaMode: number;
  revision: boolean;
  handStart: boolean;
}

interface PumpParams {
  pumpStartDelayMs?: number;
  pumpStopDelayMs?: number;
  pumpFeedbackTimeoutMs?: number;
  pumpEnableFeedback?: boolean;
  pumpSpeedMin?: number;
  pumpSpeedMax?: number;
  pumpAntiSeizeIntervalMs?: number;
  pumpAntiSeizeRunMs?: number;
  pumpAntiSeizeSpeed?: number;
  pumpName?: string;
}

interface VisuPumpProps {
  config: PumpWidgetConfig;
  value: PumpValues | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: PumpParams;
}

export const VisuPump: React.FC<VisuPumpProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [localParams, setLocalParams] = useState<PumpParams>({});

  const running = value?.running ?? false;
  const fault = value?.fault ?? false;
  const alarm = value?.alarm ?? false;
  const ready = value?.ready ?? true;
  const pumpCmd = value?.pumpCmd ?? false;
  const speedOut = value?.speedOut ?? 0;
  const opHours = value?.opHours ?? 0;
  const starts = value?.starts ?? 0;
  const hoaMode = value?.hoaMode ?? 2;
  const revision = value?.revision ?? false;
  const handStart = value?.handStart ?? false;

  useEffect(() => {
    if (params) {
      setLocalParams(params);
    }
  }, [params]);

  useEffect(() => {
    if (running) {
      const speed = Math.max(1, speedOut / 10);
      const interval = setInterval(() => {
        setRotation(r => (r + speed) % 360);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [running, speedOut]);

  const getStatusColor = useCallback(() => {
    if (fault || alarm) return config.faultColor || '#ef4444';
    if (revision) return config.revisionColor || '#f59e0b';
    if (running) return config.runningColor || '#22c55e';
    return config.stoppedColor || '#64748b';
  }, [fault, alarm, revision, running, config]);

  const handleClick = useCallback(() => {
    if (!isEditMode) {
      setShowPopup(true);
    }
  }, [isEditMode]);

  const handleHOAChange = useCallback((mode: number) => {
    onValueChange?.({ hoaMode: mode });
  }, [onValueChange]);

  const handleReset = useCallback(() => {
    onValueChange?.({ reset: true });
    setTimeout(() => onValueChange?.({ reset: false }), 100);
  }, [onValueChange]);

  const handleHandStart = useCallback((active: boolean) => {
    onValueChange?.({ handStart: active });
  }, [onValueChange]);

  const handleParamChange = useCallback((key: string, val: number | boolean) => {
    setLocalParams(prev => ({ ...prev, [key]: val }));
    onValueChange?.({ [`param_${key}`]: val });
  }, [onValueChange]);

  const statusColor = getStatusColor();

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${hours.toFixed(1)} h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(0)}h`;
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
    if (ms < 86400000) return `${(ms / 3600000).toFixed(1)} h`;
    return `${(ms / 86400000).toFixed(1)} d`;
  };

  const pumpName = params?.pumpName || config.pumpName || 'Pumpe';

  return (
    <>
      <div
        className="w-full h-full flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={handleClick}
        style={{ backgroundColor: 'transparent' }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            width: '70%',
            height: '70%',
            maxWidth: 80,
            maxHeight: 80
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: `${statusColor}20`,
              border: `3px solid ${statusColor}`,
              boxShadow: running ? `0 0 20px ${statusColor}60` : 'none',
              transition: 'all 0.3s ease'
            }}
          />
          <Fan
            size={40}
            style={{
              color: statusColor,
              transform: `rotate(${rotation}deg)`,
              transition: running ? 'none' : 'transform 0.3s ease'
            }}
          />
          {(fault || alarm) && (
            <div className="absolute -top-1 -right-1">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
          )}
          {revision && !fault && !alarm && (
            <div className="absolute -top-1 -right-1">
              <Wrench size={14} className="text-amber-500" />
            </div>
          )}
        </div>
        <div className="mt-1 text-xs text-center text-slate-300 truncate w-full px-1">
          {pumpName}
        </div>
        {config.showSpeed && running && (
          <div className="text-xs text-slate-400">
            {speedOut.toFixed(0)}%
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
            className="bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-[500px] max-h-[90vh] overflow-hidden"
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
                  <Fan
                    size={24}
                    style={{
                      color: statusColor,
                      transform: `rotate(${rotation}deg)`
                    }}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{pumpName}</h2>
                  <div className="flex items-center gap-2 text-sm">
                    {running ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <Play size={12} /> Laeuft
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1">
                        <Pause size={12} /> Gestoppt
                      </span>
                    )}
                    {(fault || alarm) && <span className="text-red-400">| Stoerung</span>}
                    {revision && <span className="text-amber-400">| Revision</span>}
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
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold" style={{ color: statusColor }}>
                    {running ? 'EIN' : 'AUS'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Status</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {speedOut.toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Drehzahl</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-slate-200">
                    {formatHours(opHours)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Betriebsstd.</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-slate-200">
                    {starts}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Starts</div>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <Power size={16} /> Betriebsart (HOA)
                </h3>
                <div className="flex gap-2">
                  {[
                    { value: 0, label: 'AUS', color: '#64748b' },
                    { value: 1, label: 'HAND', color: '#f59e0b' },
                    { value: 2, label: 'AUTO', color: '#22c55e' }
                  ].map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => handleHOAChange(mode.value)}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all ${
                        hoaMode === mode.value
                          ? 'ring-2 ring-offset-2 ring-offset-slate-800'
                          : 'hover:bg-slate-600'
                      }`}
                      style={{
                        backgroundColor: hoaMode === mode.value ? mode.color : '#475569',
                        color: hoaMode === mode.value ? 'white' : '#94a3b8',
                        ringColor: mode.color
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {hoaMode === 1 && (
                <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-amber-300 mb-3">Handbetrieb</h3>
                  <button
                    onMouseDown={() => handleHandStart(true)}
                    onMouseUp={() => handleHandStart(false)}
                    onMouseLeave={() => handleHandStart(false)}
                    onTouchStart={() => handleHandStart(true)}
                    onTouchEnd={() => handleHandStart(false)}
                    className={`w-full py-3 rounded-lg font-medium transition-all ${
                      handStart
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                    }`}
                  >
                    {handStart ? 'Pumpe laeuft...' : 'Pumpe starten (halten)'}
                  </button>
                </div>
              )}

              {(fault || alarm) && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle size={20} />
                      <span className="font-medium">Stoerung aktiv</span>
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

              <div className="bg-slate-700/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <ChevronRight size={16} /> Signale
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'PumpCmd', value: pumpCmd, color: '#3b82f6' },
                    { label: 'Running', value: running, color: '#22c55e' },
                    { label: 'Ready', value: ready, color: '#22c55e' },
                    { label: 'Fault', value: fault, color: '#ef4444' },
                    { label: 'Alarm', value: alarm, color: '#ef4444' },
                    { label: 'Revision', value: revision, color: '#f59e0b' }
                  ].map(signal => (
                    <div key={signal.label} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: signal.value ? signal.color : '#475569',
                          boxShadow: signal.value ? `0 0 8px ${signal.color}` : 'none'
                        }}
                      />
                      <span className="text-slate-300 text-sm">{signal.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {showSettings && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-medium text-blue-300 flex items-center gap-2">
                    <Settings size={16} /> Parameter einstellen
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Einschaltverzoegerung (ms)</label>
                      <input
                        type="number"
                        value={localParams.pumpStartDelayMs ?? 0}
                        onChange={(e) => handleParamChange('pumpStartDelayMs', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Ausschaltverzoegerung (ms)</label>
                      <input
                        type="number"
                        value={localParams.pumpStopDelayMs ?? 0}
                        onChange={(e) => handleParamChange('pumpStopDelayMs', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">RM-Timeout (ms)</label>
                      <input
                        type="number"
                        value={localParams.pumpFeedbackTimeoutMs ?? 10000}
                        onChange={(e) => handleParamChange('pumpFeedbackTimeoutMs', parseInt(e.target.value) || 10000)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="enableFeedback"
                        checked={localParams.pumpEnableFeedback !== false}
                        onChange={(e) => handleParamChange('pumpEnableFeedback', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600"
                      />
                      <label htmlFor="enableFeedback" className="text-sm text-slate-300">RM aktiv</label>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Drehzahl Min (%)</label>
                      <input
                        type="number"
                        value={localParams.pumpSpeedMin ?? 0}
                        onChange={(e) => handleParamChange('pumpSpeedMin', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Drehzahl Max (%)</label>
                      <input
                        type="number"
                        value={localParams.pumpSpeedMax ?? 100}
                        onChange={(e) => handleParamChange('pumpSpeedMax', parseInt(e.target.value) || 100)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Anti-Seize Intervall</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={Math.round((localParams.pumpAntiSeizeIntervalMs ?? 604800000) / 86400000)}
                          onChange={(e) => handleParamChange('pumpAntiSeizeIntervalMs', (parseInt(e.target.value) || 7) * 86400000)}
                          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        />
                        <span className="text-xs text-slate-400">Tage</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Anti-Seize Laufzeit</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={Math.round((localParams.pumpAntiSeizeRunMs ?? 60000) / 1000)}
                          onChange={(e) => handleParamChange('pumpAntiSeizeRunMs', (parseInt(e.target.value) || 60) * 1000)}
                          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        />
                        <span className="text-xs text-slate-400">Sek</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Anti-Seize Drehzahl (%)</label>
                      <input
                        type="number"
                        value={localParams.pumpAntiSeizeSpeed ?? 30}
                        onChange={(e) => handleParamChange('pumpAntiSeizeSpeed', parseInt(e.target.value) || 30)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Einschaltverz.:</span>
                        <span className="text-slate-300">{formatMs(localParams.pumpStartDelayMs ?? 0)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Ausschaltverz.:</span>
                        <span className="text-slate-300">{formatMs(localParams.pumpStopDelayMs ?? 0)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>RM-Timeout:</span>
                        <span className="text-slate-300">{formatMs(localParams.pumpFeedbackTimeoutMs ?? 10000)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Anti-Seize Int.:</span>
                        <span className="text-slate-300">{formatMs(localParams.pumpAntiSeizeIntervalMs ?? 604800000)}</span>
                      </div>
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
