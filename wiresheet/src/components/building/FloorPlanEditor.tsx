import { useRef, useEffect, useCallback, useState } from 'react';
import { Floor, Room, BuildingTool } from '../../types/building';

interface Props {
  floor: Floor;
  selectedRoomId: string | null;
  tool: BuildingTool;
  onAddRoom: (x: number, y: number, width: number, depth: number) => void;
  onSelectRoom: (id: string | null) => void;
  onMoveRoom: (roomId: string, x: number, y: number) => void;
  onResizeRoom: (roomId: string, width: number, depth: number) => void;
  onDeleteRoom: (roomId: string) => void;
}

const CELL = 40;
const SNAP = 1;

function snapTo(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

interface DrawRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function FloorPlanEditor({
  floor, selectedRoomId, tool, onAddRoom, onSelectRoom, onMoveRoom, onDeleteRoom,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(1.0);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const dragState = useRef<{
    type: 'pan' | 'draw' | 'move';
    startX: number;
    startY: number;
    roomId?: string;
    origX?: number;
    origY?: number;
  } | null>(null);

  const toWorld = useCallback((px: number, py: number) => ({
    x: (px - offset.x) / (CELL * zoom),
    y: (py - offset.y) / (CELL * zoom),
  }), [offset, zoom]);

  const toScreen = useCallback((wx: number, wy: number) => ({
    x: wx * CELL * zoom + offset.x,
    y: wy * CELL * zoom + offset.y,
  }), [offset, zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const cellPx = CELL * zoom;

    const startGX = Math.floor(-offset.x / cellPx) - 1;
    const startGY = Math.floor(-offset.y / cellPx) - 1;
    const endGX = Math.ceil((W - offset.x) / cellPx) + 1;
    const endGY = Math.ceil((H - offset.y) / cellPx) + 1;

    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 0.5;
    for (let gx = startGX; gx <= endGX; gx++) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
      ctx.stroke();
    }
    for (let gy = startGY; gy <= endGY; gy++) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 1;
    for (let gx = Math.floor(startGX / 5) * 5; gx <= endGX; gx += 5) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
      ctx.stroke();
    }
    for (let gy = Math.floor(startGY / 5) * 5; gy <= endGY; gy += 5) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
    }

    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.4)';
    for (let gx = Math.floor(startGX / 5) * 5; gx <= endGX; gx += 5) {
      if (gx === 0) continue;
      const sx = gx * cellPx + offset.x;
      ctx.fillText(`${gx}m`, sx + 2, offset.y - 2);
    }
    for (let gy = Math.floor(startGY / 5) * 5; gy <= endGY; gy += 5) {
      if (gy === 0) continue;
      const sy = gy * cellPx + offset.y;
      ctx.fillText(`${gy}m`, offset.x + 2, sy - 2);
    }

    ctx.strokeStyle = 'rgba(59,130,246,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(offset.x, 0);
    ctx.lineTo(offset.x, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, offset.y);
    ctx.lineTo(W, offset.y);
    ctx.stroke();

    for (const room of floor.rooms) {
      const isSelected = room.id === selectedRoomId;
      const sx = toScreen(room.x, room.y);
      const rw = room.width * cellPx;
      const rd = room.depth * cellPx;

      const wallThickness = Math.max(2, 3 * zoom);

      ctx.fillStyle = room.color + '33';
      ctx.fillRect(sx.x, sx.y, rw, rd);

      ctx.fillStyle = room.color + '88';
      ctx.fillRect(sx.x, sx.y, rw, wallThickness);
      ctx.fillRect(sx.x, sx.y + rd - wallThickness, rw, wallThickness);
      ctx.fillRect(sx.x, sx.y, wallThickness, rd);
      ctx.fillRect(sx.x + rw - wallThickness, sx.y, wallThickness, rd);

      ctx.strokeStyle = isSelected ? '#60a5fa' : room.color;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      if (isSelected) {
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 6;
      }
      ctx.strokeRect(sx.x, sx.y, rw, rd);
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.strokeStyle = 'rgba(96,165,250,0.4)';
        ctx.lineWidth = 6;
        ctx.strokeRect(sx.x - 3, sx.y - 3, rw + 6, rd + 6);

        const handleSize = Math.max(6, 8 * zoom);
        ctx.fillStyle = '#60a5fa';
        const corners = [
          [sx.x, sx.y],
          [sx.x + rw, sx.y],
          [sx.x, sx.y + rd],
          [sx.x + rw, sx.y + rd],
        ];
        for (const [hx, hy] of corners) {
          ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        }
      }

      const fontSize = Math.max(9, Math.min(13, 11 * zoom));
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, sx.x + rw / 2, sx.y + rd / 2 - fontSize * 0.6);

      const dimFont = Math.max(8, Math.min(11, 9 * zoom));
      ctx.font = `${dimFont}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(148,163,184,0.8)';
      ctx.fillText(`${room.width}m × ${room.depth}m`, sx.x + rw / 2, sx.y + rd / 2 + dimFont);

      ctx.strokeStyle = 'rgba(0,0,0,0.0)';
    }

    if (drawRect) {
      const x1 = Math.min(drawRect.startX, drawRect.endX);
      const y1 = Math.min(drawRect.startY, drawRect.endY);
      const x2 = Math.max(drawRect.startX, drawRect.endX);
      const y2 = Math.max(drawRect.startY, drawRect.endY);
      const s1 = toScreen(x1, y1);
      const s2 = toScreen(x2, y2);
      const w = s2.x - s1.x;
      const h = s2.y - s1.y;

      ctx.fillStyle = 'rgba(59,130,246,0.15)';
      ctx.fillRect(s1.x, s1.y, w, h);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(s1.x, s1.y, w, h);
      ctx.setLineDash([]);

      if (w > 20 && h > 20) {
        const rw2 = snapTo(x2 - x1);
        const rd2 = snapTo(y2 - y1);
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#60a5fa';
        ctx.textAlign = 'center';
        ctx.fillText(`${rw2}m × ${rd2}m`, s1.x + w / 2, s1.y + h / 2);
      }
    }

    ctx.textAlign = 'left';
  }, [floor.rooms, selectedRoomId, offset, zoom, toScreen, drawRect]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      canvas.style.width = canvas.offsetWidth + 'px';
      canvas.style.height = canvas.offsetHeight + 'px';
      draw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (canvas.width / rect.width),
      py: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const { px, py } = getCanvasPos(e);
    const world = toWorld(px, py);

    if (e.button === 1 || e.altKey || e.button === 2) {
      dragState.current = { type: 'pan', startX: e.clientX, startY: e.clientY };
      return;
    }

    if (tool === 'select' || tool === 'delete') {
      let hit: Room | null = null;
      for (let i = floor.rooms.length - 1; i >= 0; i--) {
        const room = floor.rooms[i];
        if (
          world.x >= room.x && world.x <= room.x + room.width &&
          world.y >= room.y && world.y <= room.y + room.depth
        ) {
          hit = room;
          break;
        }
      }
      if (hit) {
        if (tool === 'delete') {
          onDeleteRoom(hit.id);
        } else {
          onSelectRoom(hit.id);
          dragState.current = {
            type: 'move',
            startX: e.clientX,
            startY: e.clientY,
            roomId: hit.id,
            origX: hit.x,
            origY: hit.y,
          };
        }
      } else {
        onSelectRoom(null);
      }
      return;
    }

    if (tool === 'room') {
      const snappedX = snapTo(world.x);
      const snappedY = snapTo(world.y);
      dragState.current = { type: 'draw', startX: e.clientX, startY: e.clientY };
      setDrawRect({ startX: snappedX, startY: snappedY, endX: snappedX + 4, endY: snappedY + 3 });
    }
  }, [tool, floor.rooms, toWorld, onSelectRoom, onDeleteRoom]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current) return;
    const { px, py } = getCanvasPos(e);
    const world = toWorld(px, py);

    if (dragState.current.type === 'pan') {
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      dragState.current.startX = e.clientX;
      dragState.current.startY = e.clientY;
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    } else if (dragState.current.type === 'draw' && drawRect) {
      setDrawRect(r => r ? { ...r, endX: snapTo(world.x), endY: snapTo(world.y) } : r);
    } else if (dragState.current.type === 'move' && dragState.current.roomId !== undefined) {
      const dx = (e.clientX - dragState.current.startX) / (CELL * zoom);
      const dy = (e.clientY - dragState.current.startY) / (CELL * zoom);
      const newX = snapTo((dragState.current.origX ?? 0) + dx);
      const newY = snapTo((dragState.current.origY ?? 0) + dy);
      onMoveRoom(dragState.current.roomId, newX, newY);
    }
  }, [drawRect, toWorld, zoom, onMoveRoom]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragState.current?.type === 'draw' && drawRect) {
      const x1 = snapTo(Math.min(drawRect.startX, drawRect.endX));
      const y1 = snapTo(Math.min(drawRect.startY, drawRect.endY));
      const x2 = snapTo(Math.max(drawRect.startX, drawRect.endX));
      const y2 = snapTo(Math.max(drawRect.startY, drawRect.endY));
      const rw = x2 - x1;
      const rd = y2 - y1;
      if (rw >= 1 && rd >= 1) {
        onAddRoom(x1, y1, rw, rd);
      }
      setDrawRect(null);
    }
    dragState.current = null;
    void e;
  }, [drawRect, onAddRoom]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { px, py } = getCanvasPos(e);
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(z => {
      const newZoom = Math.max(0.2, Math.min(5, z * factor));
      setOffset(o => ({
        x: px - (px - o.x) * (newZoom / z),
        y: py - (py - o.y) * (newZoom / z),
      }));
      return newZoom;
    });
  }, []);

  const getCursor = () => {
    if (tool === 'room') return 'crosshair';
    if (tool === 'delete') return 'not-allowed';
    return 'default';
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: getCursor() }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { if (dragState.current?.type === 'draw') { setDrawRect(null); } dragState.current = null; }}
        onWheel={onWheel}
        onContextMenu={e => e.preventDefault()}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">+</button>
        <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">−</button>
        <button onClick={() => { setZoom(1); setOffset({ x: 40, y: 40 }); }} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center border border-slate-600" title="Zurücksetzen">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>
      <div className="absolute bottom-3 left-3 text-slate-500 text-[10px]">
        {tool === 'room' ? 'Klicken + Ziehen: Raum zeichnen' : tool === 'delete' ? 'Raum anklicken zum Löschen' : 'Klicken: auswählen · Ziehen: verschieben · Alt+Ziehen: verschieben'}
      </div>
    </div>
  );
}
