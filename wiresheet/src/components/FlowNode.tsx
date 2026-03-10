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
}

export const FlowNode: React.FC<FlowNodeProps> = ({
  node,
  isSelected,
  onPositionChange,
  onSelect,
  onDelete,
  onPortClick,
  isConnecting
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const template = node.data;
  const IconComponent = template.icon
    ? (Icons[template.icon as keyof typeof Icons] as React.FC<{ className?: string }>)
    : null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.port')) return;

    e.stopPropagation();
    setIsDragging(true);
    onSelect(node.id);

    const rect = nodeRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.getElementById('flow-canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      onPositionChange(node.id, x, y);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, node.id, dragOffset, onPositionChange]);

  const handlePortClick = (portId: string, isOutput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    onPortClick(node.id, portId, isOutput);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.id);
  };

  const getNodeColor = () => {
    const type = node.type;
    if (type.includes('sensor')) return '#3b82f6';
    if (type.includes('actuator') || type.includes('light') || type.includes('switch')) return '#f59e0b';
    if (type.includes('logic') || type.includes('gate') || type.includes('compare') || type.includes('delay')) return '#10b981';
    if (type.includes('trigger')) return '#8b5cf6';
    return '#64748b';
  };

  return (
    <div
      ref={nodeRef}
      className={`absolute cursor-move select-none ${isDragging ? 'opacity-80' : ''}`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        zIndex: isSelected ? 10 : 1
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`bg-slate-700 rounded-lg shadow-lg border-2 transition-all ${
          isSelected ? 'border-blue-400 shadow-blue-400/50' : 'border-slate-600'
        }`}
        style={{ minWidth: '200px' }}
      >
        <div
          className="px-3 py-2 rounded-t-md flex items-center justify-between"
          style={{ backgroundColor: getNodeColor() }}
        >
          <div className="flex items-center gap-2">
            {IconComponent && <IconComponent className="w-4 h-4 text-white" />}
            <span className="text-sm font-semibold text-white">{template.label}</span>
          </div>
          <button
            onClick={handleDeleteClick}
            className="text-white/70 hover:text-white transition-colors"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          {template.inputs.length > 0 && (
            <div className="space-y-2 mb-3">
              {template.inputs.map(input => (
                <div key={input.id} className="flex items-center gap-2">
                  <button
                    className={`port w-3 h-3 rounded-full border-2 border-slate-400 bg-slate-600 hover:bg-blue-500 hover:border-blue-400 transition-colors ${
                      isConnecting ? 'cursor-pointer' : ''
                    }`}
                    onClick={(e) => handlePortClick(input.id, false, e)}
                  />
                  <span className="text-xs text-slate-300">{input.label}</span>
                </div>
              ))}
            </div>
          )}

          {template.outputs.length > 0 && (
            <div className="space-y-2">
              {template.outputs.map(output => (
                <div key={output.id} className="flex items-center justify-end gap-2">
                  <span className="text-xs text-slate-300">{output.label}</span>
                  <button
                    className={`port w-3 h-3 rounded-full border-2 border-slate-400 bg-slate-600 hover:bg-green-500 hover:border-green-400 transition-colors ${
                      isConnecting ? 'cursor-crosshair' : 'cursor-pointer'
                    }`}
                    onClick={(e) => handlePortClick(output.id, true, e)}
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
