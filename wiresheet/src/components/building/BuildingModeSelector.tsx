import { Square, Thermometer, Wind, Droplets, AlertTriangle, Users, Gauge, Zap } from 'lucide-react';
import { BUILDING_MODES, getModeConfig } from '../../utils/buildingModes';
import { BuildingDisplayMode } from '../../types/building';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Square, Thermometer, Wind, Droplets, AlertTriangle, Users, Gauge, Zap,
};

interface Props {
  mode: BuildingDisplayMode;
  onChange: (m: BuildingDisplayMode) => void;
  compact?: boolean;
}

export function BuildingModeSelector({ mode, onChange, compact }: Props) {
  const active = getModeConfig(mode);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-lg">
        {BUILDING_MODES.map(m => {
          const Icon = ICON_MAP[m.icon] ?? Square;
          const isActive = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              title={m.description}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-900/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {!compact && <span>{m.label}</span>}
            </button>
          );
        })}
      </div>

      {mode !== 'normal' && active.colorScale.stops.length > 0 && (
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 shadow-lg">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
            <span>{active.label} Legende</span>
            <span className="text-slate-500">{active.colorScale.unit}</span>
          </div>
          <div
            className="h-2 rounded-full"
            style={{
              background: `linear-gradient(to right, ${active.colorScale.stops.map(s => s.color).join(', ')})`,
            }}
          />
          <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
            {active.colorScale.stops.map((s, i) => (
              <span key={i}>{s.at}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
