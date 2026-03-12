import React, { useRef, useState, useCallback, useEffect } from 'react';
import { VisuWidget, VisuPage, PolygonConfig, LineConfig } from '../../types/visualization';
import { FlowNode } from '../../types/flow';
import { VisuWidgetRenderer } from './VisuWidget';

interface ContextMenuState {
  x: number;
  y: number;
  widgetId: string | null;
}

interface DrawingState {
  widgetId: string;
  type: 'polygon' | 'line';
  points: { x: number; y: number }[];
  cursorPos: { x: number; y: number } | null;
  linePhase?: 0 | 1;
}

interface LassoState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface VisuCanvasProps {
  page: VisuPage;
  liveValues: Record<string, unknown>;
  logicNodes: FlowNode[];
  isEditMode: boolean;
  selectedWidgetId: string | null;
  selectedWidgetIds?: string[];
  clipboard: VisuWidget | null;
  onSelectWidget: (widgetId: string | null) => void;
  onSelectWidgets?: (widgetIds: string[]) => void;
  onUpdateWidget: (widgetId: string, updates: Partial<VisuWidget>) => void;
  onUpdateWidgets?: (updates: { widgetId: string; updates: Partial<VisuWidget> }[]) => void;
  onDeleteWidget: (widgetId: string) => void;
  onDeleteWidgets?: (widgetIds: string[]) => void;
  onDuplicateWidget: (widgetId: string) => void;
  onCopyWidget: (widgetId: string) => void;
  onCopyWidgets?: (widgetIds: string[]) => void;
  onPasteWidget: () => void;
  onWidgetValueChange: (widgetId: string, value: unknown) => void;
  onEditWidgetProperties: (widgetId: string) => void;
  onNavigateToPage?: (pageId: string) => void;
  onNavigateBack?: () => void;
  onNavigateHome?: () => void;
  onBringToFront: (widgetId: string) => void;
  onSendToBack: (widgetId: string) => void;
  onBringForward: (widgetId: string) => void;
  onSendBackward: (widgetId: string) => void;
}

