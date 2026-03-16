import React, { useState } from 'react';
import { X, Link2, Unlink, Trash2, Settings, Plus, Monitor, Ban, FolderOpen } from 'lucide-react';

interface ColorPickerProps {
  value: string | undefined;
  defaultColor: string;
  onChange: (color: string | undefined) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, defaultColor, onChange }) => {
  const isNone = !value;
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        {isNone ? (
          <div className="w-full h-8 rounded border border-slate-600 bg-slate-800 flex items-center justify-center gap-1 text-xs text-slate-400">
            <Ban className="w-3 h-3" />
            Keine Farbe
          </div>
        ) : (
          <input
            type="color"
            value={value || defaultColor}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-8 rounded cursor-pointer"
          />
        )}
      </div>
      <button
        onClick={() => onChange(isNone ? defaultColor : undefined)}
        title={isNone ? 'Farbe aktivieren' : 'Keine Farbe'}
        className={`flex-shrink-0 w-8 h-8 rounded border flex items-center justify-center transition-colors ${
          isNone
            ? 'border-blue-500 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
            : 'border-slate-600 bg-slate-800 text-slate-400 hover:text-red-400 hover:border-red-600'
        }`}
      >
        {isNone ? <span className="text-[10px] font-bold">+</span> : <Ban className="w-3 h-3" />}
      </button>
    </div>
  );
};
import { VisuWidget, WidgetBinding, WidgetTheme, SliderConfig, GaugeConfig, BarConfig, TankConfig, ThermometerConfig, IncrementerConfig, InputConfig, DisplayConfig, LedConfig, SwitchConfig, ButtonConfig, LabelConfig, RectConfig, CircleConfig, LineConfig, ArrowConfig, PolygonConfig, StarConfig, DiamondConfig, CrossConfig, PolylineConfig, NavButtonConfig, HomeButtonConfig, BackButtonConfig, MultistateConfig, MultistateOption, ImageConfig, AlarmConsoleWidgetConfig, TrendChartConfig, TrendSeries, TrendChartType, Building3DWidgetConfig } from '../../types/visualization';
import { FlowNode } from '../../types/flow';
import { AlarmConsole } from '../../types/alarm';
import { FileManager } from './FileManager';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? m[1] : '';
}

export interface TrackedTrend {
  nodeId: string;
  label: string;
  color: string;
  unit?: string;
}

interface WidgetPropertiesPanelProps {
  widget: VisuWidget;
  availableNodes: FlowNode[];
  visuPages?: { id: string; name: string }[];
  alarmConsoles?: AlarmConsole[];
  trackedTrends?: TrackedTrend[];
  onUpdate: (updates: Partial<VisuWidget>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const NON_BINDABLE_TYPES = new Set([
  'visu-nav-button', 'visu-home-button', 'visu-back-button',
  'ha-output', 'modbus-driver', 'modbus-device-output', 'text-annotation'
]);

const PUMP_WIDGET_TYPE = 'visu-pump';
const VALVE_WIDGET_TYPE = 'visu-valve';
const SENSOR_WIDGET_TYPE = 'visu-sensor';
const PID_WIDGET_TYPE = 'visu-pid';
const HEATING_CURVE_WIDGET_TYPE = 'visu-heating-curve';
const PUMP_CONTROL_NODE_TYPE = 'pump-control';
const AGGREGATE_CONTROL_NODE_TYPE = 'aggregate-control';
const VALVE_CONTROL_NODE_TYPE = 'valve-control';
const SENSOR_CONTROL_NODE_TYPE = 'sensor-control';
const PID_CONTROL_NODE_TYPE = 'pid-controller';
const HEATING_CURVE_NODE_TYPE = 'heating-curve';

const SYMBOL_OPTIONS = [
  { value: 'pump', label: 'Pumpe' },
  { value: 'fan', label: 'Ventilator' },
  { value: 'motor', label: 'Motor' },
  { value: 'compressor', label: 'Kompressor' },
  { value: 'heater', label: 'Heizung' },
  { value: 'cooler', label: 'Kuehlung' }
];

const VALVE_SYMBOL_OPTIONS = [
  { value: 'valve-2way', label: '2-Wege Ventil' },
  { value: 'valve-3way', label: '3-Wege Ventil' },
  { value: 'valve-motor', label: 'Motorventil 2-Wege' },
  { value: 'valve-3way-motor', label: 'Motorventil 3-Wege' },
  { value: 'valve-butterfly', label: 'Klappenventil' },
  { value: 'valve-ball', label: 'Kugelventil' },
  { value: 'valve-gate', label: 'Schieberventil' }
];

const ROTATION_OPTIONS = [
  { value: 0, label: '0 Grad' },
  { value: 90, label: '90 Grad' },
  { value: 180, label: '180 Grad' },
  { value: 270, label: '270 Grad' }
];

const SENSOR_SYMBOL_OPTIONS = [
  { value: 'none', label: 'Kein Symbol (nur Wert)' },
  { value: 'temperature', label: 'Temperatur (T)' },
  { value: 'pressure', label: 'Druck (P)' },
  { value: 'humidity', label: 'Feuchte (H)' },
  { value: 'co2', label: 'CO2' },
  { value: 'flow', label: 'Durchfluss (Q)' },
  { value: 'level', label: 'Fuellstand (L)' },
  { value: 'generic', label: 'Allgemein' }
];

const PID_SYMBOL_OPTIONS = [
  { value: 'pid', label: 'PID Block' },
  { value: 'controller', label: 'Kreis mit PID' },
  { value: 'regulator', label: 'Regler Symbol' }
];

const WIDGET_SIZE_OPTIONS = [
  { value: 'small', label: 'Klein' },
  { value: 'medium', label: 'Mittel' },
  { value: 'large', label: 'Gross' }
];

const LABEL_POSITION_OPTIONS = [
  { value: 'none', label: 'Kein Text' },
  { value: 'left', label: 'Links' },
  { value: 'right', label: 'Rechts' },
  { value: 'top', label: 'Oben' },
  { value: 'bottom', label: 'Unten' }
];

const FONT_FAMILY_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'sans', label: 'Sans-Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' }
];

const SHAPE_TYPES = new Set([
  'visu-rect', 'visu-circle', 'visu-line', 'visu-arrow',
  'visu-polygon', 'visu-star', 'visu-diamond', 'visu-cross', 'visu-polyline'
]);

const getNodeLabel = (node: FlowNode | undefined | null): string => {
  if (!node) return '[Geloeschter Baustein]';
  const customLabel = node.data.config?.customLabel as string | undefined;
  return customLabel || node.data.label || node.type;
};

const getNodeCategory = (type: string): string => {
  if (type.startsWith('dp-')) return 'Datenpunkte';
  if (type.startsWith('ha-')) return 'Home Assistant';
  if (type.startsWith('modbus-')) return 'Modbus';
  if (type.startsWith('math-')) return 'Mathematik';
  if (type.endsWith('-gate')) return 'Logik';
  if (['compare', 'threshold', 'select', 'switch', 'delay', 'timer', 'counter', 'sr-flipflop', 'rising-edge', 'falling-edge'].includes(type)) return 'Logik';
  if (['pid-controller', 'scaling', 'smoothing'].includes(type)) return 'Regelung';
  if (type === 'python-script') return 'Scripting';
  if (['const-value', 'time-trigger', 'state-trigger'].includes(type)) return 'Sonstiges';
  return 'Sonstiges';
};

const getNodePorts = (node: FlowNode) => {
  const ports: { id: string; label: string; isOutput: boolean }[] = [];
  (node.data.inputs || []).forEach((p, i) => {
    ports.push({ id: p.id || `input-${i}`, label: p.label || `Eingang ${i + 1}`, isOutput: false });
  });
  (node.data.outputs || []).forEach((p, i) => {
    ports.push({ id: p.id || `output-${i}`, label: p.label || `Ausgang ${i + 1}`, isOutput: true });
  });
  return ports;
};

interface ConfigParam {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string';
}

const getNodeConfigParams = (node: FlowNode): ConfigParam[] => {
  const params: ConfigParam[] = [];
  switch (node.type) {
    case 'pid-controller':
      params.push({ key: 'kp', label: 'Kp (Proportional)', type: 'number' });
      params.push({ key: 'ki', label: 'Ki (Integral)', type: 'number' });
      params.push({ key: 'kd', label: 'Kd (Differential)', type: 'number' });
      params.push({ key: 'outputMin', label: 'Ausgang Min', type: 'number' });
      params.push({ key: 'outputMax', label: 'Ausgang Max', type: 'number' });
      break;
    case 'scaling':
      params.push({ key: 'inputMin', label: 'Eingang Min', type: 'number' });
      params.push({ key: 'inputMax', label: 'Eingang Max', type: 'number' });
      params.push({ key: 'outputMin', label: 'Ausgang Min', type: 'number' });
      params.push({ key: 'outputMax', label: 'Ausgang Max', type: 'number' });
      break;
    case 'compare':
      params.push({ key: 'compareValue', label: 'Vergleichswert', type: 'number' });
      break;
    case 'threshold':
      params.push({ key: 'thresholdValue', label: 'Schwellwert', type: 'number' });
      break;
    case 'delay':
      params.push({ key: 'delayMs', label: 'Verzoegerung (ms)', type: 'number' });
      break;
    case 'timer':
      params.push({ key: 'timerMs', label: 'Zeitdauer (ms)', type: 'number' });
      break;
    case 'counter':
      params.push({ key: 'counterMin', label: 'Zähler Min', type: 'number' });
      params.push({ key: 'counterMax', label: 'Zähler Max', type: 'number' });
      break;
    case 'smoothing':
      params.push({ key: 'smoothingDuration', label: 'Glaettungsdauer', type: 'number' });
      params.push({ key: 'sampleIntervalMs', label: 'Abtastintervall (ms)', type: 'number' });
      break;
    case 'const-value':
      params.push({ key: 'constValue', label: 'Konstantwert', type: 'number' });
      break;
    default:
      break;
  }
  return params;
};

