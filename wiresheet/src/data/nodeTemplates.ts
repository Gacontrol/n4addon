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
    description: 'Logisches UND (A AND B)',
    defaultConfig: { inputCount: 2 }
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
    description: 'Logisches ODER (A OR B)',
    defaultConfig: { inputCount: 2 }
  },
  {
    type: 'xor-gate',
    label: 'XOR',
    icon: 'Split',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Exklusiv ODER (XOR)',
    defaultConfig: { inputCount: 2 }
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
    type: 'switch',
    label: 'Switch',
    icon: 'ToggleRight',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'Wert', type: 'input' },
      { label: 'Schalter', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Schaltet Wert durch wenn Schalter true'
  },
  {
    type: 'select',
    label: 'Select',
    icon: 'ArrowLeftRight',
    category: 'logic',
    color: '#10b981',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' },
      { label: 'Auswahl', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Waehlt A (0/false) oder B (1/true)'
  },
  {
    type: 'math-add',
    label: 'Addition',
    icon: 'Plus',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Summe', type: 'output' }
    ],
    description: 'A + B'
  },
  {
    type: 'math-sub',
    label: 'Subtraktion',
    icon: 'Minus',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Differenz', type: 'output' }
    ],
    description: 'A - B'
  },
  {
    type: 'math-mul',
    label: 'Multiplikation',
    icon: 'X',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Produkt', type: 'output' }
    ],
    description: 'A * B'
  },
  {
    type: 'math-div',
    label: 'Division',
    icon: 'Divide',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Quotient', type: 'output' }
    ],
    description: 'A / B'
  },
  {
    type: 'math-min',
    label: 'Minimum',
    icon: 'ChevronDown',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Min', type: 'output' }
    ],
    description: 'Kleinerer Wert'
  },
  {
    type: 'math-max',
    label: 'Maximum',
    icon: 'ChevronUp',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Max', type: 'output' }
    ],
    description: 'Groesserer Wert'
  },
  {
    type: 'math-avg',
    label: 'Durchschnitt',
    icon: 'TrendingUp',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'A', type: 'input' },
      { label: 'B', type: 'input' }
    ],
    outputs: [
      { label: 'Avg', type: 'output' }
    ],
    description: 'Durchschnittswert',
    defaultConfig: { inputCount: 2 }
  },
  {
    type: 'math-abs',
    label: 'Absolutwert',
    icon: 'Maximize2',
    category: 'math',
    color: '#f59e0b',
    inputs: [
      { label: 'Wert', type: 'input' }
    ],
    outputs: [
      { label: 'Abs', type: 'output' }
    ],
    description: '|Wert|'
  },
  {
    type: 'const-value',
    label: 'Konstante',
    icon: 'Hash',
    category: 'special',
    color: '#64748b',
    inputs: [],
    outputs: [
      { label: 'Wert', type: 'output' }
    ],
    description: 'Konstanter Wert',
    defaultConfig: { constValue: 0 }
  },
  {
    type: 'rising-edge',
    label: 'Steigende Flanke',
    icon: 'TrendingUp',
    category: 'special',
    color: '#64748b',
    inputs: [
      { label: 'Signal', type: 'input' }
    ],
    outputs: [
      { label: 'Trigger', type: 'output' }
    ],
    description: 'Erkennt 0->1 Wechsel'
  },
  {
    type: 'falling-edge',
    label: 'Fallende Flanke',
    icon: 'TrendingDown',
    category: 'special',
    color: '#64748b',
    inputs: [
      { label: 'Signal', type: 'input' }
    ],
    outputs: [
      { label: 'Trigger', type: 'output' }
    ],
    description: 'Erkennt 1->0 Wechsel'
  },
  {
    type: 'sr-flipflop',
    label: 'SR Flipflop',
    icon: 'FlipHorizontal',
    category: 'special',
    color: '#64748b',
    inputs: [
      { label: 'Set', type: 'input' },
      { label: 'Reset', type: 'input' }
    ],
    outputs: [
      { label: 'Q', type: 'output' }
    ],
    description: 'Set-Reset Speicher'
  },
  {
    type: 'counter',
    label: 'Zaehler',
    icon: 'ListOrdered',
    category: 'special',
    color: '#64748b',
    inputs: [
      { label: 'Impuls', type: 'input' },
      { label: 'Reset', type: 'input' }
    ],
    outputs: [
      { label: 'Wert', type: 'output' }
    ],
    description: 'Zaehlt Impulse',
    defaultConfig: { counterMax: 100, counterMin: 0 }
  },
  {
    type: 'timer',
    label: 'Timer',
    icon: 'Timer',
    category: 'special',
    color: '#64748b',
    inputs: [
      { label: 'Start', type: 'input' },
      { label: 'Reset', type: 'input' }
    ],
    outputs: [
      { label: 'Aktiv', type: 'output' },
      { label: 'Fertig', type: 'output' }
    ],
    description: 'Einschaltverzoegerung',
    defaultConfig: { timerMs: 1000 }
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
  },
  {
    type: 'pid-controller',
    label: 'PID Regler',
    icon: 'Gauge',
    category: 'math',
    color: '#ef4444',
    inputs: [
      { label: 'Istwert', type: 'input' },
      { label: 'Sollwert', type: 'input' }
    ],
    outputs: [
      { label: 'Stellgröße', type: 'output' },
      { label: 'Regelabweichung', type: 'output' }
    ],
    description: 'PID-Regler mit einstellbaren Parametern',
    defaultConfig: {
      kp: 1.0,
      ki: 0.1,
      kd: 0.05,
      outputMin: 0,
      outputMax: 100,
      antiWindup: true,
      sampleTimeMs: 100
    }
  },
  {
    type: 'scaling',
    label: 'Schiebung',
    icon: 'MoveHorizontal',
    category: 'math',
    color: '#8b5cf6',
    inputs: [
      { label: 'Eingang', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Skaliert/schiebt Wert zwischen Bereichen',
    defaultConfig: {
      inputMin: 0,
      inputMax: 100,
      outputMin: 0,
      outputMax: 100,
      inverted: false,
      clamp: true
    }
  }
];
