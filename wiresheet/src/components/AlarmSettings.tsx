import React from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { AlarmClass, BooleanAlarmConfig, NumericAlarmConfig, EnumAlarmConfig, AggregateAlarmConfig, ValveAlarmConfig, SensorAlarmConfig } from '../types/alarm';

interface AlarmSettingsProps {
  nodeType: string;
  alarmClasses: AlarmClass[];
  booleanAlarmConfig?: BooleanAlarmConfig;
  numericAlarmConfig?: NumericAlarmConfig;
  enumAlarmConfig?: EnumAlarmConfig;
  aggregateAlarmConfig?: AggregateAlarmConfig;
  valveAlarmConfig?: ValveAlarmConfig;
  sensorAlarmConfig?: SensorAlarmConfig;
  onBooleanAlarmConfigChange?: (config: BooleanAlarmConfig) => void;
  onNumericAlarmConfigChange?: (config: NumericAlarmConfig) => void;
  onEnumAlarmConfigChange?: (config: EnumAlarmConfig) => void;
  onAggregateAlarmConfigChange?: (config: AggregateAlarmConfig) => void;
  onValveAlarmConfigChange?: (config: ValveAlarmConfig) => void;
  onSensorAlarmConfigChange?: (config: SensorAlarmConfig) => void;
  enumStages?: { value: number; label: string }[];
}

