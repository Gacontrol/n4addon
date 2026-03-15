import { useRef, useEffect, useCallback, useState } from 'react';
import { Floor, Wall, Room, BuildingTool, BackgroundImage } from '../../types/building';

interface Props {
  floor: Floor;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  tool: BuildingTool;
  wallThickness: number;
  onAddWall: (x1: number, y1: number, x2: number, y2: number, thickness: number) => void;
  onSelectWall: (id: string | null) => void;
  onMoveWallPoint: (wallId: string, point: 'start' | 'end', x: number, y: number) => void;
  onMoveWall: (wallId: string, dx: number, dy: number) => void;
  onAddRoom: (x: number, y: number, width: number, depth: number) => void;
  onSelectRoom: (id: string | null) => void;
  onMoveRoom: (roomId: string, x: number, y: number) => void;
  onDeleteWall: (wallId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onSetBackground: (bg: BackgroundImage | null) => void;
}

const CELL = 40;
const SNAP = 0.25;
const SNAP_DIST = 0.4;
const ENDPOINT_SNAP_RADIUS = 0.5;

function snapTo(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(px, py, ax, ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return dist(px, py, ax + t * dx, ay + t * dy);
}

interface DrawingWall { x1: number; y1: number; x2: number; y2: number; }
interface DrawRect { startX: number; startY: number; endX: number; endY: number; }

const bgImageCache = new Map<string, HTMLImageElement>();

function loadBgImage(dataUrl: string): Promise<HTMLImageElement> {
  if (bgImageCache.has(dataUrl)) return Promise.resolve(bgImageCache.get(dataUrl)!);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { bgImageCache.set(dataUrl, img); resolve(img); };
    img.src = dataUrl;
  });
}

type DragType = 'pan' | 'draw-wall' | 'draw-room' | 'move-room' | 'move-wall-point' | 'move-wall' | 'move-bg';

