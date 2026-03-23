import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Clock, Calendar, ToggleLeft, Hash, ChevronDown, ChevronUp, AlertTriangle, Copy } from 'lucide-react';
import { TimeProgramEntry, TimeProgramException, NodeConfig } from '../types/flow';

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_LABELS_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface TimeProgramEditorProps {
  config: NodeConfig;
  onConfigChange: (updates: Partial<NodeConfig>) => void;
}

function genId() {
  return `tp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatValueDisplay(val: number | boolean, outputType: string): string {
  if (outputType === 'boolean') return val ? 'Ein' : 'Aus';
  return String(val);
}

const DaySelector: React.FC<{ days: number[]; onChange: (days: number[]) => void }> = ({ days, onChange }) => (
  <div className="flex gap-1">
    {DAY_LABELS.map((d, i) => (
      <button
        key={i}
        onClick={() => {
          const next = days.includes(i) ? days.filter(x => x !== i) : [...days, i].sort();
          onChange(next);
        }}
        className={`w-8 h-7 rounded text-xs font-medium transition-all ${
          days.includes(i)
            ? 'bg-teal-600 text-white'
            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
        }`}
        title={DAY_LABELS_FULL[i]}
      >
        {d}
      </button>
    ))}
  </div>
);

const EntryRow: React.FC<{
  entry: TimeProgramEntry;
  outputType: string;
  onChange: (updated: TimeProgramEntry) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ entry, outputType, onChange, onDelete, onDuplicate }) => {
  const [expanded, setExpanded] = useState(false);

  const updateEntry = (field: keyof TimeProgramEntry, val: unknown) => {
    onChange({ ...entry, [field]: val });
  };

  const startMin = timeToMinutes(entry.startTime);
  const endMin = timeToMinutes(entry.endTime);
  const durationMin = endMin > startMin ? endMin - startMin : 0;
  const durationH = Math.floor(durationMin / 60);
  const durationM = durationMin % 60;

  return (
    <div className={`rounded-lg border transition-all ${entry.enabled ? 'border-teal-700/50 bg-teal-950/20' : 'border-slate-700 bg-slate-800/40 opacity-60'}`}>
      <div className="px-3 py-2.5 flex items-center gap-3">
        <button
          onClick={() => updateEntry('enabled', !entry.enabled)}
          className={`w-8 h-5 rounded-full flex-shrink-0 relative transition-colors ${entry.enabled ? 'bg-teal-600' : 'bg-slate-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${entry.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs font-mono text-white">{entry.startTime} – {entry.endTime}</span>
          {durationMin > 0 && (
            <span className="text-[10px] text-slate-400">
              ({durationH > 0 ? `${durationH}h ` : ''}{durationM > 0 ? `${durationM}m` : ''})
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
            outputType === 'boolean'
              ? (entry.value ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-700 text-slate-400')
              : 'bg-blue-900/50 text-blue-400'
          }`}>
            {formatValueDisplay(entry.value, outputType)}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-slate-500 hidden sm:block">
            {entry.days.map(d => DAY_LABELS[d]).join('·')}
          </span>
          <button onClick={onDuplicate} className="p-1 text-slate-500 hover:text-slate-300 transition-colors" title="Duplizieren">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="p-1 text-slate-500 hover:text-red-400 transition-colors" title="Löschen">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-700/60 px-3 py-3 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Bezeichnung</label>
            <input
              type="text"
              value={entry.label || ''}
              onChange={e => updateEntry('label', e.target.value)}
              placeholder="z.B. Heizung Tag"
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Wochentage</label>
            <DaySelector days={entry.days} onChange={d => updateEntry('days', d)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Von</label>
              <input
                type="time"
                value={entry.startTime}
                onChange={e => updateEntry('startTime', e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Bis</label>
              <input
                type="time"
                value={entry.endTime}
                onChange={e => updateEntry('endTime', e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Wert / Ausgang</label>
            {outputType === 'boolean' ? (
              <div className="flex gap-2">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    onClick={() => updateEntry('value', v)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      entry.value === v
                        ? (v ? 'bg-emerald-700 text-white' : 'bg-slate-600 text-white')
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {v ? 'Ein (true)' : 'Aus (false)'}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                value={Number(entry.value)}
                onChange={e => updateEntry('value', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
              />
            )}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Priorität</label>
            <input
              type="number"
              min={1}
              max={99}
              value={entry.priority}
              onChange={e => updateEntry('priority', parseInt(e.target.value) || 1)}
              className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">Niedrigerer Wert = höhere Priorität</p>
          </div>
        </div>
      )}
    </div>
  );
};

const ExceptionRow: React.FC<{
  exc: TimeProgramException;
  outputType: string;
  onChange: (updated: TimeProgramException) => void;
  onDelete: () => void;
}> = ({ exc, outputType, onChange, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const updateExc = (field: keyof TimeProgramException, val: unknown) => {
    onChange({ ...exc, [field]: val });
  };

  return (
    <div className={`rounded-lg border transition-all ${exc.enabled ? 'border-amber-700/50 bg-amber-950/20' : 'border-slate-700 bg-slate-800/40 opacity-60'}`}>
      <div className="px-3 py-2.5 flex items-center gap-3">
        <button
          onClick={() => updateExc('enabled', !exc.enabled)}
          className={`w-8 h-5 rounded-full flex-shrink-0 relative transition-colors ${exc.enabled ? 'bg-amber-600' : 'bg-slate-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${exc.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-xs font-mono text-white">{exc.date}</span>
          <span className="text-xs text-slate-400 font-mono">{exc.startTime} – {exc.endTime}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-amber-900/50 text-amber-300`}>
            {formatValueDisplay(exc.value, outputType)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onDelete} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-700/60 px-3 py-3 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Bezeichnung</label>
            <input
              type="text"
              value={exc.label || ''}
              onChange={e => updateExc('label', e.target.value)}
              placeholder="z.B. Feiertag"
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Datum</label>
            <input
              type="date"
              value={exc.date}
              onChange={e => updateExc('date', e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Von</label>
              <input
                type="time"
                value={exc.startTime}
                onChange={e => updateExc('startTime', e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Bis</label>
              <input
                type="time"
                value={exc.endTime}
                onChange={e => updateExc('endTime', e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Wert</label>
            {outputType === 'boolean' ? (
              <div className="flex gap-2">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    onClick={() => updateExc('value', v)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      exc.value === v
                        ? (v ? 'bg-emerald-700 text-white' : 'bg-slate-600 text-white')
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {v ? 'Ein (true)' : 'Aus (false)'}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                value={Number(exc.value)}
                onChange={e => updateExc('value', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const WeekPreview: React.FC<{ entries: TimeProgramEntry[]; outputType: string }> = ({ entries, outputType }) => {
  const enabled = entries.filter(e => e.enabled);
  const sorted = [...enabled].sort((a, b) => a.priority - b.priority);

  const getActiveEntryAt = (day: number, minute: number): TimeProgramEntry | null => {
    for (const entry of sorted) {
      if (!entry.days.includes(day)) continue;
      const start = timeToMinutes(entry.startTime);
      const end = timeToMinutes(entry.endTime);
      if (minute >= start && minute < end) return entry;
    }
    return null;
  };

  const HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

  return (
    <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
      <div className="min-w-[480px]">
        <div className="flex mb-1">
          <div className="w-8 flex-shrink-0" />
          <div className="flex-1 flex">
            {HOURS.map((h, i) => i < HOURS.length - 1 && (
              <div key={h} className="flex-1 text-[9px] text-slate-500 text-center">{String(h).padStart(2, '0')}</div>
            ))}
          </div>
        </div>
        {[1, 2, 3, 4, 5, 6, 0].map(day => (
          <div key={day} className="flex items-center mb-1 gap-1">
            <div className="w-8 flex-shrink-0 text-[10px] text-slate-400 text-right pr-1">{DAY_LABELS[day]}</div>
            <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden flex">
              {Array.from({ length: 48 }, (_, i) => {
                const minute = i * 30;
                const entry = getActiveEntryAt(day, minute);
                let bg = 'bg-slate-800';
                if (entry) {
                  if (outputType === 'boolean') {
                    bg = entry.value ? 'bg-teal-600' : 'bg-slate-600';
                  } else {
                    const val = Number(entry.value);
                    const intensity = Math.min(Math.max(val / 100, 0), 1);
                    bg = intensity > 0.5 ? 'bg-teal-600' : 'bg-teal-900';
                  }
                }
                return (
                  <div
                    key={i}
                    className={`flex-1 ${bg} transition-colors`}
                    title={entry ? `${entry.startTime}-${entry.endTime}: ${formatValueDisplay(entry.value, outputType)}${entry.label ? ` (${entry.label})` : ''}` : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TimeProgramEditor: React.FC<TimeProgramEditorProps> = ({ config, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState<'entries' | 'exceptions' | 'settings'>('entries');

  const outputType = (config.timeProgramOutputType as string) || 'boolean';
  const entries: TimeProgramEntry[] = (config.timeProgramEntries as TimeProgramEntry[]) || [];
  const exceptions: TimeProgramException[] = (config.timeProgramExceptions as TimeProgramException[]) || [];

  const updateEntries = useCallback((next: TimeProgramEntry[]) => {
    onConfigChange({ timeProgramEntries: next });
  }, [onConfigChange]);

  const updateExceptions = useCallback((next: TimeProgramException[]) => {
    onConfigChange({ timeProgramExceptions: next });
  }, [onConfigChange]);

  const addEntry = () => {
    const newEntry: TimeProgramEntry = {
      id: genId(),
      days: [1, 2, 3, 4, 5],
      startTime: '07:00',
      endTime: '17:00',
      value: outputType === 'boolean' ? true : 100,
      label: '',
      enabled: true,
      priority: entries.length + 1
    };
    updateEntries([...entries, newEntry]);
  };

  const addException = () => {
    const today = new Date().toISOString().split('T')[0];
    const newExc: TimeProgramException = {
      id: genId(),
      date: today,
      startTime: '00:00',
      endTime: '23:59',
      value: outputType === 'boolean' ? false : 0,
      label: '',
      enabled: true
    };
    updateExceptions([...exceptions, newExc]);
  };

  const duplicateEntry = (entry: TimeProgramEntry) => {
    const dup: TimeProgramEntry = { ...entry, id: genId(), label: (entry.label ? entry.label + ' (Kopie)' : 'Kopie') };
    updateEntries([...entries, dup]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 bg-slate-900 rounded-lg">
        {(['entries', 'exceptions', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === tab
                ? 'bg-teal-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'entries' && `Schaltzeiten (${entries.length})`}
            {tab === 'exceptions' && `Ausnahmen (${exceptions.length})`}
            {tab === 'settings' && 'Einstellungen'}
          </button>
        ))}
      </div>

      {activeTab === 'entries' && (
        <div className="space-y-3">
          <WeekPreview entries={entries} outputType={outputType} />
          <div className="space-y-2">
            {entries.length === 0 && (
              <div className="text-center py-4 text-slate-500 text-xs">
                Noch keine Schaltzeiten. Klicke auf &quot;Hinzufügen&quot;.
              </div>
            )}
            {entries.map((entry, idx) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                outputType={outputType}
                onChange={updated => {
                  const next = [...entries];
                  next[idx] = updated;
                  updateEntries(next);
                }}
                onDelete={() => updateEntries(entries.filter((_, i) => i !== idx))}
                onDuplicate={() => duplicateEntry(entry)}
              />
            ))}
          </div>
          <button
            onClick={addEntry}
            className="w-full py-2 border border-dashed border-teal-700/60 text-teal-500 hover:text-teal-300 hover:border-teal-500 text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Schaltzeit hinzufügen
          </button>
        </div>
      )}

      {activeTab === 'exceptions' && (
        <div className="space-y-2">
          {exceptions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-5 text-slate-500">
              <Calendar className="w-8 h-8 text-slate-700" />
              <p className="text-xs">Keine Ausnahmetage definiert.</p>
              <p className="text-[10px] text-slate-600">Ausnahmen überschreiben die Wochenprogramme.</p>
            </div>
          )}
          {exceptions.map((exc, idx) => (
            <ExceptionRow
              key={exc.id}
              exc={exc}
              outputType={outputType}
              onChange={updated => {
                const next = [...exceptions];
                next[idx] = updated;
                updateExceptions(next);
              }}
              onDelete={() => updateExceptions(exceptions.filter((_, i) => i !== idx))}
            />
          ))}
          <button
            onClick={addException}
            className="w-full py-2 border border-dashed border-amber-700/60 text-amber-500 hover:text-amber-300 hover:border-amber-500 text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Ausnahmetag hinzufügen
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Name</label>
            <input
              type="text"
              value={(config.timeProgramName as string) || ''}
              onChange={e => onConfigChange({ timeProgramName: e.target.value })}
              placeholder="Zeitprogramm"
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Ausgangstyp</label>
            <div className="flex gap-2">
              {(['boolean', 'numeric'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => onConfigChange({ timeProgramOutputType: t })}
                  className={`flex items-center gap-1.5 flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                    outputType === t
                      ? 'bg-teal-700 border-teal-600 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {t === 'boolean' ? <ToggleLeft className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                  {t === 'boolean' ? 'Boolean (Ein/Aus)' : 'Numerisch'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Standardwert (ausserhalb Schaltzeiten)</label>
            {outputType === 'boolean' ? (
              <div className="flex gap-2">
                {[false, true].map(v => (
                  <button
                    key={String(v)}
                    onClick={() => onConfigChange({ timeProgramDefaultValue: v })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      config.timeProgramDefaultValue === v
                        ? (v ? 'bg-emerald-700 text-white' : 'bg-slate-600 text-white')
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {v ? 'Ein (true)' : 'Aus (false)'}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                value={Number(config.timeProgramDefaultValue ?? 0)}
                onChange={e => onConfigChange({ timeProgramDefaultValue: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none"
              />
            )}
          </div>
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Priorisierung
            </p>
            <p className="text-[10px] text-slate-400">
              Bei überlappenden Schaltzeiten gewinnt der Eintrag mit der <strong className="text-slate-200">niedrigsten Prioritätsnummer</strong>.
            </p>
            <p className="text-[10px] text-slate-400">
              Ausnahmetage überschreiben immer das Wochenprogramm.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
