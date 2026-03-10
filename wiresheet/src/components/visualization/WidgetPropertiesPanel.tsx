import React, { useState } from 'react';
import { X, Link2, Unlink, Trash2, Settings } from 'lucide-react';
import { VisuWidget, WidgetBinding, SliderConfig, GaugeConfig, BarConfig, TankConfig, ThermometerConfig, IncrementerConfig, InputConfig, DisplayConfig, LedConfig, SwitchConfig, ButtonConfig, LabelConfig, RectConfig, CircleConfig, LineConfig, ArrowConfig, NavButtonConfig, HomeButtonConfig, BackButtonConfig } from '../../types/visualization';
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
  'visu-rect', 'visu-circle', 'visu-line', 'visu-arrow',
  'visu-nav-button', 'visu-home-button', 'visu-back-button',
  'ha-output', 'modbus-driver', 'modbus-device-output', 'text-annotation'
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

  const isWriteWidget = ['visu-switch', 'visu-slider', 'visu-incrementer', 'visu-input', 'visu-button'].includes(widget.type);

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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={btnCfg.holdMode || false}
                onChange={(e) => onUpdate({ config: { ...config, holdMode: e.target.checked } })}
                className="rounded"
              />
              <label className="text-xs text-slate-400">Haltemodus (Wert bleibt)</label>
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
              <input type="color" value={shapeCfg.fillColor || '#1e293b'} onChange={(e) => onUpdate({ config: { ...config, fillColor: e.target.value } })} className="w-full h-8 rounded cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenfarbe</label>
              <input type="color" value={shapeCfg.strokeColor || '#475569'} onChange={(e) => onUpdate({ config: { ...config, strokeColor: e.target.value } })} className="w-full h-8 rounded cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rahmenstaerke</label>
              <input type="number" min="0" max="20" value={shapeCfg.strokeWidth ?? 2} onChange={(e) => onUpdate({ config: { ...config, strokeWidth: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Transparenz (0-1)</label>
              <input type="number" min="0" max="1" step="0.1" value={shapeCfg.opacity ?? 1} onChange={(e) => onUpdate({ config: { ...config, opacity: parseFloat(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
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
              <input type="color" value={lineCfg.strokeColor || '#64748b'} onChange={(e) => onUpdate({ config: { ...config, strokeColor: e.target.value } })} className="w-full h-8 rounded cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Linienstaerke</label>
              <input type="number" min="1" max="20" value={lineCfg.strokeWidth ?? 2} onChange={(e) => onUpdate({ config: { ...config, strokeWidth: parseInt(e.target.value) } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
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
              <input type="color" value={navCfg.color || '#3b82f6'} onChange={(e) => onUpdate({ config: { ...config, color: e.target.value } })} className="w-full h-8 rounded cursor-pointer" />
            </div>
          </>
        );
      }

      case 'visu-home-button': {
        const homeCfg = config as HomeButtonConfig;
        return (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Label</label>
              <input type="text" value={homeCfg.label || 'Home'} onChange={(e) => onUpdate({ config: { ...config, label: e.target.value } })} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Farbe</label>
              <input type="color" value={homeCfg.color || '#10b981'} onChange={(e) => onUpdate({ config: { ...config, color: e.target.value } })} className="w-full h-8 rounded cursor-pointer" />
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
              <input type="color" value={backCfg.color || '#64748b'} onChange={(e) => onUpdate({ config: { ...config, color: e.target.value } })} className="w-full h-8 rounded cursor-pointer" />
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
                    <label className="block text-xs text-slate-400 mb-1">Port / Parameter</label>
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
                      {selectedNodePorts.filter(p => p.isOutput).length > 0 && (
                        <optgroup label="Ausgaenge (lesen)">
                          {selectedNodePorts.filter(p => p.isOutput).map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </optgroup>
                      )}
                      {selectedNodePorts.filter(p => !p.isOutput).length > 0 && isWriteWidget && (
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
                        {isWriteWidget ? (widget.binding.paramKey ? 'Lesen + Schreiben (Parameter)' : 'Lesen + Schreiben') : 'Nur lesen'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                    <Unlink className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-400">Keine Verknuepfung</span>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'style' && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hintergrundfarbe</label>
              <input
                type="color"
                value={widget.style.backgroundColor || '#1e293b'}
                onChange={(e) => onUpdate({ style: { ...widget.style, backgroundColor: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Textfarbe</label>
              <input
                type="color"
                value={widget.style.textColor || '#e2e8f0'}
                onChange={(e) => onUpdate({ style: { ...widget.style, textColor: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Akzentfarbe</label>
              <input
                type="color"
                value={widget.style.accentColor || '#3b82f6'}
                onChange={(e) => onUpdate({ style: { ...widget.style, accentColor: e.target.value } })}
                className="w-full h-8 rounded cursor-pointer"
              />
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
