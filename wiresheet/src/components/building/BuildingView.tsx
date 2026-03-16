import { useState, useMemo, useRef, useEffect } from 'react';
import type { MultiSelection } from './FloorPlanEditor';
import {
  Building2, Plus, Trash2, ChevronUp, ChevronDown, Pencil,
  Layers, Box, MousePointer, MousePointer2, Square, Settings2, X, Minus, Sun,
  Wind, Thermometer, Droplets, Bell, Activity,
  Zap, Fan, Lightbulb, ChevronsUpDown, Radio, Box as BoxIcon, Search, RefreshCw,
  Eye, EyeOff
} from 'lucide-react';
import { useBuildingEditor } from '../../hooks/useBuildingEditor';
import { BuildingCanvas3D, LightingSettings, DEFAULT_LIGHTING } from './BuildingCanvas3D';
import { FloorPlanEditor } from './FloorPlanEditor';
import { SectionView } from './SectionView';
import { Room, RoomType, Wall, WallOpening, WallOpeningType, BackgroundImage, Widget3D, Widget3DType, Duct, Pipe, DuctType, PipeType, DuctShape, Slab, DEFAULT_LAYERS, FloorLayers } from '../../types/building';
import { WIDGET_COLORS, WIDGET_LABELS } from './Building3DWidgets';
import { HaEntity, WiresheetPage } from '../../types/flow';

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  room: 'Zimmer',
  corridor: 'Flur',
  staircase: 'Treppenhaus',
  elevator: 'Aufzug',
  bathroom: 'Bad',
  kitchen: 'Küche',
  office: 'Büro',
  storage: 'Lager',
  garage: 'Garage',
  outdoor: 'Außenbereich',
};

const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  room: '#94a3b8',
  corridor: '#cbd5e1',
  staircase: '#fbbf24',
  elevator: '#60a5fa',
  bathroom: '#67e8f9',
  kitchen: '#86efac',
  office: '#a78bfa',
  storage: '#d1d5db',
  garage: '#9ca3af',
  outdoor: '#6ee7b7',
};

const DUCT_TYPE_LABELS: Record<DuctType, string> = {
  supply: 'Zuluft',
  return: 'Abluft',
  exhaust: 'Fortluft',
  fresh: 'Frischluft',
};

const DUCT_TYPE_COLORS: Record<DuctType, string> = {
  supply: '#60a5fa',
  return: '#94a3b8',
  exhaust: '#fbbf24',
  fresh: '#34d399',
};

const PIPE_TYPE_LABELS: Record<PipeType, string> = {
  supply: 'Vorlauf',
  return: 'Rücklauf',
  'domestic-hot': 'Warmwasser',
  'domestic-cold': 'Kaltwasser',
  sprinkler: 'Sprinkler',
  gas: 'Gas',
};

const PIPE_TYPE_COLORS: Record<PipeType, string> = {
  supply: '#ef4444',
  return: '#3b82f6',
  'domestic-hot': '#f97316',
  'domestic-cold': '#06b6d4',
  sprinkler: '#22c55e',
  gas: '#facc15',
};

const WIDGET_TYPE_ICONS: Partial<Record<Widget3DType, React.ReactNode>> = {
  temperature: <Thermometer className="w-3 h-3" />,
  humidity: <Droplets className="w-3 h-3" />,
  alarm: <Bell className="w-3 h-3" />,
  co2: <Activity className="w-3 h-3" />,
  energy: <Zap className="w-3 h-3" />,
  fan: <Fan className="w-3 h-3" />,
  light: <Lightbulb className="w-3 h-3" />,
  presence: <Radio className="w-3 h-3" />,
  setpoint: <ChevronsUpDown className="w-3 h-3" />,
  custom: <BoxIcon className="w-3 h-3" />,
  'fire-damper': <Wind className="w-3 h-3" />,
  boolean: <Activity className="w-3 h-3" />,
};

type ViewMode = '3d' | 'floor' | 'section';

interface BuildingViewProps {
  haEntities?: HaEntity[];
  haLoading?: boolean;
  onLoadHaEntities?: () => void;
  pages?: WiresheetPage[];
  liveValues?: Record<string, string | number | boolean>;
}

