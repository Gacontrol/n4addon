import { WidgetTemplate } from '../types/visualization';

export const widgetTemplates: WidgetTemplate[] = [
  {
    type: 'visu-switch',
    label: 'Schalter',
    icon: 'ToggleLeft',
    category: 'control',
    defaultSize: { width: 120, height: 60 },
    defaultConfig: {
      onLabel: 'Ein',
      offLabel: 'Aus',
      onColor: '#22c55e',
      offColor: '#64748b'
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top'
    },
    description: 'Ein/Aus Schalter zum Steuern von Boolean-Werten',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-button',
    label: 'Taster',
    icon: 'Square',
    category: 'control',
    defaultSize: { width: 100, height: 50 },
    defaultConfig: {
      label: 'Taster',
      pressValue: true,
      releaseValue: false,
      holdMode: false,
      color: '#3b82f6'
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top'
    },
    description: 'Taster fuer Impulssignale',
    supportsBinding: true,
    bindingDirection: 'write'
  },
  {
    type: 'visu-multistate',
    label: 'Mehrfachschalter',
    icon: 'List',
    category: 'control',
    defaultSize: { width: 160, height: 50 },
    defaultConfig: {
      options: [
        { value: 0, label: 'Aus', color: '#64748b' },
        { value: 1, label: 'Ein', color: '#22c55e' },
        { value: 2, label: 'Auto', color: '#3b82f6' }
      ],
      defaultValue: 0
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top',
      backgroundColor: '#1e293b',
      borderColor: '#374151',
      textColor: '#e2e8f0',
      accentColor: '#3b82f6'
    },
    description: 'Dropdown fuer mehrere Zustaende',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-slider',
    label: 'Schieberegler',
    icon: 'SlidersHorizontal',
    category: 'control',
    defaultSize: { width: 200, height: 60 },
    defaultConfig: {
      min: 0,
      max: 100,
      step: 1,
      showValue: true,
      unit: '',
      orientation: 'horizontal'
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top',
      accentColor: '#3b82f6'
    },
    description: 'Schieberegler fuer numerische Sollwerte',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-incrementer',
    label: 'Inkrementer',
    icon: 'PlusMinusIcon',
    category: 'control',
    defaultSize: { width: 160, height: 60 },
    defaultConfig: {
      min: 0,
      max: 100,
      step: 1,
      unit: ''
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top'
    },
    description: 'Plus/Minus Tasten fuer Sollwert-Anpassung',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-input',
    label: 'Eingabefeld',
    icon: 'TextCursorInput',
    category: 'control',
    defaultSize: { width: 150, height: 60 },
    defaultConfig: {
      inputType: 'number',
      min: 0,
      max: 1000,
      placeholder: 'Wert...',
      unit: ''
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top'
    },
    description: 'Direktes Eingabefeld fuer Sollwerte',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-gauge',
    label: 'Messanzeige',
    icon: 'Gauge',
    category: 'display',
    defaultSize: { width: 150, height: 150 },
    defaultConfig: {
      min: 0,
      max: 100,
      unit: '%',
      showValue: true,
      gaugeType: 'semicircle',
      thresholds: [
        { value: 30, color: '#22c55e' },
        { value: 70, color: '#eab308' },
        { value: 100, color: '#ef4444' }
      ]
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'bottom'
    },
    description: 'Rundinstrument zur Anzeige von Messwerten',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-display',
    label: 'Wertanzeige',
    icon: 'MonitorDot',
    category: 'display',
    defaultSize: { width: 120, height: 60 },
    defaultConfig: {
      format: '',
      unit: '',
      decimals: 1,
      fontSize: 24
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top',
      backgroundColor: '#1e293b',
      textColor: '#22c55e'
    },
    description: 'Digitale Wertanzeige',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-led',
    label: 'LED Anzeige',
    icon: 'Lightbulb',
    category: 'indicator',
    defaultSize: { width: 60, height: 60 },
    defaultConfig: {
      onColor: '#22c55e',
      offColor: '#374151',
      shape: 'circle',
      blinkOnChange: false
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'bottom'
    },
    description: 'LED-Anzeige fuer Zustaende',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-bar',
    label: 'Balkenanzeige',
    icon: 'BarChart3',
    category: 'display',
    defaultSize: { width: 200, height: 40 },
    defaultConfig: {
      min: 0,
      max: 100,
      orientation: 'horizontal',
      showValue: true,
      unit: '%',
      color: '#3b82f6',
      backgroundColor: '#1e293b'
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'top'
    },
    description: 'Horizontale oder vertikale Balkenanzeige',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-label',
    label: 'Beschriftung',
    icon: 'Type',
    category: 'decoration',
    defaultSize: { width: 150, height: 40 },
    defaultConfig: {
      text: 'Beschriftung',
      fontSize: 16,
      fontWeight: 'normal',
      textAlign: 'left'
    },
    defaultStyle: {
      textColor: '#e2e8f0'
    },
    description: 'Statischer Text zur Beschriftung',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-tank',
    label: 'Tankfuellstand',
    icon: 'Container',
    category: 'display',
    defaultSize: { width: 80, height: 150 },
    defaultConfig: {
      min: 0,
      max: 100,
      unit: '%',
      showValue: true,
      fillColor: '#3b82f6',
      levels: [
        { value: 20, color: '#ef4444', label: 'Leer' },
        { value: 80, color: '#3b82f6', label: 'Normal' },
        { value: 100, color: '#22c55e', label: 'Voll' }
      ]
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'bottom'
    },
    description: 'Tankfuellstandsanzeige',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-thermometer',
    label: 'Thermometer',
    icon: 'Thermometer',
    category: 'display',
    defaultSize: { width: 60, height: 150 },
    defaultConfig: {
      min: -20,
      max: 50,
      unit: '°C',
      showValue: true,
      coldColor: '#3b82f6',
      hotColor: '#ef4444'
    },
    defaultStyle: {
      showLabel: true,
      labelPosition: 'bottom'
    },
    description: 'Temperaturanzeige',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-rect',
    label: 'Rechteck',
    icon: 'RectangleHorizontal',
    category: 'decoration',
    defaultSize: { width: 150, height: 100 },
    defaultConfig: {
      fillColor: '#1e293b',
      strokeColor: '#475569',
      strokeWidth: 2,
      opacity: 1
    },
    defaultStyle: {},
    description: 'Rechteck zum Gruppieren',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-circle',
    label: 'Kreis',
    icon: 'Circle',
    category: 'decoration',
    defaultSize: { width: 100, height: 100 },
    defaultConfig: {
      fillColor: '#1e293b',
      strokeColor: '#475569',
      strokeWidth: 2,
      opacity: 1
    },
    defaultStyle: {},
    description: 'Kreis / Ellipse',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-line',
    label: 'Linie',
    icon: 'Minus',
    category: 'decoration',
    defaultSize: { width: 150, height: 4 },
    defaultConfig: {
      strokeColor: '#64748b',
      strokeWidth: 2,
      opacity: 1
    },
    defaultStyle: {},
    description: 'Linie zur Trennung',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-arrow',
    label: 'Pfeil',
    icon: 'ArrowRight',
    category: 'decoration',
    defaultSize: { width: 150, height: 30 },
    defaultConfig: {
      strokeColor: '#64748b',
      strokeWidth: 2,
      arrowEnd: true,
      arrowStart: false,
      opacity: 1
    },
    defaultStyle: {},
    description: 'Pfeil zur Richtungsanzeige',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-nav-button',
    label: 'Seiten-Taster',
    icon: 'Navigation',
    category: 'decoration',
    defaultSize: { width: 120, height: 50 },
    defaultConfig: {
      label: 'Seite 2',
      targetPageId: '',
      color: '#3b82f6'
    },
    defaultStyle: {
      showLabel: false
    },
    description: 'Springt zu einer anderen Visu-Seite',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-home-button',
    label: 'Home-Taster',
    icon: 'Home',
    category: 'decoration',
    defaultSize: { width: 80, height: 50 },
    defaultConfig: {
      label: 'Home',
      color: '#10b981'
    },
    defaultStyle: {
      showLabel: false
    },
    description: 'Springt zur ersten Seite',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-back-button',
    label: 'Zurueck-Taster',
    icon: 'ChevronLeft',
    category: 'decoration',
    defaultSize: { width: 80, height: 50 },
    defaultConfig: {
      label: 'Zurueck',
      color: '#64748b'
    },
    defaultStyle: {
      showLabel: false
    },
    description: 'Springt zur vorherigen Seite',
    supportsBinding: false,
    bindingDirection: 'read'
  }
];

export const getWidgetTemplate = (type: string): WidgetTemplate | undefined => {
  return widgetTemplates.find(t => t.type === type);
};

export const getWidgetsByCategory = (category: WidgetTemplate['category']): WidgetTemplate[] => {
  return widgetTemplates.filter(t => t.category === category);
};
