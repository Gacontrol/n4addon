import React, { useRef, useState } from 'react';
import { FlowNode as FlowNodeType, DatapointOverride } from '../types/flow';
import * as Icons from 'lucide-react';

interface ContextMenuState {
  x: number;
  y: number;
}

interface FlowNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPortClick: (nodeId: string, portId: string, isOutput: boolean) => void;
  onOverrideChange?: (nodeId: string, override: DatapointOverride) => void;
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
  onOverrideChange,
  isConnecting,
  connectingFromNodeId,
  liveValues = {}
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [overrideInput, setOverrideInput] = useState<string>('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const { data } = node;
  const IconComponent = data.icon
    ? (Icons[data.icon as keyof typeof Icons] as React.FC<{ className?: string }>)
    : null;

  const isDPNode = node.type === 'dp-boolean' || node.type === 'dp-numeric' || node.type === 'dp-enum';
  const isManual = isDPNode && data.override?.manual === true;

  const getNodeColor = () => {
    if (isManual) return '#dc2626';
    if (node.type === 'ha-input') return '#3b82f6';
    if (node.type === 'ha-output') return '#f59e0b';
    if (node.type === 'dp-boolean') return '#8b5cf6';
    if (node.type === 'dp-numeric') return '#06b6d4';
    if (node.type === 'dp-enum') return '#f97316';
    if (node.type.includes('trigger')) return '#0ea5e9';
    return '#10b981';
  };
  const nodeColor = getNodeColor();

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.node-port')) return;
    if (target.closest('[data-action="delete"]')) return;
    if (target.closest('[data-action="context"]')) return;

    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    onSelect(node.id);
    setContextMenu(null);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isDPNode) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    const currentVal = data.override?.manual ? String(data.override.value ?? '') : String(liveValues[node.id] ?? '');
    setOverrideInput(currentVal);
  };

  const handleSetManual = () => {
    setShowOverrideInput(true);
    setContextMenu(null);
  };

  const handleSetAuto = () => {
    onOverrideChange?.(node.id, { manual: false, value: null });
    setContextMenu(null);
    setShowOverrideInput(false);
  };

  const handleApplyOverride = () => {
    let val: unknown = overrideInput;
    if (node.type === 'dp-boolean') {
      val = overrideInput === 'true' || overrideInput === '1' || overrideInput === 'on';
    } else if (node.type === 'dp-numeric') {
      val = parseFloat(overrideInput);
    } else if (node.type === 'dp-enum') {
      val = parseInt(overrideInput);
    }
    onOverrideChange?.(node.id, { manual: true, value: val });
    setShowOverrideInput(false);
  };

  const isHANode = node.type === 'ha-input' || node.type === 'ha-output';
  const liveValue = isManual ? data.override?.value : liveValues[node.id];
  const hasLive = liveValue !== undefined && liveValue !== null;

  const getEnumLabel = (val: unknown) => {
    if (node.type === 'dp-enum' && data.config?.dpEnumStages) {
      const stage = (data.config.dpEnumStages as Array<{ value: number; label: string }>)
        .find(s => s.value === Number(val));
      return stage ? `${stage.value}: ${stage.label}` : String(val);
    }
    return String(val);
  };

  const displayValue = node.type === 'dp-enum' ? getEnumLabel(liveValue) : String(liveValue);

  return (
    <>
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
        onContextMenu={handleContextMenu}
      >
        <div
          className="rounded-lg overflow-visible"
          style={{
            background: '#1e293b',
            border: `2px solid ${isSelected ? nodeColor : isManual ? '#dc262660' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: isManual
              ? `0 0 0 1px #dc262640, 0 0 20px #dc262630, 0 8px 32px rgba(0,0,0,0.5)`
              : isSelected
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
              {isManual && (
                <span className="text-[9px] font-bold bg-white/20 text-white px-1 py-0.5 rounded uppercase tracking-wide flex-shrink-0">
                  MAN
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isDPNode && (
                <button
                  data-action="context"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    const rect = nodeRef.current?.getBoundingClientRect();
                    if (rect) {
                      setContextMenu({ x: rect.right, y: rect.top });
                      const currentVal = data.override?.manual ? String(data.override.value ?? '') : String(liveValues[node.id] ?? '');
                      setOverrideInput(currentVal);
                    }
                  }}
                  className="text-white/60 hover:text-white transition-colors"
                  title="Manuell / Auto"
                >
                  <Icons.MoreVertical className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                data-action="delete"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onDelete(node.id); }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            </div>
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

          {isDPNode && data.config?.dpUnit && (
            <div className="px-3 py-1 border-b border-white/10">
              <span className="text-[10px] text-slate-400">Einheit: </span>
              <span className="text-[10px] text-slate-300 font-mono">{String(data.config.dpUnit)}</span>
            </div>
          )}

          {isDPNode && data.config?.dpFacet && (
            <div className="px-3 py-1 border-b border-white/10">
              <span className="text-[10px] text-slate-400 truncate block">{String(data.config.dpFacet)}</span>
            </div>
          )}

          {hasLive && (
            <div className={`px-3 py-1 border-b border-white/5 ${isManual ? 'bg-red-950/40' : ''}`}>
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded border"
                style={isManual
                  ? { backgroundColor: '#450a0a60', borderColor: '#dc262650' }
                  : { backgroundColor: '#022c2260', borderColor: '#059669' + '40' }
                }
              >
                {isManual
                  ? <Icons.HandMetal className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                  : <Icons.Activity className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                }
                <span
                  className="font-mono text-[10px] truncate"
                  style={{ color: isManual ? '#fca5a5' : '#6ee7b7' }}
                >
                  {displayValue}
                </span>
              </div>
            </div>
          )}

          {showOverrideInput && (
            <div className="px-3 py-2 border-b border-red-900/40 bg-red-950/30">
              <p className="text-[10px] text-red-300 mb-1 font-semibold">Manueller Wert</p>
              {node.type === 'dp-boolean' ? (
                <div className="flex gap-1">
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); setOverrideInput('true'); onOverrideChange?.(node.id, { manual: true, value: true }); setShowOverrideInput(false); }}
                    className="flex-1 py-1 bg-emerald-700/60 hover:bg-emerald-700 text-emerald-200 text-xs rounded transition-colors"
                  >
                    true
                  </button>
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); setOverrideInput('false'); onOverrideChange?.(node.id, { manual: true, value: false }); setShowOverrideInput(false); }}
                    className="flex-1 py-1 bg-slate-700/60 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
                  >
                    false
                  </button>
                </div>
              ) : node.type === 'dp-enum' && data.config?.dpEnumStages ? (
                <div className="space-y-1">
                  {(data.config.dpEnumStages as Array<{ value: number; label: string }>).map(stage => (
                    <button
                      key={stage.value}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        onOverrideChange?.(node.id, { manual: true, value: stage.value });
                        setShowOverrideInput(false);
                      }}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                        data.override?.value === stage.value
                          ? 'bg-orange-700/60 text-orange-200'
                          : 'bg-slate-700/60 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      {stage.value}: {stage.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={overrideInput}
                    onChange={e => setOverrideInput(e.target.value)}
                    onPointerDown={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Enter') handleApplyOverride(); if (e.key === 'Escape') setShowOverrideInput(false); }}
                    className="flex-1 bg-slate-700 border border-red-700/40 rounded px-2 py-1 text-xs text-white outline-none focus:border-red-500"
                    autoFocus
                    step="any"
                  />
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); handleApplyOverride(); }}
                    className="px-2 bg-red-700 hover:bg-red-600 text-white rounded text-xs transition-colors"
                  >OK</button>
                </div>
              )}
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setShowOverrideInput(false); }}
                className="mt-1 text-[10px] text-slate-400 hover:text-white transition-colors"
              >
                Abbrechen
              </button>
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
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onPortClick(node.id, input.id, false); }}
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
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onPortClick(node.id, output.id, true); }}
                  title={output.label}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {contextMenu && isDPNode && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={e => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 w-40"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 border-b border-slate-700">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Datenpunkt</p>
              <p className="text-xs text-white truncate mt-0.5">{data.label}</p>
            </div>
            {isManual && (
              <button
                onClick={() => handleSetAuto()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-900/30 transition-colors"
              >
                <Icons.Cpu className="w-3.5 h-3.5" />
                Auto (Eingang)
              </button>
            )}
            <button
              onClick={() => handleSetManual()}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-300 hover:bg-red-900/30 transition-colors"
            >
              <Icons.HandMetal className="w-3.5 h-3.5" />
              Manuell übersteuern
            </button>
          </div>
        </>
      )}
    </>
  );
};
