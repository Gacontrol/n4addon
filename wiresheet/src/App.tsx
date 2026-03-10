import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodePalette } from './components/NodePalette';
import { FlowCanvas } from './components/FlowCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useWiresheetPages } from './hooks/useWiresheetPages';
import { NodeTemplate, FlowNode } from './types/flow';
import {
  Workflow, Plus, X, Play, Square, ChevronDown, ChevronUp,
  Clock, Save, Check, AlertCircle, Pencil
} from 'lucide-react';

function App() {
  const {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    addPage,
    deletePage,
    renamePage,
    setCycleTime,
    startPage,
    stopPage,
    liveValues,
    haEntities,
    haLoading,
    haError,
    loadHaEntities,
    saveStatus,
    loadError,
    nodes,
    connections,
    selectedNode,
    connectingFrom,
    addNode,
    updateNodePosition,
    updateNodeData,
    updateNodeOverride,
    deleteNode,
    startConnection,
    endConnection,
    cancelConnection,
    setSelectedNode
  } = useWiresheetPages();

  const [ghostNode, setGhostNode] = useState<{ label: string; x: number; y: number; template: NodeTemplate } | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [showCycleEditor, setShowCycleEditor] = useState(false);
  const [cycleInput, setCycleInput] = useState(String(activePage.cycleMs));
  const isDraggingFromPalette = useRef(false);
  const ghostNodeRef = useRef<{ label: string; x: number; y: number; template: NodeTemplate } | null>(null);

  useEffect(() => {
    setCycleInput(String(activePage.cycleMs));
  }, [activePageId, activePage.cycleMs]);

  const handleNodePointerDown = useCallback((template: NodeTemplate, clientX: number, clientY: number) => {
    isDraggingFromPalette.current = true;
    const ghost = { label: template.label, x: clientX, y: clientY, template };
    ghostNodeRef.current = ghost;
    setGhostNode(ghost);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingFromPalette.current) return;
      const updated = { ...ghostNodeRef.current!, x: e.clientX, y: e.clientY };
      ghostNodeRef.current = updated;
      setGhostNode(updated);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDraggingFromPalette.current) return;
      isDraggingFromPalette.current = false;

      const canvas = document.getElementById('flow-canvas');
      if (canvas && ghostNodeRef.current) {
        const rect = canvas.getBoundingClientRect();
        const isOverCanvas = (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        );

        if (isOverCanvas) {
          const template = ghostNodeRef.current.template;
          const x = e.clientX - rect.left - 90;
          const y = e.clientY - rect.top - 30;

          const newNode: FlowNode = {
            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: template.type,
            position: { x: Math.max(0, x), y: Math.max(0, y) },
            data: {
              label: template.label,
              icon: template.icon,
              config: template.defaultConfig ? { ...template.defaultConfig } : undefined,
              inputs: template.inputs.map((input, idx) => ({ ...input, id: `input-${idx}` })),
              outputs: template.outputs.map((output, idx) => ({ ...output, id: `output-${idx}` }))
            }
          };

          addNode(newNode);
          setSelectedNode(newNode.id);
        }
      }

      ghostNodeRef.current = null;
      setGhostNode(null);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [addNode, setSelectedNode]);

  const selectedNodeData = nodes.find(n => n.id === selectedNode) || null;

  const handleApplyCycleTime = () => {
    const ms = parseInt(cycleInput);
    if (!isNaN(ms) && ms >= 100) {
      setCycleTime(activePageId, ms);
      setShowCycleEditor(false);
    }
  };

  const handleStartRenaming = (page: typeof pages[0]) => {
    setEditingPageId(page.id);
    setEditingPageName(page.name);
  };

  const handleCommitRename = () => {
    if (editingPageId && editingPageName.trim()) {
      renamePage(editingPageId, editingPageName.trim());
    }
    setEditingPageId(null);
  };

  const cycleOptions = [100, 250, 500, 1000, 2000, 5000, 10000];

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Workflow className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Wiresheet Editor</h1>
              <p className="text-xs text-slate-500 leading-tight">Home Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0 py-0.5">
            {pages.map(page => (
              <div
                key={page.id}
                className="flex items-center gap-1 flex-shrink-0"
              >
                {editingPageId === page.id ? (
                  <input
                    autoFocus
                    value={editingPageName}
                    onChange={(e) => setEditingPageName(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCommitRename(); if (e.key === 'Escape') setEditingPageId(null); }}
                    className="bg-slate-600 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none w-28"
                  />
                ) : (
                  <button
                    onClick={() => setActivePageId(page.id)}
                    onDoubleClick={() => handleStartRenaming(page)}
                    className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      activePageId === page.id
                        ? 'bg-slate-600 text-white'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        page.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    {page.name}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartRenaming(page); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity ml-0.5"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addPage}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowCycleEditor(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-xs"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{activePage.cycleMs >= 1000 ? `${activePage.cycleMs / 1000}s` : `${activePage.cycleMs}ms`}</span>
                {showCycleEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showCycleEditor && (
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl z-50 w-52">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">Zykluszeit</p>
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {cycleOptions.map(ms => (
                      <button
                        key={ms}
                        onClick={() => { setCycleInput(String(ms)); }}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          cycleInput === String(ms) ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={cycleInput}
                      onChange={(e) => setCycleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCycleTime()}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400 self-center">ms</span>
                    <button
                      onClick={handleApplyCycleTime}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => activePage.running ? stopPage(activePageId) : startPage(activePageId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-medium ${
                activePage.running
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {activePage.running ? (
                <><Square className="w-3.5 h-3.5" /> Stopp</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Start</>
              )}
            </button>

            <div className="flex items-center gap-1 text-xs">
              {saveStatus === 'saving' && <span className="text-slate-400 flex items-center gap-1"><Save className="w-3 h-3 animate-pulse" /> Speichert...</span>}
              {saveStatus === 'saved' && <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Gespeichert</span>}
              {saveStatus === 'unsaved' && <span className="text-amber-400 flex items-center gap-1"><Save className="w-3 h-3" /> Ungespeichert</span>}
              {saveStatus === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Fehler</span>}
            </div>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="bg-red-950/80 border-b border-red-800/60 px-4 py-1.5 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{loadError}</span>
          <button onClick={loadHaEntities} className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors">Erneut laden</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <NodePalette onNodePointerDown={handleNodePointerDown} />

        <FlowCanvas
          nodes={nodes}
          connections={connections}
          selectedNode={selectedNode}
          connectingFrom={connectingFrom}
          onNodePositionChange={updateNodePosition}
          onNodeSelect={setSelectedNode}
          onNodeDelete={deleteNode}
          onConnectionStart={startConnection}
          onConnectionEnd={endConnection}
          onConnectionCancel={cancelConnection}
          onCanvasClick={() => setSelectedNode(null)}
          ghostNode={ghostNode}
          liveValues={liveValues}
          onOverrideChange={updateNodeOverride}
        />

        {selectedNodeData && (
          <PropertiesPanel
            node={selectedNodeData}
            onClose={() => setSelectedNode(null)}
            onUpdateNode={updateNodeData}
            haEntities={haEntities}
            haLoading={haLoading}
            haError={haError}
            onReloadEntities={loadHaEntities}
            liveValues={liveValues}
          />
        )}
      </div>

      <div className="bg-slate-800 border-t border-slate-700 px-4 py-1 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {nodes.length} Knoten &middot; {connections.length} Verbindungen
            {activePage.running && (
              <span className="ml-2 text-emerald-400 font-medium">
                Läuft ({activePage.cycleMs >= 1000 ? `${activePage.cycleMs / 1000}s` : `${activePage.cycleMs}ms`} Zyklus)
              </span>
            )}
          </span>
          <span>{activePage.name}</span>
        </div>
      </div>
    </div>
  );
}

export default App;
