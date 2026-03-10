import React, { useState, useEffect } from 'react';
import { CustomBlockDefinition, CustomBlockPort, FlowNode, Connection } from '../types/flow';
import * as Icons from 'lucide-react';

const ICON_OPTIONS = [
  'Box', 'Cpu', 'Cog', 'Gauge', 'Thermometer', 'Droplet', 'Wind', 'Zap',
  'Power', 'Activity', 'Timer', 'Clock', 'Bell', 'AlertTriangle', 'Shield',
  'Lock', 'Unlock', 'Eye', 'EyeOff', 'Sun', 'Moon', 'Lightbulb', 'Plug',
  'Fan', 'Heater', 'Snowflake', 'Flame', 'Waves', 'Compass', 'Move',
  'RotateCcw', 'RefreshCw', 'Play', 'Pause', 'Square', 'CircleDot', 'Target'
];

const COLOR_OPTIONS = [
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#10b981', label: 'Gruen' },
  { value: '#3b82f6', label: 'Blau' },
  { value: '#8b5cf6', label: 'Violett' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Rot' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#f97316', label: 'Amber' }
];

interface CustomBlockEditorProps {
  block: Partial<CustomBlockDefinition> | null;
  selectedNodes: FlowNode[];
  selectedConnections: Connection[];
  allNodes: FlowNode[];
  allConnections: Connection[];
  onSave: (block: CustomBlockDefinition) => void;
  onCancel: () => void;
}

