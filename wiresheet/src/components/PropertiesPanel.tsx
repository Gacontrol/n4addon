import React, { useState } from 'react';
import { FlowNode } from '../types/flow';
import { X, Link, Search, Check, ChevronDown, ChevronUp } from 'lucide-react';

const SUGGESTED_ENTITIES = [
  { id: 'light.wohnzimmer', label: 'Wohnzimmer Licht' },
  { id: 'light.schlafzimmer', label: 'Schlafzimmer Licht' },
  { id: 'switch.steckdose_1', label: 'Steckdose 1' },
  { id: 'sensor.temperature_wohnzimmer', label: 'Temperatur Wohnzimmer' },
  { id: 'sensor.humidity_bad', label: 'Luftfeuchtigkeit Bad' },
  { id: 'binary_sensor.movement_flur', label: 'Bewegung Flur' },
  { id: 'binary_sensor.door_haustuer', label: 'Haustür Kontakt' },
  { id: 'input_boolean.mode_away', label: 'Abwesend Modus' },
  { id: 'input_number.thermostat_target', label: 'Zieltemperatur' },
  { id: 'climate.heizung', label: 'Heizung' },
  { id: 'cover.rolladen_wohnzimmer', label: 'Rolladen Wohnzimmer' },
];

interface PropertiesPanelProps {
  node: FlowNode;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<FlowNode['data']>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node, onClose, onUpdateNode }) => {
  const [entityInput, setEntityInput] = useState(node.data.entityId || '');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isHANode = node.type === 'ha-input' || node.type === 'ha-output';

  const filtered = SUGGESTED_ENTITIES.filter(e =>
    entityInput.length === 0 ||
    e.id.toLowerCase().includes(entityInput.toLowerCase()) ||
    e.label.toLowerCase().includes(entityInput.toLowerCase())
  );

  const handleEntityChange = (value: string) => {
    setEntityInput(value);
    onUpdateNode(node.id, { entityId: value, entityLabel: value });
  };

  const handleSelectSuggestion = (entityId: string, entityLabel: string) => {
    setEntityInput(entityId);
    onUpdateNode(node.id, { entityId, entityLabel });
    setShowSuggestions(false);
  };

  return (
    <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{node.data.label}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Eigenschaften</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isHANode && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Home Assistant Entity
            </label>

            <div className="relative">
              <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-2 focus-within:border-blue-500 transition-colors">
                <Link className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={entityInput}
                  onChange={(e) => handleEntityChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="z.B. sensor.isma_temperature"
                  className="bg-transparent text-xs text-white placeholder-slate-500 outline-none flex-1 font-mono"
                />
                <button
                  onClick={() => setShowSuggestions(v => !v)}
                  className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                >
                  {showSuggestions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-600 rounded-lg overflow-hidden shadow-xl z-50">
                  <div className="p-2 border-b border-slate-700">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Search className="w-3 h-3" />
                      <span>Vorschläge</span>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filtered.map(entity => (
                      <button
                        key={entity.id}
                        onClick={() => handleSelectSuggestion(entity.id, entity.label)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate font-mono">{entity.id}</p>
                          <p className="text-xs text-slate-500 truncate">{entity.label}</p>
                        </div>
                        {node.data.entityId === entity.id && (
                          <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-3 py-3 text-xs text-slate-500 text-center">
                        Tippe die Entity-ID ein (z.B. sensor.isma_co2)
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-slate-700">
                    <p className="text-xs text-slate-500">
                      Beliebige HA Entity-ID eingeben (z.B. sensor.isma_temperature_1)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {entityInput && (
              <div className="mt-2 px-2.5 py-1.5 bg-blue-950/50 border border-blue-800/50 rounded text-xs text-blue-300 font-mono break-all">
                {entityInput}
              </div>
            )}
          </div>
        )}

        {node.data.inputs.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Eingänge
            </label>
            <div className="space-y-1">
              {node.data.inputs.map(port => (
                <div key={port.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/40 rounded">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300">{port.label}</span>
                </div>
              ))}
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

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Typ
          </label>
          <p className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1.5 rounded">{node.type}</p>
        </div>
      </div>
    </div>
  );
};
