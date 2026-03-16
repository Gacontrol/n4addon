import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Building3DWidgetConfig } from '../../types/visualization';
import { Building } from '../../types/building';
import { BuildingCanvas3D, DEFAULT_LIGHTING, DEFAULT_EXPLOSION, LightingSettings, ExplosionSettings } from '../building/BuildingCanvas3D';
import { Maximize2, ChevronDown } from 'lucide-react';

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
}

export const Visu3DBuilding: React.FC<Visu3DBuildingProps> = ({
  config,
  isEditMode
}) => {
  const [liveValues] = useState<Record<string, string | number>>({});
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [showFloorSelector, setShowFloorSelector] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyBuildingList = useCallback((buildingList: Building[]) => {
    setBuildings(buildingList);
    if (buildingList.length > 0) {
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

  const loadBuildings = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/building-config`);
      if (res.ok) {
        const data = await res.json();
        let buildingList: Building[] = data.buildings || (data.id ? [data] : []);
        if (buildingList.length === 0) {
          try {
            const ls = localStorage.getItem('wiresheet_building_config');
            if (ls) {
              const parsed = JSON.parse(ls);
              buildingList = parsed.buildings || (parsed.id ? [parsed] : []);
            }
          } catch { }
        }
        applyBuildingList(buildingList);
        setError(null);
      } else {
        setError('Gebäude nicht gefunden');
      }
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }, [applyBuildingList]);

  useEffect(() => {
    loadBuildings();
    pollRef.current = setInterval(loadBuildings, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadBuildings]);

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

  const bgColor = config.backgroundColor || '#0a1020';

  const activeBuilding = config.buildingId
    ? (buildings.find(b => b.id === config.buildingId) || buildings[0])
    : buildings[0];
  const floors = activeBuilding?.floors || [];
  const activeFloor = floors.find(f => f.id === activeFloorId);

  if (loading) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
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
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex flex-col items-center gap-2 text-center px-4">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <Maximize2 className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xs text-slate-400">{error || 'Kein Gebäude vorhanden'}</p>
          <p className="text-[10px] text-slate-600">Zuerst ein Gebäude im Gebäude-Editor erstellen</p>
        </div>
      </div>
    );
  }

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
    window.dispatchEvent(new CustomEvent('focus-floor', {
      detail: { cx, baseY, cz, floorHeight, minX, maxX, minZ, maxZ }
    }));
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      <BuildingCanvas3D
        buildings={buildings}
        activeFloorId={config.showAllFloors ? null : activeFloorId}
        selectedRoomId={null}
        selectedWallId={null}
        onSelectRoom={() => {}}
        onSelectWall={() => {}}
        liveValues={liveValues}
        highlightFloor={config.highlightFloor ?? true}
        bgColor={bgColor}
        showGrid={config.showGrid ?? false}
        lighting={lighting}
        explosion={explosion}
        onFloorClick={config.showAllFloors ? undefined : handleFloorClick}
      />

      {floors.length > 1 && !config.showAllFloors && (
        <div className="absolute bottom-8 left-2 z-10">
          <div className="relative">
            <button
              onClick={() => setShowFloorSelector(prev => !prev)}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700 rounded text-xs text-slate-300 transition-colors backdrop-blur-sm"
            >
              <span>{activeFloor?.name || 'Alle Etagen'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFloorSelector && (
              <div
                className="absolute bottom-full mb-1 left-0 bg-slate-900/95 border border-slate-700 rounded shadow-xl backdrop-blur-sm min-w-[120px]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {config.showAllFloors !== false && (
                  <button
                    onClick={() => { setActiveFloorId(null); setShowFloorSelector(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${activeFloorId === null ? 'text-blue-400 bg-blue-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                  >
                    Alle Etagen
                  </button>
                )}
                {[...floors].reverse().map(floor => (
                  <button
                    key={floor.id}
                    onClick={() => { setActiveFloorId(floor.id); setShowFloorSelector(false); }}
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
