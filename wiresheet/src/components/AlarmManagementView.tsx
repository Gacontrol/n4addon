import React, { useState, useMemo } from 'react';
import { Bell, Plus, Trash2, CreditCard as Edit2, Check, X, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, Monitor, Settings, Cpu } from 'lucide-react';
import { AlarmClass, AlarmConsole, AlarmPriority, ActiveAlarm } from '../types/alarm';
import { FlowNode, WiresheetPage } from '../types/flow';

interface AlarmManagementViewProps {
  alarmClasses: AlarmClass[];
  alarmConsoles: AlarmConsole[];
  activeAlarms: ActiveAlarm[];
  onAddAlarmClass: (ac: Omit<AlarmClass, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateAlarmClass: (id: string, updates: Partial<AlarmClass>) => void;
  onDeleteAlarmClass: (id: string) => void;
  onAddAlarmConsole: (console: Omit<AlarmConsole, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateAlarmConsole: (id: string, updates: Partial<AlarmConsole>) => void;
  onDeleteAlarmConsole: (id: string) => void;
  onAcknowledgeAlarm: (alarmId: string) => void;
  onClearAlarm: (alarmId: string) => void;
  pages?: WiresheetPage[];
  onUpdateNodeConfig?: (pageId: string, nodeId: string, config: Record<string, unknown>) => void;
}

const PRIORITY_CONFIG: Record<AlarmPriority, { label: string; color: string; icon: React.ReactNode }> = {
  critical: { label: 'Kritisch', color: '#ef4444', icon: <AlertTriangle className="w-4 h-4" /> },
  high: { label: 'Hoch', color: '#f97316', icon: <AlertCircle className="w-4 h-4" /> },
  medium: { label: 'Mittel', color: '#eab308', icon: <Bell className="w-4 h-4" /> },
  low: { label: 'Niedrig', color: '#3b82f6', icon: <Info className="w-4 h-4" /> },
  info: { label: 'Info', color: '#6b7280', icon: <Info className="w-4 h-4" /> }
};

const DEFAULT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

interface AlarmSourceNode {
  node: FlowNode;
  pageId: string;
  pageName: string;
  alarmEnabled: boolean;
  alarmClassId?: string;
  hasActiveAlarm: boolean;
  activeAlarmCount: number;
}

export const AlarmManagementView: React.FC<AlarmManagementViewProps> = ({
  alarmClasses,
  alarmConsoles,
  activeAlarms,
  onAddAlarmClass,
  onUpdateAlarmClass,
  onDeleteAlarmClass,
  onAddAlarmConsole,
  onUpdateAlarmConsole,
  onDeleteAlarmConsole,
  onAcknowledgeAlarm,
  onClearAlarm,
  pages = [],
  onUpdateNodeConfig
}) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'consoles' | 'active' | 'sources'>('classes');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingConsoleId, setEditingConsoleId] = useState<string | null>(null);
  const [showNewClassForm, setShowNewClassForm] = useState(false);
  const [showNewConsoleForm, setShowNewConsoleForm] = useState(false);
  const [expandedConsoleId, setExpandedConsoleId] = useState<string | null>(null);

  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newClassPriority, setNewClassPriority] = useState<AlarmPriority>('medium');
  const [newClassColor, setNewClassColor] = useState('#eab308');
  const [newClassSound, setNewClassSound] = useState(false);
  const [newClassAutoAck, setNewClassAutoAck] = useState(false);
  const [newClassAutoAckDelay, setNewClassAutoAckDelay] = useState(60000);

  const [newConsoleName, setNewConsoleName] = useState('');
  const [newConsoleDescription, setNewConsoleDescription] = useState('');
  const [newConsoleClassIds, setNewConsoleClassIds] = useState<string[]>([]);

  const resetNewClassForm = () => {
    setNewClassName('');
    setNewClassDescription('');
    setNewClassPriority('medium');
    setNewClassColor('#eab308');
    setNewClassSound(false);
    setNewClassAutoAck(false);
    setNewClassAutoAckDelay(60000);
    setShowNewClassForm(false);
  };

  const resetNewConsoleForm = () => {
    setNewConsoleName('');
    setNewConsoleDescription('');
    setNewConsoleClassIds([]);
    setShowNewConsoleForm(false);
  };

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    onAddAlarmClass({
      name: newClassName.trim(),
      description: newClassDescription.trim() || undefined,
      priority: newClassPriority,
      color: newClassColor,
      soundEnabled: newClassSound,
      autoAcknowledge: newClassAutoAck,
      autoAcknowledgeDelayMs: newClassAutoAck ? newClassAutoAckDelay : undefined
    });
    resetNewClassForm();
  };

  const handleAddConsole = () => {
    if (!newConsoleName.trim()) return;
    onAddAlarmConsole({
      name: newConsoleName.trim(),
      description: newConsoleDescription.trim() || undefined,
      alarmClassIds: newConsoleClassIds,
      showHistory: true,
      historyLimit: 100,
      sortBy: 'time',
      sortDirection: 'desc'
    });
    resetNewConsoleForm();
  };

  const getAlarmCountForClass = (classId: string) => {
    return activeAlarms.filter(a => a.alarmClassId === classId).length;
  };

  const getAlarmCountForConsole = (consoleId: string) => {
    const console = alarmConsoles.find(c => c.id === consoleId);
    if (!console) return 0;
    return activeAlarms.filter(a => console.alarmClassIds.includes(a.alarmClassId)).length;
  };

  const alarmSourceNodes = useMemo<AlarmSourceNode[]>(() => {
    const sources: AlarmSourceNode[] = [];
    const nodeTypesWithAlarms = [
      'sensor-control', 'pump-control', 'aggregate-control', 'valve-control',
      'threshold', 'compare', 'dp-boolean', 'dp-numeric', 'dp-enum'
    ];

    for (const page of pages) {
      for (const node of page.nodes || []) {
        const cfg = node.data?.config || {};

        const boolCfg = cfg.booleanAlarmConfig as { enabled?: boolean; alarmClassId?: string } | undefined;
        const numCfg = cfg.numericAlarmConfig as { enabled?: boolean; alarmClassId?: string } | undefined;
        const enumCfg = cfg.enumAlarmConfig as { enabled?: boolean; alarmClassId?: string } | undefined;
        const aggCfg = cfg.aggregateAlarmConfig as { faultAlarmClassId?: string } | undefined;
        const valveCfg = cfg.valveAlarmConfig as { alarmClassId?: string } | undefined;
        const sensorCfg = cfg.sensorAlarmConfig as { alarmClassId?: string } | undefined;

        const hasAlarmEnabled =
          boolCfg?.enabled === true ||
          numCfg?.enabled === true ||
          enumCfg?.enabled === true ||
          !!aggCfg?.faultAlarmClassId ||
          !!valveCfg?.alarmClassId ||
          !!sensorCfg?.alarmClassId;

        const alarmClassId =
          boolCfg?.alarmClassId ||
          numCfg?.alarmClassId ||
          enumCfg?.alarmClassId ||
          aggCfg?.faultAlarmClassId ||
          valveCfg?.alarmClassId ||
          sensorCfg?.alarmClassId;

        const nodeAlarms = activeAlarms.filter(a => a.sourceNodeId === node.id);

        if (hasAlarmEnabled || nodeAlarms.length > 0 || nodeTypesWithAlarms.includes(node.type)) {
          sources.push({
            node,
            pageId: page.id,
            pageName: page.name,
            alarmEnabled: hasAlarmEnabled,
            alarmClassId,
            hasActiveAlarm: nodeAlarms.length > 0,
            activeAlarmCount: nodeAlarms.length
          });
        }
      }
    }

    return sources.sort((a, b) => {
      if (a.hasActiveAlarm && !b.hasActiveAlarm) return -1;
      if (!a.hasActiveAlarm && b.hasActiveAlarm) return 1;
      if (a.alarmEnabled && !b.alarmEnabled) return -1;
      if (!a.alarmEnabled && b.alarmEnabled) return 1;
      return a.node.data.label.localeCompare(b.node.data.label);
    });
  }, [pages, activeAlarms]);

  const enabledSourcesCount = alarmSourceNodes.filter(s => s.alarmEnabled).length;
  const activeSourcesCount = alarmSourceNodes.filter(s => s.hasActiveAlarm).length;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex items-center gap-1 bg-slate-800 border-b border-slate-700 px-4">
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'classes'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          Alarmklassen
          {alarmClasses.length > 0 && (
            <span className="bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded">
              {alarmClasses.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('consoles')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'consoles'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Monitor className="w-4 h-4" />
          Alarmkonsolen
          {alarmConsoles.length > 0 && (
            <span className="bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded">
              {alarmConsoles.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'active'
              ? 'border-red-500 text-red-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4" />
          Aktive Alarme
          {activeAlarms.length > 0 && (
            <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded animate-pulse">
              {activeAlarms.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'sources'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Alarm-Quellen
          {activeSourcesCount > 0 && (
            <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded animate-pulse">
              {activeSourcesCount}
            </span>
          )}
          {enabledSourcesCount > 0 && activeSourcesCount === 0 && (
            <span className="bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded">
              {enabledSourcesCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'classes' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Alarmklassen</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Definieren Sie Alarmklassen mit verschiedenen Prioritaeten und Eigenschaften.
                </p>
              </div>
              <button
                onClick={() => setShowNewClassForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Neue Alarmklasse
              </button>
            </div>

            {showNewClassForm && (
              <div className="bg-slate-800 border border-amber-600/50 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-amber-400">Neue Alarmklasse erstellen</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="z.B. Kritische Alarme"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Prioritaet</label>
                    <select
                      value={newClassPriority}
                      onChange={(e) => setNewClassPriority(e.target.value as AlarmPriority)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
                    >
                      {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">Beschreibung</label>
                    <input
                      type="text"
                      value={newClassDescription}
                      onChange={(e) => setNewClassDescription(e.target.value)}
                      placeholder="Optionale Beschreibung"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Farbe</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newClassColor}
                        onChange={(e) => setNewClassColor(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <div className="flex gap-1">
                        {DEFAULT_COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewClassColor(color)}
                            className={`w-6 h-6 rounded-full transition-transform ${newClassColor === color ? 'ring-2 ring-white scale-110' : ''}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newClassSound}
                        onChange={(e) => setNewClassSound(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-slate-300">Ton aktivieren</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newClassAutoAck}
                        onChange={(e) => setNewClassAutoAck(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-slate-300">Auto-Quittierung</span>
                    </label>
                    {newClassAutoAck && (
                      <div className="ml-6">
                        <input
                          type="number"
                          value={newClassAutoAckDelay / 1000}
                          onChange={(e) => setNewClassAutoAckDelay(Number(e.target.value) * 1000)}
                          className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        />
                        <span className="text-xs text-slate-400 ml-2">Sekunden</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetNewClassForm}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddClass}
                    disabled={!newClassName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Erstellen
                  </button>
                </div>
              </div>
            )}

            {alarmClasses.length === 0 && !showNewClassForm ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
                <Bell className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">Noch keine Alarmklassen definiert.</p>
                <p className="text-sm text-slate-500 mt-1">Erstellen Sie eine neue Alarmklasse um zu beginnen.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alarmClasses.map(ac => (
                  <AlarmClassItem
                    key={ac.id}
                    alarmClass={ac}
                    alarmCount={getAlarmCountForClass(ac.id)}
                    isEditing={editingClassId === ac.id}
                    onEdit={() => setEditingClassId(ac.id)}
                    onCancelEdit={() => setEditingClassId(null)}
                    onUpdate={(updates) => {
                      onUpdateAlarmClass(ac.id, updates);
                      setEditingClassId(null);
                    }}
                    onDelete={() => onDeleteAlarmClass(ac.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'consoles' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Alarmkonsolen</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Erstellen Sie Konsolen zur Anzeige und Verwaltung von Alarmen aus bestimmten Klassen.
                </p>
              </div>
              <button
                onClick={() => setShowNewConsoleForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Neue Konsole
              </button>
            </div>

            {showNewConsoleForm && (
              <div className="bg-slate-800 border border-blue-600/50 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-semibold text-blue-400">Neue Alarmkonsole erstellen</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={newConsoleName}
                      onChange={(e) => setNewConsoleName(e.target.value)}
                      placeholder="z.B. Hauptkonsole"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Beschreibung</label>
                    <input
                      type="text"
                      value={newConsoleDescription}
                      onChange={(e) => setNewConsoleDescription(e.target.value)}
                      placeholder="Optionale Beschreibung"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-2">Alarmklassen</label>
                    {alarmClasses.length === 0 ? (
                      <p className="text-sm text-slate-500">Erstellen Sie zuerst Alarmklassen.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {alarmClasses.map(ac => (
                          <button
                            key={ac.id}
                            onClick={() => {
                              if (newConsoleClassIds.includes(ac.id)) {
                                setNewConsoleClassIds(prev => prev.filter(id => id !== ac.id));
                              } else {
                                setNewConsoleClassIds(prev => [...prev, ac.id]);
                              }
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              newConsoleClassIds.includes(ac.id)
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: ac.color }}
                            />
                            {ac.name}
                            {newConsoleClassIds.includes(ac.id) && <Check className="w-3 h-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={resetNewConsoleForm}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddConsole}
                    disabled={!newConsoleName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Erstellen
                  </button>
                </div>
              </div>
            )}

            {alarmConsoles.length === 0 && !showNewConsoleForm ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
                <Monitor className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">Noch keine Alarmkonsolen definiert.</p>
                <p className="text-sm text-slate-500 mt-1">Erstellen Sie eine Konsole zur Anzeige von Alarmen.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alarmConsoles.map(console => (
                  <AlarmConsoleItem
                    key={console.id}
                    console={console}
                    alarmClasses={alarmClasses}
                    alarmCount={getAlarmCountForConsole(console.id)}
                    isExpanded={expandedConsoleId === console.id}
                    isEditing={editingConsoleId === console.id}
                    onToggleExpand={() => setExpandedConsoleId(prev => prev === console.id ? null : console.id)}
                    onEdit={() => setEditingConsoleId(console.id)}
                    onCancelEdit={() => setEditingConsoleId(null)}
                    onUpdate={(updates) => {
                      onUpdateAlarmConsole(console.id, updates);
                      setEditingConsoleId(null);
                    }}
                    onDelete={() => onDeleteAlarmConsole(console.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Aktive Alarme</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {activeAlarms.length === 0
                    ? 'Keine aktiven Alarme vorhanden.'
                    : `${activeAlarms.length} aktive${activeAlarms.length === 1 ? 'r Alarm' : ' Alarme'}`
                  }
                </p>
              </div>
            </div>

            {activeAlarms.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
                <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-green-400 font-medium">Alles in Ordnung</p>
                <p className="text-sm text-slate-500 mt-1">Keine aktiven Alarme vorhanden.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeAlarms
                  .sort((a, b) => b.triggeredAt - a.triggeredAt)
                  .map(alarm => {
                    const alarmClass = alarmClasses.find(ac => ac.id === alarm.alarmClassId);
                    return (
                      <div
                        key={alarm.id}
                        className={`bg-slate-800 rounded-xl p-4 border-l-4 ${
                          alarm.state === 'acknowledged' ? 'opacity-70' : ''
                        }`}
                        style={{ borderLeftColor: alarmClass?.color || '#ef4444' }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className="p-2 rounded-lg"
                              style={{ backgroundColor: `${alarmClass?.color}20` }}
                            >
                              {alarm.state === 'active' ? (
                                <Bell className="w-5 h-5 animate-pulse" style={{ color: alarmClass?.color }} />
                              ) : (
                                <Check className="w-5 h-5" style={{ color: alarmClass?.color }} />
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium">{alarm.alarmText}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                Quelle: {alarm.sourceNodeName} | Klasse: {alarmClass?.name || 'Unbekannt'}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Ausgeloest: {new Date(alarm.triggeredAt).toLocaleString('de-DE')}
                                {alarm.acknowledgedAt && (
                                  <> | Quittiert: {new Date(alarm.acknowledgedAt).toLocaleString('de-DE')}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {alarm.state === 'active' && (
                              <button
                                onClick={() => onAcknowledgeAlarm(alarm.id)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg transition-colors"
                              >
                                Quittieren
                              </button>
                            )}
                            <button
                              onClick={() => onClearAlarm(alarm.id)}
                              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded-lg transition-colors"
                            >
                              Loeschen
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sources' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Alarm-Quellen</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Alle Logik-Bausteine mit Alarm-Konfiguration. Hier koennen Sie Alarme direkt aktivieren und konfigurieren.
                </p>
              </div>
            </div>

            {alarmSourceNodes.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">
                <Cpu className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400">Keine Alarm-faehigen Bausteine gefunden.</p>
                <p className="text-sm text-slate-500 mt-1">
                  Fuegen Sie Bausteine wie Sensor, Pumpe, Ventil oder Schwellwert zur Logik hinzu.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alarmSourceNodes.map(source => (
                  <AlarmSourceItem
                    key={`${source.pageId}-${source.node.id}`}
                    source={source}
                    alarmClasses={alarmClasses}
                    activeAlarms={activeAlarms.filter(a => a.sourceNodeId === source.node.id)}
                    onUpdateConfig={(config) => {
                      if (onUpdateNodeConfig) {
                        onUpdateNodeConfig(source.pageId, source.node.id, config);
                      }
                    }}
                    onAcknowledgeAlarm={onAcknowledgeAlarm}
                    onClearAlarm={onClearAlarm}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface AlarmSourceItemProps {
  source: AlarmSourceNode;
  alarmClasses: AlarmClass[];
  activeAlarms: ActiveAlarm[];
  onUpdateConfig: (config: Record<string, unknown>) => void;
  onAcknowledgeAlarm: (alarmId: string) => void;
  onClearAlarm: (alarmId: string) => void;
}

const AlarmSourceItem: React.FC<AlarmSourceItemProps> = ({
  source,
  alarmClasses,
  activeAlarms,
  onUpdateConfig,
  onAcknowledgeAlarm,
  onClearAlarm
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cfg = source.node.data?.config || {};

  const getAlarmConfig = () => {
    switch (source.node.type) {
      case 'sensor-control':
        return {
          configKey: 'sensorAlarmConfig',
          labelPrefix: 'Sensor',
          hasEnabled: false,
          config: (cfg.sensorAlarmConfig || {}) as { alarmClassId?: string }
        };
      case 'pump-control':
        return {
          configKey: 'aggregateAlarmConfig',
          labelPrefix: 'Pumpe',
          hasEnabled: false,
          config: (cfg.aggregateAlarmConfig || {}) as { faultAlarmClassId?: string; maintenanceAlarmClassId?: string }
        };
      case 'aggregate-control':
        return {
          configKey: 'aggregateAlarmConfig',
          labelPrefix: 'Aggregat',
          hasEnabled: false,
          config: (cfg.aggregateAlarmConfig || {}) as { faultAlarmClassId?: string; maintenanceAlarmClassId?: string }
        };
      case 'valve-control':
        return {
          configKey: 'valveAlarmConfig',
          labelPrefix: 'Ventil',
          hasEnabled: false,
          config: (cfg.valveAlarmConfig || {}) as { alarmClassId?: string }
        };
      case 'dp-boolean':
        return {
          configKey: 'booleanAlarmConfig',
          labelPrefix: 'Boolean',
          hasEnabled: true,
          config: (cfg.booleanAlarmConfig || { enabled: false, alarmValue: true }) as { enabled: boolean; alarmClassId?: string; alarmText?: string; alarmValue: boolean }
        };
      case 'dp-numeric':
        return {
          configKey: 'numericAlarmConfig',
          labelPrefix: 'Numerisch',
          hasEnabled: true,
          config: (cfg.numericAlarmConfig || { enabled: false }) as { enabled: boolean; alarmClassId?: string }
        };
      case 'dp-enum':
        return {
          configKey: 'enumAlarmConfig',
          labelPrefix: 'Enum',
          hasEnabled: true,
          config: (cfg.enumAlarmConfig || { enabled: false, alarmValues: [] }) as { enabled: boolean; alarmClassId?: string; alarmValues: (number | string)[] }
        };
      case 'threshold':
        return {
          configKey: 'booleanAlarmConfig',
          labelPrefix: 'Schwellwert',
          hasEnabled: true,
          config: (cfg.booleanAlarmConfig || { enabled: false, alarmValue: true }) as { enabled: boolean; alarmClassId?: string; alarmText?: string }
        };
      case 'compare':
        return {
          configKey: 'booleanAlarmConfig',
          labelPrefix: 'Vergleich',
          hasEnabled: true,
          config: (cfg.booleanAlarmConfig || { enabled: false, alarmValue: true }) as { enabled: boolean; alarmClassId?: string; alarmText?: string }
        };
      default:
        return {
          configKey: 'booleanAlarmConfig',
          labelPrefix: '',
          hasEnabled: true,
          config: (cfg.booleanAlarmConfig || { enabled: false, alarmValue: true }) as { enabled: boolean; alarmClassId?: string; alarmText?: string }
        };
    }
  };

  const alarmCfg = getAlarmConfig();
  const isAggregate = source.node.type === 'pump-control' || source.node.type === 'aggregate-control';

  const isEnabled = alarmCfg.hasEnabled
    ? (alarmCfg.config as { enabled?: boolean }).enabled === true
    : isAggregate
      ? !!(alarmCfg.config as { faultAlarmClassId?: string }).faultAlarmClassId
      : !!(alarmCfg.config as { alarmClassId?: string }).alarmClassId;

  const currentClassId = isAggregate
    ? (alarmCfg.config as { faultAlarmClassId?: string }).faultAlarmClassId
    : (alarmCfg.config as { alarmClassId?: string }).alarmClassId;

  const currentText = (alarmCfg.config as { alarmText?: string }).alarmText;
  const currentClass = alarmClasses.find(ac => ac.id === currentClassId);

  const handleToggleEnabled = () => {
    if (alarmCfg.hasEnabled) {
      const newCfg = { ...alarmCfg.config, enabled: !isEnabled };
      onUpdateConfig({ [alarmCfg.configKey]: newCfg });
    }
  };

  const handleClassChange = (classId: string) => {
    if (isAggregate) {
      const newCfg = { ...alarmCfg.config, faultAlarmClassId: classId || undefined };
      onUpdateConfig({ [alarmCfg.configKey]: newCfg });
    } else {
      const newCfg = { ...alarmCfg.config, alarmClassId: classId || undefined };
      onUpdateConfig({ [alarmCfg.configKey]: newCfg });
    }
  };

  const handleTextChange = (text: string) => {
    const newCfg = { ...alarmCfg.config, alarmText: text || undefined };
    onUpdateConfig({ [alarmCfg.configKey]: newCfg });
  };

  const nodeLabel = cfg.customLabel as string || source.node.data.label || source.node.type;

  return (
    <div className={`bg-slate-800 rounded-xl overflow-hidden ${source.hasActiveAlarm ? 'ring-2 ring-red-500/50' : ''}`}>
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${source.hasActiveAlarm ? 'bg-red-900/30' : isEnabled ? 'bg-green-900/30' : 'bg-slate-700'}`}>
            {source.hasActiveAlarm ? (
              <Bell className="w-5 h-5 text-red-400 animate-pulse" />
            ) : (
              <Cpu className={`w-5 h-5 ${isEnabled ? 'text-green-400' : 'text-slate-400'}`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{nodeLabel}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                {alarmCfg.labelPrefix || source.node.type}
              </span>
              {isEnabled && currentClass && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${currentClass.color}20`, color: currentClass.color }}
                >
                  {currentClass.name}
                </span>
              )}
              {source.hasActiveAlarm && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white animate-pulse">
                  {source.activeAlarmCount} Alarm{source.activeAlarmCount > 1 ? 'e' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Seite: {source.pageName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alarmCfg.hasEnabled && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleEnabled(); }}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                isEnabled
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-300'
              }`}
            >
              {isEnabled ? 'Aktiv' : 'Inaktiv'}
            </button>
          )}
          {!alarmCfg.hasEnabled && isEnabled && (
            <span className="px-3 py-1.5 text-xs rounded-lg bg-green-600/20 text-green-400">
              Konfiguriert
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Alarmklasse</label>
              <select
                value={currentClassId || ''}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-green-500 focus:outline-none"
              >
                <option value="">-- Keine Klasse --</option>
                {alarmClasses.map(ac => (
                  <option key={ac.id} value={ac.id}>{ac.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Alarmtext</label>
              <input
                type="text"
                value={currentText || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="z.B. Stoerung {label}"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>

          {activeAlarms.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Aktive Alarme dieses Bausteins:</p>
              {activeAlarms.map(alarm => {
                const alarmClass = alarmClasses.find(ac => ac.id === alarm.alarmClassId);
                return (
                  <div
                    key={alarm.id}
                    className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border-l-2"
                    style={{ borderLeftColor: alarmClass?.color || '#ef4444' }}
                  >
                    <div className="flex items-center gap-2">
                      {alarm.state === 'active' ? (
                        <Bell className="w-4 h-4 text-red-400 animate-pulse" />
                      ) : (
                        <Check className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="text-sm text-white">{alarm.alarmText || alarm.message}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(alarm.triggeredAt).toLocaleString('de-DE')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {alarm.state === 'active' && (
                        <button
                          onClick={() => onAcknowledgeAlarm(alarm.id)}
                          className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded transition-colors"
                        >
                          Quittieren
                        </button>
                      )}
                      <button
                        onClick={() => onClearAlarm(alarm.id)}
                        className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition-colors"
                      >
                        Loeschen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface AlarmClassItemProps {
  alarmClass: AlarmClass;
  alarmCount: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<AlarmClass>) => void;
  onDelete: () => void;
}

const AlarmClassItem: React.FC<AlarmClassItemProps> = ({
  alarmClass,
  alarmCount,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete
}) => {
  const [editName, setEditName] = useState(alarmClass.name);
  const [editDescription, setEditDescription] = useState(alarmClass.description || '');
  const [editPriority, setEditPriority] = useState(alarmClass.priority);
  const [editColor, setEditColor] = useState(alarmClass.color);

  const priorityConfig = PRIORITY_CONFIG[alarmClass.priority];

  if (isEditing) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-amber-600/50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Prioritaet</label>
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as AlarmPriority)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Beschreibung</label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Farbe</label>
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancelEdit}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onUpdate({
              name: editName,
              description: editDescription || undefined,
              priority: editPriority,
              color: editColor
            })}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors"
          >
            <Check className="w-3 h-3" />
            Speichern
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-slate-800 rounded-xl p-4 border-l-4 hover:bg-slate-750 transition-colors"
      style={{ borderLeftColor: alarmClass.color }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${alarmClass.color}20`, color: alarmClass.color }}
          >
            {priorityConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{alarmClass.name}</span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: `${alarmClass.color}20`, color: alarmClass.color }}
              >
                {priorityConfig.label}
              </span>
              {alarmCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white">
                  {alarmCount} aktiv
                </span>
              )}
            </div>
            {alarmClass.description && (
              <p className="text-xs text-slate-400 mt-0.5">{alarmClass.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface AlarmConsoleItemProps {
  console: AlarmConsole;
  alarmClasses: AlarmClass[];
  alarmCount: number;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<AlarmConsole>) => void;
  onDelete: () => void;
}

const AlarmConsoleItem: React.FC<AlarmConsoleItemProps> = ({
  console,
  alarmClasses,
  alarmCount,
  isExpanded,
  isEditing,
  onToggleExpand,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete
}) => {
  const [editName, setEditName] = useState(console.name);
  const [editDescription, setEditDescription] = useState(console.description || '');
  const [editClassIds, setEditClassIds] = useState(console.alarmClassIds);

  const linkedClasses = alarmClasses.filter(ac => console.alarmClassIds.includes(ac.id));

  if (isEditing) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-blue-600/50">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Beschreibung</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">Alarmklassen</label>
            <div className="flex flex-wrap gap-2">
              {alarmClasses.map(ac => (
                <button
                  key={ac.id}
                  onClick={() => {
                    if (editClassIds.includes(ac.id)) {
                      setEditClassIds(prev => prev.filter(id => id !== ac.id));
                    } else {
                      setEditClassIds(prev => [...prev, ac.id]);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    editClassIds.includes(ac.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: ac.color }}
                  />
                  {ac.name}
                  {editClassIds.includes(ac.id) && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancelEdit}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onUpdate({
              name: editName,
              description: editDescription || undefined,
              alarmClassIds: editClassIds
            })}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            <Check className="w-3 h-3" />
            Speichern
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-750 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-900/30">
            <Monitor className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{console.name}</span>
              {alarmCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white animate-pulse">
                  {alarmCount} aktiv
                </span>
              )}
            </div>
            {console.description && (
              <p className="text-xs text-slate-400 mt-0.5">{console.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3">
          <p className="text-xs text-slate-400 mb-2">Verknuepfte Alarmklassen:</p>
          {linkedClasses.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Alarmklassen verknuepft.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {linkedClasses.map(ac => (
                <span
                  key={ac.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ backgroundColor: `${ac.color}20`, color: ac.color }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ac.color }}
                  />
                  {ac.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlarmManagementView;
