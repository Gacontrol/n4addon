import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodePalette } from './components/NodePalette';
import { FlowCanvas } from './components/FlowCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useFlowEditor } from './hooks/useFlowEditor';
import { NodeTemplate, FlowNode } from './types/flow';
import { Save, Upload, Workflow } from 'lucide-react';

function App() {
  const {
    nodes,
    connections,
    selectedNode,
    connectingFrom,
    addNode,
    updateNodePosition,
    updateNodeData,
    deleteNode,
    startConnection,
    endConnection,
    cancelConnection,
    setSelectedNode
  } = useFlowEditor();

  const [ghostNode, setGhostNode] = useState<{ label: string; x: number; y: number; template: NodeTemplate } | null>(null);
  const isDraggingFromPalette = useRef(false);
  const ghostNodeRef = useRef<{ label: string; x: number; y: number; template: NodeTemplate } | null>(null);

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
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
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
              inputs: template.inputs.map((input, idx) => ({
                ...input,
                id: `input-${idx}`
              })),
              outputs: template.outputs.map((output, idx) => ({
                ...output,
                id: `output-${idx}`
              }))
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

  const handleCanvasClick = () => {
    setSelectedNode(null);
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode) || null;

  const handleExport = () => {
    const data = { nodes, connections, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiresheet-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          JSON.parse(e.target?.result as string);
        } catch (error) {
          console.error('Import-Fehler:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <header className="bg-slate-800 border-b border-slate-700 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Workflow className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Wiresheet Editor</h1>
              <p className="text-xs text-slate-500">Home Assistant Flow-Programmierung</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </header>

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
          onCanvasClick={handleCanvasClick}
          ghostNode={ghostNode}
        />

        {selectedNodeData && (
          <PropertiesPanel
            node={selectedNodeData}
            onClose={() => setSelectedNode(null)}
            onUpdateNode={updateNodeData}
          />
        )}
      </div>

      <div className="bg-slate-800 border-t border-slate-700 px-5 py-1.5 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{nodes.length} Knoten &middot; {connections.length} Verbindungen</span>
          <span>Wiresheet für Home Assistant</span>
        </div>
      </div>
    </div>
  );
}

export default App;
