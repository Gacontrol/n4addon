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
  | 'visu-frame';

export interface WidgetBinding {
  nodeId: string;
  portId?: string;
  paramKey?: string;
  direction: 'read' | 'write' | 'readwrite';
}

export interface WidgetStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  accentColor?: string;
  fontSize?: number;
  borderRadius?: number;
  showLabel?: boolean;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
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
  | FrameConfig;

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
}

export interface WidgetTemplate {
  type: WidgetType;
  label: string;
  icon: string;
  category: 'control' | 'display' | 'indicator' | 'decoration';
  defaultSize: Size;
  defaultConfig: WidgetConfig;
  defaultStyle: WidgetStyle;
  description: string;
  supportsBinding: boolean;
  bindingDirection: 'read' | 'write' | 'readwrite';
}