export const CustomBlockEditor: React.FC<CustomBlockEditorProps> = ({
  block,
  selectedNodes,
  selectedConnections,
  allNodes,
  allConnections,
  onSave,
  onCancel
}) => {
  const isEditing = !!block?.id;

  const [name, setName] = useState(block?.name || '');
  const [description, setDescription] = useState(block?.description || '');
  const [icon, setIcon] = useState(block?.icon || 'Box');
  const [color, setColor] = useState(block?.color || '#06b6d4');
  const [category, setCategory] = useState(block?.category || 'Allgemein');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const nodesToUse = isEditing ? (block?.nodes || []) : selectedNodes;
  const connectionsToUse = isEditing
    ? (block?.connections || [])
    : selectedConnections.filter(conn => {
        const hasSource = selectedNodes.some(n => n.id === conn.source);
        const hasTarget = selectedNodes.some(n => n.id === conn.target);
        return hasSource && hasTarget;
      });

  const [inputs, setInputs] = useState<CustomBlockPort[]>(() => {
    if (isEditing && block?.inputs) return block.inputs;

    const blockInputs: CustomBlockPort[] = [];
    const nodeIds = new Set(nodesToUse.map(n => n.id));

    allConnections.forEach(conn => {
      if (nodeIds.has(conn.target) && !nodeIds.has(conn.source)) {
        const targetNode = nodesToUse.find(n => n.id === conn.target);
        const targetPort = targetNode?.data.inputs.find(p => p.id === conn.targetPort);
        if (targetNode && targetPort) {
          const existingInput = blockInputs.find(
            i => i.mappedNodeId === conn.target && i.mappedPortId === conn.targetPort
          );
          if (!existingInput) {
            blockInputs.push({
              id: `in-${blockInputs.length + 1}`,
              label: `${targetNode.data.label} ${targetPort.label}`,
              type: 'input',
              mappedNodeId: conn.target,
              mappedPortId: conn.targetPort
            });
          }
        }
      }
    });

    nodesToUse.forEach(node => {
      if (node.type === 'ha-input' || node.type.startsWith('dp-')) {
        const hasIncomingExternal = allConnections.some(
          c => c.target === node.id && !nodeIds.has(c.source)
        );
        if (!hasIncomingExternal && node.data.inputs.length > 0) {
          node.data.inputs.forEach(port => {
            const existingInput = blockInputs.find(
              i => i.mappedNodeId === node.id && i.mappedPortId === port.id
            );
            if (!existingInput) {
              blockInputs.push({
                id: `in-${blockInputs.length + 1}`,
                label: `${node.data.label} ${port.label}`,
                type: 'input',
                mappedNodeId: node.id,
                mappedPortId: port.id
              });
            }
          });
        }
      }
    });

    return blockInputs;
  });

  const [outputs, setOutputs] = useState<CustomBlockPort[]>(() => {
    if (isEditing && block?.outputs) return block.outputs;

    const blockOutputs: CustomBlockPort[] = [];
    const nodeIds = new Set(nodesToUse.map(n => n.id));

    allConnections.forEach(conn => {
      if (nodeIds.has(conn.source) && !nodeIds.has(conn.target)) {
        const sourceNode = nodesToUse.find(n => n.id === conn.source);
        const sourcePort = sourceNode?.data.outputs.find(p => p.id === conn.sourcePort);
        if (sourceNode && sourcePort) {
          const existingOutput = blockOutputs.find(
            o => o.mappedNodeId === conn.source && o.mappedPortId === conn.sourcePort
          );
          if (!existingOutput) {
            blockOutputs.push({
              id: `out-${blockOutputs.length + 1}`,
              label: `${sourceNode.data.label} ${sourcePort.label}`,
              type: 'output',
              mappedNodeId: conn.source,
              mappedPortId: conn.sourcePort
            });
          }
        }
      }
    });

    nodesToUse.forEach(node => {
      if (node.type === 'ha-output') {
        node.data.outputs.forEach(port => {
          const existingOutput = blockOutputs.find(
            o => o.mappedNodeId === node.id && o.mappedPortId === port.id
          );
          if (!existingOutput) {
            blockOutputs.push({
              id: `out-${blockOutputs.length + 1}`,
              label: `${node.data.label} ${port.label}`,
              type: 'output',
              mappedNodeId: node.id,
              mappedPortId: port.id
            });
          }
        });
      }
    });

    return blockOutputs;
  });

  const handleSave = () => {
    if (!name.trim()) {
      alert('Bitte gib einen Namen ein');
      return;
    }

    const now = Date.now();
    const normalizedNodes = nodesToUse.map(node => {
      const minX = Math.min(...nodesToUse.map(n => n.position.x));
      const minY = Math.min(...nodesToUse.map(n => n.position.y));
      return {
        ...node,
        position: {
          x: node.position.x - minX,
          y: node.position.y - minY
        }
      };
    });

    const newBlock: CustomBlockDefinition = {
      id: block?.id || `custom-block-${now}`,
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
      category: category.trim() || 'Allgemein',
      inputs,
      outputs,
      nodes: normalizedNodes,
      connections: connectionsToUse,
      createdAt: block?.createdAt || now,
      updatedAt: now
    };

    onSave(newBlock);
  };

  const updateInputLabel = (index: number, label: string) => {
    setInputs(prev => prev.map((inp, i) => i === index ? { ...inp, label } : inp));
  };

  const updateOutputLabel = (index: number, label: string) => {
    setOutputs(prev => prev.map((out, i) => i === index ? { ...out, label } : out));
  };

  const removeInput = (index: number) => {
    setInputs(prev => prev.filter((_, i) => i !== index));
  };

  const removeOutput = (index: number) => {
    setOutputs(prev => prev.filter((_, i) => i !== index));
  };

  const IconComponent = Icons[icon as keyof typeof Icons] as React.FC<{ className?: string }>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-800 border border-slate-600 rounded-xl w-[600px] max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + '30', color }}
            >
              {IconComponent && <IconComponent className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {isEditing ? 'Baustein bearbeiten' : 'Neuen Baustein erstellen'}
              </h3>
              <p className="text-xs text-slate-400">
                {nodesToUse.length} Nodes, {connectionsToUse.length} Verbindungen
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. Pumpen-Baustein"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Kategorie</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="z.B. Heizung"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Beschreibung</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung des Bausteins..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Icon</label>
              <div className="relative">
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white flex items-center gap-2 hover:border-slate-500 transition-colors"
                >
                  {IconComponent && <IconComponent className="w-4 h-4" />}
                  <span>{icon}</span>
                  <Icons.ChevronDown className="w-4 h-4 ml-auto text-slate-400" />
                </button>
                {showIconPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowIconPicker(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-600 rounded-lg p-2 z-20 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-6 gap-1">
                        {ICON_OPTIONS.map(iconName => {
                          const IC = Icons[iconName as keyof typeof Icons] as React.FC<{ className?: string }>;
                          return (
                            <button
                              key={iconName}
                              onClick={() => { setIcon(iconName); setShowIconPicker(false); }}
                              className={`p-2 rounded hover:bg-slate-700 transition-colors ${icon === iconName ? 'bg-cyan-900/50 text-cyan-400' : 'text-slate-400'}`}
                              title={iconName}
                            >
                              {IC && <IC className="w-4 h-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Farbe</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    className={`w-7 h-7 rounded-lg transition-all ${color === opt.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''}`}
                    style={{ backgroundColor: opt.value }}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Icons.ArrowRightToLine className="w-3.5 h-3.5" />
                  Eingaenge ({inputs.length})
                </label>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {inputs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">Keine Eingaenge definiert</p>
                ) : (
                  inputs.map((inp, idx) => (
                    <div key={inp.id} className="flex items-center gap-1.5 bg-slate-900 rounded-lg p-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <input
                        type="text"
                        value={inp.label}
                        onChange={e => updateInputLabel(idx, e.target.value)}
                        className="flex-1 bg-transparent text-xs text-white outline-none min-w-0"
                      />
                      <button
                        onClick={() => removeInput(idx)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Icons.X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Icons.ArrowRightFromLine className="w-3.5 h-3.5" />
                  Ausgaenge ({outputs.length})
                </label>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {outputs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">Keine Ausgaenge definiert</p>
                ) : (
                  outputs.map((out, idx) => (
                    <div key={out.id} className="flex items-center gap-1.5 bg-slate-900 rounded-lg p-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      <input
                        type="text"
                        value={out.label}
                        onChange={e => updateOutputLabel(idx, e.target.value)}
                        className="flex-1 bg-transparent text-xs text-white outline-none min-w-0"
                      />
                      <button
                        onClick={() => removeOutput(idx)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Icons.X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-3">
            <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
              <Icons.Layers className="w-3.5 h-3.5" />
              Enthaltene Nodes ({nodesToUse.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {nodesToUse.map(node => (
                <span
                  key={node.id}
                  className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded"
                >
                  {node.data.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <Icons.Save className="w-4 h-4" />
            {isEditing ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
};
