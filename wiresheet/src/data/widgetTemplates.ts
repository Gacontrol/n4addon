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
      impulseMode: true,
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
    description: 'Rechteck - mit Verknuepfung fuer Farbwechsel',
    supportsBinding: true,
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
    description: 'Kreis / Ellipse - mit Verknuepfung fuer Farbwechsel',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-line',
    label: 'Linie',
    icon: 'Minus',
    category: 'decoration',
    defaultSize: { width: 150, height: 40 },
    defaultConfig: {
      strokeColor: '#64748b',
      strokeWidth: 2,
      opacity: 1,
      angle: 0
    },
    defaultStyle: {},
    description: 'Linie - frei drehbar, mit Verknuepfung',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-arrow',
    label: 'Pfeil',
    icon: 'ArrowRight',
    category: 'decoration',
    defaultSize: { width: 150, height: 40 },
    defaultConfig: {
      strokeColor: '#64748b',
      strokeWidth: 2,
      arrowEnd: true,
      arrowStart: false,
      opacity: 1,
      angle: 0
    },
    defaultStyle: {},
    description: 'Pfeil - frei drehbar, mit Verknuepfung',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-polygon',
    label: 'Polygon',
    icon: 'Hexagon',
    category: 'decoration',
    defaultSize: { width: 100, height: 100 },
    defaultConfig: {
      fillColor: '#1e293b',
      strokeColor: '#475569',
      strokeWidth: 2,
      opacity: 1,
      sides: 6
    },
    defaultStyle: {},
    description: 'Vieleck (3-12 Ecken) - mit Verknuepfung',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-star',
    label: 'Stern',
    icon: 'Star',
    category: 'decoration',
    defaultSize: { width: 100, height: 100 },
    defaultConfig: {
      fillColor: '#eab308',
      strokeColor: '#ca8a04',
      strokeWidth: 1,
      opacity: 1,
      points: 5,
      innerRadiusRatio: 0.4
    },
    defaultStyle: {},
    description: 'Stern - mit Verknuepfung fuer Farbwechsel',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-diamond',
    label: 'Raute',
    icon: 'Diamond',
    category: 'decoration',
    defaultSize: { width: 100, height: 100 },
    defaultConfig: {
      fillColor: '#1e293b',
      strokeColor: '#475569',
      strokeWidth: 2,
      opacity: 1
    },
    defaultStyle: {},
    description: 'Raute - mit Verknuepfung fuer Farbwechsel',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-cross',
    label: 'Kreuz / Plus',
    icon: 'Plus',
    category: 'decoration',
    defaultSize: { width: 80, height: 80 },
    defaultConfig: {
      fillColor: '#475569',
      strokeColor: 'transparent',
      strokeWidth: 0,
      opacity: 1,
      armWidth: 0.3
    },
    defaultStyle: {},
    description: 'Kreuz / Plus-Symbol - mit Verknuepfung',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-polyline',
    label: 'Polylinie',
    icon: 'Spline',
    category: 'decoration',
    defaultSize: { width: 200, height: 120 },
    defaultConfig: {
      points: [
        { x: 20, y: 100 },
        { x: 80, y: 20 },
        { x: 140, y: 80 },
        { x: 180, y: 30 }
      ],
      strokeColor: '#64748b',
      strokeWidth: 2,
      fillColor: 'transparent',
      closed: false,
      opacity: 1
    },
    defaultStyle: {},
    description: 'Freihand Polylinie - Ecken verschiebbar',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-nav-button',
    label: 'Seiten-Taster',
    icon: 'Navigation',
    category: 'navigation',
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
    category: 'navigation',
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
    category: 'navigation',
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
  },
  {
    type: 'visu-frame',
    label: 'Navigation Frame',
    icon: 'PanelLeft',
    category: 'navigation',
    defaultSize: { width: 220, height: 500 },
    defaultConfig: {
      title: 'Navigation',
      items: [
        { id: 'section-1', type: 'section', label: 'Hauptmenu' },
        { id: 'btn-1', type: 'nav-button', label: 'Startseite', icon: 'Home', targetPageId: '' },
        { id: 'btn-2', type: 'nav-button', label: 'Uebersicht', icon: 'LayoutDashboard', targetPageId: '' },
        { id: 'section-2', type: 'section', label: 'Einstellungen' },
        { id: 'btn-3', type: 'nav-button', label: 'Einstellungen', icon: 'Settings', targetPageId: '' }
      ],
      accentColor: '#3b82f6',
      backgroundColor: '#0f172a',
      textColor: '#e2e8f0',
      collapsible: true,
      defaultCollapsed: false,
      position: 'left',
      showIcons: true
    },
    defaultStyle: {},
    description: 'Ein- und ausklappbare Seitennavigation',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-image',
    label: 'Hintergrundbild',
    icon: 'ImageIcon',
    category: 'decoration',
    defaultSize: { width: 300, height: 200 },
    defaultConfig: {
      imageUrl: undefined,
      storagePath: undefined,
      objectFit: 'contain',
      opacity: 1,
      borderRadius: 0
    },
    defaultStyle: {},
    description: 'Bild / Logo / Grundriss von PC hochladen',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'modern-switch',
    label: 'Schalter Modern',
    icon: 'ToggleLeft',
    category: 'modern',
    defaultSize: { width: 200, height: 64 },
    defaultConfig: { onLabel: 'Ein', offLabel: 'Aus', onColor: '#22c55e', offColor: '#475569', defaultValue: false },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Schlanker moderner Toggle-Schalter',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'modern-button',
    label: 'Taster Modern',
    icon: 'Square',
    category: 'modern',
    defaultSize: { width: 160, height: 56 },
    defaultConfig: { label: 'Taster', pressValue: true, releaseValue: false, color: '#3b82f6' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Flacher moderner Button mit Ripple-Effekt',
    supportsBinding: true,
    bindingDirection: 'write'
  },
  {
    type: 'modern-gauge',
    label: 'Gauge Modern',
    icon: 'Gauge',
    category: 'modern',
    defaultSize: { width: 160, height: 160 },
    defaultConfig: { min: 0, max: 100, unit: '%', showValue: true, thresholds: [{ value: 70, color: '#22c55e' }, { value: 85, color: '#eab308' }, { value: 100, color: '#ef4444' }] },
    defaultStyle: { showLabel: true, labelPosition: 'bottom' },
    description: 'Kreisfoermiges Gauge im modernen Stil',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'modern-display',
    label: 'Anzeige Modern',
    icon: 'MonitorDot',
    category: 'modern',
    defaultSize: { width: 160, height: 80 },
    defaultConfig: { unit: '', decimals: 1, prefix: '', suffix: '' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Grosser Wert mit Einheit im Clean-Look',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'modern-bar',
    label: 'Balken Modern',
    icon: 'BarChart3',
    category: 'modern',
    defaultSize: { width: 220, height: 48 },
    defaultConfig: { min: 0, max: 100, unit: '%', showValue: true, color: '#3b82f6', orientation: 'horizontal' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Schlanke Fortschrittsanzeige mit Prozentbalken',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'modern-led',
    label: 'Status Modern',
    icon: 'Lightbulb',
    category: 'modern',
    defaultSize: { width: 120, height: 48 },
    defaultConfig: { onColor: '#22c55e', offColor: '#475569', label: 'Status', size: 'md' },
    defaultStyle: { showLabel: false },
    description: 'Status-Badge mit rundem Leuchtpunkt',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'modern-slider',
    label: 'Slider Modern',
    icon: 'SlidersHorizontal',
    category: 'modern',
    defaultSize: { width: 240, height: 64 },
    defaultConfig: { min: 0, max: 100, step: 1, unit: '', showValue: true, color: '#3b82f6' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Moderner Schieberegler mit Wertanzeige',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'modern-multistate',
    label: 'Mehrfachschalter Modern',
    icon: 'List',
    category: 'modern',
    defaultSize: { width: 200, height: 80 },
    defaultConfig: {
      options: [
        { value: 0, label: 'Aus', color: '#64748b' },
        { value: 1, label: 'Ein', color: '#22c55e' },
        { value: 2, label: 'Auto', color: '#3b82f6' }
      ],
      defaultValue: 0,
      activeColor: '#3b82f6'
    },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Moderner Mehrfachschalter mit Schaltflaechen',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'dash-stat',
    label: 'Statistik Karte',
    icon: 'TrendingUp',
    category: 'dashboard',
    defaultSize: { width: 200, height: 100 },
    defaultConfig: { unit: '', decimals: 1, icon: 'Activity', color: '#3b82f6' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Dashboard Statistik-Karte mit Wert und Einheit',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-progress',
    label: 'Progress Karte',
    icon: 'Activity',
    category: 'dashboard',
    defaultSize: { width: 220, height: 80 },
    defaultConfig: { min: 0, max: 100, unit: '%', color: '#3b82f6', showValue: true, thresholds: [{ value: 60, color: '#22c55e' }, { value: 80, color: '#eab308' }, { value: 100, color: '#ef4444' }] },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Dashboard Progress-Balken mit Grenzwert-Farben',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-value-card',
    label: 'Wert Karte',
    icon: 'MonitorDot',
    category: 'dashboard',
    defaultSize: { width: 180, height: 110 },
    defaultConfig: { unit: '', decimals: 1, color: '#0ea5e9', icon: 'Zap' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Weisse Dashboard-Karte mit Icon und grossem Wert',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-toggle-card',
    label: 'Toggle Karte',
    icon: 'ToggleLeft',
    category: 'dashboard',
    defaultSize: { width: 180, height: 110 },
    defaultConfig: { onLabel: 'Aktiv', offLabel: 'Inaktiv', onColor: '#22c55e', offColor: '#64748b', icon: 'Power' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Dashboard-Karte mit grossem Toggle-Schalter',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'dash-battery',
    label: 'Batterie',
    icon: 'Battery',
    category: 'dashboard',
    defaultSize: { width: 180, height: 100 },
    defaultConfig: { showPercent: true, lowThreshold: 20, criticalThreshold: 10, color: '#22c55e' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Batterie-Ladestandsanzeige',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-signal',
    label: 'Signalstaerke',
    icon: 'Wifi',
    category: 'dashboard',
    defaultSize: { width: 160, height: 100 },
    defaultConfig: { maxBars: 5, showValue: true, color: '#3b82f6', unit: 'dBm' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Signalstaerke-Balkenanzeige',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-sparkline',
    label: 'Kurve',
    icon: 'TrendingUp',
    category: 'dashboard',
    defaultSize: { width: 220, height: 110 },
    defaultConfig: { color: '#3b82f6', historyLength: 20, showValue: true, decimals: 1, fillArea: true },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Mini-Verlaufskurve mit aktuellem Wert',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-multivalue',
    label: 'Multi-Wert',
    icon: 'LayoutGrid',
    category: 'dashboard',
    defaultSize: { width: 200, height: 120 },
    defaultConfig: { items: [{ label: 'Wert 1', unit: '', color: '#3b82f6', decimals: 1 }, { label: 'Wert 2', unit: '', color: '#22c55e', decimals: 1 }, { label: 'Wert 3', unit: '', color: '#f59e0b', decimals: 1 }], color: '#3b82f6' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Mehrere Messwerte in einer Karte',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-heatbar',
    label: 'Heatbar',
    icon: 'Thermometer',
    category: 'dashboard',
    defaultSize: { width: 200, height: 90 },
    defaultConfig: { min: 0, max: 100, unit: '%', showValue: true, decimals: 0, lowColor: '#3b82f6', midColor: '#f59e0b', highColor: '#ef4444' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Farbgradient-Balken mit Schwellwerten',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-compass',
    label: 'Kompass',
    icon: 'Navigation',
    category: 'dashboard',
    defaultSize: { width: 160, height: 160 },
    defaultConfig: { color: '#3b82f6', showDegrees: true, showCardinal: true },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Kompass-Richtungsanzeige (0-360°)',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-clock',
    label: 'Uhr',
    icon: 'Clock',
    category: 'dashboard',
    defaultSize: { width: 200, height: 100 },
    defaultConfig: { showSeconds: true, showDate: true, format24h: true, color: '#3b82f6' },
    defaultStyle: { showLabel: false, labelPosition: 'top' },
    description: 'Digitale Uhr ohne Verknuepfung',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'dash-rating',
    label: 'Bewertung',
    icon: 'Star',
    category: 'dashboard',
    defaultSize: { width: 180, height: 90 },
    defaultConfig: { max: 5, color: '#f59e0b', showValue: true },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Stern-/Punkte-Bewertungsanzeige',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-level',
    label: 'Pegelanzeige',
    icon: 'AlignLeft',
    category: 'dashboard',
    defaultSize: { width: 200, height: 110 },
    defaultConfig: { min: 0, max: 100, unit: '%', orientation: 'horizontal', color: '#3b82f6', showValue: true, decimals: 0, dangerZone: 90, warningZone: 70 },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Pegelmesser mit Warn- und Gefahrenzonen',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-wind',
    label: 'Wind',
    icon: 'Wind',
    category: 'dashboard',
    defaultSize: { width: 180, height: 130 },
    defaultConfig: { showSpeed: true, showDirection: true, speedUnit: 'km/h', color: '#06b6d4' },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Windgeschwindigkeit und -richtung',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'dash-multistate',
    label: 'Mehrfachschalter Dash',
    icon: 'List',
    category: 'dashboard',
    defaultSize: { width: 200, height: 120 },
    defaultConfig: {
      options: [
        { value: 0, label: 'Aus', color: '#64748b' },
        { value: 1, label: 'Ein', color: '#22c55e' },
        { value: 2, label: 'Auto', color: '#3b82f6' }
      ],
      defaultValue: 0,
      activeColor: '#3b82f6'
    },
    defaultStyle: { showLabel: true, labelPosition: 'top' },
    description: 'Dashboard Mehrfachschalter mit Karten-Design',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-pump',
    label: 'Aggregat',
    icon: 'Fan',
    category: 'control',
    defaultSize: { width: 120, height: 120 },
    defaultConfig: {
      pumpName: '',
      showSpeed: true,
      showOperatingHours: true,
      showStartCount: true,
      runningColor: '#22c55e',
      stoppedColor: '#64748b',
      faultColor: '#ef4444',
      revisionColor: '#f59e0b',
      orientation: 'right',
      symbolType: 'pump'
    },
    defaultStyle: { showLabel: false, labelPosition: 'bottom' },
    description: 'Aggregat-Widget (Pumpe, Ventilator, Motor, etc.) mit Popup',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-valve',
    label: 'Ventil',
    icon: 'Pipette',
    category: 'control',
    defaultSize: { width: 120, height: 120 },
    defaultConfig: {
      valveName: '',
      normalColor: '#3b82f6',
      alarmColor: '#ef4444',
      rotation: 0,
      symbolType: 'valve-2way',
      showSetpoint: true,
      showFeedback: true,
      showOutput: true
    },
    defaultStyle: { showLabel: false, labelPosition: 'bottom' },
    description: 'Ventil-Widget mit Popup fuer Sollwert und Ueberwachung',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-sensor',
    label: 'Sensor',
    icon: 'Thermometer',
    category: 'display',
    defaultSize: { width: 110, height: 110 },
    defaultConfig: {
      sensorName: '',
      normalColor: '#0891b2',
      alarmColor: '#ef4444',
      rotation: 0,
      symbolType: 'temperature',
      showValue: true,
      showUnit: true,
      showLimits: true
    },
    defaultStyle: { showLabel: false, labelPosition: 'bottom' },
    description: 'Sensor-Widget mit Grenzwertueberwachung',
    supportsBinding: true,
    bindingDirection: 'read'
  },
  {
    type: 'visu-pid',
    label: 'PID Regler',
    icon: 'Activity',
    category: 'control',
    defaultSize: { width: 120, height: 120 },
    defaultConfig: {
      pidName: '',
      normalColor: '#64748b',
      activeColor: '#22c55e',
      rotation: 0,
      symbolType: 'pid',
      showSetpoint: true,
      showActualValue: true,
      showOutput: true
    },
    defaultStyle: { showLabel: false, labelPosition: 'bottom' },
    description: 'PID-Regler Widget mit Sollwert, Istwert und Stellgroesse',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-heating-curve',
    label: 'Heizkurve',
    icon: 'TrendingUp',
    category: 'control',
    defaultSize: { width: 120, height: 120 },
    defaultConfig: {
      hcName: '',
      normalColor: '#64748b',
      activeColor: '#f97316',
      rotation: 0,
      showInput: true,
      showOutput: true
    },
    defaultStyle: { showLabel: false, labelPosition: 'bottom' },
    description: 'Heizkurven-Widget mit grafischer Kennlinie',
    supportsBinding: true,
    bindingDirection: 'readwrite'
  },
  {
    type: 'visu-alarm-console',
    label: 'Alarmkonsole',
    icon: 'Bell',
    category: 'display',
    defaultSize: { width: 300, height: 200 },
    defaultConfig: {
      consoleId: undefined,
      showAcknowledgeButton: true,
      showClearButton: true,
      showTimestamp: true,
      showSource: true,
      compactMode: false,
      maxVisibleAlarms: 10,
      fontSize: 12
    },
    defaultStyle: { showLabel: false, labelPosition: 'top' },
    description: 'Zeigt Alarme aus einer Alarmkonsole an',
    supportsBinding: false,
    bindingDirection: 'read'
  },
  {
    type: 'visu-trend-chart',
    label: 'Trend-Diagramm',
    icon: 'TrendingUp',
    category: 'display',
    defaultSize: { width: 400, height: 250 },
    defaultConfig: {
      series: [],
      timeRange: '1h',
      chartType: 'line',
      showLegend: true,
      showGrid: true,
      showTooltip: true,
      showZoom: false,
      separateAxes: false,
      autoScale: true,
      showMinMaxAvg: true,
      refreshIntervalMs: 10000,
      smoothing: false,
      fillArea: true
    },
    defaultStyle: { showLabel: false, labelPosition: 'top' },
    description: 'Trend-Diagramm mit Zeitachse, Zoom und mehreren Datenpunkten',
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
