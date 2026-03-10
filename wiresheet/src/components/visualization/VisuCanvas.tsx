import React, { useRef, useState, useCallback, useEffect } from 'react';
import { VisuWidget, VisuPage } from '../../types/visualization';
import { FlowNode } from '../../types/flow';
import { VisuWidgetRenderer } from './VisuWidget';

interface VisuCanvasProps {
  page: VisuPage;
  liveValues: Record<string, unknown>;
  logicNodes: FlowNode[];
  isEditMode: boolean;
  selectedWidgetId: string | null;
  onSelectWidget: (widgetId: string | null) => void;
  onUpdateWidget: (widgetId: string, updates: Partial<VisuWidget>) => void;
  onDeleteWidget: (widgetId: string) => void;
  onWidgetValueChange: (widgetId: string, value: unknown) => void;
  onEditWidgetProperties: (widgetId: string) => void;
  onNavigateToPage?: (pageId: string) => void;
  onNavigateBack?: () => void;
  onNavigateHome?: () => void;
}

export const VisuCanvas: React.FC<VisuCanvasProps> = ({
  page,
  liveValues,
  logicNodes,
  isEditMode,
  selectedWidgetId,
  onSelectWidget,
  onUpdateWidget,
  onWidgetValueChange,
  onEditWidgetProperties,
  onNavigateToPage,
  onNavigateBack,
  onNavigateHome
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    widgetId: string;
    startX: number;
    startY: number;
    widgetStartX: number;
    widgetStartY: number;
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
    if (portId) {
      return liveValues[`${nodeId}:${portId}`] ?? liveValues[nodeId];
    }
    return liveValues[nodeId];
  }, [liveValues, logicNodes]);

  const getWidgetStatusValue = useCallback((widget: VisuWidget): unknown => {
    if (!widget.statusBinding) return undefined;
    const { nodeId, portId } = widget.statusBinding;
    if (portId) {
      return liveValues[`${nodeId}:${portId}`] ?? liveValues[nodeId];
    }
    return liveValues[nodeId];
  }, [liveValues]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onSelectWidget(null);
    }
  }, [onSelectWidget]);

  const handleWidgetMouseDown = useCallback((e: React.MouseEvent, widgetId: string) => {
    if (!isEditMode) return;

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
      setDragState({
        widgetId,
        startX: e.clientX,
        startY: e.clientY,
        widgetStartX: widget.position.x,
        widgetStartY: widget.position.y
      });
    }

    onSelectWidget(widgetId);
    e.preventDefault();
  }, [isEditMode, page.widgets, onSelectWidget]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState) {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const gridSize = page.gridSize || 10;

      let newX = dragState.widgetStartX + deltaX;
      let newY = dragState.widgetStartY + deltaY;

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
  }, [dragState, resizeState, page.gridSize, page.showGrid, onUpdateWidget]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setResizeState(null);
  }, []);

  useEffect(() => {
    if (dragState || resizeState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, resizeState, handleMouseMove, handleMouseUp]);

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

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-auto"
      style={{ backgroundColor: page.backgroundColor || '#0f172a' }}
      onClick={handleCanvasClick}
    >
      {gridPattern}
      {page.widgets.map((widget) => (
        <div
          key={widget.id}
          onMouseDown={(e) => handleWidgetMouseDown(e, widget.id)}
        >
          <VisuWidgetRenderer
            widget={widget}
            value={getWidgetValue(widget)}
            statusValue={getWidgetStatusValue(widget)}
            onValueChange={(value) => onWidgetValueChange(widget.id, value)}
            isEditMode={isEditMode}
            isSelected={selectedWidgetId === widget.id}
            onSelect={() => onSelectWidget(widget.id)}
            onDoubleClick={() => onEditWidgetProperties(widget.id)}
            onNavigateToPage={onNavigateToPage}
            onNavigateBack={onNavigateBack}
            onNavigateHome={onNavigateHome}
          />
        </div>
      ))}
    </div>
  );
};
