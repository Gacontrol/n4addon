import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, CreditCard as Edit3, Check, X, MousePointer, Hexagon,
  Settings, Layers, ZoomIn, ZoomOut, Move,
  ChevronDown, ChevronRight, Eye, EyeOff,
} from 'lucide-react';
import { Building, Floor, Room, RoomType, Wall } from '../../types/building';

interface Point { x: number; y: number }

type EditorTool = 'select' | 'polygon' | 'move';

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  room: 'Zimmer', corridor: 'Korridor', staircase: 'Treppenhaus',
  elevator: 'Aufzug', bathroom: 'Bad/WC', kitchen: 'Küche',
  office: 'Büro', storage: 'Lager', garage: 'Garage', outdoor: 'Außenbereich',
};

const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  room: '#94a3b8', corridor: '#cbd5e1', staircase: '#fbbf24',
  elevator: '#60a5fa', bathroom: '#67e8f9', kitchen: '#86efac',
  office: '#7dd3fc', storage: '#d1d5db', garage: '#9ca3af', outdoor: '#6ee7b7',
};

const GRID_SIZE = 20;
const SCALE = 40;

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function snapVal(v: number): number {
  return snapToGrid(v * SCALE) / SCALE;
}

interface LayerVisibility {
  rooms: boolean;
  walls: boolean;
}

interface RoomEditorViewProps {
  building: Building;
  onUpdateBuilding: (b: Building) => void;
  onOpenRoom?: (roomId: string) => void;
  onConfigRoom?: (roomId: string) => void;
}

