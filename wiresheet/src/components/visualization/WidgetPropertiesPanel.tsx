import React, { useState } from 'react';
import { X, Link2, Unlink, Trash2, Settings, Plus, Monitor, Ban } from 'lucide-react';

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
import { VisuWidget, WidgetBinding, WidgetTheme, SliderConfig, GaugeConfig, BarConfig, TankConfig, ThermometerConfig, IncrementerConfig, InputConfig, DisplayConfig, LedConfig, SwitchConfig, ButtonConfig, LabelConfig, RectConfig, CircleConfig, LineConfig, ArrowConfig, PolygonConfig, StarConfig, DiamondConfig, CrossConfig, PolylineConfig, NavButtonConfig, HomeButtonConfig, BackButtonConfig, MultistateConfig, MultistateOption, ImageConfig } from '../../types/visualization';
import { FlowNode } from '../../types/flow';

interface WidgetPropertiesPanelProps {
  widget: VisuWidget;
  availableNodes: FlowNode[];
  visuPages?: { id: string; name: string }[];
  onUpdate: (updates: Partial<VisuWidget>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const NON_BINDABLE_TYPES = new Set([
  'visu-nav-button', 'visu-home-button', 'visu-back-button',
  'ha-output', 'modbus-driver', 'modbus-device-output', 'text-annotation'
]);

const SHAPE_TYPES = new Set([
  'visu-rect', 'visu-circle', 'visu-line', 'visu-arrow',
  'visu-polygon', 'visu-star', 'visu-diamond', 'visu-cross', 'visu-polyline'
]);

const getNodeLabel = (node: FlowNode) => {
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
  onUpdate,
  onDelete,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'binding' | 'style'>('general');

  const isDecorationWidget = NON_BINDABLE_TYPES.has(widget.type);
  const isShapeWidget = SHAPE_TYPES.has(widget.type);

  const bindableNodes = availableNodes.filter(n => !NON_BINDABLE_TYPES.has(n.type));

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
    'modern-switch', 'modern-button', 'modern-incrementer',
    'dash-toggle'
  ].includes(widget.type);

  const handleNodeChange = (nodeId: string) => {
    if (!nodeId) {
      onUpdate({ binding: undefined });
      return;
    }
    const node = availableNodes.find(n => n.id === nodeId);
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
                onChange={(e) => onUpdate({ config: { ...config, holdMode: e.target.checked } })}
                className="rounded"
              />
              <label className="text-xs text-slate-400">Haltemodus (Wert bleibt nach Loslassen)</label>
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
            {imgCfg.imageUrl && (
              <div className="text-xs text-slate-500 truncate">Bild hochgeladen</div>
            )}
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
                      <p className="font-medium">{getNodeLabel(selectedNode || bindableNodes.find(n => n.id === widget.binding?.nodeId)!)}</p>
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
                      <p className="font-medium">{getNodeLabel(selectedNode || bindableNodes.find(n => n.id === widget.binding?.nodeId)!)}</p>
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
                          <p className="text-sky-500/70">{getNodeLabel(availableNodes.find(n => n.id === widget.statusBinding?.nodeId)!)}</p>
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
            <div>
              <label className="block text-xs text-slate-400 mb-1">Design-Vorlage</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { value: 'default', label: 'Standard', preview: 'bg-slate-800 border-slate-600' },
                  { value: 'dark-glass', label: 'Dark Glass', preview: 'bg-slate-900/80 border-blue-500/30' },
                  { value: 'neon-glow', label: 'Neon Glow', preview: 'bg-slate-950 border-cyan-400' },
                  { value: 'minimal-flat', label: 'Minimal Flat', preview: 'bg-slate-700 border-transparent' },
                  { value: 'industrial', label: 'Industrial', preview: 'bg-zinc-800 border-orange-600' },
                  { value: 'soft-light', label: 'Soft Light', preview: 'bg-slate-200 border-slate-300' },
                  { value: 'midnight-blue', label: 'Midnight Blue', preview: 'bg-blue-950 border-blue-700' },
                  { value: 'carbon-fiber', label: 'Carbon Fiber', preview: 'bg-neutral-900 border-neutral-600' },
                  { value: 'warm-amber', label: 'Warm Amber', preview: 'bg-amber-950 border-amber-600' },
                  { value: 'arctic-white', label: 'Arctic White', preview: 'bg-white border-slate-200' },
                ] as { value: WidgetTheme; label: string; preview: string }[]).map(({ value, label, preview }) => (
                  <button
                    key={value}
                    onClick={() => onUpdate({ style: { ...widget.style, theme: value } })}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs transition-colors ${
                      (widget.style.theme ?? 'default') === value
                        ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                        : 'border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-sm border flex-shrink-0 ${preview}`} />
                    {label}
                  </button>
                ))}
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
