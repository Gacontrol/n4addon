import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FlowNode } from './FlowNode';
import { ConnectionLine } from './ConnectionLine';
import { FlowNode as FlowNodeType, Connection, DatapointOverride } from '../types/flow';
import { Trash2, Copy, Clipboard, Type, ZoomIn, ZoomOut } from 'lucide-react';

interface ContextMenuState {
  x: number;
  y: number;
  type: 'node' | 'connection' | 'canvas';
  targetId?: string;
}

interface LassoState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface FlowCanvasProps {
  nodes: FlowNodeType[];
  connections: Connection[];
  selectedNodes: Set<string>;
  selectedConnection: string | null;
  connectingFrom: { nodeId: string; portId: string } | null;
  clipboard: { nodes: FlowNodeType[]; connections: Connection[] } | null;
  onNodePositionChange: (id: string, x: number, y: number) => void;
  onMultipleNodePositionsChange: (updates: Array<{ id: string; x: number; y: number }>) => void;
  onNodeSelect: (id: string, addToSelection?: boolean) => void;
  onNodesSelect: (ids: string[]) => void;
  onNodeDelete: (id: string) => void;
  onConnectionStart: (nodeId: string, portId: string) => void;
  onConnectionEnd: (nodeId: string, portId: string) => void;
  onConnectionCancel: () => void;
  onConnectionSelect: (id: string | null) => void;
  onConnectionDelete: (id: string) => void;
  onClearSelection: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDeleteSelected: () => void;
  onContainerResize?: (nodeId: string, width: number, height: number) => void;
  onCaseResize?: (nodeId: string, caseIndex: number, height: number) => void;
  onMoveNodeToContainer?: (nodeId: string, containerId: string, caseIndex: number) => void;
  onMoveNodeOutOfContainer?: (nodeId: string) => void;
  onDuplicateSelected?: () => void;
  onAddTextAnnotation?: (x: number, y: number) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  ghostNode?: { label: string; x: number; y: number; template?: unknown } | null;
  liveValues?: Record<string, unknown>;
  onOverrideChange?: (nodeId: string, override: DatapointOverride) => void;
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  connections,
  selectedNodes,
  selectedConnection,
  connectingFrom,
  clipboard,
  onNodePositionChange,
  onMultipleNodePositionsChange,
  onNodeSelect,
  onNodesSelect,
  onNodeDelete,
  onConnectionStart,
  onConnectionEnd,
  onConnectionCancel,
  onConnectionSelect,
  onConnectionDelete,
  onClearSelection,
  onCopy,
  onPaste,
  onDeleteSelected,
  onContainerResize,
  onCaseResize,
  onMoveNodeToContainer,
  onMoveNodeOutOfContainer,
  onDuplicateSelected,
  onAddTextAnnotation,
  zoom = 1,
  onZoomChange,
  ghostNode,
  liveValues = {},
  onOverrideChange
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [, forceUpdate] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [lasso, setLasso] = useState<LassoState | null>(null);
  const [isDraggingMultiple, setIsDraggingMultiple] = useState(false);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragStartMouse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      setMousePos({
        x: e.clientX - rect.left + scrollLeft,
        y: e.clientY - rect.top + scrollTop
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    forceUpdate(n => n + 1);
  }, [nodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        onCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        onPaste();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onDuplicateSelected?.();
      } else if (e.key === 'Escape') {
        onClearSelection();
        onConnectionCancel();
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDeleteSelected, onCopy, onPaste, onDuplicateSelected, onClearSelection, onConnectionCancel]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-context-menu]')) return;
      setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onZoomChange) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.min(2, Math.max(0.25, zoom + delta));
        onZoomChange(newZoom);
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoom, onZoomChange]);

  const getPortCenter = useCallback((nodeId: string, portId: string): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const el = canvasRef.current.querySelector(`[data-port-id="${nodeId}-${portId}"]`);
    if (!el) return null;
    const portRect = el.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scrollLeft = canvasRef.current.scrollLeft;
    const scrollTop = canvasRef.current.scrollTop;
    return {
      x: (portRect.left - canvasRect.left + portRect.width / 2 + scrollLeft) / zoom,
      y: (portRect.top - canvasRect.top + portRect.height / 2 + scrollTop) / zoom
    };
  }, [zoom]);

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
    if (e.button === 2) return;
    const target = e.target as HTMLElement;
    const isOnNode = target.closest('[data-node-id]');
    const isOnPort = target.closest('.port') || target.closest('.node-port');

    if (isOnPort) {
      return;
    }

    if (!isOnNode) {
      if (!e.shiftKey && !connectingFrom) {
        onClearSelection();
      }

      if (connectingFrom) {
        onConnectionCancel();
        return;
      }

      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLasso({ startX: x, startY: y, currentX: x, currentY: y });

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (lasso && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setLasso(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top
      } : null);
    }

    if (isDraggingMultiple && dragStartMouse.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      const currentX = e.clientX - rect.left + scrollLeft;
      const currentY = e.clientY - rect.top + scrollTop;
      const dx = (currentX - dragStartMouse.current.x) / zoom;
      const dy = (currentY - dragStartMouse.current.y) / zoom;

      const updates: Array<{ id: string; x: number; y: number }> = [];
      dragStartPositions.current.forEach((pos, id) => {
        updates.push({ id, x: Math.max(0, pos.x + dx), y: Math.max(0, pos.y + dy) });
      });
      onMultipleNodePositionsChange(updates);
    }
  };

  const handleCanvasPointerUp = () => {
    if (lasso) {
      const minX = Math.min(lasso.startX, lasso.currentX) / zoom;
      const maxX = Math.max(lasso.startX, lasso.currentX) / zoom;
      const minY = Math.min(lasso.startY, lasso.currentY) / zoom;
      const maxY = Math.max(lasso.startY, lasso.currentY) / zoom;

      if (Math.abs(maxX - minX) > 5 || Math.abs(maxY - minY) > 5) {
        const selectedIds = nodes.filter(node => {
          const nx = node.position.x;
          const ny = node.position.y;
          const nw = 180;
          const nh = 60;
          return nx < maxX && nx + nw > minX && ny < maxY && ny + nh > minY;
        }).map(n => n.id);

        if (selectedIds.length > 0) {
          onNodesSelect(selectedIds);
        }
      }
      setLasso(null);
    }

    if (isDraggingMultiple) {
      setIsDraggingMultiple(false);
      dragStartPositions.current.clear();
      dragStartMouse.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'canvas'
    });
  };

  const handleNodeContextMenu = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;

    if (!selectedNodes.has(nodeId)) {
      onNodeSelect(nodeId);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'node',
      targetId: nodeId
    });
  };

  const handleConnectionClick = (connId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectionSelect(connId);
  };

  const handleConnectionContextMenu = (connId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;
    onConnectionSelect(connId);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'connection',
      targetId: connId
    });
  };

  const handleMultiDragStart = (nodeId: string, e: React.PointerEvent) => {
    if (selectedNodes.size > 1 && selectedNodes.has(nodeId) && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      dragStartMouse.current = {
        x: e.clientX - rect.left + scrollLeft,
        y: e.clientY - rect.top + scrollTop
      };
      dragStartPositions.current.clear();
      nodes.filter(n => selectedNodes.has(n.id)).forEach(n => {
        dragStartPositions.current.set(n.id, { x: n.position.x, y: n.position.y });
      });
      setIsDraggingMultiple(true);
    }
  };

  const connectingFromPos = connectingFrom
    ? getPortCenter(connectingFrom.nodeId, connectingFrom.portId)
    : null;

  const lassoRect = lasso ? {
    x: Math.min(lasso.startX, lasso.currentX) / zoom,
    y: Math.min(lasso.startY, lasso.currentY) / zoom,
    width: Math.abs(lasso.currentX - lasso.startX) / zoom,
    height: Math.abs(lasso.currentY - lasso.startY) / zoom
  } : null;

  return (
    <div
      id="flow-canvas"
      ref={canvasRef}
      className="flex-1 relative overflow-auto"
      data-zoom={zoom}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onContextMenu={handleContextMenu}
      style={{
        background: '#0f172a',
        backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`
      }}
    >
      {onZoomChange && (
        <div className="absolute top-3 right-3 z-50 flex items-center gap-1 bg-slate-800/90 rounded-lg px-2 py-1 border border-slate-600">
          <button
            onClick={() => onZoomChange(Math.max(0.25, zoom - 0.1))}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Verkleinern"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-300 font-mono min-w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(2, zoom + 0.1))}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Vergroessern"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => onZoomChange(1)}
            className="ml-1 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Zuruecksetzen"
          >
            Reset
          </button>
        </div>
      )}
      <svg
        id="canvas-bg"
        className="origin-top-left"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 10,
          pointerEvents: 'none',
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          width: '5000px',
          height: '5000px',
          minWidth: `${100 / zoom}%`,
          minHeight: `${100 / zoom}%`
        }}
      >
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#10b981" opacity="0.8" />
          </marker>
          <marker id="arr-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
          </marker>
          <marker id="arr-selected" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
          </marker>
        </defs>

        <g style={{ pointerEvents: 'auto' }}>
          {connections.map(conn => {
            const start = getPortCenter(conn.source, conn.sourcePort);
            const end = getPortCenter(conn.target, conn.targetPort);
            if (!start || !end) return null;
            const connValue = liveValues[conn.source];
            const isSelected = selectedConnection === conn.id;
            return (
              <ConnectionLine
                key={conn.id}
                x1={start.x} y1={start.y}
                x2={end.x} y2={end.y}
                color={isSelected ? '#f59e0b' : '#10b981'}
                liveValue={connValue}
                isSelected={isSelected}
                onClick={(e) => handleConnectionClick(conn.id, e)}
                onContextMenu={(e) => handleConnectionContextMenu(conn.id, e)}
              />
            );
          })}
        </g>

        {connectingFrom && connectingFromPos && (
          <ConnectionLine
            x1={connectingFromPos.x} y1={connectingFromPos.y}
            x2={mousePos.x / zoom} y2={mousePos.y / zoom}
            color="#60a5fa"
            isActive
          />
        )}

        {lassoRect && lassoRect.width > 5 && lassoRect.height > 5 && (
          <rect
            x={lassoRect.x}
            y={lassoRect.y}
            width={lassoRect.width}
            height={lassoRect.height}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        )}
      </svg>

      <div
        className="origin-top-left"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 5,
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          width: '5000px',
          height: '5000px',
          minWidth: `${100 / zoom}%`,
          minHeight: `${100 / zoom}%`
        }}
      >
        {nodes
          .filter(n => n.type === 'case-container')
          .map(node => {
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
                isSelected={selectedNodes.has(node.id)}
                onPositionChange={onNodePositionChange}
                onSelect={(id, e) => {
                  const addToSelection = e?.ctrlKey || e?.metaKey || e?.shiftKey;
                  onNodeSelect(id, addToSelection);
                }}
                onDelete={onNodeDelete}
                onPortClick={handlePortClick}
                onOverrideChange={onOverrideChange}
                isConnecting={!!connectingFrom}
                connectingFromNodeId={connectingFrom?.nodeId}
                liveValues={liveValues}
                portValues={portValues}
                onContextMenu={handleNodeContextMenu}
                onMultiDragStart={handleMultiDragStart}
                onContainerResize={onContainerResize}
                onCaseResize={onCaseResize}
                isMultiSelected={selectedNodes.size > 1 && selectedNodes.has(node.id)}
                isDraggingMultiple={isDraggingMultiple}
                zoom={zoom}
              />
            );
          })}
        {nodes
          .filter(n => n.type !== 'case-container')
          .map(node => {
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

            const parentContainer = node.data.parentContainerId
              ? nodes.find(n => n.id === node.data.parentContainerId)
              : null;

            let adjustedNode = node;
            const isContainerSelected = parentContainer ? selectedNodes.has(parentContainer.id) : false;
            if (parentContainer && parentContainer.type === 'case-container') {
              const caseIndex = node.data.caseIndex ?? 0;
              const headerHeight = 36;
              const caseHeaderHeight = 24;
              const cases = parentContainer.data.config?.cases || [];
              const defaultCaseHeight = 120;
              let caseOffsetY = 0;
              for (let i = 0; i < caseIndex; i++) {
                caseOffsetY += (cases[i]?.height || defaultCaseHeight);
              }
              caseOffsetY += caseHeaderHeight;

              adjustedNode = {
                ...node,
                position: {
                  x: parentContainer.position.x + node.position.x + 4,
                  y: parentContainer.position.y + headerHeight + caseOffsetY + node.position.y + 4
                },
                data: {
                  ...node.data,
                  _dimmed: !isContainerSelected,
                  _inContainer: true,
                  _containerSelected: isContainerSelected
                }
              };
            } else if (parentContainer) {
              adjustedNode = {
                ...node,
                position: {
                  x: parentContainer.position.x + node.position.x + 4,
                  y: parentContainer.position.y + node.position.y + 80
                }
              };
            }

            return (
              <FlowNode
                key={node.id}
                node={adjustedNode}
                isSelected={selectedNodes.has(node.id)}
                onPositionChange={(id, x, y) => {
                  if (parentContainer && parentContainer.type === 'case-container') {
                    const caseIndex = node.data.caseIndex ?? 0;
                    const headerHeight = 36;
                    const caseHeaderHeight = 24;
                    const cases = parentContainer.data.config?.cases || [];
                    const defaultCaseHeight = 120;
                    let caseOffsetY = 0;
                    for (let i = 0; i < caseIndex; i++) {
                      caseOffsetY += (cases[i]?.height || defaultCaseHeight);
                    }
                    caseOffsetY += caseHeaderHeight;
                    const relX = x - parentContainer.position.x - 4;
                    const relY = y - parentContainer.position.y - headerHeight - caseOffsetY - 4;
                    onNodePositionChange(id, Math.max(0, relX), Math.max(0, relY));
                  } else if (parentContainer) {
                    const relX = x - parentContainer.position.x - 4;
                    const relY = y - parentContainer.position.y - 80;
                    onNodePositionChange(id, Math.max(0, relX), Math.max(0, relY));
                  } else {
                    onNodePositionChange(id, x, y);
                  }
                }}
                onSelect={(id, e) => {
                  const addToSelection = e?.ctrlKey || e?.metaKey || e?.shiftKey;
                  onNodeSelect(id, addToSelection);
                }}
                onDelete={onNodeDelete}
                onPortClick={handlePortClick}
                onOverrideChange={onOverrideChange}
                isConnecting={!!connectingFrom}
                connectingFromNodeId={connectingFrom?.nodeId}
                liveValues={liveValues}
                portValues={portValues}
                onContextMenu={handleNodeContextMenu}
                onMultiDragStart={handleMultiDragStart}
                onContainerResize={onContainerResize}
                onCaseResize={onCaseResize}
                onDropIntoContainer={onMoveNodeToContainer}
                onDropOutOfContainer={onMoveNodeOutOfContainer}
                isMultiSelected={selectedNodes.size > 1 && selectedNodes.has(node.id)}
                isDraggingMultiple={isDraggingMultiple}
                parentContainer={parentContainer}
                zoom={zoom}
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
          Eingangs-Port auswaehlen - ESC zum Abbrechen
        </div>
      )}

      {nodes.length === 0 && !ghostNode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-40">
            <p className="text-slate-400 text-sm">Bausteine aus der Palette links hierher ziehen</p>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          data-context-menu
          className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 z-50 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.type === 'node' && (
            <>
              <button
                onClick={() => { onCopy(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors text-left"
              >
                <Copy className="w-3.5 h-3.5" />
                Kopieren (Ctrl+C)
              </button>
              <button
                onClick={() => { onDuplicateSelected?.(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors text-left"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplizieren (Ctrl+D)
              </button>
              <button
                onClick={() => { onDeleteSelected(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Loeschen (Del)
              </button>
            </>
          )}
          {contextMenu.type === 'connection' && (
            <button
              onClick={() => { if (contextMenu.targetId) onConnectionDelete(contextMenu.targetId); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700 transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Verbindung loeschen (Del)
            </button>
          )}
          {contextMenu.type === 'canvas' && (
            <>
              <button
                onClick={() => { onPaste(); setContextMenu(null); }}
                disabled={!clipboard || clipboard.nodes.length === 0}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${
                  clipboard && clipboard.nodes.length > 0
                    ? 'text-slate-300 hover:bg-slate-700'
                    : 'text-slate-500 cursor-not-allowed'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                Einfuegen (Ctrl+V)
              </button>
              <button
                onClick={() => {
                  if (canvasRef.current) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    const scrollLeft = canvasRef.current.scrollLeft;
                    const scrollTop = canvasRef.current.scrollTop;
                    const x = (contextMenu.x - rect.left + scrollLeft) / zoom;
                    const y = (contextMenu.y - rect.top + scrollTop) / zoom;
                    onAddTextAnnotation?.(x, y);
                  }
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors text-left"
              >
                <Type className="w-3.5 h-3.5" />
                Text einfuegen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