export function RoomEditorView({ building, onUpdateBuilding, onOpenRoom, onConfigRoom }: RoomEditorViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedFloorId, setSelectedFloorId] = useState<string>(building.floors[0]?.id ?? '');
  const [tool, setTool] = useState<EditorTool>('select');

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [pan, setPan] = useState<Point>({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const panOrigin = useRef<Point>({ x: 0, y: 0 });

  const [layers, setLayers] = useState<LayerVisibility>({ rooms: true, walls: true });
  const [showLayerPanel, setShowLayerPanel] = useState(false);

  // Drag state for polygon rooms (whole room move)
  const dragRoom = useRef<{
    roomId: string;
    origPoints: Point[];
    origX: number; origY: number;
    startSvgX: number; startSvgY: number;
  } | null>(null);

  // Drag state for individual polygon vertex
  const dragVertex = useRef<{
    roomId: string;
    vertexIndex: number;
    origPoints: Point[];
  } | null>(null);

  const activeFloor = building.floors.find(f => f.id === selectedFloorId);
  const rooms = activeFloor?.rooms ?? [];
  const walls = activeFloor?.walls ?? [];
  const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;

  // ---------- Coordinate transforms ----------
  const worldToSvg = useCallback((wx: number, wy: number): Point => ({
    x: wx * SCALE * zoom + pan.x,
    y: wy * SCALE * zoom + pan.y,
  }), [pan, zoom]);

  const svgToWorld = useCallback((sx: number, sy: number): Point => ({
    x: (sx - pan.x) / (SCALE * zoom),
    y: (sy - pan.y) / (SCALE * zoom),
  }), [pan, zoom]);

  const getSvgPoint = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const getSnappedWorld = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
    const svgPt = getSvgPoint(e);
    const world = svgToWorld(svgPt.x, svgPt.y);
    return { x: snapVal(world.x), y: snapVal(world.y) };
  }, [getSvgPoint, svgToWorld]);

  // ---------- Mouse events ----------
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svgPt = getSvgPoint(e);
    const world = svgToWorld(svgPt.x, svgPt.y);
    setMousePos({ x: snapVal(world.x), y: snapVal(world.y) });

    if (isPanning) {
      const dx = svgPt.x - panStart.current.x;
      const dy = svgPt.y - panStart.current.y;
      setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
      return;
    }

    if (dragVertex.current && activeFloor) {
      const world = svgToWorld(svgPt.x, svgPt.y);
      const snappedWorld = { x: snapVal(world.x), y: snapVal(world.y) };
      const newPoints = dragVertex.current.origPoints.map((p, i) =>
        i === dragVertex.current!.vertexIndex ? snappedWorld : p
      );
      const xs = newPoints.map(p => p.x);
      const ys = newPoints.map(p => p.y);
      const roomId = dragVertex.current.roomId;
      onUpdateBuilding({
        ...building,
        floors: building.floors.map(f =>
          f.id === activeFloor.id
            ? {
                ...f,
                rooms: f.rooms.map(r =>
                  r.id === roomId
                    ? { ...r, points: newPoints, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) }
                    : r
                ),
              }
            : f
        ),
        updatedAt: Date.now(),
      });
      // Update origPoints so next move is relative to new position
      dragVertex.current = { ...dragVertex.current, origPoints: newPoints };
      return;
    }

    if (dragRoom.current && activeFloor) {
      const dx = svgPt.x - dragRoom.current.startSvgX;
      const dy = svgPt.y - dragRoom.current.startSvgY;
      const dxWorld = dx / (SCALE * zoom);
      const dyWorld = dy / (SCALE * zoom);
      const snapDx = snapVal(dragRoom.current.origX + dxWorld) - dragRoom.current.origX;
      const snapDy = snapVal(dragRoom.current.origY + dyWorld) - dragRoom.current.origY;

      const newPoints = dragRoom.current.origPoints.map(p => ({
        x: p.x + snapDx,
        y: p.y + snapDy,
      }));
      const xs = newPoints.map(p => p.x);
      const ys = newPoints.map(p => p.y);

      onUpdateBuilding({
        ...building,
        floors: building.floors.map(f =>
          f.id === activeFloor.id
            ? {
                ...f,
                rooms: f.rooms.map(r =>
                  r.id === dragRoom.current!.roomId
                    ? { ...r, points: newPoints, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) }
                    : r
                ),
              }
            : f
        ),
        updatedAt: Date.now(),
      });
    }
  }, [getSvgPoint, svgToWorld, isPanning, activeFloor, building, onUpdateBuilding, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && tool === 'move')) {
      const svgPt = getSvgPoint(e);
      panStart.current = svgPt;
      panOrigin.current = { ...pan };
      setIsPanning(true);
      e.preventDefault();
    }
  }, [getSvgPoint, pan, tool]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    dragRoom.current = null;
    dragVertex.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(5, z * factor)));
  }, []);

  const getSvgPointFromAny = useCallback((e: React.MouseEvent): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ---------- Room mouse down (drag start) ----------
  const handleRoomMouseDown = useCallback((e: React.MouseEvent<SVGPolygonElement>, room: Room) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    if (!room.points || room.points.length < 3) return;
    const svgPt = getSvgPointFromAny(e);
    dragRoom.current = {
      roomId: room.id,
      origPoints: room.points.map(p => ({ ...p })),
      origX: room.x,
      origY: room.y,
      startSvgX: svgPt.x,
      startSvgY: svgPt.y,
    };
    setSelectedRoomId(room.id);
  }, [tool, getSvgPointFromAny]);

  // ---------- Vertex mouse down (drag vertex) ----------
  const handleVertexMouseDown = useCallback((e: React.MouseEvent<SVGCircleElement>, room: Room, vertexIndex: number) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    if (!room.points) return;
    dragVertex.current = {
      roomId: room.id,
      vertexIndex,
      origPoints: room.points.map(p => ({ ...p })),
    };
  }, [tool]);

  // ---------- Canvas click ----------
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || tool === 'move') return;
    const snapped = getSnappedWorld(e);

    if (tool === 'select') {
      setSelectedRoomId(null);
      return;
    }

    if (tool === 'polygon') {
      // Close polygon if clicking near first point
      if (drawingPoints.length >= 3) {
        const first = worldToSvg(drawingPoints[0].x, drawingPoints[0].y);
        const cur = worldToSvg(snapped.x, snapped.y);
        const dist = Math.hypot(cur.x - first.x, cur.y - first.y);
        if (dist < 14) {
          finishPolygonWithPoints(drawingPoints);
          return;
        }
      }
      setDrawingPoints(prev => [...prev, snapped]);
    }
  // finishPolygonWithPoints defined below — split to avoid circular dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanning, tool, drawingPoints, worldToSvg, getSnappedWorld]);

  const finishPolygonWithPoints = useCallback((pts: Point[]) => {
    if (pts.length < 3 || !activeFloor) return;
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const now = Date.now();
    const newRoom: Room = {
      id: `room-${now}`,
      name: `Raum ${rooms.length + 1}`,
      type: 'room',
      x: Math.min(...xs), y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      depth: Math.max(...ys) - Math.min(...ys),
      color: ROOM_TYPE_COLORS['room'],
      doors: [], windows: [],
      points: pts,
    };
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id
        ? { ...activeFloor, rooms: [...activeFloor.rooms, newRoom] }
        : f),
      updatedAt: now,
    });
    setDrawingPoints([]);
    setSelectedRoomId(newRoom.id);
    setTool('select');
  }, [activeFloor, building, onUpdateBuilding, rooms.length]);

  const finishPolygon = useCallback(() => {
    finishPolygonWithPoints(drawingPoints);
  }, [drawingPoints, finishPolygonWithPoints]);

  const cancelPolygon = useCallback(() => {
    setDrawingPoints([]);
    setTool('select');
  }, []);

  const deleteRoom = useCallback((roomId: string) => {
    if (!activeFloor) return;
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id
        ? { ...activeFloor, rooms: activeFloor.rooms.filter(r => r.id !== roomId) }
        : f),
      updatedAt: Date.now(),
    });
    setSelectedRoomId(null);
    setEditingRoom(null);
  }, [activeFloor, building, onUpdateBuilding]);

  const saveEditingRoom = useCallback(() => {
    if (!editingRoom || !activeFloor) return;
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id
        ? { ...activeFloor, rooms: activeFloor.rooms.map(r => r.id === editingRoom.id ? editingRoom : r) }
        : f),
      updatedAt: Date.now(),
    });
    setEditingRoom(null);
  }, [editingRoom, activeFloor, building, onUpdateBuilding]);

  const addFloor = useCallback(() => {
    const now = Date.now();
    const maxLevel = Math.max(...building.floors.map(f => f.level), -1);
    const newFloor: Floor = {
      id: `floor-${now}`,
      name: `Obergeschoss ${maxLevel + 1}`,
      level: maxLevel + 1,
      height: 3.0,
      rooms: [], walls: [], ducts: [], pipes: [], slabs: [],
      backgroundImage: null,
    };
    onUpdateBuilding({ ...building, floors: [...building.floors, newFloor], updatedAt: now });
    setSelectedFloorId(newFloor.id);
  }, [building, onUpdateBuilding]);

  useEffect(() => {
    if (!selectedFloorId && building.floors.length > 0) {
      setSelectedFloorId(building.floors[0].id);
    }
  }, [building.floors, selectedFloorId]);

  const getRoomPolygon = useCallback((room: Room): Point[] => {
    if (room.points && room.points.length >= 3) return room.points.map(p => worldToSvg(p.x, p.y));
    const { x, y, width, depth } = room;
    return [worldToSvg(x, y), worldToSvg(x + width, y), worldToSvg(x + width, y + depth), worldToSvg(x, y + depth)];
  }, [worldToSvg]);

  const getWallSvgPoints = useCallback((wall: Wall) => {
    const s = worldToSvg(wall.x1, wall.y1);
    const e = worldToSvg(wall.x2, wall.y2);
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    if (len === 0) return null;
    const dx = (e.x - s.x) / len;
    const dy = (e.y - s.y) / len;
    const t = wall.thickness * SCALE * zoom / 2;
    const nx = -dy * t, ny = dx * t;
    return {
      s, e,
      corners: [
        { x: s.x + nx, y: s.y + ny },
        { x: e.x + nx, y: e.y + ny },
        { x: e.x - nx, y: e.y - ny },
        { x: s.x - nx, y: s.y - ny },
      ],
    };
  }, [worldToSvg, zoom]);

  const canvasHeight = containerRef.current?.clientHeight ?? 600;
  const livePoint = worldToSvg(mousePos.x, mousePos.y);
  const currentDrawSvgPts = drawingPoints.map(p => worldToSvg(p.x, p.y));

  // Is cursor close to first drawing point?
  const nearFirstPoint = drawingPoints.length >= 3 && (() => {
    const first = currentDrawSvgPts[0];
    return Math.hypot(livePoint.x - first.x, livePoint.y - first.y) < 14;
  })();

  const toolDef = [
    { id: 'select', label: 'Auswählen', Icon: MousePointer },
    { id: 'move', label: 'Verschieben', Icon: Move },
    { id: 'polygon', label: 'Raum zeichnen', Icon: Hexagon },
  ] as const;

  return (
    <div className="flex h-full bg-slate-900 text-slate-200 overflow-hidden">
      {/* ── Left sidebar ── */}
      <div className="w-52 border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">

        {/* Floors */}
        <div className="p-3 border-b border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Etagen</h3>
          <div className="flex flex-col gap-0.5">
            {building.floors.slice().sort((a, b) => b.level - a.level).map(floor => (
              <button
                key={floor.id}
                onClick={() => { setSelectedFloorId(floor.id); setSelectedRoomId(null); setDrawingPoints([]); }}
                className={[
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition-all',
                  selectedFloorId === floor.id ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                <Layers size={11} />
                <span className="flex-1 truncate">{floor.name}</span>
                <span className="opacity-50 text-xs">E{floor.level}</span>
              </button>
            ))}
          </div>
          <button
            onClick={addFloor}
            className="mt-1.5 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          >
            <Plus size={11} /> Etage hinzufügen
          </button>
        </div>

        {/* Tools */}
        <div className="p-3 border-b border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Werkzeuge</h3>
          <div className="flex flex-col gap-0.5">
            {toolDef.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setTool(id as EditorTool);
                  if (id !== 'polygon') setDrawingPoints([]);
                }}
                className={[
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  tool === id ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Layer toggle */}
        <div className="p-3 border-b border-slate-700">
          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Ebenen
            {showLayerPanel ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          {showLayerPanel && (
            <div className="mt-2 flex flex-col gap-1">
              {(Object.keys(layers) as (keyof LayerVisibility)[]).map(k => (
                <button
                  key={k}
                  onClick={() => setLayers(l => ({ ...l, [k]: !l[k] }))}
                  className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors"
                >
                  {layers[k] ? <Eye size={11} className="text-sky-400" /> : <EyeOff size={11} className="text-slate-600" />}
                  {{ rooms: 'Räume', walls: 'Wände' }[k]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {rooms.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Räume ({rooms.length})
              </h3>
              <div className="flex flex-col gap-0.5">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => { setSelectedRoomId(room.id); setEditingRoom(null); }}
                    className={[
                      'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-all',
                      selectedRoomId === room.id ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700',
                    ].join(' ')}
                  >
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
                    <span className="flex-1 truncate">{room.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800 shrink-0">
          <span className="text-sm text-slate-300 font-medium truncate">
            {activeFloor?.name ?? 'Keine Etage'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-xs text-slate-500">
            {tool === 'polygon' && (drawingPoints.length === 0
              ? 'Klicken zum Starten'
              : `${drawingPoints.length} Punkte — Doppelklick oder erstem Punkt klicken zum Fertigstellen`)}
            {(tool === 'select' || tool === 'move') && 'Element anklicken zum Auswählen · Raum ziehen zum Verschieben'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.min(5, z * 1.2))} className="p-1 hover:bg-slate-700 rounded"><ZoomIn size={13} className="text-slate-400" /></button>
            <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} className="p-1 hover:bg-slate-700 rounded"><ZoomOut size={13} className="text-slate-400" /></button>
            {tool === 'polygon' && drawingPoints.length >= 3 && (
              <>
                <button onClick={finishPolygon} className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-xs text-white ml-1">
                  <Check size={12} /> Fertig
                </button>
                <button onClick={cancelPolygon} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300">
                  <X size={12} /> Abbrechen
                </button>
              </>
            )}
          </div>
        </div>

        <div ref={containerRef} className="flex-1 overflow-hidden relative">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className={[
              'w-full h-full select-none',
              tool === 'polygon' ? 'cursor-crosshair' : '',
              tool === 'move' ? 'cursor-grab' : '',
              isPanning ? 'cursor-grabbing' : '',
              tool === 'select' ? 'cursor-default' : '',
            ].join(' ')}
            onClick={handleCanvasClick}
            onDoubleClick={() => { if (tool === 'polygon' && drawingPoints.length >= 3) finishPolygon(); }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Grid */}
            <defs>
              <pattern id="re-grid-sm" width={SCALE * zoom} height={SCALE * zoom} patternUnits="userSpaceOnUse"
                x={pan.x % (SCALE * zoom)} y={pan.y % (SCALE * zoom)}>
                <path d={`M ${SCALE * zoom} 0 L 0 0 0 ${SCALE * zoom}`} fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <pattern id="re-grid-lg" width={SCALE * zoom * 5} height={SCALE * zoom * 5} patternUnits="userSpaceOnUse"
                x={pan.x % (SCALE * zoom * 5)} y={pan.y % (SCALE * zoom * 5)}>
                <rect width={SCALE * zoom * 5} height={SCALE * zoom * 5} fill="url(#re-grid-sm)" />
                <path d={`M ${SCALE * zoom * 5} 0 L 0 0 0 ${SCALE * zoom * 5}`} fill="none" stroke="#334155" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#0f172a" />
            <rect width="100%" height="100%" fill="url(#re-grid-lg)" />

            {/* ── Walls (read-only, from building data) ── */}
            {layers.walls && walls.map(wall => {
              const wp = getWallSvgPoints(wall);
              if (!wp) return null;
              const pts = wp.corners.map(p => `${p.x},${p.y}`).join(' ');
              return (
                <polygon
                  key={wall.id}
                  points={pts}
                  fill="#475569"
                  fillOpacity={0.6}
                  stroke="#64748b"
                  strokeWidth={1}
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

            {/* ── Rooms ── */}
            {layers.rooms && rooms.map(room => {
              const poly = getRoomPolygon(room);
              const pts = poly.map(p => `${p.x},${p.y}`).join(' ');
              const isSelected = room.id === selectedRoomId;
              const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
              const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
              const isPolygon = !!(room.points && room.points.length >= 3);
              return (
                <g key={room.id}>
                  <polygon
                    points={pts}
                    fill={room.color || '#94a3b8'}
                    fillOpacity={isSelected ? 0.45 : 0.2}
                    stroke={isSelected ? '#38bdf8' : (room.color || '#94a3b8')}
                    strokeWidth={isSelected ? 2 : 1}
                    className={isPolygon && tool === 'select' ? 'cursor-move' : 'cursor-pointer'}
                    onClick={e => {
                      e.stopPropagation();
                      if (tool === 'select') { setSelectedRoomId(room.id); setEditingRoom(null); }
                    }}
                    onMouseDown={isPolygon ? e => handleRoomMouseDown(e, room) : undefined}
                  />
                  {/* Vertex handles on selected polygon room — draggable */}
                  {isSelected && isPolygon && poly.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x} cy={p.y} r={6}
                      fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5}
                      className="cursor-crosshair"
                      style={{ pointerEvents: 'all' }}
                      onMouseDown={e => handleVertexMouseDown(e, room, i)}
                    />
                  ))}
                  {zoom >= 0.5 && (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fill={isSelected ? '#e2e8f0' : '#94a3b8'} fontSize={11 * zoom}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {room.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Polygon drawing preview */}
            {currentDrawSvgPts.length > 0 && (
              <g>
                <polygon
                  points={[...currentDrawSvgPts, livePoint].map(p => `${p.x},${p.y}`).join(' ')}
                  fill="#38bdf8" fillOpacity={0.12} stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5,3"
                  style={{ pointerEvents: 'none' }}
                />
                {currentDrawSvgPts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={4} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
                ))}
                <line
                  x1={currentDrawSvgPts[currentDrawSvgPts.length - 1]?.x}
                  y1={currentDrawSvgPts[currentDrawSvgPts.length - 1]?.y}
                  x2={livePoint.x} y2={livePoint.y}
                  stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5,3"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Snap-to-close indicator */}
                {nearFirstPoint && (
                  <circle
                    cx={currentDrawSvgPts[0].x} cy={currentDrawSvgPts[0].y}
                    r={12} fill="#38bdf8" fillOpacity={0.2} stroke="#38bdf8" strokeWidth={2}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            )}

            {/* Cursor position */}
            <text x={12} y={canvasHeight - 12} fill="#334155" fontSize={10} style={{ userSelect: 'none' }}>
              {mousePos.x.toFixed(2)}m, {mousePos.y.toFixed(2)}m
            </text>
          </svg>
        </div>
      </div>

      {/* ── Right panel: Room properties ── */}
      {selectedRoom && !editingRoom && (
        <div className="w-60 border-l border-slate-700 flex flex-col bg-slate-800 shrink-0">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Raum</h3>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setEditingRoom({ ...selectedRoom })} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Bearbeiten"><Edit3 size={13} /></button>
              <button onClick={() => onConfigRoom?.(selectedRoom.id)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Konfigurieren"><Settings size={13} /></button>
              <button onClick={() => deleteRoom(selectedRoom.id)} className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400" title="Löschen"><Trash2 size={13} /></button>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm shrink-0" style={{ background: selectedRoom.color || '#94a3b8' }} />
              <span className="text-sm font-medium text-white">{selectedRoom.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="bg-slate-700/50 rounded p-2"><p className="text-slate-400 mb-0.5">Typ</p><p className="text-slate-200 font-medium">{ROOM_TYPE_LABELS[selectedRoom.type]}</p></div>
              {selectedRoom.number && <div className="bg-slate-700/50 rounded p-2"><p className="text-slate-400 mb-0.5">Nummer</p><p className="text-slate-200 font-medium">{selectedRoom.number}</p></div>}
              <div className="bg-slate-700/50 rounded p-2"><p className="text-slate-400 mb-0.5">Datenpunkte</p><p className="text-slate-200 font-medium">{selectedRoom.bindings?.length ?? 0}</p></div>
              {selectedRoom.points && (
                <div className="bg-slate-700/50 rounded p-2"><p className="text-slate-400 mb-0.5">Ecken</p><p className="text-slate-200 font-medium">{selectedRoom.points.length}</p></div>
              )}
            </div>
            <p className="text-xs text-slate-500 text-center">Raum ziehen zum Verschieben</p>
            <button onClick={() => onOpenRoom?.(selectedRoom.id)} className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors">Raumseite öffnen</button>
            <button onClick={() => onConfigRoom?.(selectedRoom.id)} className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors">Datenpunkte konfigurieren</button>
          </div>
        </div>
      )}

      {/* ── Right panel: Edit Room ── */}
      {editingRoom && (
        <div className="w-60 border-l border-slate-700 flex flex-col bg-slate-800 shrink-0">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Raum bearbeiten</h3>
            <div className="flex gap-0.5">
              <button onClick={saveEditingRoom} className="p-1.5 hover:bg-slate-700 rounded text-sky-400"><Check size={13} /></button>
              <button onClick={() => setEditingRoom(null)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><X size={13} /></button>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto">
            <div><label className="text-xs text-slate-400 block mb-1">Name</label>
              <input type="text" value={editingRoom.name} onChange={e => setEditingRoom(r => r ? { ...r, name: e.target.value } : r)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Nummer</label>
              <input type="text" value={editingRoom.number ?? ''} onChange={e => setEditingRoom(r => r ? { ...r, number: e.target.value } : r)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500" placeholder="z.B. 1.01" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Typ</label>
              <select value={editingRoom.type} onChange={e => { const t = e.target.value as RoomType; setEditingRoom(r => r ? { ...r, type: t, color: ROOM_TYPE_COLORS[t] } : r); }}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500">
                {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="text-xs text-slate-400 block mb-1">Farbe</label>
              <div className="flex items-center gap-2">
                <input type="color" value={editingRoom.color || '#94a3b8'} onChange={e => setEditingRoom(r => r ? { ...r, color: e.target.value } : r)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-xs text-slate-400">{editingRoom.color}</span>
              </div></div>
          </div>
        </div>
      )}
    </div>
  );
}
