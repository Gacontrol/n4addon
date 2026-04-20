import { Thermometer, Wind, Droplets, AlertTriangle, Users, Settings2, Palette, Ban } from 'lucide-react';
import { BUILDING_MODES, BuildingDisplayMode } from '../../types/roomDisplay';

interface Props {
  activeMode: BuildingDisplayMode;
  onChange: (m: BuildingDisplayMode) => void;
  compact?: boolean;
}

const ICONS: Record<BuildingDisplayMode, typeof Thermometer> = {
  none: Ban,
  temperature: Thermometer,
  co2: Wind,
  humidity: Droplets,
  alarm: AlertTriangle,
  presence: Users,
  mode: Settings2,
  custom: Palette,
};

export function BuildingModeSelector({ activeMode, onChange, compact = false }: Props) {
  return (
    <div className={`flex items-center gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1 backdrop-blur-sm ${compact ? '' : 'shadow-lg'}`}>
      {BUILDING_MODES.map(mode => {
        const Icon = ICONS[mode.id];
        const active = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            title={mode.description}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              active
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {!compact && <span>{mode.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
