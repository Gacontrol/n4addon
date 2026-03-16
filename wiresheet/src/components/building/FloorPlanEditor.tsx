import { useRef, useEffect, useCallback, useState } from 'react';
import { Floor, Wall, Room, BuildingTool, BackgroundImage, Duct, Pipe, DuctType, PipeType, DuctShape, Slab, FloorLayers, DEFAULT_LAYERS } from '../../types/building';

export interface MultiSelection {
  wallIds: string[];
  roomIds: string[];
  ductIds: string[];
  pipeIds: string[];
}

interface Props {
  floor: Floor;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  selectedDuctId?: string | null;
  selectedPipeId?: string | null;
  tool: BuildingTool;
  wallThickness: number;
  ductType?: DuctType;
  ductShape?: DuctShape;
  ductWidth?: number;
  ductHeight?: number;
  pipeType?: PipeType;
  pipeDiameter?: number;
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
  onAddDuct?: (duct: Omit<Duct, 'id'>) => void;
  onSelectDuct?: (id: string | null) => void;
  onDeleteDuct?: (id: string) => void;
  onMoveDuctPoint?: (ductId: string, pointIndex: number, x: number, y: number) => void;
  onMoveDuct?: (ductId: string, dx: number, dy: number) => void;
  onMergeDucts?: (ductIds: string[]) => string | null;
  onSplitDuct?: (ductId: string, pointIndex: number) => void;
  onInsertDuctPoint?: (ductId: string, afterIndex: number, x: number, y: number) => void;
  onRemoveDuctPoint?: (ductId: string, pointIndex: number) => void;
  onAddPipe?: (pipe: Omit<Pipe, 'id'>) => void;
  onSelectPipe?: (id: string | null) => void;
  onDeletePipe?: (id: string) => void;
  onMovePipePoint?: (pipeId: string, pointIndex: number, x: number, y: number) => void;
  onMovePipe?: (pipeId: string, dx: number, dy: number) => void;
  onAddSlab?: (slab: Omit<Slab, 'id'>) => void;
  onDeleteSlab?: (slabId: string) => void;
  selectedSlabId?: string | null;
  onSelectSlab?: (id: string | null) => void;
  onAddPolygonRoom?: (points: { x: number; y: number }[]) => void;
  onSelectionChange?: (sel: MultiSelection) => void;
  onDeleteSelected?: (sel: MultiSelection) => void;
  onCopySelected?: (sel: MultiSelection) => void;
  onPasteClipboard?: () => void;
  onDuplicateSelected?: (sel: MultiSelection) => void;
  onPropertiesRequested?: () => void;
  onMoveMultiSelection?: (sel: MultiSelection, dx: number, dy: number) => void;
  gridSize?: number;
  forceMultiSel?: MultiSelection | null;
  layers?: FloorLayers;
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

function lineIntersect(ax: number, ay: number, adx: number, ady: number, bx: number, by: number, bdx: number, bdy: number): { x: number; y: number } | null {
  const denom = adx * bdy - ady * bdx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((bx - ax) * bdy - (by - ay) * bdx) / denom;
  return { x: ax + adx * t, y: ay + ady * t };
}

function buildDuctPolygon(pts: { x: number; y: number }[], halfW: number, halfH: number, toScreen: (wx: number, wy: number) => { x: number; y: number }): { left: { x: number; y: number }[]; right: { x: number; y: number }[] } {
  const n = pts.length;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? pts[i - 1] : null;
    const cur = pts[i];
    const next = i < n - 1 ? pts[i + 1] : null;

    if (i === 0 && next) {
      const dx = next.x - cur.x, dy = next.y - cur.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const nx = -dy / len * halfW, ny = dx / len * halfW;
      const sp = toScreen(cur.x, cur.y);
      const snx = toScreen(cur.x + nx, cur.y + ny);
      const lx = snx.x - sp.x, ly = snx.y - sp.y;
      left.push({ x: sp.x + lx, y: sp.y + ly });
      right.push({ x: sp.x - lx, y: sp.y - ly });
    } else if (i === n - 1 && prev) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const nx = -dy / len * halfW, ny = dx / len * halfW;
      const sp = toScreen(cur.x, cur.y);
      const snx = toScreen(cur.x + nx, cur.y + ny);
      const lx = snx.x - sp.x, ly = snx.y - sp.y;
      left.push({ x: sp.x + lx, y: sp.y + ly });
      right.push({ x: sp.x - lx, y: sp.y - ly });
    } else if (prev && next) {
      const dx1 = cur.x - prev.x, dy1 = cur.y - prev.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const dx2 = next.x - cur.x, dy2 = next.y - cur.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (len1 === 0 || len2 === 0) continue;

      const nx1 = -dy1 / len1, ny1 = dx1 / len1;
      const nx2 = -dy2 / len2, ny2 = dx2 / len2;

      const p1l = toScreen(prev.x + nx1 * halfW, prev.y + ny1 * halfW);
      const c1l = toScreen(cur.x + nx1 * halfW, cur.y + ny1 * halfW);
      const c2l = toScreen(cur.x + nx2 * halfW, cur.y + ny2 * halfW);
      const n1l = toScreen(next.x + nx2 * halfW, next.y + ny2 * halfW);

      const p1r = toScreen(prev.x - nx1 * halfW, prev.y - ny1 * halfW);
      const c1r = toScreen(cur.x - nx1 * halfW, cur.y - ny1 * halfW);
      const c2r = toScreen(cur.x - nx2 * halfW, cur.y - ny2 * halfW);
      const n1r = toScreen(next.x - nx2 * halfW, next.y - ny2 * halfW);

      const il = lineIntersect(p1l.x, p1l.y, c1l.x - p1l.x, c1l.y - p1l.y, n1l.x, n1l.y, c2l.x - n1l.x, c2l.y - n1l.y);
      const ir = lineIntersect(p1r.x, p1r.y, c1r.x - p1r.x, c1r.y - p1r.y, n1r.x, n1r.y, c2r.x - n1r.x, c2r.y - n1r.y);

      left.push(il ?? c1l);
      right.push(ir ?? c1r);
    }
  }
  return { left, right };
}

function drawDuctWithMiters(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  halfW: number,
  color: string,
  alpha: number,
  isSelected: boolean,
  toScreen: (wx: number, wy: number) => { x: number; y: number }
) {
  if (pts.length < 2) return;
  const { left, right } = buildDuctPolygon(pts, halfW, halfW, toScreen);
  if (left.length < 2) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = isSelected ? '#fff' : color;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = isSelected ? '#ffffff' : color;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
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
interface LassoRect { x1: number; y1: number; x2: number; y2: number; }

const bgImageCache = new Map<string, HTMLImageElement>();

function loadBgImage(dataUrl: string): Promise<HTMLImageElement> {
  if (bgImageCache.has(dataUrl)) return Promise.resolve(bgImageCache.get(dataUrl)!);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { bgImageCache.set(dataUrl, img); resolve(img); };
    img.src = dataUrl;
  });
}

type DragType = 'pan' | 'draw-wall' | 'draw-room' | 'move-room' | 'move-wall-point' | 'move-wall' | 'move-bg' | 'move-bg-corner' | 'calib-draw' | 'lasso' | 'move-multi' | 'move-duct' | 'move-duct-point' | 'move-pipe' | 'move-pipe-point';

const DUCT_TYPE_COLORS: Record<string, string> = {
  supply: '#60a5fa', return: '#94a3b8', exhaust: '#fbbf24', fresh: '#34d399',
};
const PIPE_TYPE_COLORS: Record<string, string> = {
  supply: '#ef4444', return: '#3b82f6', 'domestic-hot': '#f97316', 'domestic-cold': '#06b6d4', sprinkler: '#22c55e', gas: '#facc15',
};

interface ContextMenu {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  targetType: 'wall' | 'duct' | 'pipe' | 'room' | 'slab' | 'canvas' | null;
  targetId: string | null;
  targetPointIndex?: number;
  targetPointIsEndpoint?: boolean;
  targetSegmentIndex?: number;
  targetNearestEndpointDuctId?: string;
}