export const WidgetPropertiesPanel: React.FC<WidgetPropertiesPanelProps> = ({
  widget,
  availableNodes,
  visuPages = [],
  alarmConsoles = [],
  trackedTrends = [],
  onUpdate,
  onDelete,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'binding' | 'style'>('general');
  const [showImagePicker, setShowImagePicker] = useState(false);

  const isDecorationWidget = NON_BINDABLE_TYPES.has(widget.type);
  const isShapeWidget = SHAPE_TYPES.has(widget.type);
  const isPumpWidget = widget.type === PUMP_WIDGET_TYPE;
  const isValveWidget = widget.type === VALVE_WIDGET_TYPE;
  const isSensorWidget = widget.type === SENSOR_WIDGET_TYPE;
  const isPIDWidget = widget.type === PID_WIDGET_TYPE;
  const isHeatingCurveWidget = widget.type === HEATING_CURVE_WIDGET_TYPE;

  const bindableNodes = availableNodes.filter(n => !NON_BINDABLE_TYPES.has(n.type));
  const pumpControlNodes = availableNodes.filter(n => n.type === PUMP_CONTROL_NODE_TYPE || n.type === AGGREGATE_CONTROL_NODE_TYPE);
  const valveControlNodes = availableNodes.filter(n => n.type === VALVE_CONTROL_NODE_TYPE);
  const sensorControlNodes = availableNodes.filter(n => n.type === SENSOR_CONTROL_NODE_TYPE);
  const pidControlNodes = availableNodes.filter(n => n.type === PID_CONTROL_NODE_TYPE);
  const heatingCurveNodes = availableNodes.filter(n => n.type === HEATING_CURVE_NODE_TYPE);

  const nodesByCategory = bindableNodes.reduce<Record<string, FlowNode[]>>((acc, node) => {
    const cat = getNodeCategory(node.type);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(node);
    return acc;
  }, {});

  const selectedNode = widget.binding ? availableNodes.find(n => n.id === widget.binding?.nodeId) : null;
  const selectedNodePorts = selectedNode ? getNodePorts(selectedNode) : [];
  const selectedNodeConfigParams = selectedNode ? getNodeConfigParams(selectedNode) : [];

  const isWriteWidget = [
    'visu-switch', 'visu-slider', 'visu-incrementer', 'visu-input', 'visu-button', 'visu-multistate',
    'modern-switch', 'modern-button', 'modern-incrementer', 'modern-multistate',
    'dash-toggle', 'dash-toggle-card', 'dash-multistate'
  ].includes(widget.type);

  const handleNodeChange = (nodeId: string) => {
    if (!nodeId) {
      onUpdate({ binding: undefined });
      return;
    }
    const node = availableNodes.find(n => n.id === nodeId);
    if (isPumpWidget && (node?.type === PUMP_CONTROL_NODE_TYPE || node?.type === AGGREGATE_CONTROL_NODE_TYPE)) {
      const binding: WidgetBinding = {
        nodeId,
        portId: undefined,
        paramKey: undefined,
        direction: 'readwrite'
      };
      onUpdate({ binding });
      return;
    }
    if (isValveWidget && node?.type === VALVE_CONTROL_NODE_TYPE) {
      const binding: WidgetBinding = {
        nodeId,
        portId: undefined,
        paramKey: undefined,
        direction: 'readwrite'
      };
      onUpdate({ binding });
      return;
    }
    const ports = node ? getNodePorts(node) : [];
    const defaultPort = isWriteWidget
      ? ports.find(p => !p.isOutput)
      : ports.find(p => p.isOutput);
    const binding: WidgetBinding = {
      nodeId,
      portId: defaultPort?.id,
      paramKey: undefined,
      direction: isWriteWidget ? 'readwrite' : 'read'
    };
    onUpdate({ binding });
  };

  const handlePortChange = (portId: string) => {
    if (!widget.binding) return;
    onUpdate({ binding: { ...widget.binding, portId: portId || undefined, paramKey: undefined } });
  };

  const handleParamChange = (paramKey: string) => {
    if (!widget.binding) return;
    onUpdate({ binding: { ...widget.binding, paramKey: paramKey || undefined, portId: undefined } });
  };

  const currentBindingLabel = () => {
    if (!widget.binding) return null;
    if (widget.binding.paramKey) {
      const param = selectedNodeConfigParams.find(p => p.key === widget.binding?.paramKey);
      return param?.label || widget.binding.paramKey;
    }
    if (widget.binding.portId) {
      return selectedNodePorts.find(p => p.id === widget.binding?.portId)?.label || widget.binding.portId;
    }
    return 'Hauptwert';
  };

  const renderGeneralConfig = () => {
    const config = widget.config;

    switch (widget.type) {
      case 'visu-switch':
        const switchCfg = config as SwitchConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ein-Label</label>
              <input
                type="text"
                value={switchCfg.onLabel || 'Ein'}
                onChange={(e) => onUpdate({ config: { ...config, onLabel: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aus-Label</label>
              <input
                type="text"
                value={switchCfg.offLabel || 'Aus'}
                onChange={(e) => onUpdate({ config: { ...config, offLabel: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ein-Farbe</label>
              <input
                type="color"
                value={switchCfg.onColor || '#22c55e'}
                onChange={(e) => onUpdate({ config: { ...config, onColor: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Standardwert</label>
              <select
                value={switchCfg.defaultValue ? 'true' : 'false'}
                onChange={(e) => onUpdate({ config: { ...config, defaultValue: e.target.value === 'true' } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="false">Aus (0)</option>
                <option value="true">Ein (1)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="8"
                max="48"
                value={(switchCfg as { fontSize?: number }).fontSize ?? 12}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'visu-button':
        const btnCfg = config as ButtonConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Button-Text</label>
              <input
                type="text"
                value={btnCfg.label || 'Taster'}
                onChange={(e) => onUpdate({ config: { ...config, label: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Farbe</label>
              <input
                type="color"
                value={btnCfg.color || '#3b82f6'}
                onChange={(e) => onUpdate({ config: { ...config, color: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Drucken-Wert</label>
                <input
                  type="text"
                  value={String(btnCfg.pressValue ?? btnCfg.defaultPressValue ?? 'true')}
                  onChange={(e) => {
                    const v = e.target.value === 'true' ? true : e.target.value === 'false' ? false : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                    onUpdate({ config: { ...config, pressValue: v, defaultPressValue: v } });
                  }}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Loslassen-Wert</label>
                <input
                  type="text"
                  value={String(btnCfg.releaseValue ?? btnCfg.defaultReleaseValue ?? 'false')}
                  onChange={(e) => {
                    const v = e.target.value === 'true' ? true : e.target.value === 'false' ? false : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                    onUpdate({ config: { ...config, releaseValue: v, defaultReleaseValue: v } });
                  }}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={btnCfg.holdMode || false}
                onChange={(e) => onUpdate({ config: { ...config, holdMode: e.target.checked, impulseMode: false } })}
                className="rounded"
              />
              <label className="text-xs text-slate-400">Haltemodus (Wert bleibt nach Loslassen)</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={btnCfg.impulseMode || false}
                onChange={(e) => onUpdate({ config: { ...config, impulseMode: e.target.checked, holdMode: false } })}
                className="rounded"
              />
              <label className="text-xs text-slate-400">Impulsmodus (True-Impuls bei jedem Klick)</label>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="8"
                max="48"
                value={(btnCfg as { fontSize?: number }).fontSize ?? 14}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 14 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'visu-slider':
      case 'visu-incrementer':
        const sliderCfg = config as SliderConfig | IncrementerConfig;
        return (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min</label>
                <input
                  type="number"
                  value={sliderCfg.min}
                  onChange={(e) => onUpdate({ config: { ...config, min: parseFloat(e.target.value) } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max</label>
                <input
                  type="number"
                  value={sliderCfg.max}
                  onChange={(e) => onUpdate({ config: { ...config, max: parseFloat(e.target.value) } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schritt</label>
                <input
                  type="number"
                  value={sliderCfg.step}
                  onChange={(e) => onUpdate({ config: { ...config, step: parseFloat(e.target.value) } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Standartwert</label>
              <input
                type="number"
                value={(sliderCfg as SliderConfig).defaultValue ?? sliderCfg.min}
                onChange={(e) => onUpdate({ config: { ...config, defaultValue: parseFloat(e.target.value) } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Einheit</label>
              <input
                type="text"
                value={sliderCfg.unit || ''}
                onChange={(e) => onUpdate({ config: { ...config, unit: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="8"
                max="48"
                value={(sliderCfg as { fontSize?: number }).fontSize ?? 12}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'visu-input':
        const inputCfg = config as InputConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Typ</label>
              <select
                value={inputCfg.inputType}
                onChange={(e) => onUpdate({ config: { ...config, inputType: e.target.value as 'number' | 'text' } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="number">Zahl</option>
                <option value="text">Text</option>
              </select>
            </div>
            {inputCfg.inputType === 'number' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min</label>
                  <input
                    type="number"
                    value={inputCfg.min ?? ''}
                    onChange={(e) => onUpdate({ config: { ...config, min: e.target.value ? parseFloat(e.target.value) : undefined } })}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max</label>
                  <input
                    type="number"
                    value={inputCfg.max ?? ''}
                    onChange={(e) => onUpdate({ config: { ...config, max: e.target.value ? parseFloat(e.target.value) : undefined } })}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Standartwert</label>
              <input
                type={inputCfg.inputType === 'number' ? 'number' : 'text'}
                value={inputCfg.defaultValue ?? ''}
                onChange={(e) => onUpdate({ config: { ...config, defaultValue: inputCfg.inputType === 'number' ? (e.target.value ? parseFloat(e.target.value) : undefined) : e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Einheit</label>
              <input
                type="text"
                value={inputCfg.unit || ''}
                onChange={(e) => onUpdate({ config: { ...config, unit: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="8"
                max="48"
                value={(inputCfg as { fontSize?: number }).fontSize ?? 14}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 14 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'visu-gauge':
      case 'visu-bar':
      case 'visu-tank':
      case 'visu-thermometer':
        const rangeCfg = config as GaugeConfig | BarConfig | TankConfig | ThermometerConfig;
        return (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min</label>
                <input
                  type="number"
                  value={rangeCfg.min}
                  onChange={(e) => onUpdate({ config: { ...config, min: parseFloat(e.target.value) } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max</label>
                <input
                  type="number"
                  value={rangeCfg.max}
                  onChange={(e) => onUpdate({ config: { ...config, max: parseFloat(e.target.value) } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Einheit</label>
              <input
                type="text"
                value={rangeCfg.unit || ''}
                onChange={(e) => onUpdate({ config: { ...config, unit: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rangeCfg.showValue ?? true}
                onChange={(e) => onUpdate({ config: { ...config, showValue: e.target.checked } })}
                className="rounded"
              />
              <label className="text-xs text-slate-400">Wert anzeigen</label>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="8"
                max="48"
                value={(rangeCfg as { fontSize?: number }).fontSize ?? 14}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 14 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'visu-display':
        const displayCfg = config as DisplayConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Einheit</label>
              <input
                type="text"
                value={displayCfg.unit || ''}
                onChange={(e) => onUpdate({ config: { ...config, unit: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Dezimalstellen</label>
              <input
                type="number"
                min="0"
                max="6"
                value={displayCfg.decimals ?? 1}
                onChange={(e) => onUpdate({ config: { ...config, decimals: parseInt(e.target.value) } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="12"
                max="72"
                value={displayCfg.fontSize ?? 24}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div className="border-t border-slate-700 pt-3 mt-1">
              <label className="block text-xs text-slate-500 mb-2">Bool-Texte (fuer Boolean-Werte)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Text bei True</label>
                  <input
                    type="text"
                    value={displayCfg.trueText || ''}
                    placeholder="Ein"
                    onChange={(e) => onUpdate({ config: { ...config, trueText: e.target.value } })}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Text bei False</label>
                  <input
                    type="text"
                    value={displayCfg.falseText || ''}
                    placeholder="Aus"
                    onChange={(e) => onUpdate({ config: { ...config, falseText: e.target.value } })}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  />
                </div>
              </div>
            </div>
          </>
        );

      case 'visu-led':
        const ledCfg = config as LedConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ein-Farbe</label>
              <input
                type="color"
                value={ledCfg.onColor || '#22c55e'}
                onChange={(e) => onUpdate({ config: { ...config, onColor: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aus-Farbe</label>
              <input
                type="color"
                value={ledCfg.offColor || '#374151'}
                onChange={(e) => onUpdate({ config: { ...config, offColor: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Form</label>
              <select
                value={ledCfg.shape || 'circle'}
                onChange={(e) => onUpdate({ config: { ...config, shape: e.target.value as 'circle' | 'square' } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="circle">Rund</option>
                <option value="square">Eckig</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="8"
                max="48"
                value={(ledCfg as { fontSize?: number }).fontSize ?? 12}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
          </>
        );

      case 'visu-label':
        const labelCfg = config as LabelConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Text</label>
              <input
                type="text"
                value={labelCfg.text}
                onChange={(e) => onUpdate({ config: { ...config, text: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="10"
                max="72"
                value={labelCfg.fontSize ?? 16}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ausrichtung</label>
              <select
                value={labelCfg.textAlign || 'left'}
                onChange={(e) => onUpdate({ config: { ...config, textAlign: e.target.value as 'left' | 'center' | 'right' } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="left">Links</option>
                <option value="center">Mitte</option>
                <option value="right">Rechts</option>
              </select>
            </div>
          </>
        );

      case 'visu-rect':
      case 'visu-circle': {
        const shapeCfg = config as RectConfig | CircleConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuellfarbe</label>
              <ColorPicker value={shapeCfg.fillColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ config: { ...config, fillColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenfarbe</label>
              <ColorPicker value={shapeCfg.strokeColor} defaultColor="#475569" onChange={(c) => onUpdate({ config: { ...config, strokeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenstaerke</label>
              <input type="number" min="0" max="20" value={shapeCfg.strokeWidth ?? 2} onChange={(e) => onUpdate({ config: { ...config, strokeWidth: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={shapeCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seitenwechsel (leer = kein)</label>
              <select value={shapeCfg.navigateToPageId || ''} onChange={(e) => onUpdate({ config: { ...config, navigateToPageId: e.target.value || undefined } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Kein Seitenwechsel --</option>
                {visuPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <hr className="border-slate-700" />
            <p className="text-xs text-slate-500">Farbsteuerung via Verknuepfung (Tab Verknuepfung):</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aktiv-Farbe (Wert = true/1)</label>
              <ColorPicker value={shapeCfg.activeColor} defaultColor="#22c55e" onChange={(c) => onUpdate({ config: { ...config, activeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Inaktiv-Farbe (Wert = false/0)</label>
              <ColorPicker value={shapeCfg.inactiveColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ config: { ...config, inactiveColor: c } })} />
            </div>
          </>
        );
      }

      case 'visu-line':
      case 'visu-arrow': {
        const lineCfg = config as LineConfig | ArrowConfig;
        const isArrow = widget.type === 'visu-arrow';
        const arrowCfg = config as ArrowConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Farbe</label>
              <ColorPicker value={lineCfg.strokeColor} defaultColor="#64748b" onChange={(c) => onUpdate({ config: { ...config, strokeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Linienstaerke</label>
              <input type="number" min="1" max="20" value={lineCfg.strokeWidth ?? 2} onChange={(e) => onUpdate({ config: { ...config, strokeWidth: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Winkel (Grad, 0 = waagerecht)</label>
              <input type="number" min="-180" max="180" value={lineCfg.angle ?? 0} onChange={(e) => onUpdate({ config: { ...config, angle: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            {isArrow && (
              <>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={arrowCfg.arrowEnd ?? true} onChange={(e) => onUpdate({ config: { ...config, arrowEnd: e.target.checked } })} />
                  <label className="text-xs text-slate-400">Pfeilspitze Ende</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={arrowCfg.arrowStart ?? false} onChange={(e) => onUpdate({ config: { ...config, arrowStart: e.target.checked } })} />
                  <label className="text-xs text-slate-400">Pfeilspitze Anfang</label>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={lineCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seitenwechsel (leer = kein)</label>
              <select value={lineCfg.navigateToPageId || ''} onChange={(e) => onUpdate({ config: { ...config, navigateToPageId: e.target.value || undefined } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Kein Seitenwechsel --</option>
                {visuPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <hr className="border-slate-700" />
            <p className="text-xs text-slate-500">Farbsteuerung via Verknuepfung:</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aktiv-Farbe (Wert = true/1)</label>
              <ColorPicker value={lineCfg.activeColor} defaultColor="#22c55e" onChange={(c) => onUpdate({ config: { ...config, activeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Inaktiv-Farbe (Wert = false/0)</label>
              <ColorPicker value={lineCfg.inactiveColor} defaultColor="#64748b" onChange={(c) => onUpdate({ config: { ...config, inactiveColor: c } })} />
            </div>
          </>
        );
      }

      case 'visu-polygon': {
        const pCfg = config as PolygonConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ecken (3-12)</label>
              <input type="number" min="3" max="12" value={pCfg.sides ?? 6} onChange={(e) => onUpdate({ config: { ...config, sides: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuellfarbe</label>
              <ColorPicker value={pCfg.fillColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ config: { ...config, fillColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenfarbe</label>
              <ColorPicker value={pCfg.strokeColor} defaultColor="#475569" onChange={(c) => onUpdate({ config: { ...config, strokeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenstaerke</label>
              <input type="number" min="0" max="20" value={pCfg.strokeWidth ?? 2} onChange={(e) => onUpdate({ config: { ...config, strokeWidth: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={pCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seitenwechsel (leer = kein)</label>
              <select value={pCfg.navigateToPageId || ''} onChange={(e) => onUpdate({ config: { ...config, navigateToPageId: e.target.value || undefined } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Kein Seitenwechsel --</option>
                {visuPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <hr className="border-slate-700" />
            <p className="text-xs text-slate-500">Farbsteuerung via Verknuepfung:</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aktiv-Farbe</label>
              <ColorPicker value={pCfg.activeColor} defaultColor="#22c55e" onChange={(c) => onUpdate({ config: { ...config, activeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Inaktiv-Farbe</label>
              <ColorPicker value={pCfg.inactiveColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ config: { ...config, inactiveColor: c } })} />
            </div>
          </>
        );
      }

      case 'visu-star': {
        const sCfg = config as StarConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Spitzen (3-12)</label>
              <input type="number" min="3" max="12" value={sCfg.points ?? 5} onChange={(e) => onUpdate({ config: { ...config, points: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Innenradius (0.1-0.9)</label>
              <input type="number" min="0.1" max="0.9" step="0.05" value={sCfg.innerRadiusRatio ?? 0.4} onChange={(e) => onUpdate({ config: { ...config, innerRadiusRatio: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuellfarbe</label>
              <ColorPicker value={sCfg.fillColor} defaultColor="#eab308" onChange={(c) => onUpdate({ config: { ...config, fillColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenfarbe</label>
              <ColorPicker value={sCfg.strokeColor} defaultColor="#ca8a04" onChange={(c) => onUpdate({ config: { ...config, strokeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={sCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seitenwechsel (leer = kein)</label>
              <select value={sCfg.navigateToPageId || ''} onChange={(e) => onUpdate({ config: { ...config, navigateToPageId: e.target.value || undefined } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Kein Seitenwechsel --</option>
                {visuPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">Farbsteuerung via Verknuepfung:</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aktiv-Farbe</label>
              <ColorPicker value={sCfg.activeColor} defaultColor="#22c55e" onChange={(c) => onUpdate({ config: { ...config, activeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Inaktiv-Farbe</label>
              <ColorPicker value={sCfg.inactiveColor} defaultColor="#eab308" onChange={(c) => onUpdate({ config: { ...config, inactiveColor: c } })} />
            </div>
          </>
        );
      }

      case 'visu-diamond': {
        const dCfg = config as DiamondConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuellfarbe</label>
              <ColorPicker value={dCfg.fillColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ config: { ...config, fillColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenfarbe</label>
              <ColorPicker value={dCfg.strokeColor} defaultColor="#475569" onChange={(c) => onUpdate({ config: { ...config, strokeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenstaerke</label>
              <input type="number" min="0" max="20" value={dCfg.strokeWidth ?? 2} onChange={(e) => onUpdate({ config: { ...config, strokeWidth: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={dCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seitenwechsel (leer = kein)</label>
              <select value={dCfg.navigateToPageId || ''} onChange={(e) => onUpdate({ config: { ...config, navigateToPageId: e.target.value || undefined } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Kein Seitenwechsel --</option>
                {visuPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">Farbsteuerung via Verknuepfung:</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aktiv-Farbe</label>
              <ColorPicker value={dCfg.activeColor} defaultColor="#22c55e" onChange={(c) => onUpdate({ config: { ...config, activeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Inaktiv-Farbe</label>
              <ColorPicker value={dCfg.inactiveColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ config: { ...config, inactiveColor: c } })} />
            </div>
          </>
        );
      }

      case 'visu-cross': {
        const xCfg = config as CrossConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Armbreite (0.1-0.8)</label>
              <input type="number" min="0.1" max="0.8" step="0.05" value={xCfg.armWidth ?? 0.3} onChange={(e) => onUpdate({ config: { ...config, armWidth: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuellfarbe</label>
              <ColorPicker value={xCfg.fillColor} defaultColor="#475569" onChange={(c) => onUpdate({ config: { ...config, fillColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={xCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seitenwechsel (leer = kein)</label>
              <select value={xCfg.navigateToPageId || ''} onChange={(e) => onUpdate({ config: { ...config, navigateToPageId: e.target.value || undefined } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Kein Seitenwechsel --</option>
                {visuPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">Farbsteuerung via Verknuepfung:</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aktiv-Farbe</label>
              <ColorPicker value={xCfg.activeColor} defaultColor="#22c55e" onChange={(c) => onUpdate({ config: { ...config, activeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Inaktiv-Farbe</label>
              <ColorPicker value={xCfg.inactiveColor} defaultColor="#475569" onChange={(c) => onUpdate({ config: { ...config, inactiveColor: c } })} />
            </div>
          </>
        );
      }

      case 'visu-polyline': {
        const plCfg = config as PolylineConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Linienfarbe</label>
              <ColorPicker value={plCfg.strokeColor} defaultColor="#64748b" onChange={(c) => onUpdate({ config: { ...config, strokeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Linienstaerke</label>
              <input type="number" min="1" max="20" value={plCfg.strokeWidth ?? 2} onChange={(e) => onUpdate({ config: { ...config, strokeWidth: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuellfarbe</label>
              <ColorPicker value={plCfg.fillColor === 'transparent' ? undefined : plCfg.fillColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ config: { ...config, fillColor: c || 'transparent' } })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={plCfg.closed ?? false} onChange={(e) => onUpdate({ config: { ...config, closed: e.target.checked } })} className="rounded" />
              <label className="text-xs text-slate-400">Geschlossen (Polygon)</label>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={plCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Punkte ({plCfg.points?.length ?? 0})</label>
              <p className="text-xs text-slate-500">Im Bearbeitungsmodus die blauen Punkte ziehen.</p>
              <button
                className="mt-1 w-full px-2 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300"
                onClick={() => {
                  const pts = plCfg.points || [];
                  const newPt = pts.length > 0 ? { x: pts[pts.length - 1].x + 40, y: pts[pts.length - 1].y } : { x: 20, y: 20 };
                  onUpdate({ config: { ...config, points: [...pts, newPt] } });
                }}
              >
                + Punkt hinzufuegen
              </button>
              {plCfg.points?.length > 2 && (
                <button
                  className="mt-1 w-full px-2 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-red-400"
                  onClick={() => onUpdate({ config: { ...config, points: plCfg.points.slice(0, -1) } })}
                >
                  - Letzten Punkt loeschen
                </button>
              )}
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Seitenwechsel (leer = kein)</label>
              <select value={plCfg.navigateToPageId || ''} onChange={(e) => onUpdate({ config: { ...config, navigateToPageId: e.target.value || undefined } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Kein Seitenwechsel --</option>
                {visuPages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1">Farbsteuerung via Verknuepfung:</p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Aktiv-Farbe</label>
              <ColorPicker value={plCfg.activeColor} defaultColor="#22c55e" onChange={(c) => onUpdate({ config: { ...config, activeColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Inaktiv-Farbe</label>
              <ColorPicker value={plCfg.inactiveColor} defaultColor="#475569" onChange={(c) => onUpdate({ config: { ...config, inactiveColor: c } })} />
            </div>
          </>
        );
      }

      case 'visu-nav-button': {
        const navCfg = config as NavButtonConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Label</label>
              <input type="text" value={navCfg.label || ''} onChange={(e) => onUpdate({ config: { ...config, label: e.target.value } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Zielseite</label>
              <select value={navCfg.targetPageId || ''} onChange={(e) => onUpdate({ config: { ...config, targetPageId: e.target.value } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="">-- Seite waehlen --</option>
                {visuPages.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Farbe</label>
              <ColorPicker value={navCfg.color} defaultColor="#3b82f6" onChange={(c) => onUpdate({ config: { ...config, color: c } })} />
            </div>
          </>
        );
      }

      case 'visu-home-button': {
        const homeCfg = config as HomeButtonConfig & { homePageId?: string };
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Label</label>
              <input type="text" value={homeCfg.label || 'Home'} onChange={(e) => onUpdate({ config: { ...config, label: e.target.value } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Startseite (leer = erste Seite)</label>
              <select
                value={(homeCfg as { homePageId?: string }).homePageId || ''}
                onChange={(e) => onUpdate({ config: { ...config, homePageId: e.target.value || undefined } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="">-- Erste Seite (Standard) --</option>
                {visuPages.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Farbe</label>
              <ColorPicker value={homeCfg.color} defaultColor="#10b981" onChange={(c) => onUpdate({ config: { ...config, color: c } })} />
            </div>
          </>
        );
      }

      case 'visu-back-button': {
        const backCfg = config as BackButtonConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Label</label>
              <input type="text" value={backCfg.label || 'Zurueck'} onChange={(e) => onUpdate({ config: { ...config, label: e.target.value } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Farbe</label>
              <ColorPicker value={backCfg.color} defaultColor="#64748b" onChange={(c) => onUpdate({ config: { ...config, color: c } })} />
            </div>
          </>
        );
      }

      case 'visu-multistate': {
        const msCfg = config as MultistateConfig;
        const options: MultistateOption[] = msCfg.options || [];
        return (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">Zustande</label>
                <button
                  onClick={() => {
                    const newOptions = [...options, { value: options.length, label: `Zustand ${options.length + 1}`, color: '#3b82f6' }];
                    onUpdate({ config: { ...config, options: newOptions } });
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Hinzufuegen
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 p-2 bg-slate-800 rounded border border-slate-700">
                    <input
                      type="color"
                      value={opt.color || '#3b82f6'}
                      onChange={(e) => {
                        const updated = options.map((o, i) => i === idx ? { ...o, color: e.target.value } : o);
                        onUpdate({ config: { ...config, options: updated } });
                      }}
                      className="w-6 h-6 rounded cursor-pointer flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={opt.label}
                      placeholder="Label"
                      onChange={(e) => {
                        const updated = options.map((o, i) => i === idx ? { ...o, label: e.target.value } : o);
                        onUpdate({ config: { ...config, options: updated } });
                      }}
                      className="flex-1 min-w-0 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      value={String(opt.value)}
                      placeholder="Wert"
                      onChange={(e) => {
                        const v = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                        const updated = options.map((o, i) => i === idx ? { ...o, value: v } : o);
                        onUpdate({ config: { ...config, options: updated } });
                      }}
                      className="w-14 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200"
                    />
                    <button
                      onClick={() => {
                        const updated = options.filter((_, i) => i !== idx);
                        onUpdate({ config: { ...config, options: updated } });
                      }}
                      className="text-red-400 hover:text-red-300 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Standardwert</label>
              <select
                value={String(msCfg.defaultValue ?? '')}
                onChange={(e) => {
                  const v = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                  onUpdate({ config: { ...config, defaultValue: v } });
                }}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="">-- Kein Standard --</option>
                {options.map((o, i) => (
                  <option key={i} value={String(o.value)}>{o.label} ({String(o.value)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                min="8"
                max="48"
                value={(msCfg as { fontSize?: number }).fontSize ?? 14}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 14 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
          </>
        );
      }

      case 'visu-frame': {
        const frCfg = config as import('../../types/visualization').FrameConfig;
        const items = frCfg.items || [];
        const iconOptions = ['Home', 'LayoutDashboard', 'Settings', 'Activity', 'Zap', 'Thermometer', 'BarChart2', 'Cpu', 'Globe', 'Bell', 'FileText', 'Layers', 'Monitor', 'Wind', 'Droplets', 'Sun', 'Power', 'Map'];
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Titel</label>
              <input type="text" value={frCfg.title || ''} onChange={(e) => onUpdate({ config: { ...frCfg, title: e.target.value } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Akzentfarbe</label>
                <ColorPicker value={frCfg.accentColor} defaultColor="#3b82f6" onChange={(c) => onUpdate({ config: { ...frCfg, accentColor: c } })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hintergrund</label>
                <ColorPicker value={frCfg.backgroundColor} defaultColor="#0f172a" onChange={(c) => onUpdate({ config: { ...frCfg, backgroundColor: c } })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Textfarbe</label>
                <ColorPicker value={frCfg.textColor} defaultColor="#e2e8f0" onChange={(c) => onUpdate({ config: { ...frCfg, textColor: c } })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Position</label>
                <select value={frCfg.position || 'left'} onChange={(e) => onUpdate({ config: { ...frCfg, position: e.target.value as 'left' | 'right' | 'top' | 'bottom' } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                  <option value="left">Links</option>
                  <option value="right">Rechts</option>
                  <option value="top">Oben</option>
                  <option value="bottom">Unten</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={frCfg.collapsible !== false} onChange={(e) => onUpdate({ config: { ...frCfg, collapsible: e.target.checked } })} className="rounded" />
              <label className="text-xs text-slate-400">Einklappbar</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={frCfg.defaultCollapsed ?? false} onChange={(e) => onUpdate({ config: { ...frCfg, defaultCollapsed: e.target.checked } })} className="rounded" />
              <label className="text-xs text-slate-400">Standardmaessig eingeklappt</label>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">Eintraege</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const newItem: import('../../types/visualization').FrameItem = { id: `section-${Date.now()}`, type: 'section', label: 'Abschnitt' };
                      onUpdate({ config: { ...frCfg, items: [...items, newItem] } });
                    }}
                    className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                    title="Abschnitt hinzufuegen"
                  >
                    + Abschnitt
                  </button>
                  <button
                    onClick={() => {
                      const newItem: import('../../types/visualization').FrameItem = { id: `btn-${Date.now()}`, type: 'nav-button', label: 'Neue Seite', icon: 'Home', targetPageId: '' };
                      onUpdate({ config: { ...frCfg, items: [...items, newItem] } });
                    }}
                    className="px-2 py-0.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 rounded transition-colors"
                    title="Button hinzufuegen"
                  >
                    + Button
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className={`p-2 rounded border ${item.type === 'section' ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-800 border-slate-700'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] text-slate-500 uppercase">{item.type === 'section' ? 'Abschnitt' : 'Button'}</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => onUpdate({ config: { ...frCfg, items: items.filter((_, i) => i !== idx) } })}
                        className="text-red-400 hover:text-red-300 text-xs px-1"
                        title="Entfernen"
                      >
                        ×
                      </button>
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            const arr = [...items];
                            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                            onUpdate({ config: { ...frCfg, items: arr } });
                          }}
                          className="text-slate-400 hover:text-slate-200 text-xs px-1"
                          title="Nach oben"
                        >
                          ↑
                        </button>
                      )}
                      {idx < items.length - 1 && (
                        <button
                          onClick={() => {
                            const arr = [...items];
                            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                            onUpdate({ config: { ...frCfg, items: arr } });
                          }}
                          className="text-slate-400 hover:text-slate-200 text-xs px-1"
                          title="Nach unten"
                        >
                          ↓
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={item.label}
                      placeholder="Label"
                      onChange={(e) => {
                        const updated = items.map((it, i) => i === idx ? { ...it, label: e.target.value } : it);
                        onUpdate({ config: { ...frCfg, items: updated } });
                      }}
                      className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 mb-1"
                    />
                    {item.type === 'nav-button' && (
                      <>
                        <div className="grid grid-cols-2 gap-1">
                          <select
                            value={item.icon || ''}
                            onChange={(e) => {
                              const updated = items.map((it, i) => i === idx ? { ...it, icon: e.target.value } : it);
                              onUpdate({ config: { ...frCfg, items: updated } });
                            }}
                            className="px-1 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200"
                          >
                            <option value="">Kein Icon</option>
                            {iconOptions.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                          </select>
                          <select
                            value={item.targetPageId || ''}
                            onChange={(e) => {
                              const updated = items.map((it, i) => i === idx ? { ...it, targetPageId: e.target.value } : it);
                              onUpdate({ config: { ...frCfg, items: updated } });
                            }}
                            className="px-1 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200"
                          >
                            <option value="">-- Seite --</option>
                            {(visuPages || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      }

      case 'visu-image': {
        const imgCfg = config as ImageConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bild</label>
              {imgCfg.imageUrl ? (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden bg-slate-800" style={{ aspectRatio: '16/9' }}>
                    <img src={imgCfg.imageUrl} alt="Vorschau" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowImagePicker(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Anderes Bild
                    </button>
                    <button
                      onClick={() => onUpdate({ config: { ...imgCfg, imageUrl: undefined, storagePath: undefined } })}
                      className="px-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-400 text-xs rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowImagePicker(true)}
                  className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                >
                  <FolderOpen className="w-6 h-6" />
                  <span className="text-xs">Bild aus Dateimanager auswaehlen</span>
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Darstellung</label>
              <select value={imgCfg.objectFit || 'contain'} onChange={(e) => onUpdate({ config: { ...imgCfg, objectFit: e.target.value as ImageConfig['objectFit'] } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200">
                <option value="contain">Einpassen (contain)</option>
                <option value="cover">Ausfuellen (cover)</option>
                <option value="fill">Strecken (fill)</option>
                <option value="none">Original (none)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.05" value={imgCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...imgCfg, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Eckenradius (px)</label>
              <input type="number" min="0" max="200" value={imgCfg.borderRadius ?? 0} onChange={(e) => onUpdate({ config: { ...imgCfg, borderRadius: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            {showImagePicker && (
              <FileManager
                apiBase={getApiBase()}
                pickerMode
                onSelectImage={(url) => {
                  onUpdate({ config: { ...imgCfg, imageUrl: url, storagePath: url } });
                  setShowImagePicker(false);
                }}
                onClose={() => setShowImagePicker(false)}
              />
            )}
          </>
        );
      }

      case 'visu-pump': {
        const pumpCfg = config as { pumpName?: string; runningColor?: string; stoppedColor?: string; faultColor?: string; revisionColor?: string; orientation?: 'up' | 'down' | 'left' | 'right'; symbolType?: string; widgetSize?: string; labelPosition?: string; fontSize?: number; fontFamily?: string };
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Symbol</label>
              <select
                value={pumpCfg.symbolType || 'pump'}
                onChange={(e) => onUpdate({ config: { ...config, symbolType: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {SYMBOL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bildgroesse</label>
              <select
                value={pumpCfg.widgetSize || 'medium'}
                onChange={(e) => onUpdate({ config: { ...config, widgetSize: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {WIDGET_SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name (leer = vom Baustein)</label>
              <input
                type="text"
                value={pumpCfg.pumpName || ''}
                placeholder="Name vom verknuepften Baustein"
                onChange={(e) => onUpdate({ config: { ...config, pumpName: e.target.value || undefined } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ausrichtung</label>
              <select
                value={pumpCfg.orientation || 'right'}
                onChange={(e) => onUpdate({ config: { ...config, orientation: e.target.value as 'up' | 'down' | 'left' | 'right' } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="right">Nach rechts</option>
                <option value="left">Nach links</option>
                <option value="up">Nach oben</option>
                <option value="down">Nach unten</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Text-Position</label>
              <select
                value={pumpCfg.labelPosition || 'bottom'}
                onChange={(e) => onUpdate({ config: { ...config, labelPosition: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {LABEL_POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={pumpCfg.fontSize ?? 12}
                  onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftart</label>
                <select
                  value={pumpCfg.fontFamily || 'system'}
                  onChange={(e) => onUpdate({ config: { ...config, fontFamily: e.target.value } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                >
                  {FONT_FAMILY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Laufend</label>
                <input
                  type="color"
                  value={pumpCfg.runningColor || '#22c55e'}
                  onChange={(e) => onUpdate({ config: { ...config, runningColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Gestoppt</label>
                <input
                  type="color"
                  value={pumpCfg.stoppedColor || '#64748b'}
                  onChange={(e) => onUpdate({ config: { ...config, stoppedColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Stoerung</label>
                <input
                  type="color"
                  value={pumpCfg.faultColor || '#ef4444'}
                  onChange={(e) => onUpdate({ config: { ...config, faultColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Revision</label>
                <input
                  type="color"
                  value={pumpCfg.revisionColor || '#f59e0b'}
                  onChange={(e) => onUpdate({ config: { ...config, revisionColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
          </>
        );
      }

      case 'visu-valve': {
        const valveCfg = config as { valveName?: string; normalColor?: string; alarmColor?: string; rotation?: number; symbolType?: string; showSetpoint?: boolean; showFeedback?: boolean; showOutput?: boolean; widgetSize?: string; labelPosition?: string; fontSize?: number; fontFamily?: string };
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Symbol</label>
              <select
                value={valveCfg.symbolType || 'valve-2way'}
                onChange={(e) => onUpdate({ config: { ...config, symbolType: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {VALVE_SYMBOL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bildgroesse</label>
              <select
                value={valveCfg.widgetSize || 'medium'}
                onChange={(e) => onUpdate({ config: { ...config, widgetSize: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {WIDGET_SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name (leer = vom Baustein)</label>
              <input
                type="text"
                value={valveCfg.valveName || ''}
                placeholder="Name vom verknuepften Baustein"
                onChange={(e) => onUpdate({ config: { ...config, valveName: e.target.value || undefined } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Drehung</label>
              <select
                value={valveCfg.rotation ?? 0}
                onChange={(e) => onUpdate({ config: { ...config, rotation: parseInt(e.target.value) as 0 | 90 | 180 | 270 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {ROTATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Text-Position</label>
              <select
                value={valveCfg.labelPosition || 'bottom'}
                onChange={(e) => onUpdate({ config: { ...config, labelPosition: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {LABEL_POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={valveCfg.fontSize ?? 12}
                  onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftart</label>
                <select
                  value={valveCfg.fontFamily || 'system'}
                  onChange={(e) => onUpdate({ config: { ...config, fontFamily: e.target.value } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                >
                  {FONT_FAMILY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Normal</label>
                <input
                  type="color"
                  value={valveCfg.normalColor || '#22c55e'}
                  onChange={(e) => onUpdate({ config: { ...config, normalColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarm</label>
                <input
                  type="color"
                  value={valveCfg.alarmColor || '#ef4444'}
                  onChange={(e) => onUpdate({ config: { ...config, alarmColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="block text-xs text-slate-500">Anzeige-Optionen</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={valveCfg.showSetpoint !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showSetpoint: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Sollwert anzeigen</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={valveCfg.showFeedback !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showFeedback: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Istwert anzeigen</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={valveCfg.showOutput !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showOutput: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Stellwert anzeigen</label>
              </div>
            </div>
          </>
        );
      }

      case 'visu-sensor': {
        const sensorCfg = config as { sensorName?: string; normalColor?: string; alarmColor?: string; rotation?: number; symbolType?: string; showValue?: boolean; showUnit?: boolean; showLimits?: boolean; widgetSize?: string; labelPosition?: string; fontSize?: number; fontFamily?: string };
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Symbol</label>
              <select
                value={sensorCfg.symbolType || 'temperature'}
                onChange={(e) => onUpdate({ config: { ...config, symbolType: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {SENSOR_SYMBOL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bildgroesse</label>
              <select
                value={sensorCfg.widgetSize || 'medium'}
                onChange={(e) => onUpdate({ config: { ...config, widgetSize: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {WIDGET_SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name (leer = vom Baustein)</label>
              <input
                type="text"
                value={sensorCfg.sensorName || ''}
                placeholder="Name vom verknuepften Baustein"
                onChange={(e) => onUpdate({ config: { ...config, sensorName: e.target.value || undefined } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Drehung</label>
              <select
                value={sensorCfg.rotation ?? 0}
                onChange={(e) => onUpdate({ config: { ...config, rotation: parseInt(e.target.value) as 0 | 90 | 180 | 270 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {ROTATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Text-Position</label>
              <select
                value={sensorCfg.labelPosition || 'bottom'}
                onChange={(e) => onUpdate({ config: { ...config, labelPosition: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {LABEL_POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={sensorCfg.fontSize ?? 12}
                  onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftart</label>
                <select
                  value={sensorCfg.fontFamily || 'system'}
                  onChange={(e) => onUpdate({ config: { ...config, fontFamily: e.target.value } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                >
                  {FONT_FAMILY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Normal</label>
                <input
                  type="color"
                  value={sensorCfg.normalColor || '#0891b2'}
                  onChange={(e) => onUpdate({ config: { ...config, normalColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alarm</label>
                <input
                  type="color"
                  value={sensorCfg.alarmColor || '#ef4444'}
                  onChange={(e) => onUpdate({ config: { ...config, alarmColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="block text-xs text-slate-500">Anzeige-Optionen</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sensorCfg.showValue !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showValue: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Messwert anzeigen</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sensorCfg.showUnit !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showUnit: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Einheit anzeigen</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sensorCfg.showLimits !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showLimits: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Grenzwerte anzeigen</label>
              </div>
            </div>
          </>
        );
      }

      case 'visu-pid': {
        const pidCfg = config as { pidName?: string; normalColor?: string; activeColor?: string; rotation?: number; symbolType?: string; showSetpoint?: boolean; showActualValue?: boolean; showOutput?: boolean; widgetSize?: string; labelPosition?: string; fontSize?: number; fontFamily?: string };
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Symbol</label>
              <select
                value={pidCfg.symbolType || 'pid'}
                onChange={(e) => onUpdate({ config: { ...config, symbolType: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {PID_SYMBOL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bildgroesse</label>
              <select
                value={pidCfg.widgetSize || 'medium'}
                onChange={(e) => onUpdate({ config: { ...config, widgetSize: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {WIDGET_SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name (leer = vom Baustein)</label>
              <input
                type="text"
                value={pidCfg.pidName || ''}
                placeholder="Name vom verknuepften Baustein"
                onChange={(e) => onUpdate({ config: { ...config, pidName: e.target.value || undefined } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Drehung</label>
              <select
                value={pidCfg.rotation ?? 0}
                onChange={(e) => onUpdate({ config: { ...config, rotation: parseInt(e.target.value) as 0 | 90 | 180 | 270 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {ROTATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Text-Position</label>
              <select
                value={pidCfg.labelPosition || 'bottom'}
                onChange={(e) => onUpdate({ config: { ...config, labelPosition: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {LABEL_POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={pidCfg.fontSize ?? 12}
                  onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftart</label>
                <select
                  value={pidCfg.fontFamily || 'system'}
                  onChange={(e) => onUpdate({ config: { ...config, fontFamily: e.target.value } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                >
                  {FONT_FAMILY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Inaktiv</label>
                <input
                  type="color"
                  value={pidCfg.normalColor || '#64748b'}
                  onChange={(e) => onUpdate({ config: { ...config, normalColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Aktiv</label>
                <input
                  type="color"
                  value={pidCfg.activeColor || '#22c55e'}
                  onChange={(e) => onUpdate({ config: { ...config, activeColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="block text-xs text-slate-500">Anzeige-Optionen</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pidCfg.showSetpoint !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showSetpoint: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Sollwert anzeigen</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pidCfg.showActualValue !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showActualValue: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Istwert anzeigen</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pidCfg.showOutput !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showOutput: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Stellgroesse anzeigen</label>
              </div>
            </div>
          </>
        );
      }

      case 'visu-heating-curve': {
        const hcCfg = config as { hcName?: string; normalColor?: string; activeColor?: string; rotation?: number; showInput?: boolean; showOutput?: boolean; widgetSize?: string; labelPosition?: string; fontSize?: number; fontFamily?: string };
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bildgroesse</label>
              <select
                value={hcCfg.widgetSize || 'medium'}
                onChange={(e) => onUpdate({ config: { ...config, widgetSize: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {WIDGET_SIZE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name (leer = vom Baustein)</label>
              <input
                type="text"
                value={hcCfg.hcName || ''}
                placeholder="Name vom verknuepften Baustein"
                onChange={(e) => onUpdate({ config: { ...config, hcName: e.target.value || undefined } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Drehung</label>
              <select
                value={hcCfg.rotation ?? 0}
                onChange={(e) => onUpdate({ config: { ...config, rotation: parseInt(e.target.value) as 0 | 90 | 180 | 270 } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {ROTATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Text-Position</label>
              <select
                value={hcCfg.labelPosition || 'bottom'}
                onChange={(e) => onUpdate({ config: { ...config, labelPosition: e.target.value } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {LABEL_POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={hcCfg.fontSize ?? 12}
                  onChange={(e) => onUpdate({ config: { ...config, fontSize: parseInt(e.target.value) || 12 } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftart</label>
                <select
                  value={hcCfg.fontFamily || 'system'}
                  onChange={(e) => onUpdate({ config: { ...config, fontFamily: e.target.value } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                >
                  {FONT_FAMILY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Inaktiv</label>
                <input
                  type="color"
                  value={hcCfg.normalColor || '#64748b'}
                  onChange={(e) => onUpdate({ config: { ...config, normalColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Aktiv</label>
                <input
                  type="color"
                  value={hcCfg.activeColor || '#f97316'}
                  onChange={(e) => onUpdate({ config: { ...config, activeColor: e.target.value } })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="block text-xs text-slate-500">Anzeige-Optionen</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hcCfg.showInput !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showInput: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Eingang anzeigen</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hcCfg.showOutput !== false}
                  onChange={(e) => onUpdate({ config: { ...config, showOutput: e.target.checked } })}
                  className="rounded"
                />
                <label className="text-xs text-slate-400">Ausgang anzeigen</label>
              </div>
            </div>
          </>
        );
      }

      case 'visu-alarm-console': {
        const acCfg = config as AlarmConsoleWidgetConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Alarmkonsole</label>
              <select
                value={acCfg.consoleId || ''}
                onChange={(e) => onUpdate({ config: { ...config, consoleId: e.target.value || undefined } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="">-- Auswahl --</option>
                {alarmConsoles.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max. sichtbare Alarme</label>
              <input
                type="number"
                value={acCfg.maxVisibleAlarms ?? 10}
                onChange={(e) => onUpdate({ config: { ...config, maxVisibleAlarms: Number(e.target.value) || 10 } })}
                min={1}
                max={100}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
              <input
                type="number"
                value={acCfg.fontSize ?? 12}
                onChange={(e) => onUpdate({ config: { ...config, fontSize: Number(e.target.value) || 12 } })}
                min={8}
                max={24}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="block text-xs text-slate-500 font-medium">Anzeige-Optionen</label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showAcknowledgeButton !== false}
                    onChange={(e) => onUpdate({ config: { ...config, showAcknowledgeButton: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Quittieren
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showClearButton !== false}
                    onChange={(e) => onUpdate({ config: { ...config, showClearButton: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Loeschen
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showTimestamp !== false}
                    onChange={(e) => onUpdate({ config: { ...config, showTimestamp: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Zeitstempel
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showSource !== false}
                    onChange={(e) => onUpdate({ config: { ...config, showSource: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Quelle
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showValue === true}
                    onChange={(e) => onUpdate({ config: { ...config, showValue: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Wert
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showPriority === true}
                    onChange={(e) => onUpdate({ config: { ...config, showPriority: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Prioritaet
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showAlarmClass === true}
                    onChange={(e) => onUpdate({ config: { ...config, showAlarmClass: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Alarmklasse
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showDuration === true}
                    onChange={(e) => onUpdate({ config: { ...config, showDuration: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Dauer
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showOccurrenceCount === true}
                    onChange={(e) => onUpdate({ config: { ...config, showOccurrenceCount: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Anzahl
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.showStatistics === true}
                    onChange={(e) => onUpdate({ config: { ...config, showStatistics: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Statistik
                </label>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="block text-xs text-slate-500 font-medium">Funktionen</label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.enableFiltering === true}
                    onChange={(e) => onUpdate({ config: { ...config, enableFiltering: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Filterung
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.enableSorting === true}
                    onChange={(e) => onUpdate({ config: { ...config, enableSorting: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Sortierung
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.enableAcknowledgeAll === true}
                    onChange={(e) => onUpdate({ config: { ...config, enableAcknowledgeAll: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Alle quittieren
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.enableShelving === true}
                    onChange={(e) => onUpdate({ config: { ...config, enableShelving: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Unterdruecken
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.blinkUnacknowledged === true}
                    onChange={(e) => onUpdate({ config: { ...config, blinkUnacknowledged: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Blinken
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acCfg.compactMode === true}
                    onChange={(e) => onUpdate({ config: { ...config, compactMode: e.target.checked } })}
                    className="rounded w-3 h-3"
                  />
                  Kompakt
                </label>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="block text-xs text-slate-500 font-medium">Standard-Sortierung</label>
              <div className="flex gap-2">
                <select
                  value={acCfg.defaultSortBy || 'priority'}
                  onChange={(e) => onUpdate({ config: { ...config, defaultSortBy: e.target.value as 'time' | 'priority' | 'state' | 'source' } })}
                  className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-[10px] text-slate-200"
                >
                  <option value="priority">Prioritaet</option>
                  <option value="time">Zeit</option>
                  <option value="state">Status</option>
                  <option value="source">Quelle</option>
                </select>
                <select
                  value={acCfg.defaultSortDirection || 'asc'}
                  onChange={(e) => onUpdate({ config: { ...config, defaultSortDirection: e.target.value as 'asc' | 'desc' } })}
                  className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-[10px] text-slate-200"
                >
                  <option value="asc">Aufst.</option>
                  <option value="desc">Abst.</option>
                </select>
              </div>
            </div>
          </>
        );
      }

      case 'visu-trend-chart': {
        const tcCfg = config as TrendChartConfig;
        const TREND_COLORS = ['#38bdf8','#34d399','#fb923c','#f472b6','#facc15','#f87171','#4ade80','#60a5fa','#c084fc','#fbbf24'];
        const CHART_TYPES: { value: TrendChartType; label: string }[] = [
          { value: 'line', label: 'Linie' },
          { value: 'area', label: 'Flache (Area)' },
          { value: 'stepped', label: 'Stufen' },
          { value: 'bar', label: 'Balken' },
          { value: 'scatter', label: 'Punkte (Scatter)' },
        ];
        const TIME_RANGES = [
          { value: '5min', label: '5 Minuten' },
          { value: '15min', label: '15 Minuten' },
          { value: '30min', label: '30 Minuten' },
          { value: '1h', label: '1 Stunde' },
          { value: '6h', label: '6 Stunden' },
          { value: '12h', label: '12 Stunden' },
          { value: '24h', label: '24 Stunden' },
          { value: '7d', label: '7 Tage' },
          { value: '30d', label: '30 Tage' },
          { value: 'custom', label: 'Benutzerdefiniert' },
        ];

        const updateSeries = (idx: number, updates: Partial<TrendSeries>) => {
          const updated = tcCfg.series.map((s, i) => i === idx ? { ...s, ...updates } : s);
          onUpdate({ config: { ...tcCfg, series: updated } });
        };

        const removeSeries = (idx: number) => {
          onUpdate({ config: { ...tcCfg, series: tcCfg.series.filter((_, i) => i !== idx) } });
        };

        const alreadyAdded = new Set(tcCfg.series.map(s => s.nodeId));
        const availableTrends = trackedTrends.filter(t => !alreadyAdded.has(t.nodeId));

        const addFromTrend = (trend: TrackedTrend) => {
          const newSeries: TrendSeries = {
            nodeId: trend.nodeId,
            label: trend.label,
            color: trend.color,
            unit: trend.unit,
            visible: true,
            chartType: tcCfg.chartType,
          };
          onUpdate({ config: { ...tcCfg, series: [...tcCfg.series, newSeries] } });
        };

        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">Trends</label>
              </div>
              {trackedTrends.length === 0 && (
                <p className="text-[10px] text-slate-500 italic">Keine Trends konfiguriert. Zuerst in der Trend-Ansicht Datenpunkte hinzufügen.</p>
              )}
              {trackedTrends.length > 0 && availableTrends.length === 0 && tcCfg.series.length > 0 && (
                <p className="text-[10px] text-slate-500 italic">Alle konfigurierten Trends wurden bereits hinzugefügt.</p>
              )}
              {availableTrends.map(trend => (
                <button
                  key={trend.nodeId}
                  onClick={() => addFromTrend(trend)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors text-left"
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: trend.color }} />
                  <span className="flex-1 truncate">{trend.label}</span>
                  {trend.unit && <span className="text-slate-500 text-[10px]">{trend.unit}</span>}
                  <Plus className="w-3 h-3 text-slate-500 flex-shrink-0" />
                </button>
              ))}
              {tcCfg.series.length > 0 && (
                <div className="border-t border-slate-700 pt-2 space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">Ausgewählte Trends</label>
              {tcCfg.series.map((s, idx) => (
                <div key={idx} className="border border-slate-700 rounded-lg p-2 space-y-1.5 bg-slate-800/40">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) => updateSeries(idx, { color: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={s.label}
                      onChange={(e) => updateSeries(idx, { label: e.target.value })}
                      placeholder="Bezeichnung"
                      className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 min-w-0"
                    />
                    <button
                      onClick={() => removeSeries(idx)}
                      className="flex-shrink-0 p-1 hover:bg-red-900/40 rounded text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-slate-500">Diagrammtyp</label>
                      <select
                        value={s.chartType || tcCfg.chartType}
                        onChange={(e) => updateSeries(idx, { chartType: e.target.value as TrendChartType })}
                        className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-200"
                      >
                        {CHART_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Y-Achse</label>
                      <select
                        value={s.yAxisSide || 'left'}
                        onChange={(e) => updateSeries(idx, { yAxisSide: e.target.value as 'left' | 'right' })}
                        className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-200"
                      >
                        <option value="left">Links</option>
                        <option value="right">Rechts</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Einheit</label>
                      <input
                        type="text"
                        value={s.unit || ''}
                        onChange={(e) => updateSeries(idx, { unit: e.target.value || undefined })}
                        placeholder="z.B. °C"
                        className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Dezimalstellen</label>
                      <input
                        type="number"
                        value={s.decimals ?? 2}
                        onChange={(e) => updateSeries(idx, { decimals: Number(e.target.value) })}
                        min={0} max={6}
                        className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Linienstärke</label>
                      <input
                        type="number"
                        value={s.lineWidth ?? 2}
                        onChange={(e) => updateSeries(idx, { lineWidth: Number(e.target.value) })}
                        min={1} max={8}
                        className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Füllung (0–1)</label>
                      <input
                        type="number"
                        value={s.fillOpacity ?? 0.1}
                        onChange={(e) => updateSeries(idx, { fillOpacity: Number(e.target.value) })}
                        min={0} max={1} step={0.05}
                        className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-[10px] text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Zeitraum</label>
              <select
                value={tcCfg.timeRange}
                onChange={(e) => onUpdate({ config: { ...tcCfg, timeRange: e.target.value as TrendChartConfig['timeRange'] } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {TIME_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Standard-Diagrammtyp</label>
              <select
                value={tcCfg.chartType}
                onChange={(e) => onUpdate({ config: { ...tcCfg, chartType: e.target.value as TrendChartType } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                {CHART_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Titel</label>
              <input
                type="text"
                value={tcCfg.title || ''}
                onChange={(e) => onUpdate({ config: { ...tcCfg, title: e.target.value || undefined } })}
                placeholder="Optional"
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Aktualisierung (ms)</label>
              <input
                type="number"
                value={tcCfg.refreshIntervalMs ?? 10000}
                onChange={(e) => onUpdate({ config: { ...tcCfg, refreshIntervalMs: Number(e.target.value) } })}
                min={1000} step={1000}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Y-Achse Skalierung</label>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-500">Y-Min</label>
                  <input
                    type="number"
                    value={tcCfg.yMin ?? ''}
                    onChange={(e) => onUpdate({ config: { ...tcCfg, yMin: e.target.value !== '' ? Number(e.target.value) : undefined } })}
                    placeholder="Auto"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Y-Max</label>
                  <input
                    type="number"
                    value={tcCfg.yMax ?? ''}
                    onChange={(e) => onUpdate({ config: { ...tcCfg, yMax: e.target.value !== '' ? Number(e.target.value) : undefined } })}
                    placeholder="Auto"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Anzeigeoptionen</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ['showGrid', 'Gitternetz'],
                  ['showLegend', 'Legende'],
                  ['showTooltip', 'Tooltip'],
                  ['showMinMaxAvg', 'Min/Max/Avg'],
                  ['autoScale', 'Auto-Skalierung'],
                  ['separateAxes', 'Getrennte Achsen'],
                  ['smoothing', 'Glättung'],
                  ['fillArea', 'Fläche füllen'],
                ] as [keyof TrendChartConfig, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tcCfg[key] !== false && !!tcCfg[key]}
                      onChange={(e) => onUpdate({ config: { ...tcCfg, [key]: e.target.checked } })}
                      className="rounded w-3 h-3"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </>
        );
      }

      case 'visu-3d-building': {
        const b3dCfg = config as Building3DWidgetConfig;
        return (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Hintergrundfarbe</label>
              <input
                type="color"
                value={b3dCfg.backgroundColor || '#0a1020'}
                onChange={(e) => onUpdate({ config: { ...b3dCfg, backgroundColor: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Beleuchtung</label>
              <div>
                <label className="text-[10px] text-slate-500">Umgebungslicht ({b3dCfg.ambientIntensity ?? 0.4})</label>
                <input
                  type="range"
                  min={0} max={2} step={0.05}
                  value={b3dCfg.ambientIntensity ?? 0.4}
                  onChange={(e) => onUpdate({ config: { ...b3dCfg, ambientIntensity: Number(e.target.value) } })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Sonnenlicht ({b3dCfg.sunIntensity ?? 1.6})</label>
                <input
                  type="range"
                  min={0} max={4} step={0.1}
                  value={b3dCfg.sunIntensity ?? 1.6}
                  onChange={(e) => onUpdate({ config: { ...b3dCfg, sunIntensity: Number(e.target.value) } })}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Explosionsansicht</label>
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={b3dCfg.showExplosion ?? false}
                  onChange={(e) => onUpdate({ config: { ...b3dCfg, showExplosion: e.target.checked } })}
                  className="rounded w-3.5 h-3.5"
                />
                Explosionsansicht aktivieren
              </label>
              {b3dCfg.showExplosion && (
                <div>
                  <label className="text-[10px] text-slate-500">Abstand ({b3dCfg.explosionOffset ?? 4})</label>
                  <input
                    type="range"
                    min={1} max={10} step={0.5}
                    value={b3dCfg.explosionOffset ?? 4}
                    onChange={(e) => onUpdate({ config: { ...b3dCfg, explosionOffset: Number(e.target.value) } })}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-t border-slate-700 pt-2">
              <label className="text-xs font-medium text-slate-400">Anzeigeoptionen</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  ['showAllFloors', 'Alle Etagen'],
                  ['highlightFloor', 'Etage hervorheben'],
                  ['showWidgets', '3D-Widgets'],
                  ['showDucts', 'Lüftungskanäle'],
                  ['showPipes', 'Rohrleitungen'],
                  ['showFurniture', 'Möbel'],
                  ['showGrid', 'Raster'],
                ] as [keyof Building3DWidgetConfig, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={b3dCfg[key] !== false && !!b3dCfg[key]}
                      onChange={(e) => onUpdate({ config: { ...b3dCfg, [key]: e.target.checked } })}
                      className="rounded w-3 h-3"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </>
        );
      }

      default:
        return <p className="text-xs text-slate-500">Keine Konfiguration verfuegbar</p>;
    }
  };

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">Widget-Eigenschaften</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex border-b border-slate-700">
        {(['general', 'binding', 'style'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${activeTab === tab ? 'bg-slate-800 text-slate-200 border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300'}`}
          >
            {tab === 'general' ? 'Allgemein' : tab === 'binding' ? 'Verknuepfung' : 'Stil'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'general' && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bezeichnung</label>
              <input
                type="text"
                value={widget.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Breite</label>
                <input
                  type="number"
                  min="40"
                  value={widget.size.width}
                  onChange={(e) => onUpdate({ size: { ...widget.size, width: parseInt(e.target.value) } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hoehe</label>
                <input
                  type="number"
                  min="40"
                  value={widget.size.height}
                  onChange={(e) => onUpdate({ size: { ...widget.size, height: parseInt(e.target.value) } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
            </div>
            <hr className="border-slate-700" />
            {renderGeneralConfig()}
          </>
        )}

        {activeTab === 'binding' && (
          <>
            {isDecorationWidget ? (
              <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                <Unlink className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-400">Dieses Widget unterstuetzt keine Verknuepfungen</span>
              </div>
            ) : isPumpWidget ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verknuepfe das Pumpen-Widget mit einem Pumpenbaustein in der Logik. Alle Ein- und Ausgaenge werden automatisch verknuepft.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Pumpenbaustein</label>
                  <select
                    value={widget.binding?.nodeId || ''}
                    onChange={(e) => handleNodeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  >
                    <option value="">-- Keine Verknuepfung --</option>
                    {pumpControlNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {getNodeLabel(node)}
                      </option>
                    ))}
                  </select>
                </div>
                {pumpControlNodes.length === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700 rounded">
                    <Settings className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-400">Kein Pumpenbaustein in der Logik vorhanden. Bitte zuerst einen Pumpenbaustein hinzufuegen.</span>
                  </div>
                )}
                {widget.binding ? (
                  <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                    <Link2 className="w-4 h-4 text-green-500" />
                    <div className="text-xs text-green-400">
                      <p className="font-medium">{getNodeLabel(selectedNode || pumpControlNodes.find(n => n.id === widget.binding?.nodeId))}</p>
                      <p className="text-green-600/50 mt-0.5">Vollstaendige Verknuepfung (alle Signale)</p>
                    </div>
                    <button onClick={() => onUpdate({ binding: undefined })} className="ml-auto text-slate-400 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}
              </>
            ) : isValveWidget ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verknuepfe das Ventil-Widget mit einem Ventilbaustein in der Logik. Alle Ein- und Ausgaenge werden automatisch verknuepft.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ventilbaustein</label>
                  <select
                    value={widget.binding?.nodeId || ''}
                    onChange={(e) => handleNodeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  >
                    <option value="">-- Keine Verknuepfung --</option>
                    {valveControlNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {getNodeLabel(node)}
                      </option>
                    ))}
                  </select>
                </div>
                {valveControlNodes.length === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700 rounded">
                    <Settings className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-400">Kein Ventilbaustein in der Logik vorhanden. Bitte zuerst einen Ventilbaustein hinzufuegen.</span>
                  </div>
                )}
                {widget.binding ? (
                  <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                    <Link2 className="w-4 h-4 text-green-500" />
                    <div className="text-xs text-green-400">
                      <p className="font-medium">{getNodeLabel(selectedNode || valveControlNodes.find(n => n.id === widget.binding?.nodeId))}</p>
                      <p className="text-green-600/50 mt-0.5">Vollstaendige Verknuepfung (alle Signale)</p>
                    </div>
                    <button onClick={() => onUpdate({ binding: undefined })} className="ml-auto text-slate-400 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}
              </>
            ) : isSensorWidget ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verknuepfe dieses Sensor-Widget mit einem Sensorbaustein um den Messwert und Alarmzustand anzuzeigen.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sensorbaustein</label>
                  <select
                    value={widget.binding?.nodeId || ''}
                    onChange={(e) => handleNodeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  >
                    <option value="">-- Keine Verknuepfung --</option>
                    {sensorControlNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {getNodeLabel(node)}
                      </option>
                    ))}
                  </select>
                </div>
                {sensorControlNodes.length === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700 rounded">
                    <Settings className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-400">Kein Sensorbaustein in der Logik vorhanden. Bitte zuerst einen Sensorbaustein hinzufuegen.</span>
                  </div>
                )}
                {widget.binding ? (
                  <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                    <Link2 className="w-4 h-4 text-green-500" />
                    <div className="text-xs text-green-400">
                      <p className="font-medium">{getNodeLabel(selectedNode || sensorControlNodes.find(n => n.id === widget.binding?.nodeId))}</p>
                      <p className="text-green-600/50 mt-0.5">Vollstaendige Verknuepfung (Messwert + Alarm)</p>
                    </div>
                    <button onClick={() => onUpdate({ binding: undefined })} className="ml-auto text-slate-400 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}
              </>
            ) : isPIDWidget ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verknuepfe dieses PID-Widget mit einem PID-Regler um Sollwert, Istwert und Stellgroesse anzuzeigen.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">PID-Regler</label>
                  <select
                    value={widget.binding?.nodeId || ''}
                    onChange={(e) => handleNodeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  >
                    <option value="">-- Keine Verknuepfung --</option>
                    {pidControlNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {getNodeLabel(node)}
                      </option>
                    ))}
                  </select>
                </div>
                {pidControlNodes.length === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700 rounded">
                    <Settings className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-400">Kein PID-Regler in der Logik vorhanden. Bitte zuerst einen PID-Regler hinzufuegen.</span>
                  </div>
                )}
                {widget.binding ? (
                  <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                    <Link2 className="w-4 h-4 text-green-500" />
                    <div className="text-xs text-green-400">
                      <p className="font-medium">{getNodeLabel(selectedNode || pidControlNodes.find(n => n.id === widget.binding?.nodeId))}</p>
                      <p className="text-green-600/50 mt-0.5">Vollstaendige Verknuepfung (Sollwert, Istwert, Stellgroesse)</p>
                    </div>
                    <button onClick={() => onUpdate({ binding: undefined })} className="ml-auto text-slate-400 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}
              </>
            ) : isHeatingCurveWidget ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verknuepfe dieses Widget mit einem Heizkurven-Baustein um Ein-/Ausgangswerte anzuzeigen und Parameter zu aendern.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Heizkurven-Baustein</label>
                  <select
                    value={widget.binding?.nodeId || ''}
                    onChange={(e) => handleNodeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  >
                    <option value="">-- Keine Verknuepfung --</option>
                    {heatingCurveNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {getNodeLabel(node)}
                      </option>
                    ))}
                  </select>
                </div>
                {heatingCurveNodes.length === 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700 rounded">
                    <Settings className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-400">Kein Heizkurven-Baustein in der Logik vorhanden. Bitte zuerst einen Heizkurven-Baustein hinzufuegen.</span>
                  </div>
                )}
                {widget.binding ? (
                  <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                    <Link2 className="w-4 h-4 text-green-500" />
                    <div className="text-xs text-green-400">
                      <p className="font-medium">{getNodeLabel(selectedNode || heatingCurveNodes.find(n => n.id === widget.binding?.nodeId))}</p>
                      <p className="text-green-600/50 mt-0.5">Vollstaendige Verknuepfung (Eingang, Ausgang, Parameter)</p>
                    </div>
                    <button onClick={() => onUpdate({ binding: undefined })} className="ml-auto text-slate-400 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}
              </>
            ) : isShapeWidget ? (
              <>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Verknuepfe diese Form mit einem Datenpunkt um Farbe oder Sichtbarkeit zu steuern. Aktiv/Inaktiv-Farben werden im Allgemein-Tab eingestellt.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Baustein / Datenpunkt (Farbsteuerung)</label>
                  <select
                    value={widget.binding?.nodeId || ''}
                    onChange={(e) => handleNodeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  >
                    <option value="">-- Keine Verknuepfung --</option>
                    {Object.entries(nodesByCategory).map(([cat, nodes]) => (
                      <optgroup key={cat} label={cat}>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>{getNodeLabel(node)}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {widget.binding && selectedNodePorts.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Port</label>
                    <select
                      value={widget.binding.portId || ''}
                      onChange={(e) => handlePortChange(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                    >
                      <option value="">-- Hauptwert --</option>
                      {selectedNodePorts.filter(p => p.isOutput).map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {widget.binding ? (
                  <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                    <Link2 className="w-4 h-4 text-green-500" />
                    <div className="text-xs text-green-400">
                      <p className="font-medium">{getNodeLabel(selectedNode || bindableNodes.find(n => n.id === widget.binding?.nodeId))}</p>
                      <p className="text-green-600/50 mt-0.5">Lesen (Farb-/Sichtbarkeitssteuerung)</p>
                    </div>
                    <button onClick={() => onUpdate({ binding: undefined })} className="ml-auto text-slate-400 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Baustein / Datenpunkt</label>
                  <select
                    value={widget.binding?.nodeId || ''}
                    onChange={(e) => handleNodeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                  >
                    <option value="">-- Keine Verknuepfung --</option>
                    {Object.entries(nodesByCategory).map(([cat, nodes]) => (
                      <optgroup key={cat} label={cat}>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {getNodeLabel(node)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {widget.binding && (selectedNodePorts.length > 0 || selectedNodeConfigParams.length > 0) && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      {isWriteWidget ? 'Eingang (schreiben)' : 'Port / Parameter'}
                    </label>
                    <select
                      value={widget.binding.paramKey ? `param:${widget.binding.paramKey}` : (widget.binding.portId || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('param:')) {
                          handleParamChange(val.slice(6));
                        } else {
                          handlePortChange(val);
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                    >
                      <option value="">-- Hauptwert --</option>
                      {isWriteWidget ? (
                        <>
                          {selectedNodePorts.filter(p => !p.isOutput).length > 0 && (
                            <optgroup label="Eingaenge (schreiben)">
                              {selectedNodePorts.filter(p => !p.isOutput).map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </optgroup>
                          )}
                          {selectedNodeConfigParams.length > 0 && (
                            <optgroup label="Parameter (lesen/schreiben)">
                              {selectedNodeConfigParams.map(p => (
                                <option key={p.key} value={`param:${p.key}`}>{p.label}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      ) : (
                        <>
                          {selectedNodePorts.filter(p => p.isOutput).length > 0 && (
                            <optgroup label="Ausgaenge (lesen)">
                              {selectedNodePorts.filter(p => p.isOutput).map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </optgroup>
                          )}
                          {selectedNodePorts.filter(p => !p.isOutput).length > 0 && (
                            <optgroup label="Eingaenge (lesen)">
                              {selectedNodePorts.filter(p => !p.isOutput).map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </optgroup>
                          )}
                          {selectedNodeConfigParams.length > 0 && (
                            <optgroup label="Parameter">
                              {selectedNodeConfigParams.map(p => (
                                <option key={p.key} value={`param:${p.key}`}>{p.label}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      )}
                    </select>
                  </div>
                )}
                {widget.binding ? (
                  <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                    <Link2 className="w-4 h-4 text-green-500" />
                    <div className="text-xs text-green-400">
                      <p className="font-medium">{getNodeLabel(selectedNode || bindableNodes.find(n => n.id === widget.binding?.nodeId))}</p>
                      {(widget.binding.portId || widget.binding.paramKey) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {widget.binding.paramKey && <Settings className="w-3 h-3 text-amber-400" />}
                          <p className="text-green-500/70">{currentBindingLabel()}</p>
                        </div>
                      )}
                      <p className="text-green-600/50 mt-0.5">
                        {isWriteWidget ? (widget.binding.paramKey ? 'Lesen + Schreiben (Parameter)' : 'Nur schreiben (Eingang)') : 'Nur lesen'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}

                {isWriteWidget && (
                  <>
                    <hr className="border-slate-700" />
                    <div className="flex items-center gap-2 mb-1">
                      <Monitor className="w-3.5 h-3.5 text-sky-400" />
                      <label className="text-xs text-sky-400 font-medium">Rueckmeldung / Anzeige (optional)</label>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed -mt-1">
                      Verknuepfe einen Ausgang oder Eingang als Anzeigewert. Separate Rueckmeldung z.B. vom Datenpunkt-Ausgang.
                    </p>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Rueckmeldungs-Baustein</label>
                      <select
                        value={widget.statusBinding?.nodeId || ''}
                        onChange={(e) => {
                          if (!e.target.value) {
                            onUpdate({ statusBinding: undefined });
                            return;
                          }
                          const node = availableNodes.find(n => n.id === e.target.value);
                          const ports = node ? getNodePorts(node) : [];
                          const outPort = ports.find(p => p.isOutput) || ports[0];
                          onUpdate({ statusBinding: { nodeId: e.target.value, portId: outPort?.id, direction: 'read' } });
                        }}
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                      >
                        <option value="">-- Keine Rueckmeldung --</option>
                        {Object.entries(nodesByCategory).map(([cat, nodes]) => (
                          <optgroup key={cat} label={cat}>
                            {nodes.map((node) => (
                              <option key={node.id} value={node.id}>{getNodeLabel(node)}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    {widget.statusBinding && (() => {
                      const statusNode = availableNodes.find(n => n.id === widget.statusBinding?.nodeId);
                      const statusPorts = statusNode ? getNodePorts(statusNode) : [];
                      return statusPorts.length > 0 ? (
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Rueckmeldungs-Port</label>
                          <select
                            value={widget.statusBinding.portId || ''}
                            onChange={(e) => onUpdate({ statusBinding: { ...widget.statusBinding!, portId: e.target.value || undefined } })}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                          >
                            <option value="">-- Hauptwert --</option>
                            {statusPorts.filter(p => p.isOutput).length > 0 && (
                              <optgroup label="Ausgaenge">
                                {statusPorts.filter(p => p.isOutput).map(p => (
                                  <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                              </optgroup>
                            )}
                            {statusPorts.filter(p => !p.isOutput).length > 0 && (
                              <optgroup label="Eingaenge">
                                {statusPorts.filter(p => !p.isOutput).map(p => (
                                  <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      ) : null;
                    })()}
                    {widget.statusBinding && (
                      <div className="flex items-center gap-2 p-2 bg-sky-900/20 border border-sky-700 rounded">
                        <Monitor className="w-4 h-4 text-sky-400" />
                        <div className="text-xs text-sky-400">
                          <p className="font-medium">Rueckmeldung verknuepft</p>
                          <p className="text-sky-500/70">{getNodeLabel(availableNodes.find(n => n.id === widget.statusBinding?.nodeId))}</p>
                        </div>
                        <button
                          onClick={() => onUpdate({ statusBinding: undefined })}
                          className="ml-auto text-slate-400 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'style' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
                <input
                  type="number"
                  min={8}
                  max={48}
                  value={widget.style.fontSize ?? 14}
                  onChange={(e) => onUpdate({ style: { ...widget.style, fontSize: parseInt(e.target.value) || 14 } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftart</label>
                <select
                  value={(widget.style as { fontFamily?: string }).fontFamily || 'system'}
                  onChange={(e) => onUpdate({ style: { ...widget.style, fontFamily: e.target.value } as typeof widget.style })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                >
                  {FONT_FAMILY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <hr className="border-slate-700" />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hintergrundfarbe</label>
              <ColorPicker value={widget.style.backgroundColor} defaultColor="#1e293b" onChange={(c) => onUpdate({ style: { ...widget.style, backgroundColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Textfarbe</label>
              <ColorPicker value={widget.style.textColor} defaultColor="#e2e8f0" onChange={(c) => onUpdate({ style: { ...widget.style, textColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Akzentfarbe</label>
              <ColorPicker value={widget.style.accentColor} defaultColor="#3b82f6" onChange={(c) => onUpdate({ style: { ...widget.style, accentColor: c } })} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Eckenradius</label>
              <input
                type="number"
                min="0"
                max="24"
                value={widget.style.borderRadius ?? 8}
                onChange={(e) => onUpdate({ style: { ...widget.style, borderRadius: parseInt(e.target.value) } })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widget.style.showLabel ?? true}
                onChange={(e) => onUpdate({ style: { ...widget.style, showLabel: e.target.checked } })}
                className="rounded"
              />
              <label className="text-xs text-slate-400">Label anzeigen</label>
            </div>
            {widget.style.showLabel && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Label-Position</label>
                <select
                  value={widget.style.labelPosition || 'top'}
                  onChange={(e) => onUpdate({ style: { ...widget.style, labelPosition: e.target.value as 'top' | 'bottom' } })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
                >
                  <option value="top">Oben</option>
                  <option value="bottom">Unten</option>
                </select>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-3 border-t border-slate-700">
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700 rounded text-red-400 text-sm transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Widget loeschen
        </button>
      </div>
    </div>
  );
};
