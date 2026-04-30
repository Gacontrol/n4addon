import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Check, X, MousePointer, Hexagon,
  Layers, ZoomIn, ZoomOut, Move,
  ChevronDown, ChevronRight, Eye, EyeOff, CreditCard as Edit3,
  Zap, Search, Settings, Star, Activity,
  Thermometer, Droplets, Wind, Users, AlertTriangle, Gauge, Flame, Fan,
  Lightbulb, Plug, Snowflake, Bell, LayoutDashboard, Pencil,
} from 'lucide-react';
import { Building, Floor, Room, RoomType, Wall, RoomDataPointBinding, MonitorLayer, AlarmBehavior } from '../../types/building';
import type { DatapointGroup } from './RoomBindingsPanel';

interface Point { x: number; y: number }

type EditorTool = 'select' | 'polygon' | 'move';
type RightTab = 'properties' | 'datapoints';

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

// ---- Datapoint role definitions (HVAC quick-select) ----

interface BindingRole {
  key: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  accent: string;
  category: string;
  min?: number;
  max?: number;
}

const BINDING_ROLES: BindingRole[] = [
  { key: 'temperature', label: 'Raumtemperatur', unit: '°C', icon: <Thermometer size={14} />, accent: '#ef4444', category: 'temperature', min: 15, max: 30 },
  { key: 'setpoint', label: 'Sollwert', unit: '°C', icon: <Gauge size={14} />, accent: '#f97316', category: 'setpoint', min: 15, max: 28 },
  { key: 'humidity', label: 'Feuchte', unit: '%', icon: <Droplets size={14} />, accent: '#06b6d4', category: 'humidity', min: 20, max: 80 },
  { key: 'co2', label: 'CO₂', unit: 'ppm', icon: <Wind size={14} />, accent: '#84cc16', category: 'co2', min: 400, max: 2000 },
  { key: 'presence', label: 'Präsenz', unit: '', icon: <Users size={14} />, accent: '#0ea5e9', category: 'occupancy' },
  { key: 'airflow', label: 'Zuluft', unit: 'm³/h', icon: <Wind size={14} />, accent: '#3b82f6', category: 'airflow', min: 0, max: 1000 },
  { key: 'energy', label: 'Energie', unit: 'kWh', icon: <Zap size={14} />, accent: '#eab308', category: 'energy' },
  { key: 'alarm', label: 'Alarm', unit: '', icon: <Bell size={14} />, accent: '#ef4444', category: 'alarm' },
  { key: 'valveHeat', label: 'Heizventil', unit: '%', icon: <Flame size={14} />, accent: '#dc2626', category: 'valve', min: 0, max: 100 },
  { key: 'valveCool', label: 'Kühlventil', unit: '%', icon: <Snowflake size={14} />, accent: '#0284c7', category: 'valve', min: 0, max: 100 },
  { key: 'fan', label: 'Ventilator', unit: '%', icon: <Fan size={14} />, accent: '#6366f1', category: 'fanSpeed', min: 0, max: 100 },
  { key: 'light', label: 'Licht', unit: '%', icon: <Lightbulb size={14} />, accent: '#facc15', category: 'light', min: 0, max: 100 },
  { key: 'pump', label: 'Pumpe', unit: '', icon: <Plug size={14} />, accent: '#2563eb', category: 'pump' },
];

const BINDING_ROLE_CATEGORIES: { id: string; label: string; keys: string[] }[] = [
  { id: 'climate', label: 'Klima', keys: ['temperature', 'setpoint', 'humidity', 'co2', 'presence'] },
  { id: 'air', label: 'Luft & Energie', keys: ['airflow', 'energy'] },
  { id: 'actuator', label: 'Aktoren', keys: ['valveHeat', 'valveCool', 'fan', 'light', 'pump'] },
  { id: 'safety', label: 'Sicherheit', keys: ['alarm'] },
];

function displayLabel(entityId: string, labels?: Record<string, string>): string {
  if (!entityId) return '';
  if (labels && labels[entityId]) return labels[entityId];
  return entityId;
}

const ALARM_BEHAVIOR_LABELS: Record<AlarmBehavior, string> = {
  none: 'Kein Alarm',
  blink: 'Blinken',
  red: 'Rot markieren',
};

interface RoomEditorViewProps {
  building: Building;
  onUpdateBuilding: (b: Building) => void;
  onOpenRoom?: (roomId: string) => void;
  onConfigRoom?: (roomId: string) => void;
  datapointGroups?: DatapointGroup[];
  datapointLabels?: Record<string, string>;
}

