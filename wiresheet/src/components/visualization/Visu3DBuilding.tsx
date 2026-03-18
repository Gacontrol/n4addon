import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Building3DWidgetConfig } from '../../types/visualization';
import { Building } from '../../types/building';
import { BuildingCanvas3D, DEFAULT_LIGHTING, DEFAULT_EXPLOSION, LightingSettings, ExplosionSettings, VisibleLayer } from '../building/BuildingCanvas3D';
import { Maximize2, ChevronDown, RotateCcw } from 'lucide-react';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  if (m) return `${m[1]}/api`;
  return '/api';
}

interface Visu3DBuildingProps {
  config: Building3DWidgetConfig;
  width?: number;
  height?: number;
  isEditMode: boolean;
  instanceId?: string;
}

export const Visu3DBuilding: React.FC<Visu3DBuildingProps> = ({
  config,
  isEditMode,
  instanceId,
}) => {
  const [liveValues] = useState<Record<string, string | number>>({});
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [showFloorSelector, setShowFloorSelector] = useState(false);
  const [floorIsolated, setFloorIsolated] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);
  const myId = useRef(instanceId || `visu3d-${Math.random().toString(36).slice(2)}`);

  const applyBuildingList = useCallback((buildingList: Building[]) => {
    setBuildings(buildingList);
    if (!initializedRef.current && buildingList.length > 0) {
      initializedRef.current = true;
      const selectedBuilding = config.buildingId
        ? (buildingList.find(b => b.id === config.buildingId) || buildingList[0])
        : buildingList[0];
      if (config.floorId) {
        const floorExists = selectedBuilding.floors.some(f => f.id === config.floorId);
        setActiveFloorId(floorExists ? config.floorId : (selectedBuilding.floors[0]?.id || null));
      } else if (config.showAllFloors) {
        setActiveFloorId(null);
      } else {
        setActiveFloorId(selectedBuilding.floors[0]?.id || null);
      }
    }
  }, [config.buildingId, config.floorId, config.showAllFloors]);

  const loadFromLocalStorage = useCallback((): Building[] => {
    try {
      const ls = localStorage.getItem('wiresheet_building_config');
      if (ls) {
        const parsed = JSON.parse(ls);
        return parsed.buildings || (parsed.id ? [parsed] : []);
      }
    } catch { }
    return [];
  }, []);

  const loadBuildings = useCallback(async () => {
    const localList = loadFromLocalStorage();
    if (localList.length > 0) {
      applyBuildingList(localList);
      setError(null);
      setLoading(false);
    }

    try {
      const res = await fetch(`${getApiBase()}/building-config`);
      if (res.ok) {
        const data = await res.json();
        let buildingList: Building[] = data.buildings || (data.id ? [data] : []);
        if (buildingList.length === 0) {
          buildingList = localList;
        }
        if (buildingList.length > 0) {
          applyBuildingList(buildingList);
          setError(null);
        } else if (localList.length === 0) {
          setError('Kein Gebäude vorhanden');
        }
      } else if (localList.length === 0) {
        setError('Gebäude nicht gefunden');
      }
    } catch {
      if (localList.length === 0) {
        setError('Verbindungsfehler');
      }
    } finally {
      setLoading(false);
    }
  }, [applyBuildingList, loadFromLocalStorage]);

  useEffect(() => {
    loadBuildings();
    pollRef.current = setInterval(loadBuildings, 5000);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'wiresheet_building_config') {
        loadBuildings();
      }
    };
    const onBuildingUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.buildings) {
        applyBuildingList(detail.buildings);
        setError(null);
        setLoading(false);
      } else {
        loadBuildings();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('wiresheet-building-updated', onBuildingUpdated);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('wiresheet-building-updated', onBuildingUpdated);
    };
  }, [loadBuildings]);

  useEffect(() => {
    const id = myId.current;

    const onFocusFloor = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.targetId && detail.targetId !== id) return;
    };
    const onFocusRoom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.targetId && detail.targetId !== id) return;
    };
    const onSetCameraPos = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.targetId && detail.targetId !== id) return;
    };

    window.addEventListener('focus-floor', onFocusFloor);
    window.addEventListener('focus-room', onFocusRoom);
    window.addEventListener('set-camera-pos', onSetCameraPos);

    return () => {
      window.removeEventListener('focus-floor', onFocusFloor);
      window.removeEventListener('focus-room', onFocusRoom);
      window.removeEventListener('set-camera-pos', onSetCameraPos);
    };
  }, []);

  const lighting: LightingSettings = {
    ...DEFAULT_LIGHTING,
    ambientIntensity: config.ambientIntensity ?? DEFAULT_LIGHTING.ambientIntensity,
    sunIntensity: config.sunIntensity ?? DEFAULT_LIGHTING.sunIntensity,
  };

  const explosion: ExplosionSettings = {
    ...DEFAULT_EXPLOSION,
    enabled: config.showExplosion ?? false,
    offsetZ: config.explosionOffset ?? DEFAULT_EXPLOSION.offsetZ,
  };

  const bgTransparent = config.transparentBackground ?? false;
  const bgColor = config.backgroundColor || '#0a1020';
  const floorsClickable = config.floorsClickable ?? true;
  const lockTarget = config.lockTarget ?? true;

  const handleFloorClick = useCallback((
    floorId: string,
    cx: number,
    baseY: number,
    cz: number,
    floorHeight: number,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number
  ) => {
    setActiveFloorId(floorId);
    setFloorIsolated(true);
    const duration = (config.floorZoomDuration ?? 700);
    window.dispatchEvent(new CustomEvent('focus-floor', {
      detail: { cx, baseY, cz, floorHeight, minX, maxX, minZ, maxZ, duration, targetId: myId.current }
    }));
  }, [config.floorZoomDuration]);

  const handleRoomZoom = useCallback((cx: number, baseY: number, cz: number, w: number, d: number, h: number) => {
    window.dispatchEvent(new CustomEvent('focus-room', {
      detail: { cx, baseY, cz, w, d, h, targetId: myId.current }
    }));
  }, []);

  const handleResetView = useCallback(() => {
    setFloorIsolated(false);
    window.dispatchEvent(new CustomEvent('set-camera-pos', { detail: { label: '3D', targetId: myId.current } }));
  }, []);

  const visibleLayers = config.visibleLayers as VisibleLayer[] | undefined;

  const activeBuilding = config.buildingId
    ? (buildings.find(b => b.id === config.buildingId) || buildings[0])
    : buildings[0];
  const floors = useMemo(() => activeBuilding?.floors || [], [activeBuilding]);

  const visibleFloors = useMemo(() => {
    if (!config.visibleFloorIds || config.visibleFloorIds.length === 0) return floors;
    return floors.filter(f => config.visibleFloorIds!.includes(f.id));
  }, [floors, config.visibleFloorIds]);

  const filteredBuildings = useMemo(() => {
    if (!config.visibleFloorIds || config.visibleFloorIds.length === 0) return buildings;
    return buildings.map(b => {
      if (config.buildingId && b.id !== config.buildingId) return b;
      return {
        ...b,
        floors: b.floors.filter(f => config.visibleFloorIds!.includes(f.id)),
      };
    });
  }, [buildings, config.buildingId, config.visibleFloorIds]);

  const activeFloor = floors.find(f => f.id === activeFloorId);

  if (loading) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: bgTransparent ? 'transparent' : bgColor }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Lade Gebäude...</span>
        </div>
      </div>
    );
  }

  if (error || buildings.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: bgTransparent ? 'transparent' : bgColor }}
      >
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <Maximize2 className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xs text-slate-400">{error || 'Kein Gebäude vorhanden'}</p>
          <p className="text-[10px] text-slate-600">Zuerst ein Gebäude im Gebäude-Editor erstellen</p>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); loadBuildings(); }}
            className="mt-1 px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
          >
            Neu laden
          </button>
        </div>
      </div>
    );
  }

  const displayedFloorId = config.showAllFloors ? null : activeFloorId;
  const canClickFloors = floorsClickable && !config.showAllFloors;

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: bgTransparent ? 'transparent' : bgColor }}>
      <BuildingCanvas3D
        buildings={filteredBuildings}
        activeFloorId={displayedFloorId}
        selectedRoomId={null}
        selectedWallId={null}
        onSelectRoom={() => {}}
        onSelectWall={() => {}}
        liveValues={liveValues}
        highlightFloor={!floorIsolated && !config.showAllFloors && activeFloorId !== null && (config.highlightFloor ?? true)}
        isolateActiveFloor={floorIsolated && !config.showAllFloors && activeFloorId !== null}
        bgColor={bgColor}
        bgTransparent={bgTransparent}
        showGrid={config.showGrid ?? false}
        lighting={lighting}
        explosion={explosion}
        visibleLayers={visibleLayers}
        autoRotate={config.autoRotate ?? false}
        autoRotateSpeed={config.autoRotateSpeed ?? 1.0}
        wallsTransparent={config.wallsTransparent ?? false}
        xrayOpacity={config.xrayOpacity ?? 0.2}
        lockTarget={lockTarget}
        onFloorClick={canClickFloors && activeFloorId !== null && !floorIsolated ? handleFloorClick : undefined}
        onRoomZoom={floorIsolated && activeFloorId !== null ? handleRoomZoom : undefined}
      />
      {floorIsolated && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handleResetView(); }}
          className="absolute top-10 left-2 z-10 flex items-center gap-1 px-2 py-1 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 rounded text-xs text-slate-300 transition-colors backdrop-blur-sm"
          title="Zurück zur Gesamtansicht"
        >
          <RotateCcw className="w-3 h-3" />
          Alle Etagen
        </button>
      )}

      {visibleFloors.length > 0 && !config.showAllFloors && (
        <div className="absolute bottom-8 left-2 z-10">
          <div className="relative">
            <button
              onClick={() => setShowFloorSelector(prev => !prev)}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 rounded text-xs text-slate-300 transition-colors backdrop-blur-sm"
            >
              <span>{activeFloorId === null ? 'Ganzes Gebäude' : (activeFloor?.name || 'Etage')}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFloorSelector && (
              <div
                className="absolute bottom-full mb-1 left-0 bg-slate-900/95 border border-slate-700 rounded shadow-xl backdrop-blur-sm min-w-[130px]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { setActiveFloorId(null); setFloorIsolated(false); setShowFloorSelector(false); window.dispatchEvent(new CustomEvent('set-camera-pos', { detail: { label: '3D', targetId: myId.current } })); }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${activeFloorId === null ? 'text-blue-400 bg-blue-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                >
                  Ganzes Gebäude
                </button>
                {[...visibleFloors].reverse().map(floor => (
                  <button
                    key={floor.id}
                    onClick={() => { setActiveFloorId(floor.id); setFloorIsolated(false); setShowFloorSelector(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${activeFloorId === floor.id ? 'text-blue-400 bg-blue-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isEditMode && (
        <div className="absolute inset-0 bg-transparent pointer-events-none" />
      )}
    </div>
  );
};
