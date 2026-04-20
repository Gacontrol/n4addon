export type DatapointCategory =
  | 'temperature'
  | 'humidity'
  | 'co2'
  | 'airflow'
  | 'pressure'
  | 'occupancy'
  | 'alarm'
  | 'energy'
  | 'setpoint'
  | 'mode'
  | 'generic';

export type DatapointDisplayKind = 'tile' | 'badge' | 'trend' | 'icon' | 'traffic' | 'value';

export interface RoomDatapointDisplay {
  datapoint: string;
  label: string;
  category: DatapointCategory;
  unit: string;
  displayKind: DatapointDisplayKind;
  icon?: string;
  lowThreshold?: number;
  highThreshold?: number;
  invert?: boolean;
}

export interface RoomDisplayConfig {
  buildingId: string;
  floorId: string;
  roomId: string;
  primaryDatapoint: string;
  primaryLabel: string;
  primaryUnit: string;
  visibleDatapoints: RoomDatapointDisplay[];
  description: string;
  metadata: Record<string, unknown>;
}

export type BuildingDisplayMode =
  | 'none'
  | 'temperature'
  | 'co2'
  | 'humidity'
  | 'alarm'
  | 'presence'
  | 'mode'
  | 'custom';

export interface BuildingDisplayState {
  buildingId: string;
  mode: BuildingDisplayMode;
  modeConfig: Record<string, unknown>;
}

export interface BuildingModeDefinition {
  id: BuildingDisplayMode;
  label: string;
  description: string;
  colorRamp: string[];
  unit?: string;
  valueRange?: [number, number];
  categories: DatapointCategory[];
}

export const BUILDING_MODES: BuildingModeDefinition[] = [
  {
    id: 'none',
    label: 'Neutral',
    description: 'Standardfarbe der Räume',
    colorRamp: ['#475569'],
    categories: [],
  },
  {
    id: 'temperature',
    label: 'Temperatur',
    description: 'Räume nach Raumtemperatur einfärben',
    colorRamp: ['#1e3a8a', '#2563eb', '#22c55e', '#f59e0b', '#dc2626'],
    unit: '°C',
    valueRange: [16, 28],
    categories: ['temperature'],
  },
  {
    id: 'co2',
    label: 'CO₂',
    description: 'Räume nach CO₂-Belastung einfärben',
    colorRamp: ['#22c55e', '#84cc16', '#f59e0b', '#ef4444', '#7f1d1d'],
    unit: 'ppm',
    valueRange: [400, 2000],
    categories: ['co2'],
  },
  {
    id: 'humidity',
    label: 'Feuchte',
    description: 'Räume nach Luftfeuchte einfärben',
    colorRamp: ['#f59e0b', '#22c55e', '#22c55e', '#2563eb', '#1e3a8a'],
    unit: '%rF',
    valueRange: [20, 80],
    categories: ['humidity'],
  },
  {
    id: 'alarm',
    label: 'Alarm',
    description: 'Räume mit aktivem Alarm hervorheben',
    colorRamp: ['#334155', '#dc2626'],
    categories: ['alarm'],
  },
  {
    id: 'presence',
    label: 'Präsenz',
    description: 'Belegte Räume hervorheben',
    colorRamp: ['#334155', '#22c55e'],
    categories: ['occupancy'],
  },
  {
    id: 'mode',
    label: 'Betriebsart',
    description: 'Räume nach aktivem Betriebsmodus einfärben',
    colorRamp: ['#64748b', '#22c55e', '#f59e0b', '#ef4444'],
    categories: ['mode'],
  },
  {
    id: 'custom',
    label: 'Individuell',
    description: 'Individueller Hauptdatenpunkt pro Raum',
    colorRamp: ['#475569'],
    categories: ['generic'],
  },
];

export const CATEGORY_LABELS: Record<DatapointCategory, string> = {
  temperature: 'Temperatur',
  humidity: 'Feuchte',
  co2: 'CO₂',
  airflow: 'Volumenstrom',
  pressure: 'Druck',
  occupancy: 'Präsenz',
  alarm: 'Alarm',
  energy: 'Energie',
  setpoint: 'Sollwert',
  mode: 'Modus',
  generic: 'Allgemein',
};
