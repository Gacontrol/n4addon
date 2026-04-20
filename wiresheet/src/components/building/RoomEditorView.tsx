import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit3, Check, X, MousePointer, Hexagon, Settings, ChevronDown, Layers, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { Building, Floor, Room, RoomType } from '../../types/building';

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
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [pan, setPan] = useState<Point>({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const panOrigin = useRef<Point>({ x: 0, y: 0 });

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showFloorPanel, setShowFloorPanel] = useState(false);

  const activeFloor = building.floors.find(f => f.id === selectedFloorId);
  const rooms = activeFloor?.rooms ?? [];
  const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;

  const svgToWorld = useCallback((sx: number, sy: number): Point => ({
    x: (sx - pan.x) / (SCALE * zoom),
    y: (sy - pan.y) / (SCALE * zoom),
  }), [pan, zoom]);

  const worldToSvg = useCallback((wx: number, wy: number): Point => ({
    x: wx * SCALE * zoom + pan.x,
    y: wy * SCALE * zoom + pan.y,
  }), [pan, zoom]);

  const getRoomPolygon = useCallback((room: Room): Point[] => {
    if (room.points && room.points.length >= 3) {
      return room.points.map(p => worldToSvg(p.x, p.y));
    }
    const { x, y, width, depth } = room;
    return [
      worldToSvg(x, y),
      worldToSvg(x + width, y),
      worldToSvg(x + width, y + depth),
      worldToSvg(x, y + depth),
    ];
  }, [worldToSvg]);

  const getSvgPoint = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svgPt = getSvgPoint(e);
    const world = svgToWorld(svgPt.x, svgPt.y);
    const snapped = { x: snapToGrid(world.x * SCALE) / SCALE, y: snapToGrid(world.y * SCALE) / SCALE };
    setMousePos(snapped);

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

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || tool === 'move') return;
    if (tool === 'select') {
      setSelectedRoomId(null);
      return;
    }
    if (tool === 'polygon') {
      const svgPt = getSvgPoint(e);
      const world = svgToWorld(svgPt.x, svgPt.y);
      const snapped = { x: snapToGrid(world.x * SCALE) / SCALE, y: snapToGrid(world.y * SCALE) / SCALE };
      setDrawingPoints(prev => [...prev, snapped]);
    }
  }, [isPanning, tool, getSvgPoint, svgToWorld]);

  const finishPolygon = useCallback(() => {
    if (drawingPoints.length < 3 || !activeFloor) return;
    const xs = drawingPoints.map(p => p.x);
    const ys = drawingPoints.map(p => p.y);
    const now = Date.now();
    const newRoom: Room = {
      id: `room-${now}`,
      name: `Raum ${rooms.length + 1}`,
      type: 'room',
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      depth: Math.max(...ys) - Math.min(...ys),
      color: ROOM_TYPE_COLORS['room'],
      doors: [],
      windows: [],
      points: drawingPoints,
    };
    const updatedFloor = { ...activeFloor, rooms: [...activeFloor.rooms, newRoom] };
    const updatedBuilding = {
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id ? updatedFloor : f),
      updatedAt: now,
    };
    onUpdateBuilding(updatedBuilding);
    setDrawingPoints([]);
    setSelectedRoomId(newRoom.id);
    setEditingRoom(newRoom);
    setTool('select');
  }, [drawingPoints, activeFloor, building, onUpdateBuilding, rooms.length]);

  const cancelPolygon = useCallback(() => {
    setDrawingPoints([]);
    setTool('select');
  }, []);

  const deleteRoom = useCallback((roomId: string) => {
    if (!activeFloor) return;
    const updatedFloor = { ...activeFloor, rooms: activeFloor.rooms.filter(r => r.id !== roomId) };
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id ? updatedFloor : f),
      updatedAt: Date.now(),
    });
    setSelectedRoomId(null);
    setEditingRoom(null);
  }, [activeFloor, building, onUpdateBuilding]);

  const saveEditingRoom = useCallback(() => {
    if (!editingRoom || !activeFloor) return;
    const updatedFloor = {
      ...activeFloor,
      rooms: activeFloor.rooms.map(r => r.id === editingRoom.id ? editingRoom : r),
    };
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id ? updatedFloor : f),
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
    const updated = { ...building, floors: [...building.floors, newFloor], updatedAt: now };
    onUpdateBuilding(updated);
    setSelectedFloorId(newFloor.id);
  }, [building, onUpdateBuilding]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(4, z * factor)));
  }, []);

  useEffect(() => {
    if (!selectedFloorId && building.floors.length > 0) {
      setSelectedFloorId(building.floors[0].id);
    }
  }, [building.floors, selectedFloorId]);

  const canvasWidth = containerRef.current?.clientWidth ?? 800;
  const canvasHeight = containerRef.current?.clientHeight ?? 600;

  const currentDrawSvgPoints = drawingPoints.map(p => worldToSvg(p.x, p.y));
  const livePoint = worldToSvg(mousePos.x, mousePos.y);

  return (
    <div className="flex h-full bg-slate-900 text-slate-200">
      <div className="w-56 border-r border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Etagen</h3>
          <div className="flex flex-col gap-1">
            {building.floors
              .slice()
              .sort((a, b) => b.level - a.level)
              .map(floor => (
                <button
                  key={floor.id}
                  onClick={() => { setSelectedFloorId(floor.id); setSelectedRoomId(null); setDrawingPoints([]); }}
                  className={[
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition-all',
                    selectedFloorId === floor.id
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700',
                  ].join(' ')}
                >
                  <Layers size={12} />
                  <span className="flex-1 truncate">{floor.name}</span>
                  <span className="text-xs opacity-60">E{floor.level}</span>
                </button>
              ))}
          </div>
          <button
            onClick={addFloor}
            className="mt-2 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          >
            <Plus size={12} />
            Etage hinzufügen
          </button>
        </div>

        <div className="p-3 border-b border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Werkzeuge</h3>
          <div className="flex flex-col gap-1">
            {([
              { id: 'select', label: 'Auswählen', Icon: MousePointer },
              { id: 'polygon', label: 'Polygon-Raum', Icon: Hexagon },
              { id: 'move', label: 'Verschieben', Icon: Move },
            ] as const).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setTool(id); if (id !== 'polygon') setDrawingPoints([]); }}
                className={[
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  tool === id
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Räume ({rooms.length})
          </h3>
          <div className="flex flex-col gap-1">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => { setSelectedRoomId(room.id); setEditingRoom(null); }}
                className={[
                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-all',
                  selectedRoomId === room.id
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700',
                ].join(' ')}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: room.color || '#94a3b8' }}
                />
                <span className="flex-1 truncate">{room.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 bg-slate-800">
          <span className="text-sm text-slate-300 font-medium">
            {activeFloor?.name ?? 'Keine Etage'}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-xs text-slate-500">
            {tool === 'polygon'
              ? drawingPoints.length === 0
                ? 'Klicken zum Starten des Polygons'
                : `${drawingPoints.length} Punkte — Doppelklick oder Schließen zum Fertigstellen`
              : 'Raum anklicken zum Auswählen'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setZoom(z => Math.min(4, z * 1.2))} className="p-1 hover:bg-slate-700 rounded">
              <ZoomIn size={14} className="text-slate-400" />
            </button>
            <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} className="p-1 hover:bg-slate-700 rounded">
              <ZoomOut size={14} className="text-slate-400" />
            </button>
            {tool === 'polygon' && drawingPoints.length >= 3 && (
              <>
                <button onClick={finishPolygon} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white transition-colors">
                  <Check size={12} /> Fertig
                </button>
                <button onClick={cancelPolygon} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors">
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
              'w-full h-full',
              tool === 'polygon' ? 'cursor-crosshair' : tool === 'move' ? 'cursor-grab' : 'cursor-default',
              isPanning ? 'cursor-grabbing' : '',
            ].join(' ')}
            onClick={handleCanvasClick}
            onDoubleClick={() => { if (tool === 'polygon' && drawingPoints.length >= 3) finishPolygon(); }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            <defs>
              <pattern id="grid-small" width={SCALE * zoom} height={SCALE * zoom} patternUnits="userSpaceOnUse"
                x={pan.x % (SCALE * zoom)} y={pan.y % (SCALE * zoom)}>
                <path d={`M ${SCALE * zoom} 0 L 0 0 0 ${SCALE * zoom}`} fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <pattern id="grid-large" width={SCALE * zoom * 5} height={SCALE * zoom * 5} patternUnits="userSpaceOnUse"
                x={pan.x % (SCALE * zoom * 5)} y={pan.y % (SCALE * zoom * 5)}>
                <rect width={SCALE * zoom * 5} height={SCALE * zoom * 5} fill="url(#grid-small)" />
                <path d={`M ${SCALE * zoom * 5} 0 L 0 0 0 ${SCALE * zoom * 5}`} fill="none" stroke="#334155" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="#0f172a" />
            <rect width="100%" height="100%" fill="url(#grid-large)" />

            {rooms.map(room => {
              const poly = getRoomPolygon(room);
              const pts = poly.map(p => `${p.x},${p.y}`).join(' ');
              const isSelected = room.id === selectedRoomId;
              return (
                <g key={room.id}>
                  <polygon
                    points={pts}
                    fill={room.color || '#94a3b8'}
                    fillOpacity={isSelected ? 0.5 : 0.3}
                    stroke={isSelected ? '#38bdf8' : (room.color || '#94a3b8')}
                    strokeWidth={isSelected ? 2 : 1}
                    className="cursor-pointer transition-all"
                    onClick={e => {
                      e.stopPropagation();
                      if (tool === 'select') {
                        setSelectedRoomId(room.id);
                        setEditingRoom(null);
                      }
                    }}
                  />
                  {zoom >= 0.6 && (() => {
                    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
                    const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
                    return (
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                        fill={isSelected ? '#e2e8f0' : '#94a3b8'}
                        fontSize={11 * zoom}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {room.name}
                      </text>
                    );
                  })()}
                </g>
              );
            })}

            {currentDrawSvgPoints.length > 0 && (
              <g>
                <polygon
                  points={[...currentDrawSvgPoints, livePoint].map(p => `${p.x},${p.y}`).join(' ')}
                  fill="#38bdf8"
                  fillOpacity={0.15}
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="5,3"
                />
                {currentDrawSvgPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={4} fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5} />
                ))}
                <line
                  x1={currentDrawSvgPoints[currentDrawSvgPoints.length - 1]?.x}
                  y1={currentDrawSvgPoints[currentDrawSvgPoints.length - 1]?.y}
                  x2={livePoint.x} y2={livePoint.y}
                  stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5,3"
                />
              </g>
            )}

            {tool === 'polygon' && (
              <text x={16} y={canvasHeight - 16} fill="#475569" fontSize={11} style={{ userSelect: 'none' }}>
                Pos: ({mousePos.x.toFixed(2)}m, {mousePos.y.toFixed(2)}m)
              </text>
            )}
          </svg>
        </div>
      </div>

      {selectedRoom && !editingRoom && (
        <div className="w-64 border-l border-slate-700 flex flex-col bg-slate-800">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Raum</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditingRoom({ ...selectedRoom })}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                title="Bearbeiten"
              >
                <Edit3 size={13} />
              </button>
              <button
                onClick={() => onConfigRoom?.(selectedRoom.id)}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                title="Konfigurieren"
              >
                <Settings size={13} />
              </button>
              <button
                onClick={() => deleteRoom(selectedRoom.id)}
                className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400 transition-colors"
                title="Löschen"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-sm shrink-0" style={{ background: selectedRoom.color || '#94a3b8' }} />
              <span className="text-sm font-medium text-white">{selectedRoom.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-700/50 rounded p-2">
                <p className="text-slate-400 mb-0.5">Typ</p>
                <p className="text-slate-200 font-medium">{ROOM_TYPE_LABELS[selectedRoom.type]}</p>
              </div>
              {selectedRoom.number && (
                <div className="bg-slate-700/50 rounded p-2">
                  <p className="text-slate-400 mb-0.5">Nummer</p>
                  <p className="text-slate-200 font-medium">{selectedRoom.number}</p>
                </div>
              )}
              <div className="bg-slate-700/50 rounded p-2">
                <p className="text-slate-400 mb-0.5">Punkte</p>
                <p className="text-slate-200 font-medium">{selectedRoom.points?.length ?? 4}</p>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <p className="text-slate-400 mb-0.5">Datenpunkte</p>
                <p className="text-slate-200 font-medium">{selectedRoom.bindings?.length ?? 0}</p>
              </div>
            </div>
            <button
              onClick={() => onOpenRoom?.(selectedRoom.id)}
              className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
            >
              Raumseite öffnen
            </button>
            <button
              onClick={() => onConfigRoom?.(selectedRoom.id)}
              className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
            >
              Datenpunkte konfigurieren
            </button>
          </div>
        </div>
      )}

      {editingRoom && (
        <div className="w-64 border-l border-slate-700 flex flex-col bg-slate-800">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Raum bearbeiten</h3>
            <div className="flex items-center gap-1">
              <button onClick={saveEditingRoom} className="p-1.5 hover:bg-slate-700 rounded text-sky-400 hover:text-sky-300">
                <Check size={13} />
              </button>
              <button onClick={() => setEditingRoom(null)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200">
                <X size={13} />
              </button>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Name</label>
              <input
                type="text"
                value={editingRoom.name}
                onChange={e => setEditingRoom(r => r ? { ...r, name: e.target.value } : r)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nummer</label>
              <input
                type="text"
                value={editingRoom.number ?? ''}
                onChange={e => setEditingRoom(r => r ? { ...r, number: e.target.value } : r)}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                placeholder="z.B. 1.01"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Typ</label>
              <select
                value={editingRoom.type}
                onChange={e => {
                  const t = e.target.value as RoomType;
                  setEditingRoom(r => r ? { ...r, type: t, color: ROOM_TYPE_COLORS[t] } : r);
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Farbe</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editingRoom.color || '#94a3b8'}
                  onChange={e => setEditingRoom(r => r ? { ...r, color: e.target.value } : r)}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs text-slate-400">{editingRoom.color || '#94a3b8'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Beschreibung</label>
              <textarea
                value={editingRoom.description ?? ''}
                onChange={e => setEditingRoom(r => r ? { ...r, description: e.target.value } : r)}
                rows={2}
                className="w-full bg-slate-700 border border-slate-600 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
