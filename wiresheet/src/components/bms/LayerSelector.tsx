import { Thermometer, Wind, Droplets, AlertTriangle, Users, Zap, Gauge, Activity, LayoutGrid as Layout } from 'lucide-react';
import { BuildingLayerMode, LAYER_MODES } from '../../types/bms';

interface LayerSelectorProps {
  active: BuildingLayerMode;
  onChange: (mode: BuildingLayerMode) => void;
}

const layerIcons: Record<BuildingLayerMode, React.ReactNode> = {
  normal: <Layout size={14} />,
  temperature: <Thermometer size={14} />,
  co2: <Activity size={14} />,
  humidity: <Droplets size={14} />,
  alarm: <AlertTriangle size={14} />,
  occupancy: <Users size={14} />,
  airflow: <Wind size={14} />,
  energy: <Zap size={14} />,
  pressure: <Gauge size={14} />,
  comfort: <Activity size={14} />,
};

export function LayerSelector({ active, onChange }: LayerSelectorProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1">
        Ebene
      </p>
      {LAYER_MODES.map(mode => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          title={mode.description}
          className={[
            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all text-left',
            active === mode.id
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-900'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white',
          ].join(' ')}
        >
          <span className="shrink-0">{layerIcons[mode.id]}</span>
          <span className="flex-1">{mode.label}</span>
          {mode.unit && (
            <span className={active === mode.id ? 'text-sky-200' : 'text-slate-500'}>
              {mode.unit}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