export function FloorPlanEditor({
  floor, selectedRoomId, selectedWallId, tool, wallThickness,
  onAddWall, onSelectWall, onMoveWallPoint, onMoveWall,
  onAddRoom, onSelectRoom, onMoveRoom,
  onDeleteWall, onDeleteRoom, onSetBackground,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1.0);
  const [drawingWall, setDrawingWall] = useState<DrawingWall | null>(null);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgDragging, setBgDragging] = useState(false);
  const [snapPoint, setSnapPoint] = useState<{ x: number; y: number } | null>(null);
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragState = useRef<{
    type: DragType;
    startX: number;
    startY: number;
    roomId?: string;
    origX?: number;
    origY?: number;
    wallId?: string;
    point?: 'start' | 'end';
    wallOrigX1?: number;
    wallOrigY1?: number;
    wallOrigX2?: number;
    wallOrigY2?: number;
    bgOrigX?: number;
    bgOrigY?: number;
  } | null>(null);

  useEffect(() => {
    if (floor.backgroundImage?.dataUrl) {
      loadBgImage(floor.backgroundImage.dataUrl).then(img => setBgImg(img));
    } else {
      setBgImg(null);
    }
  }, [floor.backgroundImage?.dataUrl]);

  const toWorld = useCallback((px: number, py: number) => ({
    x: (px - offset.x) / (CELL * zoom),
    y: (py - offset.y) / (CELL * zoom),
  }), [offset, zoom]);

  const toScreen = useCallback((wx: number, wy: number) => ({
    x: wx * CELL * zoom + offset.x,
    y: wy * CELL * zoom + offset.y,
  }), [offset, zoom]);

  const getSnapPoint = useCallback((wx: number, wy: number): { x: number; y: number } => {
    let best = { x: snapTo(wx), y: snapTo(wy) };
    let bestDist = SNAP_DIST;
    for (const wall of floor.walls) {
      for (const pt of [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]) {
        const d = dist(wx, wy, pt.x, pt.y);
        if (d < bestDist) { bestDist = d; best = pt; }
      }
    }
    return best;
  }, [floor.walls]);

  const drawCornerJoins = useCallback((ctx: CanvasRenderingContext2D, cellPx: number) => {
    const walls = floor.walls;
    for (const w1 of walls) {
      for (const w2 of walls) {
        if (w1.id >= w2.id) continue;
        const pairs = [
          { p1: { x: w1.x1, y: w1.y1 }, p2: { x: w2.x1, y: w2.y1 } },
          { p1: { x: w1.x1, y: w1.y1 }, p2: { x: w2.x2, y: w2.y2 } },
          { p1: { x: w1.x2, y: w1.y2 }, p2: { x: w2.x1, y: w2.y1 } },
          { p1: { x: w1.x2, y: w1.y2 }, p2: { x: w2.x2, y: w2.y2 } },
        ];
        for (const { p1, p2 } of pairs) {
          if (dist(p1.x, p1.y, p2.x, p2.y) < Math.max(w1.thickness, w2.thickness) * 1.2) {
            const thickness1 = w1.thickness * CELL * zoom;
            const thickness2 = w2.thickness * CELL * zoom;
            const s = toScreen(p1.x, p1.y);
            const r = Math.max(thickness1, thickness2) / 2;
            ctx.beginPath();
            ctx.arc(s.x, s.y, r + 1, 0, Math.PI * 2);
            ctx.fillStyle = '#e2e8f0';
            ctx.fill();
          }
        }
      }
    }
  }, [floor.walls, zoom, toScreen]);

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

    if (floor.backgroundImage && bgImg) {
      const bg = floor.backgroundImage;
      ctx.save();
      ctx.globalAlpha = bg.opacity;
      const imgW = bgImg.width * bg.scale * zoom;
      const imgH = bgImg.height * bg.scale * zoom;
      const sx = bg.x * CELL * zoom + offset.x;
      const sy = bg.y * CELL * zoom + offset.y;
      ctx.translate(sx + imgW / 2, sy + imgH / 2);
      ctx.rotate((bg.rotation * Math.PI) / 180);
      ctx.drawImage(bgImg, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
      ctx.globalAlpha = 1;

      if (bgDragging) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(sx, sy, imgW, imgH);
        ctx.setLineDash([]);
      }
    }

    const startGX = Math.floor(-offset.x / cellPx) - 1;
    const startGY = Math.floor(-offset.y / cellPx) - 1;
    const endGX = Math.ceil((W - offset.x) / cellPx) + 1;
    const endGY = Math.ceil((H - offset.y) / cellPx) + 1;

    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 0.5;
    for (let gx = startGX; gx <= endGX; gx++) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = startGY; gy <= endGY; gy++) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    for (let gx = Math.floor(startGX / 5) * 5; gx <= endGX; gx += 5) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = Math.floor(startGY / 5) * 5; gy <= endGY; gy += 5) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    for (let gx = Math.floor(startGX / 5) * 5; gx <= endGX; gx += 5) {
      if (gx === 0) continue;
      const sx = gx * cellPx + offset.x;
      ctx.fillText(`${gx}m`, sx + 2, offset.y - 3);
    }
    for (let gy = Math.floor(startGY / 5) * 5; gy <= endGY; gy += 5) {
      if (gy === 0) continue;
      const sy = gy * cellPx + offset.y;
      ctx.fillText(`${gy}m`, offset.x + 2, sy - 3);
    }

    ctx.strokeStyle = 'rgba(59,130,246,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(offset.x, 0); ctx.lineTo(offset.x, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, offset.y); ctx.lineTo(W, offset.y); ctx.stroke();

    for (const room of floor.rooms) {
      const isSelected = room.id === selectedRoomId;
      const s = toScreen(room.x, room.y);
      const rw = room.width * cellPx;
      const rd = room.depth * cellPx;
      ctx.fillStyle = room.color + '22';
      ctx.fillRect(s.x, s.y, rw, rd);
      ctx.strokeStyle = isSelected ? '#60a5fa' : room.color + 'aa';
      ctx.lineWidth = isSelected ? 2 : 1;
      if (isSelected) { ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 5; }
      ctx.strokeRect(s.x, s.y, rw, rd);
      ctx.shadowBlur = 0;
      const fs = Math.max(9, Math.min(12, 10 * zoom));
      ctx.font = `${fs}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(226,232,240,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, s.x + rw / 2, s.y + rd / 2 + fs * 0.35);
      ctx.textAlign = 'left';
    }

    drawCornerJoins(ctx, cellPx);

    for (const wall of floor.walls) {
      const isSelected = wall.id === selectedWallId;
      const s1 = toScreen(wall.x1, wall.y1);
      const s2 = toScreen(wall.x2, wall.y2);
      const thickness = wall.thickness * CELL * zoom;

      const dx = s2.x - s1.x;
      const dy = s2.y - s1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.5) continue;
      const nx = (-dy / len) * thickness / 2;
      const ny = (dx / len) * thickness / 2;
      const wallLenWorld = dist(wall.x1, wall.y1, wall.x2, wall.y2);

      ctx.beginPath();
      ctx.moveTo(s1.x + nx, s1.y + ny);
      ctx.lineTo(s2.x + nx, s2.y + ny);
      ctx.lineTo(s2.x - nx, s2.y - ny);
      ctx.lineTo(s1.x - nx, s1.y - ny);
      ctx.closePath();

      let wallFill = isSelected ? '#93c5fd' : '#e2e8f0';
      if (wall.materialType === 'glass') wallFill = isSelected ? '#93c5fd' : 'rgba(125,211,252,0.5)';
      else if (wall.materialType === 'brick') wallFill = isSelected ? '#93c5fd' : '#c0a080';
      else if (wall.materialType === 'wood') wallFill = isSelected ? '#93c5fd' : '#c49a5c';

      ctx.globalAlpha = wall.opacity ?? 1;
      ctx.fillStyle = wallFill;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isSelected ? '#60a5fa' : '#334155';
      ctx.lineWidth = isSelected ? 2 : 1;
      if (isSelected) { ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 6; }
      ctx.stroke();
      ctx.shadowBlur = 0;

      for (const opening of (wall.openings ?? [])) {
        const t = opening.position / wallLenWorld;
        const hw = opening.width / 2;
        const t1 = Math.max(0, (opening.position - hw) / wallLenWorld);
        const t2 = Math.min(1, (opening.position + hw) / wallLenWorld);
        const ox1s = { x: s1.x + dx * t1, y: s1.y + dy * t1 };
        const ox2s = { x: s1.x + dx * t2, y: s1.y + dy * t2 };
        const isDoor = opening.type === 'door' || opening.type === 'door-double' || opening.type === 'door-arch';

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(ox1s.x + nx, ox1s.y + ny);
        ctx.lineTo(ox2s.x + nx, ox2s.y + ny);
        ctx.lineTo(ox2s.x - nx, ox2s.y - ny);
        ctx.lineTo(ox1s.x - nx, ox1s.y - ny);
        ctx.closePath();
        ctx.fillStyle = isDoor ? '#0f172a' : 'rgba(125,211,252,0.35)';
        ctx.fill();

        if (isDoor) {
          const doorRad = opening.width * CELL * zoom;
          const wallAngle = Math.atan2(dy, dx);
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(ox1s.x, ox1s.y);
          ctx.lineTo(ox1s.x + Math.cos(wallAngle) * doorRad, ox1s.y + Math.sin(wallAngle) * doorRad);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(ox1s.x, ox1s.y, doorRad, wallAngle, wallAngle + Math.PI / 2, false);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ox1s.x - nx * 0.5, ox1s.y - ny * 0.5);
          ctx.lineTo(ox2s.x - nx * 0.5, ox2s.y - ny * 0.5);
          ctx.stroke();

          const midX = (ox1s.x + ox2s.x) / 2;
          const midY = (ox1s.y + ox2s.y) / 2;
          ctx.beginPath();
          ctx.moveTo(midX + nx * 0.8, midY + ny * 0.8);
          ctx.lineTo(midX - nx * 0.8, midY - ny * 0.8);
          ctx.stroke();
        }
        ctx.restore();

        if (zoom > 0.7) {
          const label = isDoor ? 'T' : 'F';
          const lx = s1.x + dx * t;
          const ly = s1.y + dy * t;
          ctx.font = `bold ${Math.max(8, 8 * zoom)}px Inter, sans-serif`;
          ctx.fillStyle = isDoor ? '#60a5fa' : '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(label, lx, ly + 3);
        }
      }

      if (isSelected) {
        for (const pt of [{ x: s1.x, y: s1.y }, { x: s2.x, y: s2.y }]) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        const midX = (s1.x + s2.x) / 2;
        const midY = (s1.y + s2.y) / 2;
        ctx.beginPath();
        ctx.arc(midX, midY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const wlen = dist(wall.x1, wall.y1, wall.x2, wall.y2);
      if (wlen > 0.5 && zoom > 0.6) {
        const mx = (s1.x + s2.x) / 2;
        const my = (s1.y + s2.y) / 2;
        ctx.save();
        ctx.translate(mx, my);
        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
        ctx.rotate(angle);
        ctx.font = `${Math.max(9, 9 * zoom)}px Inter, sans-serif`;
        ctx.fillStyle = isSelected ? '#60a5fa' : 'rgba(148,163,184,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(`${wlen.toFixed(2)}m`, 0, -thickness / 2 - 4);
        ctx.restore();
      }
    }

    if (drawingWall) {
      const s1 = toScreen(drawingWall.x1, drawingWall.y1);
      const s2 = toScreen(drawingWall.x2, drawingWall.y2);
      const thickness = wallThickness * CELL * zoom;
      const dx = s2.x - s1.x;
      const dy = s2.y - s1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.5) {
        const nx = (-dy / len) * thickness / 2;
        const ny = (dx / len) * thickness / 2;
        ctx.beginPath();
        ctx.moveTo(s1.x + nx, s1.y + ny);
        ctx.lineTo(s2.x + nx, s2.y + ny);
        ctx.lineTo(s2.x - nx, s2.y - ny);
        ctx.lineTo(s1.x - nx, s1.y - ny);
        ctx.closePath();
        ctx.fillStyle = 'rgba(59,130,246,0.35)';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        const wlen = dist(drawingWall.x1, drawingWall.y1, drawingWall.x2, drawingWall.y2);
        const mx = (s1.x + s2.x) / 2;
        const my = (s1.y + s2.y) / 2;
        ctx.save();
        ctx.translate(mx, my);
        let angle = Math.atan2(dy, dx);
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
        ctx.rotate(angle);
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#60a5fa';
        ctx.textAlign = 'center';
        ctx.fillText(`${wlen.toFixed(2)}m`, 0, -thickness / 2 - 6);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(s1.x, s1.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
    }

    if (drawRect) {
      const x1 = Math.min(drawRect.startX, drawRect.endX);
      const y1 = Math.min(drawRect.startY, drawRect.endY);
      const x2 = Math.max(drawRect.startX, drawRect.endX);
      const y2 = Math.max(drawRect.startY, drawRect.endY);
      const s1 = toScreen(x1, y1);
      const s2 = toScreen(x2, y2);
      ctx.fillStyle = 'rgba(59,130,246,0.12)';
      ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
      ctx.setLineDash([]);
      if ((s2.x - s1.x) > 30 && (s2.y - s1.y) > 20) {
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#60a5fa';
        ctx.textAlign = 'center';
        ctx.fillText(`${snapTo(x2 - x1)}m × ${snapTo(y2 - y1)}m`, (s1.x + s2.x) / 2, (s1.y + s2.y) / 2);
        ctx.textAlign = 'left';
      }
    }

    if (snapPoint && (tool === 'wall' || tool === 'room')) {
      const sp = toScreen(snapPoint.x, snapPoint.y);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }

    if (mouseWorld && zoom > 0.5) {
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(148,163,184,0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(`${mouseWorld.x.toFixed(2)}m, ${mouseWorld.y.toFixed(2)}m`, W - 10, H - 10);
      ctx.textAlign = 'left';
    }

    ctx.textAlign = 'left';
  }, [
    floor.walls, floor.rooms, floor.backgroundImage,
    selectedRoomId, selectedWallId,
    offset, zoom, toScreen, drawingWall, drawRect, snapPoint,
    tool, wallThickness, bgImg, bgDragging, drawCornerJoins, mouseWorld,
  ]);

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

  const getCanvasPos = (e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (canvas.width / rect.width),
      py: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey || e.button === 2) {
      dragState.current = { type: 'pan', startX: e.clientX, startY: e.clientY };
      return;
    }
    const { px, py } = getCanvasPos(e);
    const world = toWorld(px, py);
    const snapped = getSnapPoint(world.x, world.y);

    if (tool === 'wall') {
      setDrawingWall({ x1: snapped.x, y1: snapped.y, x2: snapped.x, y2: snapped.y });
      dragState.current = { type: 'draw-wall', startX: e.clientX, startY: e.clientY };
      return;
    }

    if (tool === 'room') {
      dragState.current = { type: 'draw-room', startX: e.clientX, startY: e.clientY };
      setDrawRect({ startX: snapped.x, startY: snapped.y, endX: snapped.x + 4, endY: snapped.y + 3 });
      return;
    }

    if (tool === 'select' || tool === 'delete') {
      if (floor.backgroundImage && tool === 'select' && e.ctrlKey) {
        const bg = floor.backgroundImage;
        const bgImgEl = bgImageCache.get(bg.dataUrl);
        if (bgImgEl) {
          const imgW = bgImgEl.width * bg.scale;
          const imgH = bgImgEl.height * bg.scale;
          if (world.x >= bg.x && world.x <= bg.x + imgW && world.y >= bg.y && world.y <= bg.y + imgH) {
            setBgDragging(true);
            dragState.current = { type: 'move-bg', startX: e.clientX, startY: e.clientY, bgOrigX: bg.x, bgOrigY: bg.y };
            return;
          }
        }
      }

      for (const wall of [...floor.walls].reverse()) {
        const d = pointToSegmentDist(world.x, world.y, wall.x1, wall.y1, wall.x2, wall.y2);
        if (d < wall.thickness * 0.8 + 0.15) {
          if (tool === 'delete') { onDeleteWall(wall.id); return; }
          onSelectWall(wall.id);
          onSelectRoom(null);

          const distToStart = dist(world.x, world.y, wall.x1, wall.y1);
          const distToEnd = dist(world.x, world.y, wall.x2, wall.y2);
          const wallLen = dist(wall.x1, wall.y1, wall.x2, wall.y2);
          const midX = (wall.x1 + wall.x2) / 2;
          const midY = (wall.y1 + wall.y2) / 2;
          const distToMid = dist(world.x, world.y, midX, midY);

          if (distToStart < ENDPOINT_SNAP_RADIUS) {
            dragState.current = { type: 'move-wall-point', startX: e.clientX, startY: e.clientY, wallId: wall.id, point: 'start' };
          } else if (distToEnd < ENDPOINT_SNAP_RADIUS) {
            dragState.current = { type: 'move-wall-point', startX: e.clientX, startY: e.clientY, wallId: wall.id, point: 'end' };
          } else if (distToMid < Math.max(0.4, wallLen * 0.15)) {
            dragState.current = {
              type: 'move-wall', startX: e.clientX, startY: e.clientY,
              wallId: wall.id,
              wallOrigX1: wall.x1, wallOrigY1: wall.y1,
              wallOrigX2: wall.x2, wallOrigY2: wall.y2,
            };
          } else {
            dragState.current = { type: 'pan', startX: e.clientX, startY: e.clientY };
          }
          return;
        }
      }

      for (const room of [...floor.rooms].reverse()) {
        if (world.x >= room.x && world.x <= room.x + room.width && world.y >= room.y && world.y <= room.y + room.depth) {
          if (tool === 'delete') { onDeleteRoom(room.id); return; }
          onSelectRoom(room.id);
          onSelectWall(null);
          dragState.current = { type: 'move-room', startX: e.clientX, startY: e.clientY, roomId: room.id, origX: room.x, origY: room.y };
          return;
        }
      }

      onSelectWall(null);
      onSelectRoom(null);
    }
  }, [tool, floor.walls, floor.rooms, floor.backgroundImage, toWorld, getSnapPoint, onSelectWall, onSelectRoom, onDeleteWall, onDeleteRoom]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const { px, py } = getCanvasPos(e);
    const world = toWorld(px, py);
    const snapped = getSnapPoint(world.x, world.y);
    setMouseWorld({ x: world.x, y: world.y });

    if (tool === 'wall' || tool === 'room') {
      setSnapPoint(snapped);
    } else {
      setSnapPoint(null);
    }

    if (!dragState.current) return;

    if (dragState.current.type === 'pan') {
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      dragState.current.startX = e.clientX;
      dragState.current.startY = e.clientY;
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    } else if (dragState.current.type === 'draw-wall' && drawingWall) {
      setDrawingWall(w => w ? { ...w, x2: snapped.x, y2: snapped.y } : w);
    } else if (dragState.current.type === 'draw-room' && drawRect) {
      setDrawRect(r => r ? { ...r, endX: snapped.x, endY: snapped.y } : r);
    } else if (dragState.current.type === 'move-room' && dragState.current.roomId) {
      const dx = (e.clientX - dragState.current.startX) / (CELL * zoom);
      const dy = (e.clientY - dragState.current.startY) / (CELL * zoom);
      onMoveRoom(dragState.current.roomId, snapTo((dragState.current.origX ?? 0) + dx), snapTo((dragState.current.origY ?? 0) + dy));
    } else if (dragState.current.type === 'move-wall-point' && dragState.current.wallId) {
      onMoveWallPoint(dragState.current.wallId, dragState.current.point!, snapped.x, snapped.y);
    } else if (dragState.current.type === 'move-wall' && dragState.current.wallId) {
      const ddx = (e.clientX - dragState.current.startX) / (CELL * zoom);
      const ddy = (e.clientY - dragState.current.startY) / (CELL * zoom);
      const newX1 = snapTo((dragState.current.wallOrigX1 ?? 0) + ddx);
      const newY1 = snapTo((dragState.current.wallOrigY1 ?? 0) + ddy);
      const newX2 = snapTo((dragState.current.wallOrigX2 ?? 0) + ddx);
      const newY2 = snapTo((dragState.current.wallOrigY2 ?? 0) + ddy);
      onMoveWall(dragState.current.wallId, newX1 - (dragState.current.wallOrigX1 ?? 0), newY1 - (dragState.current.wallOrigY1 ?? 0));
      dragState.current.wallOrigX1 = newX1;
      dragState.current.wallOrigY1 = newY1;
      dragState.current.wallOrigX2 = newX2;
      dragState.current.wallOrigY2 = newY2;
      dragState.current.startX = e.clientX;
      dragState.current.startY = e.clientY;
    } else if (dragState.current.type === 'move-bg') {
      if (!floor.backgroundImage) return;
      const dx = (e.clientX - dragState.current.startX) / (CELL * zoom);
      const dy = (e.clientY - dragState.current.startY) / (CELL * zoom);
      onSetBackground({ ...floor.backgroundImage, x: (dragState.current.bgOrigX ?? 0) + dx, y: (dragState.current.bgOrigY ?? 0) + dy });
    }
  }, [drawingWall, drawRect, toWorld, getSnapPoint, zoom, onMoveRoom, onMoveWallPoint, onMoveWall, onSetBackground, floor.backgroundImage, tool]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const { px, py } = getCanvasPos(e);
    const world = toWorld(px, py);
    const snapped = getSnapPoint(world.x, world.y);

    if (dragState.current?.type === 'draw-wall' && drawingWall) {
      const wlen = dist(drawingWall.x1, drawingWall.y1, snapped.x, snapped.y);
      if (wlen > 0.1) {
        onAddWall(drawingWall.x1, drawingWall.y1, snapped.x, snapped.y, wallThickness);
      }
      setDrawingWall(null);
    } else if (dragState.current?.type === 'draw-room' && drawRect) {
      const x1 = snapTo(Math.min(drawRect.startX, drawRect.endX));
      const y1 = snapTo(Math.min(drawRect.startY, drawRect.endY));
      const x2 = snapTo(Math.max(drawRect.startX, drawRect.endX));
      const y2 = snapTo(Math.max(drawRect.startY, drawRect.endY));
      if (x2 - x1 >= 1 && y2 - y1 >= 1) onAddRoom(x1, y1, x2 - x1, y2 - y1);
      setDrawRect(null);
    } else if (dragState.current?.type === 'move-bg') {
      setBgDragging(false);
    }
    dragState.current = null;
  }, [drawingWall, drawRect, toWorld, getSnapPoint, onAddWall, onAddRoom, wallThickness]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { px, py } = getCanvasPos(e);
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom(z => {
      const nz = Math.max(0.15, Math.min(8, z * factor));
      setOffset(o => ({
        x: px - (px - o.x) * (nz / z),
        y: py - (py - o.y) * (nz / z),
      }));
      return nz;
    });
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        bgImageCache.set(dataUrl, img);
        setBgImg(img);
        const scale = Math.min(20 / img.width, 20 / img.height, 0.1);
        onSetBackground({ dataUrl, x: 0, y: 0, scale, opacity: 0.5, rotation: 0 });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onSetBackground]);

  const getCursor = () => {
    if (tool === 'wall' || tool === 'room') return 'crosshair';
    if (tool === 'delete') return 'not-allowed';
    return 'default';
  };

  const bg = floor.backgroundImage;

  return (
    <div className="relative w-full h-full">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 flex-wrap max-w-[calc(100%-100px)]">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600 rounded text-xs font-medium shadow-lg"
          title="Grundriss-Bild hochladen"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          Bild
        </button>
        {bg && (
          <>
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">
              <span className="text-slate-500">Deckkraft</span>
              <input type="range" min="0.05" max="1" step="0.05" value={bg.opacity}
                onChange={e => onSetBackground({ ...bg, opacity: parseFloat(e.target.value) })}
                className="w-16 h-1 accent-blue-500" />
              <span className="text-slate-400 w-7">{Math.round(bg.opacity * 100)}%</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">
              <span className="text-slate-500">Skala</span>
              <input type="range" min="0.005" max="0.5" step="0.001" value={bg.scale}
                onChange={e => onSetBackground({ ...bg, scale: parseFloat(e.target.value) })}
                className="w-16 h-1 accent-blue-500" />
              <span className="text-slate-400 w-10">{bg.scale.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">
              <span className="text-slate-500">Rot.</span>
              <input type="range" min="-180" max="180" step="1" value={bg.rotation}
                onChange={e => onSetBackground({ ...bg, rotation: parseInt(e.target.value) })}
                className="w-12 h-1 accent-blue-500" />
              <span className="text-slate-400 w-8">{bg.rotation}°</span>
            </div>
            <button onClick={() => onSetBackground(null)}
              className="px-2 py-1 bg-red-900/40 hover:bg-red-900/70 text-red-400 border border-red-800 rounded text-xs">✕</button>
          </>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: getCursor() }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          setSnapPoint(null);
          setMouseWorld(null);
          if (dragState.current?.type === 'draw-wall') setDrawingWall(null);
          if (dragState.current?.type === 'draw-room') setDrawRect(null);
          dragState.current = null;
          setBgDragging(false);
        }}
        onWheel={onWheel}
        onContextMenu={e => { e.preventDefault(); if (drawingWall) setDrawingWall(null); }}
      />

      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(8, z * 1.2))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">+</button>
        <button onClick={() => setZoom(z => Math.max(0.15, z * 0.8))} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center text-sm font-bold border border-slate-600">−</button>
        <button onClick={() => { setZoom(1); setOffset({ x: 80, y: 80 }); }} className="w-7 h-7 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center border border-slate-600" title="Zurücksetzen">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <div className="w-7 h-5 flex items-center justify-center text-[9px] text-slate-500 font-mono">{Math.round(zoom * 100)}%</div>
      </div>

      <div className="absolute bottom-3 left-3 text-slate-500 text-[10px] bg-slate-900/70 px-2 py-1 rounded">
        {tool === 'wall'
          ? 'Klicken + Ziehen: Wand · Rechtsklick: abbrechen'
          : tool === 'room'
          ? 'Klicken + Ziehen: Raum zeichnen'
          : tool === 'delete'
          ? 'Element anklicken zum Löschen'
          : 'Endpunkt/Mitte: Wand verschieben · Alt+Ziehen: Pan · Strg+Ziehen auf Bild: Bild verschieben'}
      </div>
    </div>
  );
}
