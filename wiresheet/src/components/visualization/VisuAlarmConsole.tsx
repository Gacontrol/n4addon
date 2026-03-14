import React, { useState, useMemo } from 'react';
import {
  Bell, Check, AlertTriangle, Clock, X, Filter,
  ArrowUpDown, ChevronDown, ChevronUp, CheckCircle2,
  AlertOctagon, AlertCircle, Info, Timer, Hash,
  Layers, PauseCircle, Volume2, VolumeX, BarChart3
} from 'lucide-react';
import { AlarmClass, AlarmConsole, ActiveAlarm, AlarmConsoleWidgetConfig, AlarmPriority } from '../../types/alarm';

interface VisuAlarmConsoleProps {
  config: AlarmConsoleWidgetConfig;
  alarmClasses: AlarmClass[];
  alarmConsoles: AlarmConsole[];
  activeAlarms: ActiveAlarm[];
  onAcknowledge?: (alarmId: string) => void;
  onAcknowledgeAll?: () => void;
  onClear?: (alarmId: string) => void;
  onShelve?: (alarmId: string, duration: number, reason?: string) => void;
  isEditMode?: boolean;
  width: number;
  height: number;
}

type SortField = 'time' | 'priority' | 'state' | 'source';
type SortDirection = 'asc' | 'desc';

const priorityIcons: Record<AlarmPriority, React.ReactNode> = {
  critical: <AlertOctagon className="w-3.5 h-3.5" />,
  high: <AlertTriangle className="w-3.5 h-3.5" />,
  medium: <AlertCircle className="w-3.5 h-3.5" />,
  low: <Info className="w-3.5 h-3.5" />,
  info: <Bell className="w-3.5 h-3.5" />
};

const priorityLabels: Record<AlarmPriority, string> = {
  critical: 'Kritisch',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
  info: 'Info'
};

