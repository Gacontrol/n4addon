import { useRef, useEffect, useCallback, useState } from 'react';
import { Building, Wall, WallOpening } from '../../types/building';

interface Props {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  onSelectRoom: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  highlightFloor: boolean;
  bgColor?: string;
}

interface Camera {
  rotX: number;
  rotY: number;
  zoom: number;
  panX: number;
  panY: number;
}

const UNIT = 42;

const SUN = normalize3({ x: -0.55, y: 0.8, z: 0.25 });
const SUN2 = normalize3({ x: 0.7, y: 0.4, z: -0.5 });

function normalize3(v: { x: number; y: number; z: number }) {
  const l = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function faceLight(nx: number, ny: number, nz: number): number {
  const d1 = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
  const d2 = Math.max(0, nx * SUN2.x + ny * SUN2.y + nz * SUN2.z);
  return 0.18 + 0.65 * d1 + 0.17 * d2;
}

function projectPt(x: number, y: number, z: number, cam: Camera, cx: number, cy: number): [number, number, number] {
  const cosY = Math.cos(cam.rotY), sinY = Math.sin(cam.rotY);
  const cosX = Math.cos(cam.rotX), sinX = Math.sin(cam.rotX);
  const rx = x * cosY + z * sinY;
  const ryPre = -x * sinY * sinX + y * cosX + z * cosY * sinX;
  const rz = x * sinY * cosX - y * sinX + z * cosY * cosX;
  const dist = 550 / cam.zoom;
  const depth = dist + rz;
  const persp = depth > 1 ? dist / depth : 1;
  return [
    cx + rx * persp * UNIT * cam.zoom + cam.panX,
    cy - ryPre * persp * UNIT * cam.zoom + cam.panY,
    depth,
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [148, 163, 184];
}

function applyLight(hex: string, lf: number, selected: boolean, alpha = 1.0): string {
  const [r, g, b] = hexToRgb(hex);
  const boost = selected ? 1.3 : 1.0;
  return `rgba(${Math.min(255, r * lf * boost | 0)},${Math.min(255, g * lf * boost | 0)},${Math.min(255, b * lf * boost | 0)},${alpha})`;
}

function gradColor(hex: string, lf: number, selected: boolean, alpha = 1.0): string {
  return applyLight(hex, lf, selected, alpha);
}

interface Face {
  pts: [number, number][];
  fill: string;
  grad?: { x0: number; y0: number; x1: number; y1: number; c0: string; c1: string };
  stroke: string;
  lw: number;
  depth: number;
}

interface HitTarget {
  id: string;
  type: 'room' | 'wall';
  poly: [number, number][];
}

function pointInPoly(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function BuildingCanvas3D({
  buildings, activeFloorId, selectedRoomId, selectedWallId,
  onSelectRoom, onSelectWall, highlightFloor, bgColor = '#0a1020',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<Camera>({ rotX: 0.55, rotY: 0.6, zoom: 1.0, panX: 0, panY: 0 });
  const camRef = useRef(cam);
  camRef.current = cam;

  const dragRef = useRef<{
    startX: number; startY: number;
    lastX: number; lastY: number;
    mode: 'rotate' | 'pan';
    moved: boolean;
  } | null>(null);
  const hitsRef = useRef<HitTarget[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    const [br, bg2, bb] = hexToRgb(bgColor);
    bg.addColorStop(0, `rgba(${Math.max(0,br-10)},${Math.max(0,bg2-10)},${Math.max(0,bb-10)},1)`);
    bg.addColorStop(1, `rgba(${Math.min(255,br+15)},${Math.min(255,bg2+15)},${Math.min(255,bb+15)},1)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const p = (x: number, y: number, z: number) => projectPt(x, y, z, cam, cx, cy);
    const allFaces: Face[] = [];
    const hits: HitTarget[] = [];

    let bldOffX = 0;
    for (const building of buildings) {
      const sorted = [...building.floors].sort((a, b) => a.level - b.level);
      const floorBaseY: Record<string, number> = {};
      let yAcc = 0;
      for (const fl of sorted) { floorBaseY[fl.id] = yAcc; yAcc += fl.height; }

      const allX: number[] = [];
      const allZ: number[] = [];
      for (const fl of building.floors) {
        for (const w of fl.walls) {
          allX.push(w.x1, w.x2);
          allZ.push(w.y1, w.y2);
        }
        for (const r of fl.rooms) {
          allX.push(r.x, r.x + r.width);
          allZ.push(r.y, r.y + r.depth);
        }
      }
      const minX = allX.length ? Math.min(...allX) - 0.5 : -1;
      const maxX = allX.length ? Math.max(...allX) + 0.5 : 9;
      const minZ = allZ.length ? Math.min(...allZ) - 0.5 : -1;
      const maxZ = allZ.length ? Math.max(...allZ) + 0.5 : 9;

      for (const floor of sorted) {
        const baseY = floorBaseY[floor.id];
        const flH = floor.height;
        const isActive = floor.id === activeFloorId;
        const alpha = !highlightFloor || isActive ? 1.0 : 0.15;
        const ox = bldOffX;

        const fc = floor.floorColor || '#1e3a5f';
        const [fr, fg, fb] = hexToRgb(fc);
        const floorAlpha = alpha * (isActive ? 0.92 : 0.45);
        const g0 = p(minX + ox, baseY, minZ), g1 = p(maxX + ox, baseY, minZ);
        const g2 = p(maxX + ox, baseY, maxZ), g3 = p(minX + ox, baseY, maxZ);
        const gDepth = (g0[2] + g1[2] + g2[2] + g3[2]) / 4;
        allFaces.push({
          pts: [[g0[0],g0[1]],[g1[0],g1[1]],[g2[0],g2[1]],[g3[0],g3[1]]],
          fill: `rgba(${fr},${fg},${fb},${floorAlpha})`,
          grad: isActive ? {
            x0: g0[0], y0: g0[1], x1: g2[0], y1: g2[1],
            c0: `rgba(${Math.min(255,fr+18)},${Math.min(255,fg+20)},${Math.min(255,fb+30)},${floorAlpha})`,
            c1: `rgba(${Math.max(0,fr-8)},${Math.max(0,fg-6)},${Math.max(0,fb-4)},${floorAlpha})`,
          } : undefined,
          stroke: `rgba(${fr},${fg},${fb},${alpha * 0.3})`,
          lw: 0.5, depth: gDepth + 60,
        });

        for (const room of floor.rooms) {
          const isSel = room.id === selectedRoomId;
          const rc = room.color;
          const rx = room.x + ox, ry = room.y, rw = room.width, rd = room.depth;
          const strokeC = isSel ? 'rgba(96,165,250,0.95)' : 'rgba(5,10,20,0.55)';
          const lw = isSel ? 1.5 : 0.4;

          const tfl = p(rx, baseY+flH, ry), tfr = p(rx+rw, baseY+flH, ry);
          const tbr = p(rx+rw, baseY+flH, ry+rd), tbl = p(rx, baseY+flH, ry+rd);
          const bfl = p(rx, baseY, ry), bfr = p(rx+rw, baseY, ry);
          const bbr = p(rx+rw, baseY, ry+rd), bbl = p(rx, baseY, ry+rd);
          const avgD = (tfl[2]+tfr[2]+tbr[2]+tbl[2])/4;

          const lTop = faceLight(0,1,0), lFront = faceLight(0,0,-1), lRight = faceLight(1,0,0);
          const lLeft = faceLight(-1,0,0), lBack = faceLight(0,0,1);

          allFaces.push({
            pts: [[tfl[0],tfl[1]],[tfr[0],tfr[1]],[tbr[0],tbr[1]],[tbl[0],tbl[1]]],
            fill: applyLight(rc, lTop, isSel),
            grad: { x0: tfl[0], y0: tfl[1], x1: tbr[0], y1: tbr[1], c0: gradColor(rc, lTop*1.12, isSel), c1: gradColor(rc, lTop*0.82, isSel) },
            stroke: strokeC, lw, depth: avgD - 12,
          });
          allFaces.push({ pts: [[bfl[0],bfl[1]],[bfr[0],bfr[1]],[tfr[0],tfr[1]],[tfl[0],tfl[1]]], fill: applyLight(rc, lFront, isSel), stroke: strokeC, lw, depth: avgD+2 });
          allFaces.push({ pts: [[bfr[0],bfr[1]],[bbr[0],bbr[1]],[tbr[0],tbr[1]],[tfr[0],tfr[1]]], fill: applyLight(rc, lRight, isSel), stroke: strokeC, lw, depth: avgD+3 });
          allFaces.push({ pts: [[bbl[0],bbl[1]],[bbr[0],bbr[1]],[tbr[0],tbr[1]],[tbl[0],tbl[1]]], fill: applyLight(rc, lBack, isSel), stroke: strokeC, lw, depth: avgD+4 });
          allFaces.push({ pts: [[bbl[0],bbl[1]],[bfl[0],bfl[1]],[tfl[0],tfl[1]],[tbl[0],tbl[1]]], fill: applyLight(rc, lLeft, isSel), stroke: strokeC, lw, depth: avgD+3 });

          const facePoly: [number, number][] = [[tfl[0],tfl[1]],[tfr[0],tfr[1]],[bfr[0],bfr[1]],[bfl[0],bfl[1]]];
          hits.push({ id: room.id, type: 'room', poly: facePoly });
        }

        for (const wall of floor.walls) {
          renderWall(wall, ox, baseY, flH, wall.id === selectedWallId, allFaces, hits, p, alpha);
        }
      }
      bldOffX += (maxX - minX) + 5;
    }

    allFaces.sort((a, b) => b.depth - a.depth);
    for (const face of allFaces) {
      if (face.pts.length < 3) continue;
      ctx.beginPath();
      face.pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();
      if (face.grad) {
        const g = face.grad;
        const gr = ctx.createLinearGradient(g.x0, g.y0, g.x1, g.y1);
        gr.addColorStop(0, g.c0);
        gr.addColorStop(1, g.c1);
        ctx.fillStyle = gr;
      } else {
        ctx.fillStyle = face.fill;
      }
      ctx.fill();
      ctx.strokeStyle = face.stroke;
      ctx.lineWidth = face.lw;
      ctx.stroke();
    }

    for (const building of buildings) {
      const sorted = [...building.floors].sort((a, b) => a.level - b.level);
      let yAccL = 0;
      let bOx = 0;
      for (const b of buildings) {
        if (b.id === building.id) break;
        const allXb: number[] = [];
        for (const fl of b.floors) { for (const w of fl.walls) { allXb.push(w.x1, w.x2); } for (const r of fl.rooms) { allXb.push(r.x, r.x + r.width); } }
        bOx += (allXb.length ? Math.max(...allXb) + 0.5 : 9) - (allXb.length ? Math.min(...allXb) - 0.5 : -1) + 5;
      }

      for (const floor of sorted) {
        const isActive = floor.id === activeFloorId;
        const fade = !highlightFloor || isActive ? 1 : 0.12;
        if (cam.zoom > 0.4) {
          for (const room of floor.rooms) {
            const lp = p(room.x + bOx + room.width / 2, yAccL + floor.height + 0.06, room.y + room.depth / 2);
            ctx.globalAlpha = fade;
            ctx.font = `bold ${Math.max(7, Math.min(12, 9 * cam.zoom))}px Inter,sans-serif`;
            ctx.fillStyle = room.id === selectedRoomId ? '#f1f5f9' : 'rgba(226,232,240,0.6)';
            ctx.textAlign = 'center';
            ctx.fillText(room.name, lp[0], lp[1]);
          }
        }

        const labelX = bOx + 0;
        const lp2 = p(labelX, yAccL + floor.height * 0.5, -0.5);
        ctx.globalAlpha = !highlightFloor || isActive ? 1 : 0.2;
        ctx.font = `${isActive ? 'bold ' : ''}${Math.max(8, 10 * cam.zoom)}px Inter,sans-serif`;
        ctx.fillStyle = isActive ? '#60a5fa' : 'rgba(148,163,184,0.4)';
        ctx.textAlign = 'right';
        ctx.fillText(floor.name, lp2[0] - 3, lp2[1]);
        yAccL += floor.height;
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    hitsRef.current = hits;
  }, [buildings, activeFloorId, selectedRoomId, selectedWallId, cam, highlightFloor, bgColor]);

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
      startX: e.clientX, startY: e.clientY,
      lastX: e.clientX, lastY: e.clientY,
      mode: isPan ? 'pan' : 'rotate',
      moved: false,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current || e.buttons === 0) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    const totalDx = e.clientX - dragRef.current.startX;
    const totalDy = e.clientY - dragRef.current.startY;
    if (Math.abs(totalDx) > 2 || Math.abs(totalDy) > 2) dragRef.current.moved = true;

    if (dragRef.current.mode === 'rotate') {
      setCam(c => ({
        ...c,
        rotY: c.rotY + dx * 0.007,
        rotX: Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, c.rotX - dy * 0.007)),
      }));
    } else {
      setCam(c => ({ ...c, panX: c.panX + dx, panY: c.panY + dy }));
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current && !dragRef.current.moved) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        let hit: HitTarget | null = null;
        for (let i = hitsRef.current.length - 1; i >= 0; i--) {
          if (pointInPoly(mx, my, hitsRef.current[i].poly)) { hit = hitsRef.current[i]; break; }
        }
        if (hit?.type === 'room') { onSelectRoom(hit.id); onSelectWall(null); }
        else if (hit?.type === 'wall') { onSelectWall(hit.id); onSelectRoom(null); }
        else { onSelectRoom(null); onSelectWall(null); }
      }
    }
    dragRef.current = null;
  }, [onSelectRoom, onSelectWall]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    setCam(c => ({ ...c, zoom: Math.max(0.1, Math.min(8, c.zoom * factor)) }));
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
        {([
          { label: 'Vorne', rotX: 0.02, rotY: 0 },
          { label: 'Seite', rotX: 0.02, rotY: Math.PI / 2 },
          { label: 'Oben', rotX: Math.PI / 2 - 0.05, rotY: 0 },
          { label: '3D', rotX: 0.55, rotY: 0.6 },
        ] as const).map(v => (
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
        <button onClick={() => setCam(c => ({ ...c, zoom: Math.min(8, c.zoom * 1.2) }))} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">+</button>
        <button onClick={() => setCam(c => ({ ...c, zoom: Math.max(0.1, c.zoom * 0.8) }))} className="w-7 h-7 bg-slate-700/80 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">−</button>
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
  flH: number,
  isSel: boolean,
  allFaces: Face[],
  hits: HitTarget[],
  p: (x: number, y: number, z: number) => [number, number, number],
  alpha: number,
) {
  const wallH = wall.height > 0 ? wall.height : flH;
  const dx = wall.x2 - wall.x1, dz = wall.y2 - wall.y1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return;

  const ux = dx / len, uz = dz / len;
  const nx = -dz / len, nz2 = dx / len;
  const half = (wall.thickness || 0.25) / 2;
  const wallColor = wall.color || '#94a3b8';
  const wallAlpha = (wall.opacity ?? 1) * alpha;
  const openings = wall.openings ?? [];

  const lA = faceLight(nx, 0, nz2);
  const lB = faceLight(-nx, 0, -nz2);
  const lTop = faceLight(0, 1, 0);
  const lE1 = faceLight(ux, 0, uz);
  const lE2 = faceLight(-ux, 0, -uz);
  const strokeC = isSel ? '#60a5fa' : 'rgba(4,8,16,0.45)';
  const lw = isSel ? 1.5 : 0.4;

  function segFaceA(p0: number, p1: number, y0: number, y1: number): Face | null {
    if (p1 <= p0 || y1 <= y0) return null;
    const a0x = wall.x1 + ox + ux * p0 + nx * half;
    const a0z = wall.y1 + uz * p0 + nz2 * half;
    const a1x = wall.x1 + ox + ux * p1 + nx * half;
    const a1z = wall.y1 + uz * p1 + nz2 * half;
    const bl = p(a0x, baseY+y0, a0z), br = p(a1x, baseY+y0, a1z);
    const tr = p(a1x, baseY+y1, a1z), tl = p(a0x, baseY+y1, a0z);
    const d = (bl[2]+br[2]+tr[2]+tl[2])/4;
    return {
      pts: [[bl[0],bl[1]],[br[0],br[1]],[tr[0],tr[1]],[tl[0],tl[1]]],
      fill: applyLight(wallColor, lA, isSel, wallAlpha),
      grad: { x0: tl[0], y0: tl[1], x1: bl[0], y1: bl[1], c0: gradColor(wallColor, lA*1.08, isSel, wallAlpha), c1: gradColor(wallColor, lA*0.78, isSel, wallAlpha) },
      stroke: strokeC, lw, depth: d,
    };
  }

  function segFaceB(p0: number, p1: number, y0: number, y1: number): Face | null {
    if (p1 <= p0 || y1 <= y0) return null;
    const b0x = wall.x1 + ox + ux * p0 - nx * half;
    const b0z = wall.y1 + uz * p0 - nz2 * half;
    const b1x = wall.x1 + ox + ux * p1 - nx * half;
    const b1z = wall.y1 + uz * p1 - nz2 * half;
    const bl = p(b0x, baseY+y0, b0z), br = p(b1x, baseY+y0, b1z);
    const tr = p(b1x, baseY+y1, b1z), tl = p(b0x, baseY+y1, b0z);
    const d = (bl[2]+br[2]+tr[2]+tl[2])/4;
    return {
      pts: [[bl[0],bl[1]],[br[0],br[1]],[tr[0],tr[1]],[tl[0],tl[1]]],
      fill: applyLight(wallColor, lB, isSel, wallAlpha),
      grad: { x0: tl[0], y0: tl[1], x1: bl[0], y1: bl[1], c0: gradColor(wallColor, lB*1.08, isSel, wallAlpha), c1: gradColor(wallColor, lB*0.78, isSel, wallAlpha) },
      stroke: strokeC, lw, depth: d+1,
    };
  }

  function topFace(p0: number, p1: number): Face | null {
    if (p1 <= p0) return null;
    const ax = wall.x1+ox+ux*p0, az = wall.y1+uz*p0;
    const bx = wall.x1+ox+ux*p1, bz = wall.y1+uz*p1;
    const t0a = p(ax+nx*half, baseY+wallH, az+nz2*half);
    const t1a = p(bx+nx*half, baseY+wallH, bz+nz2*half);
    const t1b = p(bx-nx*half, baseY+wallH, bz-nz2*half);
    const t0b = p(ax-nx*half, baseY+wallH, az-nz2*half);
    const d = (t0a[2]+t1a[2]+t1b[2]+t0b[2])/4;
    return { pts: [[t0a[0],t0a[1]],[t1a[0],t1a[1]],[t1b[0],t1b[1]],[t0b[0],t0b[1]]], fill: applyLight(wallColor, lTop, isSel, wallAlpha), stroke: strokeC, lw, depth: d-10 };
  }

  function buildSegs(oList: typeof openings): Array<{p0:number;p1:number;y0:number;y1:number}> {
    if (!oList.length) return [{p0:0,p1:len,y0:0,y1:wallH}];
    const sorted = [...oList].sort((a,b) => (a.position-a.width/2)-(b.position-b.width/2));
    const segs: Array<{p0:number;p1:number;y0:number;y1:number}> = [];
    let cur = 0;
    for (const o of sorted) {
      const ox0 = Math.max(0, o.position - o.width/2);
      const ox1 = Math.min(len, o.position + o.width/2);
      const isDoor = o.type === 'door' || o.type === 'door-double' || o.type === 'door-arch';
      const oy0 = isDoor ? 0 : (o.sillHeight || 0.9);
      const oy1 = Math.min(wallH, oy0 + o.height);
      if (ox0 > cur) segs.push({p0:cur,p1:ox0,y0:0,y1:wallH});
      if (oy0 > 0) segs.push({p0:ox0,p1:ox1,y0:0,y1:oy0});
      if (oy1 < wallH) segs.push({p0:ox0,p1:ox1,y0:oy1,y1:wallH});
      cur = ox1;
    }
    if (cur < len) segs.push({p0:cur,p1:len,y0:0,y1:wallH});
    return segs;
  }

  for (const seg of buildSegs(openings)) {
    const fa = segFaceA(seg.p0, seg.p1, seg.y0, seg.y1);
    const fb = segFaceB(seg.p0, seg.p1, seg.y0, seg.y1);
    if (fa) allFaces.push(fa);
    if (fb) allFaces.push(fb);
  }

  const topSegs = openings.length === 0 ? [{p0:0,p1:len}] : (() => {
    const sorted2 = [...openings].sort((a,b)=>(a.position-a.width/2)-(b.position-b.width/2));
    const r: Array<{p0:number;p1:number}> = [];
    let c = 0;
    for (const o of sorted2) {
      const ox0 = Math.max(0, o.position - o.width/2);
      const ox1 = Math.min(len, o.position + o.width/2);
      const isDoor = o.type==='door'||o.type==='door-double'||o.type==='door-arch';
      const oy1 = isDoor ? 0 : Math.min(wallH, (o.sillHeight||0.9)+o.height);
      if (ox0 > c) r.push({p0:c,p1:ox0});
      if (oy1 < wallH) r.push({p0:ox0,p1:ox1});
      c = ox1;
    }
    if (c < len) r.push({p0:c,p1:len});
    return r;
  })();
  for (const ts of topSegs) { const f = topFace(ts.p0, ts.p1); if (f) allFaces.push(f); }

  const e1x = wall.x1+ox, e1z = wall.y1;
  const be1a = p(e1x+nx*half, baseY, e1z+nz2*half), be1b = p(e1x-nx*half, baseY, e1z-nz2*half);
  const te1a = p(e1x+nx*half, baseY+wallH, e1z+nz2*half), te1b = p(e1x-nx*half, baseY+wallH, e1z-nz2*half);
  const dE1 = (be1a[2]+be1b[2]+te1a[2]+te1b[2])/4;
  allFaces.push({ pts: [[be1a[0],be1a[1]],[be1b[0],be1b[1]],[te1b[0],te1b[1]],[te1a[0],te1a[1]]], fill: applyLight(wallColor, lE1, isSel, wallAlpha), stroke: strokeC, lw, depth: dE1+2 });

  const e2x = wall.x2+ox, e2z = wall.y2;
  const be2a = p(e2x+nx*half, baseY, e2z+nz2*half), be2b = p(e2x-nx*half, baseY, e2z-nz2*half);
  const te2a = p(e2x+nx*half, baseY+wallH, e2z+nz2*half), te2b = p(e2x-nx*half, baseY+wallH, e2z-nz2*half);
  const dE2 = (be2a[2]+be2b[2]+te2a[2]+te2b[2])/4;
  allFaces.push({ pts: [[be2a[0],be2a[1]],[be2b[0],be2b[1]],[te2b[0],te2b[1]],[te2a[0],te2a[1]]], fill: applyLight(wallColor, lE2, isSel, wallAlpha), stroke: strokeC, lw, depth: dE2+2 });

  for (const o of openings) {
    const isDoor = o.type==='door'||o.type==='door-double'||o.type==='door-arch';
    const ox0 = Math.max(0, o.position - o.width/2);
    const ox1 = Math.min(len, o.position + o.width/2);
    const oy0 = isDoor ? 0 : (o.sillHeight||0.9);
    const oy1 = Math.min(wallH, oy0 + o.height);

    const posOffset = nx * half * 0.05;
    const px0 = wall.x1+ox + ux*ox0 + posOffset;
    const pz0 = wall.y1 + uz*ox0 + nz2 * half * 0.05;
    const px1 = wall.x1+ox + ux*ox1 + posOffset;
    const pz1 = wall.y1 + uz*ox1 + nz2 * half * 0.05;
    const pp1 = p(px0, baseY+oy0, pz0), pp2 = p(px1, baseY+oy0, pz1);
    const pp3 = p(px1, baseY+oy1, pz1), pp4 = p(px0, baseY+oy1, pz0);
    const dFill = (pp1[2]+pp2[2]+pp3[2]+pp4[2])/4;

    if (isDoor) {
      allFaces.push({
        pts: [[pp1[0],pp1[1]],[pp2[0],pp2[1]],[pp3[0],pp3[1]],[pp4[0],pp4[1]]],
        fill: `rgba(15,30,55,0.9)`,
        grad: { x0: pp4[0], y0: pp4[1], x1: pp3[0], y1: pp3[1], c0: 'rgba(20,50,90,0.9)', c1: 'rgba(8,15,30,0.95)' },
        stroke: 'rgba(80,160,240,0.6)', lw: 1.2, depth: dFill-2,
      });
      const frameW = 0.05 * (UNIT / UNIT);
      allFaces.push({ pts: [[pp1[0],pp1[1]],[pp2[0],pp2[1]],[pp3[0],pp3[1]],[pp4[0],pp4[1]]], fill: 'rgba(0,0,0,0)', stroke: 'rgba(120,190,255,0.45)', lw: 2.5, depth: dFill-3 });
    } else {
      allFaces.push({
        pts: [[pp1[0],pp1[1]],[pp2[0],pp2[1]],[pp3[0],pp3[1]],[pp4[0],pp4[1]]],
        fill: 'rgba(56,189,248,0.08)',
        grad: { x0: pp4[0], y0: pp4[1], x1: pp3[0], y1: pp3[1], c0: 'rgba(125,211,252,0.5)', c1: 'rgba(56,189,248,0.18)' },
        stroke: 'rgba(125,211,252,0.7)', lw: 1, depth: dFill-2,
      });
    }
  }

  const facePoly: [number, number][] = [
    [p(wall.x1+ox+nx*half, baseY+wallH, wall.y1+nz2*half)[0], p(wall.x1+ox+nx*half, baseY+wallH, wall.y1+nz2*half)[1]],
    [p(wall.x2+ox+nx*half, baseY+wallH, wall.y2+nz2*half)[0], p(wall.x2+ox+nx*half, baseY+wallH, wall.y2+nz2*half)[1]],
    [p(wall.x2+ox+nx*half, baseY, wall.y2+nz2*half)[0], p(wall.x2+ox+nx*half, baseY, wall.y2+nz2*half)[1]],
    [p(wall.x1+ox+nx*half, baseY, wall.y1+nz2*half)[0], p(wall.x1+ox+nx*half, baseY, wall.y1+nz2*half)[1]],
  ];
  hits.push({ id: wall.id, type: 'wall', poly: facePoly });
}
