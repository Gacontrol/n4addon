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
      { label: 'Schalter', type: 'input' },
      { label: 'WertTrue', type: 'input' },
      { label: 'WertFalse', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Schalter=1: WertTrue (Std:true), Schalter=0: WertFalse (Std:false)'
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
    type: 'oneshot',
    label: 'OneShot',
    icon: 'Zap',
    category: 'special',
    color: '#64748b',
    inputs: [
      { label: 'Trigger', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Gibt Wert fuer einstellbare Zeit aus',
    defaultConfig: {
      oneshotDurationMs: 1000,
      oneshotActiveValue: true,
      oneshotInactiveValue: null,
      oneshotInactiveIsNull: true
    }
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
      { label: 'Eingang', type: 'input' }
    ],
    outputs: [
      { label: 'Ausgang', type: 'output' }
    ],
    description: 'Einschalt- und Ausschaltverzögerung',
    defaultConfig: { timerOnMs: 1000, timerOffMs: 0, timerMode: 'on' }
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
      { label: 'Ausgang', type: 'output' }
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
      { label: 'Sollwert', type: 'input' },
      { label: 'Enable', type: 'input' }
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
  },
  {
    type: 'smoothing',
    label: 'Glaettung',
    icon: 'Waves',
    category: 'math',
    color: '#0ea5e9',
    inputs: [
      { label: 'Eingang', type: 'input' }
    ],
    outputs: [
      { label: 'Geglaettet', type: 'output' },
      { label: 'Min', type: 'output' },
      { label: 'Max', type: 'output' }
    ],
    description: 'Glaettet Werte ueber eine einstellbare Zeitspanne',
    defaultConfig: {
      smoothingMethod: 'average',
      smoothingDuration: 86400000,
      smoothingUnit: 'hours',
      smoothingValue: 24
    }
  },
  {
    type: 'aggregate-control',
    label: 'Aggregatebaustein',
    icon: 'Fan',
    category: 'special',
    color: '#0891b2',
    inputs: [
      { label: 'StartCmd', type: 'input' },
      { label: 'Feedback', type: 'input' },
      { label: 'Fault', type: 'input' },
      { label: 'Revision', type: 'input' },
      { label: 'HandStart', type: 'input' },
      { label: 'SpeedSP', type: 'input' },
      { label: 'Reset', type: 'input' }
    ],
    outputs: [
      { label: 'Cmd', type: 'output' },
      { label: 'SpeedOut', type: 'output' },
      { label: 'Running', type: 'output' },
      { label: 'Fault', type: 'output' },
      { label: 'Ready', type: 'output' },
      { label: 'Alarm', type: 'output' },
      { label: 'OpHours', type: 'output' },
      { label: 'Starts', type: 'output' }
    ],
    description: 'Aggregatesteuerung mit HOA, Blockierschutz, Betriebsstunden',
    defaultConfig: {
      aggregateStartDelayMs: 0,
      aggregateStopDelayMs: 0,
      aggregateFeedbackTimeoutMs: 10000,
      aggregateEnableFeedback: true,
      aggregateSpeedMin: 0,
      aggregateSpeedMax: 100,
      aggregateAntiSeizeIntervalMs: 604800000,
      aggregateAntiSeizeRunMs: 60000,
      aggregateAntiSeizeSpeed: 30,
      aggregateOperatingHours: 0,
      aggregateStartCount: 0,
      aggregateName: ''
    }
  },
  {
    type: 'valve-control',
    label: 'Ventilbaustein',
    icon: 'Pipette',
    category: 'special',
    color: '#7c3aed',
    inputs: [
      { label: 'Setpoint', type: 'input' },
      { label: 'Feedback', type: 'input' },
      { label: 'Reset', type: 'input' }
    ],
    outputs: [
      { label: 'ValveOut', type: 'output' },
      { label: 'Alarm', type: 'output' }
    ],
    description: 'Ventilsteuerung mit Begrenzung und Ueberwachung',
    defaultConfig: {
      valveMinOutput: 0,
      valveMaxOutput: 100,
      valveMonitoringEnable: true,
      valveTolerance: 5,
      valveAlarmDelayMs: 10000,
      valveName: ''
    }
  },
  {
    type: 'sensor-control',
    label: 'Sensorbaustein',
    icon: 'Thermometer',
    category: 'special',
    color: '#0891b2',
    inputs: [
      { label: 'SensorIn', type: 'input' },
      { label: 'AlarmReset', type: 'input' }
    ],
    outputs: [
      { label: 'SensorOut', type: 'output' },
      { label: 'Alarm', type: 'output' }
    ],
    description: 'Sensorbaustein mit Grenzwertueberwachung',
    defaultConfig: {
      sensorMinLimit: 0,
      sensorMaxLimit: 100,
      sensorUnit: '',
      sensorMonitoringEnable: true,
      sensorAlarmDelayMs: 5000,
      sensorName: '',
      sensorRangeMin: -50,
      sensorRangeMax: 150
    }
  },
  {
    type: 'pid-controller',
    label: 'PID Regler',
    icon: 'Activity',
    category: 'special',
    color: '#dc2626',
    inputs: [
      { label: 'Setpoint', type: 'input' },
      { label: 'ActualValue', type: 'input' },
      { label: 'Enable', type: 'input' }
    ],
    outputs: [
      { label: 'ControlOutput', type: 'output' }
    ],
    description: 'PID Regler mit P, I, D Anteilen',
    defaultConfig: {
      pidKp: 1.0,
      pidKi: 0.1,
      pidKd: 0.0,
      pidWindupLimit: 100,
      pidMinOutput: 0,
      pidMaxOutput: 100,
      pidReverseAction: false,
      pidName: ''
    }
  },
  {
    type: 'heating-curve',
    label: 'Heizkurve',
    icon: 'TrendingUp',
    category: 'special',
    color: '#ea580c',
    inputs: [
      { label: 'InputValue', type: 'input' },
      { label: 'Enable', type: 'input' }
    ],
    outputs: [
      { label: 'OutputValue', type: 'output' }
    ],
    description: 'Heizkurvenbaustein mit linearer Kennlinie',
    defaultConfig: {
      hcMinInput: -20,
      hcMaxInput: 20,
      hcMinOutput: 20,
      hcMaxOutput: 80,
      hcReverseDirection: true,
      hcName: ''
    }
  }
];
