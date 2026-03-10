import React, { useState, useEffect } from 'react';
import { FlowNode, NodeConfig } from '../types/flow';
import { X, Link, Search, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

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
  onReloadEntities: () => void;
  liveValues: Record<string, unknown>;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
  onClose,
  onUpdateNode,
  haEntities,
  haLoading,
  onReloadEntities,
  liveValues
}) => {
  const [entitySearch, setEntitySearch] = useState(node.data.entityId || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [config, setConfig] = useState<NodeConfig>(node.data.config || {});

  useEffect(() => {
    setEntitySearch(node.data.entityId || '');
    setConfig(node.data.config || {});
  }, [node.id]);

  const isHANode = node.type === 'ha-input' || node.type === 'ha-output';
  const liveValue = liveValues[node.id];

  const filtered = haEntities.filter(e => {
    if (!entitySearch) return true;
    const q = entitySearch.toLowerCase();
    return e.entity_id.toLowerCase().includes(q) ||
      String(e.attributes.friendly_name || '').toLowerCase().includes(q);
  }).slice(0, 80);

  const handleEntitySelect = (entity: HAEntity) => {
    setEntitySearch(entity.entity_id);
    onUpdateNode(node.id, {
      entityId: entity.entity_id,
      entityLabel: String(entity.attributes.friendly_name || entity.entity_id)
    });
    setShowDropdown(false);
  };

  const handleEntityInputChange = (val: string) => {
    setEntitySearch(val);
    onUpdateNode(node.id, { entityId: val, entityLabel: val });
    setShowDropdown(true);
  };

  const updateConfig = (key: keyof NodeConfig, value: unknown) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onUpdateNode(node.id, { config: next });
  };

  const selectedEntity = haEntities.find(e => e.entity_id === node.data.entityId);

  return (
    <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col flex-shrink-0 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold text-white">{node.data.label}</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{node.type}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {liveValue !== undefined && (
          <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-lg px-3 py-2">
            <p className="text-xs text-emerald-400 font-semibold mb-0.5">Live-Wert</p>
            <p className="text-sm text-emerald-300 font-mono">{String(liveValue)}</p>
          </div>
        )}

        {isHANode && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                HA Entity
              </label>
              <button
                onClick={onReloadEntities}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="Entities neu laden"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${haLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 focus-within:border-blue-500 transition-colors">
                <Link className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={entitySearch}
                  onChange={(e) => handleEntityInputChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Entity suchen oder eingeben..."
                  className="bg-transparent text-xs text-white placeholder-slate-500 outline-none flex-1 font-mono min-w-0"
                />
                <button
                  onClick={() => setShowDropdown(v => !v)}
                  className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                >
                  {showDropdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-600 rounded-lg overflow-hidden shadow-xl z-50">
                  <div className="p-2 border-b border-slate-700 flex items-center gap-2">
                    <Search className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400">
                      {haEntities.length > 0 ? `${haEntities.length} Entities` : haLoading ? 'Lädt...' : 'HA nicht verbunden'}
                    </span>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filtered.length === 0 && !haLoading && (
                      <div className="px-3 py-3 text-xs text-slate-500 text-center">
                        {entitySearch ? `Keine Entity für "${entitySearch}" gefunden` : 'HA Entities nicht geladen'}
                      </div>
                    )}
                    {filtered.map(entity => {
                      const friendlyName = String(entity.attributes.friendly_name || '');
                      const isSelected = node.data.entityId === entity.entity_id;
                      return (
                        <button
                          key={entity.entity_id}
                          onClick={() => handleEntitySelect(entity)}
                          className="w-full flex items-start gap-2 px-3 py-2 hover:bg-slate-700 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate font-mono leading-tight">{entity.entity_id}</p>
                            {friendlyName && (
                              <p className="text-xs text-slate-400 truncate leading-tight mt-0.5">{friendlyName}</p>
                            )}
                            <p className="text-xs text-slate-500 leading-tight mt-0.5">
                              Wert: <span className="text-slate-300">{entity.state}</span>
                            </p>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {selectedEntity && (
              <div className="mt-2 space-y-1">
                <div className="px-2.5 py-1.5 bg-slate-900/60 border border-slate-700 rounded text-xs">
                  <span className="text-slate-400">Aktuell: </span>
                  <span className="text-white font-mono">{selectedEntity.state}</span>
                  {selectedEntity.attributes.unit_of_measurement && (
                    <span className="text-slate-400 ml-1">{String(selectedEntity.attributes.unit_of_measurement)}</span>
                  )}
                </div>
              </div>
            )}

            {entitySearch && !selectedEntity && (
              <div className="mt-2 px-2.5 py-1.5 bg-blue-950/40 border border-blue-800/40 rounded text-xs text-blue-300 font-mono break-all">
                {entitySearch}
              </div>
            )}
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
                onChange={(e) => updateConfig('delayMs', parseInt(e.target.value) || 0)}
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
              onChange={(e) => updateConfig('thresholdValue', parseFloat(e.target.value) || 0)}
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
                onChange={(e) => updateConfig('compareOperator', e.target.value)}
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
                onChange={(e) => updateConfig('compareValue', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                placeholder="Fest oder von Port B"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-slate-500"
              />
              <p className="text-xs text-slate-500 mt-1">Leer = Port B Eingang verwenden</p>
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
              onChange={(e) => updateConfig('cronExpression', e.target.value)}
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
              onChange={(e) => updateConfig('triggerState', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        {node.data.inputs.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Eingänge
            </label>
            <div className="space-y-1">
              {node.data.inputs.map(port => {
                const pLive = liveValues[`${node.id}-${port.id}`];
                return (
                  <div key={port.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/40 rounded">
                    <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-xs text-slate-300 flex-1">{port.label}</span>
                    {pLive !== undefined && (
                      <span className="text-xs text-blue-300 font-mono">{String(pLive)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {node.data.outputs.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Ausgänge
            </label>
            <div className="space-y-1">
              {node.data.outputs.map(port => (
                <div key={port.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/40 rounded">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300">{port.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
