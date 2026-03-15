import { useRef, useEffect, useCallback, useState } from 'react';
import { Building, Wall, WallOpening } from '../../types/building';

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

const SUN = (() => {
  const d = { x: -0.45, y: 0.85, z: 0.35 };
  const l = Math.sqrt(d.x ** 2 + d.y ** 2 + d.z ** 2);
  return { x: d.x / l, y: d.y / l, z: d.z / l };
})();

const SUN2 = (() => {
  const d = { x: 0.6, y: 0.5, z: -0.4 };
  const l = Math.sqrt(d.x ** 2 + d.y ** 2 + d.z ** 2);
  return { x: d.x / l, y: d.y / l, z: d.z / l };
})();

function dot3(a: [number, number, number], b: { x: number; y: number; z: number }) {
  return a[0] * b.x + a[1] * b.y + a[2] * b.z;
}

function faceLight(nx: number, ny: number, nz: number): number {
  const d1 = Math.max(0, dot3([nx, ny, nz], SUN));
  const d2 = Math.max(0, dot3([nx, ny, nz], SUN2));
  return 0.15 + 0.7 * d1 + 0.15 * d2;
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

function mixColor(
  hex: string,
  lightFactor: number,
  selected: boolean,
  opacity = 1.0,
  specular = 0.0
): string {
  const [r, g, b] = hexToRgb(hex);
  const boost = selected ? 1.25 : 1.0;
  const spec = specular * 255;
  const ri = Math.min(255, Math.floor(r * lightFactor * boost + spec));
  const gi = Math.min(255, Math.floor(g * lightFactor * boost + spec));
  const bi = Math.min(255, Math.floor(b * lightFactor * boost + spec));
  return `rgba(${ri},${gi},${bi},${opacity})`;
}

interface Face {
  pts: [number, number][];
  fill: string;
  fillGrad?: { x0: number; y0: number; x1: number; y1: number; c0: string; c1: string };
  stroke: string;
  lineWidth: number;
  avgDepth: number;
  clip?: [number, number][];
}

function drawFaces(ctx: CanvasRenderingContext2D, faces: Face[]) {
  faces.sort((a, b) => b.avgDepth - a.avgDepth);
  for (const face of faces) {
    if (face.pts.length < 3) continue;
    ctx.beginPath();
    face.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    if (face.fillGrad) {
      const fg = face.fillGrad;
      const grad = ctx.createLinearGradient(fg.x0, fg.y0, fg.x1, fg.y1);
      grad.addColorStop(0, fg.c0);
      grad.addColorStop(1, fg.c1);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = face.fill;
    }
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
    grad.addColorStop(0, '#0a1020');
    grad.addColorStop(0.4, '#0c1828');
    grad.addColorStop(1, '#0f2535');
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
        const alpha = !highlightFloor || isActive ? 1.0 : 0.18;

        const ox = buildingOffsetX;

        const groundColor = isActive ? '#1a3a5a' : '#111e2d';
        const groundOpacity = alpha * (isActive ? 0.9 : 0.5);
        const g0 = p(ox, baseY, 0);
        const g1 = p(ox + maxW, baseY, 0);
        const g2 = p(ox + maxW, baseY, maxD);
        const g3 = p(ox, baseY, maxD);
        const groundDepth = (g0[2] + g1[2] + g2[2] + g3[2]) / 4;

        const [gr, gg, gb] = hexToRgb(groundColor);
        allFaces.push({
          pts: [[g0[0], g0[1]], [g1[0], g1[1]], [g2[0], g2[1]], [g3[0], g3[1]]],
          fill: `rgba(${gr},${gg},${gb},${groundOpacity})`,
          fillGrad: isActive ? {
            x0: g0[0], y0: g0[1], x1: g2[0], y1: g2[1],
            c0: `rgba(28,60,100,${groundOpacity})`,
            c1: `rgba(15,30,50,${groundOpacity})`,
          } : undefined,
          stroke: `rgba(20,45,80,${alpha * 0.5})`,
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
          const topSpec = 0.08;

          const tfl = p(rx, baseY + floorH, ry);
          const tfr = p(rx + rw, baseY + floorH, ry);
          const tbr = p(rx + rw, baseY + floorH, ry + rd);
          const tbl = p(rx, baseY + floorH, ry + rd);
          const bfl = p(rx, baseY, ry);
          const bfr = p(rx + rw, baseY, ry);
          const bbr = p(rx + rw, baseY, ry + rd);
          const bbl = p(rx, baseY, ry + rd);

          const avgD = (tfl[2] + tfr[2] + tbr[2] + tbl[2]) / 4;
          const strokeC = isSel ? 'rgba(96,165,250,0.9)' : 'rgba(8,15,28,0.6)';
          const lw = isSel ? 1.5 : 0.5;

          allFaces.push({
            pts: [[tfl[0],tfl[1]],[tfr[0],tfr[1]],[tbr[0],tbr[1]],[tbl[0],tbl[1]]],
            fill: mixColor(rc, topLight, isSel, 1, topSpec),
            fillGrad: {
              x0: tfl[0], y0: tfl[1], x1: tbr[0], y1: tbr[1],
              c0: mixColor(rc, topLight * 1.1, isSel),
              c1: mixColor(rc, topLight * 0.85, isSel),
            },
            stroke: strokeC, lineWidth: lw, avgDepth: avgD - 10,
          });
          allFaces.push({ pts: [[bfl[0],bfl[1]],[bfr[0],bfr[1]],[tfr[0],tfr[1]],[tfl[0],tfl[1]]], fill: mixColor(rc, frontLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 2 });
          allFaces.push({ pts: [[bfr[0],bfr[1]],[bbr[0],bbr[1]],[tbr[0],tbr[1]],[tfr[0],tfr[1]]], fill: mixColor(rc, rightLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 3 });
          allFaces.push({ pts: [[bbl[0],bbl[1]],[bbr[0],bbr[1]],[tbr[0],tbr[1]],[tbl[0],tbl[1]]], fill: mixColor(rc, backLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 4 });
          allFaces.push({ pts: [[bbl[0],bbl[1]],[bfl[0],bfl[1]],[tfl[0],tfl[1]],[tbl[0],tbl[1]]], fill: mixColor(rc, leftLight, isSel), stroke: strokeC, lineWidth: lw, avgDepth: avgD + 3 });

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
        const fade = !highlightFloor || isActive ? 1 : 0.2;
        ctx.globalAlpha = fade;
        ctx.font = `${isActive ? 'bold ' : ''}${Math.max(8, 10 * cam.zoom)}px Inter,sans-serif`;
        ctx.fillStyle = isActive ? '#60a5fa' : 'rgba(148,163,184,0.35)';
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
        const fade = !highlightFloor || isActive ? 1 : 0.15;
        ctx.globalAlpha = fade;

        for (const room of floor.rooms) {
          const lp = p(room.x + bOx + room.width / 2, yAccL + floor.height + 0.05, room.y + room.depth / 2);
          if (cam.zoom > 0.5) {
            ctx.font = `bold ${Math.max(7, Math.min(11, 9 * cam.zoom))}px Inter,sans-serif`;
            ctx.fillStyle = room.id === selectedRoomId ? '#f1f5f9' : 'rgba(226,232,240,0.55)';
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

  const onTouchEnd = useCallback(() => { dragRef.current = null; }, []);

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

function renderWallSegments(
  wallColor: string,
  openings: WallOpening[],
  wallLen: number,
  wallH: number,
  floorH: number,
  isSel: boolean,
  opacity: number,
  lightFn: (lf: number) => string,
  segFn: (pos0: number, pos1: number, y0: number, y1: number) => Face | null,
  allFaces: Face[]
) {
  if (openings.length === 0) {
    const f = segFn(0, wallLen, 0, wallH);
    if (f) allFaces.push(f);
    return;
  }

  const sorted = [...openings].sort((a, b) => (a.position - a.width / 2) - (b.position - b.width / 2));
  const segs: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];

  let cursor = 0;
  for (const o of sorted) {
    const ox0 = Math.max(0, o.position - o.width / 2);
    const ox1 = Math.min(wallLen, o.position + o.width / 2);
    const isDoor = o.type === 'door' || o.type === 'door-double' || o.type === 'door-arch';
    const oy0 = isDoor ? 0 : (o.sillHeight || 0.9);
    const oy1 = Math.min(wallH, (o.sillHeight || 0.9) + o.height);

    if (ox0 > cursor) {
      segs.push({ x0: cursor, x1: ox0, y0: 0, y1: wallH });
    }
    if (oy0 > 0) {
      segs.push({ x0: ox0, x1: ox1, y0: 0, y1: oy0 });
    }
    if (oy1 < wallH) {
      segs.push({ x0: ox0, x1: ox1, y0: oy1, y1: wallH });
    }
    cursor = ox1;
  }
  if (cursor < wallLen) {
    segs.push({ x0: cursor, x1: wallLen, y0: 0, y1: wallH });
  }

  for (const seg of segs) {
    const f = segFn(seg.x0, seg.x1, seg.y0, seg.y1);
    if (f) allFaces.push(f);
  }
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
  const openings = wall.openings ?? [];

  const ux = dx / len;
  const uz = dz / len;

  const lightSideA = faceLight(nx, 0, nz);
  const lightSideB = faceLight(-nx, 0, -nz);
  const lightEnd1 = faceLight(ux, 0, uz);
  const lightEnd2 = faceLight(-ux, 0, -uz);
  const lightTop = faceLight(0, 1, 0);
  const strokeC = isSel ? '#60a5fa' : 'rgba(8,15,28,0.5)';
  const lw = isSel ? 1.5 : 0.5;

  function makeSegFaceSideA(pos0: number, pos1: number, y0: number, y1: number): Face | null {
    if (pos1 <= pos0 || y1 <= y0) return null;
    const w0x = wall.x1 + ox + ux * pos0 + nx * half;
    const w0z = wall.y1 + uz * pos0 + nz * half;
    const w1x = wall.x1 + ox + ux * pos1 + nx * half;
    const w1z = wall.y1 + uz * pos1 + nz * half;
    const bl = p(w0x, baseY + y0, w0z);
    const br = p(w1x, baseY + y0, w1z);
    const tr = p(w1x, baseY + y1, w1z);
    const tl = p(w0x, baseY + y1, w0z);
    const avgDepth = (bl[2] + br[2] + tr[2] + tl[2]) / 4;
    const baseColor = mixColor(wallColor, lightSideA, isSel, opacity);
    return {
      pts: [[bl[0],bl[1]], [br[0],br[1]], [tr[0],tr[1]], [tl[0],tl[1]]],
      fill: baseColor,
      fillGrad: {
        x0: tl[0], y0: tl[1], x1: bl[0], y1: bl[1],
        c0: mixColor(wallColor, lightSideA * 1.05, isSel, opacity),
        c1: mixColor(wallColor, lightSideA * 0.8, isSel, opacity),
      },
      stroke: strokeC, lineWidth: lw, avgDepth,
    };
  }

  function makeSegFaceSideB(pos0: number, pos1: number, y0: number, y1: number): Face | null {
    if (pos1 <= pos0 || y1 <= y0) return null;
    const w0x = wall.x1 + ox + ux * pos0 - nx * half;
    const w0z = wall.y1 + uz * pos0 - nz * half;
    const w1x = wall.x1 + ox + ux * pos1 - nx * half;
    const w1z = wall.y1 + uz * pos1 - nz * half;
    const bl = p(w0x, baseY + y0, w0z);
    const br = p(w1x, baseY + y0, w1z);
    const tr = p(w1x, baseY + y1, w1z);
    const tl = p(w0x, baseY + y1, w0z);
    const avgDepth = (bl[2] + br[2] + tr[2] + tl[2]) / 4;
    return {
      pts: [[bl[0],bl[1]], [br[0],br[1]], [tr[0],tr[1]], [tl[0],tl[1]]],
      fill: mixColor(wallColor, lightSideB, isSel, opacity),
      fillGrad: {
        x0: tl[0], y0: tl[1], x1: bl[0], y1: bl[1],
        c0: mixColor(wallColor, lightSideB * 1.05, isSel, opacity),
        c1: mixColor(wallColor, lightSideB * 0.8, isSel, opacity),
      },
      stroke: strokeC, lineWidth: lw, avgDepth: avgDepth + 1,
    };
  }

  function makeTopFace(pos0: number, pos1: number): Face | null {
    if (pos1 <= pos0) return null;
    const ax = wall.x1 + ox + ux * pos0;
    const az = wall.y1 + uz * pos0;
    const bx = wall.x1 + ox + ux * pos1;
    const bz = wall.y1 + uz * pos1;
    const taa = p(ax + nx * half, baseY + wallH, az + nz * half);
    const tab = p(bx + nx * half, baseY + wallH, bz + nz * half);
    const tbb = p(bx - nx * half, baseY + wallH, bz - nz * half);
    const tba = p(ax - nx * half, baseY + wallH, az - nz * half);
    const avgDepth = (taa[2] + tab[2] + tbb[2] + tba[2]) / 4;
    return {
      pts: [[taa[0],taa[1]], [tab[0],tab[1]], [tbb[0],tbb[1]], [tba[0],tba[1]]],
      fill: mixColor(wallColor, lightTop, isSel, opacity),
      stroke: strokeC, lineWidth: lw, avgDepth: avgDepth - 8,
    };
  }

  renderWallSegments(wallColor, openings, len, wallH, floorH, isSel, opacity,
    () => '', makeSegFaceSideA, allFaces);
  renderWallSegments(wallColor, openings, len, wallH, floorH, isSel, opacity,
    () => '', makeSegFaceSideB, allFaces);

  const topSegs = openings.length === 0 ? [{ x0: 0, x1: len }] : (() => {
    const sorted2 = [...openings].sort((a, b) => (a.position - a.width / 2) - (b.position - b.width / 2));
    const result: Array<{ x0: number; x1: number }> = [];
    let cur = 0;
    for (const o of sorted2) {
      const ox0 = Math.max(0, o.position - o.width / 2);
      const ox1 = Math.min(len, o.position + o.width / 2);
      const isDoor = o.type === 'door' || o.type === 'door-double' || o.type === 'door-arch';
      const oy1 = isDoor ? 0 : Math.min(wallH, (o.sillHeight || 0.9) + o.height);
      if (ox0 > cur) result.push({ x0: cur, x1: ox0 });
      if (oy1 < wallH) result.push({ x0: ox0, x1: ox1 });
      cur = ox1;
    }
    if (cur < len) result.push({ x0: cur, x1: len });
    return result;
  })();

  for (const seg of topSegs) {
    const f = makeTopFace(seg.x0, seg.x1);
    if (f) allFaces.push(f);
  }

  const end1x = wall.x1 + ox;
  const end1z = wall.y1;
  const bea = p(end1x + nx * half, baseY, end1z + nz * half);
  const beb = p(end1x - nx * half, baseY, end1z - nz * half);
  const tea = p(end1x + nx * half, baseY + wallH, end1z + nz * half);
  const teb = p(end1x - nx * half, baseY + wallH, end1z - nz * half);
  const avgE1 = (bea[2] + beb[2] + tea[2] + teb[2]) / 4;
  allFaces.push({
    pts: [[bea[0],bea[1]], [beb[0],beb[1]], [teb[0],teb[1]], [tea[0],tea[1]]],
    fill: mixColor(wallColor, lightEnd1, isSel, opacity),
    stroke: strokeC, lineWidth: lw, avgDepth: avgE1 + 2,
  });

  const end2x = wall.x2 + ox;
  const end2z = wall.y2;
  const bfa = p(end2x + nx * half, baseY, end2z + nz * half);
  const bfb = p(end2x - nx * half, baseY, end2z - nz * half);
  const tfa = p(end2x + nx * half, baseY + wallH, end2z + nz * half);
  const tfb = p(end2x - nx * half, baseY + wallH, end2z - nz * half);
  const avgE2 = (bfa[2] + bfb[2] + tfa[2] + tfb[2]) / 4;
  allFaces.push({
    pts: [[bfa[0],bfa[1]], [bfb[0],bfb[1]], [tfb[0],tfb[1]], [tfa[0],tfa[1]]],
    fill: mixColor(wallColor, lightEnd2, isSel, opacity),
    stroke: strokeC, lineWidth: lw, avgDepth: avgE2 + 2,
  });

  for (const o of openings) {
    const isDoor = o.type === 'door' || o.type === 'door-double' || o.type === 'door-arch';
    const isWindow = !isDoor;
    const ox0 = Math.max(0, o.position - o.width / 2);
    const ox1 = Math.min(len, o.position + o.width / 2);
    const oy0 = isDoor ? 0 : (o.sillHeight || 0.9);
    const oy1 = Math.min(wallH, oy0 + o.height);
    const glassColor = isDoor ? '#1a3a5a' : '#7dd3fc';
    const glassOpacity = isDoor ? 0.85 : 0.4;

    const gA0x = wall.x1 + ox + ux * ox0 + nx * half * 0.1;
    const gA0z = wall.y1 + uz * ox0 + nz * half * 0.1;
    const gA1x = wall.x1 + ox + ux * ox1 + nx * half * 0.1;
    const gA1z = wall.y1 + uz * ox1 + nz * half * 0.1;
    const p1 = p(gA0x, baseY + oy0, gA0z);
    const p2 = p(gA1x, baseY + oy0, gA1z);
    const p3 = p(gA1x, baseY + oy1, gA1z);
    const p4 = p(gA0x, baseY + oy1, gA0z);
    const avgFill = (p1[2] + p2[2] + p3[2] + p4[2]) / 4;

    allFaces.push({
      pts: [[p1[0],p1[1]], [p2[0],p2[1]], [p3[0],p3[1]], [p4[0],p4[1]]],
      fill: `rgba(${hexToRgb(glassColor).join(',')},${glassOpacity})`,
      fillGrad: isWindow ? {
        x0: p4[0], y0: p4[1], x1: p2[0], y1: p2[1],
        c0: `rgba(125,211,252,0.55)`,
        c1: `rgba(56,189,248,0.25)`,
      } : undefined,
      stroke: isDoor ? 'rgba(30,90,140,0.8)' : 'rgba(56,189,248,0.6)',
      lineWidth: isDoor ? 1.5 : 1,
      avgDepth: avgFill - 1,
    });

    if (isDoor) {
      const framePts: [number, number][] = [
        [p1[0],p1[1]], [p2[0],p2[1]], [p3[0],p3[1]], [p4[0],p4[1]]
      ];
      allFaces.push({
        pts: framePts,
        fill: 'rgba(0,0,0,0)',
        stroke: 'rgba(100,180,255,0.5)',
        lineWidth: 2,
        avgDepth: avgFill - 2,
      });
    }
  }

  const allPts = [
    p(wall.x1 + ox + nx * half, baseY + wallH, wall.y1 + nz * half),
    p(wall.x2 + ox + nx * half, baseY + wallH, wall.y2 + nz * half),
    p(wall.x1 + ox - nx * half, baseY + wallH, wall.y1 - nz * half),
    p(wall.x2 + ox - nx * half, baseY + wallH, wall.y2 - nz * half),
    p(wall.x1 + ox + nx * half, baseY, wall.y1 + nz * half),
    p(wall.x2 + ox + nx * half, baseY, wall.y2 + nz * half),
    p(wall.x1 + ox - nx * half, baseY, wall.y1 - nz * half),
    p(wall.x2 + ox - nx * half, baseY, wall.y2 - nz * half),
  ];
  drawn.push({
    id: wall.id, type: 'wall',
    minX: Math.min(...allPts.map(([x]) => x)),
    minY: Math.min(...allPts.map(([, y]) => y)),
    maxX: Math.max(...allPts.map(([x]) => x)),
    maxY: Math.max(...allPts.map(([, y]) => y)),
  });
}