export const VisuCanvas: React.FC<VisuCanvasProps> = ({
  page,
  liveValues,
  logicNodes,
  isEditMode,
  selectedWidgetId,
  selectedWidgetIds = [],
  clipboard,
  onSelectWidget,
  onSelectWidgets,
  onUpdateWidget,
  onUpdateWidgets,
  onDeleteWidget,
  onDeleteWidgets,
  onDuplicateWidget,
  onCopyWidget,
  onCopyWidgets,
  onPasteWidget,
  onWidgetValueChange,
  onEditWidgetProperties,
  onNavigateToPage,
  onNavigateBack,
  onNavigateHome,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const lassoStateRef = useRef<LassoState | null>(null);

  const [dragState, setDragState] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    widgetStartX: number;
    widgetStartY: number;
    isVertex?: boolean;
    initialConfig?: Record<string, unknown>;
  } | null>(null);

  const [multiDragState, setMultiDragState] = useState<{
    widgetIds: string[];
    startX: number;
    startY: number;
    initialPositions: Record<string, { x: number; y: number }>;
  } | null>(null);

  const [resizeState, setResizeState] = useState<{
    widgetId: string;
    corner: string;
    startX: number;
    startY: number;
    widgetStartWidth: number;
    widgetStartHeight: number;
    widgetStartX: number;
    widgetStartY: number;
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [drawingState, setDrawingState] = useState<DrawingState | null>(null);
  const [lassoState, setLassoStateInternal] = useState<LassoState | null>(null);

  const setLassoState = useCallback((val: LassoState | null | ((prev: LassoState | null) => LassoState | null)) => {
    if (typeof val === 'function') {
      setLassoStateInternal(prev => {
        const newVal = val(prev);
        lassoStateRef.current = newVal;
        return newVal;
      });
    } else {
      lassoStateRef.current = val;
      setLassoStateInternal(val);
    }
  }, []);

  const getCanvasPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const el = canvasRef.current!;
    const rect = el.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + el.scrollLeft,
      y: e.clientY - rect.top + el.scrollTop
    };
  }, []);

  const getScrolledCanvasPos = useCallback((e: MouseEvent) => {
    if (!canvasRef.current) return { x: e.clientX, y: e.clientY };
    const el = canvasRef.current;
    const rect = el.getBoundingClientRect();
    return {
      x: e.clientX - rect.left + el.scrollLeft,
      y: e.clientY - rect.top + el.scrollTop
    };
  }, []);

  const snapPos = useCallback((pos: { x: number; y: number }) => {
    if (!page.showGrid) return pos;
    const g = page.gridSize || 10;
    return { x: Math.round(pos.x / g) * g, y: Math.round(pos.y / g) * g };
  }, [page.showGrid, page.gridSize]);

  const isInDrawingMode = useCallback((widget: VisuWidget) => {
    if (!isEditMode) return false;
    if (widget.type === 'visu-polygon') {
      const cfg = widget.config as PolygonConfig;
      return !cfg.points || cfg.points.length === 0;
    }
    if (widget.type === 'visu-line') {
      const cfg = widget.config as LineConfig;
      return cfg.x1 === undefined;
    }
    return false;
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      setDrawingState(null);
      return;
    }
    if (selectedWidgetId) {
      const widget = page.widgets.find(w => w.id === selectedWidgetId);
      if (widget && isInDrawingMode(widget)) {
        if (!drawingState || drawingState.widgetId !== selectedWidgetId) {
          setDrawingState({
            widgetId: selectedWidgetId,
            type: widget.type === 'visu-polygon' ? 'polygon' : 'line',
            points: [],
            cursorPos: null,
            linePhase: 0
          });
        }
      } else if (drawingState && drawingState.widgetId !== selectedWidgetId) {
        setDrawingState(null);
      }
    } else {
      setDrawingState(null);
    }
  }, [selectedWidgetId, page.widgets, isEditMode, isInDrawingMode]);

  const pageWidgetsRef = useRef(page.widgets);
  pageWidgetsRef.current = page.widgets;
  const onSelectWidgetRef = useRef(onSelectWidget);
  onSelectWidgetRef.current = onSelectWidget;
  const onSelectWidgetsRef = useRef(onSelectWidgets);
  onSelectWidgetsRef.current = onSelectWidgets;
  const isEditModeRef = useRef(isEditMode);
  isEditModeRef.current = isEditMode;
  const drawingStateRef = useRef(drawingState);
  drawingStateRef.current = drawingState;
  const contextMenuRef = useRef(contextMenu);
  contextMenuRef.current = contextMenu;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!isEditModeRef.current) return;
      if (drawingStateRef.current) return;
      if (contextMenuRef.current) return;

      let el = e.target as HTMLElement | null;
      while (el && el !== canvas) {
        if (el.dataset.widgetId) return;
        el = el.parentElement;
      }

      const rect = canvas.getBoundingClientRect();
      const startX = e.clientX - rect.left + canvas.scrollLeft;
      const startY = e.clientY - rect.top + canvas.scrollTop;

      setLassoState({ startX, startY, currentX: startX, currentY: startY });
      onSelectWidgetRef.current(null);
      onSelectWidgetsRef.current?.([]);
      e.preventDefault();

      const onMove = (ev: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        const cx = ev.clientX - r.left + canvas.scrollLeft;
        const cy = ev.clientY - r.top + canvas.scrollTop;
        setLassoState({ startX, startY, currentX: cx, currentY: cy });
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);

        const r = canvas.getBoundingClientRect();
        const cx = ev.clientX - r.left + canvas.scrollLeft;
        const cy = ev.clientY - r.top + canvas.scrollTop;

        const lx1 = Math.min(startX, cx);
        const ly1 = Math.min(startY, cy);
        const lx2 = Math.max(startX, cx);
        const ly2 = Math.max(startY, cy);

        setLassoState(null);

        const threshold = 5;
        if (lx2 - lx1 > threshold || ly2 - ly1 > threshold) {
          const selected = pageWidgetsRef.current
            .filter(w => {
              const wx2 = w.position.x + w.size.width;
              const wy2 = w.position.y + w.size.height;
              return w.position.x < lx2 && wx2 > lx1 && w.position.y < ly2 && wy2 > ly1;
            })
            .map(w => w.id);
          if (selected.length > 0) {
            onSelectWidgetsRef.current?.(selected);
            onSelectWidgetRef.current(selected[selected.length - 1]);
          }
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    return () => canvas.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const WRITE_WIDGET_TYPES = new Set([
    'visu-switch', 'visu-slider', 'visu-incrementer', 'visu-input', 'visu-button', 'visu-multistate',
    'modern-switch', 'modern-button', 'modern-incrementer', 'dash-toggle'
  ]);

  const getWidgetValue = useCallback((widget: VisuWidget): unknown => {
    if (!widget.binding) return null;
    const { nodeId, portId, paramKey } = widget.binding;
    if (paramKey) {
      const node = logicNodes.find(n => n.id === nodeId);
      if (node?.data.config) {
        const val = node.data.config[paramKey];
        if (val !== undefined) return val;
      }
      return null;
    }
    const isWrite = WRITE_WIDGET_TYPES.has(widget.type);
    if (isWrite) {
      if (widget.statusBinding) return null;
      if (portId) {
        const portKey = `${nodeId}:${portId}`;
        if (portKey in liveValues) return liveValues[portKey];
      }
      return liveValues[nodeId] ?? null;
    }
    if (portId) {
      return liveValues[`${nodeId}:${portId}`] ?? liveValues[nodeId];
    }
    return liveValues[nodeId];
  }, [liveValues, logicNodes]);

  const getWidgetStatusValue = useCallback((widget: VisuWidget): unknown => {
    if (!widget.statusBinding) return undefined;
    const { nodeId, portId } = widget.statusBinding;
    if (portId) {
      const portKey = `${nodeId}:${portId}`;
      if (portKey in liveValues) return liveValues[portKey];
    }
    return liveValues[nodeId];
  }, [liveValues]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (drawingState) {
      const pos = snapPos(getCanvasPos(e));
      setDrawingState(prev => prev ? { ...prev, cursorPos: pos } : null);
    }
  }, [drawingState, getCanvasPos, snapPos]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    if (drawingState) return;
    if (lassoState) return;
    if (e.target === canvasRef.current) {
      onSelectWidget(null);
      onSelectWidgets?.([]);
    }
  }, [onSelectWidget, onSelectWidgets, contextMenu, drawingState, lassoState]);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, widgetId: null });
  }, [isEditMode]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    if (drawingState) {
      if (e.target !== canvasRef.current) return;
      e.stopPropagation();
      e.preventDefault();

      const pos = snapPos(getCanvasPos(e));

      if (drawingState.type === 'line') {
        if (drawingState.linePhase === 0) {
          setDrawingState(prev => prev ? { ...prev, points: [pos], linePhase: 1 } : null);
        } else {
          const pts = drawingState.points;
          if (pts.length >= 1) {
            const lCfg = page.widgets.find(w => w.id === drawingState.widgetId)?.config as LineConfig;
            onUpdateWidget(drawingState.widgetId, {
              config: { ...lCfg, x1: pts[0].x, y1: pts[0].y, x2: pos.x, y2: pos.y },
              position: { x: 0, y: 0 },
              size: { width: 1, height: 1 }
            });
            setDrawingState(null);
          }
        }
      } else if (drawingState.type === 'polygon') {
        const pts = drawingState.points;
        if (pts.length >= 3) {
          const firstPt = pts[0];
          const dist = Math.sqrt((pos.x - firstPt.x) ** 2 + (pos.y - firstPt.y) ** 2);
          if (dist < 15) {
            const pCfg = page.widgets.find(w => w.id === drawingState.widgetId)?.config as PolygonConfig;
            onUpdateWidget(drawingState.widgetId, {
              config: { ...pCfg, points: pts },
              position: { x: 0, y: 0 },
              size: { width: 1, height: 1 }
            });
            setDrawingState(null);
            return;
          }
        }
        setDrawingState(prev => prev ? { ...prev, points: [...prev.points, pos] } : null);
      }
      return;
    }

  }, [drawingState, contextMenu, isEditMode, getCanvasPos, snapPos, page.widgets, onUpdateWidget, onSelectWidget, onSelectWidgets]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {}, []);

  const handleWidgetContextMenu = useCallback((e: React.MouseEvent, widgetId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectWidget(widgetId);
    setContextMenu({ x: e.clientX, y: e.clientY, widgetId });
  }, [isEditMode, onSelectWidget]);

  const handleWidgetMouseDown = useCallback((e: React.MouseEvent, widgetId: string) => {
    if (!isEditMode) return;
    if (contextMenu) {
      setContextMenu(null);
      return;
    }

    if (drawingState) return;

    const widget = page.widgets.find(w => w.id === widgetId);
    if (!widget || widget.locked) return;

    const target = e.target as HTMLElement;
    const isResizeHandle = target.classList.contains('cursor-nw-resize') ||
      target.classList.contains('cursor-ne-resize') ||
      target.classList.contains('cursor-sw-resize') ||
      target.classList.contains('cursor-se-resize');

    if (isResizeHandle) {
      let corner = '';
      if (target.classList.contains('cursor-nw-resize')) corner = 'nw';
      else if (target.classList.contains('cursor-ne-resize')) corner = 'ne';
      else if (target.classList.contains('cursor-sw-resize')) corner = 'sw';
      else if (target.classList.contains('cursor-se-resize')) corner = 'se';

      setResizeState({
        widgetId,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        widgetStartWidth: widget.size.width,
        widgetStartHeight: widget.size.height,
        widgetStartX: widget.position.x,
        widgetStartY: widget.position.y
      });
    } else {
      const isInSelection = selectedWidgetIds.includes(widgetId);
      if (isInSelection && selectedWidgetIds.length > 1) {
        const initialPositions: Record<string, { x: number; y: number }> = {};
        for (const id of selectedWidgetIds) {
          const w = page.widgets.find(ww => ww.id === id);
          if (w) initialPositions[id] = { x: w.position.x, y: w.position.y };
        }
        setMultiDragState({
          widgetIds: selectedWidgetIds,
          startX: e.clientX,
          startY: e.clientY,
          initialPositions
        });
      } else {
        const isVertex = ['visu-line', 'visu-polyline', 'visu-polygon'].includes(widget.type);
        setDragState({
          widgetId,
          startX: e.clientX,
          startY: e.clientY,
          widgetStartX: widget.position.x,
          widgetStartY: widget.position.y,
          isVertex,
          initialConfig: isVertex ? JSON.parse(JSON.stringify(widget.config)) : undefined
        });
        onSelectWidgets?.([widgetId]);
      }
    }

    onSelectWidget(widgetId);
    e.preventDefault();
  }, [isEditMode, page.widgets, onSelectWidget, onSelectWidgets, selectedWidgetIds, contextMenu, drawingState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (multiDragState) {
      const rawDeltaX = e.clientX - multiDragState.startX;
      const rawDeltaY = e.clientY - multiDragState.startY;
      const gridSize = page.gridSize || 10;
      let dx = rawDeltaX;
      let dy = rawDeltaY;
      if (page.showGrid) {
        dx = Math.round(dx / gridSize) * gridSize;
        dy = Math.round(dy / gridSize) * gridSize;
      }
      if (onUpdateWidgets) {
        const updates = multiDragState.widgetIds.map(id => {
          const initial = multiDragState.initialPositions[id];
          return {
            widgetId: id,
            updates: {
              position: {
                x: Math.max(0, initial.x + dx),
                y: Math.max(0, initial.y + dy)
              }
            }
          };
        });
        onUpdateWidgets(updates);
      } else {
        for (const id of multiDragState.widgetIds) {
          const initial = multiDragState.initialPositions[id];
          onUpdateWidget(id, {
            position: {
              x: Math.max(0, initial.x + dx),
              y: Math.max(0, initial.y + dy)
            }
          });
        }
      }
    }

    if (dragState) {
      const rawDeltaX = e.clientX - dragState.startX;
      const rawDeltaY = e.clientY - dragState.startY;
      const gridSize = page.gridSize || 10;

      if (dragState.isVertex && dragState.initialConfig) {
        let dx = rawDeltaX;
        let dy = rawDeltaY;
        if (page.showGrid) {
          dx = Math.round(dx / gridSize) * gridSize;
          dy = Math.round(dy / gridSize) * gridSize;
        }
        const cfg = dragState.initialConfig as Record<string, unknown>;
        const widget = page.widgets.find(w => w.id === dragState.widgetId);
        if (!widget) return;

        if (widget.type === 'visu-line') {
          const lCfg = cfg as { x1?: number; y1?: number; x2?: number; y2?: number };
          if (lCfg.x1 !== undefined) {
            onUpdateWidget(dragState.widgetId, {
              config: {
                ...cfg,
                x1: (lCfg.x1 ?? 0) + dx,
                y1: (lCfg.y1 ?? 0) + dy,
                x2: (lCfg.x2 ?? 0) + dx,
                y2: (lCfg.y2 ?? 0) + dy,
              }
            });
          }
        } else if (widget.type === 'visu-polyline' || widget.type === 'visu-polygon') {
          const pts = (cfg.points as { x: number; y: number }[]) || [];
          onUpdateWidget(dragState.widgetId, {
            config: {
              ...cfg,
              points: pts.map(p => ({ x: p.x + dx, y: p.y + dy }))
            }
          });
        }
      } else {
        let newX = dragState.widgetStartX + rawDeltaX;
        let newY = dragState.widgetStartY + rawDeltaY;

        if (page.showGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        newX = Math.max(0, newX);
        newY = Math.max(0, newY);

        onUpdateWidget(dragState.widgetId, {
          position: { x: newX, y: newY }
        });
      }
    }

    if (resizeState) {
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      const gridSize = page.gridSize || 10;
      const minSize = 40;

      let newWidth = resizeState.widgetStartWidth;
      let newHeight = resizeState.widgetStartHeight;
      let newX = resizeState.widgetStartX;
      let newY = resizeState.widgetStartY;

      switch (resizeState.corner) {
        case 'se':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth + deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight + deltaY);
          break;
        case 'sw':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth - deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight + deltaY);
          newX = resizeState.widgetStartX + (resizeState.widgetStartWidth - newWidth);
          break;
        case 'ne':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth + deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight - deltaY);
          newY = resizeState.widgetStartY + (resizeState.widgetStartHeight - newHeight);
          break;
        case 'nw':
          newWidth = Math.max(minSize, resizeState.widgetStartWidth - deltaX);
          newHeight = Math.max(minSize, resizeState.widgetStartHeight - deltaY);
          newX = resizeState.widgetStartX + (resizeState.widgetStartWidth - newWidth);
          newY = resizeState.widgetStartY + (resizeState.widgetStartHeight - newHeight);
          break;
      }

      if (page.showGrid) {
        newWidth = Math.round(newWidth / gridSize) * gridSize;
        newHeight = Math.round(newHeight / gridSize) * gridSize;
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      onUpdateWidget(resizeState.widgetId, {
        position: { x: newX, y: newY },
        size: { width: newWidth, height: newHeight }
      });
    }
  }, [dragState, multiDragState, resizeState, page.gridSize, page.showGrid, page.widgets, onUpdateWidget, onUpdateWidgets]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setMultiDragState(null);
    setResizeState(null);
  }, []);

  useEffect(() => {
    if (dragState || resizeState || multiDragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, resizeState, multiDragState, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!isEditMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape' && drawingState) {
        const widget = page.widgets.find(w => w.id === drawingState.widgetId);
        if (widget) onDeleteWidget(drawingState.widgetId);
        setDrawingState(null);
        return;
      }

      if (e.key === 'Escape') {
        onSelectWidget(null);
        onSelectWidgets?.([]);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        onPasteWidget();
        return;
      }

      const hasMultiSelection = selectedWidgetIds.length > 1;

      if (hasMultiSelection) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (onDeleteWidgets) {
            onDeleteWidgets(selectedWidgetIds);
          } else {
            for (const id of selectedWidgetIds) onDeleteWidget(id);
          }
          onSelectWidgets?.([]);
          onSelectWidget(null);
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          onCopyWidgets?.(selectedWidgetIds);
        }
        return;
      }

      if (!selectedWidgetId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteWidget(selectedWidgetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        onCopyWidget(selectedWidgetId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onDuplicateWidget(selectedWidgetId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, selectedWidgetId, selectedWidgetIds, drawingState, onDeleteWidget, onDeleteWidgets, onCopyWidget, onCopyWidgets, onDuplicateWidget, onPasteWidget, page.widgets, onSelectWidget, onSelectWidgets]);

  const gridPattern = page.showGrid && page.gridSize ? (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.1 }}>
      <defs>
        <pattern id="grid" width={page.gridSize} height={page.gridSize} patternUnits="userSpaceOnUse">
          <path d={`M ${page.gridSize} 0 L 0 0 0 ${page.gridSize}`} fill="none" stroke="#94a3b8" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  ) : null;

  const drawingOverlay = drawingState ? (() => {
    const pts = drawingState.points;
    const cur = drawingState.cursorPos;
    const allPts = cur ? [...pts, cur] : pts;

    if (drawingState.type === 'line') {
      return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9999 }}>
          {allPts.length >= 2 && (
            <line
              x1={allPts[0].x} y1={allPts[0].y}
              x2={allPts[1].x} y2={allPts[1].y}
              stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,3"
            />
          )}
          {allPts.length === 1 && cur && (
            <line
              x1={allPts[0].x} y1={allPts[0].y}
              x2={cur.x} y2={cur.y}
              stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,3"
            />
          )}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={5} fill="#3b82f6" stroke="white" strokeWidth={2} />
          ))}
          {cur && pts.length === 0 && (
            <circle cx={cur.x} cy={cur.y} r={5} fill="#3b82f6" opacity={0.5} stroke="white" strokeWidth={2} />
          )}
        </svg>
      );
    }

    if (drawingState.type === 'polygon') {
      const pathPts = allPts.length > 0 ? allPts : [];
      const pathD = pathPts.length > 1
        ? pathPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
        : '';
      const firstPt = pts[0];
      const nearClose = firstPt && cur && pts.length >= 3 && Math.sqrt((cur.x - firstPt.x) ** 2 + (cur.y - firstPt.y) ** 2) < 15;

      return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9999 }}>
          {pathD && (
            <path d={pathD} fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={2} strokeDasharray={cur ? "6,3" : "none"} strokeLinejoin="round" />
          )}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 7 : 5}
              fill={i === 0 ? (pts.length >= 3 ? '#22c55e' : '#3b82f6') : '#3b82f6'}
              stroke="white" strokeWidth={2} />
          ))}
          {nearClose && firstPt && (
            <circle cx={firstPt.x} cy={firstPt.y} r={12} fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.8} />
          )}
        </svg>
      );
    }
    return null;
  })() : null;

  const lassoOverlay = lassoState ? (() => {
    const x = Math.min(lassoState.startX, lassoState.currentX);
    const y = Math.min(lassoState.startY, lassoState.currentY);
    const w = Math.abs(lassoState.currentX - lassoState.startX);
    const h = Math.abs(lassoState.currentY - lassoState.startY);
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          border: '1.5px dashed #3b82f6',
          background: 'rgba(59,130,246,0.08)',
          zIndex: 9998,
          borderRadius: 2
        }}
      />
    );
  })() : null;

  const drawingCursor = drawingState ? 'crosshair' : (lassoState ? 'crosshair' : undefined);

  const hasFixedSize = page.canvasWidth && page.canvasHeight;

  const isMultiSelected = (widgetId: string) => selectedWidgetIds.includes(widgetId);

  return (
    <div
      ref={canvasRef}
      className="relative overflow-auto"
      style={{
        backgroundColor: page.backgroundColor || '#0f172a',
        cursor: drawingCursor,
        width: hasFixedSize ? page.canvasWidth : '100%',
        height: hasFixedSize ? page.canvasHeight : '100%',
        minWidth: hasFixedSize ? page.canvasWidth : '100%',
        minHeight: hasFixedSize ? page.canvasHeight : '100%',
      }}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasMouseMove}
      onMouseDown={handleCanvasMouseDown}
      onPointerDown={handleCanvasPointerDown}
      onContextMenu={(e) => {
        if (e.target === canvasRef.current) {
          handleCanvasContextMenu(e);
        }
      }}
    >
      {gridPattern}
      {drawingState && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-800/90 text-slate-200 text-xs px-3 py-1.5 rounded-full border border-slate-600 pointer-events-none z-50">
          {drawingState.type === 'line' && drawingState.linePhase === 0 && 'Startpunkt klicken'}
          {drawingState.type === 'line' && drawingState.linePhase === 1 && 'Endpunkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length === 0 && 'Ersten Punkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length === 1 && 'Weiteren Punkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length === 2 && 'Weiteren Punkt klicken'}
          {drawingState.type === 'polygon' && drawingState.points.length >= 3 && 'Weitere Punkte oder auf Startpunkt klicken zum Schliessen — ESC abbrechen'}
        </div>
      )}
      {page.widgets.map((widget) => (
        <VisuWidgetRenderer
          key={widget.id}
          widget={widget}
          value={getWidgetValue(widget)}
          statusValue={getWidgetStatusValue(widget)}
          onValueChange={(value) => onWidgetValueChange(widget.id, value)}
          onUpdateConfig={(config) => onUpdateWidget(widget.id, { config: config as VisuWidget['config'] })}
          isEditMode={isEditMode}
          isSelected={selectedWidgetId === widget.id || isMultiSelected(widget.id)}
          isMultiSelected={isMultiSelected(widget.id)}
          onSelect={() => onSelectWidget(widget.id)}
          onDoubleClick={() => onEditWidgetProperties(widget.id)}
          onMouseDown={(e) => handleWidgetMouseDown(e, widget.id)}
          onContextMenu={(e) => handleWidgetContextMenu(e, widget.id)}
          onNavigateToPage={onNavigateToPage}
          onNavigateBack={onNavigateBack}
          onNavigateHome={onNavigateHome}
        />
      ))}

      {drawingOverlay}
      {lassoOverlay}

      {contextMenu && (
        <div
          className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 py-1 min-w-48"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.widgetId && (
            <>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onBringToFront(contextMenu.widgetId!); setContextMenu(null); }}>
                Ganz nach vorne
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onBringForward(contextMenu.widgetId!); setContextMenu(null); }}>
                Eine Ebene nach vorne
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onSendBackward(contextMenu.widgetId!); setContextMenu(null); }}>
                Eine Ebene nach hinten
              </button>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={() => { onSendToBack(contextMenu.widgetId!); setContextMenu(null); }}>
                Ganz nach hinten
              </button>
              <div className="border-t border-slate-700 my-1" />
              {selectedWidgetIds.length > 1 ? (
                <>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    onClick={() => { onCopyWidgets?.(selectedWidgetIds); setContextMenu(null); }}
                  >
                    <span>{selectedWidgetIds.length} Widgets kopieren</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30"
                    onClick={() => {
                      if (onDeleteWidgets) {
                        onDeleteWidgets(selectedWidgetIds);
                      } else {
                        for (const id of selectedWidgetIds) onDeleteWidget(id);
                      }
                      onSelectWidgets?.([]);
                      onSelectWidget(null);
                      setContextMenu(null);
                    }}
                  >
                    {selectedWidgetIds.length} Widgets loschen
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                    onClick={() => { onDuplicateWidget(contextMenu.widgetId!); setContextMenu(null); }}
                  >
                    <span>Duplizieren</span>
                    <span className="text-slate-500 text-xs">Strg+D</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                    onClick={() => { onCopyWidget(contextMenu.widgetId!); setContextMenu(null); }}
                  >
                    <span>Kopieren</span>
                    <span className="text-slate-500 text-xs">Strg+C</span>
                  </button>
                  {clipboard && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                      onClick={() => { onPasteWidget(); setContextMenu(null); }}
                    >
                      <span>Einfuegen</span>
                      <span className="text-slate-500 text-xs">Strg+V</span>
                    </button>
                  )}
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 flex items-center justify-between"
                    onClick={() => { onDeleteWidget(contextMenu.widgetId!); setContextMenu(null); }}
                  >
                    <span>Loschen</span>
                    <span className="text-slate-500 text-xs">Entf</span>
                  </button>
                </>
              )}
            </>
          )}
          {!contextMenu.widgetId && (
            <>
              {clipboard && (
                <button
                  className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center justify-between"
                  onClick={() => { onPasteWidget(); setContextMenu(null); }}
                >
                  <span>Einfuegen</span>
                  <span className="text-slate-500 text-xs">Strg+V</span>
                </button>
              )}
              {!clipboard && (
                <div className="px-4 py-2 text-sm text-slate-500">Kein Widget in Zwischenablage</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
