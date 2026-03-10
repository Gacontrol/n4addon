import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FlowNode } from './FlowNode';
import { ConnectionLine } from './ConnectionLine';
import { FlowNode as FlowNodeType, Connection, DatapointOverride } from '../types/flow';

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
  liveValues?: Record<string, unknown>;
  onOverrideChange?: (nodeId: string, override: DatapointOverride) => void;
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
  ghostNode,
  liveValues = {},
  onOverrideChange
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, []);

  useEffect(() => {
    forceUpdate(n => n + 1);
  }, [nodes]);

  const getPortCenter = useCallback((nodeId: string, portId: string): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const el = canvasRef.current.querySelector(`[data-port-id="${nodeId}-${portId}"]`);
    if (!el) return null;
    const portRect = el.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    return {
      x: portRect.left - canvasRect.left + portRect.width / 2,
      y: portRect.top - canvasRect.top + portRect.height / 2
    };
  }, []);

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

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.id === 'flow-canvas' || target.closest('#canvas-bg')) {
      onCanvasClick();
      if (connectingFrom) onConnectionCancel();
    }
  };

  const connectingFromPos = connectingFrom
    ? getPortCenter(connectingFrom.nodeId, connectingFrom.portId)
    : null;

  return (
    <div
      id="flow-canvas"
      ref={canvasRef}
      className="flex-1 relative overflow-hidden"
      onPointerDown={handleCanvasPointerDown}
      style={{
        background: '#0f172a',
        backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      <svg
        id="canvas-bg"
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0, pointerEvents: 'none' }}
      >
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#10b981" opacity="0.8" />
          </marker>
          <marker id="arr-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
          </marker>
        </defs>

        {connections.map(conn => {
          const start = getPortCenter(conn.source, conn.sourcePort);
          const end = getPortCenter(conn.target, conn.targetPort);
          if (!start || !end) return null;
          const connValue = liveValues[conn.source];
          return (
            <ConnectionLine
              key={conn.id}
              x1={start.x} y1={start.y}
              x2={end.x} y2={end.y}
              color="#10b981"
              liveValue={connValue}
            />
          );
        })}

        {connectingFrom && connectingFromPos && (
          <ConnectionLine
            x1={connectingFromPos.x} y1={connectingFromPos.y}
            x2={mousePos.x} y2={mousePos.y}
            color="#60a5fa"
            isActive
          />
        )}
      </svg>

      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        {nodes.map(node => {
          const portValues: Record<string, unknown> = {};
          for (const input of node.data.inputs) {
            const conn = connections.find(c => c.target === node.id && c.targetPort === input.id);
            if (conn) {
              const srcVal = liveValues[conn.source];
              if (srcVal !== undefined && srcVal !== null) {
                portValues[input.id] = srcVal;
              }
            }
          }
          return (
            <FlowNode
              key={node.id}
              node={node}
              isSelected={selectedNode === node.id}
              onPositionChange={onNodePositionChange}
              onSelect={onNodeSelect}
              onDelete={onNodeDelete}
              onPortClick={handlePortClick}
              onOverrideChange={onOverrideChange}
              isConnecting={!!connectingFrom}
              connectingFromNodeId={connectingFrom?.nodeId}
              liveValues={liveValues}
              portValues={portValues}
            />
          );
        })}
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
              left: cx, top: cy,
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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white px-4 py-1.5 rounded-full text-xs font-medium pointer-events-none" style={{ zIndex: 60 }}>
          Eingangs-Port auswählen — Klick auf Canvas zum Abbrechen
        </div>
      )}

      {nodes.length === 0 && !ghostNode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-40">
            <p className="text-slate-400 text-sm">Bausteine aus der Palette links hierher ziehen</p>
          </div>
        </div>
      )}
    </div>
  );
};
