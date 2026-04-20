import { BuildingDisplayMode, BuildingDisplayModeConfig, Room } from '../types/building';

export const BUILDING_MODES: BuildingDisplayModeConfig[] = [
  {
    id: 'normal',
    label: 'Normal',
    icon: 'Square',
    category: 'neutral',
    description: 'Standardfarben des Raumtyps',
    colorScale: { stops: [], min: 0, max: 1, unit: '' },
  },
  {
    id: 'temperature',
    label: 'Temperatur',
    icon: 'Thermometer',
    category: 'temperature',
    description: 'Raumtemperatur als Heatmap',
    colorScale: {
      min: 15,
      max: 30,
      unit: '°C',
      stops: [
        { at: 15, color: '#1e3a8a' },
        { at: 19, color: '#22d3ee' },
        { at: 22, color: '#22c55e' },
        { at: 25, color: '#eab308' },
        { at: 30, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'co2',
    label: 'CO₂',
    icon: 'Wind',
    category: 'co2',
    description: 'CO₂-Konzentration pro Raum',
    colorScale: {
      min: 400,
      max: 2000,
      unit: 'ppm',
      stops: [
        { at: 400, color: '#22c55e' },
        { at: 800, color: '#84cc16' },
        { at: 1200, color: '#eab308' },
        { at: 1600, color: '#f97316' },
        { at: 2000, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'humidity',
    label: 'Feuchte',
    icon: 'Droplets',
    category: 'humidity',
    description: 'Raumluftfeuchte',
    colorScale: {
      min: 20,
      max: 80,
      unit: '%',
      stops: [
        { at: 20, color: '#f97316' },
        { at: 35, color: '#eab308' },
        { at: 50, color: '#22c55e' },
        { at: 65, color: '#0ea5e9' },
        { at: 80, color: '#3b82f6' },
      ],
    },
  },
  {
    id: 'alarm',
    label: 'Alarme',
    icon: 'AlertTriangle',
    category: 'alarm',
    description: 'Aktive Alarme hervorheben',
    colorScale: {
      min: 0,
      max: 1,
      unit: '',
      stops: [
        { at: 0, color: '#334155' },
        { at: 0.5, color: '#f97316' },
        { at: 1, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'presence',
    label: 'Präsenz',
    icon: 'Users',
    category: 'occupancy',
    description: 'Belegte vs. freie Räume',
    colorScale: {
      min: 0,
      max: 1,
      unit: '',
      stops: [
        { at: 0, color: '#334155' },
        { at: 1, color: '#22c55e' },
      ],
    },
  },
  {
    id: 'mode',
    label: 'Betriebsart',
    icon: 'Gauge',
    category: 'mode',
    description: 'Betriebsmodus des Raums',
    colorScale: {
      min: 0,
      max: 4,
      unit: '',
      stops: [
        { at: 0, color: '#475569' },
        { at: 1, color: '#22c55e' },
        { at: 2, color: '#0ea5e9' },
        { at: 3, color: '#eab308' },
        { at: 4, color: '#ef4444' },
      ],
    },
  },
  {
    id: 'airflow',
    label: 'Volumenstrom',
    icon: 'Wind',
    category: 'airflow',
    description: 'Zuluft / Abluft Auslastung',
    colorScale: {
      min: 0,
      max: 100,
      unit: '%',
      stops: [
        { at: 0, color: '#334155' },
        { at: 50, color: '#22d3ee' },
        { at: 100, color: '#0ea5e9' },
      ],
    },
  },
  {
    id: 'energy',
    label: 'Energie',
    icon: 'Zap',
    category: 'energy',
    description: 'Energieverbrauch pro Raum',
    colorScale: {
      min: 0,
      max: 10,
      unit: 'kWh',
      stops: [
        { at: 0, color: '#22c55e' },
        { at: 5, color: '#eab308' },
        { at: 10, color: '#ef4444' },
      ],
    },
  },
];

export function getModeConfig(mode: BuildingDisplayMode): BuildingDisplayModeConfig {
  return BUILDING_MODES.find(m => m.id === mode) ?? BUILDING_MODES[0];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const t = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${t(r)}${t(g)}${t(b)}`;
}

export function sampleScale(value: number, stops: Array<{ at: number; color: string }>): string {
  if (stops.length === 0) return '#64748b';
  if (value <= stops[0].at) return stops[0].color;
  if (value >= stops[stops.length - 1].at) return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (value >= a.at && value <= b.at) {
      const t = (value - a.at) / (b.at - a.at || 1);
      const [ar, ag, ab] = hexToRgb(a.color);
      const [br, bg, bb] = hexToRgb(b.color);
      return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
    }
  }
  return stops[stops.length - 1].color;
}

export function resolvePrimaryBuildingPoint(room: Room, mode: BuildingDisplayMode): string | undefined {
  if (mode === 'normal') return undefined;
  const bindings = room.bindings ?? [];
  const modeConfig = getModeConfig(mode);
  const byCategory = bindings.find(b => b.showInBuilding && b.category === modeConfig.category);
  if (byCategory) return byCategory.datapoint;
  const explicit = room.displayConfig?.primaryBuildingPoint;
  if (explicit) return explicit;
  const anyHighlighted = bindings.find(b => b.showInBuilding);
  return anyHighlighted?.datapoint;
}

export function computeRoomColor(
  room: Room,
  mode: BuildingDisplayMode,
  liveValues: Record<string, unknown>,
): { color: string; value: number | null; unit: string; hasData: boolean } {
  const cfg = getModeConfig(mode);
  if (mode === 'normal') {
    return { color: room.color, value: null, unit: '', hasData: true };
  }
  const dp = resolvePrimaryBuildingPoint(room, mode);
  if (!dp) return { color: '#1e293b', value: null, unit: cfg.colorScale.unit, hasData: false };

  const raw = liveValues[dp];
  let numeric: number | null = null;
  if (typeof raw === 'number') numeric = raw;
  else if (typeof raw === 'boolean') numeric = raw ? 1 : 0;
  else if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    numeric = isNaN(parsed) ? (raw === 'true' ? 1 : raw === 'false' ? 0 : null) : parsed;
  }
  if (numeric === null) return { color: '#1e293b', value: null, unit: cfg.colorScale.unit, hasData: false };
  return {
    color: sampleScale(numeric, cfg.colorScale.stops),
    value: numeric,
    unit: cfg.colorScale.unit,
    hasData: true,
  };
}
