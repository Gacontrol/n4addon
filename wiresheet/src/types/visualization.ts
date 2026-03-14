export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type WidgetType =
  | 'visu-switch'
  | 'visu-button'
  | 'visu-slider'
  | 'visu-incrementer'
  | 'visu-input'
  | 'visu-multistate'
  | 'visu-gauge'
  | 'visu-display'
  | 'visu-led'
  | 'visu-bar'
  | 'visu-label'
  | 'visu-tank'
  | 'visu-thermometer'
  | 'visu-rect'
  | 'visu-circle'
  | 'visu-line'
  | 'visu-arrow'
  | 'visu-polygon'
  | 'visu-star'
  | 'visu-diamond'
  | 'visu-cross'
  | 'visu-polyline'
  | 'visu-nav-button'
  | 'visu-home-button'
  | 'visu-back-button'
  | 'visu-frame'
  | 'visu-image'
  | 'modern-switch'
  | 'modern-button'
  | 'modern-gauge'
  | 'modern-display'
  | 'modern-bar'
  | 'modern-led'
  | 'modern-slider'
  | 'dash-stat'
  | 'dash-progress'
  | 'dash-value-card'
  | 'dash-toggle-card'
  | 'dash-battery'
  | 'dash-signal'
  | 'dash-sparkline'
  | 'dash-multivalue'
  | 'dash-heatbar'
  | 'dash-compass'
  | 'dash-clock'
  | 'dash-rating'
  | 'dash-level'
  | 'dash-wind'
  | 'modern-multistate'
  | 'dash-multistate'
  | 'visu-pump'
  | 'visu-valve'
  | 'visu-sensor'
  | 'visu-pid'
  | 'visu-heating-curve'
  | 'visu-alarm-console'
  | 'visu-trend-chart';

export interface WidgetBinding {
  nodeId: string;
  portId?: string;
  paramKey?: string;
  direction: 'read' | 'write' | 'readwrite';
}

export type WidgetTheme =
  | 'default'
  | 'dark-glass'
  | 'neon-glow'
  | 'minimal-flat'
  | 'industrial'
  | 'soft-light'
  | 'midnight-blue'
  | 'carbon-fiber'
  | 'warm-amber'
  | 'arctic-white';

export type FontFamily = 'system' | 'sans' | 'serif' | 'mono';

export interface WidgetStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  accentColor?: string;
  fontSize?: number;
  fontFamily?: FontFamily;
  borderRadius?: number;
  showLabel?: boolean;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  theme?: WidgetTheme;
}

export interface SwitchConfig {
  onLabel?: string;
  offLabel?: string;
  onColor?: string;
  offColor?: string;
  defaultValue?: boolean;
}

export interface MultistateOption {
  value: number | string;
  label: string;
  color?: string;
}

export interface MultistateConfig {
  options: MultistateOption[];
  defaultValue?: number | string;
}

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  showValue?: boolean;
  unit?: string;
  orientation?: 'horizontal' | 'vertical';
}

