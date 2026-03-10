import { NodeTemplate } from '../types/flow';

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'temperature-sensor',
    label: 'Temperatur Sensor',
    icon: 'Thermometer',
    category: 'sensor',
    color: '#3b82f6',
    inputs: [],
    outputs: [
      { label: 'Wert', type: 'output' },
      { label: 'Status', type: 'output' }
    ],
    description: 'Liest Temperaturwerte aus'
  },
  {
    type: 'motion-sensor',
    label: 'Bewegungsmelder',
    icon: 'Activity',
    category: 'sensor',
    color: '#3b82f6',
    inputs: [],
    outputs: [
      { label: 'Bewegung', type: 'output' }
    ],
    description: 'Erkennt Bewegungen'
  },
  {
    type: 'light-switch',
    label: 'Licht Schalter',
    icon: 'Lightbulb',
    category: 'actuator',
    color: '#f59e0b',
    inputs: [
      { label: 'Ein/Aus', type: 'input' },
      { label: 'Helligkeit', type: 'input' }
    ],
    outputs: [
      { label: 'Status', type: 'output' }
    ],
    description: 'Steuert Lichtquellen'
  },
  {
    type: 'switch',
    label: 'Schalter',
    icon: 'ToggleLeft',
    category: 'actuator',
    color: '#f59e0b',
    inputs: [
      { label: 'Signal', type: 'input' }
    ],
    outputs: [
      { label: 'Status', type: 'output' }
    ],
    description: 'Generischer Schalter'
  },
  {
    type: 'and-gate',
    label: 'UND Gatter',
    icon: 'GitMerge',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'Eingang A', type: 'input' },
      { label: 'Eingang B', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Logisches UND'
  },
  {
    type: 'or-gate',
    label: 'ODER Gatter',
    icon: 'GitBranch',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'Eingang A', type: 'input' },
      { label: 'Eingang B', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Logisches ODER'
  },
  {
    type: 'compare',
    label: 'Vergleich',
    icon: 'Equal',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'Wert A', type: 'input' },
      { label: 'Wert B', type: 'input' }
    ],
    outputs: [
      { label: 'Größer', type: 'output' },
      { label: 'Gleich', type: 'output' },
      { label: 'Kleiner', type: 'output' }
    ],
    description: 'Vergleicht zwei Werte'
  },
  {
    type: 'delay',
    label: 'Verzögerung',
    icon: 'Clock',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'Signal', type: 'input' }
    ],
    outputs: [
      { label: 'Verzögert', type: 'output' }
    ],
    description: 'Verzögert ein Signal'
  },
  {
    type: 'time-trigger',
    label: 'Zeit Trigger',
    icon: 'CalendarClock',
    category: 'trigger',
    color: '#8b5cf6',
    inputs: [],
    outputs: [
      { label: 'Trigger', type: 'output' }
    ],
    description: 'Zeitbasierter Auslöser'
  },
  {
    type: 'state-trigger',
    label: 'Status Trigger',
    icon: 'Zap',
    category: 'trigger',
    color: '#8b5cf6',
    inputs: [
      { label: 'Status', type: 'input' }
    ],
    outputs: [
      { label: 'Geändert', type: 'output' }
    ],
    description: 'Triggert bei Statusänderung'
  }
];
