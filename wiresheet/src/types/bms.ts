export type DataPointCategory =
  | 'temperature'
  | 'humidity'
  | 'co2'
  | 'airflow'
  | 'pressure'
  | 'occupancy'
  | 'alarm'
  | 'mode'
  | 'setpoint'
  | 'energy'
  | 'valvePosition'
  | 'fanSpeed'
  | 'vavFlow'
  | 'windowState'
  | 'comfortIndex'
  | 'generic';

export type DataPointDisplayType =
  | 'kpi'
  | 'badge'
  | 'trend'
  | 'statusIcon'
  | 'trafficLight'
  | 'row'
  | 'miniChart';

export type DataPointStatus = 'ok' | 'warning' | 'alarm' | 'offline' | 'unknown';

export type DataPointTrend = 'up' | 'down' | 'stable';

export interface DataPoint {
  id: string;
  name: string;
  label: string;
  category: DataPointCategory;
  unit: string;
  currentValue: number | string | boolean | null;
  formattedValue: string;
  status: DataPointStatus;
  trend?: DataPointTrend;
  icon?: string;
  source?: string;
  writable: boolean;
  severity?: 'info' | 'warning' | 'critical';
  lastUpdate?: number;
  quality?: 'good' | 'bad' | 'uncertain';
  min?: number;
  max?: number;
  targetValue?: number;
  historicValues?: { ts: number; value: number }[];
}

export type WidgetType =
  | 'kpi'
  | 'row'
  | 'slider'
  | 'incrementer'
  | 'gauge'
  | 'badge'
  | 'switch'
  | 'chart'
  | 'label';

export interface RoomDataPointConfig {
  datapointId: string;
  label: string;
  displayType: DataPointDisplayType;
  widgetType: WidgetType;
  order: number;
  panelCol?: number;
  panelRow?: number;
  panelW?: number;
  panelH?: number;
  showInMonitor: boolean;
  showInService: boolean;
  showInTooltip: boolean;
  showInBuilding: boolean;
  isPrimaryRoomKPI: boolean;
  isPrimaryBuildingPoint: boolean;
  writable: boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  category?: string;
  sourceDatapoint?: string;
}

export interface RoomMonitorConfig {
  roomId: string;
  datapoints: RoomDataPointConfig[];
  accentColor?: string;
  layout?: 'grid' | 'list';
  panelTitle?: string;
  panelSubtitle?: string;
  hiddenTabs?: ('overview' | 'points' | 'alarms' | 'trends')[];
}

export type BuildingLayerMode =
  | 'normal'
  | 'temperature'
  | 'co2'
  | 'humidity'
  | 'alarm'
  | 'occupancy'
  | 'airflow'
  | 'energy'
  | 'pressure'
  | 'comfort';

export interface LayerModeConfig {
  id: BuildingLayerMode;
  label: string;
  unit: string;
  colorScale: {
    stops: { at: number; color: string }[];
    min: number;
    max: number;
  };
  category: DataPointCategory;
  description: string;
}

export const LAYER_MODES: LayerModeConfig[] = [
  {
    id: 'normal',
    label: 'Normal',
    unit: '',
    colorScale: { stops: [], min: 0, max: 1 },
    category: 'generic',
    description: 'Standardansicht',
  },
  {
    id: 'temperature',
    label: 'Temperatur',
    unit: '°C',
    colorScale: {
      stops: [
        { at: 0, color: '#2563eb' },
        { at: 0.3, color: '#22c55e' },
        { at: 0.6, color: '#f59e0b' },
        { at: 1, color: '#ef4444' },
      ],
      min: 15,
      max: 30,
    },
    category: 'temperature',
    description: 'Raumtemperatur',
  },
  {
    id: 'co2',
    label: 'CO₂',
    unit: 'ppm',
    colorScale: {
      stops: [
        { at: 0, color: '#22c55e' },
        { at: 0.5, color: '#f59e0b' },
        { at: 1, color: '#ef4444' },
      ],
      min: 400,
      max: 1500,
    },
    category: 'co2',
    description: 'CO₂-Konzentration',
  },
  {
    id: 'humidity',
    label: 'Feuchte',
    unit: '%',
    colorScale: {
      stops: [
        { at: 0, color: '#ef4444' },
        { at: 0.3, color: '#22c55e' },
        { at: 0.7, color: '#22c55e' },
        { at: 1, color: '#2563eb' },
      ],
      min: 20,
      max: 80,
    },
    category: 'humidity',
    description: 'Relative Luftfeuchtigkeit',
  },
  {
    id: 'alarm',
    label: 'Alarm',
    unit: '',
    colorScale: {
      stops: [
        { at: 0, color: '#22c55e' },
        { at: 1, color: '#ef4444' },
      ],
      min: 0,
      max: 1,
    },
    category: 'alarm',
    description: 'Alarmstatus',
  },
  {
    id: 'occupancy',
    label: 'Belegung',
    unit: '',
    colorScale: {
      stops: [
        { at: 0, color: '#475569' },
        { at: 1, color: '#0ea5e9' },
      ],
      min: 0,
      max: 1,
    },
    category: 'occupancy',
    description: 'Raumbelegung',
  },
  {
    id: 'energy',
    label: 'Energie',
    unit: 'W',
    colorScale: {
      stops: [
        { at: 0, color: '#22c55e' },
        { at: 0.5, color: '#f59e0b' },
        { at: 1, color: '#ef4444' },
      ],
      min: 0,
      max: 2000,
    },
    category: 'energy',
    description: 'Energieverbrauch',
  },
  {
    id: 'airflow',
    label: 'Luftmenge',
    unit: 'm³/h',
    colorScale: {
      stops: [
        { at: 0, color: '#475569' },
        { at: 0.5, color: '#0ea5e9' },
        { at: 1, color: '#2563eb' },
      ],
      min: 0,
      max: 500,
    },
    category: 'airflow',
    description: 'Zuluftvolumenstrom',
  },
];

export interface RoomLiveValue {
  roomId: string;
  category: DataPointCategory;
  value: number | null;
  status: DataPointStatus;
  formattedValue: string;
}

export interface BuildingMonitorState {
  activeLayer: BuildingLayerMode;
  hoveredRoomId: string | null;
  selectedRoomId: string | null;
  selectedFloorId: string | null;
  roomValues: RoomLiveValue[];
}

export interface ActiveAlarm {
  id: string;
  roomId?: string;
  buildingId?: string;
  floorId?: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  acknowledged: boolean;
  source: string;
}

export type AppMode = 'editor' | 'monitor' | 'service';
