import { useRef, useEffect, useCallback, useState } from 'react';
import { Building, Wall } from '../../types/building';

interface Props {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onSelectWall: (wallId: string | null) => void;
  highlightFloor: boolean;
}

interface Camera {
  rotX: number;
  rotY: number;
  zoom: number;
  panX: number;
  panY: number;
}

const UNIT = 42;

const SUN_DIR = { x: -0.5, y: 0.9, z: 0.4 };
const SUN_LEN = Math.sqrt(SUN_DIR.x ** 2 + SUN_DIR.y ** 2 + SUN_DIR.z ** 2);
const SUN = { x: SUN_DIR.x / SUN_LEN, y: SUN_DIR.y / SUN_LEN, z: SUN_DIR.z / SUN_LEN };

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function faceLight(nx: number, ny: number, nz: number): number {
  const d = dot3([nx, ny, nz], [SUN.x, SUN.y, SUN.z]);
  return 0.2 + 0.8 * Math.max(0, d);
}

function projectPt(
  x: number, y: number, z: number,
  cam: Camera, cx: number, cy: number
): [number, number, number] {
  const cosY = Math.cos(cam.rotY);
  const sinY = Math.sin(cam.rotY);
  const cosX = Math.cos(cam.rotX);
  const sinX = Math.sin(cam.rotX);

  const rx = x * cosY + z * sinY;
  const ry_pre = -x * sinY * sinX + y * cosX + z * cosY * sinX;
  const rz = x * sinY * cosX - y * sinX + z * cosY * cosX;

  const fov = 800;
  const dist = 600 / cam.zoom;
  const depth = dist + rz;
  const persp = depth > 1 ? dist / depth : 1;

  const sx = cx + rx * persp * UNIT * cam.zoom + cam.panX;
  const sy = cy - ry_pre * persp * UNIT * cam.zoom + cam.panY;
  return [sx, sy, depth];
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [148, 163, 184];
}

function applyLight(hex: string, lightFactor: number, selected: boolean, opacity = 1.0): string {
  const [r, g, b] = hexToRgb(hex);
  const boost = selected ? 1.3 : 1.0;
  const ri = Math.min(255, Math.floor(r * lightFactor * boost));
  const gi = Math.min(255, Math.floor(g * lightFactor * boost));
  const bi = Math.min(255, Math.floor(b * lightFactor * boost));
  return `rgba(${ri},${gi},${bi},${opacity})`;
}

interface Face {
  pts: [number, number][];
  fill: string;
  stroke: string;
  lineWidth: number;
  avgDepth: number;
}

function drawFaces(ctx: CanvasRenderingContext2D, faces: Face[]) {
  faces.sort((a, b) => b.avgDepth - a.avgDepth);
  for (const face of faces) {
    ctx.beginPath();
    face.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
    ctx.strokeStyle = face.stroke;
    ctx.lineWidth = face.lineWidth;
    ctx.stroke();
  }
}

interface DrawnElement {
  id: string;
  type: 'room' | 'wall';
  minX: number; minY: number; maxX: number; maxY: number;
}

