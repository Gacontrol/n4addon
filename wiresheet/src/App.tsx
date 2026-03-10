import { useState, useRef, useCallback, useEffect } from 'react';
import { NodePalette } from './components/NodePalette';
import { FlowCanvas } from './components/FlowCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CustomBlockLibrary } from './components/CustomBlockLibrary';
import { CustomBlockEditor } from './components/CustomBlockEditor';
import { useWiresheetPages } from './hooks/useWiresheetPages';
import { useCustomBlocks } from './hooks/useCustomBlocks';
import { NodeTemplate, FlowNode, CustomBlockDefinition, Connection } from './types/flow';
import {
  Workflow, Plus, X, Play, Square, ChevronDown, ChevronUp,
  Clock, Save, Check, AlertCircle, Pencil, Blocks, LayoutGrid
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
    loadPages,
    nodes,
    connections,
    selectedNodes,
    selectedConnection,
    connectingFrom,
    clipboard,
    addNode,
    updateNodePosition,
    updateMultipleNodePositions,
    updateNodeData,
    updateNodeOverride,
    deleteNode,
    deleteConnection,
    selectNode,
    selectNodes,
    clearSelection,
    selectConnection,
    copySelection,
    pasteClipboard,
    deleteSelected,
    startConnection,
    endConnection,
    cancelConnection,
    addConnection,
    updateContainerSize,
    updateCaseSize,
    moveNodeToContainer
  } = useWiresheetPages();

  const {
    blocks: customBlocks,
    addBlock,
    deleteBlock,
    duplicateBlock,
    importBlocks,
    exportBlock,
    exportAllBlocks
  } = useCustomBlocks();

  const [ghostNode, setGhostNode] = useState<{ label: string; x: number; y: number; template: NodeTemplate } | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [showCycleEditor, setShowCycleEditor] = useState(false);
  const [cycleInput, setCycleInput] = useState(String(activePage.cycleMs));
  const [sidebarTab, setSidebarTab] = useState<'nodes' | 'blocks'>('nodes');
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CustomBlockDefinition | null>(null);
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
          let x = e.clientX - rect.left - 90;
          let y = e.clientY - rect.top - 30;

          const allDropZones = document.querySelectorAll('[data-case-drop-zone]');
          let dropZone: Element | null = null;

          for (const zone of allDropZones) {
            const zoneRect = zone.getBoundingClientRect();
            if (
              e.clientX >= zoneRect.left && e.clientX <= zoneRect.right &&
              e.clientY >= zoneRect.top && e.clientY <= zoneRect.bottom
            ) {
              dropZone = zone;
              break;
            }
          }

          let parentContainerId: string | undefined;
          let caseIndex: number | undefined;

          if (dropZone) {
            parentContainerId = dropZone.getAttribute('data-case-drop-zone') || undefined;
            const caseIndexAttr = dropZone.getAttribute('data-case-index');
            if (caseIndexAttr !== null) {
              caseIndex = parseInt(caseIndexAttr);
            }
            const containerNode = nodes.find(n => n.id === parentContainerId);
            if (containerNode && containerNode.type === 'case-container') {
              const dropZoneRect = dropZone.getBoundingClientRect();
              x = Math.max(4, e.clientX - dropZoneRect.left - 90);
              y = Math.max(4, e.clientY - dropZoneRect.top - 30);
              console.log('Drop in case container:', { parentContainerId, caseIndex, x, y });
            }
          }

          const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newNode: FlowNode = {
            id: newNodeId,
            type: template.type,
            position: { x: Math.max(0, x), y: Math.max(0, y) },
            data: {
              label: template.label,
              icon: template.icon,
              config: template.defaultConfig ? { ...template.defaultConfig } : undefined,
              inputs: template.inputs.map((input, idx) => ({ ...input, id: `input-${idx}` })),
              outputs: template.outputs.map((output, idx) => ({ ...output, id: `output-${idx}` })),
              parentContainerId,
              caseIndex
            }
          };

          addNode(newNode);
          selectNode(newNode.id);

          if (parentContainerId && caseIndex !== undefined) {
            const containerNode = nodes.find(n => n.id === parentContainerId);
            if (containerNode && containerNode.type === 'case-container') {
              const cases = containerNode.data.config?.cases || [];
              if (cases[caseIndex]) {
                const updatedCases = cases.map((c: { id: string; label: string; nodeIds?: string[] }, idx: number) => {
                  if (idx === caseIndex) {
                    return { ...c, nodeIds: [...(c.nodeIds || []), newNodeId] };
                  }
                  return c;
                });
                updateNodeData(parentContainerId, {
                  config: { ...containerNode.data.config, cases: updatedCases }
                });
              }
            }
          }
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
  }, [addNode, selectNode, nodes, updateNodeData]);

  const selectedNodeData = selectedNodes.size === 1
    ? nodes.find(n => selectedNodes.has(n.id)) || null
    : null;

  const handleApplyCycleTime = () => {
    const ms = parseInt(cycleInput);
    if (!isNaN(ms) && ms >= 20) {
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

  const cycleOptions = [20, 50, 100, 250, 500, 1000, 2000, 5000];

  const handleCreateBlockFromSelection = useCallback(() => {
    if (selectedNodes.size < 1) return;
    setEditingBlock(null);
    setShowBlockEditor(true);
  }, [selectedNodes]);

  const handleEditBlock = useCallback((block: CustomBlockDefinition) => {
    setEditingBlock(block);
    setShowBlockEditor(true);
  }, []);

  const handleSaveBlock = useCallback((block: CustomBlockDefinition) => {
    addBlock(block);
    setShowBlockEditor(false);
    setEditingBlock(null);
  }, [addBlock]);

  const handleAddBlockToCanvas = useCallback((block: CustomBlockDefinition) => {
    const now = Date.now();
    const idMap = new Map<string, string>();

    const baseX = 200;
    const baseY = 200;

    const newNodes: FlowNode[] = block.nodes.map(node => {
      const newId = `node-${now}-${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + baseX,
          y: node.position.y + baseY
        }
      };
    });

    const newConns: Connection[] = block.connections.map(conn => ({
      ...conn,
      id: `${idMap.get(conn.source)}-${conn.sourcePort}-${idMap.get(conn.target)}-${conn.targetPort}`,
      source: idMap.get(conn.source)!,
      target: idMap.get(conn.target)!
    }));

    newNodes.forEach(n => addNode(n));
    setTimeout(() => {
      newConns.forEach(c => addConnection(c));
      selectNodes(newNodes.map(n => n.id));
    }, 50);
  }, [addNode, addConnection, selectNodes]);

  const selectedNodesList = nodes.filter(n => selectedNodes.has(n.id));
  const selectedConnectionsList = connections.filter(c =>
    selectedNodes.has(c.source) && selectedNodes.has(c.target)
  );

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
                      min={20}
                      step={10}
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
          <button onClick={() => { loadPages(); loadHaEntities(); }} className="ml-auto text-xs text-blue-400 hover:text-blue-300 transition-colors">Erneut laden</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col">
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setSidebarTab('nodes')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                sidebarTab === 'nodes'
                  ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Bausteine
            </button>
            <button
              onClick={() => setSidebarTab('blocks')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                sidebarTab === 'blocks'
                  ? 'bg-slate-800 text-white border-b-2 border-cyan-500'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Blocks className="w-3.5 h-3.5" />
              Eigene
              {customBlocks.length > 0 && (
                <span className="bg-cyan-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {customBlocks.length}
                </span>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {sidebarTab === 'nodes' ? (
              <NodePalette onNodePointerDown={handleNodePointerDown} />
            ) : (
              <CustomBlockLibrary
                blocks={customBlocks}
                onCreateBlock={handleCreateBlockFromSelection}
                onEditBlock={handleEditBlock}
                onDeleteBlock={deleteBlock}
                onDuplicateBlock={duplicateBlock}
                onExportBlock={exportBlock}
                onExportAll={exportAllBlocks}
                onImportBlocks={importBlocks}
                onAddBlockToCanvas={handleAddBlockToCanvas}
                canCreateFromSelection={selectedNodes.size >= 1}
              />
            )}
          </div>
        </div>

        <FlowCanvas
          nodes={nodes}
          connections={connections}
          selectedNodes={selectedNodes}
          selectedConnection={selectedConnection}
          connectingFrom={connectingFrom}
          clipboard={clipboard}
          onNodePositionChange={updateNodePosition}
          onMultipleNodePositionsChange={updateMultipleNodePositions}
          onNodeSelect={selectNode}
          onNodesSelect={selectNodes}
          onNodeDelete={deleteNode}
          onConnectionStart={startConnection}
          onConnectionEnd={endConnection}
          onConnectionCancel={cancelConnection}
          onConnectionSelect={selectConnection}
          onConnectionDelete={deleteConnection}
          onClearSelection={clearSelection}
          onCopy={copySelection}
          onPaste={pasteClipboard}
          onDeleteSelected={deleteSelected}
          onContainerResize={updateContainerSize}
          onCaseResize={updateCaseSize}
          onMoveNodeToContainer={(nodeId, containerId, caseIndex) => moveNodeToContainer(nodeId, containerId, caseIndex)}
          ghostNode={ghostNode}
          liveValues={liveValues}
          onOverrideChange={updateNodeOverride}
        />

        {selectedNodeData && (
          <PropertiesPanel
            node={selectedNodeData}
            onClose={() => clearSelection()}
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
            {selectedNodes.size > 0 && (
              <span className="ml-2 text-blue-400">
                {selectedNodes.size} ausgewaehlt
              </span>
            )}
            {selectedConnection && (
              <span className="ml-2 text-amber-400">
                Verbindung ausgewaehlt
              </span>
            )}
            {activePage.running && (
              <span className="ml-2 text-emerald-400 font-medium">
                Laeuft ({activePage.cycleMs >= 1000 ? `${activePage.cycleMs / 1000}s` : `${activePage.cycleMs}ms`} Zyklus)
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${haEntities.length > 0 ? 'bg-emerald-400' : haError ? 'bg-red-400' : 'bg-amber-400'}`} />
              <span className={haEntities.length > 0 ? 'text-emerald-400' : haError ? 'text-red-400' : 'text-amber-400'}>
                {haEntities.length > 0 ? `HA: ${haEntities.length}` : haError ? 'HA: Fehler' : 'HA: ...'}
              </span>
            </span>
            <span>{activePage.name}</span>
          </span>
        </div>
      </div>

      {showBlockEditor && (
        <CustomBlockEditor
          block={editingBlock}
          selectedNodes={selectedNodesList}
          selectedConnections={selectedConnectionsList}
          allNodes={nodes}
          allConnections={connections}
          onSave={handleSaveBlock}
          onCancel={() => { setShowBlockEditor(false); setEditingBlock(null); }}
        />
      )}
    </div>
  );
}

export default App;
