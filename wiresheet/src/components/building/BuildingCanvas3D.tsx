import { useRef, useEffect, useCallback, useState } from 'react';
import { Building, Floor, Wall, ObjModel } from '../../types/building';

interface Props {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  selectedObjModelId?: string | null;
  objModels?: ObjModel[];
  onSelectRoom: (roomId: string | null) => void;
  onSelectWall: (wallId: string | null) => void;
  onSelectObjModel?: (modelId: string | null) => void;
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

const SUN_DIR = { x: -0.6, y: 0.8, z: 0.5 };
const SUN_LEN = Math.sqrt(SUN_DIR.x ** 2 + SUN_DIR.y ** 2 + SUN_DIR.z ** 2);
const SUN = { x: SUN_DIR.x / SUN_LEN, y: SUN_DIR.y / SUN_LEN, z: SUN_DIR.z / SUN_LEN };

function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function faceLight(nx: number, ny: number, nz: number): number {
  const d = dot({ x: nx, y: ny, z: nz }, SUN);
  return 0.18 + 0.82 * Math.max(0, d);
}

function projectPt(
  x: number, y: number, z: number,
  cam: Camera, cx: number, cy: number
): [number, number, number] {
  const cosY = Math.cos(cam.rotY);
  const sinY = Math.sin(cam.rotY);
  const cosX = Math.cos(cam.rotX);
  const sinX = Math.sin(cam.rotX);

  const rx = x * cosY - z * sinY;
  const ry = x * sinY * sinX + y * cosX + z * cosY * sinX;
  const rz = x * sinY * cosX - y * sinX + z * cosY * cosX;

  const fov = 900 * cam.zoom;
  const depth = fov + rz + 700;
  const persp = fov / depth;
  const sx = cx + rx * persp * UNIT + cam.panX;
  const sy = cy - ry * persp * UNIT + cam.panY;
  return [sx, sy, depth];
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [148, 163, 184];
}

function applyLight(hex: string, lightFactor: number, selected: boolean): string {
  const [r, g, b] = hexToRgb(hex);
  const boost = selected ? 1.3 : 1.0;
  return `rgb(${Math.min(255, Math.floor(r * lightFactor * boost))},${Math.min(255, Math.floor(g * lightFactor * boost))},${Math.min(255, Math.floor(b * lightFactor * boost))})`;
}

function shadowColor(alpha: number): string {
  return `rgba(0,0,0,${alpha})`;
}

interface Face {
  pts: [number, number][];
  fill: string;
  stroke: string;
  lineWidth: number;
  avgDepth: number;
  shadowAlpha?: number;
  isWall?: boolean;
}

function renderFaces(ctx: CanvasRenderingContext2D, faces: Face[]) {
  faces.sort((a, b) => a.avgDepth - b.avgDepth);
  for (const face of faces) {
    if (face.shadowAlpha && face.shadowAlpha > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;
    }
    ctx.beginPath();
    face.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = face.fill;
    ctx.fill();
    if (face.shadowAlpha) ctx.restore();
    ctx.strokeStyle = face.stroke;
    ctx.lineWidth = face.lineWidth;
    ctx.beginPath();
    face.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
}

interface DrawnElement {
  id: string;
  type: 'room' | 'wall' | 'obj';
  minX: number; minY: number; maxX: number; maxY: number;
}

export function BuildingCanvas3D({
  buildings, activeFloorId, selectedRoomId, selectedWallId,
  selectedObjModelId, objModels = [],
  onSelectRoom, onSelectWall, onSelectObjModel, highlightFloor,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<Camera>({ rotX: 0.48, rotY: 0.55, zoom: 1.0, panX: 0, panY: 30 });
  const dragRef = useRef<{ startX: number; startY: number; startCam: Camera; moved: boolean } | null>(null);
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

    let buildingOffsetX = 0;
    const allFaces: Face[] = [];

    for (const building of buildings) {
      const sorted = [...building.floors].sort((a, b) => a.level - b.level);

      let floorBaseY: Record<string, number> = {};
      let yAcc = 0;
      for (const floor of sorted) {
        floorBaseY[floor.id] = yAcc;
        yAcc += floor.height;
      }

      const maxW = building.floors.flatMap(f => [
        ...f.rooms.map(r => r.x + r.width),
        ...f.walls.map(w => Math.max(w.x1, w.x2)),
      ]).reduce((m, v) => Math.max(m, v), 8);

      for (const floor of sorted) {
        const baseY = floorBaseY[floor.id];
        const floorH = floor.height;
        const isActive = floor.id === activeFloorId;
        const alpha = !highlightFloor || isActive ? 1.0 : 0.25;

        ctx.globalAlpha = alpha;

        const ox = buildingOffsetX;

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

          const corners = {
            tfl: p(rx, baseY + floorH, ry),
            tfr: p(rx + rw, baseY + floorH, ry),
            tbr: p(rx + rw, baseY + floorH, ry + rd),
            tbl: p(rx, baseY + floorH, ry + rd),
            bfl: p(rx, baseY, ry),
            bfr: p(rx + rw, baseY, ry),
            bbr: p(rx + rw, baseY, ry + rd),
            bbl: p(rx, baseY, ry + rd),
          };

          const baseDepth = (
            corners.tfl[2] + corners.tfr[2] + corners.tbr[2] + corners.tbl[2]
          ) / 4;

          const strokeC = isSel ? 'rgba(96,165,250,0.9)' : 'rgba(10,20,35,0.7)';
          const lw = isSel ? 1.5 : 0.7;

          const floorFill = `rgba(15,23,42,${isActive ? 0.6 : 0.4})`;
          allFaces.push({
            pts: [corners.bfl, corners.bfr, corners.bbr, corners.bbl].map(([x, y]) => [x, y]),
            fill: floorFill,
            stroke: 'rgba(30,50,80,0.5)',
            lineWidth: 0.5,
            avgDepth: baseDepth + 5,
          });

          allFaces.push({
            pts: [corners.tfl, corners.tfr, corners.tbr, corners.tbl].map(([x, y]) => [x, y]),
            fill: applyLight(rc, topLight, isSel),
            stroke: strokeC,
            lineWidth: lw,
            avgDepth: baseDepth - 10,
            shadowAlpha: isSel ? 0 : 0.15,
            isWall: false,
          });

          allFaces.push({
            pts: [corners.bfl, corners.bfr, corners.tfr, corners.tfl].map(([x, y]) => [x, y]),
            fill: applyLight(rc, frontLight, isSel),
            stroke: strokeC, lineWidth: lw,
            avgDepth: baseDepth + 2,
          });
          allFaces.push({
            pts: [corners.bfr, corners.bbr, corners.tbr, corners.tfr].map(([x, y]) => [x, y]),
            fill: applyLight(rc, rightLight, isSel),
            stroke: strokeC, lineWidth: lw,
            avgDepth: baseDepth + 3,
          });
          allFaces.push({
            pts: [corners.bbl, corners.bbr, corners.tbr, corners.tbl].map(([x, y]) => [x, y]),
            fill: applyLight(rc, backLight, isSel),
            stroke: strokeC, lineWidth: lw,
            avgDepth: baseDepth + 4,
          });
          allFaces.push({
            pts: [corners.bbl, corners.bfl, corners.tfl, corners.tbl].map(([x, y]) => [x, y]),
            fill: applyLight(rc, leftLight, isSel),
            stroke: strokeC, lineWidth: lw,
            avgDepth: baseDepth + 3,
          });

          const pts2D = Object.values(corners).map(([x, y]) => [x, y]);
          drawn.push({
            id: room.id, type: 'room',
            minX: Math.min(...pts2D.map(p => p[0])),
            minY: Math.min(...pts2D.map(p => p[1])),
            maxX: Math.max(...pts2D.map(p => p[0])),
            maxY: Math.max(...pts2D.map(p => p[1])),
          });
        }

        for (const wall of floor.walls) {
          const isSel = wall.id === selectedWallId;
          renderWall3D(wall, ox, baseY, floorH, isSel, allFaces, p, drawn);
        }

        ctx.globalAlpha = 1;

        const labelX = buildingOffsetX + maxW / 2;
        const lp = p(labelX, baseY + floorH / 2, -2);
        const fade = !highlightFloor || isActive ? 1 : 0.3;
        ctx.globalAlpha = fade;
        ctx.font = `${isActive ? 'bold ' : ''}${Math.max(8, 10 * cam.zoom)}px Inter,sans-serif`;
        ctx.fillStyle = isActive ? '#60a5fa' : 'rgba(148,163,184,0.5)';
        ctx.textAlign = 'right';
        ctx.fillText(floor.name, lp[0] - 5, lp[1]);
        ctx.globalAlpha = 1;
      }

      buildingOffsetX += maxW + 5;
    }

    for (const model of objModels) {
      if (!model.visible) continue;
      renderObjModel3D(model, model.id === selectedObjModelId, allFaces, p, drawn);
    }

    ctx.globalAlpha = 1;
    renderFaces(ctx, allFaces);

    for (const building of buildings) {
      for (const floor of building.floors) {
        const isActive = floor.id === activeFloorId;
        const fade = !highlightFloor || isActive ? 1 : 0.25;
        ctx.globalAlpha = fade;
        let bOx = 0;
        let bW = 0;
        for (const b of buildings) {
          if (b.id === building.id) break;
          const mw = b.floors.flatMap(f => [
            ...f.rooms.map(r => r.x + r.width),
            ...f.walls.map(w => Math.max(w.x1, w.x2)),
          ]).reduce((m, v) => Math.max(m, v), 8);
          bOx += mw + 5;
        }
        bW = building.floors.flatMap(f => [
          ...f.rooms.map(r => r.x + r.width),
          ...f.walls.map(w => Math.max(w.x1, w.x2)),
        ]).reduce((m, v) => Math.max(m, v), 8);

        const sorted = [...building.floors].sort((a, b) => a.level - b.level);
        let yAccL = 0;
        for (const f of sorted) {
          if (f.id === floor.id) break;
          yAccL += f.height;
        }
        const baseY = yAccL;
        const floorH = floor.height;

        for (const room of floor.rooms) {
          const rx = room.x + bOx;
          const ry = room.y;
          const rw = room.width;
          const rd = room.depth;
          const lp = p(rx + rw / 2, baseY + floorH + 0.05, ry + rd / 2);
          const isSel = room.id === selectedRoomId;
          ctx.font = `bold ${Math.max(8, Math.min(11, 9 * cam.zoom))}px Inter,sans-serif`;
          ctx.fillStyle = isSel ? '#e2e8f0' : 'rgba(226,232,240,0.65)';
          ctx.textAlign = 'center';
          if (cam.zoom > 0.5) ctx.fillText(room.name, lp[0], lp[1]);
        }
        ctx.globalAlpha = 1;
      }
    }

    ctx.textAlign = 'left';
    drawnRef.current = drawn;
  }, [buildings, activeFloorId, selectedRoomId, selectedWallId, selectedObjModelId, objModels, cam, highlightFloor]);

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
    dragRef.current = { startX: e.clientX, startY: e.clientY, startCam: { ...cam }, moved: false };
  }, [cam]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
    if (e.buttons === 1 && !e.altKey) {
      setCam(c => ({
        ...c,
        rotY: dragRef.current!.startCam.rotY + dx * 0.005,
        rotX: Math.max(0.05, Math.min(1.5, dragRef.current!.startCam.rotX - dy * 0.005)),
      }));
    } else if (e.buttons === 1 && e.altKey) {
      setCam(c => ({ ...c, panX: dragRef.current!.startCam.panX + dx, panY: dragRef.current!.startCam.panY + dy }));
    } else if (e.buttons === 2) {
      setCam(c => ({ ...c, panX: dragRef.current!.startCam.panX + dx, panY: dragRef.current!.startCam.panY + dy }));
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
      if (hit?.type === 'room') { onSelectRoom(hit.id); onSelectWall(null); onSelectObjModel?.(null); }
      else if (hit?.type === 'wall') { onSelectWall(hit.id); onSelectRoom(null); onSelectObjModel?.(null); }
      else if (hit?.type === 'obj') { onSelectObjModel?.(hit.id); onSelectRoom(null); onSelectWall(null); }
      else { onSelectRoom(null); onSelectWall(null); onSelectObjModel?.(null); }
    }
    dragRef.current = null;
  }, [onSelectRoom, onSelectWall, onSelectObjModel]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCam(c => ({ ...c, zoom: Math.max(0.25, Math.min(4, c.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }));
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
      />
      <div className="absolute top-2 right-2 flex gap-1.5">
        {[
          { label: 'Vorne', rotX: 0.05, rotY: 0 },
          { label: 'Seite', rotX: 0.05, rotY: Math.PI / 2 },
          { label: 'Oben', rotX: Math.PI / 2 - 0.1, rotY: 0 },
          { label: '3D', rotX: 0.48, rotY: 0.55 },
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
        <button onClick={() => setCam(c => ({ ...c, zoom: Math.min(4, c.zoom * 1.2) }))} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">+</button>
        <button onClick={() => setCam(c => ({ ...c, zoom: Math.max(0.25, c.zoom * 0.8) }))} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">−</button>
        <button onClick={() => setCam({ rotX: 0.48, rotY: 0.55, zoom: 1.0, panX: 0, panY: 30 })} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center border border-slate-600">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>
      <div className="absolute bottom-3 left-3 text-slate-600 text-[10px] bg-slate-900/60 px-2 py-1 rounded">
        Ziehen: Drehen · Alt+Ziehen / Rechtsklick: Verschieben · Scroll: Zoom
      </div>
    </div>
  );
}

function renderWall3D(
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
  const half = wall.thickness / 2;

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

  const wallColor = '#d4d8dc';
  const strokeC = isSel ? '#60a5fa' : 'rgba(10,20,35,0.6)';
  const lw = isSel ? 1.5 : 0.7;

  const lightTop = faceLight(0, 1, 0);
  const lightSideA = faceLight(nx, 0, nz);
  const lightSideB = faceLight(-nx, 0, -nz);
  const lightEnd1 = faceLight(dx / len, 0, dz / len);
  const lightEnd2 = faceLight(-dx / len, 0, -dz / len);

  const avgDepth = (taa[2] + tab[2] + tba[2] + tbb[2]) / 4;

  allFaces.push({
    pts: [taa, tab, tbb, tba].map(([x, y]) => [x, y]),
    fill: applyLight(wallColor, lightTop, isSel),
    stroke: strokeC, lineWidth: lw,
    avgDepth: avgDepth - 8,
    shadowAlpha: 0.2,
  });
  allFaces.push({
    pts: [baa, bab, tab, taa].map(([x, y]) => [x, y]),
    fill: applyLight(wallColor, lightSideA, isSel),
    stroke: strokeC, lineWidth: lw,
    avgDepth: avgDepth,
    shadowAlpha: 0.15,
  });
  allFaces.push({
    pts: [bba, bbb, tbb, tba].map(([x, y]) => [x, y]),
    fill: applyLight(wallColor, lightSideB, isSel),
    stroke: strokeC, lineWidth: lw,
    avgDepth: avgDepth + 1,
  });
  allFaces.push({
    pts: [baa, bba, tba, taa].map(([x, y]) => [x, y]),
    fill: applyLight(wallColor, lightEnd1, isSel),
    stroke: strokeC, lineWidth: lw,
    avgDepth: avgDepth + 2,
  });
  allFaces.push({
    pts: [bab, bbb, tbb, tab].map(([x, y]) => [x, y]),
    fill: applyLight(wallColor, lightEnd2, isSel),
    stroke: strokeC, lineWidth: lw,
    avgDepth: avgDepth + 2,
  });

  const allPts = [taa, tab, tba, tbb, baa, bab, bba, bbb];
  drawn.push({
    id: wall.id, type: 'wall',
    minX: Math.min(...allPts.map(([x]) => x)),
    minY: Math.min(...allPts.map(([, y]) => y)),
    maxX: Math.max(...allPts.map(([x]) => x)),
    maxY: Math.max(...allPts.map(([, y]) => y)),
  });
}

function transformVertex(
  v: [number, number, number],
  model: ObjModel
): [number, number, number] {
  let [x, y, z] = v;

  x *= model.scale;
  y *= model.scale;
  z *= model.scale;

  const cosX = Math.cos(model.rotX);
  const sinX = Math.sin(model.rotX);
  const cosY = Math.cos(model.rotY);
  const sinY = Math.sin(model.rotY);
  const cosZ = Math.cos(model.rotZ);
  const sinZ = Math.sin(model.rotZ);

  let tx = x, ty = y, tz = z;

  ty = y * cosX - z * sinX;
  tz = y * sinX + z * cosX;
  y = ty; z = tz;

  tx = x * cosY + z * sinY;
  tz = -x * sinY + z * cosY;
  x = tx; z = tz;

  tx = x * cosZ - y * sinZ;
  ty = x * sinZ + y * cosZ;
  x = tx; y = ty;

  return [x + model.x, y + model.z, z + model.y];
}

function renderObjModel3D(
  model: ObjModel,
  isSel: boolean,
  allFaces: Face[],
  p: (x: number, y: number, z: number) => [number, number, number],
  drawn: DrawnElement[]
) {
  if (model.vertices.length === 0 || model.faces.length === 0) return;

  const materialMap = new Map(model.materials.map(m => [m.name, m]));

  let minPx = Infinity, maxPx = -Infinity;
  let minPy = Infinity, maxPy = -Infinity;

  for (const face of model.faces) {
    const { vertexIndices, normalIndices, materialName } = face;
    if (vertexIndices.length < 3) continue;

    const mat = materialName ? (materialMap.get(materialName) ?? model.materials[0]) : model.materials[0];
    const color = mat?.color ?? '#cccccc';
    const baseColor = isSel ? '#60a5fa' : color;

    const tv0 = transformVertex(model.vertices[vertexIndices[0]], model);
    const tv1 = transformVertex(model.vertices[vertexIndices[1]], model);
    const tv2 = transformVertex(model.vertices[vertexIndices[2]], model);

    let lightFactor = 0.7;
    if (normalIndices[0] >= 0 && normalIndices[0] < model.normals.length) {
      const [nx, ny, nz] = model.normals[normalIndices[0]];
      lightFactor = faceLight(nx, ny, nz);
    } else {
      const ax = tv1[0] - tv0[0], ay = tv1[1] - tv0[1], az = tv1[2] - tv0[2];
      const bx = tv2[0] - tv0[0], by = tv2[1] - tv0[1], bz = tv2[2] - tv0[2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl > 0.001) lightFactor = faceLight(nx / nl, ny / nl, nz / nl);
    }

    const p0 = p(tv0[0], tv0[1], tv0[2]);
    const p1 = p(tv1[0], tv1[1], tv1[2]);
    const p2 = p(tv2[0], tv2[1], tv2[2]);

    const avgDepth = (p0[2] + p1[2] + p2[2]) / 3;
    const fill = applyLight(baseColor, lightFactor, false);
    const stroke = isSel ? 'rgba(96,165,250,0.6)' : 'rgba(0,0,0,0.2)';

    const pts2D: [number, number][] = [
      [p0[0], p0[1]],
      [p1[0], p1[1]],
      [p2[0], p2[1]],
    ];

    allFaces.push({ pts: pts2D, fill, stroke, lineWidth: isSel ? 0.8 : 0.3, avgDepth });

    for (const [px, py] of pts2D) {
      if (px < minPx) minPx = px;
      if (px > maxPx) maxPx = px;
      if (py < minPy) minPy = py;
      if (py > maxPy) maxPy = py;
    }
  }

  if (minPx < Infinity) {
    drawn.push({ id: model.id, type: 'obj', minX: minPx, minY: minPy, maxX: maxPx, maxY: maxPy });
  }
}
