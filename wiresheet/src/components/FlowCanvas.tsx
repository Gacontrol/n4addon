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
  ghostNode?: { label: string; x: number; y: number; template?: unknown } | null;
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
  onCanvasClick,
  ghostNode
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if ((connectingFrom || ghostNode) && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [connectingFrom, ghostNode]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if ((connectingFrom || ghostNode) && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [connectingFrom, ghostNode]);

  const getPortPosition = (nodeId: string, portId: string, isOutput: boolean) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const portEl = document.querySelector(`[data-port-id="${nodeId}-${portId}"]`);
    if (portEl && canvasRef.current) {
      const portRect = portEl.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      return {
        x: portRect.left - canvasRect.left + portRect.width / 2,
        y: portRect.top - canvasRect.top + portRect.height / 2
      };
    }

    const portIndex = isOutput
      ? node.data.outputs.findIndex(p => p.id === portId)
      : node.data.inputs.findIndex(p => p.id === portId);

    const headerH = 30;
    const entityH = node.type === 'ha-input' || node.type === 'ha-output' ? 32 : 0;
    const paddingTop = 8;
    const rowHeight = 22;

    return {
      x: node.position.x + (isOutput ? 160 : 0),
      y: node.position.y + headerH + entityH + paddingTop + portIndex * rowHeight + 6
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
    if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'flow-canvas') {
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
      className="flex-1 relative overflow-hidden"
      onClick={handleCanvasClick}
      style={{
        background: '#0f172a',
        backgroundImage: `
          radial-gradient(circle, #1e293b 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px'
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#10b981" opacity="0.8" />
          </marker>
          <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" opacity="0.9" />
          </marker>
        </defs>

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
          <FlowNode
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            onPositionChange={onNodePositionChange}
            onSelect={onNodeSelect}
            onDelete={onNodeDelete}
            onPortClick={handlePortClick}
            isConnecting={!!connectingFrom}
            connectingFromNodeId={connectingFrom?.nodeId}
          />
        ))}
      </div>

      {ghostNode && canvasRef.current && (() => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const cx = ghostNode.x - rect.left;
        const cy = ghostNode.y - rect.top;
        const isOver = cx >= 0 && cy >= 0 && cx <= rect.width && cy <= rect.height;
        return (
          <div
            className="absolute pointer-events-none rounded-lg px-3 py-2 text-xs text-white font-medium"
            style={{
              left: cx,
              top: cy,
              background: '#1e293b',
              border: `2px dashed ${isOver ? '#60a5fa' : '#475569'}`,
              opacity: isOver ? 0.85 : 0.4,
              transform: 'translate(-50%, -50%)',
              zIndex: 50,
              whiteSpace: 'nowrap'
            }}
          >
            {ghostNode.label}
          </div>
        );
      })()}

      {connectingFrom && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white px-4 py-1.5 rounded-full shadow-lg z-50 pointer-events-none">
          <p className="text-xs font-medium">Eingangs-Port auswählen</p>
        </div>
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-slate-600 text-5xl mb-3">⬡</div>
            <p className="text-slate-500 text-sm">Bausteine aus der linken Palette hierher ziehen</p>
          </div>
        </div>
      )}
    </div>
  );
};
