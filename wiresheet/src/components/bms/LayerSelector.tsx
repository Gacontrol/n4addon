import { Thermometer, Wind, Droplets, AlertTriangle, Users, Zap, Gauge, Activity, LayoutGrid as Layout, Layers } from 'lucide-react';
import { MonitorLayer } from '../../types/building';

interface LayerSelectorProps {
  active: string;
  onChange: (layerId: string) => void;
  monitorLayers?: MonitorLayer[];
}

function layerIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('temp')) return <Thermometer size={14} />;
  if (n.includes('co2') || n.includes('co₂')) return <Activity size={14} />;
  if (n.includes('feuch') || n.includes('humid')) return <Droplets size={14} />;
  if (n.includes('alarm')) return <AlertTriangle size={14} />;
  if (n.includes('beleg') || n.includes('occup') || n.includes('präs')) return <Users size={14} />;
  if (n.includes('luft') || n.includes('air')) return <Wind size={14} />;
  if (n.includes('energ')) return <Zap size={14} />;
  if (n.includes('druck') || n.includes('press')) return <Gauge size={14} />;
  return <Layers size={14} />;
}

export function LayerSelector({ active, onChange, monitorLayers = [] }: LayerSelectorProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1">
        Ebene
      </p>

      {/* Normal / neutral layer always present */}
      <button
        onClick={() => onChange('normal')}
        className={[
          'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all text-left',
          active === 'normal'
            ? 'bg-sky-600 text-white shadow-sm shadow-sky-900'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white',
        ].join(' ')}
      >
        <span className="shrink-0"><Layout size={14} /></span>
        <span className="flex-1">Normal</span>
      </button>

      {monitorLayers.slice().sort((a, b) => a.order - b.order).map(layer => (
        <button
          key={layer.id}
          onClick={() => onChange(layer.id)}
          className={[
            'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all text-left',
            active === layer.id
              ? 'bg-sky-600 text-white shadow-sm shadow-sky-900'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white',
          ].join(' ')}
        >
          <span className="shrink-0">{layerIcon(layer.name)}</span>
          <span className="flex-1">{layer.name}</span>
          {layer.unit && (
            <span className={active === layer.id ? 'text-sky-200' : 'text-slate-500'}>
              {layer.unit}
            </span>
          )}
        </button>
      ))}

      {monitorLayers.length === 0 && (
        <p className="px-2.5 py-2 text-xs text-slate-600 italic">
          Keine Ebenen definiert
        </p>
      )}
    </div>
  );
}
