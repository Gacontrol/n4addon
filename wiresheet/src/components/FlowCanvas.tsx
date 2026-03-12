// FlowCanvas.tsx

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FlowNode, VisuBindingInfo } from './FlowNode';
import { ConnectionLine } from './ConnectionLine';
import { FlowNode as FlowNodeType, Connection, DatapointOverride } from '../types/flow';
import { VisuPage } from '../types/visualization';
import { Trash2, Copy, Clipboard, Type, ZoomIn, ZoomOut } from 'lucide-react';

/* ----------- restlicher Code unverändert ----------- */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({

/* props unverändert */

}) => {

  const canvasRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null); /* LASSO FIX */

  /* restlicher state unverändert */

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;

    if (target.closest('[data-node-id]') || target.closest('.port') || target.closest('.node-port')) return;

    if (connectingFrom) {
      onConnectionCancel();
      return;
    }

    /* LASSO FIX: Pointer Capture aktivieren */
    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(e.pointerId);
      pointerIdRef.current = e.pointerId;
    }

    const coords = getCanvasCoords(e);

    setLasso({
      startX: coords.x,
      startY: coords.y,
      currentX: coords.x,
      currentY: coords.y
    });

    onClearSelection();
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {

    if (lasso) {
      const coords = getCanvasCoords(e);

      setLasso(prev =>
        prev
          ? {
              ...prev,
              currentX: coords.x,
              currentY: coords.y
            }
          : null
      );
    }

    if (isDraggingMultiple && dragStartMouse.current && canvasRef.current) {
      const coords = getCanvasCoords(e);
      const dx = coords.x - dragStartMouse.current.x;
      const dy = coords.y - dragStartMouse.current.y;

      const updates: Array<{ id: string; x: number; y: number }> = [];

      dragStartPositions.current.forEach((pos, id) => {
        updates.push({
          id,
          x: Math.max(0, pos.x + dx),
          y: Math.max(0, pos.y + dy)
        });
      });

      onMultipleNodePositionsChange(updates);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {

    /* LASSO FIX: Pointer Capture freigeben */
    if (canvasRef.current && pointerIdRef.current !== null) {
      try {
        canvasRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {}
      pointerIdRef.current = null;
    }

    if (isDraggingMultiple) {
      setIsDraggingMultiple(false);
      dragStartPositions.current.clear();
      dragStartMouse.current = null;
      return;
    }

    if (connectingFromRef.current) {
      const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);

      for (const el of elementsAtPoint) {

        const portEl = el.closest('[data-port-id]') as HTMLElement | null;

        if (portEl) {

          const portIdAttr = portEl.getAttribute('data-port-id');

          if (portIdAttr) {

            const parts = portIdAttr.split('-');

            const portId = parts.slice(-2).join('-');
            const nodeId = parts.slice(0, -2).join('-');

            if (nodeId !== connectingFromRef.current.nodeId) {

              onConnectionEnd(
                nodeId,
                portId,
                connectingFromRef.current.nodeId,
                connectingFromRef.current.portId
              );

              return;
            }
          }
        }
      }
    }

    if (lasso) {

      const minX = Math.min(lasso.startX, lasso.currentX);
      const maxX = Math.max(lasso.startX, lasso.currentX);
      const minY = Math.min(lasso.startY, lasso.currentY);
      const maxY = Math.max(lasso.startY, lasso.currentY);

      const isActualLasso =
        Math.abs(lasso.currentX - lasso.startX) > 5 ||
        Math.abs(lasso.currentY - lasso.startY) > 5;

      if (isActualLasso) {

        const selectedIds = nodes
          .filter(node => {

            const nx = node.position.x;
            const ny = node.position.y;
            const nw = 180;
            const nh = 60;

            return nx < maxX && nx + nw > minX && ny < maxY && ny + nh > minY;

          })
          .map(n => n.id);

        if (selectedIds.length > 0) {
          onNodesSelect(selectedIds);
        }
      }

      setLasso(null);
    }
  };

  /* restlicher Code unverändert */

};
