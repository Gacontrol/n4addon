import { useState, useCallback, useEffect } from 'react';
import { Building, Floor, Room, Wall, WallOpening, BackgroundImage, BuildingTool, ObjModel } from '../types/building';

function getApiBase(): string {
  const path = window.location.pathname;
  const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
  return m ? `${m[1]}/api` : '/api';
}

const ROOM_COLORS: Record<string, string> = {
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

function createDefaultBuilding(): Building {
  const now = Date.now();
  const floorId = `floor-${now}`;
  return {
    id: `building-${now}`,
    name: 'Gebäude 1',
    floors: [
      {
        id: floorId,
        name: 'Erdgeschoss',
        level: 0,
        height: 3.0,
        rooms: [],
        walls: [],
        backgroundImage: null,
      },
    ],
    objModels: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function useBuildingEditor() {
  const [buildings, setBuildings] = useState<Building[]>([createDefaultBuilding()]);
  const [activeBuildingId, setActiveBuildingId] = useState<string>('');
  const [activeFloorId, setActiveFloorId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [tool, setTool] = useState<BuildingTool>('select');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const apiBase = getApiBase();
        const resp = await fetch(`${apiBase}/building-config`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.buildings?.length > 0) {
            const migrated = data.buildings.map((b: Building) => ({
              ...b,
              objModels: b.objModels ?? [],
              floors: b.floors.map((f: Floor) => ({
                ...f,
                walls: (f.walls ?? []).map((w: Wall) => ({ ...w, openings: w.openings ?? [] })),
                backgroundImage: f.backgroundImage ?? null,
              })),
            }));
            setBuildings(migrated);
            setActiveBuildingId(migrated[0].id);
            setActiveFloorId(migrated[0].floors[0]?.id || '');
          } else {
            const def = createDefaultBuilding();
            setBuildings([def]);
            setActiveBuildingId(def.id);
            setActiveFloorId(def.floors[0].id);
          }
        } else {
          const def = createDefaultBuilding();
          setBuildings([def]);
          setActiveBuildingId(def.id);
          setActiveFloorId(def.floors[0].id);
        }
      } catch {
        const def = createDefaultBuilding();
        setBuildings([def]);
        setActiveBuildingId(def.id);
        setActiveFloorId(def.floors[0].id);
      }
      setIsLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeBuildingId && buildings.length > 0) {
      setActiveBuildingId(buildings[0].id);
      setActiveFloorId(buildings[0].floors[0]?.id || '');
    }
  }, [buildings, activeBuildingId]);

  const saveConfig = useCallback(async (updated: Building[]) => {
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/building-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildings: updated }),
      });
    } catch {
      // offline
    }
  }, []);

  const updateBuildings = useCallback((updated: Building[]) => {
    setBuildings(updated);
    saveConfig(updated);
  }, [saveConfig]);

  const activeBuilding = buildings.find(b => b.id === activeBuildingId) || buildings[0];
  const activeFloor = activeBuilding?.floors.find(f => f.id === activeFloorId) || activeBuilding?.floors[0];

  const addBuilding = useCallback(() => {
    const b = createDefaultBuilding();
    b.name = `Gebäude ${buildings.length + 1}`;
    const updated = [...buildings, b];
    updateBuildings(updated);
    setActiveBuildingId(b.id);
    setActiveFloorId(b.floors[0].id);
  }, [buildings, updateBuildings]);

  const renameBuilding = useCallback((id: string, name: string) => {
    const updated = buildings.map(b => b.id === id ? { ...b, name, updatedAt: Date.now() } : b);
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteBuilding = useCallback((id: string) => {
    const updated = buildings.filter(b => b.id !== id);
    if (updated.length === 0) {
      const def = createDefaultBuilding();
      updateBuildings([def]);
      setActiveBuildingId(def.id);
      setActiveFloorId(def.floors[0].id);
    } else {
      updateBuildings(updated);
      setActiveBuildingId(updated[0].id);
      setActiveFloorId(updated[0].floors[0]?.id || '');
    }
  }, [buildings, updateBuildings]);

  const addFloor = useCallback((buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return;
    const maxLevel = building.floors.reduce((m, f) => Math.max(m, f.level), -1);
    const floor: Floor = {
      id: `floor-${Date.now()}`,
      name: maxLevel === -1 ? 'Untergeschoss' : maxLevel === 0 ? '1. Obergeschoss' : `${maxLevel + 1}. Obergeschoss`,
      level: maxLevel + 1,
      height: 3.0,
      rooms: [],
      walls: [],
      backgroundImage: null,
    };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: [...b.floors, floor].sort((a, b) => a.level - b.level), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
    setActiveFloorId(floor.id);
  }, [buildings, updateBuildings]);

  const addFloorBelow = useCallback((buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return;
    const minLevel = building.floors.reduce((m, f) => Math.min(m, f.level), 1);
    const floor: Floor = {
      id: `floor-${Date.now()}`,
      name: minLevel <= 0 ? `${Math.abs(minLevel - 1)}. Untergeschoss` : 'Untergeschoss',
      level: minLevel - 1,
      height: 3.0,
      rooms: [],
      walls: [],
      backgroundImage: null,
    };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: [...b.floors, floor].sort((a, b) => a.level - b.level), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
    setActiveFloorId(floor.id);
  }, [buildings, updateBuildings]);

  const renameFloor = useCallback((buildingId: string, floorId: string, name: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: b.floors.map(f => f.id === floorId ? { ...f, name } : f), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const updateFloorHeight = useCallback((buildingId: string, floorId: string, height: number) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: b.floors.map(f => f.id === floorId ? { ...f, height } : f), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteFloor = useCallback((buildingId: string, floorId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building || building.floors.length <= 1) return;
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: b.floors.filter(f => f.id !== floorId), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
    const remaining = (updated.find(b => b.id === buildingId)?.floors || []);
    setActiveFloorId(remaining[0]?.id || '');
  }, [buildings, updateBuildings]);

  const setFloorBackground = useCallback((buildingId: string, floorId: string, bg: BackgroundImage | null) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: b.floors.map(f => f.id === floorId ? { ...f, backgroundImage: bg } : f), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const addWall = useCallback((
    buildingId: string,
    floorId: string,
    x1: number, y1: number, x2: number, y2: number,
    thickness = 0.25
  ) => {
    const wall: Wall = {
      id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      x1, y1, x2, y2,
      thickness,
      height: 0,
      color: '#94a3b8',
      opacity: 1,
      materialType: 'concrete',
      openings: [],
    };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, walls: [...f.walls, wall] } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedWallId(wall.id);
    return wall.id;
  }, [buildings, updateBuildings]);

  const updateWall = useCallback((buildingId: string, floorId: string, wallId: string, changes: Partial<Wall>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, walls: f.walls.map(w => w.id === wallId ? { ...w, ...changes } : w) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteWall = useCallback((buildingId: string, floorId: string, wallId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, walls: f.walls.filter(w => w.id !== wallId) } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedWallId(null);
  }, [buildings, updateBuildings]);

  const addRoom = useCallback((
    buildingId: string,
    floorId: string,
    x: number, y: number, width: number, depth: number,
    type: Room['type'],
    name?: string
  ) => {
    const room: Room = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: name || `Raum ${Math.floor(Math.random() * 900 + 100)}`,
      type,
      x, y, width, depth,
      color: ROOM_COLORS[type] || '#94a3b8',
      doors: [],
      windows: [],
    };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, rooms: [...f.rooms, room] } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedRoomId(room.id);
    return room.id;
  }, [buildings, updateBuildings]);

  const updateRoom = useCallback((buildingId: string, floorId: string, roomId: string, changes: Partial<Room>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, rooms: f.rooms.map(r => r.id === roomId ? { ...r, ...changes } : r) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteRoom = useCallback((buildingId: string, floorId: string, roomId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, rooms: f.rooms.filter(r => r.id !== roomId) } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedRoomId(null);
  }, [buildings, updateBuildings]);

  const addWallOpening = useCallback((buildingId: string, floorId: string, wallId: string, opening: Omit<WallOpening, 'id'>) => {
    const newOpening: WallOpening = { ...opening, id: `opening-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, walls: f.walls.map(w => w.id === wallId ? { ...w, openings: [...(w.openings ?? []), newOpening] } : w) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    return newOpening.id;
  }, [buildings, updateBuildings]);

  const updateWallOpening = useCallback((buildingId: string, floorId: string, wallId: string, openingId: string, changes: Partial<WallOpening>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, walls: f.walls.map(w => w.id === wallId ? { ...w, openings: (w.openings ?? []).map(o => o.id === openingId ? { ...o, ...changes } : o) } : w) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteWallOpening = useCallback((buildingId: string, floorId: string, wallId: string, openingId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, walls: f.walls.map(w => w.id === wallId ? { ...w, openings: (w.openings ?? []).filter(o => o.id !== openingId) } : w) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const [selectedObjModelId, setSelectedObjModelId] = useState<string | null>(null);

  const addObjModel = useCallback((buildingId: string, model: ObjModel) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, objModels: [...(b.objModels ?? []), model], updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
    setSelectedObjModelId(model.id);
  }, [buildings, updateBuildings]);

  const updateObjModel = useCallback((buildingId: string, modelId: string, changes: Partial<ObjModel>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            objModels: (b.objModels ?? []).map(m => m.id === modelId ? { ...m, ...changes } : m),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteObjModel = useCallback((buildingId: string, modelId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            objModels: (b.objModels ?? []).filter(m => m.id !== modelId),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedObjModelId(null);
  }, [buildings, updateBuildings]);

  return {
    buildings,
    activeBuildingId,
    activeFloorId,
    activeBuilding,
    activeFloor,
    selectedRoomId,
    selectedWallId,
    tool,
    isLoaded,
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
    selectedObjModelId,
    setSelectedObjModelId,
    addObjModel,
    updateObjModel,
    deleteObjModel,
    ROOM_COLORS,
  };
}
