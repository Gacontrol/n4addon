import React, { useState } from 'react';
import { NodePalette } from './components/NodePalette';
import { FlowCanvas } from './components/FlowCanvas';
import { useFlowEditor } from './hooks/useFlowEditor';
import { NodeTemplate, FlowNode } from './types/flow';
import { Save, Upload, Play, Home } from 'lucide-react';

function App() {
  const {
    nodes,
    connections,
    selectedNode,
    connectingFrom,
    addNode,
    updateNodePosition,
    deleteNode,
    startConnection,
    endConnection,
    cancelConnection,
    setSelectedNode
  } = useFlowEditor();

  const [draggedTemplate, setDraggedTemplate] = useState<NodeTemplate | null>(null);

  const handleNodeDragStart = (template: NodeTemplate) => {
    setDraggedTemplate(template);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTemplate) return;

    const canvas = document.getElementById('flow-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 100;
    const y = e.clientY - rect.top - 50;

    const newNode: FlowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: draggedTemplate.type,
      position: { x, y },
      data: {
        label: draggedTemplate.label,
        icon: draggedTemplate.icon,
        inputs: draggedTemplate.inputs.map((input, idx) => ({
          ...input,
          id: `input-${idx}`
        })),
        outputs: draggedTemplate.outputs.map((output, idx) => ({
          ...output,
          id: `output-${idx}`
        }))
      }
    };

    addNode(newNode);
    setDraggedTemplate(null);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasClick = () => {
    setSelectedNode(null);
  };

  const handleExport = () => {
    const data = {
      nodes,
      connections,
      timestamp: new Date().toISOString()
    };

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
          const data = JSON.parse(e.target?.result as string);
          console.log('Imported data:', data);
        } catch (error) {
          console.error('Fehler beim Import:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Wiresheet Editor</h1>
              <p className="text-sm text-slate-400">Visueller Flow-Editor für Home Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Importieren</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Exportieren</span>
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Ausführen</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NodePalette onNodeDragStart={handleNodeDragStart} />

        <div
          className="flex-1"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
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
          />
        </div>

        {selectedNode && (
          <div className="w-80 bg-slate-800 border-l border-slate-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Eigenschaften</h3>
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-sm text-slate-400">Node: {selectedNode}</p>
              <p className="text-xs text-slate-500 mt-2">
                Konfigurationsoptionen werden hier angezeigt
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="bg-slate-800 border-t border-slate-700 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div>
            Nodes: {nodes.length} | Verbindungen: {connections.length}
          </div>
          <div>
            Wiresheet Editor für Home Assistant
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
