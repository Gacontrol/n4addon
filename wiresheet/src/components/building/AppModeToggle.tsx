import { PenTool, Monitor, Wrench } from 'lucide-react';
import { AppMode } from '../../hooks/useAppMode';

interface Props {
  mode: AppMode;
  onChange: (m: AppMode) => void;
  compact?: boolean;
}

const MODES: Array<{ id: AppMode; label: string; icon: typeof PenTool; desc: string }> = [
  { id: 'editor', label: 'Editor', icon: PenTool, desc: 'Struktur bearbeiten, Räume konfigurieren' },
  { id: 'monitor', label: 'Monitor', icon: Monitor, desc: 'Live-Überwachung, KPI-Ansicht' },
  { id: 'service', label: 'Service', icon: Wrench, desc: 'Diagnose und Wartung' },
];

export function AppModeToggle({ mode, onChange, compact = false }: Props) {
  return (
    <div className="flex items-center gap-1 bg-slate-900/70 border border-slate-800 rounded-lg p-1 backdrop-blur-sm shadow-lg">
      {MODES.map(m => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            title={m.desc}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              active
                ? m.id === 'editor'
                  ? 'bg-amber-600 text-white shadow-md'
                  : m.id === 'monitor'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {!compact && <span>{m.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
