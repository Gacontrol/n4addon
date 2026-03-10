import React, { useState } from 'react';
import { FlowNode } from '../types/flow';
import { X, Link, Search, Check } from 'lucide-react';

const COMMON_ENTITIES = [
  { id: 'light.wohnzimmer', label: 'Wohnzimmer Licht', domain: 'light' },
  { id: 'light.schlafzimmer', label: 'Schlafzimmer Licht', domain: 'light' },
  { id: 'switch.steckdose_1', label: 'Steckdose 1', domain: 'switch' },
  { id: 'switch.steckdose_2', label: 'Steckdose 2', domain: 'switch' },
  { id: 'sensor.temperature_wohnzimmer', label: 'Temperatur Wohnzimmer', domain: 'sensor' },
  { id: 'sensor.humidity_bad', label: 'Luftfeuchtigkeit Bad', domain: 'sensor' },
  { id: 'binary_sensor.movement_flur', label: 'Bewegung Flur', domain: 'binary_sensor' },
  { id: 'binary_sensor.door_haustuer', label: 'Haustür Kontakt', domain: 'binary_sensor' },
  { id: 'input_boolean.mode_away', label: 'Abwesend Modus', domain: 'input_boolean' },
  { id: 'input_number.thermostat_target', label: 'Zieltemperatur', domain: 'input_number' },
  { id: 'climate.heizung', label: 'Heizung', domain: 'climate' },
  { id: 'cover.rolladen_wohnzimmer', label: 'Rolladen Wohnzimmer', domain: 'cover' },
];

interface PropertiesPanelProps {
  node: FlowNode;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<FlowNode['data']>) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node, onClose, onUpdateNode }) => {
  const [search, setSearch] = useState('');
  const [showEntityPicker, setShowEntityPicker] = useState(false);

  const isHANode = node.type === 'ha-input' || node.type === 'ha-output';

  const filtered = COMMON_ENTITIES.filter(e =>
    e.id.toLowerCase().includes(search.toLowerCase()) ||
    e.label.toLowerCase().includes(search.toLowerCase())
  );

  const domainColors: Record<string, string> = {
    light: '#f59e0b',
    switch: '#10b981',
    sensor: '#3b82f6',
    binary_sensor: '#0ea5e9',
    input_boolean: '#8b5cf6',
    input_number: '#ec4899',
    climate: '#ef4444',
    cover: '#64748b'
  };

  const handleSelectEntity = (entityId: string, entityLabel: string) => {
    onUpdateNode(node.id, { entityId, entityLabel });
    setShowEntityPicker(false);
  };

  return (
    <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{node.data.label}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Eigenschaften</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isHANode && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Home Assistant Entity
            </label>

            {node.data.entityId ? (
              <div className="bg-slate-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: domainColors[node.data.entityId.split('.')[0]] || '#64748b' }}
                  />
                  <span className="text-sm text-white font-medium truncate">{node.data.entityLabel}</span>
                </div>
                <p className="text-xs text-slate-400 font-mono">{node.data.entityId}</p>
                <button
                  onClick={() => setShowEntityPicker(true)}
                  className="w-full text-xs text-blue-400 hover:text-blue-300 transition-colors text-left"
                >
                  Entity ändern...
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowEntityPicker(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-blue-500 rounded-lg transition-colors text-sm text-slate-400 hover:text-white"
              >
                <Link className="w-4 h-4 flex-shrink-0" />
                Entity verknüpfen...
              </button>
            )}

            {showEntityPicker && (
              <div className="mt-3 bg-slate-900 rounded-lg border border-slate-600 overflow-hidden">
                <div className="p-2 border-b border-slate-700">
                  <div className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Entity suchen..."
                      className="bg-transparent text-xs text-white placeholder-slate-500 outline-none flex-1"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filtered.map(entity => (
                    <button
                      key={entity.id}
                      onClick={() => handleSelectEntity(entity.id, entity.label)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 transition-colors text-left group"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: domainColors[entity.domain] || '#64748b' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{entity.label}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{entity.id}</p>
                      </div>
                      {node.data.entityId === entity.id && (
                        <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">Keine Entities gefunden</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Ports
          </label>
          <div className="space-y-1">
            {node.data.inputs.map(port => (
              <div key={port.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/50 rounded">
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-xs text-slate-300">{port.label}</span>
                <span className="text-xs text-slate-500 ml-auto">Eingang</span>
              </div>
            ))}
            {node.data.outputs.map(port => (
              <div key={port.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/50 rounded">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-xs text-slate-300">{port.label}</span>
                <span className="text-xs text-slate-500 ml-auto">Ausgang</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Typ
          </label>
          <p className="text-xs text-slate-400 font-mono bg-slate-700/50 px-2 py-1.5 rounded">{node.type}</p>
        </div>
      </div>
    </div>
  );
};
