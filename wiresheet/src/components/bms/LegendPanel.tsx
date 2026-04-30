import { MonitorLayer } from '../../types/building';

interface LegendPanelProps {
  activeLayerId: string;
  monitorLayers?: MonitorLayer[];
}

export function LegendPanel({ activeLayerId, monitorLayers = [] }: LegendPanelProps) {
  if (activeLayerId === 'normal') return null;

  const layer = monitorLayers.find(l => l.id === activeLayerId);
  if (!layer || layer.colorScale.stops.length === 0) return null;

  const { stops, min, max } = layer.colorScale;
  const gradient = `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.at * 100}%`).join(', ')})`;

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-3 min-w-[180px]">
      <p className="text-xs font-semibold text-slate-300 mb-2">{layer.name}</p>
      <div
        className="h-2.5 rounded-full mb-1.5"
        style={{ background: gradient }}
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min}{layer.unit ? ` ${layer.unit}` : ''}</span>
        <span>{max}{layer.unit ? ` ${layer.unit}` : ''}</span>
      </div>
    </div>
  );
}