export function RoomEditorView({ building, onUpdateBuilding, onOpenRoom, onConfigRoom, datapointGroups = [], datapointLabels = {} }: RoomEditorViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedFloorId, setSelectedFloorId] = useState<string>(building.floors[0]?.id ?? '');
  const [tool, setTool] = useState<EditorTool>('select');
  const [rightTab, setRightTab] = useState<RightTab>('properties');

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

  // Datapoint picker state
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null); // bindingId or 'new'
  const [pickerPageId, setPickerPageId] = useState<string | null>(null);
  const [dpSearch, setDpSearch] = useState('');

  // New free binding form
  const [showNewBindingForm, setShowNewBindingForm] = useState(false);
  const [newBindingLabel, setNewBindingLabel] = useState('');
  const [newBindingUnit, setNewBindingUnit] = useState('');
  const [newBindingCategory, setNewBindingCategory] = useState('generic');
  const [newBindingWritable, setNewBindingWritable] = useState(false);
  const [newBindingMin, setNewBindingMin] = useState<string>('');
  const [newBindingMax, setNewBindingMax] = useState<string>('');
  const [pendingNewDatapoint, setPendingNewDatapoint] = useState<string>('');

  // Expanded category state for HVAC quick-select
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    climate: true, air: false, actuator: false, safety: false,
  });
  const [showHvacQuick, setShowHvacQuick] = useState(false);

  // Layer config modal for a specific binding
  const [layerConfigFor, setLayerConfigFor] = useState<string | null>(null);

  // Monitor layer management modal
  const [showLayerManager, setShowLayerManager] = useState(false);
  const [editingLayer, setEditingLayer] = useState<MonitorLayer | null>(null);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerUnit, setNewLayerUnit] = useState('');

  const dragRoom = useRef<{
    roomId: string; origPoints: Point[];
    origX: number; origY: number; startSvgX: number; startSvgY: number;
  } | null>(null);

  const dragVertex = useRef<{
    roomId: string; vertexIndex: number; origPoints: Point[];
  } | null>(null);

  const activeFloor = building.floors.find(f => f.id === selectedFloorId);
  const rooms = activeFloor?.rooms ?? [];
  const walls = activeFloor?.walls ?? [];
  const selectedRoom = rooms.find(r => r.id === selectedRoomId) ?? null;
  const monitorLayers = building.monitorLayers ?? [];

  // ---- Coordinate transforms ----
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
            ? { ...f, rooms: f.rooms.map(r => r.id === roomId
                ? { ...r, points: newPoints, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) }
                : r) }
            : f
        ),
        updatedAt: Date.now(),
      });
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
      const newPoints = dragRoom.current.origPoints.map(p => ({ x: p.x + snapDx, y: p.y + snapDy }));
      const xs = newPoints.map(p => p.x);
      const ys = newPoints.map(p => p.y);
      onUpdateBuilding({
        ...building,
        floors: building.floors.map(f =>
          f.id === activeFloor.id
            ? { ...f, rooms: f.rooms.map(r => r.id === dragRoom.current!.roomId
                ? { ...r, points: newPoints, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) }
                : r) }
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

  const handleRoomMouseDown = useCallback((e: React.MouseEvent<SVGPolygonElement>, room: Room) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    if (!room.points || room.points.length < 3) return;
    const svgPt = getSvgPointFromAny(e);
    dragRoom.current = {
      roomId: room.id, origPoints: room.points.map(p => ({ ...p })),
      origX: room.x, origY: room.y, startSvgX: svgPt.x, startSvgY: svgPt.y,
    };
    setSelectedRoomId(room.id);
  }, [tool, getSvgPointFromAny]);

  const handleVertexMouseDown = useCallback((e: React.MouseEvent<SVGCircleElement>, room: Room, vertexIndex: number) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    if (!room.points) return;
    dragVertex.current = { roomId: room.id, vertexIndex, origPoints: room.points.map(p => ({ ...p })) };
  }, [tool]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning || tool === 'move') return;
    const snapped = getSnappedWorld(e);

    if (tool === 'select') {
      setSelectedRoomId(null);
      return;
    }

    if (tool === 'polygon') {
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
        ? { ...activeFloor, rooms: [...activeFloor.rooms, newRoom] } : f),
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
        ? { ...activeFloor, rooms: activeFloor.rooms.filter(r => r.id !== roomId) } : f),
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
        ? { ...activeFloor, rooms: activeFloor.rooms.map(r => r.id === editingRoom.id ? editingRoom : r) } : f),
      updatedAt: Date.now(),
    });
    setEditingRoom(null);
  }, [editingRoom, activeFloor, building, onUpdateBuilding]);

  const updateRoomBindings = useCallback((roomId: string, bindings: RoomDataPointBinding[]) => {
    if (!activeFloor) return;
    onUpdateBuilding({
      ...building,
      floors: building.floors.map(f => f.id === activeFloor.id
        ? { ...f, rooms: f.rooms.map(r => r.id === roomId ? { ...r, bindings } : r) } : f),
      updatedAt: Date.now(),
    });
  }, [activeFloor, building, onUpdateBuilding]);

  const addFloor = useCallback(() => {
    const now = Date.now();
    const maxLevel = Math.max(...building.floors.map(f => f.level), -1);
    const newFloor: Floor = {
      id: `floor-${now}`, name: `Obergeschoss ${maxLevel + 1}`, level: maxLevel + 1,
      height: 3.0, rooms: [], walls: [], ducts: [], pipes: [], slabs: [], backgroundImage: null,
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
        { x: s.x + nx, y: s.y + ny }, { x: e.x + nx, y: e.y + ny },
        { x: e.x - nx, y: e.y - ny }, { x: s.x - nx, y: s.y - ny },
      ],
    };
  }, [worldToSvg, zoom]);

  const canvasHeight = containerRef.current?.clientHeight ?? 600;
  const livePoint = worldToSvg(mousePos.x, mousePos.y);
  const currentDrawSvgPts = drawingPoints.map(p => worldToSvg(p.x, p.y));

  const nearFirstPoint = drawingPoints.length >= 3 && (() => {
    const first = currentDrawSvgPts[0];
    return Math.hypot(livePoint.x - first.x, livePoint.y - first.y) < 14;
  })();

  const toolDef = [
    { id: 'select', label: 'Auswählen', Icon: MousePointer },
    { id: 'move', label: 'Verschieben', Icon: Move },
    { id: 'polygon', label: 'Raum zeichnen', Icon: Hexagon },
  ] as const;

  // ---- Binding helpers ----
  const getBinding = (room: Room, bindingId: string) =>
    (room.bindings ?? []).find(b => b.id === bindingId);

  // Add a new free binding after datapoint was picked
  const addFreeBinding = (room: Room, datapoint: string) => {
    const existing = room.bindings ?? [];
    if (existing.length >= 20) return;
    const now = Date.now();
    const newBinding: RoomDataPointBinding = {
      id: `${room.id}-free-${now}`,
      datapoint,
      label: newBindingLabel || displayLabel(datapoint, datapointLabels) || datapoint,
      category: newBindingCategory as RoomDataPointBinding['category'],
      unit: newBindingUnit,
      display: 'tile',
      showInRoom: true,
      showInBuilding: false,
      writable: newBindingWritable,
      minValue: newBindingMin !== '' ? parseFloat(newBindingMin) : undefined,
      maxValue: newBindingMax !== '' ? parseFloat(newBindingMax) : undefined,
      order: existing.length,
      monitorLayerIds: [],
      alarmBehavior: 'none',
    };
    updateRoomBindings(room.id, [...existing, newBinding]);
    setNewBindingLabel('');
    setNewBindingUnit('');
    setNewBindingCategory('generic');
    setNewBindingWritable(false);
    setNewBindingMin('');
    setNewBindingMax('');
    setShowNewBindingForm(false);
  };

  // Add HVAC quick binding
  const setHvacBinding = (room: Room, roleKey: string, datapoint: string) => {
    const role = BINDING_ROLES.find(r => r.key === roleKey);
    if (!role) return;
    const existing = room.bindings ?? [];
    const bindingId = `${room.id}-${roleKey}`;
    const hasBinding = existing.find(b => b.id === bindingId);
    let next: RoomDataPointBinding[];
    if (datapoint === '') {
      next = existing.filter(b => b.id !== bindingId);
    } else if (hasBinding) {
      next = existing.map(b => b.id === bindingId ? { ...b, datapoint } : b);
    } else {
      if (existing.length >= 20) return;
      const newBinding: RoomDataPointBinding = {
        id: bindingId,
        datapoint,
        label: role.label,
        category: role.category as RoomDataPointBinding['category'],
        unit: role.unit,
        display: 'tile',
        showInRoom: true,
        showInBuilding: roleKey === 'temperature',
        writable: roleKey === 'setpoint',
        minValue: role.min,
        maxValue: role.max,
        order: existing.length,
        monitorLayerIds: [],
        alarmBehavior: roleKey === 'alarm' ? 'red' : 'none',
      };
      next = [...existing, newBinding];
    }
    updateRoomBindings(room.id, next);
  };

  const removeBinding = (room: Room, bindingId: string) => {
    const next = (room.bindings ?? []).filter(b => b.id !== bindingId);
    updateRoomBindings(room.id, next);
  };

  const updateBinding = (room: Room, bindingId: string, patch: Partial<RoomDataPointBinding>) => {
    const next = (room.bindings ?? []).map(b => b.id === bindingId ? { ...b, ...patch } : b);
    updateRoomBindings(room.id, next);
  };

  // ---- Monitor Layer management ----
  const saveMonitorLayers = (layers: MonitorLayer[]) => {
    onUpdateBuilding({ ...building, monitorLayers: layers, updatedAt: Date.now() });
  };

  const addMonitorLayer = () => {
    if (!newLayerName.trim()) return;
    const now = Date.now();
    const newLayer: MonitorLayer = {
      id: `layer-${now}`,
      name: newLayerName.trim(),
      unit: newLayerUnit.trim() || undefined,
      colorScale: {
        stops: [{ at: 0, color: '#22c55e' }, { at: 1, color: '#ef4444' }],
        min: 0,
        max: 100,
      },
      order: monitorLayers.length,
    };
    saveMonitorLayers([...monitorLayers, newLayer]);
    setNewLayerName('');
    setNewLayerUnit('');
  };

  const deleteMonitorLayer = (layerId: string) => {
    saveMonitorLayers(monitorLayers.filter(l => l.id !== layerId));
    // also remove from all bindings
    const updatedBuilding: Building = {
      ...building,
      monitorLayers: monitorLayers.filter(l => l.id !== layerId),
      floors: building.floors.map(f => ({
        ...f,
        rooms: f.rooms.map(r => ({
          ...r,
          bindings: (r.bindings ?? []).map(b => ({
            ...b,
            monitorLayerIds: (b.monitorLayerIds ?? []).filter(id => id !== layerId),
          })),
        })),
      })),
      updatedAt: Date.now(),
    };
    onUpdateBuilding(updatedBuilding);
  };

  const toggleBindingLayer = (room: Room, bindingId: string, layerId: string) => {
    const binding = (room.bindings ?? []).find(b => b.id === bindingId);
    if (!binding) return;
    const current = binding.monitorLayerIds ?? [];
    const next = current.includes(layerId)
      ? current.filter(id => id !== layerId)
      : [...current, layerId];
    updateBinding(room, bindingId, { monitorLayerIds: next });
  };

  // binding being configured for layers
  const layerConfigBinding = layerConfigFor && selectedRoom
    ? (selectedRoom.bindings ?? []).find(b => b.id === layerConfigFor)
    : null;

  return (
    <div className="flex h-full bg-slate-900 text-slate-200 overflow-hidden">
      {/* Left sidebar */}
      <div className="w-52 border-r border-slate-700 flex flex-col shrink-0 overflow-hidden">
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

        {/* Monitor layer manager button */}
        <div className="p-3 border-b border-slate-700">
          <button
            onClick={() => setShowLayerManager(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Layers size={11} className="text-sky-400" />
            Monitor-Ebenen
            <span className="ml-auto text-[10px] text-slate-500">{monitorLayers.length}</span>
          </button>
        </div>

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
                    {(room.bindings?.length ?? 0) > 0 && (
                      <span className="text-[9px] text-sky-400 shrink-0">{room.bindings!.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
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
            width="100%" height="100%"
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

            {layers.walls && walls.map(wall => {
              const wp = getWallSvgPoints(wall);
              if (!wp) return null;
              const pts = wp.corners.map(p => `${p.x},${p.y}`).join(' ');
              return (
                <polygon key={wall.id} points={pts} fill="#475569" fillOpacity={0.6} stroke="#64748b" strokeWidth={1} style={{ pointerEvents: 'none' }} />
              );
            })}

            {layers.rooms && rooms.map(room => {
              const poly = getRoomPolygon(room);
              const pts = poly.map(p => `${p.x},${p.y}`).join(' ');
              const isSelected = room.id === selectedRoomId;
              const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
              const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
              const isPolygon = !!(room.points && room.points.length >= 3);
              const bindingCount = room.bindings?.length ?? 0;
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
                  {isSelected && isPolygon && poly.map((p, i) => (
                    <circle
                      key={i} cx={p.x} cy={p.y} r={6}
                      fill="#38bdf8" stroke="#0f172a" strokeWidth={1.5}
                      className="cursor-crosshair"
                      style={{ pointerEvents: 'all' }}
                      onMouseDown={e => handleVertexMouseDown(e, room, i)}
                    />
                  ))}
                  {zoom >= 0.5 && (
                    <text x={cx} y={cy - (bindingCount > 0 ? 6 * zoom : 0)} textAnchor="middle" dominantBaseline="middle"
                      fill={isSelected ? '#e2e8f0' : '#94a3b8'} fontSize={11 * zoom}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {room.name}
                    </text>
                  )}
                  {zoom >= 0.7 && bindingCount > 0 && (
                    <text x={cx} y={cy + 10 * zoom} textAnchor="middle" dominantBaseline="middle"
                      fill="#38bdf8" fontSize={9 * zoom}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {bindingCount} DP
                    </text>
                  )}
                </g>
              );
            })}

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
                {nearFirstPoint && (
                  <circle cx={currentDrawSvgPts[0].x} cy={currentDrawSvgPts[0].y}
                    r={12} fill="#38bdf8" fillOpacity={0.2} stroke="#38bdf8" strokeWidth={2}
                    style={{ pointerEvents: 'none' }} />
                )}
              </g>
            )}

            <text x={12} y={canvasHeight - 12} fill="#334155" fontSize={10} style={{ userSelect: 'none' }}>
              {mousePos.x.toFixed(2)}m, {mousePos.y.toFixed(2)}m
            </text>
          </svg>
        </div>
      </div>

      {/* Right panel */}
      {(selectedRoom || editingRoom) && (
        <div className="w-80 border-l border-slate-700 flex flex-col bg-slate-900 shrink-0 overflow-hidden">
          {/* Tab header */}
          <div className="flex border-b border-slate-700 bg-slate-800 shrink-0">
            <button
              onClick={() => { setRightTab('properties'); setEditingRoom(null); }}
              className={[
                'flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
                rightTab === 'properties' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              Eigenschaften
            </button>
            <button
              onClick={() => { setRightTab('datapoints'); setEditingRoom(null); }}
              className={[
                'flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
                rightTab === 'datapoints' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              Datenpunkte
              {(selectedRoom?.bindings?.length ?? 0) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-sky-600/30 text-sky-400">
                  {selectedRoom!.bindings!.length}
                </span>
              )}
            </button>
          </div>

          {/* Properties tab */}
          {rightTab === 'properties' && !editingRoom && selectedRoom && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: selectedRoom.color || '#94a3b8' }} />
                  <span className="text-sm font-semibold text-white truncate">{selectedRoom.name}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setEditingRoom({ ...selectedRoom })} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Bearbeiten"><Edit3 size={13} /></button>
                  <button onClick={() => onConfigRoom?.(selectedRoom.id)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Panel-Designer"><Settings size={13} /></button>
                  <button onClick={() => deleteRoom(selectedRoom.id)} className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400" title="Löschen"><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/50">
                    <p className="text-slate-500 mb-0.5">Typ</p>
                    <p className="text-slate-200 font-medium">{ROOM_TYPE_LABELS[selectedRoom.type]}</p>
                  </div>
                  {selectedRoom.number && (
                    <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/50">
                      <p className="text-slate-500 mb-0.5">Nummer</p>
                      <p className="text-slate-200 font-medium">{selectedRoom.number}</p>
                    </div>
                  )}
                  <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/50">
                    <p className="text-slate-500 mb-0.5">Datenpunkte</p>
                    <p className="text-slate-200 font-medium">{selectedRoom.bindings?.length ?? 0} / 20</p>
                  </div>
                  {selectedRoom.points && (
                    <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/50">
                      <p className="text-slate-500 mb-0.5">Ecken</p>
                      <p className="text-slate-200 font-medium">{selectedRoom.points.length}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-600 text-center">Raum ziehen zum Verschieben</p>
                {onOpenRoom && (
                  <button onClick={() => onOpenRoom(selectedRoom.id)} className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors">
                    Monitor öffnen
                  </button>
                )}
                {onConfigRoom && (
                  <button onClick={() => onConfigRoom(selectedRoom.id)} className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs flex items-center justify-center gap-2 transition-colors">
                    <LayoutDashboard size={12} />
                    Panel-Designer öffnen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Edit room form */}
          {editingRoom && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Raum bearbeiten</h3>
                <div className="flex gap-0.5">
                  <button onClick={saveEditingRoom} className="p-1.5 hover:bg-slate-700 rounded text-sky-400"><Check size={13} /></button>
                  <button onClick={() => setEditingRoom(null)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><X size={13} /></button>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Name</label>
                  <input type="text" value={editingRoom.name}
                    onChange={e => setEditingRoom(r => r ? { ...r, name: e.target.value } : r)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nummer</label>
                  <input type="text" value={editingRoom.number ?? ''}
                    onChange={e => setEditingRoom(r => r ? { ...r, number: e.target.value } : r)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500" placeholder="z.B. 1.01" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Typ</label>
                  <select value={editingRoom.type}
                    onChange={e => { const t = e.target.value as RoomType; setEditingRoom(r => r ? { ...r, type: t, color: ROOM_TYPE_COLORS[t] } : r); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500">
                    {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Farbe</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editingRoom.color || '#94a3b8'}
                      onChange={e => setEditingRoom(r => r ? { ...r, color: e.target.value } : r)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
                    <span className="text-xs text-slate-400 font-mono">{editingRoom.color}</span>
                  </div>
                </div>
                <button onClick={saveEditingRoom} className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors">
                  Speichern
                </button>
              </div>
            </div>
          )}

          {/* Datapoints tab */}
          {rightTab === 'datapoints' && selectedRoom && !editingRoom && (
            <div className="flex-1 overflow-y-auto">
              {/* Free bindings list */}
              <div className="p-3 border-b border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Datenpunkte ({(selectedRoom.bindings?.length ?? 0)}/20)
                  </p>
                  <button
                    onClick={() => { setShowNewBindingForm(true); setOpenPickerFor('new'); setPickerPageId(null); setDpSearch(''); }}
                    disabled={(selectedRoom.bindings?.length ?? 0) >= 20}
                    className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={11} /> Neu
                  </button>
                </div>

                {(selectedRoom.bindings?.length ?? 0) === 0 && (
                  <div className="py-4 text-center">
                    <Activity size={20} className="mx-auto mb-2 text-slate-700" />
                    <p className="text-xs text-slate-500">Keine Datenpunkte</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Klicke auf "Neu" um einen Datenpunkt zu binden</p>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {(selectedRoom.bindings ?? []).map(binding => (
                    <div key={binding.id} className="bg-slate-800/50 border border-slate-700/40 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{binding.label || binding.datapoint}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{displayLabel(binding.datapoint, datapointLabels)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => setLayerConfigFor(layerConfigFor === binding.id ? null : binding.id)}
                            className={`p-1 rounded transition-colors ${layerConfigFor === binding.id ? 'bg-sky-700 text-sky-200' : 'hover:bg-slate-700 text-slate-500 hover:text-sky-400'}`}
                            title="Ebenen konfigurieren"
                          >
                            <Layers size={11} />
                          </button>
                          <button
                            onClick={() => { setOpenPickerFor(binding.id); setPickerPageId(null); setDpSearch(''); }}
                            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-sky-400 transition-colors"
                            title="Datenpunkt ändern"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => removeBinding(selectedRoom, binding.id)}
                            className="p-1 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors"
                            title="Entfernen"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Alarm & Layer config inline */}
                      {layerConfigFor === binding.id && (
                        <div className="border-t border-slate-700/50 px-3 py-2.5 bg-slate-800/80">
                          <div className="mb-2">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Alarm-Verhalten</p>
                            <div className="flex gap-1">
                              {(['none', 'blink', 'red'] as AlarmBehavior[]).map(ab => (
                                <button
                                  key={ab}
                                  onClick={() => updateBinding(selectedRoom, binding.id, { alarmBehavior: ab })}
                                  className={`flex-1 text-[10px] py-1 rounded-lg transition-colors ${
                                    (binding.alarmBehavior ?? 'none') === ab
                                      ? 'bg-sky-600 text-white'
                                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                  }`}
                                >
                                  {ALARM_BEHAVIOR_LABELS[ab]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {monitorLayers.length > 0 && (
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Sichtbar in Ebene</p>
                              <div className="flex flex-wrap gap-1">
                                {monitorLayers.map(layer => {
                                  const active = (binding.monitorLayerIds ?? []).includes(layer.id);
                                  return (
                                    <button
                                      key={layer.id}
                                      onClick={() => toggleBindingLayer(selectedRoom, binding.id, layer.id)}
                                      className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                                        active ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                      }`}
                                    >
                                      {layer.name}
                                    </button>
                                  );
                                })}
                              </div>
                              {monitorLayers.length === 0 && (
                                <p className="text-[10px] text-slate-600">Keine Monitor-Ebenen definiert</p>
                              )}
                            </div>
                          )}
                          {monitorLayers.length === 0 && (
                            <button
                              onClick={() => setShowLayerManager(true)}
                              className="text-[10px] text-sky-500 hover:text-sky-400 transition-colors"
                            >
                              Monitor-Ebenen erstellen →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* HVAC Quick-select */}
              <div className="p-3">
                <button
                  onClick={() => setShowHvacQuick(!showHvacQuick)}
                  className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider font-semibold mb-2"
                >
                  <span className="flex items-center gap-1.5"><Star size={10} /> HLK Schnellauswahl</span>
                  {showHvacQuick ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>

                {showHvacQuick && (
                  <div className="flex flex-col gap-1">
                    {BINDING_ROLE_CATEGORIES.map(cat => {
                      const isOpen = expandedCats[cat.id] !== false;
                      const roles = BINDING_ROLES.filter(r => cat.keys.includes(r.key));
                      const assigned = roles.filter(r => {
                        const bindingId = `${selectedRoom.id}-${r.key}`;
                        return (selectedRoom.bindings ?? []).find(b => b.id === bindingId)?.datapoint;
                      }).length;
                      return (
                        <div key={cat.id} className="border border-slate-800 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedCats(s => ({ ...s, [cat.id]: !isOpen }))}
                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-200">{cat.label}</span>
                              {assigned > 0 && (
                                <span className="text-[9px] text-sky-400 bg-sky-900/40 px-1.5 py-0.5 rounded-full">{assigned}/{roles.length}</span>
                              )}
                            </div>
                            {isOpen ? <ChevronDown size={11} className="text-slate-500" /> : <ChevronRight size={11} className="text-slate-500" />}
                          </button>

                          {isOpen && (
                            <div className="divide-y divide-slate-800/60">
                              {roles.map(role => {
                                const bindingId = `${selectedRoom.id}-${role.key}`;
                                const binding = (selectedRoom.bindings ?? []).find(b => b.id === bindingId);
                                const hasBinding = !!(binding?.datapoint);
                                return (
                                  <div key={role.key} className={`px-3 py-2.5 ${hasBinding ? 'bg-slate-800/20' : ''}`}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all"
                                        style={hasBinding
                                          ? { backgroundColor: role.accent + '22', borderColor: role.accent + '66', color: role.accent }
                                          : { backgroundColor: '#1e293b', borderColor: '#334155', color: '#64748b' }
                                        }
                                      >
                                        {role.icon}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-medium ${hasBinding ? 'text-white' : 'text-slate-400'}`}>{role.label}</p>
                                        {hasBinding ? (
                                          <p className="text-[10px] text-slate-500 font-mono truncate">{displayLabel(binding!.datapoint, datapointLabels)}</p>
                                        ) : (
                                          <p className="text-[10px] text-slate-600">{role.unit || 'kein Datenpunkt'}</p>
                                        )}
                                      </div>
                                      {hasBinding ? (
                                        <button
                                          onClick={() => setHvacBinding(selectedRoom, role.key, '')}
                                          className="p-1 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                                        >
                                          <X size={12} />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => { setOpenPickerFor(`hvac:${role.key}`); setPickerPageId(null); setDpSearch(''); }}
                                          className="p-1 rounded hover:bg-sky-900/40 text-slate-600 hover:text-sky-400 transition-colors shrink-0"
                                        >
                                          <Plus size={12} />
                                        </button>
                                      )}
                                    </div>
                                    {hasBinding && (
                                      <button
                                        onClick={() => { setOpenPickerFor(`hvac:${role.key}`); setPickerPageId(null); setDpSearch(''); }}
                                        className="mt-1 w-full text-left text-[10px] text-slate-600 hover:text-sky-400 transition-colors flex items-center gap-1 pl-9"
                                      >
                                        <Search size={9} /> ändern
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Datapoint picker modal */}
      {openPickerFor && selectedRoom && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setOpenPickerFor(null); setShowNewBindingForm(false); }}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Datenpunkt wählen</p>
                <p className="text-sm font-semibold text-white">
                  {openPickerFor === 'new' ? 'Neuer Datenpunkt'
                    : openPickerFor.startsWith('hvac:') ? (BINDING_ROLES.find(r => r.key === openPickerFor.slice(5))?.label ?? openPickerFor)
                    : ((selectedRoom.bindings ?? []).find(b => b.id === openPickerFor)?.label ?? 'Datenpunkt ändern')}
                </p>
              </div>
              <button onClick={() => { setOpenPickerFor(null); setShowNewBindingForm(false); }} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* New binding meta form (only for 'new') */}
            {openPickerFor === 'new' && showNewBindingForm && (
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Bezeichnung</label>
                    <input value={newBindingLabel} onChange={e => setNewBindingLabel(e.target.value)} placeholder="z.B. Temperatur"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Einheit</label>
                    <input value={newBindingUnit} onChange={e => setNewBindingUnit(e.target.value)} placeholder="°C, %, ppm…"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Kategorie</label>
                    <select value={newBindingCategory} onChange={e => setNewBindingCategory(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
                      {['temperature','setpoint','humidity','co2','airflow','occupancy','alarm','energy','valve','fanSpeed','light','pump','generic'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-0.5">Min</label>
                      <input type="number" value={newBindingMin} onChange={e => setNewBindingMin(e.target.value)} placeholder="0"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-0.5">Max</label>
                      <input type="number" value={newBindingMax} onChange={e => setNewBindingMax(e.target.value)} placeholder="100"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500" />
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={newBindingWritable} onChange={e => setNewBindingWritable(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-sky-500" />
                  Schreibbar (Sollwert)
                </label>
                <p className="text-[10px] text-slate-600">Wähle unten den Datenpunkt aus dem Treiber oder der Logik</p>
              </div>
            )}

            {pickerPageId !== null && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/60">
                <button
                  onClick={() => { setPickerPageId(null); setDpSearch(''); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight size={13} className="rotate-180" />
                  Zurück
                </button>
                <span className="text-slate-600 text-xs">/</span>
                <span className="text-xs text-slate-200 font-medium truncate">
                  {datapointGroups.find(g => g.pageId === pickerPageId)?.pageName ?? pickerPageId}
                </span>
              </div>
            )}

            <div className="px-4 py-2 border-b border-slate-800">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
                <Search size={13} className="text-slate-500 shrink-0" />
                <input
                  autoFocus
                  type="text" value={dpSearch}
                  onChange={e => setDpSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="flex-1 bg-transparent text-slate-200 text-xs outline-none placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {pickerPageId === null ? (
                datapointGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Activity size={28} className="mb-2 opacity-30" />
                    <span className="text-xs">Keine Logik-Datenpunkte gefunden</span>
                  </div>
                ) : (
                  datapointGroups
                    .filter(g => !dpSearch || g.pageName.toLowerCase().includes(dpSearch.toLowerCase())
                      || g.datapoints.some(d => d.entityId.toLowerCase().includes(dpSearch.toLowerCase()) || d.label.toLowerCase().includes(dpSearch.toLowerCase())))
                    .map(g => (
                      <button
                        key={g.pageId}
                        onClick={() => { setPickerPageId(g.pageId); setDpSearch(''); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <Zap size={13} className="text-emerald-400" />
                          </div>
                          <span className="text-xs text-slate-200 font-medium">{g.pageName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{g.datapoints.length}</span>
                          <ChevronRight size={13} className="text-slate-500" />
                        </div>
                      </button>
                    ))
                )
              ) : (() => {
                const g = datapointGroups.find(x => x.pageId === pickerPageId);
                const q = dpSearch.trim().toLowerCase();
                const list = g ? (q
                  ? g.datapoints.filter(d => d.entityId.toLowerCase().includes(q) || d.label.toLowerCase().includes(q) || displayLabel(d.entityId, datapointLabels).toLowerCase().includes(q))
                  : g.datapoints) : [];
                if (list.length === 0) {
                  return <div className="py-10 text-center text-xs text-slate-500">Keine Treffer</div>;
                }
                return list.map(dp => {
                  const human = displayLabel(dp.entityId, datapointLabels);
                  const primary = dp.label && dp.label !== dp.entityId ? dp.label : human;
                  const showSub = primary !== dp.entityId;
                  return (
                    <button
                      key={dp.entityId}
                      onClick={() => {
                        if (openPickerFor === 'new') {
                          addFreeBinding(selectedRoom, dp.entityId);
                        } else if (openPickerFor?.startsWith('hvac:')) {
                          setHvacBinding(selectedRoom, openPickerFor.slice(5), dp.entityId);
                        } else {
                          // change existing binding datapoint
                          updateBinding(selectedRoom, openPickerFor!, { datapoint: dp.entityId });
                        }
                        setOpenPickerFor(null);
                        setShowNewBindingForm(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-800 border-b border-slate-800/30 transition-colors text-left"
                    >
                      <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center shrink-0">
                        <Zap size={11} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-200 truncate">{primary}</div>
                        {showSub && <div className="text-[10px] text-slate-500 font-mono truncate">{dp.entityId}</div>}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Monitor Layer Manager Modal */}
      {showLayerManager && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowLayerManager(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Monitor-Ebenen</p>
                <p className="text-sm font-semibold text-white">Ebenen verwalten</p>
              </div>
              <button onClick={() => setShowLayerManager(false)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              <p className="text-xs text-slate-500">
                Definiere Ebenen für den Monitor-Modus. Pro Datenpunkt kannst du festlegen, in welcher Ebene er sichtbar ist und zur Raumeinfärbung verwendet wird.
              </p>

              {monitorLayers.length === 0 && (
                <div className="py-6 text-center text-slate-600 text-xs">
                  <Layers size={24} className="mx-auto mb-2 opacity-30" />
                  <p>Noch keine Ebenen definiert</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {monitorLayers.map(layer => (
                  <div key={layer.id} className="bg-slate-800/50 border border-slate-700/40 rounded-xl px-3 py-2.5 flex items-center gap-3">
                    {editingLayer?.id === layer.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          value={editingLayer.name}
                          onChange={e => setEditingLayer({ ...editingLayer, name: e.target.value })}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                          autoFocus
                        />
                        <input
                          value={editingLayer.unit ?? ''}
                          onChange={e => setEditingLayer({ ...editingLayer, unit: e.target.value })}
                          placeholder="Einheit"
                          className="w-16 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                        />
                        <button onClick={() => {
                          saveMonitorLayers(monitorLayers.map(l => l.id === editingLayer.id ? editingLayer : l));
                          setEditingLayer(null);
                        }} className="p-1 hover:bg-sky-700 rounded text-sky-400"><Check size={12} /></button>
                        <button onClick={() => setEditingLayer(null)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X size={12} /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200">{layer.name}</p>
                          {layer.unit && <p className="text-[10px] text-slate-500">{layer.unit}</p>}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => setEditingLayer({ ...layer })} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors">
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => deleteMonitorLayer(layer.id)} className="p-1 hover:bg-red-900/40 rounded text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new layer form */}
              <div className="border border-slate-700/60 rounded-xl p-3 bg-slate-800/30">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Neue Ebene</p>
                <div className="flex gap-2">
                  <input
                    value={newLayerName}
                    onChange={e => setNewLayerName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMonitorLayer()}
                    placeholder="Name z.B. Temperatur"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 placeholder-slate-600"
                  />
                  <input
                    value={newLayerUnit}
                    onChange={e => setNewLayerUnit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMonitorLayer()}
                    placeholder="°C"
                    className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 placeholder-slate-600"
                  />
                  <button
                    onClick={addMonitorLayer}
                    disabled={!newLayerName.trim()}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Plus size={12} /> Hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