export function FloorPlanEditor({
  floor, selectedRoomId, selectedWallId, selectedDuctId, selectedPipeId,
  selectedSlabId, onSelectSlab,
  tool, wallThickness,
  ductType = 'supply', ductShape = 'rectangular', ductWidth = 0.3, ductHeight = 0.2,
  pipeType = 'supply', pipeDiameter = 0.05,
  onAddWall, onSelectWall, onMoveWallPoint, onMoveWall,
  onAddRoom, onSelectRoom, onMoveRoom,
  onDeleteWall, onDeleteRoom, onSetBackground,
  onAddDuct, onSelectDuct, onDeleteDuct, onMoveDuctPoint, onMoveDuct, onMergeDucts, onSplitDuct, onInsertDuctPoint, onRemoveDuctPoint,
  onAddPipe, onSelectPipe, onDeletePipe, onMovePipePoint, onMovePipe,
  onAddSlab, onDeleteSlab, onAddPolygonRoom,
  onSelectionChange, onDeleteSelected, onCopySelected, onPasteClipboard,
  onDuplicateSelected, onPropertiesRequested, onMoveMultiSelection,
  gridSize = 1,
  forceMultiSel,
  layers: layersProp,
}: Props) {
  const layers: FloorLayers = { ...DEFAULT_LAYERS, ...(layersProp ?? {}) };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [offset, setOffset] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1.0);
  const [drawingWall, setDrawingWall] = useState<DrawingWall | null>(null);
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);
  const [drawingPolyline, setDrawingPolyline] = useState<{ x: number; y: number }[]>([]);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgDragging, setBgDragging] = useState(false);
  const [bgCornerDragging, setBgCornerDragging] = useState<number | null>(null);
  const [bgCalibrating, setBgCalibrating] = useState(false);
  const [bgCalibLine, setBgCalibLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [bgCalibRefLen, setBgCalibRefLen] = useState(1.0);
  const [bgCalibDrawing, setBgCalibDrawing] = useState(false);
  const [snapPoint, setSnapPoint] = useState<{ x: number; y: number } | null>(null);
  const [mouseWorld, setMouseWorld] = useState<{ x: number; y: number } | null>(null);
  const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);
  const [multiSel, setMultiSel] = useState<MultiSelection>({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] });
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  useEffect(() => {
    if (forceMultiSel) setMultiSel(forceMultiSel);
  }, [forceMultiSel]);
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
    bgOrigScale?: number;
    bgOrigW?: number;
    bgOrigH?: number;
    bgCorner?: number;
    calibX1?: number;
    calibY1?: number;
    lassoX?: number;
    lassoY?: number;
    multiOrigWX?: number;
    multiOrigWY?: number;
    ductId?: string;
    ductPointIndex?: number;
    pipeId?: string;
    pipePointIndex?: number;
  } | null>(null);

  useEffect(() => {
    if (floor.backgroundImage?.dataUrl) {
      loadBgImage(floor.backgroundImage.dataUrl).then(img => setBgImg(img));
    } else {
      setBgImg(null);
    }
  }, [floor.backgroundImage?.dataUrl]);

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      if (dragState.current.type === 'move-bg') {
        if (!floor.backgroundImage) return;
        const dx = (e.clientX - dragState.current.startX) / (CELL * zoom);
        const dy = (e.clientY - dragState.current.startY) / (CELL * zoom);
        onSetBackground({ ...floor.backgroundImage, x: (dragState.current.bgOrigX ?? 0) + dx, y: (dragState.current.bgOrigY ?? 0) + dy });
      } else if (dragState.current.type === 'move-bg-corner') {
        if (!floor.backgroundImage || !bgImg) return;
        const corner = dragState.current.bgCorner ?? 0;
        const dx = (e.clientX - dragState.current.startX) / (CELL * zoom);
        const dy = (e.clientY - dragState.current.startY) / (CELL * zoom);
        const origX = dragState.current.bgOrigX ?? floor.backgroundImage.x;
        const origY = dragState.current.bgOrigY ?? floor.backgroundImage.y;
        const origScale = dragState.current.bgOrigScale ?? floor.backgroundImage.scale;
        const origW = bgImg.width * origScale;
        const origH = bgImg.height * origScale;
        let newX = floor.backgroundImage.x;
        let newY = floor.backgroundImage.y;
        let newScale = origScale;
        if (corner === 0) {
          const newW = Math.max(0.5, origW - dx);
          const newH = Math.max(0.5, origH - dy);
          newScale = Math.max(newW / bgImg.width, newH / bgImg.height);
          newX = origX + origW - bgImg.width * newScale;
          newY = origY + origH - bgImg.height * newScale;
        } else if (corner === 1) {
          const newW = Math.max(0.5, origW + dx);
          newScale = newW / bgImg.width;
          newY = origY + origH - bgImg.height * newScale;
        } else if (corner === 2) {
          const newW = Math.max(0.5, origW + dx);
          newScale = newW / bgImg.width;
        } else if (corner === 3) {
          const newW = Math.max(0.5, origW - dx);
          newScale = newW / bgImg.width;
          newX = origX + origW - bgImg.width * newScale;
        }
        onSetBackground({ ...floor.backgroundImage, x: newX, y: newY, scale: Math.max(0.001, newScale) });
      }
    };
    const handleGlobalUp = () => {
      if (dragState.current?.type === 'move-bg') {
        setBgDragging(false);
        dragState.current = null;
      } else if (dragState.current?.type === 'move-bg-corner') {
        setBgCornerDragging(null);
        dragState.current = null;
      }
    };
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [floor.backgroundImage, zoom, onSetBackground, bgImg]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasSel = multiSel.wallIds.length + multiSel.roomIds.length + multiSel.ductIds.length + multiSel.pipeIds.length > 0;
        if (hasSel) {
          onDeleteSelected?.(multiSel);
          setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] });
        } else {
          if (selectedWallId) onDeleteWall(selectedWallId);
          if (selectedRoomId) onDeleteRoom(selectedRoomId);
          if (selectedDuctId) onDeleteDuct?.(selectedDuctId);
          if (selectedPipeId) onDeletePipe?.(selectedPipeId);
          if (selectedSlabId) onDeleteSlab?.(selectedSlabId);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const sel: MultiSelection = multiSel.wallIds.length + multiSel.roomIds.length + multiSel.ductIds.length + multiSel.pipeIds.length > 0
          ? multiSel
          : {
            wallIds: selectedWallId ? [selectedWallId] : [],
            roomIds: selectedRoomId ? [selectedRoomId] : [],
            ductIds: selectedDuctId ? [selectedDuctId] : [],
            pipeIds: selectedPipeId ? [selectedPipeId] : [],
          };
        onCopySelected?.(sel);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        onPasteClipboard?.();
      }

      if (e.key === 'Escape') {
        setContextMenu(null);
        setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] });
        if (drawingWall) setDrawingWall(null);
        if (drawingPolyline.length > 0) setDrawingPolyline([]);
      }

      if (e.key === 'Enter' && tool === 'slab' && drawingPolyline.length >= 3) {
        onAddSlab?.({ points: drawingPolyline, color: '#64748b', opacity: 0.25 });
        setDrawingPolyline([]);
      }

      if (e.key === 'Enter' && tool === 'polygon-room' && drawingPolyline.length >= 3) {
        onAddPolygonRoom?.(drawingPolyline);
        setDrawingPolyline([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [multiSel, selectedWallId, selectedRoomId, selectedDuctId, selectedPipeId,
    onDeleteSelected, onDeleteWall, onDeleteRoom, onDeleteDuct, onDeletePipe,
    onCopySelected, onPasteClipboard, drawingWall, drawingPolyline, tool, onAddSlab, onAddPolygonRoom]);

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
    for (const slab of (floor.slabs ?? [])) {
      for (const pt of slab.points) {
        const d = dist(wx, wy, pt.x, pt.y);
        if (d < bestDist) { bestDist = d; best = pt; }
      }
    }
    return best;
  }, [floor.walls, floor.slabs]);

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
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const cellPx = CELL * zoom;

    if (layers.background && floor.backgroundImage && bgImg) {
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

      const showHandles = bgDragging || bgCornerDragging !== null || bgCalibrating;
      if (showHandles) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(sx, sy, imgW, imgH);
        ctx.setLineDash([]);
        const corners = [
          { x: sx, y: sy },
          { x: sx + imgW, y: sy },
          { x: sx + imgW, y: sy + imgH },
          { x: sx, y: sy + imgH },
        ];
        for (let ci = 0; ci < corners.length; ci++) {
          const c = corners[ci];
          ctx.beginPath();
          ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = bgCornerDragging === ci ? '#f59e0b' : '#1e293b';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      if (bgCalibrating && bgCalibLine) {
        const cl = bgCalibLine;
        ctx.beginPath();
        ctx.moveTo(cl.x1, cl.y1);
        ctx.lineTo(cl.x2, cl.y2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cl.x1, cl.y1, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cl.x2, cl.y2, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        const midX = (cl.x1 + cl.x2) / 2;
        const midY = (cl.y1 + cl.y2) / 2;
        const pxLen = Math.sqrt((cl.x2 - cl.x1) ** 2 + (cl.y2 - cl.y1) ** 2);
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText(`${pxLen.toFixed(0)}px = ${bgCalibRefLen}m`, midX, midY - 8);
        ctx.textAlign = 'left';
      }
    }

    const startGX = Math.floor(-offset.x / cellPx) - 1;
    const startGY = Math.floor(-offset.y / cellPx) - 1;
    const endGX = Math.ceil((W - offset.x) / cellPx) + 1;
    const endGY = Math.ceil((H - offset.y) / cellPx) + 1;

    const minorGrid = gridSize;
    const majorGrid = gridSize < 1 ? 1 : gridSize;

    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 0.5;
    const minorStartGX = Math.floor(startGX / minorGrid) * minorGrid;
    const minorStartGY = Math.floor(startGY / minorGrid) * minorGrid;
    for (let gx = minorStartGX; gx <= endGX; gx += minorGrid) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = minorStartGY; gy <= endGY; gy += minorGrid) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    for (let gx = Math.floor(startGX / majorGrid) * majorGrid; gx <= endGX; gx += majorGrid) {
      const sx = gx * cellPx + offset.x;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = Math.floor(startGY / majorGrid) * majorGrid; gy <= endGY; gy += majorGrid) {
      const sy = gy * cellPx + offset.y;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.35)';
    for (let gx = Math.floor(startGX / majorGrid) * majorGrid; gx <= endGX; gx += majorGrid) {
      if (gx === 0) continue;
      const sx = gx * cellPx + offset.x;
      ctx.fillText(`${gx}m`, sx + 2, offset.y - 3);
    }
    for (let gy = Math.floor(startGY / majorGrid) * majorGrid; gy <= endGY; gy += majorGrid) {
      if (gy === 0) continue;
      const sy = gy * cellPx + offset.y;
      ctx.fillText(`${gy}m`, offset.x + 2, sy - 3);
    }

    ctx.strokeStyle = 'rgba(59,130,246,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(offset.x, 0); ctx.lineTo(offset.x, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, offset.y); ctx.lineTo(W, offset.y); ctx.stroke();

    for (const slab of (floor.slabs ?? [])) {
      if (!layers.slabs) continue;
      const pts = slab.points;
      if (pts.length < 3) continue;
      const isSlabSelected = slab.id === selectedSlabId;
      const slabColor = slab.color ?? '#64748b';
      ctx.save();
      ctx.beginPath();
      const sp0s = toScreen(pts[0].x, pts[0].y);
      ctx.moveTo(sp0s.x, sp0s.y);
      for (let i = 1; i < pts.length; i++) {
        const spi = toScreen(pts[i].x, pts[i].y);
        ctx.lineTo(spi.x, spi.y);
      }
      ctx.closePath();
      ctx.globalAlpha = slab.opacity ?? 0.25;
      ctx.fillStyle = slabColor;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSlabSelected ? '#f59e0b' : slabColor + 'cc';
      ctx.lineWidth = isSlabSelected ? 2 : 1;
      ctx.setLineDash(isSlabSelected ? [] : [5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (isSlabSelected) {
        for (const pt of pts) {
          const sp = toScreen(pt.x, pt.y);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    for (const room of floor.rooms) {
      if (!layers.rooms) continue;
      const isSelected = room.id === selectedRoomId || multiSel.roomIds.includes(room.id);
      if (room.points && room.points.length >= 3) {
        const pts = room.points;
        const sp0 = toScreen(pts[0].x, pts[0].y);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sp0.x, sp0.y);
        for (let i = 1; i < pts.length; i++) {
          const spi = toScreen(pts[i].x, pts[i].y);
          ctx.lineTo(spi.x, spi.y);
        }
        ctx.closePath();
        ctx.fillStyle = room.color + '25';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#22c55e' : room.color + 'bb';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.setLineDash(isSelected ? [] : [5, 3]);
        if (isSelected) { ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 5; }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const sc = toScreen(cx, cy);
        const fs = Math.max(9, Math.min(12, 10 * zoom));
        ctx.font = `${fs}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(226,232,240,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(room.name, sc.x, sc.y + fs * 0.35);
        ctx.textAlign = 'left';
        if (isSelected) {
          for (const pt of pts) {
            const sp = toScreen(pt.x, pt.y);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#22c55e';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
        ctx.restore();
      } else {
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
    }

    drawCornerJoins(ctx, cellPx);

    for (const wall of floor.walls) {
      if (!layers.walls) continue;
      const isSelected = wall.id === selectedWallId || multiSel.wallIds.includes(wall.id);
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

    for (const duct of (floor.ducts ?? [])) {
      if (!layers.ducts) continue;
      const isSelected = duct.id === selectedDuctId || multiSel.ductIds.includes(duct.id);
      const color = duct.color || DUCT_TYPE_COLORS[duct.type] || '#60a5fa';
      const pts = duct.points;
      if (pts.length < 2) continue;
      const halfW = duct.width / 2;

      if (duct.isVertical && duct.verticalX != null) {
        const vx = duct.verticalX;
        const vy = pts[0].y;
        const sp = toScreen(vx, vy);
        const r = Math.max(duct.width * cellPx * 0.6, 10);
        ctx.save();
        ctx.globalAlpha = isSelected ? 1 : 0.8;
        ctx.strokeStyle = isSelected ? '#fff' : color;
        ctx.fillStyle = color + '33';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = isSelected ? '#fff' : color;
        ctx.lineWidth = isSelected ? 2 : 1.5;
        const a = r * 0.55;
        ctx.beginPath(); ctx.moveTo(sp.x - a, sp.y); ctx.lineTo(sp.x + a, sp.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y - a); ctx.lineTo(sp.x, sp.y + a); ctx.stroke();
        const ar = a * 0.4;
        ctx.beginPath(); ctx.moveTo(sp.x + a, sp.y); ctx.lineTo(sp.x + a - ar, sp.y - ar); ctx.moveTo(sp.x + a, sp.y); ctx.lineTo(sp.x + a - ar, sp.y + ar); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y - a); ctx.lineTo(sp.x - ar, sp.y - a + ar); ctx.moveTo(sp.x, sp.y - a); ctx.lineTo(sp.x + ar, sp.y - a + ar); ctx.stroke();
        if (zoom > 0.5) {
          ctx.fillStyle = color;
          ctx.font = `${Math.max(7, 7 * zoom)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(`${duct.width * 100 | 0}×${duct.height * 100 | 0}`, sp.x, sp.y + r + 9);
        }
        ctx.restore();
        continue;
      }

      if (duct.shape === 'round') {
        ctx.save();
        ctx.strokeStyle = isSelected ? '#fff' : color;
        ctx.lineWidth = isSelected ? duct.width * cellPx + 3 : duct.width * cellPx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        const sp0r = toScreen(pts[0].x, pts[0].y);
        ctx.moveTo(sp0r.x, sp0r.y);
        for (let i = 1; i < pts.length; i++) {
          const spi = toScreen(pts[i].x, pts[i].y);
          ctx.lineTo(spi.x, spi.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sp0r.x, sp0r.y);
        for (let i = 1; i < pts.length; i++) {
          const spi = toScreen(pts[i].x, pts[i].y);
          ctx.lineTo(spi.x, spi.y);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        drawDuctWithMiters(ctx, pts, halfW, color, 0.75, isSelected, toScreen);
      }

      if (duct.isTransition) {
        const sp0t = toScreen(pts[0].x, pts[0].y);
        const sp1t = toScreen(pts[pts.length - 1].x, pts[pts.length - 1].y);
        const cx = (sp0t.x + sp1t.x) / 2;
        const cy = (sp0t.y + sp1t.y) / 2;
        const transW = Math.max(duct.width, duct.transitionToWidth ?? duct.width) * cellPx;
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, transW * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(8, 8 * zoom)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⇄', cx, cy + 4);
        ctx.restore();
      }

      if (zoom > 0.5 && duct.label && !duct.isTransition) {
        const mid = toScreen((pts[0].x + pts[pts.length - 1].x) / 2, (pts[0].y + pts[pts.length - 1].y) / 2);
        ctx.font = `${Math.max(9, 9 * zoom)}px Inter, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(duct.label, mid.x, mid.y - 6);
      }
      if (isSelected) {
        for (const pt of pts) {
          const sp = toScreen(pt.x, pt.y);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    for (const pipe of (floor.pipes ?? [])) {
      if (!layers.pipes) continue;
      const isSelected = pipe.id === selectedPipeId || multiSel.pipeIds.includes(pipe.id);
      const color = pipe.color || PIPE_TYPE_COLORS[pipe.type] || '#ef4444';
      const pts = pipe.points;
      if (pts.length < 2) continue;
      const r = pipe.diameter * cellPx;
      ctx.save();
      ctx.strokeStyle = isSelected ? '#fff' : color;
      ctx.lineWidth = isSelected ? r + 3 : r;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      const sp0p = toScreen(pts[0].x, pts[0].y);
      ctx.moveTo(sp0p.x, sp0p.y);
      for (let i = 1; i < pts.length; i++) {
        const spi = toScreen(pts[i].x, pts[i].y);
        ctx.lineTo(spi.x, spi.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (pipe.insulated) {
        ctx.strokeStyle = color + '44';
        ctx.lineWidth = r + 6;
        ctx.beginPath();
        ctx.moveTo(sp0p.x, sp0p.y);
        for (let i = 1; i < pts.length; i++) {
          const spi = toScreen(pts[i].x, pts[i].y);
          ctx.lineTo(spi.x, spi.y);
        }
        ctx.stroke();
      }
      if (zoom > 0.5 && pipe.label) {
        const mid = toScreen((pts[0].x + pts[pts.length - 1].x) / 2, (pts[0].y + pts[pts.length - 1].y) / 2);
        ctx.font = `${Math.max(9, 9 * zoom)}px Inter, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(pipe.label, mid.x, mid.y - 6);
      }
      if (isSelected) {
        for (const pt of pts) {
          const sp = toScreen(pt.x, pt.y);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (drawingPolyline.length > 0 && mouseWorld && tool === 'slab') {
      const slabPreviewColor = '#f59e0b';
      ctx.save();
      ctx.strokeStyle = slabPreviewColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([6, 3]);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      const sfp = toScreen(drawingPolyline[0].x, drawingPolyline[0].y);
      ctx.moveTo(sfp.x, sfp.y);
      for (let i = 1; i < drawingPolyline.length; i++) {
        const spi = toScreen(drawingPolyline[i].x, drawingPolyline[i].y);
        ctx.lineTo(spi.x, spi.y);
      }
      const ms = toScreen(mouseWorld.x, mouseWorld.y);
      ctx.lineTo(ms.x, ms.y);
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = slabPreviewColor + '66';
      ctx.lineTo(sfp.x, sfp.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (drawingPolyline.length >= 3) {
        ctx.fillStyle = slabPreviewColor + '18';
        ctx.beginPath();
        ctx.moveTo(sfp.x, sfp.y);
        for (let i = 1; i < drawingPolyline.length; i++) {
          const spi = toScreen(drawingPolyline[i].x, drawingPolyline[i].y);
          ctx.lineTo(spi.x, spi.y);
        }
        ctx.lineTo(ms.x, ms.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const pt of drawingPolyline) {
        const sp = toScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = slabPreviewColor;
        ctx.fill();
      }
      const closeDist = dist(mouseWorld.x, mouseWorld.y, drawingPolyline[0].x, drawingPolyline[0].y);
      if (drawingPolyline.length >= 3 && closeDist < ENDPOINT_SNAP_RADIUS * 2) {
        ctx.beginPath();
        ctx.arc(sfp.x, sfp.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (drawingPolyline.length > 0 && mouseWorld && tool === 'polygon-room') {
      const roomPreviewColor = '#22c55e';
      ctx.save();
      ctx.strokeStyle = roomPreviewColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([6, 3]);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      const rfp = toScreen(drawingPolyline[0].x, drawingPolyline[0].y);
      ctx.moveTo(rfp.x, rfp.y);
      for (let i = 1; i < drawingPolyline.length; i++) {
        const spi = toScreen(drawingPolyline[i].x, drawingPolyline[i].y);
        ctx.lineTo(spi.x, spi.y);
      }
      const rms = toScreen(mouseWorld.x, mouseWorld.y);
      ctx.lineTo(rms.x, rms.y);
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = roomPreviewColor + '66';
      ctx.lineTo(rfp.x, rfp.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (drawingPolyline.length >= 3) {
        ctx.fillStyle = roomPreviewColor + '20';
        ctx.beginPath();
        ctx.moveTo(rfp.x, rfp.y);
        for (let i = 1; i < drawingPolyline.length; i++) {
          const spi = toScreen(drawingPolyline[i].x, drawingPolyline[i].y);
          ctx.lineTo(spi.x, spi.y);
        }
        ctx.lineTo(rms.x, rms.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const pt of drawingPolyline) {
        const sp = toScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = roomPreviewColor;
        ctx.fill();
      }
      const rCloseDist = dist(mouseWorld.x, mouseWorld.y, drawingPolyline[0].x, drawingPolyline[0].y);
      if (drawingPolyline.length >= 3 && rCloseDist < ENDPOINT_SNAP_RADIUS * 2) {
        ctx.beginPath();
        ctx.arc(rfp.x, rfp.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (drawingPolyline.length > 0 && mouseWorld && (tool === 'duct' || tool === 'pipe')) {
      const color = tool === 'duct' ? (DUCT_TYPE_COLORS[ductType] || '#60a5fa') : (PIPE_TYPE_COLORS[pipeType] || '#ef4444');
      const lineW = tool === 'duct' ? ductWidth * cellPx : pipeDiameter * cellPx;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(lineW, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([6, 3]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      const fp = toScreen(drawingPolyline[0].x, drawingPolyline[0].y);
      ctx.moveTo(fp.x, fp.y);
      for (let i = 1; i < drawingPolyline.length; i++) {
        const sp = toScreen(drawingPolyline[i].x, drawingPolyline[i].y);
        ctx.lineTo(sp.x, sp.y);
      }
      const ms = toScreen(mouseWorld.x, mouseWorld.y);
      ctx.lineTo(ms.x, ms.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      for (const pt of drawingPolyline) {
        const sp = toScreen(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.restore();
    }

    if (lassoRect) {
      const s1 = toScreen(Math.min(lassoRect.x1, lassoRect.x2), Math.min(lassoRect.y1, lassoRect.y2));
      const s2 = toScreen(Math.max(lassoRect.x1, lassoRect.x2), Math.max(lassoRect.y1, lassoRect.y2));
      ctx.fillStyle = 'rgba(59,130,246,0.08)';
      ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
      ctx.setLineDash([]);
    }

    if (snapPoint && (tool === 'wall' || tool === 'room' || tool === 'duct' || tool === 'pipe' || tool === 'slab')) {
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
    floor.walls, floor.rooms, floor.ducts, floor.pipes, floor.slabs, floor.backgroundImage,
    selectedRoomId, selectedWallId, selectedDuctId, selectedPipeId, selectedSlabId,
    multiSel,
    offset, zoom, toScreen, drawingWall, drawRect, drawingPolyline, snapPoint,
    tool, wallThickness, ductType, ductWidth, ductHeight, pipeType, pipeDiameter,
    bgImg, bgDragging, bgCornerDragging, bgCalibrating, bgCalibLine, bgCalibRefLen,
    drawCornerJoins, mouseWorld, lassoRect, layers,
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
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
    };
  };

  function pointInPolygon(x: number, y: number, pts: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  const hitTestWorld = useCallback((wx: number, wy: number) => {
    for (const slab of [...(floor.slabs ?? [])].reverse()) {
      if (slab.points.length >= 3 && pointInPolygon(wx, wy, slab.points)) {
        return { type: 'slab' as const, id: slab.id };
      }
    }
    for (const duct of [...(floor.ducts ?? [])].reverse()) {
      if (duct.isVertical && duct.verticalX != null) {
        const vx = duct.verticalX;
        const vy = duct.points[0]?.y ?? 0;
        const r = Math.max(duct.width * 0.6, 0.3);
        if (dist(wx, wy, vx, vy) < r) return { type: 'duct' as const, id: duct.id };
        continue;
      }
      for (let i = 0; i < duct.points.length - 1; i++) {
        const d = pointToSegmentDist(wx, wy, duct.points[i].x, duct.points[i].y, duct.points[i + 1].x, duct.points[i + 1].y);
        const threshold = Math.max(duct.width * 0.5 + 0.15, 0.25);
        if (d < threshold) return { type: 'duct' as const, id: duct.id };
      }
    }
    for (const pipe of [...(floor.pipes ?? [])].reverse()) {
      for (let i = 0; i < pipe.points.length - 1; i++) {
        const d = pointToSegmentDist(wx, wy, pipe.points[i].x, pipe.points[i].y, pipe.points[i + 1].x, pipe.points[i + 1].y);
        const threshold = Math.max(pipe.diameter * 0.5 + 0.15, 0.2);
        if (d < threshold) return { type: 'pipe' as const, id: pipe.id };
      }
    }
    for (const wall of [...floor.walls].reverse()) {
      const d = pointToSegmentDist(wx, wy, wall.x1, wall.y1, wall.x2, wall.y2);
      const threshold = Math.max(wall.thickness * 0.5 + 0.15, 0.25);
      if (d < threshold) return { type: 'wall' as const, id: wall.id };
    }
    for (const room of [...floor.rooms].reverse()) {
      if (wx >= room.x && wx <= room.x + room.width && wy >= room.y && wy <= room.y + room.depth) {
        return { type: 'room' as const, id: room.id };
      }
    }
    return null;
  }, [floor.ducts, floor.pipes, floor.walls, floor.rooms, floor.slabs]);

  const getLassoSelection = useCallback((r: LassoRect): MultiSelection => {
    const x1 = Math.min(r.x1, r.x2), x2 = Math.max(r.x1, r.x2);
    const y1 = Math.min(r.y1, r.y2), y2 = Math.max(r.y1, r.y2);

    const wallIds = floor.walls
      .filter(w => {
        const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
        return mx >= x1 && mx <= x2 && my >= y1 && my <= y2;
      })
      .map(w => w.id);

    const roomIds = floor.rooms
      .filter(r => r.x >= x1 && r.x + r.width <= x2 && r.y >= y1 && r.y + r.depth <= y2)
      .map(r => r.id);

    const ductIds = (floor.ducts ?? [])
      .filter(d => d.points.some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2))
      .map(d => d.id);

    const pipeIds = (floor.pipes ?? [])
      .filter(p => p.points.some(pt => pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2))
      .map(p => p.id);

    return { wallIds, roomIds, ductIds, pipeIds };
  }, [floor.walls, floor.rooms, floor.ducts, floor.pipes]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setContextMenu(null);

    if (e.button === 1 || e.altKey) {
      dragState.current = { type: 'pan', startX: e.clientX, startY: e.clientY };
      return;
    }

    if (e.button === 2) return;

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

    if (tool === 'duct' || tool === 'pipe') {
      setDrawingPolyline(prev => [...prev, { x: snapped.x, y: snapped.y }]);
      return;
    }

    if (tool === 'slab') {
      if (drawingPolyline.length >= 3) {
        const closeDist = dist(world.x, world.y, drawingPolyline[0].x, drawingPolyline[0].y);
        if (closeDist < ENDPOINT_SNAP_RADIUS * 2) {
          onAddSlab?.({ points: drawingPolyline, color: '#64748b', opacity: 0.25 });
          setDrawingPolyline([]);
          return;
        }
      }
      setDrawingPolyline(prev => [...prev, { x: snapped.x, y: snapped.y }]);
      return;
    }

    if (tool === 'polygon-room') {
      if (drawingPolyline.length >= 3) {
        const closeDist = dist(world.x, world.y, drawingPolyline[0].x, drawingPolyline[0].y);
        if (closeDist < ENDPOINT_SNAP_RADIUS * 2) {
          onAddPolygonRoom?.(drawingPolyline);
          setDrawingPolyline([]);
          return;
        }
      }
      setDrawingPolyline(prev => [...prev, { x: snapped.x, y: snapped.y }]);
      return;
    }

    if (tool === 'select' || tool === 'delete') {
      const hit = hitTestWorld(world.x, world.y);

      if (hit) {
        if (tool === 'delete') {
          if (hit.type === 'duct') onDeleteDuct?.(hit.id);
          else if (hit.type === 'pipe') onDeletePipe?.(hit.id);
          else if (hit.type === 'wall') onDeleteWall(hit.id);
          else if (hit.type === 'room') onDeleteRoom(hit.id);
          return;
        }

        const isInMultiSel = (
          (hit.type === 'wall' && multiSel.wallIds.includes(hit.id)) ||
          (hit.type === 'room' && multiSel.roomIds.includes(hit.id)) ||
          (hit.type === 'duct' && multiSel.ductIds.includes(hit.id)) ||
          (hit.type === 'pipe' && multiSel.pipeIds.includes(hit.id))
        );

        if (e.shiftKey) {
          const newSel = { ...multiSel };
          if (hit.type === 'wall') {
            newSel.wallIds = newSel.wallIds.includes(hit.id) ? newSel.wallIds.filter(x => x !== hit.id) : [...newSel.wallIds, hit.id];
          } else if (hit.type === 'room') {
            newSel.roomIds = newSel.roomIds.includes(hit.id) ? newSel.roomIds.filter(x => x !== hit.id) : [...newSel.roomIds, hit.id];
          } else if (hit.type === 'duct') {
            newSel.ductIds = newSel.ductIds.includes(hit.id) ? newSel.ductIds.filter(x => x !== hit.id) : [...newSel.ductIds, hit.id];
          } else if (hit.type === 'pipe') {
            newSel.pipeIds = newSel.pipeIds.includes(hit.id) ? newSel.pipeIds.filter(x => x !== hit.id) : [...newSel.pipeIds, hit.id];
          }
          setMultiSel(newSel);
          onSelectionChange?.(newSel);
          return;
        }

        if (isInMultiSel) {
          dragState.current = { type: 'move-multi', startX: e.clientX, startY: e.clientY, multiOrigWX: world.x, multiOrigWY: world.y };
          return;
        }

        setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] });

        if (hit.type === 'duct') {
          onSelectDuct?.(hit.id);
          onPropertiesRequested?.();
          const duct = floor.ducts?.find(d => d.id === hit.id);
          if (duct) {
            if (duct.isVertical && duct.verticalX != null) {
              dragState.current = { type: 'move-duct', startX: e.clientX, startY: e.clientY, ductId: hit.id };
            } else {
              let closestPtIdx = -1;
              let closestPtDist = ENDPOINT_SNAP_RADIUS;
              for (let pi = 0; pi < duct.points.length; pi++) {
                const pd = dist(world.x, world.y, duct.points[pi].x, duct.points[pi].y);
                if (pd < closestPtDist) { closestPtDist = pd; closestPtIdx = pi; }
              }
              if (closestPtIdx >= 0) {
                dragState.current = { type: 'move-duct-point', startX: e.clientX, startY: e.clientY, ductId: hit.id, ductPointIndex: closestPtIdx };
              } else {
                dragState.current = { type: 'move-duct', startX: e.clientX, startY: e.clientY, ductId: hit.id };
              }
            }
          } else {
            dragState.current = { type: 'pan', startX: e.clientX, startY: e.clientY };
          }
          return;
        }
        if (hit.type === 'pipe') {
          onSelectPipe?.(hit.id);
          onPropertiesRequested?.();
          const pipe = floor.pipes?.find(p => p.id === hit.id);
          if (pipe) {
            let closestPtIdx = -1;
            let closestPtDist = ENDPOINT_SNAP_RADIUS;
            for (let pi = 0; pi < pipe.points.length; pi++) {
              const pd = dist(world.x, world.y, pipe.points[pi].x, pipe.points[pi].y);
              if (pd < closestPtDist) { closestPtDist = pd; closestPtIdx = pi; }
            }
            if (closestPtIdx >= 0) {
              dragState.current = { type: 'move-pipe-point', startX: e.clientX, startY: e.clientY, pipeId: hit.id, pipePointIndex: closestPtIdx };
            } else {
              dragState.current = { type: 'move-pipe', startX: e.clientX, startY: e.clientY, pipeId: hit.id };
            }
          } else {
            dragState.current = { type: 'pan', startX: e.clientX, startY: e.clientY };
          }
          return;
        }
        if (hit.type === 'wall') {
          onSelectWall(hit.id);
          onPropertiesRequested?.();
          const wall = floor.walls.find(w => w.id === hit.id)!;
          const distToStart = dist(world.x, world.y, wall.x1, wall.y1);
          const distToEnd = dist(world.x, world.y, wall.x2, wall.y2);

          if (distToStart < ENDPOINT_SNAP_RADIUS) {
            dragState.current = { type: 'move-wall-point', startX: e.clientX, startY: e.clientY, wallId: hit.id, point: 'start' };
          } else if (distToEnd < ENDPOINT_SNAP_RADIUS) {
            dragState.current = { type: 'move-wall-point', startX: e.clientX, startY: e.clientY, wallId: hit.id, point: 'end' };
          } else {
            dragState.current = {
              type: 'move-wall', startX: e.clientX, startY: e.clientY,
              wallId: hit.id,
              wallOrigX1: wall.x1, wallOrigY1: wall.y1,
              wallOrigX2: wall.x2, wallOrigY2: wall.y2,
            };
          }
          return;
        }
        if (hit.type === 'room') {
          onSelectRoom(hit.id);
          onSelectWall(null);
          onPropertiesRequested?.();
          const room = floor.rooms.find(r => r.id === hit.id)!;
          dragState.current = { type: 'move-room', startX: e.clientX, startY: e.clientY, roomId: hit.id, origX: room.x, origY: room.y };
          return;
        }
        if (hit.type === 'slab') {
          onSelectSlab?.(hit.id);
          onPropertiesRequested?.();
          dragState.current = { type: 'pan', startX: e.clientX, startY: e.clientY };
          return;
        }
      }

      if (floor.backgroundImage && tool === 'select') {
        const bg = floor.backgroundImage;
        const bgImgEl = bgImageCache.get(bg.dataUrl);
        if (bgImgEl) {
          const imgW = bgImgEl.width * bg.scale;
          const imgH = bgImgEl.height * bg.scale;
          const corners = [
            { x: bg.x, y: bg.y },
            { x: bg.x + imgW, y: bg.y },
            { x: bg.x + imgW, y: bg.y + imgH },
            { x: bg.x, y: bg.y + imgH },
          ];
          const cornerRadius = 0.4 / zoom;
          let hitCorner = -1;
          for (let ci = 0; ci < corners.length; ci++) {
            const cdx = world.x - corners[ci].x;
            const cdy = world.y - corners[ci].y;
            if (Math.sqrt(cdx * cdx + cdy * cdy) < cornerRadius) { hitCorner = ci; break; }
          }

          if (bgCalibrating) {
            if (!bgCalibLine) {
              setBgCalibLine({ x1: px, y1: py, x2: px, y2: py });
              setBgCalibDrawing(true);
              dragState.current = { type: 'calib-draw', startX: e.clientX, startY: e.clientY, calibX1: px, calibY1: py };
            }
            return;
          }

          if (hitCorner >= 0) {
            setBgCornerDragging(hitCorner);
            dragState.current = {
              type: 'move-bg-corner', startX: e.clientX, startY: e.clientY,
              bgOrigX: bg.x, bgOrigY: bg.y, bgOrigScale: bg.scale,
              bgCorner: hitCorner,
            };
            return;
          }

          if (world.x >= bg.x && world.x <= bg.x + imgW && world.y >= bg.y && world.y <= bg.y + imgH) {
            setBgDragging(true);
            dragState.current = { type: 'move-bg', startX: e.clientX, startY: e.clientY, bgOrigX: bg.x, bgOrigY: bg.y };
            return;
          }
        }
      }

      onSelectWall(null);
      onSelectRoom(null);
      onSelectDuct?.(null);
      onSelectPipe?.(null);
      onSelectSlab?.(null);

      if (!e.shiftKey) setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] });

      dragState.current = { type: 'lasso', startX: e.clientX, startY: e.clientY, lassoX: world.x, lassoY: world.y };
      setLassoRect({ x1: world.x, y1: world.y, x2: world.x, y2: world.y });
    }
  }, [tool, floor.walls, floor.rooms, floor.ducts, floor.pipes, floor.slabs, floor.backgroundImage, toWorld, getSnapPoint,
    onSelectWall, onSelectRoom, onDeleteWall, onDeleteRoom,
    onSelectDuct, onDeleteDuct, onSelectPipe, onDeletePipe, onSelectSlab,
    drawingPolyline, ductShape, ductType, ductWidth, ductHeight, pipeType, pipeDiameter,
    onAddDuct, onAddPipe, onAddSlab, hitTestWorld, multiSel, onSelectionChange, onPropertiesRequested]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const { px, py } = getCanvasPos(e);
    const world = toWorld(px, py);
    const snapped = getSnapPoint(world.x, world.y);
    setMouseWorld({ x: world.x, y: world.y });

    if (tool === 'wall' || tool === 'room' || tool === 'duct' || tool === 'pipe' || tool === 'slab') {
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
    } else if (dragState.current.type === 'calib-draw') {
      const x1 = dragState.current.calibX1 ?? px;
      const y1 = dragState.current.calibY1 ?? py;
      setBgCalibLine({ x1, y1, x2: px, y2: py });
    } else if (dragState.current.type === 'lasso') {
      const lx = dragState.current.lassoX ?? world.x;
      const ly = dragState.current.lassoY ?? world.y;
      setLassoRect({ x1: lx, y1: ly, x2: world.x, y2: world.y });
    } else if (dragState.current.type === 'move-multi') {
      const origWX = dragState.current.multiOrigWX ?? world.x;
      const origWY = dragState.current.multiOrigWY ?? world.y;
      const ddx = snapTo(world.x - origWX);
      const ddy = snapTo(world.y - origWY);
      if (ddx !== 0 || ddy !== 0) {
        onMoveMultiSelection?.(multiSel, ddx, ddy);
        dragState.current.multiOrigWX = origWX + ddx;
        dragState.current.multiOrigWY = origWY + ddy;
      }
    } else if (dragState.current.type === 'move-duct-point' && dragState.current.ductId != null && dragState.current.ductPointIndex != null) {
      onMoveDuctPoint?.(dragState.current.ductId, dragState.current.ductPointIndex, snapped.x, snapped.y);
    } else if (dragState.current.type === 'move-duct' && dragState.current.ductId) {
      const ddx = (e.clientX - dragState.current.startX) / (CELL * zoom);
      const ddy = (e.clientY - dragState.current.startY) / (CELL * zoom);
      const sdx = snapTo(ddx);
      const sdy = snapTo(ddy);
      if (sdx !== 0 || sdy !== 0) {
        onMoveDuct?.(dragState.current.ductId, sdx, sdy);
        dragState.current.startX = e.clientX - (ddx - sdx) * CELL * zoom;
        dragState.current.startY = e.clientY - (ddy - sdy) * CELL * zoom;
      }
    } else if (dragState.current.type === 'move-pipe-point' && dragState.current.pipeId != null && dragState.current.pipePointIndex != null) {
      onMovePipePoint?.(dragState.current.pipeId, dragState.current.pipePointIndex, snapped.x, snapped.y);
    } else if (dragState.current.type === 'move-pipe' && dragState.current.pipeId) {
      const ddx = (e.clientX - dragState.current.startX) / (CELL * zoom);
      const ddy = (e.clientY - dragState.current.startY) / (CELL * zoom);
      const sdx = snapTo(ddx);
      const sdy = snapTo(ddy);
      if (sdx !== 0 || sdy !== 0) {
        onMovePipe?.(dragState.current.pipeId, sdx, sdy);
        dragState.current.startX = e.clientX - (ddx - sdx) * CELL * zoom;
        dragState.current.startY = e.clientY - (ddy - sdy) * CELL * zoom;
      }
    }
  }, [drawingWall, drawRect, toWorld, getSnapPoint, zoom, onMoveRoom, onMoveWallPoint, onMoveWall, onSetBackground, floor.backgroundImage, tool, drawingPolyline, multiSel, onMoveMultiSelection, onMoveDuctPoint, onMoveDuct, onMovePipePoint, onMovePipe]);

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
    } else if (dragState.current?.type === 'calib-draw') {
      setBgCalibDrawing(false);
    } else if (dragState.current?.type === 'lasso' && lassoRect) {
      const sel = getLassoSelection(lassoRect);
      const hasSel = sel.wallIds.length + sel.roomIds.length + sel.ductIds.length + sel.pipeIds.length > 0;
      if (hasSel) {
        setMultiSel(sel);
        onSelectionChange?.(sel);
      }
      setLassoRect(null);
    }
    dragState.current = null;
  }, [drawingWall, drawRect, toWorld, getSnapPoint, onAddWall, onAddRoom, wallThickness, lassoRect, getLassoSelection, onSelectionChange]);

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
        const scale = Math.min(30 / img.width, 30 / img.height, 0.5);
        onSetBackground({ dataUrl, x: 0, y: 0, scale, opacity: 0.5, rotation: 0 });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onSetBackground]);

  const getCursor = () => {
    if (tool === 'wall' || tool === 'room' || tool === 'polygon-room' || tool === 'duct' || tool === 'pipe' || tool === 'slab') return 'crosshair';
    if (tool === 'delete') return 'not-allowed';
    if (dragState.current?.type === 'lasso') return 'crosshair';
    return 'default';
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    if (tool === 'wall') { setDrawingWall(null); return; }
    if (tool === 'slab') {
      if (drawingPolyline.length >= 3) {
        onAddSlab?.({ points: drawingPolyline, color: '#64748b', opacity: 0.25 });
      }
      setDrawingPolyline([]);
      return;
    }
    if (tool === 'polygon-room') {
      if (drawingPolyline.length >= 3) {
        onAddPolygonRoom?.(drawingPolyline);
      }
      setDrawingPolyline([]);
      return;
    }
    if (tool === 'duct' || tool === 'pipe') {
      if (drawingPolyline.length >= 2) {
        if (tool === 'duct') {
          onAddDuct?.({ points: drawingPolyline, shape: ductShape, type: ductType, width: ductWidth, height: ductHeight, elevation: 2.4, insulated: false });
        } else {
          onAddPipe?.({ points: drawingPolyline, type: pipeType, diameter: pipeDiameter, elevation: 2.2, insulated: false });
        }
      }
      setDrawingPolyline([]);
      return;
    }

    if (tool !== 'select') return;

    const { px, py } = getCanvasPos(e);
    const world = toWorld(px, py);
    const hit = hitTestWorld(world.x, world.y);

    const POINT_HIT_RADIUS = 0.4;
    const ENDPOINT_HIT_RADIUS = 0.55;

    let targetPointIndex: number | undefined;
    let targetPointIsEndpoint = false;
    let targetSegmentIndex: number | undefined;
    let targetNearestEndpointDuctId: string | undefined;

    if (hit?.type === 'duct') {
      const duct = (floor.ducts ?? []).find(d => d.id === hit.id);
      if (duct) {
        let closestIdx = -1;
        let closestDist = Infinity;
        for (let i = 0; i < duct.points.length; i++) {
          const d = dist(world.x, world.y, duct.points[i].x, duct.points[i].y);
          if (d < closestDist && d < POINT_HIT_RADIUS) {
            closestDist = d;
            closestIdx = i;
          }
        }
        if (closestIdx >= 0) {
          targetPointIndex = closestIdx;
          targetPointIsEndpoint = closestIdx === 0 || closestIdx === duct.points.length - 1;
        } else {
          let closestSeg = -1;
          let closestSegDist = Infinity;
          for (let i = 0; i < duct.points.length - 1; i++) {
            const d = pointToSegmentDist(world.x, world.y, duct.points[i].x, duct.points[i].y, duct.points[i + 1].x, duct.points[i + 1].y);
            if (d < closestSegDist) { closestSegDist = d; closestSeg = i; }
          }
          if (closestSeg >= 0) targetSegmentIndex = closestSeg;
        }
      }
    }

    if (!hit || hit.type !== 'duct') {
      let nearestDist = Infinity;
      for (const duct of (floor.ducts ?? [])) {
        if (duct.points.length < 2) continue;
        for (const pt of [duct.points[0], duct.points[duct.points.length - 1]]) {
          const d = dist(world.x, world.y, pt.x, pt.y);
          if (d < ENDPOINT_HIT_RADIUS && d < nearestDist) {
            nearestDist = d;
            targetNearestEndpointDuctId = duct.id;
          }
        }
      }
    }

    const canvasRect = canvasRef.current!.getBoundingClientRect();
    setContextMenu({
      x: e.clientX - canvasRect.left,
      y: e.clientY - canvasRect.top,
      worldX: world.x,
      worldY: world.y,
      targetType: hit?.type ?? 'canvas',
      targetId: hit?.id ?? null,
      targetPointIndex,
      targetPointIsEndpoint,
      targetSegmentIndex,
      targetNearestEndpointDuctId,
    });
  }, [tool, drawingPolyline, drawingWall, toWorld, hitTestWorld, floor.ducts, ductShape, ductType, ductWidth, ductHeight, pipeType, pipeDiameter, onAddDuct, onAddPipe, onAddSlab, gridSize]);

  const bg = floor.backgroundImage;
  const totalMultiSel = multiSel.wallIds.length + multiSel.roomIds.length + multiSel.ductIds.length + multiSel.pipeIds.length;

  return (
    <div className="relative w-full h-full" onClick={() => setContextMenu(null)}>
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
            <button
              onClick={() => { setBgCalibrating(v => !v); setBgCalibLine(null); }}
              className={`flex items-center gap-1 px-2 py-1 border rounded text-xs ${bgCalibrating ? 'bg-red-800/70 text-red-200 border-red-600' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600'}`}
              title="Referenzlinie zeichnen und Massstab kalibrieren"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4"/>
              </svg>
              Kalibrieren
            </button>
            {bgCalibrating && (
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-red-700 rounded text-xs text-slate-300">
                {!bgCalibLine ? (
                  <span className="text-red-300 italic">Referenzlinie auf Bild zeichnen...</span>
                ) : (
                  <>
                    <span className="text-slate-500">Länge:</span>
                    <input
                      type="number" min="0.01" step="0.1"
                      value={bgCalibRefLen}
                      onChange={e => setBgCalibRefLen(parseFloat(e.target.value) || 1)}
                      className="w-16 bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white"
                    />
                    <span className="text-slate-500">m</span>
                    <button
                      onClick={() => {
                        if (!bgCalibLine || !bgImg) return;
                        const pxLen = Math.sqrt((bgCalibLine.x2 - bgCalibLine.x1) ** 2 + (bgCalibLine.y2 - bgCalibLine.y1) ** 2);
                        if (pxLen < 5) return;
                        const newScale = bg.scale * bgCalibRefLen * CELL * zoom / pxLen;
                        onSetBackground({ ...bg, scale: Math.max(0.001, newScale) });
                        setBgCalibrating(false);
                        setBgCalibLine(null);
                      }}
                      className="px-1.5 py-0.5 bg-green-700 hover:bg-green-600 text-white rounded text-[10px] font-medium"
                    >Übernehmen</button>
                    <button
                      onClick={() => setBgCalibLine(null)}
                      className="px-1.5 py-0.5 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded text-[10px]"
                    >Neu</button>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">
              <span className="text-slate-500">Deckkraft</span>
              <input type="range" min="0.05" max="1" step="0.05" value={bg.opacity}
                onChange={e => onSetBackground({ ...bg, opacity: parseFloat(e.target.value) })}
                className="w-20 h-1 accent-blue-500" />
              <span className="text-slate-400 w-7">{Math.round(bg.opacity * 100)}%</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">
              <span className="text-slate-500">Skala</span>
              <input type="range" min="0.001" max="10" step="0.001" value={bg.scale}
                onChange={e => onSetBackground({ ...bg, scale: parseFloat(e.target.value) })}
                className="w-24 h-1 accent-blue-500" />
              <span className="text-slate-400 w-12">{bg.scale.toFixed(3)}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">
              <span className="text-slate-500">Rot.</span>
              <input type="range" min="-180" max="180" step="1" value={bg.rotation}
                onChange={e => onSetBackground({ ...bg, rotation: parseInt(e.target.value) })}
                className="w-16 h-1 accent-blue-500" />
              <span className="text-slate-400 w-8">{bg.rotation}°</span>
            </div>
            <button onClick={() => { onSetBackground(null); setBgCalibrating(false); setBgCalibLine(null); }}
              className="px-2 py-1 bg-red-900/40 hover:bg-red-900/70 text-red-400 border border-red-800 rounded text-xs">✕</button>
          </>
        )}
      </div>

      {totalMultiSel > 0 && (
        <div className="absolute top-2 right-10 z-10 flex items-center gap-1.5 bg-blue-900/80 border border-blue-600 rounded px-2.5 py-1.5 text-xs text-blue-200">
          <span>{totalMultiSel} ausgewählt</span>
          <button
            onClick={() => { onDuplicateSelected?.(multiSel); setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] }); }}
            className="px-1.5 py-0.5 bg-blue-700 hover:bg-blue-600 rounded text-blue-100 text-[10px]"
            title="Duplizieren"
          >Duplizieren</button>
          <button
            onClick={() => { onDeleteSelected?.(multiSel); setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] }); }}
            className="px-1.5 py-0.5 bg-red-800 hover:bg-red-700 rounded text-red-200 text-[10px]"
            title="Löschen (Entf)"
          >Löschen</button>
          <button
            onClick={() => setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] })}
            className="text-blue-400 hover:text-white"
          >✕</button>
        </div>
      )}

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
          if (dragState.current?.type === 'lasso') setLassoRect(null);
          dragState.current = null;
          setBgDragging(false);
        }}
        onWheel={onWheel}
        onContextMenu={handleContextMenu}
      />

      {contextMenu && (
        <div
          className="absolute z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 min-w-36 text-xs"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.targetId && (
            <>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-slate-200 flex items-center gap-2"
                onClick={() => {
                  if (contextMenu.targetType === 'wall') { onSelectWall(contextMenu.targetId); onPropertiesRequested?.(); }
                  else if (contextMenu.targetType === 'duct') { onSelectDuct?.(contextMenu.targetId); onPropertiesRequested?.(); }
                  else if (contextMenu.targetType === 'pipe') { onSelectPipe?.(contextMenu.targetId); onPropertiesRequested?.(); }
                  else if (contextMenu.targetType === 'room') { onSelectRoom(contextMenu.targetId); onPropertiesRequested?.(); }
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Eigenschaften
              </button>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-slate-200 flex items-center gap-2"
                onClick={() => {
                  const sel: MultiSelection = {
                    wallIds: contextMenu.targetType === 'wall' ? [contextMenu.targetId!] : [],
                    roomIds: contextMenu.targetType === 'room' ? [contextMenu.targetId!] : [],
                    ductIds: contextMenu.targetType === 'duct' ? [contextMenu.targetId!] : [],
                    pipeIds: contextMenu.targetType === 'pipe' ? [contextMenu.targetId!] : [],
                  };
                  onCopySelected?.(sel);
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Kopieren
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-red-900/50 text-red-400 flex items-center gap-2"
                onClick={() => {
                  if (contextMenu.targetType === 'wall') onDeleteWall(contextMenu.targetId!);
                  else if (contextMenu.targetType === 'duct') onDeleteDuct?.(contextMenu.targetId!);
                  else if (contextMenu.targetType === 'pipe') onDeletePipe?.(contextMenu.targetId!);
                  else if (contextMenu.targetType === 'room') onDeleteRoom(contextMenu.targetId!);
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Löschen
              </button>
            </>
          )}
          {!contextMenu.targetId && (
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-slate-400 flex items-center gap-2"
              onClick={() => { onPasteClipboard?.(); setContextMenu(null); }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              Einfügen
            </button>
          )}
          {contextMenu.targetType === 'duct' && contextMenu.targetId && contextMenu.targetSegmentIndex != null && (
            <>
              <div className="border-t border-slate-700 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-900/50 text-emerald-400 flex items-center gap-2"
                onClick={() => {
                  const snap = (v: number) => Math.round(v / (gridSize || 0.25)) * (gridSize || 0.25);
                  onInsertDuctPoint?.(contextMenu.targetId!, contextMenu.targetSegmentIndex!, snap(contextMenu.worldX), snap(contextMenu.worldY));
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 5v4M12 15v4M5 12h4M15 12h4"/></svg>
                Knotenpunkt hinzufügen
              </button>
            </>
          )}
          {contextMenu.targetType === 'duct' && contextMenu.targetId && contextMenu.targetPointIndex != null && !contextMenu.targetPointIsEndpoint && (
            <>
              <div className="border-t border-slate-700 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-red-900/50 text-red-400 flex items-center gap-2"
                onClick={() => {
                  onRemoveDuctPoint?.(contextMenu.targetId!, contextMenu.targetPointIndex!);
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M5 12h14"/></svg>
                Knotenpunkt entfernen
              </button>
            </>
          )}
          {contextMenu.targetType === 'duct' && contextMenu.targetId && contextMenu.targetPointIndex != null && !contextMenu.targetPointIsEndpoint && (
            <>
              <div className="border-t border-slate-700 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-orange-900/50 text-orange-400 flex items-center gap-2"
                onClick={() => {
                  onSplitDuct?.(contextMenu.targetId!, contextMenu.targetPointIndex!);
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>
                Kanal trennen (Punkt {contextMenu.targetPointIndex})
              </button>
            </>
          )}
          {(multiSel.ductIds.length >= 2 || (contextMenu.targetNearestEndpointDuctId && contextMenu.targetType === 'duct' && contextMenu.targetId && contextMenu.targetId !== contextMenu.targetNearestEndpointDuctId)) && (
            <>
              <div className="border-t border-slate-700 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-blue-900/50 text-blue-400 flex items-center gap-2"
                onClick={() => {
                  const ids = multiSel.ductIds.length >= 2
                    ? multiSel.ductIds
                    : [contextMenu.targetId!, contextMenu.targetNearestEndpointDuctId!];
                  const newId = onMergeDucts?.(ids);
                  setMultiSel({ wallIds: [], roomIds: [], ductIds: newId ? [newId] : [], pipeIds: [] });
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
                {multiSel.ductIds.length >= 2 ? `Kanäle verbinden (${multiSel.ductIds.length})` : 'Kanäle verbinden'}
              </button>
            </>
          )}
          {totalMultiSel > 0 && (
            <>
              <div className="border-t border-slate-700 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-red-900/50 text-red-400 flex items-center gap-2"
                onClick={() => {
                  onDeleteSelected?.(multiSel);
                  setMultiSel({ wallIds: [], roomIds: [], ductIds: [], pipeIds: [] });
                  setContextMenu(null);
                }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Auswahl löschen ({totalMultiSel})
              </button>
            </>
          )}
        </div>
      )}

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
          : tool === 'duct'
          ? 'Klicken: Punkt setzen · Rechtsklick: Kanal abschließen'
          : tool === 'pipe'
          ? 'Klicken: Punkt setzen · Rechtsklick: Leitung abschließen'
          : 'Klick: auswählen · Shift+Klick: mehrfach · Ziehen: Lasso · Entf: löschen · Strg+C/V: kopieren'}
      </div>
    </div>
  );
}
