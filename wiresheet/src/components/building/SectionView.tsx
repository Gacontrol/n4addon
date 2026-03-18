import { useRef, useEffect, useCallback, useState } from 'react';
import { Trash2, X, Wind } from 'lucide-react';
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
  sliceDepth?: number;
  selectedDuctId?: string | null;
  onSelectDuct?: (id: string | null) => void;
  onDeleteDuct?: (ductId: string, floorId: string) => void;
  onUpdateDuct?: (ductId: string, floorId: string, changes: Partial<Duct>) => void;
  onAddVerticalDuct: (duct: Omit<Duct, 'id'>, fromFloorId: string) => void;
  onAddVerticalPipe: (pipe: Omit<Pipe, 'id'>, fromFloorId: string, toFloorId: string) => void;
  onUpdateVerticalDuct?: (ductId: string, floorId: string, changes: Partial<Duct>) => void;
  onUpdateVerticalDuctSectionPoints?: (ductId: string, floorId: string, newPoints: { x: number; y: number }[]) => void;
  onMergeDucts?: (ductIds: string[], floorId: string) => string | null;
  gridSize: number;
  label?: string;
}

const DUCT_TYPE_LABELS: Record<DuctType, string> = {
  supply: 'Zuluft',
  return: 'Abluft',
  exhaust: 'Fortluft',
  fresh: 'Frischluft',
};

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
  sliceDepth,
  selectedDuctId: externalSelectedDuctId,
  onSelectDuct,
  onDeleteDuct,
  onUpdateDuct,
  onAddVerticalDuct,
  onAddVerticalPipe,
  onUpdateVerticalDuct,
  onUpdateVerticalDuctSectionPoints,
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
    return pt.y;
  };

  const getDuctSectionX = useCallback((duct: Duct) => {
    if (axis === 'xz') return duct.verticalX ?? duct.verticalSectionPoints?.[0]?.x ?? 0;
    return duct.verticalY ?? duct.verticalSectionPoints?.[0]?.x ?? 0;
  }, [axis]);

  const sectionXToBuildingCoords = useCallback((sectionX: number): { bx?: number; by?: number } => {
    if (axis === 'xz') return { bx: sectionX, by: sliceDepth };
    return { by: sectionX, bx: sliceDepth };
  }, [axis, sliceDepth]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1.0);
  const [polyline, setPolyline] = useState<{ x: number; y: number }[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedDuctIds, setSelectedDuctIds] = useState<string[]>([]);
  const [showProperties, setShowProperties] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
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

  const getFloorForY = useCallback((worldY: number): { floor: Floor; floorIdx: number; baseY: number; topY: number } | null => {
    let baseY = 0;
    for (let i = 0; i < sortedFloors.length; i++) {
      const topY = baseY + sortedFloors[i].height;
      if (worldY >= baseY && worldY < topY) {
        return { floor: sortedFloors[i], floorIdx: i, baseY, topY };
      }
      baseY = topY;
    }
    return null;
  }, [sortedFloors]);

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
      const sx = axis === 'xz'
        ? (duct.verticalX ?? pts[0]?.x ?? 0)
        : (duct.verticalY ?? pts[0]?.x ?? 0);
      for (let i = 0; i < pts.length - 1; i++) {
        const ay = pts[i].y, by = pts[i + 1].y;
        const t = Math.max(0, Math.min(1, (wy - ay) / (by - ay || 1)));
        const py = ay + t * (by - ay);
        const d = Math.sqrt((wx - sx) ** 2 + (wy - py) ** 2);
        if (d < duct.width * 0.6 + 0.2) return { duct, floor };
      }
    }
    return null;
  }, [getAllSectionDucts, axis]);

  const hitTestPoint = useCallback((wx: number, wy: number, radius = 0.35): { ductId: string; floorId: string; pointIndex: number } | null => {
    const entries = getAllSectionDucts();
    for (const { duct, floor } of [...entries].reverse()) {
      const pts = duct.verticalSectionPoints!;
      const sx = axis === 'xz'
        ? (duct.verticalX ?? pts[0]?.x ?? 0)
        : (duct.verticalY ?? pts[0]?.x ?? 0);
      for (let i = 0; i < pts.length; i++) {
        const d = Math.sqrt((wx - sx) ** 2 + (wy - pts[i].y) ** 2);
        if (d < radius) return { ductId: duct.id, floorId: floor.id, pointIndex: i };
      }
    }
    return null;
  }, [getAllSectionDucts, axis]);

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
        const elev = duct.elevation ?? 0;
        const ductVisH = duct.shape === 'round' ? duct.width : duct.height;
        const halfH = ductVisH / 2;
        const topWorldY = floorY + elev + halfH;
        const botWorldY = floorY + elev - halfH;
        const topScreen = toScreen(0, topWorldY);
        const botScreen = toScreen(0, botWorldY);
        const rectH = Math.max(2, Math.abs(topScreen.y - botScreen.y));

        ctx.globalAlpha = 0.7;
        for (let pi = 0; pi + 1 < duct.points.length; pi++) {
          const p0 = duct.points[pi];
          const p1 = duct.points[pi + 1];
          const sp0 = toScreen(getH(p0), floorY + elev);
          const sp1 = toScreen(getH(p1), floorY + elev);
          const x = Math.min(sp0.x, sp1.x);
          const w = Math.abs(sp1.x - sp0.x);
          const y = topScreen.y;
          ctx.fillStyle = color + 'b3';
          ctx.fillRect(x, y, w, rectH);
          if (isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, rectH);
          } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, rectH);
          }
        }
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
      const sectX = getDuctSectionX(duct);
      const color = duct.color || DUCT_COLORS[duct.type];
      const isSelected = selectedDuctIds.includes(duct.id);
      ctx.save();
      ctx.strokeStyle = isSelected ? '#ffffff' : color;
      ctx.lineWidth = duct.width * cellPx;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      ctx.globalAlpha = isSelected ? 0.9 : 0.75;
      ctx.beginPath();
      for (let pi = 0; pi < pts.length; pi++) {
        const isDraggingPt = dragState?.ductId === duct.id && dragState?.pointIndex === pi && dragPos;
        const ptY = isDraggingPt ? dragPos!.y : pts[pi].y;
        const sp = toScreen(sectX, ptY);
        if (pi === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
      if (isSelected) {
        ctx.lineWidth = duct.width * cellPx + 4;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        for (let pi = 0; pi < pts.length; pi++) {
          const isDraggingPt = dragState?.ductId === duct.id && dragState?.pointIndex === pi && dragPos;
          const ptY = isDraggingPt ? dragPos!.y : pts[pi].y;
          const sp = toScreen(sectX, ptY);
          if (pi === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (let pi = 0; pi < pts.length; pi++) {
        const isDraggingPt = dragState?.ductId === duct.id && dragState?.pointIndex === pi;
        const ptY = (isDraggingPt && dragPos) ? dragPos.y : pts[pi].y;
        const sp = toScreen(sectX, ptY);
        const isHover = hoverPoint?.ductId === duct.id && hoverPoint?.pointIndex === pi;
        const r = (isHover || isDraggingPt) ? 7 : 4;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDraggingPt ? '#f59e0b' : isHover ? '#fff' : (isSelected ? '#fff' : color);
        ctx.fill();
        if (isHover || isDraggingPt) {
          ctx.strokeStyle = isDraggingPt ? '#f59e0b' : color;
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

  }, [building, sortedFloors, offset, zoom, polyline, mousePos, tool, ductType, pipeType, ductWidth, ductHeight, pipeDiameter, gridSize, toScreen, toWorld, getTotalHeight, getFloorBounds, getAllSectionDucts, selectedDuctIds, hoverPoint, dragState, dragPos, snapTo, axis, label, getH, getDuctSectionX]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  };

  const finishVerticalDuct = useCallback((pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return;
    const minY = Math.min(...pts.map(p => p.y));
    const midX = pts[0].x;
    let fromFloor: Floor | null = null;
    let floorY = 0;
    for (let i = 0; i < sortedFloors.length; i++) {
      const floor = sortedFloors[i];
      const topY = floorY + floor.height;
      if (minY >= floorY && minY < topY) { fromFloor = floor; break; }
      floorY = topY;
    }
    if (!fromFloor) fromFloor = sortedFloors[0];
    const buildingCoords = sectionXToBuildingCoords(midX);
    const duct: Omit<Duct, 'id'> = {
      points: [{ x: midX, y: 0 }, { x: midX, y: 0 }],
      shape: ductShape,
      type: ductType,
      width: ductWidth,
      height: ductHeight,
      elevation: 0,
      insulated: false,
      isVertical: true,
      verticalX: buildingCoords.bx ?? midX,
      verticalY: buildingCoords.by ?? 5,
      verticalSectionPoints: pts,
    };
    onAddVerticalDuct(duct, fromFloor.id);
  }, [sortedFloors, ductShape, ductType, ductWidth, ductHeight, onAddVerticalDuct, sectionXToBuildingCoords]);

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

      if (tool === 'duct') {
        setPolyline(prev => {
          const newPts = [...prev, { x: snappedX, y: snappedY }];
          if (newPts.length < 2) return newPts;

          const firstPt = newPts[0];
          const firstFloor = getFloorForY(firstPt.y);
          if (!firstFloor) return newPts;

          const lastPt = newPts[newPts.length - 1];
          const lastFloorInfo = getFloorForY(lastPt.y);

          if (!lastFloorInfo || lastFloorInfo.floorIdx !== firstFloor.floorIdx) {
            const isGoingDown = lastPt.y < firstPt.y;
            const boundaryY = isGoingDown ? firstFloor.baseY : firstFloor.topY - gridSize;
            const cappedPts = [...newPts.slice(0, -1), { x: lastPt.x, y: boundaryY }];
            if (cappedPts.length >= 2) {
              finishVerticalDuct(cappedPts);
            }
            const nextFloorInfo = getFloorForY(isGoingDown ? firstFloor.baseY - 0.001 : firstFloor.topY);
            if (nextFloorInfo) {
              const connectionY = isGoingDown ? firstFloor.baseY : firstFloor.topY;
              return [{ x: lastPt.x, y: connectionY }];
            }
            return [];
          }

          return newPts;
        });
        return;
      }

      setPolyline(prev => [...prev, { x: snappedX, y: snappedY }]);
      return;
    }

    if (tool === 'select') {
      const world = toWorld(cx, cy);

      const ptHit = hitTestPoint(world.x, world.y);
      if (ptHit) {
        setDragState(ptHit);
        setSelectedDuctIds([ptHit.ductId]);
        onSelectDuct?.(ptHit.ductId);
        setShowProperties(true);
        setContextMenu(null);
        return;
      }

      const hit = hitTestDuct(world.x, world.y);
      if (hit) {
        if (!e.shiftKey) {
          setSelectedDuctIds([hit.duct.id]);
          onSelectDuct?.(hit.duct.id);
          setShowProperties(true);
        } else {
          setSelectedDuctIds(prev =>
            prev.includes(hit.duct.id) ? prev.filter(id => id !== hit.duct.id) : [...prev, hit.duct.id]
          );
        }
      } else {
        setSelectedDuctIds([]);
        onSelectDuct?.(null);
        setShowProperties(false);
      }
      setContextMenu(null);
    }
  }, [tool, toWorld, offset, hitTestDuct, hitTestPoint, snapTo, onSelectDuct, getFloorForY, finishVerticalDuct, gridSize]);

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

    if (dragState) {
      const world = toWorld(cx, cy);
      setDragPos({ x: snapTo(world.x), y: snapTo(world.y) });
      return;
    }

    if (tool === 'select') {
      const world = toWorld(cx, cy);
      const ptHit = hitTestPoint(world.x, world.y);
      setHoverPoint(ptHit ? { ductId: ptHit.ductId, pointIndex: ptHit.pointIndex } : null);
    }
  }, [dragState, tool, toWorld, hitTestPoint, snapTo]);

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

        const finalX = snappedX;
        const finalY = snappedY;

        const entries = getAllSectionDucts();
        const entry = entries.find(({ duct }) => duct.id === dragState.ductId);
        if (entry) {
          const newPts = entry.duct.verticalSectionPoints!.map((p, i) =>
            i === dragState.pointIndex ? { x: finalX, y: finalY } : p
          );
          if (onUpdateVerticalDuctSectionPoints) {
            onUpdateVerticalDuctSectionPoints(dragState.ductId, dragState.floorId, newPts);
          } else {
            const buildingCoords = sectionXToBuildingCoords(finalX);
            const changes: Partial<Duct> = { verticalSectionPoints: newPts };
            if (buildingCoords.bx !== undefined) changes.verticalX = buildingCoords.bx;
            if (buildingCoords.by !== undefined) changes.verticalY = buildingCoords.by;
            onUpdateVerticalDuct?.(dragState.ductId, dragState.floorId, changes);
          }
        }
      }
      setDragState(null);
      setDragPos(null);
    }
  }, [dragState, tool, toWorld, snapTo, getAllSectionDucts, onUpdateVerticalDuct, onUpdateVerticalDuctSectionPoints, sectionXToBuildingCoords, sortedFloors, getH]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (polyline.length < 2) { setPolyline([]); return; }
    if (tool !== 'duct' && tool !== 'pipe') return;

    const pts = polyline;
    const midX = pts[0].x;

    if (tool === 'duct') {
      finishVerticalDuct(pts);
    } else {
      const minY = Math.min(...pts.map(p => p.y));
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
  }, [polyline, tool, sortedFloors, pipeType, pipeDiameter, onAddVerticalPipe, finishVerticalDuct]);

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

  const activeSingleDuctEntry = selectedSectionDucts.length === 1 ? selectedSectionDucts[0] : null;
  const activeSingleDuct = activeSingleDuctEntry?.duct ?? null;
  const activeSingleFloor = activeSingleDuctEntry?.floor ?? null;

  const ductColor = activeSingleDuct ? (activeSingleDuct.color || DUCT_COLORS[activeSingleDuct.type]) : '#3b82f6';

  return (
    <div className="relative w-full h-full flex" onClick={() => setContextMenu(null)}>
      <div className="relative flex-1 min-w-0">
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
            ? 'Schnittansicht · Knotenpunkt ziehen · Shift+Klick: mehrere auswählen · Rechtsklick: verbinden'
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

      {showProperties && activeSingleDuct && activeSingleFloor && (
        <div className="w-52 flex-shrink-0 border-l border-slate-700 bg-slate-800/95 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5" style={{ color: ductColor }} />
              Vertikaler Kanal
            </span>
            <button onClick={() => setShowProperties(false)} className="w-4 h-4 text-slate-500 hover:text-white flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Typ</label>
              <select
                className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                value={activeSingleDuct.type}
                onChange={e => onUpdateDuct?.(activeSingleDuct.id, activeSingleFloor.id, { type: e.target.value as DuctType })}
              >
                {(Object.keys(DUCT_TYPE_LABELS) as DuctType[]).map(t => (
                  <option key={t} value={t}>{DUCT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Form</label>
              <select
                className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                value={activeSingleDuct.shape}
                onChange={e => onUpdateDuct?.(activeSingleDuct.id, activeSingleFloor.id, { shape: e.target.value as DuctShape })}
              >
                <option value="rectangular">Rechteckig</option>
                <option value="round">Rund</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Breite (m)</label>
                <input type="number" step="0.05" min="0.1"
                  className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-sky-500"
                  value={activeSingleDuct.width}
                  onChange={e => onUpdateDuct?.(activeSingleDuct.id, activeSingleFloor.id, { width: parseFloat(e.target.value) || 0.3 })} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Höhe (m)</label>
                <input type="number" step="0.05" min="0.1"
                  className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-sky-500"
                  value={activeSingleDuct.height}
                  onChange={e => onUpdateDuct?.(activeSingleDuct.id, activeSingleFloor.id, { height: parseFloat(e.target.value) || 0.2 })} />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Bezeichnung</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-sky-500"
                value={activeSingleDuct.label || ''}
                onChange={e => onUpdateDuct?.(activeSingleDuct.id, activeSingleFloor.id, { label: e.target.value })} />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
              <input type="color"
                className="w-full h-7 rounded cursor-pointer bg-slate-700 border border-slate-600"
                value={activeSingleDuct.color || DUCT_COLORS[activeSingleDuct.type]}
                onChange={e => onUpdateDuct?.(activeSingleDuct.id, activeSingleFloor.id, { color: e.target.value })} />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={activeSingleDuct.insulated}
                onChange={e => onUpdateDuct?.(activeSingleDuct.id, activeSingleFloor.id, { insulated: e.target.checked })}
                className="accent-sky-500" />
              Gedämmt
            </label>

            <div className="pt-1 border-t border-slate-700">
              <div className="text-[10px] text-slate-500 mb-1.5">3D Vorschau</div>
              <DuctMiniPreview duct={activeSingleDuct} floors={sortedFloors} />
            </div>

            <button
              onClick={() => {
                if (activeSingleDuct && activeSingleFloor) {
                  onDeleteDuct?.(activeSingleDuct.id, activeSingleFloor.id);
                  setSelectedDuctIds([]);
                  setShowProperties(false);
                  onSelectDuct?.(null);
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Kanal löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DUCT_3D_COLORS: Record<DuctType, string> = {
  supply: '#3b82f6',
  return: '#10b981',
  exhaust: '#ef4444',
  fresh: '#06b6d4',
};

function DuctMiniPreview({ duct, floors }: { duct: Duct; floors: { height: number; name: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const color = duct.color || DUCT_3D_COLORS[duct.type];
    const dw = duct.width;
    const dh = duct.shape === 'round' ? duct.width : duct.height;
    const px3 = 0.35;
    const py3 = 0.25;

    const isVertical = !!(duct.isVertical && duct.verticalSectionPoints && duct.verticalSectionPoints.length >= 2);
    const isHorizontal = !isVertical && duct.points.length >= 2;

    if (!isVertical && !isHorizontal) {
      ctx.fillStyle = '#475569';
      ctx.font = '10px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Keine Punkte', W / 2, H / 2);
      return;
    }

    if (isVertical) {
      const pts = duct.verticalSectionPoints!;
      const minY = Math.min(...pts.map(p => p.y));
      const maxY = Math.max(...pts.map(p => p.y));
      const ductH = maxY - minY;
      const padY = Math.max(0.5, ductH * 0.2);

      const sceneW = dw * 2 + px3 * dw;
      const sceneH = ductH + padY * 2;
      const scaleX = (W * 0.7) / sceneW;
      const scaleY = (H * 0.82) / sceneH;
      const scale = Math.min(scaleX, scaleY);
      const ox = W * 0.25;
      const oy = H * 0.88;

      const toSX = (wx: number) => ox + wx * scale;
      const toSY = (wy: number) => oy - (wy - minY + padY) * scale;
      const proj = (wx: number, wy: number, wz: number) => ({
        x: toSX(wx + wz * px3),
        y: toSY(wy + wz * py3),
      });

      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= floors.length; i++) {
        let flY = 0;
        for (let j = 0; j < i; j++) flY += floors[j].height;
        if (flY < minY - padY || flY > maxY + padY) continue;
        const sy = toSY(flY);
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
      }

      const hx = dw / 2;
      const hz = dh / 2;
      const faces = [
        { verts: [[-hx,0,-hz],[-hx,ductH,-hz],[hx,ductH,-hz],[hx,0,-hz]], alpha: 0.55 },
        { verts: [[hx,0,-hz],[hx,ductH,-hz],[hx,ductH,hz],[hx,0,hz]], alpha: 0.7 },
        { verts: [[-hx,ductH,-hz],[-hx,ductH,hz],[hx,ductH,hz],[hx,ductH,-hz]], alpha: 0.85 },
      ] as { verts: [number,number,number][]; alpha: number }[];

      for (const face of faces) {
        const points = face.verts.map(([wx, wy, wz]) => proj(wx, wy + minY, wz));
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fillStyle = color + Math.round(face.alpha * 255).toString(16).padStart(2,'0');
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      let fy = 0;
      for (let i = 0; i < floors.length; i++) {
        const fTopY = fy + floors[i].height;
        if (fTopY > minY - 0.1 && fy < maxY + 0.1) {
          const labelY = toSY(fy + floors[i].height / 2);
          ctx.fillStyle = 'rgba(148,163,184,0.6)';
          ctx.font = '8px Inter,sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(floors[i].name, W * 0.72, labelY + 3);
        }
        fy = fTopY;
      }
    } else {
      const elev = duct.elevation ?? 0;
      let floorBaseY = 0;
      let floorIdx = 0;
      let cumH = 0;
      for (let i = 0; i < floors.length; i++) {
        if (elev >= cumH && elev < cumH + floors[i].height) {
          floorBaseY = cumH;
          floorIdx = i;
          break;
        }
        cumH += floors[i].height;
      }
      const floorH = floors[floorIdx]?.height ?? 3;
      const padY = Math.max(0.3, floorH * 0.15);

      const pts = duct.points;
      let totalLen = 0;
      for (let i = 1; i < pts.length; i++) {
        totalLen += Math.sqrt((pts[i].x - pts[i-1].x) ** 2 + (pts[i].y - pts[i-1].y) ** 2);
      }
      const displayLen = Math.min(totalLen, floorH * 2);

      const sceneW = displayLen + px3 * dh + dw * 0.5;
      const sceneH = floorH + padY * 2;
      const scaleX = (W * 0.82) / sceneW;
      const scaleY = (H * 0.82) / sceneH;
      const scale = Math.min(scaleX, scaleY);

      const minSceneY = floorBaseY;
      const ox = W * 0.08;
      const oy = H * 0.88;

      const toSX = (wx: number) => ox + wx * scale;
      const toSY = (wy: number) => oy - (wy - minSceneY + padY) * scale;
      const proj = (wx: number, wy: number, wz: number) => ({
        x: toSX(wx + wz * px3),
        y: toSY(wy + wz * py3),
      });

      ctx.strokeStyle = 'rgba(148,163,184,0.15)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= floors.length; i++) {
        let flY = 0;
        for (let j = 0; j < i; j++) flY += floors[j].height;
        if (flY < minSceneY - padY || flY > minSceneY + floorH + padY) continue;
        const sy = toSY(flY);
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
      }

      const hy = dh / 2;
      const hz = dw / 2;
      const ductY = elev;

      const faces = [
        { verts: [[0, ductY - hy, -hz],[0, ductY - hy, hz],[displayLen, ductY - hy, hz],[displayLen, ductY - hy, -hz]], alpha: 0.5 },
        { verts: [[0, ductY - hy, hz],[0, ductY + hy, hz],[displayLen, ductY + hy, hz],[displayLen, ductY - hy, hz]], alpha: 0.7 },
        { verts: [[0, ductY + hy, -hz],[displayLen, ductY + hy, -hz],[displayLen, ductY + hy, hz],[0, ductY + hy, hz]], alpha: 0.85 },
      ] as { verts: [number,number,number][]; alpha: number }[];

      for (const face of faces) {
        const points = face.verts.map(([wx, wy, wz]) => proj(wx, wy, wz));
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.fillStyle = color + Math.round(face.alpha * 255).toString(16).padStart(2,'0');
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      let fy = 0;
      for (let i = 0; i < floors.length; i++) {
        const fTopY = fy + floors[i].height;
        if (fTopY > minSceneY - 0.1 && fy < minSceneY + floorH + 0.1) {
          const labelY = toSY(fy + floors[i].height / 2);
          ctx.fillStyle = 'rgba(148,163,184,0.6)';
          ctx.font = '8px Inter,sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(floors[i].name, W * 0.72, labelY + 3);
        }
        fy = fTopY;
      }
    }

    if (duct.label) {
      ctx.fillStyle = color;
      ctx.font = 'bold 9px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(duct.label, W / 2, 12);
    }
  }, [duct, floors]);

  return <canvas ref={canvasRef} width={160} height={110} className="w-full rounded border border-slate-700" />;
}
