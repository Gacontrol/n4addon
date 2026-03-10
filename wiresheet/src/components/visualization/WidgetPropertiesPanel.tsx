import React, { useState } from 'react';
import { X, Link2, Unlink, Trash2 } from 'lucide-react';
import { VisuWidget, WidgetBinding, SliderConfig, GaugeConfig, BarConfig, TankConfig, ThermometerConfig, IncrementerConfig, InputConfig, DisplayConfig, LedConfig, SwitchConfig, ButtonConfig, LabelConfig } from '../../types/visualization';
import { FlowNode } from '../../types/flow';

interface WidgetPropertiesPanelProps {
  widget: VisuWidget;
  availableNodes: FlowNode[];
  onUpdate: (updates: Partial<VisuWidget>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const WidgetPropertiesPanel: React.FC<WidgetPropertiesPanelProps> = ({
  widget,
  availableNodes,
  onUpdate,
  onDelete,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'binding' | 'style'>('general');

  const bindableNodes = availableNodes.filter(n =>
    n.type.startsWith('dp-') ||
    n.type === 'const-value' ||
    n.type === 'ha-input' ||
    n.type === 'modbus-device-input' ||
    n.type === 'python-script' ||
    n.type.startsWith('math-') ||
    n.type.endsWith('-gate') ||
    n.type === 'compare' ||
    n.type === 'threshold'
  );

  const handleBindingChange = (nodeId: string) => {
    if (!nodeId) {
      onUpdate({ binding: undefined });
    } else {
      const binding: WidgetBinding = {
        nodeId,
        direction: widget.type.includes('switch') || widget.type.includes('slider') || widget.type.includes('incrementer') || widget.type.includes('input') || widget.type.includes('button')
          ? 'readwrite'
          : 'read'
      };
      onUpdate({ binding });
    }
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
            <div>
              <label className="block text-xs text-slate-400 mb-1">Verknuepfter Datenpunkt</label>
              <select
                value={widget.binding?.nodeId || ''}
                onChange={(e) => handleBindingChange(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
              >
                <option value="">-- Keine Verknuepfung --</option>
                {bindableNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.data.config?.customLabel || node.data.label} ({node.type})
                  </option>
                ))}
              </select>
            </div>
            {widget.binding && (
              <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700 rounded">
                <Link2 className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-400">
                  Verknuepft mit: {bindableNodes.find(n => n.id === widget.binding?.nodeId)?.data.label}
                </span>
              </div>
            )}
            {!widget.binding && (
              <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
                <Unlink className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-400">Keine Verknuepfung</span>
              </div>
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
