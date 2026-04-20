import { LAYER_MODES, BuildingLayerMode } from '../../types/bms';

interface LegendPanelProps {
  activeLayer: BuildingLayerMode;
}

function interpolateColor(stops: { at: number; color: string }[], t: number): string {
  if (stops.length === 0) return '#94a3b8';
  if (t <= stops[0].at) return stops[0].color;
  if (t >= stops[stops.length - 1].at) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      return stops[i + 1].color;
    }
  }
  return stops[0].color;
}

export function LegendPanel({ activeLayer }: LegendPanelProps) {
  const mode = LAYER_MODES.find(m => m.id === activeLayer);
  if (!mode || activeLayer === 'normal' || mode.colorScale.stops.length === 0) return null;

  const { stops, min, max } = mode.colorScale;
  const gradient = `linear-gradient(to right, ${stops.map(s => `${s.color} ${s.at * 100}%`).join(', ')})`;

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-3 min-w-[180px]">
      <p className="text-xs font-semibold text-slate-300 mb-2">{mode.label}</p>
      <div
        className="h-2.5 rounded-full mb-1.5"
        style={{ background: gradient }}
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min} {mode.unit}</span>
        <span>{max} {mode.unit}</span>
      </div>
      {(activeLayer === 'alarm' || activeLayer === 'occupancy') && (
        <div className="mt-2 flex gap-3">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: stops[0]?.color }} />
            {activeLayer === 'alarm' ? 'OK' : 'Frei'}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: stops[stops.length - 1]?.color }} />
            {activeLayer === 'alarm' ? 'Alarm' : 'Belegt'}
          </span>
        </div>
      )}
    </div>
  );
}