export interface IncrementerConfig {
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface InputConfig {
  inputType: 'number' | 'text';
  min?: number;
  max?: number;
  defaultValue?: number | string;
  placeholder?: string;
  unit?: string;
}

export interface GaugeConfig {
  min: number;
  max: number;
  unit?: string;
  thresholds?: { value: number; color: string }[];
  showValue?: boolean;
  gaugeType?: 'radial' | 'semicircle' | 'arc';
}

export interface DisplayConfig {
  format?: string;
  unit?: string;
  decimals?: number;
  fontSize?: number;
  trueText?: string;
  falseText?: string;
}

export interface LedConfig {
  onColor?: string;
  offColor?: string;
  shape?: 'circle' | 'square';
  blinkOnChange?: boolean;
}

export interface BarConfig {
  min: number;
  max: number;
  orientation?: 'horizontal' | 'vertical';
  showValue?: boolean;
  unit?: string;
  color?: string;
  backgroundColor?: string;
}

export interface LabelConfig {
  text: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
}

export interface TankConfig {
  min: number;
  max: number;
  unit?: string;
  showValue?: boolean;
  fillColor?: string;
  levels?: { value: number; color: string; label?: string }[];
}

export interface ThermometerConfig {
  min: number;
  max: number;
  unit?: string;
  showValue?: boolean;
  coldColor?: string;
  hotColor?: string;
}

export interface ButtonConfig {
  label: string;
  pressValue?: unknown;
  releaseValue?: unknown;
  holdMode?: boolean;
  impulseMode?: boolean;
  color?: string;
  defaultPressValue?: unknown;
  defaultReleaseValue?: unknown;
}

export interface ShapeBindingConfig {
  navigateToPageId?: string;
  colorBinding?: WidgetBinding;
  visibilityBinding?: WidgetBinding;
  activeColor?: string;
  inactiveColor?: string;
}

export interface RectConfig extends ShapeBindingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface CircleConfig extends ShapeBindingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface LineConfig extends ShapeBindingConfig {
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  angle?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface ArrowConfig extends ShapeBindingConfig {
  strokeColor?: string;
  strokeWidth?: number;
  arrowEnd?: boolean;
  arrowStart?: boolean;
  opacity?: number;
  angle?: number;
}

export interface PolygonConfig extends ShapeBindingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  sides?: number;
  points?: { x: number; y: number }[];
}

export interface StarConfig extends ShapeBindingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  points?: number;
  innerRadiusRatio?: number;
}

export interface DiamondConfig extends ShapeBindingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface CrossConfig extends ShapeBindingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  armWidth?: number;
}

export interface PolylineConfig extends ShapeBindingConfig {
  points: { x: number; y: number }[];
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  closed?: boolean;
  opacity?: number;
}

export interface NavButtonConfig {
  label: string;
  targetPageId?: string;
  color?: string;
  icon?: string;
}

export interface HomeButtonConfig {
  label?: string;
  color?: string;
}

export interface BackButtonConfig {
  label?: string;
  color?: string;
}

export type FrameItemType = 'nav-button' | 'section';

export interface FrameItem {
  id: string;
  type: FrameItemType;
  label: string;
  targetPageId?: string;
  icon?: string;
}

export interface FrameConfig {
  title?: string;
  items: FrameItem[];
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
  showIcons?: boolean;
}

export interface ImageConfig {
  imageUrl?: string;
  storagePath?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
  opacity?: number;
  borderRadius?: number;
}

export type WidgetConfig =
  | SwitchConfig
  | SliderConfig
  | IncrementerConfig
  | InputConfig
  | MultistateConfig
  | GaugeConfig
  | DisplayConfig
  | LedConfig
  | BarConfig
  | LabelConfig
  | TankConfig
  | ThermometerConfig
  | ButtonConfig
  | RectConfig
  | CircleConfig
  | LineConfig
  | ArrowConfig
  | PolygonConfig
  | StarConfig
  | DiamondConfig
  | CrossConfig
  | PolylineConfig
  | NavButtonConfig
  | HomeButtonConfig
  | BackButtonConfig
  | FrameConfig
  | ImageConfig
  | ModernSwitchConfig
  | ModernButtonConfig
  | ModernGaugeConfig
  | ModernDisplayConfig
  | ModernBarConfig
  | ModernLedConfig
  | ModernSliderConfig
  | DashStatConfig
  | DashProgressConfig
  | DashValueCardConfig
  | DashToggleCardConfig
  | DashBatteryConfig
  | DashSignalConfig
  | DashSparklineConfig
  | DashMultivalueConfig
  | DashHeatbarConfig
  | DashCompassConfig
  | DashClockConfig
  | DashRatingConfig
  | DashLevelConfig
  | DashWindConfig
  | ModernMultistateConfig
  | DashMultistateConfig
  | PumpWidgetConfig
  | ValveWidgetConfig
  | SensorWidgetConfig
  | PIDWidgetConfig
  | HeatingCurveWidgetConfig
  | AlarmConsoleWidgetConfig
  | TrendChartConfig;

export interface VisuWidget {
  id: string;
  type: WidgetType;
  position: Position;
  size: Size;
  label: string;
  binding?: WidgetBinding;
  statusBinding?: WidgetBinding;
  config: WidgetConfig;
  style: WidgetStyle;
  locked?: boolean;
  zIndex?: number;
}

