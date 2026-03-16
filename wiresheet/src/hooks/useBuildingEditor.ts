import { useState, useCallback, useEffect, useRef } from 'react';
import { Building, Floor, Room, Wall, WallOpening, BackgroundImage, BuildingTool, ObjModel, Duct, Pipe, Widget3D, Slab } from '../types/building';

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
        ducts: [],
        pipes: [],
        slabs: [],
        backgroundImage: null,
      },
    ],
    objModels: [],
    widgets3d: [],
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

  const migrateBuildings = (raw: Building[]) => raw.map((b: Building) => ({
    ...b,
    objModels: b.objModels ?? [],
    widgets3d: b.widgets3d ?? [],
    floors: b.floors.map((f: Floor) => ({
      ...f,
      walls: (f.walls ?? []).map((w: Wall) => ({ ...w, openings: w.openings ?? [] })),
      ducts: f.ducts ?? [],
      pipes: f.pipes ?? [],
      slabs: f.slabs ?? [],
      backgroundImage: f.backgroundImage ?? null,
    })),
  }));

  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('wiresheet_building_config');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.buildings?.length > 0) return migrateBuildings(data.buildings);
      }
    } catch { }
    return null;
  };

  useEffect(() => {
    const load = async () => {
      let loaded = false;
      try {
        const apiBase = getApiBase();
        const resp = await fetch(`${apiBase}/building-config`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.buildings?.length > 0) {
            const migrated = migrateBuildings(data.buildings);
            setBuildings(migrated);
            setActiveBuildingId(migrated[0].id);
            setActiveFloorId(migrated[0].floors[0]?.id || '');
            loaded = true;
          }
        }
      } catch { }

      if (!loaded) {
        const fromLS = loadFromLocalStorage();
        if (fromLS) {
          setBuildings(fromLS);
          setActiveBuildingId(fromLS[0].id);
          setActiveFloorId(fromLS[0].floors[0]?.id || '');
          loaded = true;
        }
      }

      if (!loaded) {
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

  const historyRef = useRef<Building[][]>([]);
  const isUndoingRef = useRef(false);

  const saveConfig = useCallback(async (updated: Building[]) => {
    const payload = JSON.stringify({ buildings: updated });
    try {
      localStorage.setItem('wiresheet_building_config', payload);
    } catch { }
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/building-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    } catch {
      // offline – data persisted in localStorage
    }
  }, []);

  const updateBuildings = useCallback((updated: Building[]) => {
    if (!isUndoingRef.current) {
      setBuildings(prev => {
        historyRef.current = [...historyRef.current.slice(-49), prev];
        return updated;
      });
    } else {
      setBuildings(updated);
    }
    saveConfig(updated);
  }, [saveConfig]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    isUndoingRef.current = true;
    setBuildings(prev);
    saveConfig(prev);
    isUndoingRef.current = false;
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
      ducts: [],
      pipes: [],
      slabs: [],
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
      ducts: [],
      pipes: [],
      slabs: [],
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

  const updateFloorColor = useCallback((buildingId: string, floorId: string, floorColor: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: b.floors.map(f => f.id === floorId ? { ...f, floorColor } : f), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const updateFloorProps = useCallback((buildingId: string, floorId: string, changes: Partial<Floor>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: b.floors.map(f => f.id === floorId ? { ...f, ...changes } : f), updatedAt: Date.now() }
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

  const addPolygonRoom = useCallback((
    buildingId: string,
    floorId: string,
    points: { x: number; y: number }[],
    type: Room['type'],
    name?: string
  ) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const room: Room = {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: name || `Zone ${Math.floor(Math.random() * 900 + 100)}`,
      type,
      x: minX, y: minY,
      width: Math.max(...xs) - minX,
      depth: Math.max(...ys) - minY,
      color: ROOM_COLORS[type] || '#22c55e',
      doors: [],
      windows: [],
      points,
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

  // ---- Duct Actions ----

  const addDuct = useCallback((buildingId: string, floorId: string, duct: Omit<Duct, 'id'>) => {
    const newDuct: Duct = { ...duct, id: `duct-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, ducts: [...(f.ducts ?? []), newDuct] } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    return newDuct.id;
  }, [buildings, updateBuildings]);

  const updateDuct = useCallback((buildingId: string, floorId: string, ductId: string, changes: Partial<Duct>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, ducts: (f.ducts ?? []).map(d => d.id === ductId ? { ...d, ...changes } : d) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const moveDuctPoint = useCallback((buildingId: string, floorId: string, ductId: string, pointIndex: number, x: number, y: number) => {
    const updated = buildings.map(b =>
      b.id === buildingId ? {
        ...b,
        floors: b.floors.map(f =>
          f.id === floorId ? {
            ...f,
            ducts: (f.ducts ?? []).map(d =>
              d.id === ductId ? { ...d, points: d.points.map((p, i) => i === pointIndex ? { ...p, x, y } : p) } : d
            ),
          } : f
        ),
        updatedAt: Date.now(),
      } : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const moveDuct = useCallback((buildingId: string, floorId: string, ductId: string, dx: number, dy: number) => {
    const updated = buildings.map(b =>
      b.id === buildingId ? {
        ...b,
        floors: b.floors.map(f =>
          f.id === floorId ? {
            ...f,
            ducts: (f.ducts ?? []).map(d =>
              d.id === ductId ? { ...d, points: d.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) } : d
            ),
          } : f
        ),
        updatedAt: Date.now(),
      } : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteDuct = useCallback((buildingId: string, floorId: string, ductId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, ducts: (f.ducts ?? []).filter(d => d.id !== ductId) } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  // ---- Pipe Actions ----

  const addPipe = useCallback((buildingId: string, floorId: string, pipe: Omit<Pipe, 'id'>) => {
    const newPipe: Pipe = { ...pipe, id: `pipe-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, pipes: [...(f.pipes ?? []), newPipe] } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    return newPipe.id;
  }, [buildings, updateBuildings]);

  const updatePipe = useCallback((buildingId: string, floorId: string, pipeId: string, changes: Partial<Pipe>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, pipes: (f.pipes ?? []).map(p => p.id === pipeId ? { ...p, ...changes } : p) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const movePipePoint = useCallback((buildingId: string, floorId: string, pipeId: string, pointIndex: number, x: number, y: number) => {
    const updated = buildings.map(b =>
      b.id === buildingId ? {
        ...b,
        floors: b.floors.map(f =>
          f.id === floorId ? {
            ...f,
            pipes: (f.pipes ?? []).map(p =>
              p.id === pipeId ? { ...p, points: p.points.map((pt, i) => i === pointIndex ? { ...pt, x, y } : pt) } : p
            ),
          } : f
        ),
        updatedAt: Date.now(),
      } : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const movePipe = useCallback((buildingId: string, floorId: string, pipeId: string, dx: number, dy: number) => {
    const updated = buildings.map(b =>
      b.id === buildingId ? {
        ...b,
        floors: b.floors.map(f =>
          f.id === floorId ? {
            ...f,
            pipes: (f.pipes ?? []).map(p =>
              p.id === pipeId ? { ...p, points: p.points.map(pt => ({ ...pt, x: pt.x + dx, y: pt.y + dy })) } : p
            ),
          } : f
        ),
        updatedAt: Date.now(),
      } : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deletePipe = useCallback((buildingId: string, floorId: string, pipeId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, pipes: (f.pipes ?? []).filter(p => p.id !== pipeId) } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const moveMultiSelection = useCallback((
    buildingId: string,
    floorId: string,
    sel: { wallIds: string[]; roomIds: string[]; ductIds: string[]; pipeIds: string[] },
    dx: number,
    dy: number
  ) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? {
                    ...f,
                    walls: f.walls.map(w =>
                      sel.wallIds.includes(w.id)
                        ? { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy }
                        : w
                    ),
                    rooms: f.rooms.map(r =>
                      sel.roomIds.includes(r.id) ? { ...r, x: r.x + dx, y: r.y + dy } : r
                    ),
                    ducts: (f.ducts ?? []).map(d =>
                      sel.ductIds.includes(d.id)
                        ? { ...d, points: d.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }
                        : d
                    ),
                    pipes: (f.pipes ?? []).map(p =>
                      sel.pipeIds.includes(p.id)
                        ? { ...p, points: p.points.map(pt => ({ ...pt, x: pt.x + dx, y: pt.y + dy })) }
                        : p
                    ),
                  }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const pasteComponents = useCallback((
    buildingId: string,
    floorId: string,
    walls: Wall[],
    rooms: Room[],
    ducts: Duct[],
    pipes: Pipe[],
    offset: number
  ): { wallIds: string[]; roomIds: string[]; ductIds: string[]; pipeIds: string[] } => {
    const mkId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newWalls = walls.map(w => ({ ...w, id: mkId('wall'), x1: w.x1 + offset, y1: w.y1 + offset, x2: w.x2 + offset, y2: w.y2 + offset }));
    const newRooms = rooms.map(r => ({ ...r, id: mkId('room'), x: r.x + offset, y: r.y + offset }));
    const newDucts = ducts.map(d => ({ ...d, id: mkId('duct'), points: d.points.map(p => ({ ...p, x: p.x + offset, y: p.y + offset })) }));
    const newPipes = pipes.map(p => ({ ...p, id: mkId('pipe'), points: p.points.map(pt => ({ ...pt, x: pt.x + offset, y: pt.y + offset })) }));
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? {
                    ...f,
                    walls: [...f.walls, ...newWalls],
                    rooms: [...f.rooms, ...newRooms],
                    ducts: [...(f.ducts ?? []), ...newDucts],
                    pipes: [...(f.pipes ?? []), ...newPipes],
                  }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    return {
      wallIds: newWalls.map(w => w.id),
      roomIds: newRooms.map(r => r.id),
      ductIds: newDucts.map(d => d.id),
      pipeIds: newPipes.map(p => p.id),
    };
  }, [buildings, updateBuildings]);

  // ---- Widget3D Actions ----

  const [selectedWidget3DId, setSelectedWidget3DId] = useState<string | null>(null);

  const addWidget3D = useCallback((buildingId: string, widget: Omit<Widget3D, 'id'>) => {
    const newWidget: Widget3D = { ...widget, id: `widget3d-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, widgets3d: [...(b.widgets3d ?? []), newWidget], updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
    setSelectedWidget3DId(newWidget.id);
    return newWidget.id;
  }, [buildings, updateBuildings]);

  const updateWidget3D = useCallback((buildingId: string, widgetId: string, changes: Partial<Widget3D>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            widgets3d: (b.widgets3d ?? []).map(w => w.id === widgetId ? { ...w, ...changes } : w),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteWidget3D = useCallback((buildingId: string, widgetId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            widgets3d: (b.widgets3d ?? []).filter(w => w.id !== widgetId),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedWidget3DId(null);
  }, [buildings, updateBuildings]);

  // ---- Slab Actions ----

  const addSlab = useCallback((buildingId: string, floorId: string, slab: Omit<Slab, 'id'>) => {
    const newSlab: Slab = { ...slab, id: `slab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, slabs: [...(f.slabs ?? []), newSlab] } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    return newSlab.id;
  }, [buildings, updateBuildings]);

  const updateSlab = useCallback((buildingId: string, floorId: string, slabId: string, changes: Partial<Slab>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, slabs: (f.slabs ?? []).map(s => s.id === slabId ? { ...s, ...changes } : s) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteSlab = useCallback((buildingId: string, floorId: string, slabId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, slabs: (f.slabs ?? []).filter(s => s.id !== slabId) } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  // ---- OBJ Model Actions ----

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
    undo,
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
    addPolygonRoom,
    updateRoom,
    deleteRoom,
    addWallOpening,
    updateWallOpening,
    deleteWallOpening,
    addDuct,
    updateDuct,
    moveDuctPoint,
    moveDuct,
    deleteDuct,
    addPipe,
    updatePipe,
    movePipePoint,
    movePipe,
    deletePipe,
    moveMultiSelection,
    pasteComponents,
    addSlab,
    updateSlab,
    deleteSlab,
    selectedWidget3DId,
    setSelectedWidget3DId,
    addWidget3D,
    updateWidget3D,
    deleteWidget3D,
    selectedObjModelId,
    setSelectedObjModelId,
    addObjModel,
    updateObjModel,
    deleteObjModel,
    ROOM_COLORS,
  };
}
