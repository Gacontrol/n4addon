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
    type: 'dp-boolean',
    label: 'Boolean Datenpunkt',
    icon: 'ToggleLeft',
    category: 'datapoint',
    color: '#8b5cf6',
    inputs: [
      { label: 'Eingang', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Virtueller Boolean-Datenpunkt',
    dpType: 'boolean',
    defaultConfig: { dpFacet: '' }
  },
  {
    type: 'dp-numeric',
    label: 'Numerischer Datenpunkt',
    icon: 'Hash',
    category: 'datapoint',
    color: '#06b6d4',
    inputs: [
      { label: 'Eingang', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Virtueller Numerischer Datenpunkt',
    dpType: 'numeric',
    defaultConfig: { dpUnit: '' }
  },
  {
    type: 'dp-enum',
    label: 'Enum Datenpunkt',
    icon: 'List',
    category: 'datapoint',
    color: '#f97316',
    inputs: [
      { label: 'Eingang', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Virtueller Enum-Datenpunkt (Stufen)',
    dpType: 'enum',
    defaultConfig: {
      dpEnumStages: [
        { value: 0, label: 'Aus' },
        { value: 1, label: 'Ein' }
      ]
    }
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
    description: 'Vergleicht zwei Werte',
    defaultConfig: { compareOperator: '>', compareValue: 0 }
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
    description: 'Verzögert ein Signal',
    defaultConfig: { delayMs: 1000 }
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
    description: 'Prüft gegen Schwellwert',
    defaultConfig: { thresholdValue: 0 }
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
  },
  {
    type: 'python-script',
    label: 'Python Script',
    icon: 'Code',
    category: 'logic',
    color: '#3776ab',
    inputs: [
      { label: 'In1', type: 'input' }
    ],
    outputs: [
      { label: 'Out1', type: 'output' }
    ],
    description: 'Fuehrt Python-Code aus',
    defaultConfig: {
      pythonCode: '# Eingaenge: in1, in2, ...\n# Ausgaenge: out1, out2, ...\n\nout1 = in1',
      pythonInputs: [{ id: 'in1', label: 'In1' }],
      pythonOutputs: [{ id: 'out1', label: 'Out1' }]
    }
  },
  {
    type: 'case-container',
    label: 'Case Container',
    icon: 'Layers',
    category: 'logic',
    color: '#6366f1',
    inputs: [
      { label: 'Case', type: 'input' }
    ],
    outputs: [],
    description: 'Container fuer Case-basierte Ausfuehrung',
    defaultConfig: {
      cases: [
        { id: 'case-0', label: 'Case 0', nodeIds: [] },
        { id: 'case-1', label: 'Case 1', nodeIds: [] }
      ],
      activeCase: 0,
      containerWidth: 400,
      containerHeight: 300
    }
  }
];
