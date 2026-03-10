import React, { useRef, useState } from 'react';
import { FlowNode as FlowNodeType } from '../types/flow';
import * as Icons from 'lucide-react';

interface FlowNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPortClick: (nodeId: string, portId: string, isOutput: boolean) => void;
  isConnecting: boolean;
  connectingFromNodeId?: string | null;
  liveValues?: Record<string, unknown>;
}

export const FlowNode: React.FC<FlowNodeProps> = ({
  node,
  isSelected,
  onPositionChange,
  onSelect,
  onDelete,
  onPortClick,
  isConnecting,
  connectingFromNodeId,
  liveValues = {}
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const { data } = node;
  const IconComponent = data.icon
    ? (Icons[data.icon as keyof typeof Icons] as React.FC<{ className?: string }>)
    : null;

  const getNodeColor = () => {
    if (node.type === 'ha-input') return '#3b82f6';
    if (node.type === 'ha-output') return '#f59e0b';
    if (node.type.includes('trigger')) return '#0ea5e9';
    return '#10b981';
  };
  const nodeColor = getNodeColor();

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.node-port')) return;
    if (target.closest('[data-action="delete"]')) return;

    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    onSelect(node.id);

    const rect = nodeRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();

    const canvas = document.getElementById('flow-canvas');
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const x = e.clientX - canvasRect.left - dragOffset.current.x;
    const y = e.clientY - canvasRect.top - dragOffset.current.y;

    onPositionChange(node.id, Math.max(0, x), Math.max(0, y));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const isHANode = node.type === 'ha-input' || node.type === 'ha-output';
  const liveValue = liveValues[node.id];
  const hasLive = liveValue !== undefined && liveValue !== null;

  return (
    <div
      ref={nodeRef}
      className="absolute select-none"
      style={{
        left: node.position.x,
        top: node.position.y,
        zIndex: isSelected || isDragging ? 20 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        minWidth: 180
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="rounded-lg overflow-visible"
        style={{
          background: '#1e293b',
          border: `2px solid ${isSelected ? nodeColor : 'rgba(255,255,255,0.1)'}`,
          boxShadow: isSelected
            ? `0 0 0 1px ${nodeColor}40, 0 8px 32px rgba(0,0,0,0.5)`
            : '0 4px 16px rgba(0,0,0,0.4)'
        }}
      >
        <div
          className="px-3 py-2 rounded-t flex items-center justify-between gap-2"
          style={{ backgroundColor: nodeColor }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {IconComponent && <IconComponent className="w-3.5 h-3.5 text-white flex-shrink-0" />}
            <span className="text-xs font-bold text-white truncate">{data.label}</span>
          </div>
          <button
            data-action="delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>

        {isHANode && (
          <div className="px-3 py-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-xs">
              <Icons.Link className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300 truncate font-mono text-[10px]">
                {data.entityId || 'entity.id wählen...'}
              </span>
            </div>
          </div>
        )}

        {hasLive && (
          <div className="px-3 py-1 border-b border-white/5">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800/40">
              <Icons.Activity className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-300 font-mono text-[10px] truncate">{String(liveValue)}</span>
            </div>
          </div>
        )}

        <div className="py-2">
          {data.inputs.map(input => (
            <div key={input.id} className="flex items-center py-0.5">
              <button
                className="node-port w-3 h-3 rounded-full border-2 -ml-1.5 flex-shrink-0 transition-all"
                style={{
                  borderColor: isConnecting && connectingFromNodeId !== node.id ? '#60a5fa' : '#475569',
                  backgroundColor: isConnecting && connectingFromNodeId !== node.id ? '#1d4ed8' : '#1e293b',
                  boxShadow: isConnecting && connectingFromNodeId !== node.id ? '0 0 8px #60a5fa' : 'none',
                  cursor: 'crosshair'
                }}
                data-port-id={`${node.id}-${input.id}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onPortClick(node.id, input.id, false); }}
                title={input.label}
              />
              <span className="text-xs text-slate-400 pl-2 pr-3 leading-none">{input.label}</span>
            </div>
          ))}

          {data.outputs.map(output => (
            <div key={output.id} className="flex items-center justify-end py-0.5">
              <span className="text-xs text-slate-400 pl-3 pr-2 leading-none">{output.label}</span>
              <button
                className="node-port w-3 h-3 rounded-full border-2 -mr-1.5 flex-shrink-0 transition-all"
                style={{
                  borderColor: '#475569',
                  backgroundColor: '#1e293b',
                  cursor: 'crosshair'
                }}
                data-port-id={`${node.id}-${output.id}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onPortClick(node.id, output.id, true); }}
                title={output.label}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
