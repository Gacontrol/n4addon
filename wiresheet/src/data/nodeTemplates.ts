import { NodeTemplate } from '../types/flow';

export const nodeTemplates: NodeTemplate[] = [
  {
    type: 'ha-input',
    label: 'HA Eingang',
    icon: 'ArrowRightToLine',
    category: 'input',
    color: '#3b82f6',
    inputs: [],
    outputs: [
      { label: 'Wert', type: 'output' }
    ],
    description: 'Liest einen HA Entity-Wert'
  },
  {
    type: 'ha-output',
    label: 'HA Ausgang',
    icon: 'ArrowRightFromLine',
    category: 'output',
    color: '#f59e0b',
    inputs: [
      { label: 'Wert', type: 'input' }
    ],
    outputs: [],
    description: 'Schreibt einen HA Entity-Wert'
  },
  {
    type: 'and-gate',
    label: 'UND',
    icon: 'GitMerge',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Logisches UND (A AND B)'
  },
  {
    type: 'or-gate',
    label: 'ODER',
    icon: 'GitBranch',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Logisches ODER (A OR B)'
  },
  {
    type: 'not-gate',
    label: 'NICHT',
    icon: 'Ban',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'Eingang', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Logisches NICHT (NOT)'
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
      { label: 'A > B', type: 'output' },
      { label: 'A = B', type: 'output' },
      { label: 'A < B', type: 'output' }
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
    type: 'threshold',
    label: 'Schwellwert',
    icon: 'TrendingUp',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'Wert', type: 'input' }
    ],
    outputs: [
      { label: 'Über', type: 'output' },
      { label: 'Unter', type: 'output' }
    ],
    description: 'Prüft gegen Schwellwert'
  },
  {
    type: 'time-trigger',
    label: 'Zeit Trigger',
    icon: 'CalendarClock',
    category: 'trigger',
    color: '#0ea5e9',
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
    color: '#0ea5e9',
    inputs: [
      { label: 'Status', type: 'input' }
    ],
    outputs: [
      { label: 'Geändert', type: 'output' }
    ],
    description: 'Triggert bei Statusänderung'
  }
];