export function BuildingCanvas3D({
  buildings, activeFloorId, selectedRoomId, selectedWallId,
  onSelectRoom, onSelectWall, highlightFloor,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<Camera>({ rotX: 0.55, rotY: 0.6, zoom: 1.0, panX: 0, panY: 0 });
  const camRef = useRef(cam);
  camRef.current = cam;

  const dragRef = useRef<{
    startX: number; startY: number;
    startCam: Camera;
    mode: 'rotate' | 'pan';
    moved: boolean;
  } | null>(null);
  const drawnRef = useRef<DrawnElement[]>([]);

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
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0c1526');
    grad.addColorStop(1, '#0f2030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const drawn: DrawnElement[] = [];
    const p = (x: number, y: number, z: number) => projectPt(x, y, z, cam, cx, cy);
    const allFaces: Face[] = [];

    let buildingOffsetX = 0;

    for (const building of buildings) {
      const sorted = [...building.floors].sort((a, b) => a.level - b.level);

      const floorBaseY: Record<string, number> = {};
      let yAcc = 0;
      for (const floor of sorted) {
        floorBaseY[floor.id] = yAcc;
        yAcc += floor.height;
      }

      const maxW = building.floors.flatMap(f => [
        ...f.rooms.map(r => r.x + r.width),
        ...f.walls.map(w => Math.max(w.x1, w.x2)),
      ]).reduce((m, v) => Math.max(m, v), 8);

      const maxD = building.floors.flatMap(f => [
        ...f.rooms.map(r => r.y + r.depth),
        ...f.walls.map(w => Math.max(w.y1, w.y2)),
      ]).reduce((m, v) => Math.max(m, v), 8);

      for (const floor of sorted) {
        const baseY = floorBaseY[floor.id];
        const floorH = floor.height;
        const isActive = floor.id === activeFloorId;
        const alpha = !highlightFloor || isActive ? 1.0 : 0.2;

        const ox = buildingOffsetX;

        const groundY = baseY;
        const groundColor = isActive ? '#1e3a5f' : '#152030';
        const groundOpacity = alpha * (isActive ? 0.85 : 0.5);

        const g0 = p(ox, groundY, 0);
        const g1 = p(ox + maxW, groundY, 0);
        const g2 = p(ox + maxW, groundY, maxD);
        const g3 = p(ox, groundY, maxD);
        const groundDepth = (g0[2] + g1[2] + g2[2] + g3[2]) / 4;

        allFaces.push({
          pts: [[g0[0], g0[1]], [g1[0], g1[1]], [g2[0], g2[1]], [g3[0], g3[1]]],
          fill: `rgba(${hexToRgb(groundColor).join(',')},${groundOpacity})`,
          stroke: `rgba(30,60,100,${alpha * 0.4})`,
          lineWidth: 0.5,
          avgDepth: groundDepth + 50,
        });

        ctx.globalAlpha = alpha;

        for (const room of floor.rooms) {
          const isSel = room.id === selectedRoomId;
          const rc = room.color;
          const rx = room.x + ox;
          const ry = room.y;
          const rw = room.width;
          const rd = room.depth;

          const topLight = faceLight(0, 1, 0);
          const frontLight = faceLight(0, 0, -1);
          const rightLight = faceLight(1, 0, 0);
          const leftLight = faceLight(-1, 0, 0);
          const backLight = faceLight(0, 0, 1);

          const tfl = p(rx, baseY + floorH, ry);
          const tfr = p(rx + rw, baseY + floorH, ry);
          const tbr = p(rx + rw, baseY + floorH, ry + rd);
          const tbl = p(rx, baseY + floorH, ry + rd);
          const bfl = p(rx, baseY, ry);
          const bfr = p(rx + rw, baseY, ry);
          const bbr = p(rx + rw, baseY, ry + rd);
          const bbl = p(rx, baseY, ry + rd);

          const avgD = (tfl[2] + tfr[2] + tbr[2] + tbl[2]) / 4;
          const strokeC = isSel ? 'rgba(96,165,250,0.9)' : 'rgba(10,20,35,0.6)';
          const lw = isSel ? 1.5 : 0.6;

          allFaces.push({ pts: [[tfl[0],tfl[1]],[tfr[0],tfr[1]],[tbr[0],tbr[1]],[tbl[0],tbl[1]]], fill: applyLight(rc, topLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD - 10 });
          allFaces.push({ pts: [[bfl[0],bfl[1]],[bfr[0],bfr[1]],[tfr[0],tfr[1]],[tfl[0],tfl[1]]], fill: applyLight(rc, frontLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 2 });
          allFaces.push({ pts: [[bfr[0],bfr[1]],[bbr[0],bbr[1]],[tbr[0],tbr[1]],[tfr[0],tfr[1]]], fill: applyLight(rc, rightLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 3 });
          allFaces.push({ pts: [[bbl[0],bbl[1]],[bbr[0],bbr[1]],[tbr[0],tbr[1]],[tbl[0],tbl[1]]], fill: applyLight(rc, backLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 4 });
          allFaces.push({ pts: [[bbl[0],bbl[1]],[bfl[0],bfl[1]],[tfl[0],tfl[1]],[tbl[0],tbl[1]]], fill: applyLight(rc, leftLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 3 });

          const allPts2D = [tfl, tfr, tbr, tbl, bfl, bfr, bbr, bbl];
          drawn.push({
            id: room.id, type: 'room',
            minX: Math.min(...allPts2D.map(([x]) => x)),
            minY: Math.min(...allPts2D.map(([,y]) => y)),
            maxX: Math.max(...allPts2D.map(([x]) => x)),
            maxY: Math.max(...allPts2D.map(([,y]) => y)),
          });
        }

        for (const wall of floor.walls) {
          renderWall(wall, ox, baseY, floorH, wall.id === selectedWallId, allFaces, p, drawn);
        }

        ctx.globalAlpha = 1;

        const labelX = buildingOffsetX + maxW / 2;
        const lp = p(labelX, baseY + floorH / 2, -1);
        const fade = !highlightFloor || isActive ? 1 : 0.25;
        ctx.globalAlpha = fade;
        ctx.font = `${isActive ? 'bold ' : ''}${Math.max(8, 10 * cam.zoom)}px Inter,sans-serif`;
        ctx.fillStyle = isActive ? '#60a5fa' : 'rgba(148,163,184,0.4)';
        ctx.textAlign = 'right';
        ctx.fillText(floor.name, lp[0] - 5, lp[1]);
        ctx.globalAlpha = 1;
      }

      buildingOffsetX += maxW + 5;
    }

    ctx.globalAlpha = 1;
    drawFaces(ctx, allFaces);

    for (const building of buildings) {
      let bOx = 0;
      for (const b of buildings) {
        if (b.id === building.id) break;
        bOx += b.floors.flatMap(f => [
          ...f.rooms.map(r => r.x + r.width),
          ...f.walls.map(w => Math.max(w.x1, w.x2)),
        ]).reduce((m, v) => Math.max(m, v), 8) + 5;
      }

      const sorted = [...building.floors].sort((a, b) => a.level - b.level);
      let yAccL = 0;
      for (const floor of sorted) {
        const isActive = floor.id === activeFloorId;
        const fade = !highlightFloor || isActive ? 1 : 0.2;
        ctx.globalAlpha = fade;

        for (const room of floor.rooms) {
          const lp = p(room.x + bOx + room.width / 2, yAccL + floor.height + 0.05, room.y + room.depth / 2);
          if (cam.zoom > 0.5) {
            ctx.font = `bold ${Math.max(7, Math.min(11, 9 * cam.zoom))}px Inter,sans-serif`;
            ctx.fillStyle = room.id === selectedRoomId ? '#e2e8f0' : 'rgba(226,232,240,0.6)';
            ctx.textAlign = 'center';
            ctx.fillText(room.name, lp[0], lp[1]);
          }
        }
        yAccL += floor.height;
        ctx.globalAlpha = 1;
      }
    }

    ctx.textAlign = 'left';
    drawnRef.current = drawn;
  }, [buildings, activeFloorId, selectedRoomId, selectedWallId, cam, highlightFloor]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      draw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const isPan = e.button === 2 || e.altKey;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCam: { ...camRef.current },
      mode: isPan ? 'pan' : 'rotate',
      moved: false,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current || e.buttons === 0) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragRef.current.moved = true;

    if (dragRef.current.mode === 'rotate') {
      const sc = dragRef.current.startCam;
      setCam(c => ({
        ...c,
        rotY: sc.rotY + dx * 0.007,
        rotX: Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, sc.rotX - dy * 0.007)),
      }));
    } else {
      const sc = dragRef.current.startCam;
      setCam(c => ({ ...c, panX: sc.panX + dx, panY: sc.panY + dy }));
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current?.moved) {
      const canvas = canvasRef.current;
      if (!canvas) { dragRef.current = null; return; }
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      let hit: DrawnElement | null = null;
      for (let i = drawnRef.current.length - 1; i >= 0; i--) {
        const d = drawnRef.current[i];
        if (mx >= d.minX && mx <= d.maxX && my >= d.minY && my <= d.maxY) { hit = d; break; }
      }
      if (hit?.type === 'room') { onSelectRoom(hit.id); onSelectWall(null); }
      else if (hit?.type === 'wall') { onSelectWall(hit.id); onSelectRoom(null); }
      else { onSelectRoom(null); onSelectWall(null); }
    }
    dragRef.current = null;
  }, [onSelectRoom, onSelectWall]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCam(c => ({ ...c, zoom: Math.max(0.15, Math.min(6, c.zoom * (e.deltaY < 0 ? 1.12 : 0.9))) }));
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startCam: { ...camRef.current },
        mode: 'rotate',
        moved: false,
      };
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragRef.current.moved = true;
      const sc = dragRef.current.startCam;
      setCam(c => ({
        ...c,
        rotY: sc.rotY + dx * 0.007,
        rotX: Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, sc.rotX - dy * 0.007)),
      }));
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
      <div className="absolute top-2 right-2 flex gap-1.5">
        {[
          { label: 'Vorne', rotX: 0.02, rotY: 0 },
          { label: 'Seite', rotX: 0.02, rotY: Math.PI / 2 },
          { label: 'Oben', rotX: Math.PI / 2 - 0.05, rotY: 0 },
          { label: '3D', rotX: 0.55, rotY: 0.6 },
        ].map(v => (
          <button
            key={v.label}
            onClick={() => setCam(c => ({ ...c, rotX: v.rotX, rotY: v.rotY }))}
            className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded text-[10px] font-medium"
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button onClick={() => setCam(c => ({ ...c, zoom: Math.min(6, c.zoom * 1.2) }))} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">+</button>
        <button onClick={() => setCam(c => ({ ...c, zoom: Math.max(0.15, c.zoom * 0.8) }))} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">−</button>
        <button onClick={() => setCam({ rotX: 0.55, rotY: 0.6, zoom: 1.0, panX: 0, panY: 0 })} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center border border-slate-600">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>
      <div className="absolute bottom-3 left-3 text-slate-600 text-[10px] bg-slate-900/60 px-2 py-1 rounded">
        Ziehen: Drehen · Rechtsklick/Alt: Verschieben · Scroll: Zoom
      </div>
    </div>
  );
}

function renderWall(
  wall: Wall,
  ox: number,
  baseY: number,
  floorH: number,
  isSel: boolean,
  allFaces: Face[],
  p: (x: number, y: number, z: number) => [number, number, number],
  drawn: DrawnElement[]
) {
  const wallH = wall.height > 0 ? wall.height : floorH;
  const dx = wall.x2 - wall.x1;
  const dz = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return;

  const nx = -dz / len;
  const nz = dx / len;
  const half = (wall.thickness || 0.25) / 2;
  const opacity = wall.opacity ?? 1;
  const wallColor = wall.color || '#94a3b8';

  const x1a = wall.x1 + ox + nx * half;
  const z1a = wall.y1 + nz * half;
  const x2a = wall.x2 + ox + nx * half;
  const z2a = wall.y2 + nz * half;
  const x1b = wall.x1 + ox - nx * half;
  const z1b = wall.y1 - nz * half;
  const x2b = wall.x2 + ox - nx * half;
  const z2b = wall.y2 - nz * half;

  const taa = p(x1a, baseY + wallH, z1a);
  const tab = p(x2a, baseY + wallH, z2a);
  const tba = p(x1b, baseY + wallH, z1b);
  const tbb = p(x2b, baseY + wallH, z2b);
  const baa = p(x1a, baseY, z1a);
  const bab = p(x2a, baseY, z2a);
  const bba = p(x1b, baseY, z1b);
  const bbb = p(x2b, baseY, z2b);

  const strokeC = isSel ? '#60a5fa' : 'rgba(10,20,35,0.5)';
  const lw = isSel ? 1.5 : 0.6;

  const lightTop = faceLight(0, 1, 0);
  const lightSideA = faceLight(nx, 0, nz);
  const lightSideB = faceLight(-nx, 0, -nz);
  const lightEnd1 = faceLight(dx / len, 0, dz / len);
  const lightEnd2 = faceLight(-dx / len, 0, -dz / len);

  const avgDepth = (taa[2] + tab[2] + tba[2] + tbb[2]) / 4;

  const mkPts = (pts: [number, number, number][]): [number, number][] => pts.map(([x, y]) => [x, y]);

  allFaces.push({ pts: mkPts([taa, tab, tbb, tba]), fill: applyLight(wallColor, lightTop, isSel, opacity), stroke: strokeC, lineWidth: lw, avgDepth: avgDepth - 8 });
  allFaces.push({ pts: mkPts([baa, bab, tab, taa]), fill: applyLight(wallColor, lightSideA, isSel, opacity), stroke: strokeC, lineWidth: lw, avgDepth: avgDepth });
  allFaces.push({ pts: mkPts([bba, bbb, tbb, tba]), fill: applyLight(wallColor, lightSideB, isSel, opacity), stroke: strokeC, lineWidth: lw, avgDepth: avgDepth + 1 });
  allFaces.push({ pts: mkPts([baa, bba, tba, taa]), fill: applyLight(wallColor, lightEnd1, isSel, opacity), stroke: strokeC, lineWidth: lw, avgDepth: avgDepth + 2 });
  allFaces.push({ pts: mkPts([bab, bbb, tbb, tab]), fill: applyLight(wallColor, lightEnd2, isSel, opacity), stroke: strokeC, lineWidth: lw, avgDepth: avgDepth + 2 });

  const allPts = [taa, tab, tba, tbb, baa, bab, bba, bbb];
  drawn.push({
    id: wall.id, type: 'wall',
    minX: Math.min(...allPts.map(([x]) => x)),
    minY: Math.min(...allPts.map(([, y]) => y)),
    maxX: Math.max(...allPts.map(([x]) => x)),
    maxY: Math.max(...allPts.map(([, y]) => y)),
  });
}
