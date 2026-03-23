import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search, X, Check, Link2, Layers, Cpu, Tag } from 'lucide-react';
import { FlowNode } from '../../types/flow';

interface NodePort {
  id: string;
  label: string;
  isOutput: boolean;
}

interface NodeConfigParam {
  key: string;
  label: string;
}

interface NodeBrowserProps {
  nodes: FlowNode[];
  logicSheets?: { id: string; name: string; nodeIds: string[] }[];
  selectedNodeId?: string;
  selectedPortId?: string;
  selectedParamKey?: string;
  getNodeLabel: (node: FlowNode) => string;
  getNodePorts: (node: FlowNode) => NodePort[];
  getNodeConfigParams: (node: FlowNode) => NodeConfigParam[];
  isWriteWidget?: boolean;
  onSelectNode: (nodeId: string) => void;
  onSelectPort?: (portId: string) => void;
  onSelectParam?: (paramKey: string) => void;
  onClear: () => void;
}

export const NodeBrowser: React.FC<NodeBrowserProps> = ({
  nodes,
  logicSheets,
  selectedNodeId,
  selectedPortId,
  selectedParamKey,
  getNodeLabel,
  getNodePorts,
  getNodeConfigParams,
  isWriteWidget,
  onSelectNode,
  onSelectPort,
  onSelectParam,
  onClear,
}) => {
  const [search, setSearch] = useState('');
  const [openSheets, setOpenSheets] = useState<Set<string>>(new Set());
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());

  const nodeIdToSheet = useMemo(() => {
    const map = new Map<string, string>();
    if (logicSheets) {
      for (const sheet of logicSheets) {
        for (const nodeId of sheet.nodeIds) {
          map.set(nodeId, sheet.name);
        }
      }
    }
    return map;
  }, [logicSheets]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filteredNodes = q
      ? nodes.filter(n => getNodeLabel(n).toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
      : nodes;

    const sheetMap = new Map<string, FlowNode[]>();
    for (const node of filteredNodes) {
      const sheetName = nodeIdToSheet.get(node.id) || 'Sonstige';
      if (!sheetMap.has(sheetName)) sheetMap.set(sheetName, []);
      sheetMap.get(sheetName)!.push(node);
    }

    if (logicSheets && logicSheets.length > 0) {
      const ordered: { name: string; nodes: FlowNode[] }[] = [];
      for (const sheet of logicSheets) {
        const ns = sheetMap.get(sheet.name);
        if (ns && ns.length > 0) ordered.push({ name: sheet.name, nodes: ns });
      }
      const sonstige = sheetMap.get('Sonstige');
      if (sonstige && sonstige.length > 0) ordered.push({ name: 'Sonstige', nodes: sonstige });
      return ordered;
    }

    return Array.from(sheetMap.entries()).map(([name, ns]) => ({ name, nodes: ns }));
  }, [nodes, logicSheets, nodeIdToSheet, search, getNodeLabel]);

  const isSearching = search.trim().length > 0;

  const toggleSheet = (name: string) => {
    setOpenSheets(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleNode = (id: string) => {
    setOpenNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedPorts = selectedNode ? getNodePorts(selectedNode) : [];
  const selectedParams = selectedNode ? getNodeConfigParams(selectedNode) : [];
  const hasPorts = selectedPorts.length > 0 || selectedParams.length > 0;

  const currentLabel = () => {
    if (!selectedNode) return null;
    if (selectedParamKey) {
      const p = selectedParams.find(p => p.key === selectedParamKey);
      return p ? p.label : selectedParamKey;
    }
    if (selectedPortId) {
      const p = selectedPorts.find(p => p.id === selectedPortId);
      return p ? p.label : selectedPortId;
    }
    return 'Hauptwert';
  };

  return (
    <div className="space-y-2">
      {selectedNodeId ? (
        <div className="flex flex-col gap-1.5 p-2 bg-green-900/20 border border-green-700 rounded">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-green-500 shrink-0" />
            <div className="text-xs text-green-400 flex-1 min-w-0">
              {nodeIdToSheet.get(selectedNodeId) && (
                <p className="text-[10px] text-green-600/70 mb-0.5 flex items-center gap-1 truncate">
                  <Layers className="w-2.5 h-2.5 flex-shrink-0" />
                  {nodeIdToSheet.get(selectedNodeId)}
                </p>
              )}
              <p className="font-medium truncate">{selectedNode ? getNodeLabel(selectedNode) : selectedNodeId}</p>
              {currentLabel() && <p className="text-green-600/60 mt-0.5 truncate">{currentLabel()}</p>}
            </div>
            <button onClick={onClear} className="text-slate-400 hover:text-red-400 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {hasPorts && (selectedPortId !== undefined || selectedParamKey !== undefined || onSelectPort || onSelectParam) && (
            <div className="mt-1 space-y-1">
              {isWriteWidget ? (
                <>
                  {selectedPorts.filter(p => !p.isOutput).length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Eingaenge (schreiben)</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPorts.filter(p => !p.isOutput).map(p => (
                          <button
                            key={p.id}
                            onClick={() => onSelectPort?.(p.id)}
                            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${selectedPortId === p.id ? 'bg-green-600/40 text-green-300 border border-green-600' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedParams.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Parameter</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedParams.map(p => (
                          <button
                            key={p.key}
                            onClick={() => onSelectParam?.(p.key)}
                            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${selectedParamKey === p.key ? 'bg-amber-600/40 text-amber-300 border border-amber-600' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {selectedPorts.filter(p => p.isOutput).length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Ausgaenge (lesen)</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPorts.filter(p => p.isOutput).map(p => (
                          <button
                            key={p.id}
                            onClick={() => onSelectPort?.(p.id)}
                            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${selectedPortId === p.id ? 'bg-green-600/40 text-green-300 border border-green-600' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedPorts.filter(p => !p.isOutput).length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Eingaenge (lesen)</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPorts.filter(p => !p.isOutput).map(p => (
                          <button
                            key={p.id}
                            onClick={() => onSelectPort?.(p.id)}
                            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${selectedPortId === p.id ? 'bg-sky-600/40 text-sky-300 border border-sky-600' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedParams.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-0.5">Parameter</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedParams.map(p => (
                          <button
                            key={p.key}
                            onClick={() => onSelectParam?.(p.key)}
                            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${selectedParamKey === p.key ? 'bg-amber-600/40 text-amber-300 border border-amber-600' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded">
          <Unlink className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400">Keine Verknuepfung</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 focus-within:border-blue-500 transition-colors">
        <Search className="w-3 h-3 text-slate-400 shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Baustein suchen..."
          className="bg-transparent text-xs text-white placeholder-slate-500 outline-none flex-1"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-200">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto max-h-64 space-y-0.5 rounded border border-slate-700 bg-slate-800/30 p-1">
        {grouped.length === 0 && (
          <div className="text-center py-3 text-xs text-slate-500">Keine Bausteine gefunden</div>
        )}
        {grouped.map(sheet => (
          <div key={sheet.name}>
            <button
              onClick={() => toggleSheet(sheet.name)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 hover:bg-slate-700/50 rounded text-left transition-colors"
            >
              {(openSheets.has(sheet.name) || isSearching)
                ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
              }
              <Layers className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300 truncate">{sheet.name}</span>
              <span className="text-xs text-slate-500 ml-auto shrink-0">{sheet.nodes.length}</span>
            </button>

            {(openSheets.has(sheet.name) || isSearching) && (
              <div className="ml-3">
                {sheet.nodes.map(node => {
                  const ports = getNodePorts(node);
                  const params = getNodeConfigParams(node);
                  const hasSubs = ports.length > 0 || params.length > 0;
                  const isSelected = node.id === selectedNodeId;
                  const isOpen = openNodes.has(node.id) || (isSelected && hasSubs);
                  return (
                    <div key={node.id}>
                      <button
                        onClick={() => {
                          onSelectNode(node.id);
                          if (hasSubs) toggleNode(node.id);
                        }}
                        className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-colors ${
                          isSelected ? 'bg-blue-600/20 border border-blue-600/30' : 'hover:bg-slate-700/50'
                        }`}
                      >
                        {hasSubs
                          ? (isOpen
                              ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                              : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />)
                          : <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                        }
                        <Cpu className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="text-xs text-slate-300 truncate flex-1">{getNodeLabel(node)}</span>
                        {isSelected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                      </button>

                      {isOpen && hasSubs && (
                        <div className="ml-5 space-y-0.5 pb-0.5">
                          <button
                            onClick={() => { onSelectNode(node.id); onSelectPort?.(''); onSelectParam?.(''); }}
                            className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left transition-colors text-[10px] ${
                              isSelected && !selectedPortId && !selectedParamKey ? 'text-green-300 bg-green-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                            }`}
                          >
                            <Tag className="w-2.5 h-2.5 shrink-0" /> Hauptwert
                          </button>
                          {isWriteWidget ? (
                            <>
                              {ports.filter(p => !p.isOutput).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => { if (!isSelected) onSelectNode(node.id); onSelectPort?.(p.id); }}
                                  className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left transition-colors text-[10px] ${
                                    isSelected && selectedPortId === p.id ? 'text-green-300 bg-green-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                                  }`}
                                >
                                  <Tag className="w-2.5 h-2.5 shrink-0 text-green-600" /> {p.label}
                                </button>
                              ))}
                              {params.map(p => (
                                <button
                                  key={p.key}
                                  onClick={() => { if (!isSelected) onSelectNode(node.id); onSelectParam?.(p.key); }}
                                  className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left transition-colors text-[10px] ${
                                    isSelected && selectedParamKey === p.key ? 'text-amber-300 bg-amber-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                                  }`}
                                >
                                  <Tag className="w-2.5 h-2.5 shrink-0 text-amber-600" /> {p.label}
                                </button>
                              ))}
                            </>
                          ) : (
                            <>
                              {ports.filter(p => p.isOutput).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => { if (!isSelected) onSelectNode(node.id); onSelectPort?.(p.id); }}
                                  className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left transition-colors text-[10px] ${
                                    isSelected && selectedPortId === p.id ? 'text-green-300 bg-green-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                                  }`}
                                >
                                  <Tag className="w-2.5 h-2.5 shrink-0 text-green-600" /> {p.label}
                                </button>
                              ))}
                              {ports.filter(p => !p.isOutput).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => { if (!isSelected) onSelectNode(node.id); onSelectPort?.(p.id); }}
                                  className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left transition-colors text-[10px] ${
                                    isSelected && selectedPortId === p.id ? 'text-sky-300 bg-sky-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                                  }`}
                                >
                                  <Tag className="w-2.5 h-2.5 shrink-0 text-sky-600" /> {p.label}
                                </button>
                              ))}
                              {params.map(p => (
                                <button
                                  key={p.key}
                                  onClick={() => { if (!isSelected) onSelectNode(node.id); onSelectParam?.(p.key); }}
                                  className={`w-full flex items-center gap-1.5 px-1.5 py-0.5 rounded text-left transition-colors text-[10px] ${
                                    isSelected && selectedParamKey === p.key ? 'text-amber-300 bg-amber-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                                  }`}
                                >
                                  <Tag className="w-2.5 h-2.5 shrink-0 text-amber-600" /> {p.label}
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const Unlink: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    <line x1="4" y1="4" x2="20" y2="20"/>
  </svg>
);
