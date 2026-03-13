import React from 'react';
import { Bell, Check, AlertTriangle, Clock, X } from 'lucide-react';
import { AlarmClass, AlarmConsole, ActiveAlarm, AlarmConsoleWidgetConfig } from '../../types/alarm';

interface VisuAlarmConsoleProps {
  config: AlarmConsoleWidgetConfig;
  alarmClasses: AlarmClass[];
  alarmConsoles: AlarmConsole[];
  activeAlarms: ActiveAlarm[];
  onAcknowledge?: (alarmId: string) => void;
  onClear?: (alarmId: string) => void;
  isEditMode?: boolean;
  width: number;
  height: number;
}

export const VisuAlarmConsole: React.FC<VisuAlarmConsoleProps> = ({
  config,
  alarmClasses,
  alarmConsoles,
  activeAlarms,
  onAcknowledge,
  onClear,
  isEditMode = false,
  width,
  height
}) => {
  const console = config.consoleId ? alarmConsoles.find(c => c.id === config.consoleId) : null;

  const filteredAlarms = console
    ? activeAlarms.filter(a => console.alarmClassIds.includes(a.alarmClassId))
    : activeAlarms;

  const sortedAlarms = [...filteredAlarms].sort((a, b) => {
    const classA = alarmClasses.find(c => c.id === a.alarmClassId);
    const classB = alarmClasses.find(c => c.id === b.alarmClassId);
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const priorityA = classA ? priorityOrder[classA.priority] : 4;
    const priorityB = classB ? priorityOrder[classB.priority] : 4;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return b.triggeredAt - a.triggeredAt;
  });

  const visibleAlarms = config.maxVisibleAlarms
    ? sortedAlarms.slice(0, config.maxVisibleAlarms)
    : sortedAlarms;

  const fontSize = config.fontSize || 12;
  const isCompact = config.compactMode || height < 150;

  if (!console && !isEditMode) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-slate-800 rounded-lg border border-slate-600 text-slate-400"
        style={{ width, height }}
      >
        <Bell className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">Keine Konsole verknuepft</p>
      </div>
    );
  }

  if (visibleAlarms.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-slate-800/90 rounded-lg border border-green-600/30"
        style={{ width, height }}
      >
        <div className="flex items-center gap-2 text-green-400">
          <Check className="w-5 h-5" />
          <span style={{ fontSize }}>Keine Alarme</span>
        </div>
        {console && (
          <p className="text-xs text-slate-500 mt-1">{console.name}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-slate-900/95 rounded-lg border border-slate-600 overflow-hidden"
      style={{ width, height }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-red-400" />
          <span className="text-xs font-medium text-white">
            {console?.name || 'Alarme'}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-full">
          {filteredAlarms.length}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {visibleAlarms.map(alarm => {
          const alarmClass = alarmClasses.find(c => c.id === alarm.alarmClassId);
          const isAcknowledged = alarm.state === 'acknowledged';

          return (
            <div
              key={alarm.id}
              className={`flex items-center gap-2 px-2 py-1.5 border-b border-slate-700/50 ${
                isAcknowledged ? 'bg-slate-800/50' : 'bg-slate-800'
              }`}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: alarmClass?.color || '#ef4444'
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {alarm.state === 'active' ? (
                    <AlertTriangle
                      className="w-3.5 h-3.5 flex-shrink-0 animate-pulse"
                      style={{ color: alarmClass?.color }}
                    />
                  ) : (
                    <Check className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                  )}
                  <span
                    className={`truncate ${isAcknowledged ? 'text-slate-400' : 'text-white'}`}
                    style={{ fontSize }}
                  >
                    {alarm.message || alarm.alarmText || 'Alarm'}
                  </span>
                </div>
                {!isCompact && config.showSource && (
                  <p className="text-[10px] text-slate-500 truncate ml-5">
                    {alarm.sourceNodeName}
                  </p>
                )}
                {!isCompact && config.showTimestamp && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 ml-5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(alarm.triggeredAt).toLocaleTimeString('de-DE')}
                  </div>
                )}
              </div>
              {!isEditMode && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {config.showAcknowledgeButton && alarm.state === 'active' && onAcknowledge && (
                    <button
                      onClick={() => onAcknowledge(alarm.id)}
                      className="p-1 text-amber-400 hover:bg-amber-900/30 rounded transition-colors"
                      title="Quittieren"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {config.showClearButton && onClear && (
                    <button
                      onClick={() => onClear(alarm.id)}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      title="Loeschen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sortedAlarms.length > visibleAlarms.length && (
          <div className="px-2 py-1 text-center text-[10px] text-slate-500">
            +{sortedAlarms.length - visibleAlarms.length} weitere
          </div>
        )}
      </div>
    </div>
  );
};

export default VisuAlarmConsole;
