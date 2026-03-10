import React, { useRef, useState, useEffect } from 'react';
import { FlowNode } from './FlowNode';
import { ConnectionLine } from './ConnectionLine';
import { FlowNode as FlowNodeType, Connection } from '../types/flow';

interface FlowCanvasProps {
  nodes: FlowNodeType[];
  connections: Connection[];
  selectedNode: string | null;
  connectingFrom: { nodeId: string; portId: string } | null;
  onNodePositionChange: (id: string, x: number, y: number) => void;
  onNodeSelect: (id: string) => void;
  onNodeDelete: (id: string) => void;
  onConnectionStart: (nodeId: string, portId: string) => void;
  onConnectionEnd: (nodeId: string, portId: string) => void;
  onConnectionCancel: () => void;
  onCanvasClick: () => void;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  connections,
  selectedNode,
  connectingFrom,
  onNodePositionChange,
  onNodeSelect,
  onNodeDelete,
  onConnectionStart,
  onConnectionEnd,
  onConnectionCancel,
  onCanvasClick
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (connectingFrom && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [connectingFrom]);

  const getPortPosition = (nodeId: string, portId: string, isOutput: boolean) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) {
      const portIndex = isOutput
        ? node.data.outputs.findIndex(p => p.id === portId)
        : node.data.inputs.findIndex(p => p.id === portId);

      const baseY = isOutput ? 60 : 40;
      const spacing = 24;

      return {
        x: node.position.x + (isOutput ? 200 : 0),
        y: node.position.y + baseY + portIndex * spacing
      };
    }

    const rect = nodeElement.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return { x: 0, y: 0 };

    return {
      x: rect.left - canvasRect.left + (isOutput ? rect.width : 0),
      y: rect.top - canvasRect.top + rect.height / 2
    };
  };

  const handlePortClick = (nodeId: string, portId: string, isOutput: boolean) => {
    if (isOutput) {
      if (connectingFrom) {
        onConnectionCancel();
      } else {
        onConnectionStart(nodeId, portId);
      }
    } else {
      if (connectingFrom) {
        onConnectionEnd(nodeId, portId);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCanvasClick();
      if (connectingFrom) {
        onConnectionCancel();
      }
    }
  };

  return (
    <div
      id="flow-canvas"
      ref={canvasRef}
      className="flex-1 bg-slate-900 relative overflow-hidden"
      onClick={handleCanvasClick}
      style={{
        backgroundImage: `
          radial-gradient(circle, #334155 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px'
      }}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {connections.map(conn => {
          const sourceNode = nodes.find(n => n.id === conn.source);
          const targetNode = nodes.find(n => n.id === conn.target);

          if (!sourceNode || !targetNode) return null;

          const start = getPortPosition(conn.source, conn.sourcePort, true);
          const end = getPortPosition(conn.target, conn.targetPort, false);

          return (
            <ConnectionLine
              key={conn.id}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              color="#10b981"
            />
          );
        })}

        {connectingFrom && (
          <ConnectionLine
            x1={getPortPosition(connectingFrom.nodeId, connectingFrom.portId, true).x}
            y1={getPortPosition(connectingFrom.nodeId, connectingFrom.portId, true).y}
            x2={mousePos.x}
            y2={mousePos.y}
            color="#60a5fa"
            isActive
          />
        )}
      </svg>

      <div className="relative" style={{ zIndex: 1 }}>
        {nodes.map(node => (
          <div key={node.id} data-node-id={node.id}>
            <FlowNode
              node={node}
              isSelected={selectedNode === node.id}
              onPositionChange={onNodePositionChange}
              onSelect={onNodeSelect}
              onDelete={onNodeDelete}
              onPortClick={handlePortClick}
              isConnecting={!!connectingFrom}
            />
          </div>
        ))}
      </div>

      {connectingFrom && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <p className="text-sm font-medium">Wähle einen Eingang zum Verbinden</p>
        </div>
      )}
    </div>
  );
};