export interface VisuPage {
  id: string;
  name: string;
  widgets: VisuWidget[];
  backgroundColor?: string;
  gridSize?: number;
  showGrid?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ModernSwitchConfig {
  onLabel?: string;
  offLabel?: string;
  onColor?: string;
  offColor?: string;
  defaultValue?: boolean;
}

export interface ModernButtonConfig {
  label: string;
  pressValue?: unknown;
  releaseValue?: unknown;
  holdMode?: boolean;
  color?: string;
  icon?: string;
}

export interface ModernGaugeConfig {
  min: number;
  max: number;
  unit?: string;
  thresholds?: { value: number; color: string }[];
  showValue?: boolean;
}

export interface ModernDisplayConfig {
  unit?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  icon?: string;
}

export interface ModernBarConfig {
  min: number;
  max: number;
  unit?: string;
  showValue?: boolean;
  color?: string;
  orientation?: 'horizontal' | 'vertical';
}

export interface ModernLedConfig {
  onColor?: string;
  offColor?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface ModernSliderConfig {
  min: number;
  max: number;
  step: number;
  unit?: string;
  showValue?: boolean;
  color?: string;
}

export interface DashStatConfig {
  unit?: string;
  decimals?: number;
  icon?: string;
  color?: string;
  trendBinding?: boolean;
}

export interface DashProgressConfig {
  min: number;
  max: number;
  unit?: string;
  color?: string;
  showValue?: boolean;
  thresholds?: { value: number; color: string }[];
}

export interface DashValueCardConfig {
  unit?: string;
  decimals?: number;
  color?: string;
  icon?: string;
  format?: string;
}

export interface DashToggleCardConfig {
  onLabel?: string;
  offLabel?: string;
  onColor?: string;
  offColor?: string;
  icon?: string;
}

export interface DashBatteryConfig {
  color?: string;
  showPercent?: boolean;
  lowThreshold?: number;
  criticalThreshold?: number;
}

export interface DashSignalConfig {
  color?: string;
  maxBars?: number;
  showValue?: boolean;
  unit?: string;
}

export interface DashSparklineConfig {
  color?: string;
  historyLength?: number;
  min?: number;
  max?: number;
  unit?: string;
  showValue?: boolean;
  decimals?: number;
  fillArea?: boolean;
}

export interface DashMultivalueItem {
  label: string;
  unit?: string;
  color?: string;
  decimals?: number;
}

export interface DashMultivalueConfig {
  items?: DashMultivalueItem[];
  color?: string;
}

export interface DashHeatbarConfig {
  min: number;
  max: number;
  unit?: string;
  showValue?: boolean;
  decimals?: number;
  lowColor?: string;
  midColor?: string;
  highColor?: string;
}

export interface DashCompassConfig {
  color?: string;
  showDegrees?: boolean;
  showCardinal?: boolean;
}

export interface DashClockConfig {
  showSeconds?: boolean;
  showDate?: boolean;
  format24h?: boolean;
  color?: string;
}

export interface DashRatingConfig {
  max?: number;
  color?: string;
  icon?: string;
  showValue?: boolean;
}

export interface DashLevelConfig {
  min: number;
  max: number;
  unit?: string;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  showValue?: boolean;
  decimals?: number;
  dangerZone?: number;
  warningZone?: number;
}

export interface DashWindConfig {
  color?: string;
  showSpeed?: boolean;
  showDirection?: boolean;
  speedUnit?: string;
}

export interface ModernMultistateConfig {
  options: MultistateOption[];
  defaultValue?: number | string;
  activeColor?: string;
}

export interface DashMultistateConfig {
  options: MultistateOption[];
  defaultValue?: number | string;
  activeColor?: string;
}

export type AggregateSymbolType = 'pump' | 'fan' | 'motor' | 'compressor' | 'heater' | 'cooler';

export type WidgetSizePreset = 'small' | 'medium' | 'large';

export type LabelPosition = 'left' | 'right' | 'top' | 'bottom' | 'none';

export interface PumpWidgetConfig {
  pumpName?: string;
  showSpeed?: boolean;
  showOperatingHours?: boolean;
  showStartCount?: boolean;
  runningColor?: string;
  stoppedColor?: string;
  faultColor?: string;
  revisionColor?: string;
  orientation?: 'up' | 'down' | 'left' | 'right';
  symbolType?: AggregateSymbolType;
  widgetSize?: WidgetSizePreset;
  labelPosition?: LabelPosition;
  fontSize?: number;
  fontFamily?: FontFamily;
}

export type ValveSymbolType = 'valve-2way' | 'valve-3way' | 'valve-motor' | 'valve-3way-motor' | 'valve-butterfly' | 'valve-ball' | 'valve-gate';

export interface ValveWidgetConfig {
  valveName?: string;
  normalColor?: string;
  alarmColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  symbolType?: ValveSymbolType;
  showSetpoint?: boolean;
  showFeedback?: boolean;
  showOutput?: boolean;
  widgetSize?: WidgetSizePreset;
  labelPosition?: LabelPosition;
  fontSize?: number;
  fontFamily?: FontFamily;
}

export type SensorSymbolType = 'temperature' | 'pressure' | 'humidity' | 'co2' | 'flow' | 'level' | 'generic' | 'none';

export interface SensorWidgetConfig {
  sensorName?: string;
  normalColor?: string;
  alarmColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  symbolType?: SensorSymbolType;
  showValue?: boolean;
  showUnit?: boolean;
  showLimits?: boolean;
  widgetSize?: WidgetSizePreset;
  labelPosition?: LabelPosition;
  fontSize?: number;
  fontFamily?: FontFamily;
}

export type PIDSymbolType = 'pid' | 'controller' | 'regulator';

export interface PIDWidgetConfig {
  pidName?: string;
  normalColor?: string;
  activeColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  symbolType?: PIDSymbolType;
  showSetpoint?: boolean;
  showActualValue?: boolean;
  showOutput?: boolean;
  widgetSize?: WidgetSizePreset;
  labelPosition?: LabelPosition;
  fontSize?: number;
  fontFamily?: FontFamily;
}

export interface HeatingCurveWidgetConfig {
  hcName?: string;
  normalColor?: string;
  activeColor?: string;
  rotation?: 0 | 90 | 180 | 270;
  showInput?: boolean;
  showOutput?: boolean;
  widgetSize?: WidgetSizePreset;
  labelPosition?: LabelPosition;
  fontSize?: number;
  fontFamily?: FontFamily;
}

export type TrendChartType = 'line' | 'stepped' | 'bar' | 'area' | 'scatter' | 'candlestick';
export type TrendTimeRange = '5min' | '15min' | '30min' | '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | 'custom';

export interface TrendSeries {
  nodeId: string;
  label: string;
  color: string;
  unit?: string;
  decimals?: number;
  visible: boolean;
  chartType?: TrendChartType;
  lineWidth?: number;
  fillOpacity?: number;
  yAxisSide?: 'left' | 'right';
}

export interface TrendChartConfig {
  series: TrendSeries[];
  timeRange: TrendTimeRange;
  customFromMs?: number;
  customToMs?: number;
  chartType: TrendChartType;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  showZoom?: boolean;
  backgroundColor?: string;
  gridColor?: string;
  separateAxes?: boolean;
  yMin?: number;
  yMax?: number;
  autoScale?: boolean;
  showMinMaxAvg?: boolean;
  refreshIntervalMs?: number;
  title?: string;
  xAxisFormat?: 'auto' | 'time' | 'date' | 'datetime';
  smoothing?: boolean;
  fillArea?: boolean;
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

export interface WidgetTemplate {
  type: WidgetType;
  label: string;
  icon: string;
  category: 'control' | 'display' | 'indicator' | 'decoration' | 'modern' | 'dashboard' | 'navigation';
  defaultSize: Size;
  defaultConfig: WidgetConfig;
  defaultStyle: WidgetStyle;
  description: string;
  supportsBinding: boolean;
  bindingDirection: 'read' | 'write' | 'readwrite';
}
