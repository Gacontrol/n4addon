import { useRef, useEffect, useCallback, useState } from 'react';
import { Building, Floor, Duct, Pipe, DuctType, DuctShape, PipeType } from '../../types/building';

interface Props {
  building: Building;
  ductType: DuctType;
  ductShape: DuctShape;
  ductWidth: number;
  ductHeight: number;
  pipeType: PipeType;
  pipeDiameter: number;
  tool: 'select' | 'duct' | 'pipe';
  axis?: 'xz' | 'yz';
  onAddVerticalDuct: (duct: Omit<Duct, 'id'>, fromFloorId: string) => void;
  onAddVerticalPipe: (pipe: Omit<Pipe, 'id'>, fromFloorId: string, toFloorId: string) => void;
  onUpdateVerticalDuct?: (ductId: string, floorId: string, changes: Partial<Duct>) => void;
  onMergeDucts?: (ductIds: string[], floorId: string) => string | null;
  gridSize: number;
  label?: string;
}

const CELL = 40;

const DUCT_COLORS: Record<DuctType, string> = {
  supply: '#3b82f6',
  return: '#10b981',
  exhaust: '#ef4444',
  fresh: '#06b6d4',
};

const PIPE_COLORS: Record<PipeType, string> = {
  supply: '#ef4444',
  return: '#3b82f6',
  'domestic-hot': '#f97316',
  'domestic-cold': '#06b6d4',
  sprinkler: '#22c55e',
  gas: '#facc15',
};

interface ContextMenu {
  x: number;
  y: number;
}

interface DragState {
  ductId: string;
  floorId: string;
  pointIndex: number;
}

