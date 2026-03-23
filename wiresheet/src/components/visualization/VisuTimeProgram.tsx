import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Calendar, Clock, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { TimeProgramWidgetConfig, TimeProgramParams } from '../../types/visualization';
import { TimeProgramEntry, TimeProgramException, ExceptionRecurrenceType } from '../../types/flow';

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_LABELS_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOURS = Array.from({ length: 25 }, (_, i) => i);
const PIXELS_PER_MIN = 600 / (24 * 60);
const MIN_DRAG_PX = 4;

const SWISS_HOLIDAYS: { key: string; label: string; date: string }[] = [
  { key: 'neujahr', label: 'Neujahr', date: '01-01' },
  { key: 'berchtoldstag', label: 'Berchtoldstag', date: '01-02' },
  { key: 'heilige-drei-koenige', label: 'Heilige Drei Koenige', date: '01-06' },
  { key: 'karfreitag', label: 'Karfreitag', date: '' },
  { key: 'ostermontag', label: 'Ostermontag', date: '' },
  { key: 'auffahrt', label: 'Auffahrt (Christi Himmelfahrt)', date: '' },
  { key: 'pfingstmontag', label: 'Pfingstmontag', date: '' },
  { key: 'fronleichnam', label: 'Fronleichnam', date: '' },
  { key: 'tag-der-arbeit', label: 'Tag der Arbeit', date: '05-01' },
  { key: 'bundesfeiertag', label: 'Bundesfeiertag', date: '08-01' },
  { key: 'mariä-himmelfahrt', label: 'Mariä Himmelfahrt', date: '08-15' },
  { key: 'allerheiligen', label: 'Allerheiligen', date: '11-01' },
  { key: 'mariä-empfaengnis', label: 'Mariä Empfaengnis', date: '12-08' },
  { key: 'weihnachten', label: 'Weihnachten', date: '12-25' },
  { key: 'stefanitag', label: 'Stephanstag', date: '12-26' },
];

