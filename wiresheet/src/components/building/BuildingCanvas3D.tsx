import { useRef, useEffect, useCallback, useState } from 'react';
import { Building, Floor, Room } from '../../types/building';

interface Props {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  highlightFloor: boolean;
}

interface Camera {
  rotX: number;
  rotY: number;
  zoom: number;
  panX: number;
  panY: number;
}

const UNIT = 40;
const WALL_THICKNESS = 3;

function project(
  x: number,
  y: number,
  z: number,
  cam: Camera,
  cx: number,
  cy: number
): [number, number] {
  const cosY = Math.cos(cam.rotY);
  const sinY = Math.sin(cam.rotY);
  const cosX = Math.cos(cam.rotX);
  const sinX = Math.sin(cam.rotX);

  const rx = x * cosY - z * sinY;
  const ry = x * sinY * sinX + y * cosX + z * cosY * sinX;
  const rz = x * sinY * cosX - y * sinX + z * cosY * cosX;

  const fov = 800 * cam.zoom;
  const perspective = fov / (fov + rz + 600);
  const sx = cx + rx * perspective * UNIT + cam.panX;
  const sy = cy - ry * perspective * UNIT + cam.panY;
  return [sx, sy];
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [148, 163, 184];
}

function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}

function lighten(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.floor(r + (255 - r) * factor))},${Math.min(255, Math.floor(g + (255 - g) * factor))},${Math.min(255, Math.floor(b + (255 - b) * factor))})`;
}

interface DrawnRoom {
  roomId: string;
  floorId: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function BuildingCanvas3D({ buildings, activeFloorId, selectedRoomId, onSelectRoom, highlightFloor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<Camera>({ rotX: 0.52, rotY: 0.62, zoom: 1.0, panX: 0, panY: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startCam: Camera; type: 'rotate' | 'pan' } | null>(null);
  const drawnRoomsRef = useRef<DrawnRoom[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const newDrawn: DrawnRoom[] = [];

    const allFloors: { building: Building; floor: Floor; offsetX: number }[] = [];
    let buildingOffsetX = 0;

    for (const building of buildings) {
      const sorted = [...building.floors].sort((a, b) => a.level - b.level);
      for (const floor of sorted) {
        allFloors.push({ building, floor, offsetX: buildingOffsetX });
      }
      const maxRoomX = building.floors.flatMap(f => f.rooms).reduce((m, r) => Math.max(m, r.x + r.width), 10);
      buildingOffsetX += maxRoomX + 4;
    }

    let cumulativeY = 0;
    const floorBaseY: Record<string, number> = {};

    for (const building of buildings) {
      const sorted = [...building.floors].sort((a, b) => a.level - b.level);
      let yAcc = 0;
      for (const floor of sorted) {
        floorBaseY[floor.id] = yAcc;
        yAcc += floor.height;
      }
    }
    cumulativeY;

    for (const { building, floor, offsetX } of allFloors) {
      const baseY = floorBaseY[floor.id] ?? 0;
      const floorH = floor.height;
      const isActiveFloor = floor.id === activeFloorId;
      const alpha = !highlightFloor || isActiveFloor ? 1.0 : 0.35;

      ctx.globalAlpha = alpha;

      const rooms = floor.rooms;

      if (rooms.length === 0) {
        const px = floor.rooms.reduce((m, r) => Math.max(m, r.x + r.width), 6);
        const pz = floor.rooms.reduce((m, r) => Math.max(m, r.y + r.depth), 6);
        const corners = [
          [offsetX, baseY, 0],
          [offsetX + px, baseY, 0],
          [offsetX + px, baseY, pz],
          [offsetX, baseY, pz],
        ] as [number, number, number][];
        ctx.beginPath();
        corners.forEach(([x, y, z], i) => {
          const [sx, sy] = project(x, y, z, cam, cx, cy);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.fillStyle = isActiveFloor ? 'rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.06)';
        ctx.fill();
        ctx.strokeStyle = isActiveFloor ? 'rgba(59,130,246,0.4)' : 'rgba(148,163,184,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const room of rooms) {
        const isSelected = room.id === selectedRoomId;
        const rx = room.x + offsetX;
        const rz = room.y;
        const rw = room.width;
        const rd = room.depth;

        const color = room.color;
        const topColor = isSelected ? lighten(color, 0.4) : lighten(color, 0.25);
        const frontColor = isSelected ? lighten(color, 0.15) : darken(color, 0.75);
        const rightColor = isSelected ? color : darken(color, 0.6);
        const leftColor = darken(color, 0.85);

        const p = (x: number, y: number, z: number) => project(x, y, z, cam, cx, cy);

        const tl = p(rx, baseY + floorH, rz);
        const tr = p(rx + rw, baseY + floorH, rz);
        const br = p(rx + rw, baseY + floorH, rz + rd);
        const bl = p(rx, baseY + floorH, rz + rd);
        const btl = p(rx, baseY, rz);
        const btr = p(rx + rw, baseY, rz);
        const bbr = p(rx + rw, baseY, rz + rd);
        const bbl = p(rx, baseY, rz + rd);

        const drawFace = (pts: [number, number][], fill: string, stroke: string) => {
          ctx.beginPath();
          pts.forEach(([x, y], i) => {
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = stroke;
          ctx.lineWidth = isSelected ? 1.5 : 0.8;
          ctx.stroke();
        };

        const strokeColor = isSelected ? '#60a5fa' : 'rgba(15,23,42,0.6)';

        drawFace([bbl, bbr, btr, btl], leftColor, strokeColor);
        drawFace([btl, btr, tr, tl], frontColor, strokeColor);
        drawFace([btr, bbr, br, tr], rightColor, strokeColor);
        drawFace([tl, tr, br, bl], topColor, strokeColor);

        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          [tl, tr, br, bl].forEach(([x, y], i) => {
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        const labelPt = p(rx + rw / 2, baseY + floorH + 0.1, rz + rd / 2);
        ctx.fillStyle = isSelected ? '#e2e8f0' : 'rgba(226,232,240,0.8)';
        ctx.font = `bold ${Math.max(9, Math.min(12, 10 * cam.zoom))}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(room.name, labelPt[0], labelPt[1]);

        const pts2D = [tl, tr, br, bl, btl, btr, bbr, bbl];
        const minX2D = Math.min(...pts2D.map(p => p[0]));
        const minY2D = Math.min(...pts2D.map(p => p[1]));
        const maxX2D = Math.max(...pts2D.map(p => p[0]));
        const maxY2D = Math.max(...pts2D.map(p => p[1]));
        newDrawn.push({ roomId: room.id, floorId: floor.id, minX: minX2D, minY: minY2D, maxX: maxX2D, maxY: maxY2D });
      }

      if (isActiveFloor && rooms.length > 0) {
        const allRoomsX = rooms.flatMap(r => [r.x + offsetX, r.x + offsetX + r.width]);
        const allRoomsZ = rooms.flatMap(r => [r.y, r.y + r.depth]);
        const minX3 = Math.min(...allRoomsX) - 0.5;
        const maxX3 = Math.max(...allRoomsX) + 0.5;
        const minZ3 = Math.min(...allRoomsZ) - 0.5;
        const maxZ3 = Math.max(...allRoomsZ) + 0.5;

        const gridStep = 1;
        ctx.strokeStyle = 'rgba(59,130,246,0.12)';
        ctx.lineWidth = 0.5;
        for (let gx = Math.floor(minX3); gx <= Math.ceil(maxX3); gx += gridStep) {
          const a = project(gx, baseY, minZ3, cam, cx, cy);
          const b = project(gx, baseY, maxZ3, cam, cx, cy);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
        for (let gz = Math.floor(minZ3); gz <= Math.ceil(maxZ3); gz += gridStep) {
          const a = project(minX3, baseY, gz, cam, cx, cy);
          const b = project(maxX3, baseY, gz, cam, cx, cy);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1.0;

      const labelBase = project(offsetX, baseY + floorH / 2, -1.5, cam, cx, cy);
      ctx.fillStyle = isActiveFloor ? '#60a5fa' : 'rgba(148,163,184,0.5)';
      ctx.font = `${isActiveFloor ? 'bold' : 'normal'} ${Math.max(8, Math.min(11, 9 * cam.zoom))}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(floor.name, labelBase[0], labelBase[1]);
    }

    ctx.globalAlpha = 1.0;

    drawnRoomsRef.current = newDrawn;
  }, [buildings, activeFloorId, selectedRoomId, cam, highlightFloor]);

  useEffect(() => {
    draw();
  }, [draw]);

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

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startCam: { ...cam }, type: 'pan' };
    } else if (e.button === 2) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startCam: { ...cam }, type: 'rotate' };
    } else {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startCam: { ...cam }, type: 'rotate' };
    }
  }, [cam]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (dragRef.current.type === 'rotate') {
      setCam(c => ({
        ...c,
        rotY: dragRef.current!.startCam.rotY + dx * 0.005,
        rotX: Math.max(0.05, Math.min(1.4, dragRef.current!.startCam.rotX - dy * 0.005)),
      }));
    } else {
      setCam(c => ({
        ...c,
        panX: dragRef.current!.startCam.panX + dx,
        panY: dragRef.current!.startCam.panY + dy,
      }));
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const wasDragging = dragRef.current && (
      Math.abs(e.clientX - dragRef.current.startX) > 3 ||
      Math.abs(e.clientY - dragRef.current.startY) > 3
    );
    dragRef.current = null;
    if (!wasDragging) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      let hit: string | null = null;
      for (let i = drawnRoomsRef.current.length - 1; i >= 0; i--) {
        const d = drawnRoomsRef.current[i];
        if (mx >= d.minX && mx <= d.maxX && my >= d.minY && my <= d.maxY) {
          hit = d.roomId;
          break;
        }
      }
      onSelectRoom(hit);
    }
  }, [onSelectRoom]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCam(c => ({ ...c, zoom: Math.max(0.3, Math.min(3, c.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }));
  }, []);

  const resetView = useCallback(() => {
    setCam({ rotX: 0.52, rotY: 0.62, zoom: 1.0, panX: 0, panY: 0 });
  }, []);

  const WALL_THICKNESS_UNUSED = WALL_THICKNESS;
  void WALL_THICKNESS_UNUSED;

  return (
    <div className="relative w-full h-full select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { dragRef.current = null; }}
        onWheel={onWheel}
        onContextMenu={e => e.preventDefault()}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={() => setCam(c => ({ ...c, zoom: Math.min(3, c.zoom * 1.2) }))}
          className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600"
        >+</button>
        <button
          onClick={() => setCam(c => ({ ...c, zoom: Math.max(0.3, c.zoom * 0.8) }))}
          className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600"
        >−</button>
        <button
          onClick={resetView}
          className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center border border-slate-600"
          title="Ansicht zurücksetzen"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>
      <div className="absolute bottom-3 left-3 text-slate-500 text-[10px]">
        Linksklick + Ziehen: Drehen &nbsp;|&nbsp; Alt + Ziehen: Verschieben &nbsp;|&nbsp; Scroll: Zoom
      </div>
    </div>
  );
}
