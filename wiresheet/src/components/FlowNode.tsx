import React, { useRef, useState, useCallback } from 'react';
import { FlowNode as FlowNodeType, DatapointOverride, CaseDefinition } from '../types/flow';
import * as Icons from 'lucide-react';

interface ContextMenuState {
  x: number;
  y: number;
}

interface FlowNodeProps {
  node: FlowNodeType;
  isSelected: boolean;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSelect: (id: string, e?: React.PointerEvent | React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onPortClick: (nodeId: string, portId: string, isOutput: boolean) => void;
  onOverrideChange?: (nodeId: string, override: DatapointOverride) => void;
  onContextMenu?: (nodeId: string, e: React.MouseEvent) => void;
  onMultiDragStart?: (nodeId: string, e: React.PointerEvent) => void;
  onContainerResize?: (nodeId: string, width: number, height: number) => void;
  onCaseResize?: (nodeId: string, caseIndex: number, height: number) => void;
  onDropIntoContainer?: (nodeId: string, containerId: string, caseIndex: number) => void;
  onDropOutOfContainer?: (nodeId: string) => void;
  isConnecting: boolean;
  connectingFromNodeId?: string | null;
  liveValues?: Record<string, unknown>;
  portValues?: Record<string, unknown>;
  isMultiSelected?: boolean;
  isDraggingMultiple?: boolean;
  parentContainer?: FlowNodeType | null;
}

export const FlowNode: React.FC<FlowNodeProps> = ({
  node,
  isSelected,
  onPositionChange,
  onSelect,
  onDelete,
  onPortClick,
  onOverrideChange,
  onContextMenu,
  onMultiDragStart,
  onContainerResize,
  onCaseResize,
  onDropIntoContainer,
  onDropOutOfContainer,
  isConnecting,
  connectingFromNodeId,
  liveValues = {},
  portValues = {},
  isMultiSelected = false,
  isDraggingMultiple = false,
  parentContainer = null
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingCaseIndex, setResizingCaseIndex] = useState<number | null>(null);
  const [dpContextMenu, setDpContextMenu] = useState<ContextMenuState | null>(null);
  const [overrideInput, setOverrideInput] = useState<string>('');
  const resizeStartRef = useRef<{ width: number; height: number; mouseX: number; mouseY: number } | null>(null);
  const caseResizeStartRef = useRef<{ height: number; mouseY: number; caseIndex: number } | null>(null);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const { data } = node;
  const IconComponent = data.icon
    ? (Icons[data.icon as keyof typeof Icons] as React.FC<{ className?: string }>)
    : null;

  const isDPNode = node.type === 'dp-boolean' || node.type === 'dp-numeric' || node.type === 'dp-enum';
  const isManual = isDPNode && data.override?.manual === true;

  const isCaseContainer = node.type === 'case-container';
  const isPythonScript = node.type === 'python-script';

  const getNodeColor = () => {
    if (isManual) return '#dc2626';
    if (node.type === 'ha-input') return '#3b82f6';
    if (node.type === 'ha-output') return '#f59e0b';
    if (node.type === 'dp-boolean') return '#8b5cf6';
    if (node.type === 'dp-numeric') return '#06b6d4';
    if (node.type === 'dp-enum') return '#f97316';
    if (node.type === 'python-script') return '#3776ab';
    if (node.type === 'case-container') return '#6366f1';
    if (node.type.includes('trigger')) return '#0ea5e9';
    return '#10b981';
  };
  const nodeColor = getNodeColor();

  const cases: CaseDefinition[] = data.config?.cases || [];
  const containerWidth = data.config?.containerWidth || 400;
  const containerHeight = data.config?.containerHeight || 300;
  const activeCaseValue = liveValues[node.id] !== undefined ? Number(liveValues[node.id]) : 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.node-port')) return;
    if (target.closest('[data-action="delete"]')) return;
    if (target.closest('[data-action="context"]')) return;

    e.stopPropagation();

    if (isMultiSelected && !isDraggingMultiple) {
      onMultiDragStart?.(node.id, e);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    onSelect(node.id, e);
    setDpContextMenu(null);

    const rect = nodeRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isDraggingMultiple) return;
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

    if (node.type !== 'case-container' && !parentContainer) {
      const allDropZones = document.querySelectorAll('[data-case-drop-zone]');
      for (const zone of allDropZones) {
        const zoneRect = zone.getBoundingClientRect();
        if (
          e.clientX >= zoneRect.left && e.clientX <= zoneRect.right &&
          e.clientY >= zoneRect.top && e.clientY <= zoneRect.bottom
        ) {
          const containerId = zone.getAttribute('data-case-drop-zone');
          const caseIndexStr = zone.getAttribute('data-case-index');
          if (containerId && caseIndexStr && onDropIntoContainer) {
            onDropIntoContainer(node.id, containerId, parseInt(caseIndexStr));
          }
          break;
        }
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDPNode) {
      setDpContextMenu({ x: e.clientX, y: e.clientY });
      const currentVal = data.override?.manual ? String(data.override.value ?? '') : String(liveValues[node.id] ?? '');
      setOverrideInput(currentVal);
    } else {
      onContextMenu?.(node.id, e);
    }
  };

  const handleSetManual = () => {
    setShowOverrideInput(true);
    setDpContextMenu(null);
  };

  const handleSetAuto = () => {
    onOverrideChange?.(node.id, { manual: false, value: null });
    setDpContextMenu(null);
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

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      width: containerWidth,
      height: containerHeight,
      mouseX: e.clientX,
      mouseY: e.clientY
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [containerWidth, containerHeight]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing || !resizeStartRef.current || !onContainerResize) return;
    const dx = e.clientX - resizeStartRef.current.mouseX;
    const dy = e.clientY - resizeStartRef.current.mouseY;
    const newWidth = Math.max(250, resizeStartRef.current.width + dx);
    const newHeight = Math.max(150, resizeStartRef.current.height + dy);
    onContainerResize(node.id, newWidth, newHeight);
  }, [isResizing, node.id, onContainerResize]);

  const handleResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (isResizing) {
      setIsResizing(false);
      resizeStartRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, [isResizing]);

  const handleCaseResizePointerDown = useCallback((caseIdx: number, currentHeight: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingCaseIndex(caseIdx);
    caseResizeStartRef.current = {
      height: currentHeight,
      mouseY: e.clientY,
      caseIndex: caseIdx
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleCaseResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (resizingCaseIndex === null || !caseResizeStartRef.current || !onCaseResize) return;
    const dy = e.clientY - caseResizeStartRef.current.mouseY;
    const newHeight = Math.max(80, caseResizeStartRef.current.height + dy);
    onCaseResize(node.id, caseResizeStartRef.current.caseIndex, newHeight);
  }, [resizingCaseIndex, node.id, onCaseResize]);

  const handleCaseResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (resizingCaseIndex !== null) {
      setResizingCaseIndex(null);
      caseResizeStartRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, [resizingCaseIndex]);

  if (isCaseContainer) {
    const headerHeight = 36;
    const defaultCaseHeight = 120;
    const getCaseHeight = (caseIdx: number) => {
      const c = cases[caseIdx];
      return c?.height || defaultCaseHeight;
    };
    const totalCasesHeight = cases.reduce((sum, c, idx) => sum + getCaseHeight(idx), 0);
    const minHeight = headerHeight + Math.max(defaultCaseHeight, totalCasesHeight);
    const finalHeight = Math.max(containerHeight, minHeight);

    return (
      <div
        ref={nodeRef}
        data-node-id={node.id}
        data-case-container="true"
        className="absolute select-none"
        style={{
          left: node.position.x,
          top: node.position.y,
          zIndex: isSelected || isDragging ? 2 : 0,
          touchAction: 'none',
          width: containerWidth,
          height: finalHeight
        }}
      >
        <div
          className="w-full h-full rounded-xl overflow-hidden flex flex-col"
          style={{
            background: 'rgba(30, 41, 59, 0.95)',
            border: `2px solid ${isSelected ? '#6366f1' : 'rgba(99, 102, 241, 0.3)'}`,
            boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.3), 0 8px 32px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.3)'
          }}
        >
          <div
            className="px-3 py-2 flex items-center gap-3 flex-shrink-0"
            style={{ backgroundColor: '#6366f1', cursor: isDragging ? 'grabbing' : 'grab' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <button
              type="button"
              className="port node-port w-4 h-4 -ml-1 rounded-full border-2 transition-all flex-shrink-0"
              style={{
                borderColor: isConnecting ? '#60a5fa' : '#a5b4fc',
                backgroundColor: isConnecting ? '#1d4ed8' : '#4338ca',
                boxShadow: isConnecting ? '0 0 12px #60a5fa' : 'none',
                transform: isConnecting ? 'scale(1.3)' : 'scale(1)',
                cursor: isConnecting ? 'pointer' : 'crosshair'
              }}
              data-port-id={`${node.id}-input-0`}
              onClick={e => { e.stopPropagation(); onPortClick(node.id, 'input-0', false); }}
            />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icons.Layers className="w-4 h-4 text-white flex-shrink-0" />
              <span className="text-sm font-bold text-white truncate">{data.label}</span>
              <span className="text-xs text-white/70 bg-white/20 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                ={activeCaseValue}
              </span>
            </div>
            <button
              data-action="delete"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDelete(node.id); }}
              className="text-white/60 hover:text-white transition-colors flex-shrink-0"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {cases.map((c, idx) => {
              const isActiveCase = activeCaseValue === idx;
              const caseHeight = getCaseHeight(idx);
              return (
                <div
                  key={c.id}
                  className="flex flex-col relative"
                  style={{
                    borderBottom: idx < cases.length - 1 ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                    height: caseHeight,
                    flexShrink: 0
                  }}
                >
                  <div
                    className="px-3 py-1.5 flex items-center gap-2 flex-shrink-0"
                    style={{
                      backgroundColor: isActiveCase ? '#4f46e5' : 'rgba(30, 41, 59, 0.9)',
                      borderBottom: '1px solid rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    <span
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{
                        backgroundColor: isActiveCase ? 'rgba(255,255,255,0.2)' : 'rgba(99, 102, 241, 0.4)',
                        color: 'white'
                      }}
                    >
                      {idx}
                    </span>
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: isActiveCase ? 'white' : '#94a3b8' }}
                    >
                      {c.label}
                    </span>
                    {isActiveCase && (
                      <div className="ml-auto flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] text-emerald-300 font-medium">aktiv</span>
                      </div>
                    )}
                    {!isActiveCase && (
                      <div className="ml-auto">
                        <Icons.Pause className="w-3 h-3 text-slate-500" />
                      </div>
                    )}
                  </div>
                  <div
                    className="flex-1 relative overflow-hidden"
                    data-case-drop-zone={node.id}
                    data-case-index={idx}
                    style={{
                      backgroundColor: isActiveCase ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.6)',
                      backgroundImage: `
                        radial-gradient(circle, ${isActiveCase ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.1)'} 1px, transparent 1px)
                      `,
                      backgroundSize: '20px 20px',
                      backgroundPosition: '10px 10px',
                      pointerEvents: 'auto',
                      opacity: isSelected ? 1 : (isActiveCase ? 1 : 0.7)
                    }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    {!isActiveCase && !isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-slate-600 text-[10px] font-medium px-2 py-1 bg-slate-800/50 rounded">
                          Inaktiv - Case {idx}
                        </div>
                      </div>
                    )}
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center hover:bg-indigo-600/30 transition-colors group"
                    style={{ zIndex: 10 }}
                    onPointerDown={(e) => handleCaseResizePointerDown(idx, caseHeight, e)}
                    onPointerMove={handleCaseResizePointerMove}
                    onPointerUp={handleCaseResizePointerUp}
                    onPointerCancel={handleCaseResizePointerUp}
                  >
                    <div className="w-8 h-1 bg-indigo-400/40 rounded group-hover:bg-indigo-400/80 transition-colors" />
                  </div>
                </div>
              );
            })}
            {cases.length === 0 && (
              <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)' }}>
                <div className="text-center">
                  <Icons.Layers className="w-8 h-8 mx-auto mb-2 text-indigo-400/50" />
                  <p className="text-sm text-indigo-300/70 font-medium">Keine Cases</p>
                  <p className="text-[10px] text-slate-500 mt-1">Properties Panel: Cases hinzufuegen</p>
                </div>
              </div>
            )}
          </div>

          <div
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center hover:bg-indigo-600/30 rounded-tl transition-colors"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
          >
            <Icons.GripHorizontal className="w-3 h-3 text-indigo-400/60 rotate-[-45deg]" />
          </div>
        </div>
      </div>
    );
  }

  const isDimmed = (data as { _dimmed?: boolean })._dimmed === true;

  return (
    <>
      <div
        ref={nodeRef}
        data-node-id={node.id}
        className="absolute select-none transition-opacity duration-200"
        style={{
          left: node.position.x,
          top: node.position.y,
          zIndex: isSelected || isDragging ? 20 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          minWidth: 180,
          opacity: isDimmed ? 0.35 : 1
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
                      setDpContextMenu({ x: rect.right, y: rect.top });
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
                  {data.entityId || 'entity.id waehlen...'}
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

          <div className="py-1.5">
            {data.inputs.map(input => {
              const portVal = portValues[input.id];
              const hasPortVal = portVal !== undefined && portVal !== null;
              const isHighlighted = isConnecting && connectingFromNodeId !== node.id;
              return (
                <div key={input.id} className="flex items-center py-0.5 min-h-[28px]">
                  <button
                    type="button"
                    className="port node-port w-4 h-4 -ml-2 rounded-full border-2 transition-all flex-shrink-0"
                    style={{
                      borderColor: isHighlighted ? '#60a5fa' : (hasPortVal ? '#10b981' : '#475569'),
                      backgroundColor: isHighlighted ? '#1d4ed8' : (hasPortVal ? '#064e3b' : '#1e293b'),
                      boxShadow: isHighlighted ? '0 0 12px #60a5fa' : (hasPortVal ? '0 0 4px #10b98160' : 'none'),
                      transform: isHighlighted ? 'scale(1.3)' : 'scale(1)',
                      cursor: isHighlighted ? 'pointer' : 'crosshair'
                    }}
                    data-port-id={`${node.id}-${input.id}`}
                    onClick={e => { e.stopPropagation(); onPortClick(node.id, input.id, false); }}
                  />
                  <div style={{ width: 16 }} />
                  <div className="pr-3 flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-slate-400 leading-none whitespace-nowrap">{input.label}</span>
                    {hasPortVal && (
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.5 rounded leading-none max-w-16 truncate">
                        {String(portVal).length > 8 ? String(portVal).slice(0, 8) + '...' : String(portVal)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {data.outputs.map((output, outputIndex) => {
              let outVal;
              if (isManual) {
                outVal = data.override?.value;
              } else if (isPythonScript) {
                outVal = liveValues[`${node.id}:${output.id}`] ?? liveValues[node.id];
              } else {
                outVal = liveValues[node.id];
              }
              const hasOutVal = outVal !== undefined && outVal !== null;
              return (
                <div key={output.id} className="flex items-center justify-end py-0.5 min-h-[28px]">
                  <div className="pl-3 flex items-center gap-1.5 min-w-0">
                    {hasOutVal && (
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded leading-none max-w-16 truncate ${
                        isManual ? 'text-red-400 bg-red-950/60' : 'text-emerald-400 bg-emerald-950/60'
                      }`}>
                        {String(outVal).length > 8 ? String(outVal).slice(0, 8) + '...' : String(outVal)}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 leading-none whitespace-nowrap">{output.label}</span>
                  </div>
                  <button
                    type="button"
                    className="port node-port w-4 h-4 -mr-2 rounded-full border-2 transition-all flex-shrink-0 cursor-pointer"
                    style={{
                      borderColor: hasOutVal ? (isManual ? '#dc2626' : '#10b981') : '#475569',
                      backgroundColor: hasOutVal ? (isManual ? '#450a0a' : '#064e3b') : '#1e293b',
                      boxShadow: hasOutVal ? `0 0 4px ${isManual ? '#dc262660' : '#10b98160'}` : 'none'
                    }}
                    data-port-id={`${node.id}-${output.id}`}
                    onClick={e => { e.stopPropagation(); onPortClick(node.id, output.id, true); }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dpContextMenu && isDPNode && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDpContextMenu(null)}
            onContextMenu={e => { e.preventDefault(); setDpContextMenu(null); }}
          />
          <div
            className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 w-40"
            style={{ left: dpContextMenu.x, top: dpContextMenu.y }}
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
              Manuell uebersteuern
            </button>
          </div>
        </>
      )}
    </>
  );
};
