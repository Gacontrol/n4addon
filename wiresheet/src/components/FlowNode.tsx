import React, { useRef, useEffect, useState } from 'react';
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
}

export const FlowNode: React.FC<FlowNodeProps> = ({
  node,
  isSelected,
  onPositionChange,
  onSelect,
  onDelete,
  onPortClick,
  isConnecting,
  connectingFromNodeId
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const template = node.data;
  const IconComponent = template.icon
    ? (Icons[template.icon as keyof typeof Icons] as React.FC<{ className?: string }>)
    : null;

  const getNodeColor = () => {
    if (node.type === 'ha-input') return '#3b82f6';
    if (node.type === 'ha-output') return '#f59e0b';
    if (node.type.includes('trigger')) return '#0ea5e9';
    if (['and-gate', 'or-gate', 'not-gate', 'compare', 'delay', 'threshold'].includes(node.type)) return '#10b981';
    return '#64748b';
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.port')) return;
    if ((e.target as HTMLElement).closest('button[data-action="delete"]')) return;

    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    onSelect(node.id);

    const rect = nodeRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();

    const canvas = document.getElementById('flow-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.current.x;
    const y = e.clientY - rect.top - dragOffset.current.y;

    onPositionChange(node.id, Math.max(0, x), Math.max(0, y));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const handlePortClick = (portId: string, isOutput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    onPortClick(node.id, portId, isOutput);
  };

  const isHAInput = node.type === 'ha-input';
  const isHAOutput = node.type === 'ha-output';
  const nodeColor = getNodeColor();

  return (
    <div
      ref={nodeRef}
      className={`absolute select-none ${isDragging ? 'opacity-90' : ''}`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        zIndex: isSelected ? 20 : isDragging ? 15 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className={`rounded-lg shadow-xl border-2 transition-shadow ${
          isSelected
            ? 'shadow-lg border-white/40'
            : 'border-transparent hover:border-white/20'
        }`}
        style={{
          minWidth: isHAInput || isHAOutput ? '180px' : '160px',
          background: 'rgba(30, 41, 59, 0.97)',
          boxShadow: isSelected
            ? `0 0 0 2px ${nodeColor}80, 0 8px 32px rgba(0,0,0,0.5)`
            : '0 4px 20px rgba(0,0,0,0.4)'
        }}
      >
        <div
          className="px-3 py-2 rounded-t-md flex items-center justify-between gap-2"
          style={{ backgroundColor: nodeColor }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {IconComponent && <IconComponent className="w-3.5 h-3.5 text-white flex-shrink-0" />}
            <span className="text-xs font-bold text-white truncate">{template.label}</span>
          </div>
          <button
            data-action="delete"
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="text-white/60 hover:text-white transition-colors flex-shrink-0"
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        </div>

        {(isHAInput || isHAOutput) && (
          <div className="px-3 py-1.5 border-b border-slate-700">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer hover:bg-slate-600 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Icons.Link className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-slate-300 truncate">
                {template.entityId || template.entityLabel || 'Entity wählen...'}
              </span>
            </div>
          </div>
        )}

        <div className="py-2 px-0">
          {template.inputs.length > 0 && (
            <div className="space-y-1.5 mb-1.5">
              {template.inputs.map(input => (
                <div key={input.id} className="flex items-center gap-0">
                  <button
                    className="port w-3 h-3 rounded-full border-2 flex-shrink-0 transition-all -ml-1.5"
                    style={{
                      borderColor: isConnecting && connectingFromNodeId !== node.id
                        ? '#60a5fa'
                        : '#475569',
                      backgroundColor: isConnecting && connectingFromNodeId !== node.id
                        ? '#2563eb'
                        : '#334155',
                      boxShadow: isConnecting && connectingFromNodeId !== node.id
                        ? '0 0 6px #60a5fa80'
                        : 'none'
                    }}
                    onClick={(e) => handlePortClick(input.id, false, e)}
                    title={input.label}
                  />
                  <span className="text-xs text-slate-400 pl-2 pr-3">{input.label}</span>
                </div>
              ))}
            </div>
          )}

          {template.outputs.length > 0 && (
            <div className="space-y-1.5">
              {template.outputs.map(output => (
                <div key={output.id} className="flex items-center justify-end gap-0">
                  <span className="text-xs text-slate-400 pl-3 pr-2">{output.label}</span>
                  <button
                    className="port w-3 h-3 rounded-full border-2 flex-shrink-0 transition-all -mr-1.5"
                    style={{
                      borderColor: '#475569',
                      backgroundColor: '#334155',
                      cursor: isConnecting ? 'default' : 'crosshair'
                    }}
                    onClick={(e) => handlePortClick(output.id, true, e)}
                    title={output.label}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
