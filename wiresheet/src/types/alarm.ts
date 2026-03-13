export type AlarmPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlarmState = 'active' | 'acknowledged' | 'cleared';

export interface AlarmClass {
  id: string;
  name: string;
  description?: string;
  priority: AlarmPriority;
  color: string;
  soundEnabled?: boolean;
  autoAcknowledge?: boolean;
  autoAcknowledgeDelayMs?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AlarmConsole {
  id: string;
  name: string;
  description?: string;
  alarmClassIds: string[];
  showHistory?: boolean;
  historyLimit?: number;
  sortBy?: 'time' | 'priority' | 'state';
  sortDirection?: 'asc' | 'desc';
  createdAt: number;
  updatedAt: number;
}

export interface AlarmSource {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  alarmClassId: string;
}

export interface BooleanAlarmConfig {
  enabled: boolean;
  alarmClassId?: string;
  alarmValue: boolean;
  alarmText?: string;
  normalText?: string;
}

export interface NumericAlarmConfig {
  enabled: boolean;
  alarmClassId?: string;
  highHighLimit?: number;
  highLimit?: number;
  lowLimit?: number;
  lowLowLimit?: number;
  highHighText?: string;
  highText?: string;
  lowText?: string;
  lowLowText?: string;
  deadband?: number;
}

export interface EnumAlarmConfig {
  enabled: boolean;
  alarmClassId?: string;
  alarmValues: (number | string)[];
  alarmTexts?: Record<string | number, string>;
}

export interface AggregateAlarmConfig {
  faultAlarmClassId?: string;
  maintenanceAlarmClassId?: string;
}

export interface ValveAlarmConfig {
  alarmClassId?: string;
}

export interface SensorAlarmConfig {
  alarmClassId?: string;
}

export interface ActiveAlarm {
  id: string;
  alarmClassId: string;
  sourceNodeId: string;
  sourceNodeName: string;
  sourceType: 'boolean' | 'numeric' | 'enum' | 'aggregate' | 'valve' | 'sensor';
  alarmText: string;
  state: AlarmState;
  triggeredAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  clearedAt?: number;
  value?: unknown;
  limitType?: 'highHigh' | 'high' | 'low' | 'lowLow' | 'boolean' | 'enum' | 'fault' | 'maintenance';
}

export interface AlarmHistoryEntry extends ActiveAlarm {
  archivedAt: number;
}

export interface AlarmConsoleWidgetConfig {
  consoleId?: string;
  showAcknowledgeButton?: boolean;
  showClearButton?: boolean;
  showTimestamp?: boolean;
  showSource?: boolean;
  compactMode?: boolean;
  maxVisibleAlarms?: number;
  fontSize?: number;
}
