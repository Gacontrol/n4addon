import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, CreditCard as Edit3, Check, X, MousePointer, Hexagon,
  Settings, Layers, ZoomIn, ZoomOut, Move, Square, DoorOpen,
  Minus as WindowIcon, ChevronDown, ChevronRight, Eye, EyeOff,
} from 'lucide-react';
import { Building, Floor, Room, RoomType, Wall, WallOpening, WallOpeningType } from '../../types/building';

interface Point { x: number; y: number }

type EditorTool = 'select' | 'polygon' | 'move' | 'wall' | 'door' | 'window';

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

const WALL_MATERIAL_COLORS: Record<string, string> = {
  concrete: '#64748b',
  brick: '#b45309',
  wood: '#92400e',
  glass: '#38bdf8',
  drywall: '#94a3b8',
};

const GRID_SIZE = 20;
const SCALE = 40;
const DEFAULT_WALL_THICKNESS = 0.2;

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function snapVal(v: number): number {
  return snapToGrid(v * SCALE) / SCALE;
}

function wallLength(w: Wall): number {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

interface LayerVisibility {
  rooms: boolean;
  walls: boolean;
  openings: boolean;
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

  // Room state
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Wall state
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [editingWall, setEditingWall] = useState<Wall | null>(null);

  // Viewport
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [pan, setPan] = useState<Point>({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const panOrigin = useRef<Point>({ x: 0, y: 0 });

  // Layer visibility
  const [layers, setLayers] = useState<LayerVisibility>({ rooms: true, walls: true, openings: true });
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [wallThickness, setWallThickness] = useState(DEFAULT_WALL_THICKNESS);
  const [wallMaterial, setWallMaterial] = useState<Wall['materialType']>('concrete');

  const activeFloor = building.floors.find(f => f.id === selectedFloorId);
  const rooms = activeFloor?.rooms ?? [];
  const walls = activeFloor?.walls ?? [];
  const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;
  const selectedWall = walls.find(w => w.id === selectedWallId) ?? null;

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
    }
  }, [getSvgPoint, svgToWorld, isPanning]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && tool === 'move')) {
      const svgPt = getSvgPoint(e);
      panStart.current = svgPt;
      panOrigin.current = { ...pan };
      setIsPanning(true);
      e.preventDefault();
    }
  }, [getSvgPoint, pan, tool]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(5, z * factor)));
  }, []);

  // ---------- Canvas click ----------
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || tool === 'move') return;
    const snapped = getSnappedWorld(e);

    if (tool === 'select') {
      setSelectedRoomId(null);
      setSelectedWallId(null);
      return;
    }

    if (tool === 'polygon') {
      setDrawingPoints(prev => [...prev, snapped]);
      return;
    }

    if (tool === 'wall') {
      if (!wallStart) {
        setWallStart(snapped);
      } else {
        if (!activeFloor) return;
        const newWall: Wall = {
          id: `wall-${Date.now()}`,
          x1: wallStart.x, y1: wallStart.y,
          x2: snapped.x, y2: snapped.y,
          thickness: wallThickness,
          height: 3.0,
          color: WALL_MATERIAL_COLORS[wallMaterial],
          opacity: 1,
          materialType: wallMaterial,
          openings: [],
        };
        const updatedFloor = { ...activeFloor, walls: [...walls, newWall] };
        onUpdateBuilding({
          ...building,
          floors: building.floors.map(f => f.id === activeFloor.id ? updatedFloor : f),
          updatedAt: Date.now(),
        });
        setWallStart(snapped); // chain walls
        setSelectedWallId(newWall.id);
      }
      return;
    }

    if (tool === 'door' || tool === 'window') {
      const openingType: WallOpeningType = tool === 'door' ? 'door' : 'window';
      const hitWall = walls.find(w => {
        return distPointToSegment(snapped.x, snapped.y, w.x1, w.y1, w.x2, w.y2) < 0.4;
      });
      if (!hitWall || !activeFloor) return;
      const len = wallLength(hitWall);
      const dx = hitWall.x2 - hitWall.x1, dy = hitWall.y2 - hitWall.y1;
      const t = ((snapped.x - hitWall.x1) * dx + (snapped.y - hitWall.y1) * dy) / (len * len);
      const pos = Math.max(0.1, Math.min(0.9, t));
      const openingWidth = tool === 'door' ? 0.9 : 1.2;
      const newOpening: WallOpening = {
        id: `opening-${Date.now()}`,
        type: openingType,
        position: pos,
        width: openingWidth,
        height: tool === 'door' ? 2.1 : 1.2,
        sillHeight: tool === 'door' ? 0 : 0.9,
      };
      const updatedWall = { ...hitWall, openings: [...hitWall.openings, newOpening] };
      const updatedFloor = { ...activeFloor, walls: activeFloor.walls.map(w => w.id === hitWall.id ? updatedWall : w) };
      onUpdateBuilding({
        ...building,
        floors: building.floors.map(f => f.id === activeFloor.id ? updatedFloor : f),
        updatedAt: Date.now(),
      });
    }
  }, [isPanning, tool, wallStart, activeFloor, walls, wallThickness, wallMaterial, building, onUpdateBuilding, getSnappedWorld]);

  // ---------- Finish polygon ----------
  const finishPolygon = useCallback(() => {
    if (drawingPoints.length < 3 || !activeFloor) return;
    const xs = drawingPoints.map(p => p.x);
    const ys = drawingPoints.map(p => p.y);
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
      points: drawingPoints,
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
  }, [drawingPoints, activeFloor, building, onUpdateBuilding, rooms.length]);

  const cancelPolygon = useCallback(() => {
    setDrawingPoints([]);
    setTool('select');
  }, []);

  // ---------- Delete ----------
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

  const deleteWall = useCallback((wallId: string) => {
    if (!activeFloor) return;
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id
        ? { ...activeFloor, walls: activeFloor.walls.filter(w => w.id !== wallId) }
        : f),
      updatedAt: Date.now(),
    });
    setSelectedWallId(null);
    setEditingWall(null);
  }, [activeFloor, building, onUpdateBuilding]);

  const deleteOpening = useCallback((wallId: string, openingId: string) => {
    if (!activeFloor) return;
    const wall = walls.find(w => w.id === wallId);
    if (!wall) return;
    const updatedWall = { ...wall, openings: wall.openings.filter(o => o.id !== openingId) };
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id
        ? { ...activeFloor, walls: activeFloor.walls.map(w => w.id === wallId ? updatedWall : w) }
        : f),
      updatedAt: Date.now(),
    });
    if (editingWall?.id === wallId) setEditingWall(updatedWall);
  }, [activeFloor, walls, building, onUpdateBuilding, editingWall]);

  // ---------- Save edits ----------
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

  const saveEditingWall = useCallback(() => {
    if (!editingWall || !activeFloor) return;
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id
        ? { ...activeFloor, walls: activeFloor.walls.map(w => w.id === editingWall.id ? editingWall : w) }
        : f),
      updatedAt: Date.now(),
    });
    setEditingWall(null);
    setSelectedWallId(editingWall.id);
  }, [editingWall, activeFloor, building, onUpdateBuilding]);

  // ---------- Add floor ----------
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

  // ---------- Room polygon helper ----------
  const getRoomPolygon = useCallback((room: Room): Point[] => {
    if (room.points && room.points.length >= 3) return room.points.map(p => worldToSvg(p.x, p.y));
    const { x, y, width, depth } = room;
    return [worldToSvg(x, y), worldToSvg(x + width, y), worldToSvg(x + width, y + depth), worldToSvg(x, y + depth)];
  }, [worldToSvg]);

  // ---------- Wall SVG helpers ----------
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
      s, e, len,
      dx, dy, nx, ny,
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

  const toolDef = [
    { id: 'select', label: 'Auswählen', Icon: MousePointer, group: 'general' },
    { id: 'move', label: 'Verschieben', Icon: Move, group: 'general' },
    { id: 'polygon', label: 'Raum zeichnen', Icon: Hexagon, group: 'rooms' },
    { id: 'wall', label: 'Wand', Icon: Square, group: 'walls' },
    { id: 'door', label: 'Tür', Icon: DoorOpen, group: 'openings' },
    { id: 'window', label: 'Fenster', Icon: WindowIcon, group: 'openings' },
  ] as const;

  const toolGroups = [
    { label: 'Allgemein', ids: ['select', 'move'] },
    { label: 'Räume', ids: ['polygon'] },
    { label: 'Wände', ids: ['wall'] },
    { label: 'Öffnungen', ids: ['door', 'window'] },
  ];

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
                onClick={() => { setSelectedFloorId(floor.id); setSelectedRoomId(null); setSelectedWallId(null); setDrawingPoints([]); setWallStart(null); }}
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
          <div className="flex flex-col gap-2">
            {toolGroups.map(group => (
              <div key={group.label}>
                <p className="text-xs text-slate-600 mb-1 px-1">{group.label}</p>
                <div className="flex flex-col gap-0.5">
                  {toolDef.filter(t => group.ids.includes(t.id)).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => {
                        setTool(id as EditorTool);
                        if (id !== 'polygon') setDrawingPoints([]);
                        if (id !== 'wall') setWallStart(null);
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
            ))}
          </div>
        </div>

        {/* Wall settings (only visible when wall tool) */}
        {tool === 'wall' && (
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wand-Einstellungen</h3>
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Dicke (m)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1"
                  value={wallThickness}
                  onChange={e => setWallThickness(parseFloat(e.target.value) || 0.2)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Material</label>
                <select
                  value={wallMaterial}
                  onChange={e => setWallMaterial(e.target.value as Wall['materialType'])}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="concrete">Beton</option>
                  <option value="brick">Mauerwerk</option>
                  <option value="drywall">Trockenbau</option>
                  <option value="wood">Holz</option>
                  <option value="glass">Glas</option>
                </select>
              </div>
            </div>
          </div>
        )}

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
                  {{ rooms: 'Räume', walls: 'Wände', openings: 'Öffnungen' }[k]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {rooms.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Räume ({rooms.length})
              </h3>
              <div className="flex flex-col gap-0.5">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => { setSelectedRoomId(room.id); setSelectedWallId(null); setEditingWall(null); }}
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
          {walls.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Wände ({walls.length})
              </h3>
              <div className="flex flex-col gap-0.5">
                {walls.map((wall, i) => (
                  <button
                    key={wall.id}
                    onClick={() => { setSelectedWallId(wall.id); setSelectedRoomId(null); setEditingRoom(null); }}
                    className={[
                      'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-all',
                      selectedWallId === wall.id ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700',
                    ].join(' ')}
                  >
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: WALL_MATERIAL_COLORS[wall.materialType] || '#64748b' }} />
                    <span className="flex-1 truncate">
                      Wand {i + 1}
                      {wall.openings.length > 0 && <span className="ml-1 text-slate-500">({wall.openings.length})</span>}
                    </span>
                    <span className="text-slate-500">{wallLength(wall).toFixed(1)}m</span>
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
            {tool === 'polygon' && (drawingPoints.length === 0 ? 'Klicken zum Starten' : `${drawingPoints.length} Punkte — Doppelklick zum Fertigstellen`)}
            {tool === 'wall' && (wallStart ? `Von (${wallStart.x.toFixed(1)}m, ${wallStart.y.toFixed(1)}m) — Klicken zum Platzieren, ESC zum Beenden` : 'Klicken für Wandstart')}
            {tool === 'door' && 'Wand anklicken um Tür zu platzieren'}
            {tool === 'window' && 'Wand anklicken um Fenster zu platzieren'}
            {(tool === 'select' || tool === 'move') && 'Element anklicken zum Auswählen'}
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
            {tool === 'wall' && wallStart && (
              <button onClick={() => setWallStart(null)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 ml-1">
                <X size={12} /> ESC
              </button>
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
              tool === 'polygon' || tool === 'wall' || tool === 'door' || tool === 'window' ? 'cursor-crosshair' : '',
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
              <pattern id="grid-sm" width={SCALE * zoom} height={SCALE * zoom} patternUnits="userSpaceOnUse"
                x={pan.x % (SCALE * zoom)} y={pan.y % (SCALE * zoom)}>
                <path d={`M ${SCALE * zoom} 0 L 0 0 0 ${SCALE * zoom}`} fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <pattern id="grid-lg" width={SCALE * zoom * 5} height={SCALE * zoom * 5} patternUnits="userSpaceOnUse"
                x={pan.x % (SCALE * zoom * 5)} y={pan.y % (SCALE * zoom * 5)}>
                <rect width={SCALE * zoom * 5} height={SCALE * zoom * 5} fill="url(#grid-sm)" />
                <path d={`M ${SCALE * zoom * 5} 0 L 0 0 0 ${SCALE * zoom * 5}`} fill="none" stroke="#334155" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#0f172a" />
            <rect width="100%" height="100%" fill="url(#grid-lg)" />

            {/* ── Rooms ── */}
            {layers.rooms && rooms.map(room => {
              const poly = getRoomPolygon(room);
              const pts = poly.map(p => `${p.x},${p.y}`).join(' ');
              const isSelected = room.id === selectedRoomId;
              const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
              const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
              return (
                <g key={room.id}>
                  <polygon
                    points={pts}
                    fill={room.color || '#94a3b8'}
                    fillOpacity={isSelected ? 0.45 : 0.2}
                    stroke={isSelected ? '#38bdf8' : (room.color || '#94a3b8')}
                    strokeWidth={isSelected ? 2 : 1}
                    className="cursor-pointer transition-all"
                    onClick={e => { e.stopPropagation(); if (tool === 'select') { setSelectedRoomId(room.id); setSelectedWallId(null); setEditingWall(null); } }}
                  />
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

            {/* ── Walls ── */}
            {layers.walls && walls.map(wall => {
              const wp = getWallSvgPoints(wall);
              if (!wp) return null;
              const isSelected = wall.id === selectedWallId;
              const matColor = WALL_MATERIAL_COLORS[wall.materialType] || '#64748b';
              const pts = wp.corners.map(p => `${p.x},${p.y}`).join(' ');
              return (
                <g key={wall.id}>
                  {/* Wall fill */}
                  <polygon
                    points={pts}
                    fill={matColor}
                    fillOpacity={isSelected ? 0.9 : 0.7}
                    stroke={isSelected ? '#38bdf8' : matColor}
                    strokeWidth={isSelected ? 2 : 1}
                    className="cursor-pointer"
                    onClick={e => { e.stopPropagation(); if (tool === 'select') { setSelectedWallId(wall.id); setSelectedRoomId(null); setEditingRoom(null); } }}
                  />
                  {/* Wall hatch pattern */}
                  {wall.materialType === 'concrete' && (
                    <polygon points={pts} fill="url(#hatch-concrete)" fillOpacity={0.3} style={{ pointerEvents: 'none' }} />
                  )}
                  {/* Openings */}
                  {layers.openings && wall.openings.map(opening => {
                    const len = wallLength(wall);
                    const pos = opening.position;
                    const hw = (opening.width / len) / 2;
                    const t1 = Math.max(0, pos - hw);
                    const t2 = Math.min(1, pos + hw);
                    const p1s = { x: wp.s.x + (wp.e.x - wp.s.x) * t1, y: wp.s.y + (wp.e.y - wp.s.y) * t1 };
                    const p2s = { x: wp.s.x + (wp.e.x - wp.s.x) * t2, y: wp.s.y + (wp.e.y - wp.s.y) * t2 };
                    const isDoor = opening.type === 'door' || opening.type === 'door-double';
                    const color = isDoor ? '#fbbf24' : '#38bdf8';
                    const wallCornerA1 = { x: p1s.x + wp.nx, y: p1s.y + wp.ny };
                    const wallCornerA2 = { x: p1s.x - wp.nx, y: p1s.y - wp.ny };
                    const wallCornerB1 = { x: p2s.x + wp.nx, y: p2s.y + wp.ny };
                    const wallCornerB2 = { x: p2s.x - wp.nx, y: p2s.y - wp.ny };
                    return (
                      <g key={opening.id}>
                        {/* Opening cut-out */}
                        <polygon
                          points={[wallCornerA1, wallCornerB1, wallCornerB2, wallCornerA2].map(p => `${p.x},${p.y}`).join(' ')}
                          fill="#0f172a"
                          stroke={color}
                          strokeWidth={1.5}
                          style={{ pointerEvents: 'none' }}
                        />
                        {/* Door arc */}
                        {isDoor && (() => {
                          const r = opening.width * SCALE * zoom;
                          const hx = (p1s.x + p2s.x) / 2, hy = (p1s.y + p2s.y) / 2;
                          const ex = hx + wp.dx * r * 0.5 - wp.nx * 0.5;
                          const ey = hy + wp.dy * r * 0.5 - wp.ny * 0.5;
                          return (
                            <path
                              d={`M ${p1s.x} ${p1s.y} A ${r * 0.5} ${r * 0.5} 0 0 1 ${ex} ${ey}`}
                              fill="none" stroke={color} strokeWidth={1} strokeDasharray="3,2"
                              style={{ pointerEvents: 'none' }}
                            />
                          );
                        })()}
                        {/* Window sill lines */}
                        {!isDoor && (
                          <>
                            <line x1={wallCornerA1.x} y1={wallCornerA1.y} x2={wallCornerA2.x} y2={wallCornerA2.y} stroke={color} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
                            <line x1={wallCornerB1.x} y1={wallCornerB1.y} x2={wallCornerB2.x} y2={wallCornerB2.y} stroke={color} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
                            <line
                              x1={(wallCornerA1.x + wallCornerA2.x) / 2} y1={(wallCornerA1.y + wallCornerA2.y) / 2}
                              x2={(wallCornerB1.x + wallCornerB2.x) / 2} y2={(wallCornerB1.y + wallCornerB2.y) / 2}
                              stroke={color} strokeWidth={0.8} strokeDasharray="2,2" style={{ pointerEvents: 'none' }}
                            />
                          </>
                        )}
                      </g>
                    );
                  })}
                  {/* Wall length label */}
                  {zoom >= 0.6 && (
                    <text
                      x={(wp.s.x + wp.e.x) / 2}
                      y={(wp.s.y + wp.e.y) / 2 - 8}
                      textAnchor="middle"
                      fill={isSelected ? '#38bdf8' : '#475569'}
                      fontSize={10 * zoom}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {wallLength(wall).toFixed(2)}m
                    </text>
                  )}
                </g>
              );
            })}

            {/* Live wall preview */}
            {tool === 'wall' && wallStart && (
              <g>
                <line
                  x1={worldToSvg(wallStart.x, wallStart.y).x}
                  y1={worldToSvg(wallStart.x, wallStart.y).y}
                  x2={livePoint.x} y2={livePoint.y}
                  stroke="#38bdf8" strokeWidth={Math.max(1, wallThickness * SCALE * zoom)}
                  strokeOpacity={0.5} strokeLinecap="square"
                />
                <circle cx={worldToSvg(wallStart.x, wallStart.y).x} cy={worldToSvg(wallStart.x, wallStart.y).y} r={4} fill="#38bdf8" />
                <text
                  x={(worldToSvg(wallStart.x, wallStart.y).x + livePoint.x) / 2}
                  y={(worldToSvg(wallStart.x, wallStart.y).y + livePoint.y) / 2 - 10}
                  textAnchor="middle" fill="#38bdf8" fontSize={11}
                  style={{ userSelect: 'none' }}
                >
                  {Math.hypot(mousePos.x - wallStart.x, mousePos.y - wallStart.y).toFixed(2)}m
                </text>
              </g>
            )}

            {/* Door/window hover highlight */}
            {(tool === 'door' || tool === 'window') && walls.map(wall => {
              const d = distPointToSegment(mousePos.x, mousePos.y, wall.x1, wall.y1, wall.x2, wall.y2);
              if (d > 0.4) return null;
              const wp = getWallSvgPoints(wall);
              if (!wp) return null;
              const pts = wp.corners.map(p => `${p.x},${p.y}`).join(' ');
              return (
                <polygon key={`hover-${wall.id}`} points={pts}
                  fill={tool === 'door' ? '#fbbf24' : '#38bdf8'}
                  fillOpacity={0.25} stroke={tool === 'door' ? '#fbbf24' : '#38bdf8'}
                  strokeWidth={2} style={{ pointerEvents: 'none' }} />
              );
            })}

            {/* Polygon drawing */}
            {currentDrawSvgPts.length > 0 && (
              <g>
                <polygon
                  points={[...currentDrawSvgPts, livePoint].map(p => `${p.x},${p.y}`).join(' ')}
                  fill="#38bdf8" fillOpacity={0.12} stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5,3"
                />
                {currentDrawSvgPts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={4} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} />
                ))}
                <line
                  x1={currentDrawSvgPts[currentDrawSvgPts.length - 1]?.x}
                  y1={currentDrawSvgPts[currentDrawSvgPts.length - 1]?.y}
                  x2={livePoint.x} y2={livePoint.y}
                  stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5,3"
                />
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
      {selectedRoom && !editingRoom && !editingWall && (
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
            </div>
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

      {/* ── Right panel: Wall properties ── */}
      {selectedWall && !editingWall && !editingRoom && (
        <div className="w-60 border-l border-slate-700 flex flex-col bg-slate-800 shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Wand</h3>
            <div className="flex gap-0.5">
              <button onClick={() => setEditingWall({ ...selectedWall })} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Bearbeiten"><Edit3 size={13} /></button>
              <button onClick={() => deleteWall(selectedWall.id)} className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400" title="Löschen"><Trash2 size={13} /></button>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="bg-slate-700/50 rounded p-2 col-span-2">
                <p className="text-slate-400 mb-0.5">Länge</p>
                <p className="text-white font-semibold">{wallLength(selectedWall).toFixed(2)} m</p>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <p className="text-slate-400 mb-0.5">Dicke</p>
                <p className="text-slate-200 font-medium">{selectedWall.thickness * 100} cm</p>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <p className="text-slate-400 mb-0.5">Höhe</p>
                <p className="text-slate-200 font-medium">{selectedWall.height} m</p>
              </div>
              <div className="bg-slate-700/50 rounded p-2 col-span-2">
                <p className="text-slate-400 mb-0.5">Material</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ background: WALL_MATERIAL_COLORS[selectedWall.materialType] }} />
                  <p className="text-slate-200 font-medium capitalize">{{ concrete: 'Beton', brick: 'Mauerwerk', drywall: 'Trockenbau', wood: 'Holz', glass: 'Glas' }[selectedWall.materialType]}</p>
                </div>
              </div>
            </div>

            {selectedWall.openings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Öffnungen ({selectedWall.openings.length})
                </h4>
                <div className="flex flex-col gap-1.5">
                  {selectedWall.openings.map(o => (
                    <div key={o.id} className="flex items-center gap-2 bg-slate-700/50 rounded p-2 text-xs">
                      {o.type === 'door' || o.type === 'door-double' ? (
                        <DoorOpen size={12} className="text-amber-400 shrink-0" />
                      ) : (
                        <WindowIcon size={12} className="text-sky-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 font-medium">{{ door: 'Tür', 'door-double': 'Doppeltür', window: 'Fenster', 'window-large': 'Großfenster', 'door-arch': 'Bogentür' }[o.type]}</p>
                        <p className="text-slate-500">{o.width}m · {Math.round(o.position * 100)}% Pos.</p>
                      </div>
                      <button onClick={() => deleteOpening(selectedWall.id, o.id)} className="p-1 hover:bg-red-900/40 rounded text-slate-500 hover:text-red-400 shrink-0">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Right panel: Edit Wall ── */}
      {editingWall && (
        <div className="w-60 border-l border-slate-700 flex flex-col bg-slate-800 shrink-0">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Wand bearbeiten</h3>
            <div className="flex gap-0.5">
              <button onClick={saveEditingWall} className="p-1.5 hover:bg-slate-700 rounded text-sky-400"><Check size={13} /></button>
              <button onClick={() => setEditingWall(null)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><X size={13} /></button>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-3 overflow-y-auto">
            <div><label className="text-xs text-slate-400 block mb-1">Dicke (m)</label>
              <input type="number" step="0.05" min="0.05" max="1" value={editingWall.thickness}
                onChange={e => setEditingWall(w => w ? { ...w, thickness: parseFloat(e.target.value) || 0.2 } : w)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Höhe (m)</label>
              <input type="number" step="0.1" min="1" max="10" value={editingWall.height}
                onChange={e => setEditingWall(w => w ? { ...w, height: parseFloat(e.target.value) || 3 } : w)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">Material</label>
              <select value={editingWall.materialType} onChange={e => setEditingWall(w => w ? { ...w, materialType: e.target.value as Wall['materialType'], color: WALL_MATERIAL_COLORS[e.target.value] } : w)}
                className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500">
                <option value="concrete">Beton</option>
                <option value="brick">Mauerwerk</option>
                <option value="drywall">Trockenbau</option>
                <option value="wood">Holz</option>
                <option value="glass">Glas</option>
              </select></div>

            {/* Edit openings inline */}
            {editingWall.openings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Öffnungen</h4>
                {editingWall.openings.map((o, oi) => (
                  <div key={o.id} className="bg-slate-700/50 rounded p-2 mb-2 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-300 font-medium">{{ door: 'Tür', 'door-double': 'Doppeltür', window: 'Fenster', 'window-large': 'Großfenster', 'door-arch': 'Bogentür' }[o.type]}</span>
                      <button onClick={() => setEditingWall(w => w ? { ...w, openings: w.openings.filter((_, i) => i !== oi) } : w)}
                        className="p-0.5 hover:bg-red-900/40 rounded text-slate-500 hover:text-red-400"><Trash2 size={10} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div><label className="text-slate-500 block mb-0.5">Breite (m)</label>
                        <input type="number" step="0.1" min="0.2" max="5" value={o.width}
                          onChange={e => setEditingWall(w => { if (!w) return w; const ops = [...w.openings]; ops[oi] = { ...ops[oi], width: parseFloat(e.target.value) || 1 }; return { ...w, openings: ops }; })}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500" /></div>
                      <div><label className="text-slate-500 block mb-0.5">Position (%)</label>
                        <input type="number" step="1" min="5" max="95" value={Math.round(o.position * 100)}
                          onChange={e => setEditingWall(w => { if (!w) return w; const ops = [...w.openings]; ops[oi] = { ...ops[oi], position: (parseFloat(e.target.value) || 50) / 100 }; return { ...w, openings: ops }; })}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500" /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
