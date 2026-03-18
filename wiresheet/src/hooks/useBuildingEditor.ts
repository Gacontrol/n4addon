import { useState, useCallback, useEffect, useRef } from 'react';
import { Building, Floor, Room, Wall, WallOpening, BackgroundImage, BuildingTool, ObjModel, Duct, Pipe, Widget3D, Slab, FloorLayers, FurnitureItem } from '../types/building';

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
      furniture: f.furniture ?? [],
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
          try {
            const apiBase = getApiBase();
            await fetch(`${apiBase}/building-config`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ buildings: fromLS }),
            });
          } catch { }
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
      window.dispatchEvent(new CustomEvent('wiresheet-building-updated', { detail: { buildings: updated } }));
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

  // ---- Layer Actions ----

  const updateFloorLayers = useCallback((buildingId: string, floorId: string, layers: Partial<FloorLayers>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, layers: { walls: true, ducts: true, pipes: true, background: true, rooms: true, slabs: true, ...(f.layers ?? {}), ...layers } }
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

  const insertDuctPoint = useCallback((buildingId: string, floorId: string, ductId: string, afterIndex: number, x: number, y: number) => {
    const updated = buildings.map(b =>
      b.id === buildingId ? {
        ...b,
        floors: b.floors.map(f =>
          f.id === floorId ? {
            ...f,
            ducts: (f.ducts ?? []).map(d => {
              if (d.id !== ductId) return d;
              const pts = [...d.points];
              pts.splice(afterIndex + 1, 0, { x, y });
              return { ...d, points: pts };
            }),
          } : f
        ),
        updatedAt: Date.now(),
      } : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const removeDuctPoint = useCallback((buildingId: string, floorId: string, ductId: string, pointIndex: number) => {
    const updated = buildings.map(b =>
      b.id === buildingId ? {
        ...b,
        floors: b.floors.map(f =>
          f.id === floorId ? {
            ...f,
            ducts: (f.ducts ?? []).map(d => {
              if (d.id !== ductId) return d;
              if (d.points.length <= 2) return d;
              const pts = d.points.filter((_, i) => i !== pointIndex);
              return { ...d, points: pts };
            }),
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
            ducts: (f.ducts ?? []).map(d => {
              if (d.id !== ductId) return d;
              const moved = { ...d, points: d.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) };
              if (d.isVertical && d.verticalX != null) {
                moved.verticalX = d.verticalX + dx;
                moved.verticalY = (d.verticalY ?? 0) + dy;
              }
              return moved;
            }),
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

  const connectDuctEndpoints = useCallback((buildingId: string, floorId: string, ductId1: string, pointIdx1: number, ductId2: string, pointIdx2: number): string | null => {
    const building = buildings.find(b => b.id === buildingId);
    const floor = building?.floors.find(f => f.id === floorId);
    if (!floor) return null;

    const d1 = (floor.ducts ?? []).find(d => d.id === ductId1);
    const d2 = (floor.ducts ?? []).find(d => d.id === ductId2);
    if (!d1 || !d2) return null;

    const pt1 = d1.points[pointIdx1];
    const pt2 = d2.points[pointIdx2];
    if (!pt1 || !pt2) return null;

    const isStart1 = pointIdx1 === 0;
    const isEnd1 = pointIdx1 === d1.points.length - 1;
    const isStart2 = pointIdx2 === 0;
    const isEnd2 = pointIdx2 === d2.points.length - 1;

    let pts1: typeof d1.points;
    if (isEnd1) {
      pts1 = [...d1.points];
    } else if (isStart1) {
      pts1 = [...d1.points].reverse();
    } else {
      pts1 = d1.points.slice(0, pointIdx1 + 1);
    }

    let pts2: typeof d2.points;
    if (isStart2) {
      pts2 = [...d2.points];
    } else if (isEnd2) {
      pts2 = [...d2.points].reverse();
    } else {
      pts2 = d2.points.slice(pointIdx2);
    }

    const sizeMismatch =
      Math.abs(d1.width - d2.width) > 0.001 ||
      Math.abs(d1.height - d2.height) > 0.001 ||
      d1.shape !== d2.shape;

    const TRANSITION_LENGTH = 0.6;
    const newDucts: Duct[] = [];
    const idsToRemove = [ductId1, ductId2];

    const joinPt = { x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 };

    if (sizeMismatch) {
      const dx = pt2.x - pt1.x;
      const dy = pt2.y - pt1.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const dir = { x: dx / len, y: dy / len };
      const transStart = { x: joinPt.x - dir.x * (TRANSITION_LENGTH / 2), y: joinPt.y - dir.y * (TRANSITION_LENGTH / 2) };
      const transEnd = { x: joinPt.x + dir.x * (TRANSITION_LENGTH / 2), y: joinPt.y + dir.y * (TRANSITION_LENGTH / 2) };

      const mergedId1 = `duct-${Date.now()}-a-${Math.random().toString(36).substr(2, 6)}`;
      const mergedId2 = `duct-${Date.now()}-b-${Math.random().toString(36).substr(2, 6)}`;
      const transId = `duct-${Date.now()}-trans-${Math.random().toString(36).substr(2, 6)}`;

      newDucts.push({
        ...d1,
        id: mergedId1,
        points: [...pts1.slice(0, -1), transStart],
      });
      newDucts.push({
        id: transId,
        points: [transStart, transEnd],
        shape: d1.shape,
        type: d1.type,
        width: d1.width,
        height: d1.height,
        elevation: d1.elevation,
        color: d1.color,
        label: 'Übergang',
        insulated: d1.insulated,
        isTransition: true,
        transitionToWidth: d2.width,
        transitionToHeight: d2.height,
        transitionToShape: d2.shape,
      });
      newDucts.push({
        ...d2,
        id: mergedId2,
        points: [transEnd, ...pts2.slice(1)],
      });

      const updated = buildings.map(b =>
        b.id === buildingId
          ? {
              ...b,
              floors: b.floors.map(f =>
                f.id === floorId
                  ? { ...f, ducts: [...(f.ducts ?? []).filter(d => !idsToRemove.includes(d.id)), ...newDucts] }
                  : f
              ),
              updatedAt: Date.now(),
            }
          : b
      );
      updateBuildings(updated);
      return mergedId1;
    } else {
      const mergedId = `duct-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const mergedPoints = [...pts1.slice(0, -1), joinPt, ...pts2.slice(1)];
      newDucts.push({ ...d1, id: mergedId, points: mergedPoints });

      const updated = buildings.map(b =>
        b.id === buildingId
          ? {
              ...b,
              floors: b.floors.map(f =>
                f.id === floorId
                  ? { ...f, ducts: [...(f.ducts ?? []).filter(d => !idsToRemove.includes(d.id)), ...newDucts] }
                  : f
              ),
              updatedAt: Date.now(),
            }
          : b
      );
      updateBuildings(updated);
      return mergedId;
    }
  }, [buildings, updateBuildings]);

  const mergeDucts = useCallback((buildingId: string, floorId: string, ductIds: string[]): string | null => {
    if (ductIds.length < 2) return null;

    const building = buildings.find(b => b.id === buildingId);
    const floor = building?.floors.find(f => f.id === floorId);
    if (!floor) return null;

    const ductsToMerge = (floor.ducts ?? []).filter(d => ductIds.includes(d.id));
    if (ductsToMerge.length < 2) return null;

    const baseDuct = ductsToMerge[0];
    const otherDucts = ductsToMerge.slice(1);

    const ptDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const TRANSITION_LENGTH = 0.6;

    const transitionDucts: Duct[] = [];
    const idsToRemove: string[] = [];
    const mergedGroups: { ducts: Duct[]; baseDuct: Duct }[] = [];

    let currentGroup: Duct[] = [baseDuct];
    let currentWidth = baseDuct.width;
    let currentHeight = baseDuct.height;
    let currentShape = baseDuct.shape;

    for (const duct of otherDucts) {
      const pts = duct.points;
      if (pts.length < 2) continue;

      const sizeMismatch =
        Math.abs(duct.width - currentWidth) > 0.001 ||
        Math.abs(duct.height - currentHeight) > 0.001 ||
        duct.shape !== currentShape;

      if (sizeMismatch) {
        mergedGroups.push({ ducts: currentGroup, baseDuct: currentGroup[0] });
        currentGroup = [duct];
        currentWidth = duct.width;
        currentHeight = duct.height;
        currentShape = duct.shape;

        const prevGroupLast = mergedGroups[mergedGroups.length - 1].ducts;
        const prevBase = prevGroupLast[prevGroupLast.length - 1];
        const prevPts = prevBase.points;
        const prevEnd = prevPts[prevPts.length - 1];
        const ductStart = pts[0];
        const ductEnd = pts[pts.length - 1];
        const d0 = ptDist(prevEnd, ductStart);
        const d1 = ptDist(prevEnd, ductEnd);
        const joinPt = prevEnd;
        const nextPt = d0 <= d1 ? ductStart : ductEnd;

        const dx = nextPt.x - joinPt.x;
        const dy = nextPt.y - joinPt.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const dir = { x: dx / len, y: dy / len };
        const transStart = { x: joinPt.x - dir.x * (TRANSITION_LENGTH / 2), y: joinPt.y - dir.y * (TRANSITION_LENGTH / 2) };
        const transEnd = { x: joinPt.x + dir.x * (TRANSITION_LENGTH / 2), y: joinPt.y + dir.y * (TRANSITION_LENGTH / 2) };

        const prevDuct = prevGroupLast[0];
        transitionDucts.push({
          id: `duct-${Date.now()}-trans-${Math.random().toString(36).substr(2, 6)}`,
          points: [transStart, transEnd],
          shape: prevDuct.shape,
          type: prevDuct.type,
          width: prevDuct.width,
          height: prevDuct.height,
          elevation: prevDuct.elevation,
          color: prevDuct.color,
          label: 'Übergang',
          insulated: prevDuct.insulated,
          isTransition: true,
          transitionToWidth: duct.width,
          transitionToHeight: duct.height,
          transitionToShape: duct.shape,
        });
      } else {
        currentGroup.push(duct);
      }
    }
    mergedGroups.push({ ducts: currentGroup, baseDuct: currentGroup[0] });

    const resultDucts: Duct[] = [];

    for (const group of mergedGroups) {
      if (group.ducts.length === 1) {
        resultDucts.push(group.ducts[0]);
        continue;
      }

      idsToRemove.push(...group.ducts.map(d => d.id));

      const base = group.ducts[0];
      let mergedPoints = [...base.points];

      for (const duct of group.ducts.slice(1)) {
        const pts = duct.points;
        if (pts.length < 2) continue;
        const mergedStart = mergedPoints[0];
        const mergedEnd = mergedPoints[mergedPoints.length - 1];
        const ductStart = pts[0];
        const ductEnd = pts[pts.length - 1];
        const connections = [
          { d: ptDist(mergedEnd, ductStart), type: 'end-start' as const },
          { d: ptDist(mergedEnd, ductEnd), type: 'end-end' as const },
          { d: ptDist(mergedStart, ductStart), type: 'start-start' as const },
          { d: ptDist(mergedStart, ductEnd), type: 'start-end' as const },
        ];
        const best = connections.reduce((a, b) => (a.d < b.d ? a : b));
        switch (best.type) {
          case 'end-start': mergedPoints = [...mergedPoints, ...pts.slice(1)]; break;
          case 'end-end': mergedPoints = [...mergedPoints, ...[...pts].reverse().slice(1)]; break;
          case 'start-start': mergedPoints = [[...pts].reverse().slice(0, -1), mergedPoints].flat(); break;
          case 'start-end': mergedPoints = [pts.slice(0, -1), mergedPoints].flat(); break;
        }
      }

      resultDucts.push({
        ...base,
        id: `duct-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        points: mergedPoints,
      });
    }

    const selectedDuctIdSet = new Set(ductIds);

    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? {
                    ...f,
                    ducts: [
                      ...(f.ducts ?? []).filter(d => !selectedDuctIdSet.has(d.id)),
                      ...resultDucts,
                      ...transitionDucts,
                    ],
                  }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    return resultDucts[0]?.id ?? null;
  }, [buildings, updateBuildings]);

  const splitDuct = useCallback((buildingId: string, floorId: string, ductId: string, pointIndex: number): [string, string] | null => {
    const building = buildings.find(b => b.id === buildingId);
    const floor = building?.floors.find(f => f.id === floorId);
    if (!floor) return null;

    const duct = (floor.ducts ?? []).find(d => d.id === ductId);
    if (!duct || duct.points.length < 3) return null;
    if (pointIndex <= 0 || pointIndex >= duct.points.length - 1) return null;

    const firstHalf: Duct = {
      ...duct,
      id: `duct-${Date.now()}-a-${Math.random().toString(36).substr(2, 6)}`,
      points: duct.points.slice(0, pointIndex + 1),
    };
    const secondHalf: Duct = {
      ...duct,
      id: `duct-${Date.now()}-b-${Math.random().toString(36).substr(2, 6)}`,
      points: duct.points.slice(pointIndex),
    };

    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? {
                    ...f,
                    ducts: [
                      ...(f.ducts ?? []).filter(d => d.id !== ductId),
                      firstHalf,
                      secondHalf,
                    ],
                  }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    return [firstHalf.id, secondHalf.id];
  }, [buildings, updateBuildings]);

  const addVerticalDuctFromFloorPlan = useCallback((buildingId: string, floorId: string, duct: Omit<Duct, 'id'>): string => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return '';
    const sortedFloors = [...building.floors].sort((a, b) => a.level - b.level);
    const floorIdx = sortedFloors.findIndex(f => f.id === floorId);
    const floorHeight = sortedFloors[floorIdx]?.height ?? 3;
    let baseY = 0;
    for (let i = 0; i < floorIdx; i++) baseY += sortedFloors[i].height;
    const newDuct: Duct = {
      ...duct,
      id: `duct-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      verticalSectionPoints: [{ x: duct.verticalX ?? 0, y: baseY + 0.1 }, { x: duct.verticalX ?? 0, y: baseY + floorHeight - 0.1 }],
    };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? { ...b, floors: b.floors.map(f => f.id === floorId ? { ...f, ducts: [...(f.ducts ?? []), newDuct] } : f), updatedAt: Date.now() }
        : b
    );
    updateBuildings(updated);
    return newDuct.id;
  }, [buildings, updateBuildings]);

  const updateVerticalDuctSectionPoints = useCallback((buildingId: string, fromFloorId: string, ductId: string, newPoints: { x: number; y: number }[]) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building || newPoints.length < 2) return;

    const sortedFloors = [...building.floors].sort((a, b) => a.level - b.level);
    const floorBounds: { floor: typeof sortedFloors[0]; baseY: number; topY: number }[] = [];
    let accY = 0;
    for (const f of sortedFloors) {
      floorBounds.push({ floor: f, baseY: accY, topY: accY + f.height });
      accY += f.height;
    }

    const minY = Math.min(...newPoints.map(p => p.y));
    const maxY = Math.max(...newPoints.map(p => p.y));

    const spannedFloors = floorBounds.filter(fb => fb.topY > minY && fb.baseY < maxY);

    if (spannedFloors.length <= 1) {
      const updated = buildings.map(b =>
        b.id === buildingId
          ? {
              ...b,
              floors: b.floors.map(f =>
                f.id === fromFloorId
                  ? { ...f, ducts: (f.ducts ?? []).map(d => d.id === ductId ? { ...d, verticalSectionPoints: newPoints } : d) }
                  : f
              ),
              updatedAt: Date.now(),
            }
          : b
      );
      updateBuildings(updated);
      return;
    }

    const fromFloor = building.floors.find(f => f.id === fromFloorId);
    const baseDuct = (fromFloor?.ducts ?? []).find(d => d.id === ductId);
    if (!baseDuct) return;

    const newDucts: { floorId: string; duct: Duct }[] = [];

    for (const fb of spannedFloors) {
      const segStart = Math.max(minY, fb.baseY);
      const segEnd = Math.min(maxY, fb.topY);
      if (segEnd <= segStart) continue;
      const vx = baseDuct.verticalX ?? newPoints[0].x;
      const segPoints = [{ x: vx, y: segStart }, { x: vx, y: segEnd }];
      const isOriginal = fb.floor.id === fromFloorId;
      newDucts.push({
        floorId: fb.floor.id,
        duct: {
          ...baseDuct,
          id: isOriginal ? ductId : `duct-${Date.now()}-v-${Math.random().toString(36).substr(2, 6)}`,
          verticalSectionPoints: segPoints,
        },
      });
    }

    const updated = buildings.map(b => {
      if (b.id !== buildingId) return b;
      const floors = b.floors.map(f => {
        const match = newDucts.find(nd => nd.floorId === f.id);
        const isOrigFloor = f.id === fromFloorId;
        if (isOrigFloor && match) {
          return { ...f, ducts: [...(f.ducts ?? []).filter(d => d.id !== ductId), match.duct] };
        } else if (isOrigFloor) {
          return { ...f, ducts: (f.ducts ?? []).filter(d => d.id !== ductId) };
        } else if (match) {
          const existing = (f.ducts ?? []).find(d => d.id === match.duct.id);
          if (existing) {
            return { ...f, ducts: (f.ducts ?? []).map(d => d.id === match.duct.id ? match.duct : d) };
          }
          return { ...f, ducts: [...(f.ducts ?? []), match.duct] };
        }
        return f;
      });
      return { ...b, floors, updatedAt: Date.now() };
    });
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
    offset: number,
    slabs: Slab[] = []
  ): { wallIds: string[]; roomIds: string[]; ductIds: string[]; pipeIds: string[]; slabIds: string[] } => {
    const mkId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newWalls = walls.map(w => ({ ...w, id: mkId('wall'), x1: w.x1 + offset, y1: w.y1 + offset, x2: w.x2 + offset, y2: w.y2 + offset }));
    const newRooms = rooms.map(r => ({ ...r, id: mkId('room'), x: r.x + offset, y: r.y + offset }));
    const newDucts = ducts.map(d => ({ ...d, id: mkId('duct'), points: d.points.map(p => ({ ...p, x: p.x + offset, y: p.y + offset })) }));
    const newPipes = pipes.map(p => ({ ...p, id: mkId('pipe'), points: p.points.map(pt => ({ ...pt, x: pt.x + offset, y: pt.y + offset })) }));
    const newSlabs = slabs.map(s => ({ ...s, id: mkId('slab'), points: s.points.map(pt => ({ x: pt.x + offset, y: pt.y + offset })) }));
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
                    slabs: [...(f.slabs ?? []), ...newSlabs],
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
      slabIds: newSlabs.map(s => s.id),
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

  // ---- Furniture Actions ----

  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);

  const addFurniture = useCallback((buildingId: string, floorId: string, item: Omit<FurnitureItem, 'id'>) => {
    const newItem: FurnitureItem = { ...item, id: `furniture-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` };
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, furniture: [...(f.furniture ?? []), newItem] } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedFurnitureId(newItem.id);
    return newItem.id;
  }, [buildings, updateBuildings]);

  const updateFurniture = useCallback((buildingId: string, floorId: string, itemId: string, changes: Partial<FurnitureItem>) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? { ...f, furniture: (f.furniture ?? []).map(fi => fi.id === itemId ? { ...fi, ...changes } : fi) }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
  }, [buildings, updateBuildings]);

  const deleteFurniture = useCallback((buildingId: string, floorId: string, itemId: string) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId ? { ...f, furniture: (f.furniture ?? []).filter(fi => fi.id !== itemId) } : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedFurnitureId(null);
  }, [buildings, updateBuildings]);

  const deleteMultiSelection = useCallback((
    buildingId: string,
    floorId: string,
    sel: { wallIds: string[]; roomIds: string[]; ductIds: string[]; pipeIds: string[] }
  ) => {
    const updated = buildings.map(b =>
      b.id === buildingId
        ? {
            ...b,
            floors: b.floors.map(f =>
              f.id === floorId
                ? {
                    ...f,
                    walls: f.walls.filter(w => !sel.wallIds.includes(w.id)),
                    rooms: f.rooms.filter(r => !sel.roomIds.includes(r.id)),
                    ducts: (f.ducts ?? []).filter(d => !sel.ductIds.includes(d.id)),
                    pipes: (f.pipes ?? []).filter(p => !sel.pipeIds.includes(p.id)),
                  }
                : f
            ),
            updatedAt: Date.now(),
          }
        : b
    );
    updateBuildings(updated);
    setSelectedWallId(null);
    setSelectedRoomId(null);
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
    updateFloorLayers,
    addDuct,
    addVerticalDuctFromFloorPlan,
    updateVerticalDuctSectionPoints,
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
    deleteMultiSelection,
    selectedFurnitureId,
    setSelectedFurnitureId,
    addFurniture,
    updateFurniture,
    deleteFurniture,
    ROOM_COLORS,
  };
}
