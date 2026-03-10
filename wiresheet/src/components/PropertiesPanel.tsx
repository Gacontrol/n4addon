import React, { useState, useEffect } from 'react';
import { FlowNode, NodeConfig, EnumStage } from '../types/flow';
import { X, Plus, Trash2, RefreshCw, Activity } from 'lucide-react';
import { EntityBrowser } from './EntityBrowser';

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
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
  onClose,
  onUpdateNode,
  haEntities,
  haLoading,
  haError,
  onReloadEntities,
  liveValues
}) => {
  const [config, setConfig] = useState<NodeConfig>(node.data.config || {});

  useEffect(() => {
    setConfig(node.data.config || {});
  }, [node.id]);

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

  const dpNodeColor = node.type === 'dp-boolean' ? '#8b5cf6'
    : node.type === 'dp-numeric' ? '#06b6d4'
    : '#f97316';

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col flex-shrink-0 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

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
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-700/50 border border-slate-600 rounded p-2">
                <span className="text-slate-400">True</span>
                <p className="text-white font-mono mt-0.5">true / 1 / on</p>
              </div>
              <div className="bg-slate-700/50 border border-slate-600 rounded p-2">
                <span className="text-slate-400">False</span>
                <p className="text-white font-mono mt-0.5">false / 0 / off</p>
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

        {(node.data.inputs.length > 0 || node.data.outputs.length > 0) && (
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