export function SectionView({
  building,
  ductType,
  ductShape,
  ductWidth,
  ductHeight,
  pipeType,
  pipeDiameter,
  tool,
  axis = 'xz',
  onAddVerticalDuct,
  onAddVerticalPipe,
  onUpdateVerticalDuct,
  onMergeDucts,
  gridSize,
  label,
}: Props) {
  const { maxX: axisMaxH } = (() => {
    let maxH = 20;
    for (const floor of building.floors) {
      if (axis === 'xz') {
        for (const wall of floor.walls) maxH = Math.max(maxH, wall.x1, wall.x2);
        for (const room of floor.rooms) maxH = Math.max(maxH, room.x + room.width);
      } else {
        for (const wall of floor.walls) maxH = Math.max(maxH, wall.y1, wall.y2);
        for (const room of floor.rooms) maxH = Math.max(maxH, room.y + room.depth);
      }
    }
    return { maxX: maxH };
  })();
  const getH = (pt: { x: number; y: number }) => {
    if (axis === 'xz') return pt.x;
    return axisMaxH - pt.y;
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1.0);
  const [polyline, setPolyline] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedDuctIds, setSelectedDuctIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ ductId: string; pointIndex: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });

  const sortedFloors = [...building.floors].sort((a, b) => a.level - b.level);

  const getFloorBounds = useCallback(() => {
    return { maxX: axisMaxH };
  }, [axisMaxH]);

  const getTotalHeight = useCallback(() => {
    return sortedFloors.reduce((acc, f) => acc + f.height, 0);
  }, [sortedFloors]);

  const getFloorBaseY = useCallback((floorIdx: number) => {
    let y = 0;
    for (let i = 0; i < floorIdx; i++) y += sortedFloors[i].height;
    return y;
  }, [sortedFloors]);

  const toScreen = useCallback((wx: number, wy: number) => ({
    x: wx * CELL * zoom + offset.x,
    y: (getTotalHeight() - wy) * CELL * zoom + offset.y,
  }), [offset, zoom, getTotalHeight]);

  const toWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - offset.x) / (CELL * zoom),
    y: getTotalHeight() - (sy - offset.y) / (CELL * zoom),
  }), [offset, zoom, getTotalHeight]);

  const snapTo = useCallback((v: number) => Math.round(v / gridSize) * gridSize, [gridSize]);

  const getAllSectionDucts = useCallback((): { duct: Duct; floor: Floor; floorBaseY: number }[] => {
    const result: { duct: Duct; floor: Floor; floorBaseY: number }[] = [];
    for (let i = 0; i < sortedFloors.length; i++) {
      const floor = sortedFloors[i];
      const baseY = getFloorBaseY(i);
      for (const duct of (floor.ducts ?? [])) {
        if (duct.isVertical && duct.verticalSectionPoints && duct.verticalSectionPoints.length >= 2) {
          result.push({ duct, floor, floorBaseY: baseY });
        }
      }
    }
    return result;
  }, [sortedFloors, getFloorBaseY]);

  const hitTestDuct = useCallback((wx: number, wy: number): { duct: Duct; floor: Floor } | null => {
    const entries = getAllSectionDucts();
    for (const { duct, floor } of [...entries].reverse()) {
      const pts = duct.verticalSectionPoints!;
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i].x, ay = pts[i].y;
        const bx = pts[i + 1].x, by = pts[i + 1].y;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-9) continue;
        const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wy - ay) * dy) / len2));
        const px = ax + t * dx, py = ay + t * dy;
        const d = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2);
        if (d < duct.width * 0.6 + 0.2) return { duct, floor };
      }
    }
    return null;
  }, [getAllSectionDucts]);

  const hitTestPoint = useCallback((wx: number, wy: number, radius = 0.35): { ductId: string; floorId: string; pointIndex: number } | null => {
    const entries = getAllSectionDucts();
    for (const { duct, floor } of [...entries].reverse()) {
      const pts = duct.verticalSectionPoints!;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.sqrt((wx - pts[i].x) ** 2 + (wy - pts[i].y) ** 2);
        if (d < radius) return { ductId: duct.id, floorId: floor.id, pointIndex: i };
      }
    }
    return null;
  }, [getAllSectionDucts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const totalH = getTotalHeight();
    const { maxX } = getFloorBounds();
    const cellPx = CELL * zoom;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    if (label) {
      ctx.save();
      ctx.fillStyle = 'rgba(148,163,184,0.5)';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 8, 16);
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 0.5;
    const startGX = Math.floor(-offset.x / cellPx) - 1;
    const endGX = Math.ceil((W - offset.x) / cellPx) + 1;
    const startGY = Math.floor(-offset.y / cellPx) - 1;
    const endGY = Math.ceil((H - offset.y) / cellPx) + 1;
    for (let gx = startGX; gx <= endGX; gx += gridSize) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = startGY; gy <= endGY; gy += gridSize) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    let floorY = 0;
    for (let i = 0; i < sortedFloors.length; i++) {
      const floor = sortedFloors[i];
      const topY = floorY + floor.height;
      const screenBottom = toScreen(0, floorY);
      const screenTop = toScreen(maxX, topY);

      ctx.fillStyle = i % 2 === 0 ? 'rgba(30,41,59,0.5)' : 'rgba(51,65,85,0.3)';
      ctx.fillRect(screenTop.x - offset.x, screenTop.y, maxX * cellPx, floor.height * cellPx);

      ctx.strokeStyle = 'rgba(100,116,139,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, screenBottom.y);
      ctx.lineTo(W, screenBottom.y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`${floor.name} (${floor.height}m)`, 8, screenBottom.y - 8);

      for (const duct of (floor.ducts ?? [])) {
        if (duct.isVertical && duct.verticalSectionPoints && duct.verticalSectionPoints.length >= 2) continue;
        if (duct.points.length < 2) continue;
        const color = duct.color || DUCT_COLORS[duct.type];
        const isSelected = selectedDuctIds.includes(duct.id);
        ctx.strokeStyle = isSelected ? '#fff' : color;
        ctx.lineWidth = duct.width * cellPx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let pi = 0; pi < duct.points.length; pi++) {
          const p = duct.points[pi];
          const elev = duct.elevation ?? 0;
          const sp = toScreen(getH(p), floorY + elev);
          if (pi === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const pipe of (floor.pipes ?? [])) {
        if (pipe.points.length < 2) continue;
        const color = PIPE_COLORS[pipe.type];
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, pipe.diameter * cellPx);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let pi = 0; pi < pipe.points.length; pi++) {
          const p = pipe.points[pi];
          const elev = pipe.elevation ?? 0;
          const sp = toScreen(getH(p), floorY + elev);
          if (pi === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      floorY = topY;
    }

    const sectionDucts = getAllSectionDucts();
    for (const { duct } of sectionDucts) {
      const pts = duct.verticalSectionPoints!;
      const color = duct.color || DUCT_COLORS[duct.type];
      const isSelected = selectedDuctIds.includes(duct.id);
      ctx.save();
      ctx.strokeStyle = isSelected ? '#ffffff' : color;
      ctx.lineWidth = duct.width * cellPx;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = isSelected ? 0.9 : 0.75;
      ctx.beginPath();
      for (let pi = 0; pi < pts.length; pi++) {
        const sp = toScreen(pts[pi].x, pts[pi].y);
        if (pi === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
      if (isSelected) {
        ctx.lineWidth = duct.width * cellPx + 4;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let pi = 0; pi < pts.length; pi++) {
        const sp = toScreen(pts[pi].x, pts[pi].y);
        const isHover = hoverPoint?.ductId === duct.id && hoverPoint?.pointIndex === pi;
        const isDragging = dragState?.ductId === duct.id && dragState?.pointIndex === pi;
        const r = (isHover || isDragging) ? 7 : 4;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDragging ? '#f59e0b' : isHover ? '#fff' : (isSelected ? '#fff' : color);
        ctx.fill();
        if (isHover || isDragging) {
          ctx.strokeStyle = isDragging ? '#f59e0b' : color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(59,130,246,0.4)';
    ctx.lineWidth = 1;
    const leftEdge = toScreen(0, 0);
    ctx.beginPath();
    ctx.moveTo(leftEdge.x, 0);
    ctx.lineTo(leftEdge.x, H);
    ctx.stroke();
    const groundY = toScreen(0, 0).y;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    if (polyline.length >= 1 && mousePos && (tool === 'duct' || tool === 'pipe')) {
      const world = toWorld(mousePos.x, mousePos.y);
      const snappedX = snapTo(world.x);
      const snappedY = snapTo(world.y);
      const endScreen = toScreen(snappedX, snappedY);

      const color = tool === 'duct' ? DUCT_COLORS[ductType] : PIPE_COLORS[pipeType];
      const lw = tool === 'duct' ? ductWidth * cellPx : Math.max(3, pipeDiameter * cellPx);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      for (let pi = 0; pi < polyline.length; pi++) {
        const sp = toScreen(polyline[pi].x, polyline[pi].y);
        if (pi === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      for (const pt of polyline) {
        const sp = toScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    if (mousePos && (tool === 'duct' || tool === 'pipe')) {
      const world = toWorld(mousePos.x, mousePos.y);
      const snappedX = snapTo(world.x);
      const snappedY = snapTo(world.y);
      const sp = toScreen(snappedX, snappedY);
      ctx.fillStyle = tool === 'duct' ? DUCT_COLORS[ductType] : PIPE_COLORS[pipeType];
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (dragState && mousePos) {
      const world = toWorld(mousePos.x, mousePos.y);
      const sp = toScreen(snapTo(world.x), snapTo(world.y));
      ctx.save();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

  }, [building, sortedFloors, offset, zoom, polyline, mousePos, tool, ductType, pipeType, ductWidth, ductHeight, pipeDiameter, gridSize, toScreen, toWorld, getTotalHeight, getFloorBounds, getAllSectionDucts, selectedDuctIds, hoverPoint, dragState, snapTo, axis, label, getH]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffsetStart.current = { ...offset };
      return;
    }
    if (e.button !== 0) return;
    const { cx, cy } = getCanvasPos(e);

    if (tool === 'duct' || tool === 'pipe') {
      const world = toWorld(cx, cy);
      const snappedX = snapTo(world.x);
      const snappedY = snapTo(world.y);
      setPolyline(prev => [...prev, { x: snappedX, y: snappedY }]);
      return;
    }

    if (tool === 'select') {
      const world = toWorld(cx, cy);

      const ptHit = hitTestPoint(world.x, world.y);
      if (ptHit) {
        setDragState(ptHit);
        setSelectedDuctIds([ptHit.ductId]);
        setContextMenu(null);
        return;
      }

      const hit = hitTestDuct(world.x, world.y);
      if (hit) {
        setSelectedDuctIds(prev => {
          if (e.shiftKey) {
            return prev.includes(hit.duct.id) ? prev.filter(id => id !== hit.duct.id) : [...prev, hit.duct.id];
          }
          return [hit.duct.id];
        });
      } else {
        setSelectedDuctIds([]);
      }
      setContextMenu(null);
    }
  }, [tool, toWorld, offset, hitTestDuct, hitTestPoint, snapTo]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setOffset({ x: panOffsetStart.current.x + dx, y: panOffsetStart.current.y + dy });
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setMousePos({ x: cx, y: cy });

    if (dragState) return;

    if (tool === 'select') {
      const world = toWorld(cx, cy);
      const ptHit = hitTestPoint(world.x, world.y);
      setHoverPoint(ptHit ? { ductId: ptHit.ductId, pointIndex: ptHit.pointIndex } : null);
    }
  }, [dragState, tool, toWorld, hitTestPoint]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    if (dragState && tool === 'select') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const world = toWorld(cx, cy);
        const snappedX = snapTo(world.x);
        const snappedY = snapTo(world.y);

        const entries = getAllSectionDucts();
        const entry = entries.find(({ duct }) => duct.id === dragState.ductId);
        if (entry) {
          const newPts = entry.duct.verticalSectionPoints!.map((p, i) =>
            i === dragState.pointIndex ? { x: snappedX, y: snappedY } : p
          );
          onUpdateVerticalDuct?.(dragState.ductId, dragState.floorId, {
            verticalSectionPoints: newPts,
          });
        }
      }
      setDragState(null);
    }
  }, [dragState, tool, toWorld, snapTo, getAllSectionDucts, onUpdateVerticalDuct]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (polyline.length < 2) { setPolyline([]); return; }
    if (tool !== 'duct' && tool !== 'pipe') return;

    const pts = polyline;
    const minY = Math.min(...pts.map(p => p.y));
    const midX = pts[0].x;

    let fromFloor: Floor | null = null;
    let toFloor: Floor | null = null;
    let floorY = 0;
    for (let i = 0; i < sortedFloors.length; i++) {
      const floor = sortedFloors[i];
      const topY = floorY + floor.height;
      if (minY >= floorY && minY < topY) fromFloor = floor;
      const maxY = Math.max(...pts.map(p => p.y));
      if (maxY >= floorY && maxY < topY) toFloor = floor;
      floorY = topY;
    }
    if (!fromFloor) fromFloor = sortedFloors[0];
    if (!toFloor) toFloor = fromFloor;

    if (tool === 'duct') {
      const duct: Omit<Duct, 'id'> = {
        points: [{ x: midX, y: 0 }, { x: midX, y: 0 }],
        shape: ductShape,
        type: ductType,
        width: ductWidth,
        height: ductHeight,
        elevation: 0,
        insulated: false,
        isVertical: true,
        verticalX: midX,
        verticalY: 5,
        verticalSectionPoints: pts,
      };
      onAddVerticalDuct(duct, fromFloor.id);
    } else {
      const pipe: Omit<Pipe, 'id'> = {
        points: [{ x: midX, y: 0 }, { x: midX, y: 0 }],
        type: pipeType,
        diameter: pipeDiameter,
        elevation: 0,
        insulated: false,
      };
      onAddVerticalPipe(pipe, fromFloor.id, toFloor.id);
    }
    setPolyline([]);
  }, [polyline, tool, sortedFloors, ductShape, ductType, ductWidth, ductHeight, pipeType, pipeDiameter, onAddVerticalDuct, onAddVerticalPipe]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (tool === 'duct' || tool === 'pipe') {
      if (polyline.length >= 2) {
        handleDoubleClick(e);
      } else {
        setPolyline([]);
      }
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [tool, polyline, handleDoubleClick]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.2, Math.min(5, zoom * zoomFactor));
    const worldBefore = toWorld(mx, my);
    setZoom(newZoom);
    setOffset({
      x: mx - worldBefore.x * CELL * newZoom,
      y: my - (getTotalHeight() - worldBefore.y) * CELL * newZoom,
    });
  }, [zoom, toWorld, getTotalHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const resize = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const allSectionDucts = getAllSectionDucts();
  const selectedSectionDucts = allSectionDucts.filter(({ duct }) => selectedDuctIds.includes(duct.id));
  const isDraggingPoint = dragState !== null;

  return (
    <div className="relative w-full h-full" onClick={() => setContextMenu(null)}>
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${
          tool !== 'select' ? 'cursor-crosshair' :
          isDraggingPoint ? 'cursor-grabbing' :
          hoverPoint ? 'cursor-grab' :
          'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setMousePos(null); isPanning.current = false; if (dragState) setDragState(null); setHoverPoint(null); }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
      />

      {contextMenu && selectedDuctIds.length >= 2 && (
        <div
          className="absolute z-50 bg-slate-800 border border-slate-600 rounded shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-blue-900/50 text-blue-400 flex items-center gap-2"
            onClick={() => {
              if (selectedSectionDucts.length >= 2) {
                const floorId = selectedSectionDucts[0].floor.id;
                onMergeDucts?.(selectedDuctIds, floorId);
                setSelectedDuctIds([]);
              }
              setContextMenu(null);
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
            Kanäle verbinden ({selectedDuctIds.length})
          </button>
        </div>
      )}

      <div className="absolute bottom-3 left-3 text-slate-500 text-[10px] bg-slate-900/70 px-2 py-1 rounded">
        {tool === 'select'
          ? 'Schnittansicht · Knotenpunkt ziehen: Kanal bearbeiten · Shift+Klick: mehrere auswählen · Rechtsklick: verbinden'
          : tool === 'duct'
          ? 'Kanal zeichnen · Klicken: Punkt setzen · Doppelklick/Rechtsklick: fertigstellen'
          : 'Rohr zeichnen · Klicken: Punkt setzen · Doppelklick/Rechtsklick: fertigstellen'}
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">+</button>
        <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">-</button>
        <div className="w-7 h-5 flex items-center justify-center text-[9px] text-slate-500 font-mono">{Math.round(zoom * 100)}%</div>
      </div>
    </div>
  );
}