function genId() {
  return `tp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, m));
  const h = Math.floor(clamped / 60) % 25;
  const min = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

const COLOR_PALETTE = [
  '#0d9488', '#0ea5e9', '#f59e0b', '#22c55e', '#ef4444', '#6366f1', '#ec4899', '#8b5cf6'
];

function getEntryColor(idx: number, outputType: string, value: boolean | number): string {
  if (outputType === 'boolean') {
    return value ? '#0d9488' : '#475569';
  }
  return COLOR_PALETTE[idx % COLOR_PALETTE.length];
}

interface DragState {
  entryId: string;
  day: number;
  type: 'move' | 'resize-start' | 'resize-end' | 'new';
  startX: number;
  startClickMin: number;
  origStartMin: number;
  origEndMin: number;
  hasMoved: boolean;
}

const DayRow: React.FC<{
  day: number;
  allEntries: TimeProgramEntry[];
  pendingEntry: { id: string; startMin: number; endMin: number } | null;
  outputType: string;
  activeDrag: DragState | null;
  onMouseDown: (e: React.MouseEvent, entry: TimeProgramEntry, type: 'move' | 'resize-start' | 'resize-end') => void;
  onRowMouseDown: (e: React.MouseEvent, day: number) => void;
}> = ({ day, allEntries, pendingEntry, outputType, activeDrag, onMouseDown, onRowMouseDown }) => {
  const dayEntries = allEntries
    .filter(e => e.enabled && e.days.includes(day))
    .sort((a, b) => a.priority - b.priority);

  const isDraggingThisDay = activeDrag?.day === day;

  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 flex-shrink-0 text-[10px] text-slate-400 text-right">{DAY_LABELS[day]}</div>
      <div
        className="relative h-7 bg-slate-800 rounded overflow-hidden flex-shrink-0"
        style={{
          width: 600,
          cursor: activeDrag ? (activeDrag.type === 'move' ? 'grabbing' : 'ew-resize') : 'crosshair'
        }}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-entry]')) return;
          onRowMouseDown(e, day);
        }}
      >
        {dayEntries.map((entry, idx) => {
          const startMin = timeToMinutes(entry.startTime);
          const endMin = timeToMinutes(entry.endTime);
          const isDraggingThis = activeDrag?.entryId === entry.id && isDraggingThisDay;
          const isBeingMoved = activeDrag?.entryId === entry.id;

          let displayStart = startMin;
          let displayEnd = endMin;

          if (pendingEntry && pendingEntry.id === entry.id) {
            displayStart = pendingEntry.startMin;
            displayEnd = pendingEntry.endMin;
          }

          const left = displayStart * PIXELS_PER_MIN;
          const width = Math.max(4, (displayEnd - displayStart) * PIXELS_PER_MIN);
          const color = getEntryColor(idx, outputType, entry.value);

          return (
            <div
              key={entry.id}
              data-entry={entry.id}
              className="absolute top-0.5 bottom-0.5 rounded"
              style={{
                left,
                width,
                backgroundColor: color,
                opacity: isBeingMoved && !isDraggingThis ? 0.35 : isDraggingThis ? 0.75 : 0.9,
                outline: isDraggingThis ? `2px solid white` : 'none',
                outlineOffset: '1px',
                cursor: activeDrag ? 'inherit' : 'grab',
                transition: activeDrag ? 'none' : 'opacity 0.1s',
                zIndex: isDraggingThis ? 10 : 1
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMouseDown(e, entry, 'move');
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-2.5"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)', cursor: 'ew-resize' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMouseDown(e, entry, 'resize-start');
                }}
              />
              <div
                className="absolute right-0 top-0 bottom-0 w-2.5"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)', cursor: 'ew-resize' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMouseDown(e, entry, 'resize-end');
                }}
              />
              {width > 40 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/80 pointer-events-none font-mono truncate px-3">
                  {minutesToTime(displayStart)}
                </span>
              )}
            </div>
          );
        })}

        {pendingEntry && pendingEntry.id === '__new__' && isDraggingThisDay && (
          <div
            className="absolute top-0.5 bottom-0.5 rounded pointer-events-none"
            style={{
              left: Math.min(pendingEntry.startMin, pendingEntry.endMin) * PIXELS_PER_MIN,
              width: Math.max(4, Math.abs(pendingEntry.endMin - pendingEntry.startMin) * PIXELS_PER_MIN),
              backgroundColor: outputType === 'boolean' ? '#0d9488' : '#0ea5e9',
              opacity: 0.65,
              outline: '2px dashed rgba(255,255,255,0.5)',
              outlineOffset: '1px'
            }}
          />
        )}
      </div>
    </div>
  );
};

const EntryList: React.FC<{
  entries: TimeProgramEntry[];
  outputType: string;
  onChange: (entries: TimeProgramEntry[]) => void;
}> = ({ entries, outputType, onChange }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (id: string, field: keyof TimeProgramEntry, val: unknown) => {
    onChange(entries.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  const toggleDay = (id: string, day: number) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const days = entry.days.includes(day) ? entry.days.filter(d => d !== day) : [...entry.days, day].sort();
    onChange(entries.map(e => e.id === id ? { ...e, days } : e));
  };

  return (
    <div className="space-y-1.5">
      {entries.map((entry, idx) => (
        <div
          key={entry.id}
          className={`rounded-lg border transition-all text-xs ${entry.enabled ? 'border-teal-800/50 bg-teal-950/20' : 'border-slate-700 bg-slate-800/40 opacity-60'}`}
        >
          <div className="px-3 py-2 flex items-center gap-2">
            <button
              onClick={() => update(entry.id, 'enabled', !entry.enabled)}
              className={`w-7 h-4 rounded-full flex-shrink-0 relative transition-colors ${entry.enabled ? 'bg-teal-600' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${entry.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
            </button>
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: getEntryColor(idx, outputType, entry.value) }} />
            <span className="font-mono text-slate-200 flex-shrink-0">{entry.startTime}–{entry.endTime}</span>
            <span className="text-slate-500 text-[10px] flex-shrink-0">{entry.days.map(d => DAY_LABELS[d]).join(' ')}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${outputType === 'boolean' ? (entry.value ? 'bg-teal-900/50 text-teal-400' : 'bg-slate-700 text-slate-400') : 'bg-blue-900/50 text-blue-400'}`}>
              {outputType === 'boolean' ? (entry.value ? 'Ein' : 'Aus') : String(entry.value)}
            </span>
            {entry.label && <span className="text-slate-500 truncate flex-1 text-[10px]">{entry.label}</span>}
            <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
              <button onClick={() => onChange([...entries, { ...entry, id: genId(), label: entry.label ? entry.label + ' (Kopie)' : '' }])} className="p-1 text-slate-500 hover:text-slate-300 transition-colors" title="Duplizieren"><Copy className="w-3 h-3" /></button>
              <button onClick={() => onChange(entries.filter((_, i) => i !== idx))} className="p-1 text-slate-500 hover:text-red-400 transition-colors" title="Loeschen"><Trash2 className="w-3 h-3" /></button>
              <button onClick={() => setExpanded(e => e === entry.id ? null : entry.id)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                {expanded === entry.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>
          {expanded === entry.id && (
            <div className="border-t border-slate-700/50 px-3 py-2.5 space-y-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Bezeichnung</label>
                <input type="text" value={entry.label || ''} onChange={e => update(entry.id, 'label', e.target.value)} placeholder="z.B. Heizung Tag" className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Wochentage</label>
                <div className="flex gap-1">
                  {DAY_LABELS.map((d, i) => (
                    <button key={i} onClick={() => toggleDay(entry.id, i)} className={`w-7 h-6 rounded text-[10px] font-medium transition-all ${entry.days.includes(i) ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`} title={DAY_LABELS_FULL[i]}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Von</label>
                  <input type="time" value={entry.startTime} onChange={e => update(entry.id, 'startTime', e.target.value)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Bis</label>
                  <input type="time" value={entry.endTime} onChange={e => update(entry.id, 'endTime', e.target.value)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Wert</label>
                {outputType === 'boolean' ? (
                  <div className="flex gap-2">
                    {[true, false].map(v => (
                      <button key={String(v)} onClick={() => update(entry.id, 'value', v)} className={`flex-1 py-1 rounded text-xs font-medium transition-all ${entry.value === v ? (v ? 'bg-teal-700 text-white' : 'bg-slate-600 text-white') : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{v ? 'Ein' : 'Aus'}</button>
                    ))}
                  </div>
                ) : (
                  <input type="number" value={Number(entry.value)} onChange={e => update(entry.id, 'value', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none" />
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Prioritaet (1 = hoch)</label>
                <input type="number" min={1} max={99} value={entry.priority} onChange={e => update(entry.id, 'priority', parseInt(e.target.value) || 1)} className="w-24 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ExceptionList: React.FC<{
  exceptions: TimeProgramException[];
  outputType: string;
  onChange: (exceptions: TimeProgramException[]) => void;
}> = ({ exceptions, outputType, onChange }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (id: string, field: keyof TimeProgramException, val: unknown) => {
    onChange(exceptions.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  const getRecurrenceLabel = (exc: TimeProgramException): string => {
    switch (exc.recurrence) {
      case 'monthly-day': return `Jeden ${exc.monthlyDay ?? '?'}. des Monats`;
      case 'weekly': return `Woechentlich ${DAY_LABELS[exc.weeklyWeekday ?? 0]}`;
      case 'swiss-holiday': return SWISS_HOLIDAYS.find(h => h.key === exc.swissHolidayKey)?.label ?? 'Schweizer Feiertag';
      default: return exc.date || 'Einmalig';
    }
  };

  const addSwissHoliday = (holiday: typeof SWISS_HOLIDAYS[0]) => {
    const newExc: TimeProgramException = {
      id: genId(),
      date: '',
      startTime: '00:00',
      endTime: '23:59',
      value: outputType === 'boolean' ? false : 0,
      label: holiday.label,
      enabled: true,
      recurrence: 'swiss-holiday',
      swissHolidayKey: holiday.key
    };
    onChange([...exceptions, newExc]);
  };

  const [showHolidayPicker, setShowHolidayPicker] = useState(false);
  const holidayBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; right: number } | null>(null);

  const openPicker = () => {
    if (holidayBtnRef.current) {
      const rect = holidayBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowHolidayPicker(v => !v);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {exceptions.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
            <Calendar className="w-8 h-8 text-slate-700" />
            <p className="text-xs">Keine Ausnahmetage definiert.</p>
          </div>
        )}
        {exceptions.map((exc, idx) => (
          <div key={exc.id} className={`rounded-lg border text-xs transition-all ${exc.enabled ? 'border-amber-800/50 bg-amber-950/20' : 'border-slate-700 bg-slate-800/40 opacity-60'}`}>
            <div className="px-3 py-2 flex items-center gap-2">
              <button
                onClick={() => update(exc.id, 'enabled', !exc.enabled)}
                className={`w-7 h-4 rounded-full flex-shrink-0 relative transition-colors ${exc.enabled ? 'bg-amber-600' : 'bg-slate-600'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${exc.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
              </button>
              <Calendar className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-slate-200 flex-1 truncate">{exc.label || getRecurrenceLabel(exc)}</span>
              <span className="text-slate-400 text-[10px] flex-shrink-0 font-mono">{exc.startTime}–{exc.endTime}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => onChange(exceptions.filter((_, i) => i !== idx))} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                <button onClick={() => setExpanded(e => e === exc.id ? null : exc.id)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                  {expanded === exc.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>
            {expanded === exc.id && (
              <div className="border-t border-slate-700/50 px-3 py-2.5 space-y-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Bezeichnung</label>
                  <input type="text" value={exc.label || ''} onChange={e => update(exc.id, 'label', e.target.value)} placeholder="z.B. Feiertag" className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Wiederholung</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['once', 'monthly-day', 'weekly', 'swiss-holiday'] as ExceptionRecurrenceType[]).map(r => (
                      <button
                        key={r}
                        onClick={() => update(exc.id, 'recurrence', r)}
                        className={`py-1.5 px-2 rounded text-[10px] font-medium transition-all text-left ${(exc.recurrence ?? 'once') === r ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                      >
                        {r === 'once' && 'Einmalig'}
                        {r === 'monthly-day' && 'Monatlich (Tag)'}
                        {r === 'weekly' && 'Woechentlich'}
                        {r === 'swiss-holiday' && 'CH-Feiertag'}
                      </button>
                    ))}
                  </div>
                </div>
                {(exc.recurrence === 'once' || !exc.recurrence) && (
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Datum</label>
                    <input type="date" value={exc.date} onChange={e => update(exc.id, 'date', e.target.value)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  </div>
                )}
                {exc.recurrence === 'monthly-day' && (
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tag im Monat (1–31)</label>
                    <input type="number" min={1} max={31} value={exc.monthlyDay ?? 1} onChange={e => update(exc.id, 'monthlyDay', parseInt(e.target.value) || 1)} className="w-24 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  </div>
                )}
                {exc.recurrence === 'weekly' && (
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Wochentag</label>
                    <div className="flex gap-1 flex-wrap">
                      {DAY_LABELS.map((d, i) => (
                        <button key={i} onClick={() => update(exc.id, 'weeklyWeekday', i)} className={`w-7 h-6 rounded text-[10px] font-medium transition-all ${exc.weeklyWeekday === i ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{d}</button>
                      ))}
                    </div>
                  </div>
                )}
                {exc.recurrence === 'swiss-holiday' && (
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Feiertag</label>
                    <select
                      value={exc.swissHolidayKey ?? ''}
                      onChange={e => update(exc.id, 'swissHolidayKey', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">-- Feiertag waehlen --</option>
                      {SWISS_HOLIDAYS.map(h => (
                        <option key={h.key} value={h.key}>{h.label}{h.date ? ` (${h.date})` : ' (beweglich)'}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Von</label>
                    <input type="time" value={exc.startTime} onChange={e => update(exc.id, 'startTime', e.target.value)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Bis</label>
                    <input type="time" value={exc.endTime} onChange={e => update(exc.id, 'endTime', e.target.value)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Wert</label>
                  {outputType === 'boolean' ? (
                    <div className="flex gap-2">
                      {[true, false].map(v => (
                        <button key={String(v)} onClick={() => update(exc.id, 'value', v)} className={`flex-1 py-1 rounded text-xs font-medium transition-all ${exc.value === v ? (v ? 'bg-teal-700 text-white' : 'bg-slate-600 text-white') : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{v ? 'Ein' : 'Aus'}</button>
                      ))}
                    </div>
                  ) : (
                    <input type="number" value={Number(exc.value)} onChange={e => update(exc.id, 'value', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            const newExc: TimeProgramException = {
              id: genId(),
              date: today,
              startTime: '00:00',
              endTime: '23:59',
              value: outputType === 'boolean' ? false : 0,
              label: '',
              enabled: true,
              recurrence: 'once'
            };
            onChange([...exceptions, newExc]);
          }}
          className="flex-1 py-2 border border-dashed border-amber-700/60 text-amber-500 hover:text-amber-300 hover:border-amber-500 text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Ausnahmetag hinzufuegen
        </button>
        <div>
          <button
            ref={holidayBtnRef}
            onClick={openPicker}
            className="py-2 px-3 border border-dashed border-amber-700/60 text-amber-500 hover:text-amber-300 hover:border-amber-500 text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            CH-Feiertage
          </button>
          {showHolidayPicker && pickerPos && createPortal(
            <>
              <div className="fixed inset-0 z-[99998]" onClick={() => setShowHolidayPicker(false)} />
              <div
                className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-[99999] w-64 overflow-y-auto"
                style={{ top: pickerPos.top, right: pickerPos.right, maxHeight: 320 }}
              >
                {SWISS_HOLIDAYS.map(h => (
                  <button
                    key={h.key}
                    onClick={() => { addSwissHoliday(h); setShowHolidayPicker(false); }}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                  >
                    <span className="font-medium">{h.label}</span>
                    {h.date ? <span className="text-slate-500 ml-2">{h.date}</span> : <span className="text-slate-500 ml-2 italic">beweglich</span>}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
};

interface VisuTimeProgramProps {
  config: TimeProgramWidgetConfig;
  value: { active?: boolean; output?: boolean | number } | null;
  isEditMode: boolean;
  onValueChange?: (updates: Record<string, unknown>) => void;
  params?: TimeProgramParams;
}

export const VisuTimeProgram: React.FC<VisuTimeProgramProps> = ({
  config,
  value,
  isEditMode,
  onValueChange,
  params
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedule' | 'list' | 'exceptions' | 'settings'>('schedule');
  const [localEntries, setLocalEntries] = useState<TimeProgramEntry[]>([]);
  const [localExceptions, setLocalExceptions] = useState<TimeProgramException[]>([]);
  const [localOutputType, setLocalOutputType] = useState('boolean');
  const [localDefaultValue, setLocalDefaultValue] = useState<boolean | number>(false);
  const [localName, setLocalName] = useState('');
  const [dirty, setDirty] = useState(false);

  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [pendingEntry, setPendingEntry] = useState<{ id: string; startMin: number; endMin: number } | null>(null);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const localEntriesRef = useRef(localEntries);
  localEntriesRef.current = localEntries;
  const localOutputTypeRef = useRef(localOutputType);
  localOutputTypeRef.current = localOutputType;

  const isActive = value?.active ?? false;
  const outputValue = value?.output;
  const tpName = config.tpName || params?.tpName || 'Zeitprogramm';
  const activeColor = config.activeColor || '#0d9488';
  const normalColor = config.normalColor || '#475569';
  const statusColor = isActive ? activeColor : normalColor;

  useEffect(() => {
    if (showPopup && paramsRef.current) {
      setLocalEntries((paramsRef.current.timeProgramEntries || []) as TimeProgramEntry[]);
      setLocalExceptions((paramsRef.current.timeProgramExceptions || []) as TimeProgramException[]);
      setLocalOutputType(paramsRef.current.timeProgramOutputType || 'boolean');
      setLocalDefaultValue(paramsRef.current.timeProgramDefaultValue ?? false);
      setLocalName(paramsRef.current.tpName || '');
      setDirty(false);
      setActiveDrag(null);
      setPendingEntry(null);
    }
  }, [showPopup]);

  const handleClick = useCallback(() => {
    if (!isEditMode) setShowPopup(true);
  }, [isEditMode]);

  const handleSave = useCallback(() => {
    onValueChange?.({
      timeProgramControl: {
        timeProgramEntries: localEntries,
        timeProgramExceptions: localExceptions,
        timeProgramOutputType: localOutputType,
        timeProgramDefaultValue: localDefaultValue,
        timeProgramName: localName
      }
    });
    setDirty(false);
  }, [onValueChange, localEntries, localExceptions, localOutputType, localDefaultValue, localName]);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleEntriesChange = useCallback((entries: TimeProgramEntry[]) => {
    setLocalEntries(entries);
    setDirty(true);
  }, []);

  const handleExceptionsChange = useCallback((exceptions: TimeProgramException[]) => {
    setLocalExceptions(exceptions);
    setDirty(true);
  }, []);

  const addEntry = useCallback(() => {
    const newEntry: TimeProgramEntry = {
      id: genId(),
      days: [1, 2, 3, 4, 5],
      startTime: '07:00',
      endTime: '17:00',
      value: localOutputType === 'boolean' ? true : 100,
      label: '',
      enabled: true,
      priority: localEntries.length + 1
    };
    handleEntriesChange([...localEntries, newEntry]);
  }, [localEntries, localOutputType, handleEntriesChange]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, entry: TimeProgramEntry, type: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault();
    e.stopPropagation();
    const rowEl = (e.currentTarget as HTMLElement).closest('[data-row-day]') as HTMLElement | null;
    const day = rowEl ? parseInt(rowEl.dataset.rowDay ?? '-1') : -1;
    setActiveDrag({
      entryId: entry.id,
      day,
      type,
      startX: e.clientX,
      startClickMin: 0,
      origStartMin: timeToMinutes(entry.startTime),
      origEndMin: timeToMinutes(entry.endTime),
      hasMoved: false
    });
    setPendingEntry({ id: entry.id, startMin: timeToMinutes(entry.startTime), endMin: timeToMinutes(entry.endTime) });
  }, []);

  const handleRowMouseDown = useCallback((e: React.MouseEvent, day: number) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickMin = clamp(Math.round(x / PIXELS_PER_MIN / 15) * 15, 0, 24 * 60 - 15);
    setActiveDrag({
      entryId: '__new__',
      day,
      type: 'new',
      startX: e.clientX,
      startClickMin: clickMin,
      origStartMin: clickMin,
      origEndMin: clickMin,
      hasMoved: false
    });
    setPendingEntry({ id: '__new__', startMin: clickMin, endMin: clickMin });
  }, []);

  useEffect(() => {
    if (!activeDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - activeDrag.startX;
      const hasMoved = Math.abs(deltaX) >= MIN_DRAG_PX;

      if (!hasMoved) return;

      const deltaMin = Math.round(deltaX / PIXELS_PER_MIN / 15) * 15;

      if (activeDrag.entryId === '__new__') {
        const rawEnd = activeDrag.startClickMin + deltaMin;
        const startMin = deltaMin >= 0 ? activeDrag.startClickMin : clamp(rawEnd, 0, 24 * 60 - 15);
        const endMin = deltaMin >= 0 ? clamp(rawEnd, activeDrag.startClickMin + 15, 24 * 60) : activeDrag.startClickMin + 15;
        setPendingEntry({ id: '__new__', startMin, endMin });
        setActiveDrag(prev => prev ? { ...prev, hasMoved: true } : null);
        return;
      }

      const entries = localEntriesRef.current;
      const idx = entries.findIndex(e => e.id === activeDrag.entryId);
      if (idx === -1) return;

      const entry = entries[idx];
      const duration = activeDrag.origEndMin - activeDrag.origStartMin;
      let newStartMin = activeDrag.origStartMin;
      let newEndMin = activeDrag.origEndMin;

      if (activeDrag.type === 'move') {
        newStartMin = clamp(activeDrag.origStartMin + deltaMin, 0, 24 * 60 - duration);
        newEndMin = newStartMin + duration;
      } else if (activeDrag.type === 'resize-start') {
        newStartMin = clamp(activeDrag.origStartMin + deltaMin, 0, activeDrag.origEndMin - 15);
        newEndMin = activeDrag.origEndMin;
      } else if (activeDrag.type === 'resize-end') {
        newStartMin = activeDrag.origStartMin;
        newEndMin = clamp(activeDrag.origEndMin + deltaMin, activeDrag.origStartMin + 15, 24 * 60);
      }

      setPendingEntry({ id: entry.id, startMin: newStartMin, endMin: newEndMin });
      setActiveDrag(prev => prev ? { ...prev, hasMoved: true } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - activeDrag.startX;
      const hasMoved = Math.abs(deltaX) >= MIN_DRAG_PX;

      if (activeDrag.entryId === '__new__') {
        if (hasMoved) {
          const deltaMin = Math.round(deltaX / PIXELS_PER_MIN / 15) * 15;
          const rawEnd = activeDrag.startClickMin + deltaMin;
          const startMin = deltaMin >= 0 ? activeDrag.startClickMin : clamp(rawEnd, 0, 24 * 60 - 15);
          const endMin = deltaMin >= 0 ? clamp(rawEnd, activeDrag.startClickMin + 15, 24 * 60) : activeDrag.startClickMin + 15;
          if (endMin - startMin >= 15) {
            const newEntry: TimeProgramEntry = {
              id: genId(),
              days: [activeDrag.day],
              startTime: minutesToTime(startMin),
              endTime: minutesToTime(endMin),
              value: localOutputTypeRef.current === 'boolean' ? true : 100,
              label: '',
              enabled: true,
              priority: localEntriesRef.current.length + 1
            };
            handleEntriesChange([...localEntriesRef.current, newEntry]);
          }
        } else {
          const clickMin = activeDrag.startClickMin;
          if (24 * 60 - clickMin >= 60) {
            const newEntry: TimeProgramEntry = {
              id: genId(),
              days: [activeDrag.day],
              startTime: minutesToTime(clickMin),
              endTime: minutesToTime(clamp(clickMin + 60, 0, 24 * 60)),
              value: localOutputTypeRef.current === 'boolean' ? true : 100,
              label: '',
              enabled: true,
              priority: localEntriesRef.current.length + 1
            };
            handleEntriesChange([...localEntriesRef.current, newEntry]);
          }
        }
        setPendingEntry(null);
        setActiveDrag(null);
        return;
      }

      if (hasMoved && pendingEntry && pendingEntry.id !== '__new__') {
        const entries = localEntriesRef.current;
        const idx = entries.findIndex(e => e.id === activeDrag.entryId);
        if (idx !== -1) {
          const updated = [...entries];
          updated[idx] = {
            ...updated[idx],
            startTime: minutesToTime(pendingEntry.startMin),
            endTime: minutesToTime(pendingEntry.endMin)
          };
          handleEntriesChange(updated);
        }
      }

      setPendingEntry(null);
      setActiveDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, pendingEntry, handleEntriesChange]);

  const TimeProgramSymbol: React.FC<{ size: number; color: string; active: boolean }> = ({ size, color, active }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="38" stroke={color} strokeWidth="4" fill={active ? color : 'transparent'} fillOpacity={active ? 0.15 : 0} />
      <circle cx="50" cy="50" r="3" fill={color} />
      <line x1="50" y1="20" x2="50" y2="50" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="70" y2="55" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="50" y1="15" x2="50" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="78" x2="50" y2="85" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="50" x2="22" y2="50" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="78" y1="50" x2="85" y2="50" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return (
    <>
      <div
        className="w-full h-full flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={handleClick}
        style={{ backgroundColor: 'transparent' }}
      >
        <div className="relative flex items-center justify-center" style={{ width: '60%', height: '55%', maxWidth: 80, maxHeight: 80 }}>
          <TimeProgramSymbol size={60} color={statusColor} active={isActive} />
        </div>
        <div className="text-center px-1 mt-1">
          <span className="text-xs text-slate-300 truncate block px-1 max-w-full">{tpName}</span>
          {outputValue !== undefined && (
            <span className="text-[10px] font-semibold" style={{ color: statusColor }}>
              {typeof outputValue === 'boolean' ? (outputValue ? 'Ein' : 'Aus') : String(outputValue)}
            </span>
          )}
        </div>
        {isActive && (
          <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: activeColor }} />
        )}
      </div>

      {showPopup && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center"
          style={{ zIndex: 99999 }}
          onClick={e => { if (e.target === e.currentTarget) setShowPopup(false); }}
        >
          <div
            className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 flex flex-col"
            style={{
              width: 740,
              maxHeight: '92vh',
              userSelect: activeDrag ? 'none' : undefined,
              cursor: activeDrag ? (activeDrag.type === 'move' ? 'grabbing' : 'ew-resize') : undefined
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700 flex-shrink-0"
              style={{ backgroundColor: activeColor + '18' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: activeColor + '25', border: `2px solid ${activeColor}` }}>
                  <Clock size={20} style={{ color: activeColor }} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{tpName}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                    <span>{isActive ? 'Aktiv' : 'Inaktiv'}</span>
                    {outputValue !== undefined && <span>· Ausgang: {typeof outputValue === 'boolean' ? (outputValue ? 'Ein' : 'Aus') : String(outputValue)}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowPopup(false)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="flex border-b border-slate-700 flex-shrink-0">
              {(['schedule', 'list', 'exceptions', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-all border-b-2 ${activeTab === tab ? 'border-teal-500 text-teal-400 bg-teal-950/20' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  {tab === 'schedule' && 'Wochenplan'}
                  {tab === 'list' && `Eintraege (${localEntries.length})`}
                  {tab === 'exceptions' && `Ausnahmen (${localExceptions.length})`}
                  {tab === 'settings' && 'Einstellungen'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {activeTab === 'schedule' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 flex-shrink-0" />
                    <div className="flex-shrink-0" style={{ width: 600 }}>
                      <div className="flex">
                        {HOURS.filter((_, i) => i % 2 === 0).map(h => (
                          <div key={h} className="text-[10px] text-slate-500 text-center" style={{ width: 600 / 12, flexShrink: 0 }}>{String(h).padStart(2, '0')}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {WEEK_ORDER.map(day => (
                    <div key={day} data-row-day={day}>
                      <DayRow
                        day={day}
                        allEntries={localEntries}
                        pendingEntry={pendingEntry}
                        outputType={localOutputType}
                        activeDrag={activeDrag}
                        onMouseDown={handleBarMouseDown}
                        onRowMouseDown={handleRowMouseDown}
                      />
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-500 mt-3 text-center">
                    Klick = neuer Eintrag (1h) · Ziehen = Bereich zeichnen · Balken ziehen = verschieben · Raender = Groesse
                  </p>
                </div>
              )}

              {activeTab === 'list' && (
                <div className="space-y-3">
                  <EntryList entries={localEntries} outputType={localOutputType} onChange={handleEntriesChange} />
                  <button onClick={addEntry} className="w-full py-2 border border-dashed border-teal-700/60 text-teal-500 hover:text-teal-300 hover:border-teal-500 text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Schalteintrag hinzufuegen
                  </button>
                </div>
              )}

              {activeTab === 'exceptions' && (
                <ExceptionList exceptions={localExceptions} outputType={localOutputType} onChange={handleExceptionsChange} />
              )}

              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Name</label>
                    <input type="text" value={localName} onChange={e => { setLocalName(e.target.value); markDirty(); }} placeholder="Zeitprogramm" className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Ausgangstyp</label>
                    <div className="flex gap-2">
                      {(['boolean', 'numeric'] as const).map(t => (
                        <button key={t} onClick={() => { setLocalOutputType(t); markDirty(); }} className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${localOutputType === t ? 'bg-teal-700 border-teal-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                          {t === 'boolean' ? 'Boolean (Ein/Aus)' : 'Numerisch'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Standardwert (ausserhalb Schaltzeiten)</label>
                    {localOutputType === 'boolean' ? (
                      <div className="flex gap-2">
                        {[false, true].map(v => (
                          <button key={String(v)} onClick={() => { setLocalDefaultValue(v); markDirty(); }} className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${localDefaultValue === v ? (v ? 'bg-teal-700 text-white' : 'bg-slate-600 text-white') : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                            {v ? 'Ein' : 'Aus'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input type="number" value={Number(localDefaultValue ?? 0)} onChange={e => { setLocalDefaultValue(parseFloat(e.target.value) || 0); markDirty(); }} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 focus:border-teal-500 focus:outline-none" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-5 py-3 border-t border-slate-700 flex-shrink-0">
              {dirty && <span className="text-[10px] text-amber-400">Ungespeicherte Aenderungen</span>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setShowPopup(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors">Abbrechen</button>
                <button onClick={handleSave} className="px-5 py-2 text-white text-sm rounded-lg font-medium transition-colors" style={{ backgroundColor: activeColor }}>Speichern</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
