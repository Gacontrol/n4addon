import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FlowNode, NodeConfig, EnumStage, PythonPort, CaseDefinition, ModbusDevice } from '../types/flow';
import { X, Plus, Trash2, RefreshCw, Activity, Code, Layers, GripVertical } from 'lucide-react';
import { EntityBrowser } from './EntityBrowser';
import { PythonEditor } from './PythonEditor';
import { ModbusDeviceBlockConfig } from './ModbusConfig';
import { ModbusDriverPanel } from './ModbusDriverPanel';

interface HAEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

interface PropertiesPanelProps {
  node: FlowNode;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<FlowNode['data']>) => void;
  haEntities: HAEntity[];
  haLoading: boolean;
  haError?: string | null;
  onReloadEntities: () => void;
  liveValues: Record<string, unknown>;
  modbusDevices?: ModbusDevice[];
  modbusDriverEnabled?: boolean;
  onModbusDriverEnabledChange?: (enabled: boolean) => void;
  onModbusDevicesChange?: (devices: ModbusDevice[]) => void;
  onModbusDatapointDragStart?: (device: ModbusDevice, datapoint: ModbusDevice['datapoints'][0], isOutput: boolean) => void;
  onPingModbusDevice?: (deviceId: string) => void;
  modbusDeviceStatus?: Record<string, { online: boolean; lastSeen?: number; pinging?: boolean }>;
  selectedModbusDatapointPath?: { deviceId: string; datapointId: string } | null;
  allNodes?: FlowNode[];
  onReadConfigValue?: (deviceId: string, datapointId: string) => void;
  onWriteConfigValue?: (deviceId: string, datapointId: string, value: number | string | boolean) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
  onClose,
  onUpdateNode,
  haEntities,
  haLoading,
  haError,
  onReloadEntities,
  liveValues,
  modbusDevices = [],
  modbusDriverEnabled = true,
  onModbusDriverEnabledChange,
  onModbusDevicesChange,
  onModbusDatapointDragStart,
  onPingModbusDevice,
  modbusDeviceStatus = {},
  selectedModbusDatapointPath,
  allNodes = [],
  onReadConfigValue,
  onWriteConfigValue
}) => {
  const [config, setConfig] = useState<NodeConfig>(node.data.config || {});
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setConfig(node.data.config || {});
  }, [node.id]);

  useEffect(() => {
    if (node.type === 'python-script') {
      setPanelWidth(480);
    } else {
      setPanelWidth(320);
    }
  }, [node.type]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelWidth]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing || !resizeRef.current) return;
    const delta = resizeRef.current.startX - e.clientX;
    const newWidth = Math.max(280, Math.min(800, resizeRef.current.startWidth + delta));
    setPanelWidth(newWidth);
  }, [isResizing]);

  const handleResizeEnd = useCallback((e: React.PointerEvent) => {
    if (isResizing) {
      setIsResizing(false);
      resizeRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, [isResizing]);

  const isHANode = node.type === 'ha-input' || node.type === 'ha-output';
  const isDPNode = node.type === 'dp-boolean' || node.type === 'dp-numeric' || node.type === 'dp-enum';
  const liveValue = liveValues[node.id];
  const hasLive = liveValue !== undefined && liveValue !== null;

  const updateConfig = (key: keyof NodeConfig, value: unknown) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onUpdateNode(node.id, { config: next });
  };

  const handleEntitySelect = (entity: HAEntity) => {
    onUpdateNode(node.id, {
      entityId: entity.entity_id,
      entityLabel: String(entity.attributes.friendly_name || entity.entity_id)
    });
  };

  const addEnumStage = () => {
    const stages: EnumStage[] = config.dpEnumStages || [];
    const nextVal = stages.length > 0 ? Math.max(...stages.map(s => s.value)) + 1 : 0;
    updateConfig('dpEnumStages', [...stages, { value: nextVal, label: `Stufe ${nextVal}` }]);
  };

  const updateEnumStage = (index: number, field: 'value' | 'label', value: string | number) => {
    const stages: EnumStage[] = [...(config.dpEnumStages || [])];
    stages[index] = { ...stages[index], [field]: field === 'value' ? Number(value) : value };
    updateConfig('dpEnumStages', stages);
  };

  const removeEnumStage = (index: number) => {
    const stages = (config.dpEnumStages || []).filter((_, i) => i !== index);
    updateConfig('dpEnumStages', stages);
  };

  const addPythonInput = () => {
    const inputs: PythonPort[] = config.pythonInputs || [];
    const nextNum = inputs.length + 1;
    const newInput = { id: `in${nextNum}`, label: `In${nextNum}` };
    updateConfig('pythonInputs', [...inputs, newInput]);
    const nodeInputs = [...node.data.inputs, { id: `input-${nextNum - 1}`, label: newInput.label, type: 'input' as const }];
    onUpdateNode(node.id, { inputs: nodeInputs });
  };

  const addPythonOutput = () => {
    const outputs: PythonPort[] = config.pythonOutputs || [];
    const nextNum = outputs.length + 1;
    const newOutput = { id: `out${nextNum}`, label: `Out${nextNum}` };
    updateConfig('pythonOutputs', [...outputs, newOutput]);
    const nodeOutputs = [...node.data.outputs, { id: `output-${nextNum - 1}`, label: newOutput.label, type: 'output' as const }];
    onUpdateNode(node.id, { outputs: nodeOutputs });
  };

  const updatePythonPort = (type: 'input' | 'output', index: number, label: string) => {
    if (type === 'input') {
      const inputs: PythonPort[] = [...(config.pythonInputs || [])];
      inputs[index] = { ...inputs[index], label };
      updateConfig('pythonInputs', inputs);
      const nodeInputs = node.data.inputs.map((inp, i) => i === index ? { ...inp, label } : inp);
      onUpdateNode(node.id, { inputs: nodeInputs });
    } else {
      const outputs: PythonPort[] = [...(config.pythonOutputs || [])];
      outputs[index] = { ...outputs[index], label };
      updateConfig('pythonOutputs', outputs);
      const nodeOutputs = node.data.outputs.map((out, i) => i === index ? { ...out, label } : out);
      onUpdateNode(node.id, { outputs: nodeOutputs });
    }
  };

  const removePythonPort = (type: 'input' | 'output', index: number) => {
    if (type === 'input') {
      const inputs = (config.pythonInputs || []).filter((_, i) => i !== index);
      updateConfig('pythonInputs', inputs);
      const nodeInputs = node.data.inputs.filter((_, i) => i !== index);
      onUpdateNode(node.id, { inputs: nodeInputs });
    } else {
      const outputs = (config.pythonOutputs || []).filter((_, i) => i !== index);
      updateConfig('pythonOutputs', outputs);
      const nodeOutputs = node.data.outputs.filter((_, i) => i !== index);
      onUpdateNode(node.id, { outputs: nodeOutputs });
    }
  };

  const addCase = () => {
    const cases: CaseDefinition[] = config.cases || [];
    const nextNum = cases.length;
    const existingWidth = config.containerWidth || 400;
    const existingHeight = config.containerHeight || 300;
    const newCases = [...cases, { id: `case-${nextNum}`, label: `Case ${nextNum}`, nodeIds: [] }];
    setConfig(prev => ({
      ...prev,
      cases: newCases,
      containerWidth: existingWidth,
      containerHeight: existingHeight
    }));
    onUpdateNode(node.id, {
      config: {
        ...config,
        cases: newCases,
        containerWidth: existingWidth,
        containerHeight: existingHeight
      }
    });
  };

  const updateCase = (index: number, label: string) => {
    const cases: CaseDefinition[] = [...(config.cases || [])];
    cases[index] = { ...cases[index], label };
    updateConfig('cases', cases);
  };

  const removeCase = (index: number) => {
    const cases = (config.cases || []).filter((_, i) => i !== index);
    updateConfig('cases', cases);
  };

  const dpNodeColor = node.type === 'dp-boolean' ? '#8b5cf6'
    : node.type === 'dp-numeric' ? '#06b6d4'
    : '#f97316';

  return (
    <div
      className="bg-slate-800 border-l border-slate-700 flex flex-col flex-shrink-0 overflow-hidden relative"
      style={{ width: panelWidth }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/30 transition-colors flex items-center justify-center z-10 group"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      >
        <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
      </div>

      <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0 pl-5">
        <div className="flex items-center gap-2 min-w-0">
          {isDPNode && (
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dpNodeColor }} />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{node.data.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{node.type}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors flex-shrink-0 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pl-5 space-y-5">

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bezeichnung</label>
          <input
            type="text"
            defaultValue={node.data.label}
            key={node.id}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== node.data.label) onUpdateNode(node.id, { label: v });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {hasLive && (
          <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-emerald-400 font-semibold leading-tight">Live-Wert</p>
              <p className="text-sm text-emerald-300 font-mono leading-tight">{String(liveValue)}</p>
            </div>
          </div>
        )}

        {isHANode && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Home Assistant Entity
              </label>
              <button onClick={onReloadEntities} className="text-slate-500 hover:text-slate-300 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${haLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {node.data.entityId && (
              <div className="mb-2 px-2.5 py-1.5 bg-blue-950/40 border border-blue-800/40 rounded-lg flex items-center justify-between gap-2">
                <span className="text-xs text-blue-300 font-mono truncate">{node.data.entityId}</span>
                <button
                  onClick={() => onUpdateNode(node.id, { entityId: undefined, entityLabel: undefined })}
                  className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <EntityBrowser
              haEntities={haEntities}
              haLoading={haLoading}
              haError={haError}
              selectedEntityId={node.data.entityId}
              onSelect={handleEntitySelect}
              onReload={onReloadEntities}
            />
          </div>
        )}

        {node.type === 'dp-boolean' && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Boolean Einstellungen
            </label>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Facet / Bezeichnung</label>
              <input
                type="text"
                value={String(config.dpFacet || '')}
                onChange={e => updateConfig('dpFacet', e.target.value)}
                placeholder="z.B. Fensterkontakt"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 transition-colors placeholder-slate-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Text bei True</label>
                <input
                  type="text"
                  value={String(config.trueText || '')}
                  onChange={e => updateConfig('trueText', e.target.value)}
                  placeholder="z.B. Ein, Normal, An"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-green-500 transition-colors placeholder-slate-500"
                />
                <p className="text-[10px] text-slate-600">true / 1 / on</p>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Text bei False</label>
                <input
                  type="text"
                  value={String(config.falseText || '')}
                  onChange={e => updateConfig('falseText', e.target.value)}
                  placeholder="z.B. Aus, Stoerung, Off"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-red-500 transition-colors placeholder-slate-500"
                />
                <p className="text-[10px] text-slate-600">false / 0 / off</p>
              </div>
            </div>
          </div>
        )}

        {node.type === 'dp-numeric' && (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Numerische Einstellungen
            </label>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Einheit</label>
              <input
                type="text"
                value={String(config.dpUnit || '')}
                onChange={e => updateConfig('dpUnit', e.target.value)}
                placeholder="z.B. °C, %, kW"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500 transition-colors placeholder-slate-500"
              />
            </div>
          </div>
        )}

        {node.type === 'dp-enum' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Enum Stufen
              </label>
              <button
                onClick={addEnumStage}
                className="flex items-center gap-1 px-2 py-1 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-600/30 text-orange-300 rounded text-xs transition-colors"
              >
                <Plus className="w-3 h-3" /> Stufe
              </button>
            </div>
            <div className="space-y-1.5">
              {(config.dpEnumStages || []).map((stage, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={stage.value}
                    onChange={e => updateEnumStage(idx, 'value', e.target.value)}
                    className="w-12 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500 text-center"
                    title="Wert"
                  />
                  <input
                    type="text"
                    value={stage.label}
                    onChange={e => updateEnumStage(idx, 'label', e.target.value)}
                    placeholder="Bezeichnung"
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500 placeholder-slate-500"
                  />
                  <button
                    onClick={() => removeEnumStage(idx)}
                    className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(config.dpEnumStages || []).length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">Keine Stufen definiert</p>
              )}
            </div>
          </div>
        )}

        {(node.type === 'and-gate' || node.type === 'or-gate' || node.type === 'xor-gate') && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Anzahl Eingaenge
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2}
                max={16}
                value={config.inputCount ?? 2}
                onChange={e => {
                  const count = Math.max(2, Math.min(16, parseInt(e.target.value) || 2));
                  updateConfig('inputCount', count);
                  const labels = 'ABCDEFGHIJKLMNOP'.split('');
                  const newInputs = Array.from({ length: count }, (_, i) => ({
                    id: `input-${i}`,
                    label: labels[i] || `In${i + 1}`,
                    type: 'input' as const
                  }));
                  onUpdateNode(node.id, { inputs: newInputs });
                }}
                className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors text-center"
              />
              <span className="text-xs text-slate-400">Eingaenge (2-16)</span>
            </div>
          </div>
        )}

        {node.type === 'const-value' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Konstanter Wert
            </label>
            <input
              type="text"
              value={config.constValue !== undefined ? String(config.constValue) : '0'}
              onChange={e => {
                const val = e.target.value;
                if (val === 'true' || val === 'false') {
                  updateConfig('constValue', val === 'true');
                } else if (!isNaN(Number(val)) && val !== '') {
                  updateConfig('constValue', Number(val));
                } else {
                  updateConfig('constValue', val);
                }
              }}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">Zahl, true/false, oder Text</p>
          </div>
        )}

        {node.type === 'timer' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Einschaltverzögerung
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={config.timerOnMs ?? 1000}
                  onChange={e => updateConfig('timerOnMs', parseInt(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-slate-400 flex-shrink-0">ms</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{((config.timerOnMs ?? 1000) / 1000).toFixed(1)} Sek. — 0 = sofort</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Ausschaltverzögerung
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={config.timerOffMs ?? 0}
                  onChange={e => updateConfig('timerOffMs', parseInt(e.target.value) || 0)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-xs text-slate-400 flex-shrink-0">ms</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{((config.timerOffMs ?? 0) / 1000).toFixed(1)} Sek. — 0 = sofort</p>
            </div>
          </div>
        )}

        {node.type === 'counter' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Zaehler Min
              </label>
              <input
                type="number"
                value={config.counterMin ?? 0}
                onChange={e => updateConfig('counterMin', parseInt(e.target.value) || 0)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Zaehler Max
              </label>
              <input
                type="number"
                value={config.counterMax ?? 100}
                onChange={e => updateConfig('counterMax', parseInt(e.target.value) || 100)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        )}

        {node.type === 'delay' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Verzögerung
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={100}
                value={config.delayMs ?? 1000}
                onChange={e => updateConfig('delayMs', parseInt(e.target.value) || 0)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              />
              <span className="text-xs text-slate-400 flex-shrink-0">ms</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{((config.delayMs ?? 1000) / 1000).toFixed(1)} Sekunden</p>
          </div>
        )}

        {node.type === 'threshold' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Schwellwert
            </label>
            <input
              type="number"
              step="any"
              value={config.thresholdValue ?? 0}
              onChange={e => updateConfig('thresholdValue', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        {node.type === 'compare' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Operator
              </label>
              <select
                value={config.compareOperator ?? '>'}
                onChange={e => updateConfig('compareOperator', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
              >
                <option value=">">Grösser (&gt;)</option>
                <option value=">=">Grösser gleich (&gt;=)</option>
                <option value="==">Gleich (==)</option>
                <option value="!=">Ungleich (!=)</option>
                <option value="<=">Kleiner gleich (&lt;=)</option>
                <option value="<">Kleiner (&lt;)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Vergleichswert B
              </label>
              <input
                type="number"
                step="any"
                value={config.compareValue !== undefined ? String(config.compareValue) : ''}
                onChange={e => updateConfig('compareValue', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                placeholder="Leer = Port B Eingang verwenden"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-slate-500"
              />
            </div>
          </div>
        )}

        {node.type === 'time-trigger' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Cron-Ausdruck
            </label>
            <input
              type="text"
              value={config.cronExpression ?? '0 * * * *'}
              onChange={e => updateConfig('cronExpression', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1">z.B. "0 * * * *" = jede Stunde</p>
          </div>
        )}

        {node.type === 'state-trigger' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Trigger-Status
            </label>
            <input
              type="text"
              value={config.triggerState ?? 'on'}
              onChange={e => updateConfig('triggerState', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        {node.type === 'python-script' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-400">
              <Code className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Python Script</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400 font-medium">Eingaenge</label>
                  <button
                    onClick={addPythonInput}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-300 rounded text-xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1">
                  {(config.pythonInputs || []).map((inp, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-[10px] text-slate-500 font-mono w-7">{inp.id}</span>
                      <input
                        type="text"
                        value={inp.label}
                        onChange={e => updatePythonPort('input', idx, e.target.value)}
                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 min-w-0"
                      />
                      <button
                        onClick={() => removePythonPort('input', idx)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(config.pythonInputs || []).length === 0 && (
                    <p className="text-[10px] text-slate-500 text-center py-2">Keine Eingaenge</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400 font-medium">Ausgaenge</label>
                  <button
                    onClick={addPythonOutput}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-600/30 text-emerald-300 rounded text-xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1">
                  {(config.pythonOutputs || []).map((out, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="text-[10px] text-slate-500 font-mono w-7">{out.id}</span>
                      <input
                        type="text"
                        value={out.label}
                        onChange={e => updatePythonPort('output', idx, e.target.value)}
                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500 min-w-0"
                      />
                      <button
                        onClick={() => removePythonPort('output', idx)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(config.pythonOutputs || []).length === 0 && (
                    <p className="text-[10px] text-slate-500 text-center py-2">Keine Ausgaenge</p>
                  )}
                </div>
              </div>
            </div>

            <PythonEditor
              value={config.pythonCode || '# Schreibe deinen Python Code hier\n\nout1 = in1'}
              onChange={code => updateConfig('pythonCode', code)}
              inputs={(config.pythonInputs || []).map(i => i.id)}
              outputs={(config.pythonOutputs || []).map(o => o.id)}
              liveInputValues={(() => {
                const vals: Record<string, unknown> = {};
                (config.pythonInputs || []).forEach((inp, idx) => {
                  vals[inp.id] = liveValues[`${node.id}:input-${idx}`] ?? liveValues[node.id];
                });
                return vals;
              })()}
              liveOutputValues={(() => {
                const vals: Record<string, unknown> = {};
                (config.pythonOutputs || []).forEach((out, idx) => {
                  vals[out.id] = liveValues[`${node.id}:output-${idx}`];
                });
                return vals;
              })()}
            />
          </div>
        )}

        {node.type === 'text-annotation' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Text Annotation</span>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Text</label>
              <textarea
                value={config.textContent || ''}
                onChange={e => updateConfig('textContent', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-slate-500 min-h-20 resize-y"
                placeholder="Text eingeben..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Schriftgroesse</label>
                <input
                  type="number"
                  min={10}
                  max={48}
                  value={config.fontSize || 14}
                  onChange={e => updateConfig('fontSize', parseInt(e.target.value) || 14)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Farbe</label>
                <input
                  type="color"
                  value={config.textColor || '#94a3b8'}
                  onChange={e => updateConfig('textColor', e.target.value)}
                  className="w-full h-8 bg-slate-700 border border-slate-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {node.type === 'pid-controller' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <span className="text-xs font-semibold uppercase tracking-wider">PID Regler</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Kp</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.kp ?? 1.0}
                  onChange={e => updateConfig('kp', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500"
                />
                <p className="text-[9px] text-slate-500 mt-0.5">Proportional</p>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ki</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.ki ?? 0.1}
                  onChange={e => updateConfig('ki', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500"
                />
                <p className="text-[9px] text-slate-500 mt-0.5">Integral</p>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Kd</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.kd ?? 0.05}
                  onChange={e => updateConfig('kd', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500"
                />
                <p className="text-[9px] text-slate-500 mt-0.5">Differential</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ausgang Min</label>
                <input
                  type="number"
                  step="any"
                  value={config.outputMin ?? 0}
                  onChange={e => updateConfig('outputMin', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ausgang Max</label>
                <input
                  type="number"
                  step="any"
                  value={config.outputMax ?? 100}
                  onChange={e => updateConfig('outputMax', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Abtastzeit</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={config.sampleTimeMs ?? 100}
                  onChange={e => updateConfig('sampleTimeMs', parseInt(e.target.value) || 100)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500"
                />
                <span className="text-xs text-slate-400">ms</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-2 py-2 bg-slate-700/40 rounded">
              <span className="text-xs text-slate-300">Anti-Windup</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.antiWindup !== false}
                  onChange={e => updateConfig('antiWindup', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:bg-red-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>

            <p className="text-[10px] text-slate-500">
              Der PID-Regler berechnet die Stellgroesse basierend auf der Differenz zwischen Soll- und Istwert.
            </p>
          </div>
        )}

        {node.type === 'scaling' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-violet-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Schiebung / Skalierung</span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-700/30 rounded-lg p-3">
                <label className="block text-xs text-slate-400 mb-2 font-medium">Eingangsbereich</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Min X</label>
                    <input
                      type="number"
                      step="any"
                      value={config.inputMin ?? 0}
                      onChange={e => updateConfig('inputMin', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Max X</label>
                    <input
                      type="number"
                      step="any"
                      value={config.inputMax ?? 100}
                      onChange={e => updateConfig('inputMax', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3">
                <label className="block text-xs text-slate-400 mb-2 font-medium">Ausgangsbereich</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Min Y</label>
                    <input
                      type="number"
                      step="any"
                      value={config.outputMin ?? 0}
                      onChange={e => updateConfig('outputMin', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Max Y</label>
                    <input
                      type="number"
                      step="any"
                      value={config.outputMax ?? 100}
                      onChange={e => updateConfig('outputMax', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 py-2 bg-slate-700/40 rounded">
                <span className="text-xs text-slate-300">Invertiert</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.inverted === true}
                    onChange={e => updateConfig('inverted', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:bg-violet-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>

              <div className="flex items-center justify-between px-2 py-2 bg-slate-700/40 rounded">
                <span className="text-xs text-slate-300">Begrenzen (Clamp)</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.clamp !== false}
                    onChange={e => updateConfig('clamp', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:bg-violet-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              Skaliert den Eingangswert von [Min X, Max X] auf [Min Y, Max Y]. Bei "Invertiert" wird die Richtung umgekehrt.
            </p>
          </div>
        )}

        {node.type === 'smoothing' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sky-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Glaettung</span>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Methode</label>
              <select
                value={config.smoothingMethod ?? 'average'}
                onChange={e => updateConfig('smoothingMethod', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500"
              >
                <option value="average">Gleitender Durchschnitt</option>
                <option value="exponential">Exponentiell gewichtet</option>
                <option value="median">Median</option>
              </select>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3">
              <label className="block text-xs text-slate-400 mb-2 font-medium">Glaettungszeitraum</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={config.smoothingValue ?? 24}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      const unit = config.smoothingUnit ?? 'hours';
                      let ms = val * 3600000;
                      if (unit === 'minutes') ms = val * 60000;
                      if (unit === 'days') ms = val * 86400000;
                      updateConfig('smoothingValue', val);
                      updateConfig('smoothingDuration', ms);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <select
                    value={config.smoothingUnit ?? 'hours'}
                    onChange={e => {
                      const unit = e.target.value;
                      const val = config.smoothingValue ?? 24;
                      let ms = val * 3600000;
                      if (unit === 'minutes') ms = val * 60000;
                      if (unit === 'days') ms = val * 86400000;
                      updateConfig('smoothingUnit', unit);
                      updateConfig('smoothingDuration', ms);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                  >
                    <option value="minutes">Minuten</option>
                    <option value="hours">Stunden</option>
                    <option value="days">Tage</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Zeitraum: {((config.smoothingDuration ?? 86400000) / 60000).toFixed(0)} Minuten
              </p>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-2 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">Ausgaenge:</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Geglaettet</span>
                <span className="text-slate-500">- Durchschnitt/Median</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-slate-300">Min</span>
                <span className="text-slate-500">- Minimum im Zeitraum</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-slate-300">Max</span>
                <span className="text-slate-500">- Maximum im Zeitraum</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              Ideal fuer Aussentemperatur oder andere schwankende Messwerte. Speichert Werte ueber den eingestellten Zeitraum.
            </p>
          </div>
        )}

        {node.type === 'case-container' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Case Container</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400 font-medium">Cases</label>
                <button
                  onClick={addCase}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/30 text-indigo-300 rounded text-xs transition-colors"
                >
                  <Plus className="w-3 h-3" /> Case
                </button>
              </div>
              <div className="space-y-1">
                {(config.cases || []).map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono w-6">{idx}</span>
                    <input
                      type="text"
                      value={c.label}
                      onChange={e => updateCase(idx, e.target.value)}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                    {(config.cases || []).length > 1 && (
                      <button
                        onClick={() => removeCase(idx)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Breite</label>
                <input
                  type="number"
                  min={200}
                  step={50}
                  value={config.containerWidth || 400}
                  onChange={e => updateConfig('containerWidth', parseInt(e.target.value) || 400)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hoehe</label>
                <input
                  type="number"
                  min={150}
                  step={50}
                  value={config.containerHeight || 300}
                  onChange={e => updateConfig('containerHeight', parseInt(e.target.value) || 300)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              Der Case-Eingang bestimmt welcher Case aktiv ist. Nur Nodes im aktiven Case werden ausgefuehrt.
            </p>
          </div>
        )}

        {node.type === 'pump-control' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Pumpenbaustein</span>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
              <label className="block text-xs text-slate-400 mb-2 font-medium">Verzoegerungen</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Einschaltverz. (ms)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={config.pumpStartDelayMs ?? 0}
                    onChange={e => updateConfig('pumpStartDelayMs', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Ausschaltverz. (ms)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={config.pumpStopDelayMs ?? 0}
                    onChange={e => updateConfig('pumpStopDelayMs', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
              <label className="block text-xs text-slate-400 mb-2 font-medium">Rueckmeldung</label>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">RM-Ueberwachung aktiv</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.pumpEnableFeedback !== false}
                    onChange={e => updateConfig('pumpEnableFeedback', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:bg-cyan-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">RM-Timeout (ms)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  value={config.pumpFeedbackTimeoutMs ?? 10000}
                  onChange={e => updateConfig('pumpFeedbackTimeoutMs', parseInt(e.target.value) || 10000)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
              <label className="block text-xs text-slate-400 mb-2 font-medium">Drehzahlregelung</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Min. Drehzahl (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.pumpSpeedMin ?? 0}
                    onChange={e => updateConfig('pumpSpeedMin', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Max. Drehzahl (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.pumpSpeedMax ?? 100}
                    onChange={e => updateConfig('pumpSpeedMax', parseInt(e.target.value) || 100)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
              <label className="block text-xs text-slate-400 mb-2 font-medium">Blockierschutz (Anti-Seize)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Intervall (Tage)</label>
                  <input
                    type="number"
                    min={1}
                    value={Math.round((config.pumpAntiSeizeIntervalMs ?? 604800000) / 86400000)}
                    onChange={e => updateConfig('pumpAntiSeizeIntervalMs', (parseInt(e.target.value) || 7) * 86400000)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Laufzeit (Sek)</label>
                  <input
                    type="number"
                    min={1}
                    value={Math.round((config.pumpAntiSeizeRunMs ?? 60000) / 1000)}
                    onChange={e => updateConfig('pumpAntiSeizeRunMs', (parseInt(e.target.value) || 60) * 1000)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Drehzahl (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.pumpAntiSeizeSpeed ?? 30}
                  onChange={e => updateConfig('pumpAntiSeizeSpeed', parseInt(e.target.value) || 30)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3 space-y-3">
              <label className="block text-xs text-slate-400 mb-2 font-medium">Betriebsdaten</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Betriebsstunden</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={config.pumpOperatingHours ?? 0}
                    onChange={e => updateConfig('pumpOperatingHours', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Startanzahl</label>
                  <input
                    type="number"
                    min={0}
                    value={config.pumpStartCount ?? 0}
                    onChange={e => updateConfig('pumpStartCount', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-2 space-y-1">
              <div className="text-[10px] text-slate-400 font-medium mb-1">Eingaenge:</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-slate-300">StartCmd</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-slate-300">Feedback</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-slate-300">Fault</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-slate-300">Revision</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400" /><span className="text-slate-300">HOA</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400" /><span className="text-slate-300">HandStart</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400" /><span className="text-slate-300">SpeedSP</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /><span className="text-slate-300">Reset</span></div>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-2 mb-1">Ausgaenge:</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-slate-300">PumpCmd</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400" /><span className="text-slate-300">SpeedOut</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-slate-300">Running</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-slate-300">Fault</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-slate-300">Ready</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-slate-300">Alarm</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /><span className="text-slate-300">OpHours</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400" /><span className="text-slate-300">Starts</span></div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              Kompletter Pumpenbaustein mit Verzoegerungen, Rueckmeldungsueberwachung, Drehzahlregelung und Blockierschutz.
            </p>
          </div>
        )}

        {node.type === 'modbus-driver' && onModbusDevicesChange && onModbusDatapointDragStart && onPingModbusDevice && onModbusDriverEnabledChange && (
          <ModbusDriverPanel
            devices={modbusDevices}
            driverEnabled={modbusDriverEnabled}
            onDriverEnabledChange={onModbusDriverEnabledChange}
            onDevicesChange={onModbusDevicesChange}
            onDatapointDragStart={onModbusDatapointDragStart}
            onPingDevice={onPingModbusDevice}
            deviceStatus={modbusDeviceStatus}
            selectedDatapointPath={selectedModbusDatapointPath}
            allNodes={allNodes}
            onReadConfigValue={onReadConfigValue}
            onWriteConfigValue={onWriteConfigValue}
          />
        )}

        {(node.type === 'modbus-device-input' || node.type === 'modbus-device-output') && (
          <ModbusDeviceBlockConfig
            node={node}
            deviceName={config.modbusDeviceName || 'Unbekanntes Geraet'}
            datapoints={node.type === 'modbus-device-input'
              ? (modbusDevices.find(d => d.id === config.modbusDeviceId)?.inputDatapoints || [])
              : (modbusDevices.find(d => d.id === config.modbusDeviceId)?.outputDatapoints || [])
            }
          />
        )}

        {(node.data.inputs.length > 0 || node.data.outputs.length > 0) && node.type !== 'python-script' && !node.type.startsWith('modbus-') && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Ports
            </label>
            <div className="space-y-1">
              {node.data.inputs.map(port => (
                <div key={port.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/40 rounded">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300 flex-1">{port.label}</span>
                  <span className="text-xs text-slate-500">Eingang</span>
                </div>
              ))}
              {node.data.outputs.map(port => (
                <div key={port.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/40 rounded">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300 flex-1">{port.label}</span>
                  <span className="text-xs text-slate-500">Ausgang</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