export const AlarmSettings: React.FC<AlarmSettingsProps> = ({
  nodeType,
  alarmClasses,
  booleanAlarmConfig,
  numericAlarmConfig,
  enumAlarmConfig,
  aggregateAlarmConfig,
  valveAlarmConfig,
  sensorAlarmConfig,
  onBooleanAlarmConfigChange,
  onNumericAlarmConfigChange,
  onEnumAlarmConfigChange,
  onAggregateAlarmConfigChange,
  onValveAlarmConfigChange,
  onSensorAlarmConfigChange,
  enumStages = []
}) => {
  const isBooleanDatapoint = nodeType === 'dp-boolean';
  const isNumericDatapoint = nodeType === 'dp-numeric';
  const isEnumDatapoint = nodeType === 'dp-enum';
  const isAggregate = nodeType === 'pump-control' || nodeType === 'aggregate-control';
  const isValve = nodeType === 'valve-control';
  const isSensor = nodeType === 'sensor-control';

  if (alarmClasses.length === 0) {
    return (
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Alarmierung</span>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 text-center">
          <AlertTriangle className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Keine Alarmklassen definiert.</p>
          <p className="text-xs text-slate-500 mt-1">Erstellen Sie zuerst Alarmklassen im Alarm-Tab.</p>
        </div>
      </div>
    );
  }

  if (isBooleanDatapoint && onBooleanAlarmConfigChange) {
    const cfg = booleanAlarmConfig || { enabled: false, alarmValue: true };
    return (
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Alarmierung</span>
        </div>
        <div className="space-y-3 bg-slate-800/50 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => onBooleanAlarmConfigChange({ ...cfg, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500"
            />
            <span className="text-xs text-slate-300">Alarm aktivieren</span>
          </label>
          {cfg.enabled && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarmklasse</label>
                <select
                  value={cfg.alarmClassId || ''}
                  onChange={(e) => onBooleanAlarmConfigChange({ ...cfg, alarmClassId: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                >
                  <option value="">-- Auswahl --</option>
                  {alarmClasses.map(ac => (
                    <option key={ac.id} value={ac.id}>{ac.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarmwert</label>
                <select
                  value={cfg.alarmValue ? 'true' : 'false'}
                  onChange={(e) => onBooleanAlarmConfigChange({ ...cfg, alarmValue: e.target.value === 'true' })}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                >
                  <option value="true">TRUE = Alarm</option>
                  <option value="false">FALSE = Alarm</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarmtext</label>
                <input
                  type="text"
                  value={cfg.alarmText || ''}
                  onChange={(e) => onBooleanAlarmConfigChange({ ...cfg, alarmText: e.target.value || undefined })}
                  placeholder="z.B. Stoerung aktiv"
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isNumericDatapoint && onNumericAlarmConfigChange) {
    const cfg = numericAlarmConfig || { enabled: false };
    return (
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Alarmierung</span>
        </div>
        <div className="space-y-3 bg-slate-800/50 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => onNumericAlarmConfigChange({ ...cfg, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500"
            />
            <span className="text-xs text-slate-300">Grenzwertalarm aktivieren</span>
          </label>
          {cfg.enabled && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarmklasse</label>
                <select
                  value={cfg.alarmClassId || ''}
                  onChange={(e) => onNumericAlarmConfigChange({ ...cfg, alarmClassId: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                >
                  <option value="">-- Auswahl --</option>
                  {alarmClasses.map(ac => (
                    <option key={ac.id} value={ac.id}>{ac.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">HH-Grenze</label>
                  <input
                    type="number"
                    value={cfg.highHighLimit ?? ''}
                    onChange={(e) => onNumericAlarmConfigChange({ ...cfg, highHighLimit: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="--"
                    className="w-full px-2 py-1.5 bg-slate-700 border border-red-600/50 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">H-Grenze</label>
                  <input
                    type="number"
                    value={cfg.highLimit ?? ''}
                    onChange={(e) => onNumericAlarmConfigChange({ ...cfg, highLimit: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="--"
                    className="w-full px-2 py-1.5 bg-slate-700 border border-orange-600/50 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">L-Grenze</label>
                  <input
                    type="number"
                    value={cfg.lowLimit ?? ''}
                    onChange={(e) => onNumericAlarmConfigChange({ ...cfg, lowLimit: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="--"
                    className="w-full px-2 py-1.5 bg-slate-700 border border-blue-600/50 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">LL-Grenze</label>
                  <input
                    type="number"
                    value={cfg.lowLowLimit ?? ''}
                    onChange={(e) => onNumericAlarmConfigChange({ ...cfg, lowLowLimit: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="--"
                    className="w-full px-2 py-1.5 bg-slate-700 border border-cyan-600/50 rounded text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hysterese (Deadband)</label>
                <input
                  type="number"
                  value={cfg.deadband ?? ''}
                  onChange={(e) => onNumericAlarmConfigChange({ ...cfg, deadband: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="0"
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isEnumDatapoint && onEnumAlarmConfigChange) {
    const cfg = enumAlarmConfig || { enabled: false, alarmValues: [] };
    return (
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Alarmierung</span>
        </div>
        <div className="space-y-3 bg-slate-800/50 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => onEnumAlarmConfigChange({ ...cfg, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500"
            />
            <span className="text-xs text-slate-300">Alarm aktivieren</span>
          </label>
          {cfg.enabled && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarmklasse</label>
                <select
                  value={cfg.alarmClassId || ''}
                  onChange={(e) => onEnumAlarmConfigChange({ ...cfg, alarmClassId: e.target.value || undefined })}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
                >
                  <option value="">-- Auswahl --</option>
                  {alarmClasses.map(ac => (
                    <option key={ac.id} value={ac.id}>{ac.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarmwerte</label>
                {enumStages.length > 0 ? (
                  <div className="space-y-1">
                    {enumStages.map(stage => (
                      <label key={stage.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cfg.alarmValues.includes(stage.value)}
                          onChange={(e) => {
                            const newValues = e.target.checked
                              ? [...cfg.alarmValues, stage.value]
                              : cfg.alarmValues.filter(v => v !== stage.value);
                            onEnumAlarmConfigChange({ ...cfg, alarmValues: newValues });
                          }}
                          className="w-3 h-3 rounded border-slate-600 bg-slate-700 text-amber-500"
                        />
                        <span className="text-xs text-slate-300">{stage.label} ({stage.value})</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Keine Enum-Stufen definiert.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isAggregate && onAggregateAlarmConfigChange) {
    const cfg = aggregateAlarmConfig || {};
    return (
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Alarmierung</span>
        </div>
        <div className="space-y-3 bg-slate-800/50 rounded-lg p-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Stoerungsalarm-Klasse</label>
            <select
              value={cfg.faultAlarmClassId || ''}
              onChange={(e) => onAggregateAlarmConfigChange({ ...cfg, faultAlarmClassId: e.target.value || undefined })}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
            >
              <option value="">-- Keine --</option>
              {alarmClasses.map(ac => (
                <option key={ac.id} value={ac.id}>{ac.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Wartungsalarm-Klasse</label>
            <select
              value={cfg.maintenanceAlarmClassId || ''}
              onChange={(e) => onAggregateAlarmConfigChange({ ...cfg, maintenanceAlarmClassId: e.target.value || undefined })}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
            >
              <option value="">-- Keine --</option>
              {alarmClasses.map(ac => (
                <option key={ac.id} value={ac.id}>{ac.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (isValve && onValveAlarmConfigChange) {
    const cfg = valveAlarmConfig || {};
    return (
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Alarmierung</span>
        </div>
        <div className="space-y-3 bg-slate-800/50 rounded-lg p-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Alarmklasse (Stoerung/Endlage)</label>
            <select
              value={cfg.alarmClassId || ''}
              onChange={(e) => onValveAlarmConfigChange({ ...cfg, alarmClassId: e.target.value || undefined })}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
            >
              <option value="">-- Keine --</option>
              {alarmClasses.map(ac => (
                <option key={ac.id} value={ac.id}>{ac.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (isSensor && onSensorAlarmConfigChange) {
    const cfg = sensorAlarmConfig || {};
    return (
      <div className="border-t border-slate-700 pt-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">Alarmierung</span>
        </div>
        <div className="space-y-3 bg-slate-800/50 rounded-lg p-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Alarmklasse (Grenzwert)</label>
            <select
              value={cfg.alarmClassId || ''}
              onChange={(e) => onSensorAlarmConfigChange({ ...cfg, alarmClassId: e.target.value || undefined })}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-white"
            >
              <option value="">-- Keine --</option>
              {alarmClasses.map(ac => (
                <option key={ac.id} value={ac.id}>{ac.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AlarmSettings;
