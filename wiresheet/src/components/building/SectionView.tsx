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
  onAddVerticalDuct: (duct: Omit<Duct, 'id'>, fromFloorId: string, toFloorId: string) => void;
  onAddVerticalPipe: (pipe: Omit<Pipe, 'id'>, fromFloorId: string, toFloorId: string) => void;
  gridSize: number;
}

const CELL = 40;
const FLOOR_GAP = 4;

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

export function SectionView({
  building,
  ductType,
  ductShape,
  ductWidth,
  ductHeight,
  pipeType,
  pipeDiameter,
  tool,
  onAddVerticalDuct,
  onAddVerticalPipe,
  gridSize,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1.0);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; startFloorIdx: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const sortedFloors = [...building.floors].sort((a, b) => a.level - b.level);

  const getFloorBounds = useCallback(() => {
    let maxX = 20;
    let maxY = 20;
    for (const floor of building.floors) {
      for (const wall of floor.walls) {
        maxX = Math.max(maxX, wall.x1, wall.x2);
        maxY = Math.max(maxY, wall.y1, wall.y2);
      }
      for (const room of floor.rooms) {
        maxX = Math.max(maxX, room.x + room.width);
        maxY = Math.max(maxY, room.y + room.depth);
      }
    }
    return { maxX, maxY };
  }, [building]);

  const getTotalHeight = useCallback(() => {
    return sortedFloors.reduce((acc, f) => acc + f.height, 0);
  }, [sortedFloors]);

  const getFloorAtY = useCallback((worldY: number): { floor: Floor; idx: number; localY: number } | null => {
    let accY = 0;
    for (let i = 0; i < sortedFloors.length; i++) {
      const floor = sortedFloors[i];
      if (worldY >= accY && worldY < accY + floor.height) {
        return { floor, idx: i, localY: worldY - accY };
      }
      accY += floor.height;
    }
    if (worldY >= accY - 0.1) {
      const lastIdx = sortedFloors.length - 1;
      return { floor: sortedFloors[lastIdx], idx: lastIdx, localY: sortedFloors[lastIdx].height };
    }
    return null;
  }, [sortedFloors]);

  const toScreen = useCallback((wx: number, wy: number) => ({
    x: wx * CELL * zoom + offset.x,
    y: (getTotalHeight() - wy) * CELL * zoom + offset.y,
  }), [offset, zoom, getTotalHeight]);

  const toWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - offset.x) / (CELL * zoom),
    y: getTotalHeight() - (sy - offset.y) / (CELL * zoom),
  }), [offset, zoom, getTotalHeight]);

  const snapTo = (v: number) => Math.round(v / gridSize) * gridSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const totalH = getTotalHeight();
    const { maxX } = getFloorBounds();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const cellPx = CELL * zoom;

    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 0.5;
    const startGX = Math.floor(-offset.x / cellPx) - 1;
    const endGX = Math.ceil((W - offset.x) / cellPx) + 1;
    const startGY = Math.floor(-offset.y / cellPx) - 1;
    const endGY = Math.ceil((H - offset.y) / cellPx) + 1;

    for (let gx = startGX; gx <= endGX; gx += gridSize) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
      ctx.stroke();
    }
    for (let gy = startGY; gy <= endGY; gy += gridSize) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
    }

    let floorY = 0;
    for (let i = 0; i < sortedFloors.length; i++) {
      const floor = sortedFloors[i];
      const topY = floorY + floor.height;
      const screenBottom = toScreen(0, floorY);
      const screenTop = toScreen(maxX, topY);

      ctx.fillStyle = i % 2 === 0 ? 'rgba(30,41,59,0.5)' : 'rgba(51,65,85,0.3)';
      ctx.fillRect(screenTop.x - offset.x, screenTop.y, (maxX) * cellPx, (floor.height) * cellPx);

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
        if (duct.points.length < 2) continue;
        const color = duct.color || DUCT_COLORS[duct.type];
        ctx.strokeStyle = color;
        ctx.lineWidth = duct.width * cellPx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let pi = 0; pi < duct.points.length; pi++) {
          const p = duct.points[pi];
          const elev = duct.elevation ?? 0;
          const sp = toScreen(p.x, floorY + elev);
          if (pi === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const pipe of (floor.pipes ?? [])) {
        if (pipe.points.length < 2) continue;
        const color = pipe.color || PIPE_COLORS[pipe.type];
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, pipe.diameter * cellPx);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let pi = 0; pi < pipe.points.length; pi++) {
          const p = pipe.points[pi];
          const elev = pipe.elevation ?? 0;
          const sp = toScreen(p.x, floorY + elev);
          if (pi === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      floorY = topY;
    }

    ctx.strokeStyle = 'rgba(59,130,246,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offset.x, 0);
    ctx.lineTo(offset.x, H);
    ctx.stroke();
    const groundY = toScreen(0, 0).y;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    if (drawing && mousePos) {
      const startScreen = toScreen(drawing.startX, drawing.startY);
      const endWorld = toWorld(mousePos.x, mousePos.y);
      const snappedEndX = snapTo(endWorld.x);
      const snappedEndY = snapTo(endWorld.y);
      const endScreen = toScreen(snappedEndX, snappedEndY);

      if (tool === 'duct') {
        ctx.strokeStyle = DUCT_COLORS[ductType];
        ctx.lineWidth = ductWidth * cellPx;
      } else {
        ctx.strokeStyle = PIPE_COLORS[pipeType];
        ctx.lineWidth = Math.max(3, pipeDiameter * cellPx);
      }
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(startScreen.x, endScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    if (mousePos && (tool === 'duct' || tool === 'pipe')) {
      const world = toWorld(mousePos.x, mousePos.y);
      const snappedX = snapTo(world.x);
      const snappedY = snapTo(world.y);
      const sp = toScreen(snappedX, snappedY);
      ctx.fillStyle = tool === 'duct' ? DUCT_COLORS[ductType] : PIPE_COLORS[pipeType];
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

  }, [building, sortedFloors, offset, zoom, drawing, mousePos, tool, ductType, pipeType, ductWidth, pipeDiameter, gridSize, toScreen, toWorld, getTotalHeight, getFloorBounds]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (tool === 'duct' || tool === 'pipe') {
      const world = toWorld(mx, my);
      const snappedX = snapTo(world.x);
      const snappedY = snapTo(world.y);
      const floorInfo = getFloorAtY(snappedY);
      if (floorInfo) {
        setDrawing({ startX: snappedX, startY: snappedY, startFloorIdx: floorInfo.idx });
      }
    }
  }, [tool, toWorld, getFloorAtY, gridSize]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const world = toWorld(mx, my);
    const snappedEndX = snapTo(world.x);
    const snappedEndY = snapTo(world.y);

    const startFloorInfo = getFloorAtY(drawing.startY);
    const endFloorInfo = getFloorAtY(snappedEndY);

    if (startFloorInfo && endFloorInfo && startFloorInfo.idx !== endFloorInfo.idx) {
      const fromFloor = startFloorInfo.floor;
      const toFloor = endFloorInfo.floor;

      if (tool === 'duct') {
        const duct: Omit<Duct, 'id'> = {
          points: [
            { x: drawing.startX, y: 0 },
            { x: drawing.startX, y: 0 },
          ],
          shape: ductShape,
          type: ductType,
          width: ductWidth,
          height: ductHeight,
          elevation: startFloorInfo.localY,
          insulated: false,
        };
        onAddVerticalDuct(duct, fromFloor.id, toFloor.id);
      } else if (tool === 'pipe') {
        const pipe: Omit<Pipe, 'id'> = {
          points: [
            { x: drawing.startX, y: 0 },
            { x: drawing.startX, y: 0 },
          ],
          type: pipeType,
          diameter: pipeDiameter,
          elevation: startFloorInfo.localY,
          insulated: false,
        };
        onAddVerticalPipe(pipe, fromFloor.id, toFloor.id);
      }
    }

    setDrawing(null);
  }, [drawing, tool, toWorld, getFloorAtY, ductShape, ductType, ductWidth, ductHeight, pipeType, pipeDiameter, onAddVerticalDuct, onAddVerticalPipe, gridSize]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.2, Math.min(5, zoom * zoomFactor));

    const worldBefore = toWorld(mx, my);
    const newOffset = {
      x: mx - worldBefore.x * CELL * newZoom,
      y: my - (getTotalHeight() - worldBefore.y) * CELL * newZoom,
    };

    setZoom(newZoom);
    setOffset(newOffset);
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

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setMousePos(null); setDrawing(null); }}
        onWheel={handleWheel}
      />
      <div className="absolute bottom-3 left-3 text-slate-500 text-[10px] bg-slate-900/70 px-2 py-1 rounded">
        {tool === 'select'
          ? 'Schnittansicht: Stockwerke vertikal'
          : tool === 'duct'
          ? 'Kanal: Vertikal von einem Stockwerk zum anderen zeichnen'
          : 'Rohr: Vertikal von einem Stockwerk zum anderen zeichnen'}
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">+</button>
        <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">-</button>
        <div className="w-7 h-5 flex items-center justify-center text-[9px] text-slate-500 font-mono">{Math.round(zoom * 100)}%</div>
      </div>
    </div>
  );
}