export function BuildingView({ haEntities = [], haLoading = false, onLoadHaEntities, pages = [], liveValues = {} }: BuildingViewProps) {
  const {
    buildings,
    activeBuildingId,
    activeFloorId,
    activeBuilding,
    activeFloor,
    selectedRoomId,
    selectedWallId,
    tool,
    setActiveBuildingId,
    setActiveFloorId,
    setSelectedRoomId,
    setSelectedWallId,
    setTool,
    addBuilding,
    renameBuilding,
    deleteBuilding,
    addFloor,
    addFloorBelow,
    renameFloor,
    updateFloorHeight,
    updateFloorColor,
    updateFloorProps,
    deleteFloor,
    setFloorBackground,
    addWall,
    updateWall,
    deleteWall,
    addRoom,
    updateRoom,
    deleteRoom,
    addWallOpening,
    updateWallOpening,
    deleteWallOpening,
    updateFloorLayers,
    addDuct,
    updateDuct,
    moveDuctPoint,
    insertDuctPoint,
    removeDuctPoint,
    moveDuct,
    deleteDuct,
    connectDuctEndpoints,
    mergeDucts,
    splitDuct,
    addPipe,
    updatePipe,
    movePipePoint,
    movePipe,
    deletePipe,
    addSlab,
    updateSlab,
    deleteSlab,
    addPolygonRoom,
    moveMultiSelection,
    pasteComponents,
    selectedWidget3DId,
    setSelectedWidget3DId,
    addWidget3D,
    updateWidget3D,
    deleteWidget3D,
    ROOM_COLORS,
    undo,
  } = useBuildingEditor();

  const [viewMode, setViewMode] = useState<ViewMode>('floor');
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [editingBuildingName, setEditingBuildingName] = useState('');
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingFloorName, setEditingFloorName] = useState('');
  const [newRoomType, setNewRoomType] = useState<RoomType>('room');
  const [showRoomPanel, setShowRoomPanel] = useState(true);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [floorOverlays, setFloorOverlays] = useState<Record<string, boolean>>({});
  const [wallThickness, setWallThickness] = useState(0.25);
  const [gridSize, setGridSize] = useState(1);
  const [bgColor, setBgColor] = useState('#0a1020');
  const [floorTransparent, setFloorTransparent] = useState(false);
  const [bgTransparent, setBgTransparent] = useState(false);
  const [showGrid3D, setShowGrid3D] = useState(true);
  const [lighting, setLighting] = useState<LightingSettings>(DEFAULT_LIGHTING);
  const [showLightingPanel, setShowLightingPanel] = useState(false);

  const [selectedDuctId, setSelectedDuctId] = useState<string | null>(null);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [selectedSlabId, setSelectedSlabId] = useState<string | null>(null);
  const [ductType, setDuctType] = useState<DuctType>('supply');
  const [ductShape, setDuctShape] = useState<DuctShape>('rectangular');
  const [ductWidth, setDuctWidth] = useState(0.3);
  const [ductHeight, setDuctHeight] = useState(0.2);
  const [pipeType, setPipeType] = useState<PipeType>('supply');
  const [pipeDiameter, setPipeDiameter] = useState(0.05);

  const [showWidget3DPanel, setShowWidget3DPanel] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState<Widget3DType>('temperature');
  const [newWidgetDatapoint, setNewWidgetDatapoint] = useState('');
  const [newWidgetLabel, setNewWidgetLabel] = useState('');
  const [newWidgetUnit, setNewWidgetUnit] = useState('');
  const [newWidgetX, setNewWidgetX] = useState(0);
  const [newWidgetY, setNewWidgetY] = useState(0);
  const [newWidgetZ, setNewWidgetZ] = useState(1);
  const [entitySearch, setEntitySearch] = useState('');
  const [datapointPickerOpen, setDatapointPickerOpen] = useState(false);
  const [datapointPickerTarget, setDatapointPickerTarget] = useState<'new' | 'widget' | 'alarm'>('new');
  const [newWidgetRoomIds, setNewWidgetRoomIds] = useState<string[]>([]);
  const [newWidgetOpacity, setNewWidgetOpacity] = useState(0.45);
  const [newWidgetColor, setNewWidgetColor] = useState('#22c55e');
  const [newWidgetColorFalse, setNewWidgetColorFalse] = useState('');
  const [pickerTab, setPickerTab] = useState<'driver' | 'logic'>('driver');
  const [pickerDevice, setPickerDevice] = useState<string | null>(null);
  const [widgetPlacementMode, setWidgetPlacementMode] = useState(false);

  const clipboardRef = useRef<{
    walls: Wall[];
    rooms: Room[];
    ducts: Duct[];
    pipes: Pipe[];
  }>({ walls: [], rooms: [], ducts: [], pipes: [] });

  const [pastedMultiSel, setPastedMultiSel] = useState<MultiSelection | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  const handleCopySelected = (sel: MultiSelection) => {
    if (!activeFloor) return;
    clipboardRef.current = {
      walls: activeFloor.walls.filter(w => sel.wallIds.includes(w.id)),
      rooms: activeFloor.rooms.filter(r => sel.roomIds.includes(r.id)),
      ducts: (activeFloor.ducts ?? []).filter(d => sel.ductIds.includes(d.id)),
      pipes: (activeFloor.pipes ?? []).filter(p => sel.pipeIds.includes(p.id)),
    };
  };

  const handlePasteClipboard = () => {
    if (!activeBuilding || !activeFloor) return;
    const { walls, rooms, ducts, pipes } = clipboardRef.current;
    const newIds = pasteComponents(activeBuilding.id, activeFloor.id, walls, rooms, ducts, pipes, 1);
    setPastedMultiSel({ ...newIds });
    setTimeout(() => setPastedMultiSel(null), 50);
  };

  const handleDeleteSelected = (sel: MultiSelection) => {
    if (!activeBuilding || !activeFloor) return;
    for (const id of sel.wallIds) deleteWall(activeBuilding.id, activeFloor.id, id);
    for (const id of sel.roomIds) deleteRoom(activeBuilding.id, activeFloor.id, id);
    for (const id of sel.ductIds) deleteDuct(activeBuilding.id, activeFloor.id, id);
    for (const id of sel.pipeIds) deletePipe(activeBuilding.id, activeFloor.id, id);
  };

  const handleDuplicateSelected = (sel: MultiSelection) => {
    if (!activeBuilding || !activeFloor) return;
    const walls = activeFloor.walls.filter(w => sel.wallIds.includes(w.id));
    const rooms = activeFloor.rooms.filter(r => sel.roomIds.includes(r.id));
    const ducts = (activeFloor.ducts ?? []).filter(d => sel.ductIds.includes(d.id));
    const pipes = (activeFloor.pipes ?? []).filter(p => sel.pipeIds.includes(p.id));
    const newIds = pasteComponents(activeBuilding.id, activeFloor.id, walls, rooms, ducts, pipes, 1);
    setPastedMultiSel({ ...newIds });
    setTimeout(() => setPastedMultiSel(null), 50);
  };

  const handleMoveMultiSelection = (sel: MultiSelection, dx: number, dy: number) => {
    if (!activeBuilding || !activeFloor) return;
    moveMultiSelection(activeBuilding.id, activeFloor.id, sel, dx, dy);
  };

  const selectedRoom = activeFloor?.rooms.find(r => r.id === selectedRoomId) ?? null;
  const selectedWall = activeFloor?.walls.find(w => w.id === selectedWallId) ?? null;
  const selectedDuct = activeFloor?.ducts?.find(d => d.id === selectedDuctId) ?? null;
  const selectedPipe = activeFloor?.pipes?.find(p => p.id === selectedPipeId) ?? null;
  const selectedSlab = activeFloor?.slabs?.find(s => s.id === selectedSlabId) ?? null;
  const selectedWidget = activeBuilding?.widgets3d?.find(w => w.id === selectedWidget3DId) ?? null;

  const filteredEntities = useMemo(() => {
    const q = entitySearch.trim().toLowerCase();
    const all = q
      ? haEntities.filter(e =>
          e.entity_id.toLowerCase().includes(q) ||
          String(e.attributes.friendly_name || '').toLowerCase().includes(q)
        )
      : haEntities;
    return all.slice(0, 200);
  }, [haEntities, entitySearch]);

  const groupedEntities = useMemo(() => {
    const groups: Record<string, typeof filteredEntities> = {};
    for (const e of filteredEntities) {
      const domain = e.entity_id.split('.')[0] || 'other';
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(e);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEntities]);

  const handleAddWall = (x1: number, y1: number, x2: number, y2: number, thickness: number) => {
    if (!activeBuilding || !activeFloor) return;
    addWall(activeBuilding.id, activeFloor.id, x1, y1, x2, y2, thickness);
  };

  const handleMoveWallPoint = (wallId: string, point: 'start' | 'end', x: number, y: number) => {
    if (!activeBuilding || !activeFloor) return;
    if (point === 'start') updateWall(activeBuilding.id, activeFloor.id, wallId, { x1: x, y1: y });
    else updateWall(activeBuilding.id, activeFloor.id, wallId, { x2: x, y2: y });
  };

  const handleMoveWall = (wallId: string, dx: number, dy: number) => {
    if (!activeBuilding || !activeFloor) return;
    const wall = activeFloor.walls.find(w => w.id === wallId);
    if (!wall) return;
    updateWall(activeBuilding.id, activeFloor.id, wallId, {
      x1: wall.x1 + dx, y1: wall.y1 + dy,
      x2: wall.x2 + dx, y2: wall.y2 + dy,
    });
  };

  const handleAddRoom = (x: number, y: number, w: number, d: number) => {
    if (!activeBuilding || !activeFloor) return;
    addRoom(activeBuilding.id, activeFloor.id, x, y, w, d, newRoomType);
  };

  const handleMoveRoom = (roomId: string, x: number, y: number) => {
    if (!activeBuilding || !activeFloor) return;
    updateRoom(activeBuilding.id, activeFloor.id, roomId, { x, y });
  };

  const handleDeleteWall = (wallId: string) => {
    if (!activeBuilding || !activeFloor) return;
    deleteWall(activeBuilding.id, activeFloor.id, wallId);
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!activeBuilding || !activeFloor) return;
    deleteRoom(activeBuilding.id, activeFloor.id, roomId);
  };

  const handleUpdateRoom = (changes: Partial<Room>) => {
    if (!activeBuilding || !activeFloor || !selectedRoomId) return;
    updateRoom(activeBuilding.id, activeFloor.id, selectedRoomId, changes);
  };

  const handleUpdateWall = (changes: Partial<Wall>) => {
    if (!activeBuilding || !activeFloor || !selectedWallId) return;
    updateWall(activeBuilding.id, activeFloor.id, selectedWallId, changes);
  };

  const handleSetBackground = (bg: BackgroundImage | null) => {
    if (!activeBuilding || !activeFloor) return;
    setFloorBackground(activeBuilding.id, activeFloor.id, bg);
  };

  const handleAddDuct = (ductData: Omit<Duct, 'id'>) => {
    if (!activeBuilding || !activeFloor) return;
    addDuct(activeBuilding.id, activeFloor.id, ductData);
  };

  const handleAddPipe = (pipeData: Omit<Pipe, 'id'>) => {
    if (!activeBuilding || !activeFloor) return;
    addPipe(activeBuilding.id, activeFloor.id, pipeData);
  };

  const handleAddWidget3D = (placeX?: number, placeY?: number, placeZ?: number) => {
    if (!activeBuilding || !activeFloor) return;
    addWidget3D(activeBuilding.id, {
      type: newWidgetType,
      label: newWidgetLabel || WIDGET_LABELS[newWidgetType],
      datapoint: newWidgetDatapoint,
      unit: newWidgetUnit,
      x: placeX ?? newWidgetX,
      y: placeY ?? newWidgetY,
      z: placeZ ?? newWidgetZ,
      floorId: activeFloor.id,
      scale: 1,
      color: newWidgetType === 'roomcolor' ? newWidgetColor : (WIDGET_COLORS[newWidgetType] || '#94a3b8'),
      showLabel: true,
      showValue: true,
      roomIds: newWidgetType === 'roomcolor' ? [...newWidgetRoomIds] : [],
      opacity: newWidgetType === 'roomcolor' ? newWidgetOpacity : undefined,
      ...(newWidgetType === 'roomcolor' && newWidgetColorFalse ? { colorFalse: newWidgetColorFalse } : {}),
    } as any);
    setNewWidgetDatapoint('');
    setNewWidgetLabel('');
    setNewWidgetRoomIds([]);
    setNewWidgetOpacity(0.45);
    setNewWidgetColor('#22c55e');
    setNewWidgetColorFalse('');
    setWidgetPlacementMode(false);
  };

  const handlePlaceWidget = (x: number, y: number, z: number, floorId: string) => {
    if (!activeBuilding || !widgetPlacementMode) return;
    addWidget3D(activeBuilding.id, {
      type: newWidgetType,
      label: newWidgetLabel || WIDGET_LABELS[newWidgetType],
      datapoint: newWidgetDatapoint,
      unit: newWidgetUnit,
      x,
      y,
      z,
      floorId,
      scale: 1,
      color: newWidgetType === 'roomcolor' ? newWidgetColor : (WIDGET_COLORS[newWidgetType] || '#94a3b8'),
      showLabel: true,
      showValue: true,
      roomIds: newWidgetType === 'roomcolor' ? [...newWidgetRoomIds] : [],
      opacity: newWidgetType === 'roomcolor' ? newWidgetOpacity : undefined,
      ...(newWidgetType === 'roomcolor' && newWidgetColorFalse ? { colorFalse: newWidgetColorFalse } : {}),
    } as any);
    setNewWidgetDatapoint('');
    setNewWidgetLabel('');
    setNewWidgetRoomIds([]);
    setNewWidgetOpacity(0.45);
    setNewWidgetColor('#22c55e');
    setNewWidgetColorFalse('');
    setWidgetPlacementMode(false);
  };

  const logicPageGroups = useMemo(() => {
    return pages.map(page => ({
      pageId: page.id,
      pageName: page.name,
      datapoints: page.nodes
        .filter(n => n.type.startsWith('dp-') || n.data.outputs?.length > 0)
        .flatMap(n => {
          const baseLabel = n.data.label || n.id;
          const outputs = n.data.outputs ?? [];
          if (outputs.length <= 1) {
            return [{ entityId: n.id, label: baseLabel, nodeId: n.id, port: null as string | null }];
          }
          return outputs.map((out, idx) => ({
            entityId: `${n.id}:output-${idx + 1}`,
            label: `${baseLabel} › ${out.label || `Ausgang ${idx + 1}`}`,
            nodeId: n.id,
            port: `output-${idx + 1}`,
          }));
        })
        .filter((dp, idx, arr) => arr.findIndex(d => d.entityId === dp.entityId) === idx),
    })).filter(g => g.datapoints.length > 0);
  }, [pages]);

  const openDatapointPicker = (target: 'new' | 'widget' | 'alarm') => {
    setDatapointPickerTarget(target);
    setEntitySearch('');
    setPickerTab('driver');
    setPickerDevice(null);
    setDatapointPickerOpen(true);
    if (haEntities.length === 0) onLoadHaEntities?.();
  };

  const selectDatapoint = (entityId: string) => {
    if (datapointPickerTarget === 'new') {
      setNewWidgetDatapoint(entityId);
    } else if (datapointPickerTarget === 'widget' && selectedWidget && activeBuilding) {
      updateWidget3D(activeBuilding.id, selectedWidget.id, { datapoint: entityId });
    } else if (datapointPickerTarget === 'alarm' && selectedWidget && activeBuilding) {
      updateWidget3D(activeBuilding.id, selectedWidget.id, { alarmDatapoint: entityId });
    }
    setDatapointPickerOpen(false);
  };

  const propertiesPanelTitle = () => {
    if (selectedWidget) return 'Widget';
    if (selectedDuct) return 'Lüftungskanal';
    if (selectedPipe) return 'Leitung';
    if (selectedSlab) return 'Bodenplatte';
    if (selectedWall) return 'Wand';
    if (selectedRoom) return 'Raum';
    return 'Eigenschaften';
  };

  return (
    <div className="flex h-full overflow-hidden bg-slate-900 text-slate-100">
      <div className="w-52 flex-shrink-0 flex flex-col border-r border-slate-700 bg-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Gebäude
          </span>
          <button
            onClick={addBuilding}
            className="w-5 h-5 rounded hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {buildings.map(building => (
            <div key={building.id}>
              <div
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group ${building.id === activeBuildingId ? 'bg-slate-700' : 'hover:bg-slate-750'}`}
                onClick={() => {
                  setActiveBuildingId(building.id);
                  setActiveFloorId(building.floors[0]?.id || '');
                  building.floors.forEach(f => {
                    if (f.hidden) updateFloorProps(building.id, f.id, { hidden: false });
                  });
                }}
              >
                <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${building.id === activeBuildingId ? 'text-blue-400' : 'text-slate-500'}`} />
                {editingBuildingId === building.id ? (
                  <input
                    className="flex-1 bg-slate-600 text-white text-xs px-1 py-0.5 rounded outline-none border border-blue-500"
                    value={editingBuildingName}
                    onChange={e => setEditingBuildingName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { renameBuilding(building.id, editingBuildingName); setEditingBuildingId(null); } if (e.key === 'Escape') setEditingBuildingId(null); }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-xs text-slate-300 truncate">{building.name}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); setEditingBuildingId(building.id); setEditingBuildingName(building.name); }} className="w-4 h-4 hover:text-white text-slate-500 flex items-center justify-center"><Pencil className="w-2.5 h-2.5" /></button>
                  {buildings.length > 1 && <button onClick={e => { e.stopPropagation(); deleteBuilding(building.id); }} className="w-4 h-4 hover:text-red-400 text-slate-500 flex items-center justify-center"><Trash2 className="w-2.5 h-2.5" /></button>}
                </div>
              </div>

              {building.id === activeBuildingId && (
                <div className="ml-3 border-l border-slate-700 pl-1">
                  {[...building.floors].sort((a, b) => b.level - a.level).map(floor => (
                    <div
                      key={floor.id}
                      className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group ${floor.id === activeFloorId ? 'bg-slate-600 rounded-r' : 'hover:bg-slate-700 rounded-r'} ${floor.hidden ? 'opacity-50' : ''}`}
                      onClick={() => setActiveFloorId(floor.id)}
                    >
                      <Layers className={`w-3 h-3 flex-shrink-0 ${floor.id === activeFloorId ? 'text-blue-400' : 'text-slate-500'}`} />
                      {editingFloorId === floor.id ? (
                        <input
                          className="flex-1 bg-slate-600 text-white text-xs px-1 py-0.5 rounded outline-none border border-blue-500"
                          value={editingFloorName}
                          onChange={e => setEditingFloorName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { renameFloor(building.id, floor.id, editingFloorName); setEditingFloorId(null); } if (e.key === 'Escape') setEditingFloorId(null); }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-xs text-slate-300 truncate">{floor.name}</span>
                      )}
                      <span className="text-[10px] text-slate-500 shrink-0">{floor.level >= 0 ? `+${floor.level}` : floor.level}</span>
                      <button
                        onClick={e => { e.stopPropagation(); updateFloorProps(building.id, floor.id, { hidden: !floor.hidden }); }}
                        className={`w-4 h-4 flex-shrink-0 flex items-center justify-center transition-colors ${floor.hidden ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-white opacity-0 group-hover:opacity-100'}`}
                        title={floor.hidden ? 'Etage einblenden' : 'Etage ausblenden'}
                      >
                        {floor.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <button onClick={e => { e.stopPropagation(); setEditingFloorId(floor.id); setEditingFloorName(floor.name); }} className="w-4 h-4 hover:text-white text-slate-500 flex items-center justify-center"><Pencil className="w-2.5 h-2.5" /></button>
                        {building.floors.length > 1 && <button onClick={e => { e.stopPropagation(); deleteFloor(building.id, floor.id); }} className="w-4 h-4 hover:text-red-400 text-slate-500 flex items-center justify-center"><Trash2 className="w-2.5 h-2.5" /></button>}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-0.5 px-2 py-1">
                    <button onClick={() => addFloor(building.id)} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded hover:bg-slate-700 flex-1">
                      <ChevronUp className="w-3 h-3" /> OG
                    </button>
                    <button onClick={() => addFloorBelow(building.id)} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 px-1.5 py-0.5 rounded hover:bg-slate-700 flex-1">
                      <ChevronDown className="w-3 h-3" /> UG
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-700 p-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Wanddicke</div>
          <div className="flex items-center gap-2">
            <input
              type="range" min="0.05" max="1" step="0.05"
              value={wallThickness}
              onChange={e => setWallThickness(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-blue-500"
            />
            <input
              type="number" min="5" max="100" step="5"
              value={Math.round(wallThickness * 100)}
              onChange={e => {
                const cm = parseInt(e.target.value) || 25;
                setWallThickness(Math.max(0.05, Math.min(1, cm / 100)));
              }}
              className="w-14 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-1.5 py-1 rounded outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-500">cm</span>
          </div>
        </div>
        <div className="border-t border-slate-700 p-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Raster</div>
          <div className="flex items-center gap-2">
            <input
              type="range" min="0.05" max="2" step="0.05"
              value={gridSize}
              onChange={e => setGridSize(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-blue-500"
            />
            <input
              type="number" min="5" max="200" step="5"
              value={Math.round(gridSize * 100)}
              onChange={e => {
                const cm = parseInt(e.target.value) || 5;
                setGridSize(Math.max(0.05, Math.min(2, cm / 100)));
              }}
              className="w-14 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-1.5 py-1 rounded outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-500">cm</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {[5, 10, 25, 50, 100].map(cm => (
              <button
                key={cm}
                onClick={() => setGridSize(cm / 100)}
                className={`px-1.5 py-0.5 rounded text-[10px] border ${Math.round(gridSize * 100) === cm ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-600'}`}
              >{cm}cm</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800 flex-shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-200 truncate">{activeBuilding?.name}</span>
            {activeFloor && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-sm text-slate-400 truncate">{activeFloor.name}</span>
                <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded shrink-0">{activeFloor.height}m</span>
                <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded shrink-0">
                  {activeFloor.walls.length} Wände · {activeFloor.rooms.length} Räume
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="flex items-center gap-0.5 bg-slate-700 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('floor')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'floor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Grundriss
              </button>
              <button
                onClick={() => setViewMode('section')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'section' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                Schnitt
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === '3d' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Box className="w-3.5 h-3.5" />
                3D
              </button>
            </div>

            {(viewMode === 'floor' || viewMode === 'section') && (
              <div className="flex items-center gap-0.5 bg-slate-700 rounded-md p-0.5">
                <button
                  onClick={() => setTool('select')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${tool === 'select' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Auswählen"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                </button>
                {viewMode === 'floor' && (
                  <>
                    <button
                      onClick={() => setTool('wall')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${tool === 'wall' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      title="Wand zeichnen"
                    >
                      <Minus className="w-3.5 h-3.5 rotate-45" />
                      Wand
                    </button>
                    <button
                      onClick={() => setTool('room')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${tool === 'room' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      title="Raum zeichnen"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Raum
                    </button>
                  </>
                )}
                <button
                  onClick={() => setTool('duct')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${tool === 'duct' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title={viewMode === 'section' ? 'Vertikalen Kanal zeichnen' : 'Lüftungskanal zeichnen'}
                >
                  <Wind className="w-3.5 h-3.5" />
                  Kanal
                </button>
                <button
                  onClick={() => setTool('pipe')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${tool === 'pipe' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title={viewMode === 'section' ? 'Vertikale Leitung zeichnen' : 'Leitung zeichnen'}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Rohr
                </button>
                {viewMode === 'floor' && (
                  <>
                    <button
                      onClick={() => setTool('slab')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${tool === 'slab' ? 'bg-amber-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      title="Bodenplatte zeichnen (Polygon)"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
                      Platte
                    </button>
                    <button
                      onClick={() => setTool('polygon-room')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${tool === 'polygon-room' ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      title="Raumzone zeichnen (Polygon)"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12 L8 4 L16 4 L21 12 L16 20 L8 20 Z"/></svg>
                      Zone
                    </button>
                    <button
                      onClick={() => setTool('delete')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${tool === 'delete' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}

            {viewMode === 'floor' && (tool === 'room' || tool === 'polygon-room') && (
              <select
                value={newRoomType}
                onChange={e => setNewRoomType(e.target.value as RoomType)}
                className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 outline-none"
              >
                {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(t => (
                  <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
                ))}
              </select>
            )}

            {(viewMode === 'floor' || viewMode === 'section') && tool === 'duct' && (
              <div className="flex items-center gap-1.5">
                <select value={ductType} onChange={e => setDuctType(e.target.value as DuctType)}
                  className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 outline-none">
                  {(Object.keys(DUCT_TYPE_LABELS) as DuctType[]).map(t => (
                    <option key={t} value={t}>{DUCT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <select value={ductShape} onChange={e => setDuctShape(e.target.value as DuctShape)}
                  className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 outline-none">
                  <option value="rectangular">Eckig</option>
                  <option value="round">Rund</option>
                </select>
                <input type="number" min="0.1" max="2" step="0.1" value={ductWidth}
                  onChange={e => setDuctWidth(parseFloat(e.target.value) || 0.3)}
                  className="w-14 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-1.5 py-1 rounded outline-none"
                  title="Breite (m)" placeholder="B" />
                {ductShape === 'rectangular' && (
                  <input type="number" min="0.1" max="2" step="0.05" value={ductHeight}
                    onChange={e => setDuctHeight(parseFloat(e.target.value) || 0.2)}
                    className="w-14 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-1.5 py-1 rounded outline-none"
                    title="Höhe (m)" placeholder="H" />
                )}
              </div>
            )}

            {(viewMode === 'floor' || viewMode === 'section') && tool === 'pipe' && (
              <div className="flex items-center gap-1.5">
                <select value={pipeType} onChange={e => setPipeType(e.target.value as PipeType)}
                  className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 outline-none">
                  {(Object.keys(PIPE_TYPE_LABELS) as PipeType[]).map(t => (
                    <option key={t} value={t}>{PIPE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <input type="number" min="0.01" max="0.5" step="0.01" value={pipeDiameter}
                    onChange={e => setPipeDiameter(parseFloat(e.target.value) || 0.05)}
                    className="w-16 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-1.5 py-1 rounded outline-none"
                    title="Durchmesser (m)" />
                  <span className="text-xs text-slate-500">m Ø</span>
                </div>
              </div>
            )}

            {viewMode === 'floor' && tool === 'slab' && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-900/40 border border-amber-700 rounded text-xs text-amber-300">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
                Klicken zum Setzen von Punkten · Rechtsklick oder ersten Punkt anklicken zum Abschliessen
              </div>
            )}

            {viewMode === '3d' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span>HG</span>
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border border-slate-600" title="Hintergrundfarbe" />
                </div>
                {activeFloor && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span>Boden</span>
                    <input type="color" value={activeFloor.floorColor || '#1e3a5f'}
                      onChange={e => { if (activeBuilding && activeFloor) updateFloorColor(activeBuilding.id, activeFloor.id, e.target.value); }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border border-slate-600" title="Bodenfarbe" />
                  </div>
                )}
                <button
                  onClick={() => setShowLightingPanel(p => !p)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${showLightingPanel ? 'bg-amber-700 text-white border-amber-600' : 'bg-slate-700 text-slate-400 hover:text-white border-slate-600'}`}
                  title="Beleuchtung"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowWidget3DPanel(p => !p)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${showWidget3DPanel ? 'bg-green-700 text-white border-green-600' : 'bg-slate-700 text-slate-400 hover:text-white border-slate-600'}`}
                  title="3D Widgets"
                >
                  <Thermometer className="w-3.5 h-3.5" />
                  Widgets
                </button>
              </div>
            )}

            <button
              onClick={() => setShowLayersPanel(p => !p)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${showLayersPanel ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-700 text-slate-400 hover:text-white border-slate-600'}`}
              title="Layer"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowRoomPanel(p => !p)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${showRoomPanel ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-700 text-slate-400 hover:text-white border-slate-600'}`}
              title="Eigenschaften"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {viewMode === '3d' ? (
              <div className="relative w-full h-full">
                <BuildingCanvas3D
                  buildings={buildings}
                  activeFloorId={activeFloorId}
                  selectedRoomId={selectedRoomId}
                  selectedWallId={selectedWallId}
                  selectedWidget3DId={selectedWidget3DId}
                  selectedDuctId={selectedDuctId}
                  selectedPipeId={selectedPipeId}
                  onSelectRoom={id => { setSelectedRoomId(id); setSelectedWallId(null); setSelectedWidget3DId(null); setSelectedDuctId(null); setSelectedPipeId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                  onSelectWall={id => { setSelectedWallId(id); setSelectedRoomId(null); setSelectedWidget3DId(null); setSelectedDuctId(null); setSelectedPipeId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                  onSelectWidget3D={id => { setSelectedWidget3DId(id); setSelectedRoomId(null); setSelectedWallId(null); setSelectedDuctId(null); setSelectedPipeId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                  onSelectDuct={id => { setSelectedDuctId(id); setSelectedRoomId(null); setSelectedWallId(null); setSelectedWidget3DId(null); setSelectedPipeId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                  onSelectPipe={id => { setSelectedPipeId(id); setSelectedRoomId(null); setSelectedWallId(null); setSelectedWidget3DId(null); setSelectedDuctId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                  onUpdateWidget3D={(widgetId, x, y, z) => {
                    if (!activeBuilding) return;
                    updateWidget3D(activeBuilding.id, widgetId, { x, y, z });
                  }}
                  highlightFloor={true}
                  bgColor={bgColor}
                  floorTransparent={floorTransparent}
                  bgTransparent={bgTransparent}
                  showGrid={showGrid3D}
                  lighting={lighting}
                  liveValues={liveValues as Record<string, string | number>}
                  widgetPlacementMode={widgetPlacementMode}
                  onPlaceWidget={handlePlaceWidget}
                />
                {showLightingPanel && (
                  <div className="absolute top-10 right-2 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 w-52 space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><Sun className="w-3.5 h-3.5 text-amber-400" />Beleuchtung</span>
                      <button onClick={() => setShowLightingPanel(false)} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    {[
                      { key: 'ambientIntensity', label: 'Umgebungslicht', min: 0, max: 2, step: 0.05 },
                      { key: 'sunIntensity', label: 'Sonnenlicht', min: 0, max: 4, step: 0.1 },
                      { key: 'sunAngle', label: 'Sonnenwinkel', min: 0, max: 360, step: 5 },
                      { key: 'fillIntensity', label: 'Fülllicht', min: 0, max: 2, step: 0.05 },
                      { key: 'shadowSoftness', label: 'Schattenweichheit', min: 0, max: 10, step: 0.5 },
                    ].map(({ key, label, min, max, step }) => (
                      <div key={key}>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>{label}</span>
                          <span>{lighting[key as keyof LightingSettings]}</span>
                        </div>
                        <input type="range" min={min} max={max} step={step}
                          value={lighting[key as keyof LightingSettings] as number}
                          onChange={e => setLighting(l => ({ ...l, [key]: parseFloat(e.target.value) }))}
                          className="w-full h-1 accent-amber-500" />
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Schatten</span>
                      <button
                        onClick={() => setLighting(l => ({ ...l, shadowEnabled: !l.shadowEnabled }))}
                        className={`w-8 h-4 rounded-full transition-colors ${lighting.shadowEnabled ? 'bg-amber-500' : 'bg-slate-600'} relative`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${lighting.shadowEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <div className="border-t border-slate-700 pt-2 mt-1 space-y-1.5">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ansicht</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Raster</span>
                        <button
                          onClick={() => setShowGrid3D(v => !v)}
                          className={`w-8 h-4 rounded-full transition-colors ${showGrid3D ? 'bg-blue-500' : 'bg-slate-600'} relative`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showGrid3D ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Boden transparent</span>
                        <button
                          onClick={() => setFloorTransparent(v => !v)}
                          className={`w-8 h-4 rounded-full transition-colors ${floorTransparent ? 'bg-blue-500' : 'bg-slate-600'} relative`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${floorTransparent ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">HG transparent</span>
                        <button
                          onClick={() => setBgTransparent(v => !v)}
                          className={`w-8 h-4 rounded-full transition-colors ${bgTransparent ? 'bg-blue-500' : 'bg-slate-600'} relative`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${bgTransparent ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => setLighting(DEFAULT_LIGHTING)} className="w-full text-[10px] text-slate-400 hover:text-white px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600">
                      Zurücksetzen
                    </button>
                  </div>
                )}

                {showWidget3DPanel && (
                  <div className="absolute top-10 left-2 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 w-64 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Thermometer className="w-3.5 h-3.5 text-green-400" />
                        3D Widget hinzufügen
                      </span>
                      <button onClick={() => setShowWidget3DPanel(false)} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 mb-1">Typ</div>
                      <div className="grid grid-cols-4 gap-1">
                        {(Object.keys(WIDGET_LABELS) as Widget3DType[]).map(t => (
                          <button
                            key={t}
                            onClick={() => setNewWidgetType(t)}
                            className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded text-[9px] border transition-colors ${newWidgetType === t ? 'border-current text-white' : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}`}
                            style={newWidgetType === t ? { backgroundColor: WIDGET_COLORS[t] + '33', borderColor: WIDGET_COLORS[t], color: WIDGET_COLORS[t] } : {}}
                            title={WIDGET_LABELS[t]}
                          >
                            <span>{WIDGET_TYPE_ICONS[t] || <BoxIcon className="w-3 h-3" />}</span>
                            <span className="truncate w-full text-center leading-tight">{WIDGET_LABELS[t]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 mb-1">Datenpunkt</div>
                      <div className="flex gap-1">
                        <input
                          type="text" value={newWidgetDatapoint}
                          onChange={e => setNewWidgetDatapoint(e.target.value)}
                          placeholder="z.B. sensors.room1.temp"
                          className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-green-500"
                        />
                        <button
                          onClick={() => openDatapointPicker('new')}
                          className="px-1.5 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 hover:text-white border border-slate-500 rounded text-xs flex items-center gap-0.5"
                          title="Datenpunkt auswählen"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {newWidgetType === 'roomcolor' && activeFloor && (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-500 mb-1">Räume auswählen</div>
                          <div className="space-y-1 max-h-28 overflow-y-auto bg-slate-750 border border-slate-700 rounded p-1.5">
                            {activeFloor.rooms.length === 0 ? (
                              <div className="text-[10px] text-slate-600 italic px-1">Keine Räume vorhanden</div>
                            ) : activeFloor.rooms.map(r => (
                              <label key={r.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newWidgetRoomIds.includes(r.id)}
                                  onChange={e => setNewWidgetRoomIds(prev =>
                                    e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id)
                                  )}
                                  className="accent-green-500"
                                />
                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                                <span className="text-xs text-slate-300 truncate">{r.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] text-slate-500 mb-1">Farbe TRUE</div>
                            <input type="color" value={newWidgetColor} onChange={e => setNewWidgetColor(e.target.value)}
                              className="w-full h-7 rounded cursor-pointer bg-slate-700 border border-slate-600" />
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 mb-1">Farbe FALSE</div>
                            <input type="color" value={newWidgetColorFalse || '#334155'} onChange={e => setNewWidgetColorFalse(e.target.value)}
                              className="w-full h-7 rounded cursor-pointer bg-slate-700 border border-slate-600" />
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 mb-1">Transparenz</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range" min="0.05" max="1" step="0.05"
                              value={newWidgetOpacity}
                              onChange={e => setNewWidgetOpacity(parseFloat(e.target.value))}
                              className="flex-1 h-1 accent-green-500"
                            />
                            <span className="text-xs text-slate-400 w-10 text-right">{Math.round(newWidgetOpacity * 100)}%</span>
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <div className="text-[10px] text-slate-500 mb-1">Bezeichnung (optional)</div>
                      <input
                        type="text" value={newWidgetLabel}
                        onChange={e => setNewWidgetLabel(e.target.value)}
                        placeholder={WIDGET_LABELS[newWidgetType]}
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-green-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">Einheit</div>
                        <input type="text" value={newWidgetUnit} onChange={e => setNewWidgetUnit(e.target.value)}
                          placeholder="°C, %, lux..."
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-green-500" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'X', val: newWidgetX, set: setNewWidgetX },
                        { label: 'Y', val: newWidgetY, set: setNewWidgetY },
                        { label: 'Z', val: newWidgetZ, set: setNewWidgetZ },
                      ].map(({ label, val, set }) => (
                        <div key={label}>
                          <div className="text-[10px] text-slate-500 mb-1">{label} (m)</div>
                          <input type="number" step="0.5" value={val} onChange={e => set(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-1.5 py-1.5 rounded outline-none focus:border-green-500" />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAddWidget3D()}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Hinzufügen
                      </button>
                      <button
                        onClick={() => setWidgetPlacementMode(!widgetPlacementMode)}
                        className={`flex items-center justify-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors ${widgetPlacementMode ? 'bg-blue-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'}`}
                        title="Klicken Sie in die 3D-Ansicht um das Widget zu platzieren"
                      >
                        <MousePointer2 className="w-3.5 h-3.5" />
                        Platzieren
                      </button>
                    </div>
                    {widgetPlacementMode && (
                      <div className="text-[10px] text-blue-400 bg-blue-900/30 px-2 py-1.5 rounded">
                        Klicken Sie in die 3D-Ansicht um das Widget zu platzieren
                      </div>
                    )}

                    {(activeBuilding?.widgets3d ?? []).length > 0 && (
                      <div className="pt-2 border-t border-slate-700">
                        <div className="text-[10px] text-slate-500 mb-1.5">Vorhandene Widgets ({activeBuilding!.widgets3d.length})</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {activeBuilding!.widgets3d.map(w => (
                            <div
                              key={w.id}
                              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${selectedWidget3DId === w.id ? 'bg-slate-600' : 'bg-slate-750 hover:bg-slate-700'}`}
                              onClick={() => setSelectedWidget3DId(w.id)}
                            >
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: w.color || WIDGET_COLORS[w.type] }} />
                              <span className="flex-1 text-slate-300 truncate">{w.label}</span>
                              <span className="text-[9px] text-slate-500 truncate max-w-16">{w.datapoint || '–'}</span>
                              <button onClick={e => { e.stopPropagation(); if (activeBuilding) deleteWidget3D(activeBuilding.id, w.id); }}
                                className="text-slate-600 hover:text-red-400 flex-shrink-0">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : viewMode === 'section' && activeBuilding ? (
              <div className="flex w-full h-full">
                <div className="flex-1 border-r border-slate-700 min-w-0">
                  <SectionView
                    building={activeBuilding}
                    ductType={ductType}
                    ductShape={ductShape}
                    ductWidth={ductWidth}
                    ductHeight={ductHeight}
                    pipeType={pipeType}
                    pipeDiameter={pipeDiameter}
                    tool={tool === 'duct' ? 'duct' : tool === 'pipe' ? 'pipe' : 'select'}
                    axis="xz"
                    label="Vorderansicht (X-Achse)"
                    onAddVerticalDuct={(duct, fromFloorId) => {
                      if (!activeBuilding) return;
                      addDuct(activeBuilding.id, fromFloorId, duct);
                    }}
                    onAddVerticalPipe={(pipe, fromFloorId, toFloorId) => {
                      if (!activeBuilding) return;
                      addPipe(activeBuilding.id, fromFloorId, pipe);
                      addPipe(activeBuilding.id, toFloorId, pipe);
                    }}
                    onUpdateVerticalDuct={(ductId, floorId, changes) => {
                      if (!activeBuilding) return;
                      updateDuct(activeBuilding.id, floorId, ductId, changes);
                    }}
                    onMergeDucts={(ductIds, floorId) => {
                      if (!activeBuilding) return null;
                      return mergeDucts(activeBuilding.id, floorId, ductIds);
                    }}
                    gridSize={gridSize}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <SectionView
                    building={activeBuilding}
                    ductType={ductType}
                    ductShape={ductShape}
                    ductWidth={ductWidth}
                    ductHeight={ductHeight}
                    pipeType={pipeType}
                    pipeDiameter={pipeDiameter}
                    tool={tool === 'duct' ? 'duct' : tool === 'pipe' ? 'pipe' : 'select'}
                    axis="yz"
                    label="Seitenansicht rechts (Y-Achse)"
                    onAddVerticalDuct={(duct, fromFloorId) => {
                      if (!activeBuilding) return;
                      addDuct(activeBuilding.id, fromFloorId, duct);
                    }}
                    onAddVerticalPipe={(pipe, fromFloorId, toFloorId) => {
                      if (!activeBuilding) return;
                      addPipe(activeBuilding.id, fromFloorId, pipe);
                      addPipe(activeBuilding.id, toFloorId, pipe);
                    }}
                    onUpdateVerticalDuct={(ductId, floorId, changes) => {
                      if (!activeBuilding) return;
                      updateDuct(activeBuilding.id, floorId, ductId, changes);
                    }}
                    onMergeDucts={(ductIds, floorId) => {
                      if (!activeBuilding) return null;
                      return mergeDucts(activeBuilding.id, floorId, ductIds);
                    }}
                    gridSize={gridSize}
                  />
                </div>
              </div>
            ) : viewMode === 'floor' && activeFloor ? (
              <FloorPlanEditor
                floor={activeFloor}
                selectedRoomId={selectedRoomId}
                selectedWallId={selectedWallId}
                selectedDuctId={selectedDuctId}
                selectedPipeId={selectedPipeId}
                tool={tool}
                wallThickness={wallThickness}
                ductType={ductType}
                ductShape={ductShape}
                ductWidth={ductWidth}
                ductHeight={ductHeight}
                pipeType={pipeType}
                pipeDiameter={pipeDiameter}
                onAddWall={handleAddWall}
                onSelectWall={id => { setSelectedWallId(id); setSelectedRoomId(null); setSelectedDuctId(null); setSelectedPipeId(null); setSelectedWidget3DId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                onMoveWallPoint={handleMoveWallPoint}
                onMoveWall={handleMoveWall}
                onAddRoom={handleAddRoom}
                onSelectRoom={id => { setSelectedRoomId(id); setSelectedWallId(null); setSelectedDuctId(null); setSelectedPipeId(null); setSelectedWidget3DId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                onMoveRoom={handleMoveRoom}
                onDeleteWall={handleDeleteWall}
                onDeleteRoom={handleDeleteRoom}
                onSetBackground={handleSetBackground}
                onAddDuct={handleAddDuct}
                onSelectDuct={id => { setSelectedDuctId(id); setSelectedWallId(null); setSelectedRoomId(null); setSelectedPipeId(null); setSelectedWidget3DId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                onDeleteDuct={id => { if (activeBuilding && activeFloor) deleteDuct(activeBuilding.id, activeFloor.id, id); setSelectedDuctId(null); }}
                onMoveDuctPoint={(ductId, ptIdx, x, y) => { if (activeBuilding && activeFloor) moveDuctPoint(activeBuilding.id, activeFloor.id, ductId, ptIdx, x, y); }}
                onMoveDuct={(ductId, dx, dy) => { if (activeBuilding && activeFloor) moveDuct(activeBuilding.id, activeFloor.id, ductId, dx, dy); }}
                onMergeDucts={ductIds => { if (activeBuilding && activeFloor) { const newId = mergeDucts(activeBuilding.id, activeFloor.id, ductIds); setSelectedDuctId(newId); return newId; } return null; }}
                onConnectDuctEndpoints={(id1, pi1, id2, pi2) => { if (activeBuilding && activeFloor) { const newId = connectDuctEndpoints(activeBuilding.id, activeFloor.id, id1, pi1, id2, pi2); setSelectedDuctId(newId); return newId; } return null; }}
                onSplitDuct={(ductId, ptIdx) => { if (activeBuilding && activeFloor) { splitDuct(activeBuilding.id, activeFloor.id, ductId, ptIdx); setSelectedDuctId(null); } }}
                onInsertDuctPoint={(ductId, afterIdx, x, y) => { if (activeBuilding && activeFloor) insertDuctPoint(activeBuilding.id, activeFloor.id, ductId, afterIdx, x, y); }}
                onRemoveDuctPoint={(ductId, ptIdx) => { if (activeBuilding && activeFloor) removeDuctPoint(activeBuilding.id, activeFloor.id, ductId, ptIdx); }}
                onAddPipe={handleAddPipe}
                onSelectPipe={id => { setSelectedPipeId(id); setSelectedWallId(null); setSelectedRoomId(null); setSelectedDuctId(null); setSelectedWidget3DId(null); setSelectedSlabId(null); setShowRoomPanel(true); }}
                onDeletePipe={id => { if (activeBuilding && activeFloor) deletePipe(activeBuilding.id, activeFloor.id, id); setSelectedPipeId(null); }}
                onMovePipePoint={(pipeId, ptIdx, x, y) => { if (activeBuilding && activeFloor) movePipePoint(activeBuilding.id, activeFloor.id, pipeId, ptIdx, x, y); }}
                onMovePipe={(pipeId, dx, dy) => { if (activeBuilding && activeFloor) movePipe(activeBuilding.id, activeFloor.id, pipeId, dx, dy); }}
                selectedSlabId={selectedSlabId}
                onSelectSlab={id => { setSelectedSlabId(id); setSelectedWidget3DId(null); setSelectedRoomId(null); setSelectedWallId(null); setSelectedDuctId(null); setSelectedPipeId(null); setShowRoomPanel(true); }}
                onAddSlab={slab => { if (activeBuilding && activeFloor) addSlab(activeBuilding.id, activeFloor.id, slab); }}
                onAddPolygonRoom={points => { if (activeBuilding && activeFloor) addPolygonRoom(activeBuilding.id, activeFloor.id, points, newRoomType); }}
                onDeleteSlab={id => { if (activeBuilding && activeFloor) { deleteSlab(activeBuilding.id, activeFloor.id, id); setSelectedSlabId(null); } }}
                onCopySelected={handleCopySelected}
                onPasteClipboard={handlePasteClipboard}
                onDeleteSelected={handleDeleteSelected}
                onDuplicateSelected={handleDuplicateSelected}
                onMoveMultiSelection={handleMoveMultiSelection}
                onPropertiesRequested={() => setShowRoomPanel(true)}
                gridSize={gridSize}
                forceMultiSel={pastedMultiSel}
                layers={activeFloor?.layers}
                overlayFloors={activeBuilding ? activeBuilding.floors
                  .filter(f => f.id !== activeFloorId && floorOverlays[f.id])
                  .map(f => ({ floor: f, opacity: 0.25 })) : undefined}
                allFloors={activeBuilding?.floors}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                Kein Stockwerk ausgewählt
              </div>
            )}
          </div>

          {showLayersPanel && activeFloor && (
            <div className="w-48 flex-shrink-0 border-l border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />Layer
                </span>
                <button onClick={() => setShowLayersPanel(false)} className="w-4 h-4 text-slate-500 hover:text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {([
                  { key: 'walls', label: 'Wände' },
                  { key: 'rooms', label: 'Räume' },
                  { key: 'ducts', label: 'Kanäle' },
                  { key: 'verticalDucts', label: 'Vertikale Kanäle' },
                  { key: 'pipes', label: 'Rohre' },
                  { key: 'slabs', label: 'Decken' },
                  { key: 'background', label: 'Hintergrundbild' },
                ] as { key: keyof FloorLayers; label: string }[]).map(({ key, label }) => {
                  const layers = { ...DEFAULT_LAYERS, ...(activeFloor.layers ?? {}) };
                  const visible = layers[key];
                  return (
                    <button
                      key={key}
                      onClick={() => activeBuilding && updateFloorLayers(activeBuilding.id, activeFloor.id, { [key]: !visible })}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${visible ? 'text-slate-200 bg-slate-700/50 hover:bg-slate-700' : 'text-slate-500 bg-slate-800 hover:bg-slate-700/30'}`}
                    >
                      {visible ? <Eye className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />}
                      {label}
                    </button>
                  );
                })}
                {activeBuilding && activeBuilding.floors.filter(f => f.id !== activeFloorId).length > 0 && (
                  <>
                    <div className="pt-2 pb-1 px-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Andere Etagen</span>
                    </div>
                    {[...activeBuilding.floors]
                      .filter(f => f.id !== activeFloorId)
                      .sort((a, b) => b.level - a.level)
                      .map(f => {
                        const visible = !!floorOverlays[f.id];
                        return (
                          <button
                            key={f.id}
                            onClick={() => setFloorOverlays(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${visible ? 'text-slate-200 bg-slate-700/50 hover:bg-slate-700' : 'text-slate-500 bg-slate-800 hover:bg-slate-700/30'}`}
                          >
                            {visible ? <Eye className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" /> : <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />}
                            {f.name}
                          </button>
                        );
                      })}
                  </>
                )}
              </div>
            </div>
          )}

          {showRoomPanel && (
            <div className="w-60 flex-shrink-0 border-l border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {propertiesPanelTitle()}
                </span>
                <button onClick={() => setShowRoomPanel(false)} className="w-4 h-4 text-slate-500 hover:text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-3 space-y-3">
                {selectedWidget ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Typ</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                        value={selectedWidget.type}
                        onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { type: e.target.value as Widget3DType, color: WIDGET_COLORS[e.target.value as Widget3DType] })}>
                        {(Object.keys(WIDGET_LABELS) as Widget3DType[]).map(t => <option key={t} value={t}>{WIDGET_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Bezeichnung</label>
                      <input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedWidget.label}
                        onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { label: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Datenpunkt</label>
                      <div className="flex gap-1">
                        <input className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedWidget.datapoint}
                          onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { datapoint: e.target.value })} />
                        <button
                          onClick={() => openDatapointPicker('widget')}
                          className="px-1.5 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 hover:text-white border border-slate-500 rounded text-xs flex items-center"
                          title="Datenpunkt auswählen"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Alarm-Datenpunkt</label>
                      <div className="flex gap-1">
                        <input className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedWidget.alarmDatapoint || ''}
                          placeholder="optional"
                          onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { alarmDatapoint: e.target.value || undefined })} />
                        <button
                          onClick={() => openDatapointPicker('alarm')}
                          className="px-1.5 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 hover:text-white border border-slate-500 rounded text-xs flex items-center"
                          title="Alarm-Datenpunkt auswählen"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {selectedWidget.type === 'roomcolor' && activeFloor && (
                      <>
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Räume</label>
                          <div className="space-y-1 max-h-28 overflow-y-auto bg-slate-750 border border-slate-700 rounded p-1.5">
                            {activeFloor.rooms.map(r => (
                              <label key={r.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={(selectedWidget.roomIds ?? []).includes(r.id)}
                                  onChange={e => {
                                    if (!activeBuilding) return;
                                    const prev = selectedWidget.roomIds ?? [];
                                    updateWidget3D(activeBuilding.id, selectedWidget.id, {
                                      roomIds: e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id)
                                    });
                                  }}
                                  className="accent-green-500"
                                />
                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                                <span className="text-xs text-slate-300 truncate">{r.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe TRUE</label>
                            <input type="color"
                              value={(selectedWidget as any).colorTrue || selectedWidget.color || '#22c55e'}
                              onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { color: e.target.value, colorTrue: e.target.value } as any)}
                              className="w-full h-7 rounded cursor-pointer bg-slate-700 border border-slate-600" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe FALSE</label>
                            <input type="color"
                              value={(selectedWidget as any).colorFalse || '#334155'}
                              onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { colorFalse: e.target.value } as any)}
                              className="w-full h-7 rounded cursor-pointer bg-slate-700 border border-slate-600" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Transparenz</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range" min="0.05" max="1" step="0.05"
                              value={selectedWidget.opacity ?? 0.45}
                              onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { opacity: parseFloat(e.target.value) })}
                              className="flex-1 h-1 accent-green-500"
                            />
                            <span className="text-xs text-slate-400 w-10 text-right">{Math.round((selectedWidget.opacity ?? 0.45) * 100)}%</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Einheit</label>
                        <input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedWidget.unit}
                          onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { unit: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Größe</label>
                        <input type="number" step="0.1" min="0.2" max="10"
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedWidget.size ?? 1}
                          onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { size: parseFloat(e.target.value) || 1 })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Skalierung</label>
                      <input type="number" step="0.1" min="0.3" max="5"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedWidget.scale}
                        onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { scale: parseFloat(e.target.value) || 1 })} />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['x', 'y', 'z'] as const).map(axis => (
                        <div key={axis}>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">{axis.toUpperCase()} (m)</label>
                          <input type="number" step="0.5"
                            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                            value={selectedWidget[axis]}
                            onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { [axis]: parseFloat(e.target.value) || 0 })} />
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                          value={selectedWidget.color || WIDGET_COLORS[selectedWidget.type]}
                          onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { color: e.target.value })} />
                        <span className="text-xs text-slate-400">{selectedWidget.color}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={selectedWidget.showLabel}
                          onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { showLabel: e.target.checked })}
                          className="accent-blue-500" />
                        Bezeichnung
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={selectedWidget.showValue}
                          onChange={e => activeBuilding && updateWidget3D(activeBuilding.id, selectedWidget.id, { showValue: e.target.checked })}
                          className="accent-blue-500" />
                        Wert
                      </label>
                    </div>
                    <button onClick={() => { if (activeBuilding) { deleteWidget3D(activeBuilding.id, selectedWidget.id); setSelectedWidget3DId(null); } }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                      Widget löschen
                    </button>
                  </>
                ) : selectedDuct ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Typ</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                        value={selectedDuct.type}
                        onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { type: e.target.value as DuctType })}>
                        {(Object.keys(DUCT_TYPE_LABELS) as DuctType[]).map(t => <option key={t} value={t}>{DUCT_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Form</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                        value={selectedDuct.shape}
                        onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { shape: e.target.value as DuctShape })}>
                        <option value="rectangular">Rechteckig</option>
                        <option value="round">Rund</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Breite (m)</label>
                        <input type="number" step="0.05" min="0.1"
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedDuct.width}
                          onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { width: parseFloat(e.target.value) || 0.3 })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Höhe (m)</label>
                        <input type="number" step="0.05" min="0.1"
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedDuct.height}
                          onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { height: parseFloat(e.target.value) || 0.2 })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Einbauhöhe (m)</label>
                      <input type="number" step="0.1" min="0"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedDuct.elevation}
                        onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { elevation: parseFloat(e.target.value) || 2.4 })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Bezeichnung</label>
                      <input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedDuct.label || ''}
                        onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { label: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                          value={selectedDuct.color || DUCT_TYPE_COLORS[selectedDuct.type]}
                          onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { color: e.target.value })} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={selectedDuct.insulated}
                        onChange={e => activeBuilding && activeFloor && updateDuct(activeBuilding.id, activeFloor.id, selectedDuct.id, { insulated: e.target.checked })}
                        className="accent-blue-500" />
                      Gedämmt
                    </label>
                    <div className="pt-1 text-[10px] text-slate-500">{selectedDuct.points.length} Punkte</div>
                    <button onClick={() => { if (activeBuilding && activeFloor) { deleteDuct(activeBuilding.id, activeFloor.id, selectedDuct.id); setSelectedDuctId(null); } }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                      Kanal löschen
                    </button>
                  </>
                ) : selectedPipe ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Typ</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                        value={selectedPipe.type}
                        onChange={e => activeBuilding && activeFloor && updatePipe(activeBuilding.id, activeFloor.id, selectedPipe.id, { type: e.target.value as PipeType })}>
                        {(Object.keys(PIPE_TYPE_LABELS) as PipeType[]).map(t => <option key={t} value={t}>{PIPE_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Durchmesser (m)</label>
                      <input type="number" step="0.005" min="0.01"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedPipe.diameter}
                        onChange={e => activeBuilding && activeFloor && updatePipe(activeBuilding.id, activeFloor.id, selectedPipe.id, { diameter: parseFloat(e.target.value) || 0.05 })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Einbauhöhe (m)</label>
                      <input type="number" step="0.1" min="0"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedPipe.elevation}
                        onChange={e => activeBuilding && activeFloor && updatePipe(activeBuilding.id, activeFloor.id, selectedPipe.id, { elevation: parseFloat(e.target.value) || 2.2 })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Bezeichnung</label>
                      <input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedPipe.label || ''}
                        onChange={e => activeBuilding && activeFloor && updatePipe(activeBuilding.id, activeFloor.id, selectedPipe.id, { label: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                          value={selectedPipe.color || PIPE_TYPE_COLORS[selectedPipe.type]}
                          onChange={e => activeBuilding && activeFloor && updatePipe(activeBuilding.id, activeFloor.id, selectedPipe.id, { color: e.target.value })} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={selectedPipe.insulated}
                        onChange={e => activeBuilding && activeFloor && updatePipe(activeBuilding.id, activeFloor.id, selectedPipe.id, { insulated: e.target.checked })}
                        className="accent-blue-500" />
                      Gedämmt
                    </label>
                    <div className="pt-1 text-[10px] text-slate-500">{selectedPipe.points.length} Punkte</div>
                    <button onClick={() => { if (activeBuilding && activeFloor) { deletePipe(activeBuilding.id, activeFloor.id, selectedPipe.id); setSelectedPipeId(null); } }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                      Leitung löschen
                    </button>
                  </>
                ) : selectedSlab ? (
                  <>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold pb-1 border-b border-slate-700">Bodenplatte</div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                          value={selectedSlab.color || '#94a3b8'}
                          onChange={e => activeBuilding && activeFloor && updateSlab(activeBuilding.id, activeFloor.id, selectedSlab.id, { color: e.target.value })} />
                        <span className="text-xs text-slate-400">{selectedSlab.color || '#94a3b8'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Transparenz</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min="0.05" max="1" step="0.05"
                          value={selectedSlab.opacity ?? 0.85}
                          onChange={e => activeBuilding && activeFloor && updateSlab(activeBuilding.id, activeFloor.id, selectedSlab.id, { opacity: parseFloat(e.target.value) })}
                          className="flex-1 h-1 accent-blue-500" />
                        <span className="text-xs text-slate-400 w-10 text-right">{Math.round((selectedSlab.opacity ?? 0.85) * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Dicke (m)</label>
                      <input type="number" step="0.05" min="0.01" max="2"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedSlab.thickness ?? 0.15}
                        onChange={e => activeBuilding && activeFloor && updateSlab(activeBuilding.id, activeFloor.id, selectedSlab.id, { thickness: parseFloat(e.target.value) || 0.15 })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Höhenversatz (m)</label>
                      <input type="number" step="0.05" min="-2" max="5"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedSlab.elevation ?? 0}
                        onChange={e => activeBuilding && activeFloor && updateSlab(activeBuilding.id, activeFloor.id, selectedSlab.id, { elevation: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Textur</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                        value={selectedSlab.texture || 'none'}
                        onChange={e => activeBuilding && activeFloor && updateSlab(activeBuilding.id, activeFloor.id, selectedSlab.id, { texture: e.target.value as Slab['texture'] })}>
                        <option value="none">Keine</option>
                        <option value="concrete">Beton</option>
                        <option value="wood">Holz</option>
                        <option value="tile">Fliesen</option>
                        <option value="carpet">Teppich</option>
                      </select>
                    </div>
                    <div className="pt-1 text-[10px] text-slate-500">{selectedSlab.points.length} Punkte</div>
                    <button onClick={() => { if (activeBuilding && activeFloor) { deleteSlab(activeBuilding.id, activeFloor.id, selectedSlab.id); setSelectedSlabId(null); } }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                      Platte löschen
                    </button>
                    {activeFloor && <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Stockwerk</div>
                      <div className="mb-2"><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Name</label><input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.name} onChange={e => activeBuilding && renameFloor(activeBuilding.id, activeFloor.id, e.target.value)} /></div>
                      <div><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Deckenhöhe (m)</label><input type="number" step="0.1" min="2" max="10" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.height} onChange={e => activeBuilding && updateFloorHeight(activeBuilding.id, activeFloor.id, parseFloat(e.target.value) || 3)} /></div>
                    </div>}
                  </>
                ) : selectedWall ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Material</label>
                      <select
                        className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                        value={selectedWall.materialType}
                        onChange={e => handleUpdateWall({ materialType: e.target.value as Wall['materialType'] })}
                      >
                        <option value="concrete">Beton</option>
                        <option value="brick">Ziegel</option>
                        <option value="wood">Holz</option>
                        <option value="glass">Glas</option>
                        <option value="drywall">Trockenbau</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-7 rounded cursor-pointer bg-transparent border-0" value={selectedWall.color || '#94a3b8'} onChange={e => handleUpdateWall({ color: e.target.value })} />
                        <span className="text-xs text-slate-400">{selectedWall.color || '#94a3b8'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Transparenz</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min="0.05" max="1" step="0.05"
                          value={selectedWall.opacity ?? 1}
                          onChange={e => handleUpdateWall({ opacity: parseFloat(e.target.value) })}
                          className="flex-1 h-1 accent-blue-500"
                        />
                        <span className="text-xs text-slate-400 w-10 text-right">{Math.round((selectedWall.opacity ?? 1) * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Dicke</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range" min="0.05" max="1" step="0.05"
                          value={selectedWall.thickness}
                          onChange={e => handleUpdateWall({ thickness: parseFloat(e.target.value) })}
                          className="flex-1 h-1 accent-blue-500"
                        />
                        <input
                          type="number" min="5" max="100" step="5"
                          value={Math.round(selectedWall.thickness * 100)}
                          onChange={e => {
                            const cm = parseInt(e.target.value) || 25;
                            handleUpdateWall({ thickness: Math.max(0.05, Math.min(1, cm / 100)) });
                          }}
                          className="w-14 bg-slate-700 border border-slate-600 text-slate-200 text-xs px-1.5 py-1 rounded outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-slate-500">cm</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Wandhöhe (0 = Deckenhöhe)</label>
                      <input
                        type="number" step="0.1" min="0" max="10"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedWall.height}
                        onChange={e => handleUpdateWall({ height: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">X1</label>
                        <input type="number" step="0.25" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={selectedWall.x1} onChange={e => handleUpdateWall({ x1: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Y1</label>
                        <input type="number" step="0.25" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={selectedWall.y1} onChange={e => handleUpdateWall({ y1: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">X2</label>
                        <input type="number" step="0.25" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={selectedWall.x2} onChange={e => handleUpdateWall({ x2: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Y2</label>
                        <input type="number" step="0.25" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={selectedWall.y2} onChange={e => handleUpdateWall({ y2: parseFloat(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-1">Länge</div>
                      <div className="text-sm font-semibold text-slate-200">
                        {Math.sqrt((selectedWall.x2 - selectedWall.x1) ** 2 + (selectedWall.y2 - selectedWall.y1) ** 2).toFixed(2)} m
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Öffnungen</div>
                        <div className="flex gap-1">
                          {([
                            { type: 'door', label: 'Tür' },
                            { type: 'window', label: 'Fenster' },
                          ] as { type: WallOpeningType; label: string }[]).map(({ type, label }) => (
                            <button
                              key={type}
                              onClick={() => {
                                if (!activeBuilding || !activeFloor) return;
                                const wallLen = Math.sqrt((selectedWall.x2 - selectedWall.x1) ** 2 + (selectedWall.y2 - selectedWall.y1) ** 2);
                                addWallOpening(activeBuilding.id, activeFloor.id, selectedWall.id, {
                                  type,
                                  position: wallLen / 2,
                                  width: type === 'door' ? 0.9 : 1.2,
                                  height: type === 'door' ? 2.1 : 1.2,
                                  sillHeight: type === 'door' ? 0 : 0.9,
                                });
                              }}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-700 hover:bg-blue-800 text-slate-300 hover:text-white border border-slate-600 hover:border-blue-600 rounded text-[10px]"
                            >
                              <Plus className="w-2.5 h-2.5" />{label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(selectedWall.openings ?? []).length === 0 ? (
                        <div className="text-[10px] text-slate-600 italic">Keine Öffnungen</div>
                      ) : (
                        <div className="space-y-2">
                          {(selectedWall.openings ?? []).map(opening => (
                            <div key={opening.id} className="bg-slate-750 border border-slate-700 rounded p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <select
                                  className="bg-slate-700 border border-slate-600 text-slate-300 text-[10px] rounded px-1.5 py-0.5 outline-none"
                                  value={opening.type}
                                  onChange={e => activeBuilding && activeFloor && updateWallOpening(activeBuilding.id, activeFloor.id, selectedWall.id, opening.id, { type: e.target.value as WallOpeningType })}
                                >
                                  <option value="door">Tür</option>
                                  <option value="door-double">Doppeltür</option>
                                  <option value="door-arch">Bogentür</option>
                                  <option value="window">Fenster</option>
                                  <option value="window-large">Grosses Fenster</option>
                                </select>
                                <button
                                  onClick={() => activeBuilding && activeFloor && deleteWallOpening(activeBuilding.id, activeFloor.id, selectedWall.id, opening.id)}
                                  className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-red-400 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <div className="text-[9px] text-slate-500 mb-0.5">Position (m)</div>
                                  <input type="number" step="0.1" min="0"
                                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-[10px] px-1.5 py-0.5 rounded outline-none focus:border-blue-500"
                                    value={opening.position}
                                    onChange={e => activeBuilding && activeFloor && updateWallOpening(activeBuilding.id, activeFloor.id, selectedWall.id, opening.id, { position: parseFloat(e.target.value) || 0 })}
                                  />
                                </div>
                                <div>
                                  <div className="text-[9px] text-slate-500 mb-0.5">Breite (m)</div>
                                  <input type="number" step="0.1" min="0.2"
                                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-[10px] px-1.5 py-0.5 rounded outline-none focus:border-blue-500"
                                    value={opening.width}
                                    onChange={e => activeBuilding && activeFloor && updateWallOpening(activeBuilding.id, activeFloor.id, selectedWall.id, opening.id, { width: parseFloat(e.target.value) || 0.9 })}
                                  />
                                </div>
                                <div>
                                  <div className="text-[9px] text-slate-500 mb-0.5">Höhe (m)</div>
                                  <input type="number" step="0.1" min="0.3"
                                    className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-[10px] px-1.5 py-0.5 rounded outline-none focus:border-blue-500"
                                    value={opening.height}
                                    onChange={e => activeBuilding && activeFloor && updateWallOpening(activeBuilding.id, activeFloor.id, selectedWall.id, opening.id, { height: parseFloat(e.target.value) || 2.1 })}
                                  />
                                </div>
                                {(opening.type === 'window' || opening.type === 'window-large') && (
                                  <div>
                                    <div className="text-[9px] text-slate-500 mb-0.5">Brüstung (m)</div>
                                    <input type="number" step="0.1" min="0"
                                      className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-[10px] px-1.5 py-0.5 rounded outline-none focus:border-blue-500"
                                      value={opening.sillHeight}
                                      onChange={e => activeBuilding && activeFloor && updateWallOpening(activeBuilding.id, activeFloor.id, selectedWall.id, opening.id, { sillHeight: parseFloat(e.target.value) || 0.9 })}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => { if (activeBuilding && activeFloor) deleteWall(activeBuilding.id, activeFloor.id, selectedWall.id); }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Wand löschen
                    </button>
                    {activeFloor && <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Stockwerk</div>
                      <div className="mb-2"><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Name</label><input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.name} onChange={e => activeBuilding && renameFloor(activeBuilding.id, activeFloor.id, e.target.value)} /></div>
                      <div><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Deckenhöhe (m)</label><input type="number" step="0.1" min="2" max="10" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.height} onChange={e => activeBuilding && updateFloorHeight(activeBuilding.id, activeFloor.id, parseFloat(e.target.value) || 3)} /></div>
                    </div>}
                  </>
                ) : selectedRoom ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Name</label>
                      <input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={selectedRoom.name} onChange={e => handleUpdateRoom({ name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Typ</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none" value={selectedRoom.type} onChange={e => handleUpdateRoom({ type: e.target.value as RoomType, color: ROOM_COLORS[e.target.value] || selectedRoom.color })}>
                        {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(t => <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Breite (m)</label><input type="number" step="0.5" min="1" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={selectedRoom.width} onChange={e => handleUpdateRoom({ width: parseFloat(e.target.value) || 1 })} /></div>
                      <div><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Tiefe (m)</label><input type="number" step="0.5" min="1" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={selectedRoom.depth} onChange={e => handleUpdateRoom({ depth: parseFloat(e.target.value) || 1 })} /></div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" className="w-8 h-7 rounded cursor-pointer bg-transparent border-0" value={selectedRoom.color} onChange={e => handleUpdateRoom({ color: e.target.value })} />
                        <span className="text-xs text-slate-400">{selectedRoom.color}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-1">Fläche</div>
                      <div className="text-sm font-semibold text-slate-200">{(selectedRoom.width * selectedRoom.depth).toFixed(1)} m²</div>
                    </div>
                    <button
                      onClick={() => { if (activeBuilding && activeFloor) deleteRoom(activeBuilding.id, activeFloor.id, selectedRoom.id); }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Raum löschen
                    </button>
                    {activeFloor && <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Stockwerk</div>
                      <div className="mb-2"><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Name</label><input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.name} onChange={e => activeBuilding && renameFloor(activeBuilding.id, activeFloor.id, e.target.value)} /></div>
                      <div><label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Deckenhöhe (m)</label><input type="number" step="0.1" min="2" max="10" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.height} onChange={e => activeBuilding && updateFloorHeight(activeBuilding.id, activeFloor.id, parseFloat(e.target.value) || 3)} /></div>
                    </div>}
                  </>
                ) : activeFloor ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Stockwerk</label>
                      <input className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.name} onChange={e => activeBuilding && renameFloor(activeBuilding.id, activeFloor.id, e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Deckenhöhe (m)</label>
                      <input type="number" step="0.1" min="2" max="10" className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500" value={activeFloor.height} onChange={e => activeBuilding && updateFloorHeight(activeBuilding.id, activeFloor.id, parseFloat(e.target.value) || 3)} />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input type="checkbox"
                        checked={activeFloor.showFloorPlane !== false}
                        onChange={e => activeBuilding && updateFloorProps(activeBuilding.id, activeFloor.id, { showFloorPlane: e.target.checked })}
                        className="accent-blue-500" />
                      Ebenenplatte anzeigen (3D)
                    </label>
                    <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-2">Wände ({activeFloor.walls.length})</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {activeFloor.walls.map(w => (
                          <div key={w.id} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-700 cursor-pointer hover:bg-slate-600 text-xs" onClick={() => { setSelectedWallId(w.id); setSelectedRoomId(null); }}>
                            <div className="w-3 h-1.5 rounded bg-slate-400" />
                            <span className="flex-1 text-slate-400 truncate">{w.x1.toFixed(1)},{w.y1.toFixed(1)} → {w.x2.toFixed(1)},{w.y2.toFixed(1)}</span>
                            <span className="text-slate-500">{Math.sqrt((w.x2 - w.x1) ** 2 + (w.y2 - w.y1) ** 2).toFixed(1)}m</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-2">Räume ({activeFloor.rooms.length})</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {activeFloor.rooms.map(r => (
                          <div key={r.id} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-700 cursor-pointer hover:bg-slate-600" onClick={() => { setSelectedRoomId(r.id); setSelectedWallId(null); }}>
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                            <span className="flex-1 text-xs text-slate-300 truncate">{r.name}</span>
                            <span className="text-[10px] text-slate-500">{(r.width * r.depth).toFixed(0)}m²</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {(activeFloor.ducts?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-slate-700">
                        <div className="text-[10px] text-slate-500 mb-2">Lüftungskanäle ({activeFloor.ducts!.length})</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {activeFloor.ducts!.map(d => (
                            <div key={d.id} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-700 cursor-pointer hover:bg-slate-600" onClick={() => { setSelectedDuctId(d.id); setSelectedWallId(null); setSelectedRoomId(null); }}>
                              <div className="w-3 h-1.5 rounded flex-shrink-0" style={{ backgroundColor: d.color || DUCT_TYPE_COLORS[d.type] }} />
                              <span className="flex-1 text-xs text-slate-300 truncate">{d.label || DUCT_TYPE_LABELS[d.type]}</span>
                              <span className="text-[10px] text-slate-500">{d.points.length}pt</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(activeFloor.pipes?.length ?? 0) > 0 && (
                      <div className="pt-2 border-t border-slate-700">
                        <div className="text-[10px] text-slate-500 mb-2">Leitungen ({activeFloor.pipes!.length})</div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {activeFloor.pipes!.map(p => (
                            <div key={p.id} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-700 cursor-pointer hover:bg-slate-600" onClick={() => { setSelectedPipeId(p.id); setSelectedWallId(null); setSelectedRoomId(null); }}>
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || PIPE_TYPE_COLORS[p.type] }} />
                              <span className="flex-1 text-xs text-slate-300 truncate">{p.label || PIPE_TYPE_LABELS[p.type]}</span>
                              <span className="text-[10px] text-slate-500">{p.points.length}pt</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(() => {
                      const floorWidgets = (activeBuilding?.widgets3d ?? []).filter(w => w.floorId === activeFloor.id);
                      if (!viewMode || viewMode !== '3d' || floorWidgets.length === 0) return null;
                      return (
                        <div className="pt-2 border-t border-slate-700">
                          <div className="text-[10px] text-slate-500 mb-2">3D Widgets ({floorWidgets.length})</div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {floorWidgets.map(w => (
                              <div key={w.id} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-700 cursor-pointer hover:bg-slate-600" onClick={() => { setSelectedWidget3DId(w.id); setSelectedWallId(null); setSelectedRoomId(null); setSelectedDuctId(null); setSelectedPipeId(null); setSelectedSlabId(null); }}>
                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: w.color || '#64748b' }} />
                                <span className="flex-1 text-xs text-slate-300 truncate">{w.label || w.type}</span>
                                <span className="text-[10px] text-slate-500">{w.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-8">Stockwerk auswählen</div>
                )}
              </div>

              <div className="p-3 border-t border-slate-700">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Raumtypen</div>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(t => (
                    <div key={t} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ROOM_TYPE_COLORS[t] }} />
                      <span className="text-[10px] text-slate-400">{ROOM_TYPE_LABELS[t]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {datapointPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDatapointPickerOpen(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-[26rem] max-h-[32rem] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                Datenpunkt auswählen
              </span>
              <button onClick={() => setDatapointPickerOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-slate-700">
              <button
                onClick={() => { setPickerTab('driver'); setPickerDevice(null); setEntitySearch(''); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${pickerTab === 'driver' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-750' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Treiber
              </button>
              <button
                onClick={() => { setPickerTab('logic'); setPickerDevice(null); setEntitySearch(''); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${pickerTab === 'logic' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-750' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Logik
              </button>
            </div>

            {pickerDevice !== null && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-750">
                <button
                  onClick={() => { setPickerDevice(null); setEntitySearch(''); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                  Zurück
                </button>
                <span className="text-slate-600 text-xs">/</span>
                <span className="text-xs text-slate-200 font-medium truncate">
                  {pickerTab === 'logic'
                    ? (logicPageGroups.find(g => g.pageId === pickerDevice)?.pageName ?? pickerDevice)
                    : pickerDevice}
                </span>
              </div>
            )}

            {pickerDevice === null && (
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={entitySearch}
                    onChange={e => setEntitySearch(e.target.value)}
                    placeholder="Suchen..."
                    className="flex-1 bg-transparent text-slate-200 text-xs outline-none placeholder-slate-500"
                  />
                  {pickerTab === 'driver' && haLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />}
                  {pickerTab === 'driver' && !haLoading && (
                    <button onClick={() => onLoadHaEntities?.()} className="text-slate-500 hover:text-slate-300" title="Neu laden">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {pickerTab === 'driver' && pickerDevice === null && (
                groupedEntities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <Search className="w-6 h-6 mb-2 opacity-30" />
                    <span className="text-xs">{haEntities.length === 0 ? 'Keine Entitäten geladen' : 'Keine Treffer'}</span>
                    {haEntities.length === 0 && (
                      <button onClick={() => onLoadHaEntities?.()} className="mt-2 text-xs text-blue-400 hover:text-blue-300">
                        Entitäten laden
                      </button>
                    )}
                  </div>
                ) : (
                  groupedEntities.map(([domain, entities]) => (
                    <button
                      key={domain}
                      onClick={() => setPickerDevice(domain)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center">
                          <Activity className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <span className="text-xs text-slate-200 font-medium">{domain}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">{entities.length}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 -rotate-90" />
                      </div>
                    </button>
                  ))
                )
              )}

              {pickerTab === 'driver' && pickerDevice !== null && (() => {
                const entities = groupedEntities.find(([d]) => d === pickerDevice)?.[1] ?? [];
                const q = entitySearch.trim().toLowerCase();
                const filtered = q ? entities.filter(e => e.entity_id.toLowerCase().includes(q) || String(e.attributes.friendly_name || '').toLowerCase().includes(q)) : entities;
                return filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <Search className="w-6 h-6 mb-2 opacity-30" />
                    <span className="text-xs">Keine Treffer</span>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 border-b border-slate-700">
                      <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5">
                        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          value={entitySearch}
                          onChange={e => setEntitySearch(e.target.value)}
                          placeholder="Suchen..."
                          className="flex-1 bg-transparent text-slate-200 text-xs outline-none placeholder-slate-500"
                        />
                      </div>
                    </div>
                    {filtered.map(e => (
                      <button
                        key={e.entity_id}
                        onClick={() => selectDatapoint(e.entity_id)}
                        className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-700 transition-colors text-left border-b border-slate-700/30"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-200 truncate">{e.entity_id}</div>
                          {e.attributes.friendly_name && (
                            <div className="text-[10px] text-slate-500 truncate">{String(e.attributes.friendly_name)}</div>
                          )}
                        </div>
                        {e.state !== undefined && (
                          <span className="text-[10px] text-slate-400 flex-shrink-0 bg-slate-700 px-1.5 py-0.5 rounded">{String(e.state)}</span>
                        )}
                      </button>
                    ))}
                  </>
                );
              })()}

              {pickerTab === 'logic' && pickerDevice === null && (
                logicPageGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <Activity className="w-6 h-6 mb-2 opacity-30" />
                    <span className="text-xs">Keine Logik-Datenpunkte gefunden</span>
                  </div>
                ) : (
                  logicPageGroups
                    .filter(g => !entitySearch || g.pageName.toLowerCase().includes(entitySearch.toLowerCase()))
                    .map(group => (
                      <button
                        key={group.pageId}
                        onClick={() => setPickerDevice(group.pageId)}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <span className="text-xs text-slate-200 font-medium">{group.pageName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">{group.datapoints.length}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500 -rotate-90" />
                        </div>
                      </button>
                    ))
                )
              )}

              {pickerTab === 'logic' && pickerDevice !== null && (() => {
                const group = logicPageGroups.find(g => g.pageId === pickerDevice);
                const q = entitySearch.trim().toLowerCase();
                const dps = group ? (q ? group.datapoints.filter(d => d.entityId.toLowerCase().includes(q) || d.label.toLowerCase().includes(q)) : group.datapoints) : [];
                return dps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                    <Search className="w-6 h-6 mb-2 opacity-30" />
                    <span className="text-xs">Keine Datenpunkte</span>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 border-b border-slate-700">
                      <div className="flex items-center gap-2 bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5">
                        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          value={entitySearch}
                          onChange={e => setEntitySearch(e.target.value)}
                          placeholder="Suchen..."
                          className="flex-1 bg-transparent text-slate-200 text-xs outline-none placeholder-slate-500"
                        />
                      </div>
                    </div>
                    {dps.map(dp => (
                      <button
                        key={dp.entityId}
                        onClick={() => selectDatapoint(dp.entityId)}
                        className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-700 transition-colors text-left border-b border-slate-700/30"
                      >
                        <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <Zap className="w-3 h-3 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-200 truncate">{dp.label !== dp.entityId ? dp.label : dp.entityId}</div>
                          {dp.label !== dp.entityId && (
                            <div className="text-[10px] text-slate-500 truncate">{dp.entityId}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