const priorityOrder: Record<AlarmPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export const VisuAlarmConsole: React.FC<VisuAlarmConsoleProps> = ({
  config,
  alarmClasses,
  alarmConsoles,
  activeAlarms,
  onAcknowledge,
  onAcknowledgeAll,
  onClear,
  onShelve,
  isEditMode = false,
  width,
  height
}) => {
  const [sortField, setSortField] = useState<SortField>(config.defaultSortBy || 'priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>(config.defaultSortDirection || 'asc');
  const [filterPriority, setFilterPriority] = useState<AlarmPriority | 'all'>('all');
  const [filterState, setFilterState] = useState<'all' | 'active' | 'acknowledged'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedAlarmId, setExpandedAlarmId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  const console = config.consoleId ? alarmConsoles.find(c => c.id === config.consoleId) : null;

  const filteredAlarms = useMemo(() => {
    let alarms = console
      ? activeAlarms.filter(a => console.alarmClassIds.includes(a.alarmClassId))
      : activeAlarms;

    if (filterPriority !== 'all') {
      alarms = alarms.filter(a => {
        const ac = alarmClasses.find(c => c.id === a.alarmClassId);
        return ac?.priority === filterPriority;
      });
    }

    if (filterState !== 'all') {
      alarms = alarms.filter(a => a.state === filterState);
    }

    alarms = alarms.filter(a => !a.shelved);

    return alarms;
  }, [activeAlarms, console, alarmClasses, filterPriority, filterState]);

  const sortedAlarms = useMemo(() => {
    return [...filteredAlarms].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'priority': {
          const classA = alarmClasses.find(c => c.id === a.alarmClassId);
          const classB = alarmClasses.find(c => c.id === b.alarmClassId);
          const priorityA = classA ? priorityOrder[classA.priority] : 4;
          const priorityB = classB ? priorityOrder[classB.priority] : 4;
          comparison = priorityA - priorityB;
          break;
        }
        case 'time':
          comparison = b.triggeredAt - a.triggeredAt;
          break;
        case 'state':
          comparison = a.state === 'active' ? -1 : 1;
          break;
        case 'source':
          comparison = (a.sourceNodeName || a.sourceNodeId).localeCompare(b.sourceNodeName || b.sourceNodeId);
          break;
      }

      if (sortDirection === 'desc') comparison *= -1;

      if (comparison === 0) {
        comparison = b.triggeredAt - a.triggeredAt;
      }

      return comparison;
    });
  }, [filteredAlarms, sortField, sortDirection, alarmClasses]);

  const visibleAlarms = config.maxVisibleAlarms
    ? sortedAlarms.slice(0, config.maxVisibleAlarms)
    : sortedAlarms;

  const statistics = useMemo(() => {
    const stats = {
      total: filteredAlarms.length,
      active: filteredAlarms.filter(a => a.state === 'active').length,
      acknowledged: filteredAlarms.filter(a => a.state === 'acknowledged').length,
      byPriority: {} as Record<AlarmPriority, number>,
      oldestUnack: null as ActiveAlarm | null
    };

    for (const priority of ['critical', 'high', 'medium', 'low', 'info'] as AlarmPriority[]) {
      stats.byPriority[priority] = filteredAlarms.filter(a => {
        const ac = alarmClasses.find(c => c.id === a.alarmClassId);
        return ac?.priority === priority;
      }).length;
    }

    const unackAlarms = filteredAlarms.filter(a => a.state === 'active');
    if (unackAlarms.length > 0) {
      stats.oldestUnack = unackAlarms.reduce((oldest, curr) =>
        curr.triggeredAt < oldest.triggeredAt ? curr : oldest
      );
    }

    return stats;
  }, [filteredAlarms, alarmClasses]);

  const fontSize = config.fontSize || 12;
  const isCompact = config.compactMode || height < 200;
  const showHeader = height >= 80;
  const showToolbar = height >= 120 && (config.enableFiltering || config.enableSorting || config.enableAcknowledgeAll);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };


  if (visibleAlarms.length === 0 && !showStats) {
    return (
      <div
        className="flex flex-col bg-slate-900/95 rounded-lg border border-green-600/30 overflow-hidden"
        style={{ width, height }}
      >
        {showHeader && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-white">
                {console?.name || 'Alarme'}
              </span>
            </div>
            {config.showStatistics && (
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 text-green-400">
            <Check className="w-5 h-5" />
            <span style={{ fontSize }}>Keine aktiven Alarme</span>
          </div>
          {console && !isCompact && (
            <p className="text-xs text-slate-500 mt-1">{console.name}</p>
          )}
        </div>
      </div>
    );
  }

  const renderAlarmRow = (alarm: ActiveAlarm, isExpanded: boolean) => {
    const alarmClass = alarmClasses.find(c => c.id === alarm.alarmClassId);
    const isActive = alarm.state === 'active';
    const now = Date.now();
    const duration = now - alarm.triggeredAt;
    const shouldBlink = config.blinkUnacknowledged && isActive;

    return (
      <div key={alarm.id}>
        <div
          className={`flex items-start gap-2 px-2 py-1.5 border-b border-slate-700/50 cursor-pointer transition-colors ${
            isActive ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-800/50 hover:bg-slate-800/70'
          } ${shouldBlink ? 'animate-pulse' : ''}`}
          style={{
            borderLeftWidth: 4,
            borderLeftColor: alarmClass?.color || '#ef4444'
          }}
          onClick={() => setExpandedAlarmId(isExpanded ? null : alarm.id)}
        >
          <div className="flex-shrink-0 pt-0.5" style={{ color: alarmClass?.color }}>
            {alarmClass && priorityIcons[alarmClass.priority]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {config.showPriority && alarmClass && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: `${alarmClass.color}20`,
                    color: alarmClass.color
                  }}
                >
                  {priorityLabels[alarmClass.priority]}
                </span>
              )}
              {isActive ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">
                  Aktiv
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">
                  Quittiert
                </span>
              )}
            </div>

            <p
              className={`mt-0.5 ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}
              style={{ fontSize }}
            >
              {alarm.message || alarm.alarmText || 'Alarm'}
            </p>

            {config.showSource !== false && alarm.sourceNodeName && (
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />
                {alarm.sourcePageName && <span>{alarm.sourcePageName} /</span>}
                <span className="font-medium">{alarm.sourceNodeName}</span>
              </p>
            )}

            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
              {config.showTimestamp !== false && (
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatTimestamp(alarm.triggeredAt)}
                </span>
              )}
              {config.showDuration && (
                <span className="flex items-center gap-1">
                  <Timer className="w-2.5 h-2.5" />
                  {formatDuration(duration)}
                </span>
              )}
              {config.showOccurrenceCount && alarm.occurrenceCount && alarm.occurrenceCount > 1 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Hash className="w-2.5 h-2.5" />
                  {alarm.occurrenceCount}x
                </span>
              )}
            </div>

            {config.showValue && alarm.value !== undefined && (
              <p className="text-[10px] text-cyan-400 mt-0.5">
                Wert: {String(alarm.value)}{alarm.unit ? ` ${alarm.unit}` : ''}
                {alarm.limitValue !== undefined && (
                  <span className="text-slate-500"> (Grenze: {alarm.limitValue})</span>
                )}
              </p>
            )}

            {config.showAlarmClass && alarmClass && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Klasse: {alarmClass.name}
              </p>
            )}
          </div>

          {!isEditMode && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {config.showAcknowledgeButton !== false && isActive && onAcknowledge && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge(alarm.id);
                  }}
                  className="p-1.5 text-amber-400 hover:bg-amber-900/30 rounded transition-colors"
                  title="Quittieren"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              {config.showClearButton !== false && onClear && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear(alarm.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                  title="Loeschen"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="px-3 py-2 bg-slate-850 border-b border-slate-700 text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Alarm-ID:</span>
                <span className="ml-1 text-slate-300 font-mono text-[10px]">{alarm.id}</span>
              </div>
              <div>
                <span className="text-slate-500">Quelle:</span>
                <span className="ml-1 text-slate-300">{alarm.sourceNodeId}</span>
              </div>
              {alarm.sourcePageName && (
                <div>
                  <span className="text-slate-500">Seite:</span>
                  <span className="ml-1 text-slate-300">{alarm.sourcePageName}</span>
                </div>
              )}
              {alarmClass && (
                <div>
                  <span className="text-slate-500">Klasse:</span>
                  <span className="ml-1 text-slate-300">{alarmClass.name}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500">Ausgeloest:</span>
                <span className="ml-1 text-slate-300">{new Date(alarm.triggeredAt).toLocaleString('de-DE')}</span>
              </div>
              {alarm.acknowledgedAt && (
                <div>
                  <span className="text-slate-500">Quittiert:</span>
                  <span className="ml-1 text-slate-300">
                    {new Date(alarm.acknowledgedAt).toLocaleString('de-DE')}
                    {alarm.acknowledgedBy && ` (${alarm.acknowledgedBy})`}
                  </span>
                </div>
              )}
              {alarm.value !== undefined && (
                <div>
                  <span className="text-slate-500">Aktueller Wert:</span>
                  <span className="ml-1 text-cyan-400">{String(alarm.value)}{alarm.unit || ''}</span>
                </div>
              )}
              {alarm.limitValue !== undefined && (
                <div>
                  <span className="text-slate-500">Grenzwert:</span>
                  <span className="ml-1 text-red-400">{alarm.limitValue}{alarm.unit || ''}</span>
                </div>
              )}
              {alarm.alarmType && (
                <div>
                  <span className="text-slate-500">Typ:</span>
                  <span className="ml-1 text-slate-300">{alarm.alarmType}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500">Dauer:</span>
                <span className="ml-1 text-slate-300">{formatDuration(Date.now() - alarm.triggeredAt)}</span>
              </div>
            </div>

            {config.enableShelving && onShelve && (
              <div className="pt-2 border-t border-slate-700">
                <p className="text-slate-400 mb-1">Alarm unterdruecken:</p>
                <div className="flex gap-1">
                  {[5, 15, 30, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => onShelve(alarm.id, mins * 60 * 1000)}
                      className="px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex flex-col bg-slate-900/95 rounded-lg border border-slate-600 overflow-hidden"
      style={{ width, height }}
    >
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-red-400" />
            <span className="text-xs font-medium text-white">
              {console?.name || 'Alarme'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {statistics.active > 0 && (
              <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-full animate-pulse">
                {statistics.active}
              </span>
            )}
            {statistics.acknowledged > 0 && (
              <span className="text-xs px-2 py-0.5 bg-amber-600 text-white rounded-full">
                {statistics.acknowledged}
              </span>
            )}
            {config.showStatistics && (
              <button
                onClick={() => setShowStats(!showStats)}
                className={`p-1 rounded transition-colors ${showStats ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {showStats && config.showStatistics && (
        <div className="px-3 py-2 bg-slate-850 border-b border-slate-700 text-xs">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center p-1.5 bg-slate-800 rounded">
              <div className="text-lg font-bold text-white">{statistics.total}</div>
              <div className="text-[10px] text-slate-400">Gesamt</div>
            </div>
            <div className="text-center p-1.5 bg-red-900/30 rounded">
              <div className="text-lg font-bold text-red-400">{statistics.active}</div>
              <div className="text-[10px] text-slate-400">Aktiv</div>
            </div>
            <div className="text-center p-1.5 bg-amber-900/30 rounded">
              <div className="text-lg font-bold text-amber-400">{statistics.acknowledged}</div>
              <div className="text-[10px] text-slate-400">Quittiert</div>
            </div>
          </div>
          <div className="flex gap-1 justify-between">
            {(['critical', 'high', 'medium', 'low'] as AlarmPriority[]).map(p => (
              <div key={p} className="flex items-center gap-1 text-[10px]">
                <span style={{ color: p === 'critical' ? '#ef4444' : p === 'high' ? '#f97316' : p === 'medium' ? '#eab308' : '#3b82f6' }}>
                  {priorityIcons[p]}
                </span>
                <span className="text-slate-400">{statistics.byPriority[p]}</span>
              </div>
            ))}
          </div>
          {statistics.oldestUnack && (
            <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-400">
              Aeltester unquittierter Alarm: {formatDuration(Date.now() - statistics.oldestUnack.triggeredAt)}
            </div>
          )}
        </div>
      )}

      {showToolbar && (
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-850 border-b border-slate-700">
          {config.enableFiltering && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1 rounded transition-colors ${showFilters ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
              title="Filter"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
          )}

          {config.enableSorting && (
            <div className="flex items-center gap-0.5 ml-1">
              <button
                onClick={() => toggleSort('priority')}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${sortField === 'priority' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Prio
              </button>
              <button
                onClick={() => toggleSort('time')}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${sortField === 'time' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Zeit
              </button>
              <button
                onClick={() => toggleSort('state')}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${sortField === 'state' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Status
              </button>
              {sortField && (
                <button
                  onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                  className="p-0.5 text-slate-400 hover:text-white"
                >
                  {sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          )}

          <div className="flex-1" />

          {config.enableAcknowledgeAll && statistics.active > 0 && onAcknowledgeAll && (
            <button
              onClick={onAcknowledgeAll}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              Alle ({statistics.active})
            </button>
          )}
        </div>
      )}

      {showFilters && config.enableFiltering && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 border-b border-slate-700">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as AlarmPriority | 'all')}
            className="px-1.5 py-0.5 text-[10px] bg-slate-700 border border-slate-600 rounded text-white"
          >
            <option value="all">Alle Prioritaeten</option>
            <option value="critical">Kritisch</option>
            <option value="high">Hoch</option>
            <option value="medium">Mittel</option>
            <option value="low">Niedrig</option>
          </select>
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value as 'all' | 'active' | 'acknowledged')}
            className="px-1.5 py-0.5 text-[10px] bg-slate-700 border border-slate-600 rounded text-white"
          >
            <option value="all">Alle Status</option>
            <option value="active">Nur Aktive</option>
            <option value="acknowledged">Nur Quittierte</option>
          </select>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {visibleAlarms.map(alarm => renderAlarmRow(alarm, expandedAlarmId === alarm.id))}
        {sortedAlarms.length > visibleAlarms.length && (
          <div className="px-2 py-1.5 text-center text-[10px] text-slate-500 bg-slate-800/30">
            +{sortedAlarms.length - visibleAlarms.length} weitere Alarme
          </div>
        )}
      </div>
    </div>
  );
};

export default VisuAlarmConsole;
